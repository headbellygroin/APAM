import { Candle } from './marketData'
import { supabase } from './supabase'
import { listBaseStrategies, CurvePosition, TrendDirection, ZoneType, TradeAction, OddsScores } from './strategies'
import type { TradingStrategy } from './strategies/types'
import { strategyRegistry } from './strategies/registry'
import { evolutionTracker, EvolutionNotification } from './aiEvolution'
import { driftEngine, DriftDecision } from './aiDriftEngine'
import { marketDataCache } from './marketDataCache'

export interface AIRecommendation {
  symbol: string
  action: 'long' | 'short' | 'no_action'
  confidenceScore: number
  oddsScore: number
  entryPrice: number
  stopLoss: number
  targetPrice: number
  strategyId: string
  driftApplied?: boolean
  driftReason?: string
  reasoning: {
    curvePosition: CurvePosition
    trendDirection: TrendDirection
    zoneType: ZoneType
    matrixAction: TradeAction
    scores: Record<string, number>
    riskRewardRatio: number
    entryType: string
  }
}

export interface MarketScanResult {
  symbol: string
  score: number
  recommendation: AIRecommendation
}

export interface ScanProgress {
  scanned: number
  total: number
  currentSymbol: string
  signalsFound: number
}

export interface ScanMarketOptions {
  /** When empty or omitted, all registered base strategies run in parallel. */
  strategyIds?: string[]
}

interface PatternPerformance {
  wins: number
  losses: number
  totalPL: number
  avgWin: number
  avgLoss: number
}

export class AITradingEngine {
  private patternPerformance: Map<string, PatternPerformance> = new Map()
  private isInitialized = false
  private pendingNotifications: EvolutionNotification[] = []

  private resolveTradingStrategy(strategyId?: string): TradingStrategy {
    const fallbackId = listBaseStrategies()[0]?.id ?? 'trade-surge'
    const id =
      strategyId && strategyRegistry.has(strategyId) ? strategyId : fallbackId
    const registered = strategyRegistry.get(id) ?? strategyRegistry.get('trade-surge')
    return registered!.strategy
  }

  async initialize(userId?: string) {
    if (this.isInitialized) return

    try {
      if (userId) {
        await this.loadPatternPerformance(userId)
        await evolutionTracker.loadIdentity(userId)
        await driftEngine.loadState(userId)
      }
      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize AI engine:', error)
    }
  }

  getAIIdentity() {
    return evolutionTracker.getIdentity()
  }

  getPendingNotifications(): EvolutionNotification[] {
    return [...this.pendingNotifications]
  }

  clearPendingNotifications() {
    this.pendingNotifications = []
  }

  private async loadPatternPerformance(userId: string) {
    const { data: trades } = await supabase
      .from('simulated_trades')
      .select('*, ai_recommendations(*)')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .eq('is_ai_recommended', true)

    if (!trades) return

    for (const trade of trades) {
      const rec = trade.ai_recommendations?.[0]
      if (!rec?.reasoning) continue

      const reasoning = rec.reasoning as AIRecommendation['reasoning']
      const patternKey = `${reasoning.curvePosition}-${reasoning.trendDirection}-${reasoning.zoneType}`

      const current = this.patternPerformance.get(patternKey) || {
        wins: 0,
        losses: 0,
        totalPL: 0,
        avgWin: 0,
        avgLoss: 0,
      }

      const pl = trade.profit_loss || 0
      if (pl > 0) {
        current.wins++
        current.avgWin = (current.avgWin * (current.wins - 1) + pl) / current.wins
      } else if (pl < 0) {
        current.losses++
        current.avgLoss = (current.avgLoss * (current.losses - 1) + Math.abs(pl)) / current.losses
      }
      current.totalPL += pl

      this.patternPerformance.set(patternKey, current)
    }
  }

  getPatternWinRate(curvePosition: CurvePosition, trendDirection: TrendDirection, zoneType: ZoneType): number {
    const patternKey = `${curvePosition}-${trendDirection}-${zoneType}`
    const perf = this.patternPerformance.get(patternKey)

    if (!perf || (perf.wins + perf.losses) < 3) {
      return 0.5
    }

    return perf.wins / (perf.wins + perf.losses)
  }

  getPatternExpectancy(curvePosition: CurvePosition, trendDirection: TrendDirection, zoneType: ZoneType): number {
    const patternKey = `${curvePosition}-${trendDirection}-${zoneType}`
    const perf = this.patternPerformance.get(patternKey)

    if (!perf || (perf.wins + perf.losses) < 3) {
      return 0
    }

    const winRate = perf.wins / (perf.wins + perf.losses)
    return (winRate * perf.avgWin) - ((1 - winRate) * perf.avgLoss)
  }

  analyzeCurvePosition(candles: Candle[], strategyId?: string): CurvePosition {
    const strategy = this.resolveTradingStrategy(strategyId)
    return strategy.analyzeCurvePosition(candles)
  }

