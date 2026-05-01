import { trainingAccountService, TrainingAccount, TrainingTrade } from './trainingAccountService'
import { getCandles, getQuote } from './marketData'
import { strategyRegistry } from './strategies/registry'
import { applyOverlaysToTradeSetup, fetchTrainingAccountOverlays } from './strategyOverlays'
import { AIDriftEngine, PatternOverride } from './aiDriftEngine'
import { OddsScores } from './strategies/types'
import { calculatePositionSize } from '@/utils/surgeStrategy'
import { bankruptcyProtection } from './bankruptcyProtection'

export interface SimulationTickResult {
  accountId: string
  tradesOpened: number
  tradesClosed: number
  newPL: number
  errors: string[]
}

const activeTimers = new Map<string, number>()
const accountDriftEngines = new Map<string, AIDriftEngine>()

function getDriftEngine(account: TrainingAccount): AIDriftEngine {
  let engine = accountDriftEngines.get(account.id)
  if (!engine) {
    engine = new AIDriftEngine()
    accountDriftEngines.set(account.id, engine)
  }
  return engine
}

export async function runSimulationTick(
  account: TrainingAccount,
  watchlistSymbols: string[]
): Promise<SimulationTickResult> {
  const result: SimulationTickResult = {
    accountId: account.id,
    tradesOpened: 0,
    tradesClosed: 0,
    newPL: 0,
    errors: [],
  }

  if (account.status !== 'active') return result

  try {
    await checkOpenTrades(account, result)
  } catch (e) {
    result.errors.push(`Trade monitor error: ${e}`)
  }

  try {
    await scanForNewTrades(account, watchlistSymbols, result)
  } catch (e) {
    result.errors.push(`Scan error: ${e}`)
  }

  return result
}

async function checkOpenTrades(
  account: TrainingAccount,
  result: SimulationTickResult
): Promise<void> {
  const openTrades = await trainingAccountService.getOpenTrades(account.id)

  for (const trade of openTrades) {
    const quote = await getQuote(trade.symbol)
    if (!quote) continue

    const currentPrice = quote.price
    let shouldClose = false
    let exitReason: 'target' | 'stop' = 'target'
    let exitPrice = currentPrice

    if (trade.trade_type === 'long') {
      if (currentPrice >= trade.target_price) {
        shouldClose = true
        exitReason = 'target'
        exitPrice = trade.target_price
      } else if (currentPrice <= trade.stop_loss) {
        shouldClose = true
        exitReason = 'stop'
        exitPrice = trade.stop_loss
      }
    } else {
      if (currentPrice <= trade.target_price) {
        shouldClose = true
        exitReason = 'target'
        exitPrice = trade.target_price
      } else if (currentPrice >= trade.stop_loss) {
        shouldClose = true
        exitReason = 'stop'
        exitPrice = trade.stop_loss
      }
    }

    if (shouldClose) {
      const closeResult = await trainingAccountService.closeTrade(trade.id, exitPrice, exitReason)
      if (closeResult) {
        result.tradesClosed++
        result.newPL += closeResult.profitLoss

        await bankruptcyProtection.updateRiskTier(account.id)

        if (account.mode === 'adaptive') {
          updateDriftOnClose(account, trade, closeResult.profitLoss)
        }
      }
    }
  }
}

function updateDriftOnClose(
  account: TrainingAccount,
  trade: TrainingTrade,
  profitLoss: number
): void {
  const engine = getDriftEngine(account)
  if (trade.pattern_key) {
    engine.onTradeCompleted(
      trade.pattern_key,
      {} as OddsScores,
      trade.odds_score || 0,
      profitLoss
    )
    engine.recalculateWeights()
    engine.recalculateThresholds()

    const state = engine.getState()
    const overridesObj: Record<string, PatternOverride> = {}
    state.patternOverrides.forEach((v, k) => { overridesObj[k] = v })

    trainingAccountService.updateDriftState(
      account.id,
      state.learnedWeights,
      state.thresholdAdjustments,
      overridesObj,
      state.driftedDecisions,
      state.totalDecisions,
      state.isDrifting
    )
  }
}