  analyzeTrend(candles: Candle[], strategyId?: string): TrendDirection {
    const strategy = this.resolveTradingStrategy(strategyId)
    return strategy.analyzeTrend(candles)
  }

  detectZones(candles: Candle[], strategyId?: string) {
    const strategy = this.resolveTradingStrategy(strategyId)
    return strategy.detectZones(candles)
  }

  async generateRecommendation(
    symbol: string,
    userId?: string,
    strategyId?: string
  ): Promise<AIRecommendation | null> {
    try {
      if (userId && !this.isInitialized) {
        await this.initialize(userId)
      }

      const strategy = this.resolveTradingStrategy(strategyId)
      const candles = await marketDataCache.getCandles(symbol, 'D')

      if (!candles || candles.length < 50) {
        return null
      }

      const currentPrice = candles[0].close
      const setup = strategy.generateSetup(candles, currentPrice)

      if (!setup || setup.action === 'no_action') {
        return null
      }

      const curvePosition = strategy.analyzeCurvePosition(candles)
      const trendDirection = strategy.analyzeTrend(candles)
      const zones = strategy.detectZones(candles)

      const nearestZone = zones.reduce((nearest, zone) => {
        const distToCurrent = Math.abs((zone.high + zone.low) / 2 - currentPrice)
        const distToNearest = Math.abs((nearest.high + nearest.low) / 2 - currentPrice)
        return distToCurrent < distToNearest ? zone : nearest
      }, zones[0])

      const action: 'long' | 'short' =
        setup.action === 'long' || setup.action === 'long_advanced' ? 'long' : 'short'

      let confidenceScore = Math.min(10, setup.oddsScore + (setup.riskRewardRatio * 0.5))

      const patternWinRate = this.getPatternWinRate(curvePosition, trendDirection, nearestZone.type)
      const patternExpectancy = this.getPatternExpectancy(curvePosition, trendDirection, nearestZone.type)

      if (patternWinRate > 0.5) {
        const winRateBonus = (patternWinRate - 0.5) * 2
        confidenceScore = Math.min(10, confidenceScore + winRateBonus)
      } else if (patternWinRate < 0.4 && patternWinRate !== 0.5) {
        const penalty = (0.5 - patternWinRate) * 3
        confidenceScore = Math.max(0, confidenceScore - penalty)
      }

      if (patternExpectancy < -10) {
        return null
      }

      const patternKey = `${curvePosition}-${trendDirection}-${nearestZone.type}`

      let driftDecision: DriftDecision
      if (userId) {
        driftDecision = driftEngine.evaluateSetup(
          patternKey,
          setup.oddsScore,
          setup.scores,
          strategy.config.minOddsScore,
          setup.action
        )
      } else {
        const { data: masterState } = await supabase
          .from('master_ai_state')
          .select('synthesized_weights')
          .limit(1)
          .maybeSingle()

        const masterWeights = masterState?.synthesized_weights as any
        let scoreBoost = 0

        if (masterWeights) {
          const baseWeights = { strengthScore: 1, timeScore: 1, freshnessScore: 1, trendScore: 1, curveScore: 1, profitZoneScore: 1 }
          for (const key of Object.keys(baseWeights) as Array<keyof typeof baseWeights>) {
            if (masterWeights[key]) {
              scoreBoost += (masterWeights[key] - 1) * (setup.scores[key] || 0) * 0.1
            }
          }
        }

        driftDecision = {
          drifted: false,
          scoreAdjustment: scoreBoost,
          reason: 'Master AI collective weights applied',
          originalAction: setup.action,
          driftAction: setup.action
        }
      }

      if (driftDecision.drifted && driftDecision.driftAction === 'no_action') {
        return null
      }

      if (driftDecision.scoreAdjustment) {
        confidenceScore = Math.min(10, Math.max(0, confidenceScore + driftDecision.scoreAdjustment * 0.5))
      }

      const recommendation: AIRecommendation = {
        symbol,
        action,
        confidenceScore,
        oddsScore: setup.oddsScore + driftDecision.scoreAdjustment,
        entryPrice: setup.entryPrice,
        stopLoss: setup.stopLoss,
        targetPrice: setup.targetPrice,
        strategyId: strategy.config.id,
        driftApplied: driftDecision.drifted,
        driftReason: driftDecision.drifted ? driftDecision.reason : undefined,
        reasoning: {
          curvePosition,
          trendDirection,
          zoneType: nearestZone.type,
          matrixAction: setup.action,
          scores: setup.scores,
          riskRewardRatio: setup.riskRewardRatio,
          entryType: setup.entryType,
        },
      }

      if (userId) {
        const allStrategies = strategyRegistry.list()
        for (const stratConfig of allStrategies) {
          if (stratConfig.id === strategy.config.id) continue
          const registered = strategyRegistry.get(stratConfig.id)
          if (!registered) continue
          const baseSetup = registered.strategy.generateSetup(candles, currentPrice)
          const baseAction = baseSetup?.action || 'no_action'
          evolutionTracker.trackDecision(
            userId,
            stratConfig.id,
            setup.action,
            baseAction,
            setup.oddsScore,
            symbol
          ).catch(() => {})
        }
      }

      return recommendation
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error)
      return null
    }
  }

  async scanMarket(
    symbols: string[],
    minScore?: number,
    userId?: string,
    onProgress?: (progress: ScanProgress) => void,
    options?: ScanMarketOptions
  ): Promise<MarketScanResult[]> {
    if (userId && !this.isInitialized) {
      await this.initialize(userId)
    }

    const requested = (options?.strategyIds ?? []).filter((id) => strategyRegistry.has(id))
    const strategyIds =
      requested.length > 0
        ? requested
        : listBaseStrategies().map((s) => s.id).filter((id) => strategyRegistry.has(id))

    const ids = strategyIds.length > 0 ? strategyIds : ['trade-surge']

    const results: MarketScanResult[] = []
    const totalSteps = symbols.length * ids.length
    let scannedSteps = 0

    const prefetchBatchSize = 20
    const scanBatchSize = 5
    const symbolTotal = symbols.length

    for (let i = 0; i < symbolTotal; i += prefetchBatchSize) {
      const prefetchBatch = symbols.slice(i, i + prefetchBatchSize)
      await marketDataCache.prefetchSymbols(prefetchBatch)

      for (let j = 0; j < prefetchBatch.length; j += scanBatchSize) {
        const batch = prefetchBatch.slice(j, j + scanBatchSize)

        if (onProgress) {
          onProgress({
            scanned: scannedSteps,
            total: totalSteps,
            currentSymbol: batch[0] ?? '',
            signalsFound: results.length,
          })
        }

        await Promise.all(
          batch.map(async (symbol) => {
            const recs = await Promise.all(
              ids.map((sid) => this.generateRecommendation(symbol, userId, sid))
            )
            recs.forEach((recommendation, idx) => {
              const sid = ids[idx]
              const stratCfg = strategyRegistry.get(sid)?.strategy.config
              const threshold = minScore ?? stratCfg?.minOddsScore ?? 6
              if (
                recommendation &&
                recommendation.oddsScore >= threshold &&
                recommendation.action !== 'no_action'
              ) {
                results.push({
                  symbol,
                  score: recommendation.oddsScore,
                  recommendation,
                })
              }
            })
          })
        )
        scannedSteps += batch.length * ids.length
      }
    }

    if (onProgress) {
      onProgress({
        scanned: totalSteps,
        total: totalSteps,
        currentSymbol: '',
        signalsFound: results.length,
      })
    }

    return results.sort((a, b) => b.score - a.score)
  }

  async recordTradeOutcome(
    userId: string,
    recommendation: AIRecommendation,
    outcome: 'win' | 'loss',
    profitLoss: number
  ) {
    const patternKey = `${recommendation.reasoning.curvePosition}-${recommendation.reasoning.trendDirection}-${recommendation.reasoning.zoneType}`

    const current = this.patternPerformance.get(patternKey) || {
      wins: 0,
      losses: 0,
      totalPL: 0,
      avgWin: 0,
      avgLoss: 0,
    }

    if (profitLoss > 0) {
      current.wins++
      current.avgWin = (current.avgWin * (current.wins - 1) + profitLoss) / current.wins
    } else {
      current.losses++
      current.avgLoss = (current.avgLoss * (current.losses - 1) + Math.abs(profitLoss)) / current.losses
    }
    current.totalPL += profitLoss

    this.patternPerformance.set(patternKey, current)

    driftEngine.onTradeCompleted(
      patternKey,
      recommendation.reasoning.scores as OddsScores,
      recommendation.oddsScore,
      profitLoss
    )

    await supabase.from('ai_learning_history').insert({
      user_id: userId,
      event_type: 'pattern_update',
      performance_metric: profitLoss,
      adjustments: {
        pattern: patternKey,
        outcome,
        strategyId: recommendation.strategyId,
        newWinRate: current.wins / (current.wins + current.losses),
        expectancy: (current.wins / (current.wins + current.losses)) * current.avgWin -
                   (current.losses / (current.wins + current.losses)) * current.avgLoss,
      },
    })

    try {
      await driftEngine.saveState(userId)
    } catch (e) {
      console.error('Drift state save failed:', e)
    }

    try {
      const notifications = await evolutionTracker.checkEvolutionReadiness(userId, recommendation.strategyId)
      if (notifications.length > 0) {
        this.pendingNotifications.push(...notifications)
      }
    } catch (e) {
      console.error('Evolution check failed:', e)
    }
  }

  getDriftSummary() {
    return driftEngine.getDriftSummary()
  }

  getActiveRules() {
    return driftEngine.getActiveRules()
  }

  getRollbacks() {
    return driftEngine.getRollbacks()
  }

  getPatternStats(): Map<string, PatternPerformance> {
    return new Map(this.patternPerformance)
  }

  resetLearning() {
    this.patternPerformance.clear()
    this.isInitialized = false
  }
}

export const aiEngine = new AITradingEngine()