async function scanForNewTrades(
  account: TrainingAccount,
  symbols: string[],
  result: SimulationTickResult
): Promise<void> {
  const riskStatus = await bankruptcyProtection.getAccountRiskStatus(account.id)
  if (!riskStatus || !riskStatus.canTrade) {
    if (riskStatus?.isBankrupt) {
      result.errors.push('Account is bankrupt and cannot trade')
    }
    return
  }

  const personality = await bankruptcyProtection.getPersonalityTraits(account.id)
  if (!personality) return

  const openTrades = await trainingAccountService.getOpenTrades(account.id)
  if (openTrades.length >= account.max_positions) return

  const registered = strategyRegistry.get(account.strategy_id)
  if (!registered) {
    result.errors.push(`Strategy ${account.strategy_id} not found`)
    return
  }
  const strategy = registered.strategy

  const openSymbols = new Set(openTrades.map(t => t.symbol))
  const availableSlots = account.max_positions - openTrades.length

  let tradesOpened = 0

  for (const symbol of symbols) {
    if (tradesOpened >= availableSlots) break
    if (openSymbols.has(symbol)) continue

    try {
      const candles = await getCandles(symbol, 'D')
      const quote = await getQuote(symbol)
      if (!candles || candles.length < 50 || !quote) continue

      let setup = strategy.generateSetup(candles, quote.price)
      if (!setup || setup.action === 'no_action') continue

      const overlays = await fetchTrainingAccountOverlays(account.id)
      if (overlays.length > 0) {
        const { setup: adjusted, vetoed } = applyOverlaysToTradeSetup({
          baseSetup: setup,
          candles,
          overlays,
        })
        if (vetoed) continue
        setup = adjusted
      }

      if (!bankruptcyProtection.shouldTakeTrade(setup.oddsScore, personality, riskStatus)) {
        continue
      }

      const curvePosition = strategy.analyzeCurvePosition(candles)
      const trendDirection = strategy.analyzeTrend(candles)
      const zones = strategy.detectZones(candles)
      if (zones.length === 0) continue

      const nearestZone = zones.reduce((nearest, zone) => {
        const dist = Math.abs((zone.high + zone.low) / 2 - quote.price)
        const nearestDist = Math.abs((nearest.high + nearest.low) / 2 - quote.price)
        return dist < nearestDist ? zone : nearest
      }, zones[0])

      const patternKey = `${curvePosition}-${trendDirection}-${nearestZone.type}`

      let wasDriftDecision = false
      let driftReason: string | undefined

      if (account.mode === 'adaptive') {
        const engine = getDriftEngine(account)
        const driftDecision = engine.evaluateSetup(
          patternKey,
          setup.oddsScore,
          setup.scores,
          strategy.config.minOddsScore,
          setup.action
        )

        if (driftDecision.drifted) {
          wasDriftDecision = true
          driftReason = driftDecision.reason

          if (driftDecision.driftAction === 'no_action') continue
        }
      } else {
        if (setup.oddsScore < strategy.config.minOddsScore) continue
      }

      const tradeType: 'long' | 'short' =
        setup.action === 'long' || setup.action === 'long_advanced' ? 'long' : 'short'

      const personalityAdjustedRisk = bankruptcyProtection.calculatePersonalityBasedRisk(
        account.risk_per_trade,
        personality,
        riskStatus
      )

      const positionSize = Math.min(
        calculatePositionSize(
          account.current_capital,
          personalityAdjustedRisk,
          setup.entryPrice,
          setup.stopLoss
        ),
        riskStatus.maxPositionSize
      )

      if (positionSize <= 0) continue

      const recorded = await trainingAccountService.recordTrade(
        account.id,
        account.user_id,
        {
          symbol,
          tradeType,
          entryPrice: setup.entryPrice,
          stopLoss: setup.stopLoss,
          targetPrice: setup.targetPrice,
          positionSize,
          oddsScore: setup.oddsScore,
          confidenceScore: setup.oddsScore,
          patternKey,
          wasDriftDecision,
          driftReason,
        }
      )

      if (recorded) {
        tradesOpened++
        result.tradesOpened++
      }
    } catch (e) {
      result.errors.push(`${symbol}: ${e}`)
    }
  }
}

export function startAccountSimulation(
  account: TrainingAccount,
  watchlistSymbols: string[],
  onTick?: (result: SimulationTickResult) => void
): void {
  stopAccountSimulation(account.id)

  const intervalMs = account.scan_interval_seconds * 1000
  const timer = window.setInterval(async () => {
    const freshAccount = await trainingAccountService.getAccount(account.id)
    if (!freshAccount || freshAccount.status !== 'active') {
      stopAccountSimulation(account.id)
      return
    }

    const tickResult = await runSimulationTick(freshAccount, watchlistSymbols)
    onTick?.(tickResult)
  }, intervalMs)

  activeTimers.set(account.id, timer)
}

export function stopAccountSimulation(accountId: string): void {
  const timer = activeTimers.get(accountId)
  if (timer) {
    clearInterval(timer)
    activeTimers.delete(accountId)
  }
  accountDriftEngines.delete(accountId)
}

export function stopAllSimulations(): void {
  for (const [id] of activeTimers) {
    stopAccountSimulation(id)
  }
}

export function isSimulationRunning(accountId: string): boolean {
  return activeTimers.has(accountId)
}
