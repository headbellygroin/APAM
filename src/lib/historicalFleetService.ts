import { supabase } from './supabase'
import { getCandles, Candle } from './marketData'
import { strategyRegistry } from './strategies/registry'
import { AIDriftEngine, PatternOverride } from './aiDriftEngine'
import { calculatePositionSize } from '@/utils/surgeStrategy'
import {
  getMacroContextForDate,
  checkActivePatternTriggers,
  discoverCorrelationsFromSimulation,
} from './macroCorrelationEngine'

interface SymbolLifecycle {
  symbol: string
  listed_date: string | null
  delisted_date: string | null
  delist_reason: string
}

const symbolLifecycleCache = new Map<string, SymbolLifecycle | null>()

async function getSymbolLifecycle(symbol: string): Promise<SymbolLifecycle | null> {
  if (symbolLifecycleCache.has(symbol)) return symbolLifecycleCache.get(symbol) ?? null
  const { data } = await supabase
    .from('symbol_lifecycle')
    .select('symbol, listed_date, delisted_date, delist_reason')
    .eq('symbol', symbol)
    .maybeSingle()
  const result = data as SymbolLifecycle | null
  symbolLifecycleCache.set(symbol, result)
  return result
}

export async function isSymbolActiveOnDate(symbol: string, simDate: string): Promise<boolean> {
  const lc = await getSymbolLifecycle(symbol)
  if (!lc) return true
  if (lc.listed_date && simDate < lc.listed_date) return false
  if (lc.delisted_date && simDate > lc.delisted_date) return false
  return true
}

export function clearSymbolLifecycleCache(): void {
  symbolLifecycleCache.clear()
}

export async function getIndexSymbolsOnDate(
  indexName: string,
  simDate: string
): Promise<string[]> {
  const { data } = await supabase
    .from('market_index_components')
    .select('symbol')
    .eq('index_name', indexName)
    .lte('added_date', simDate)
    .or(`removed_date.is.null,removed_date.gte.${simDate}`)

  return (data || []).map((r: any) => r.symbol as string)
}

export interface HistoricalSimulationRun {
  id: string
  user_id: string
  name: string
  description: string
  start_date: string
  end_date: string
  current_sim_date: string | null
  speed_multiplier: number
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed'
  symbols: string[]
  ruleset_snapshot: Record<string, any>
  results_summary: Record<string, any>
  total_trading_days: number
  errors: string[]
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface HistoricalFleetAccount {
  id: string
  user_id: string
  run_id: string
  name: string
  account_type: 'control' | 'experimental'
  strategy_id: string
  mode: 'strict' | 'adaptive'
  starting_capital: number
  current_capital: number
  risk_per_trade: number
  max_positions: number
  total_trades: number
  winning_trades: number
  total_profit_loss: number
  win_rate: number
  profit_factor: number
  max_drawdown: number
  learned_weights: Record<string, number>
  threshold_adjustments: Record<string, number>
  pattern_overrides: Record<string, PatternOverride>
  drift_decisions: number
  total_decisions: number
  is_drifting: boolean
  equity_curve: Array<{ date: string; equity: number }>
  created_at: string
  updated_at: string
}

export interface HistoricalFleetTrade {
  id: string
  account_id: string
  run_id: string
  user_id: string
  sim_date: string
  symbol: string
  trade_type: 'long' | 'short'
  entry_price: number
  exit_price: number | null
  stop_loss: number
  target_price: number
  position_size: number
  profit_loss: number | null
  status: 'open' | 'closed'
  exit_reason: 'target' | 'stop' | 'manual' | 'time' | null
  odds_score: number | null
  pattern_key: string | null
  was_drift_decision: boolean
  drift_reason: string | null
  entry_time: string | null
  exit_time: string | null
  created_at: string
}

export interface CreateRunParams {
  name: string
  description: string
  startDate: string
  endDate: string
  speedMultiplier: number
  symbols: string[]
  symbolMode?: 'manual' | 'index' | 'sector' | 'whole_market'
  indexName?: string
  sectorFilter?: string
  externalDataSourceIds?: string[]
  accounts: Array<{
    name: string
    accountType: 'control' | 'experimental'
    strategyId: string
    mode: 'strict' | 'adaptive'
    startingCapital: number
    riskPerTrade: number
    maxPositions: number
  }>
}

export interface SimDayResult {
  date: string
  tradesOpened: number
  tradesClosed: number
  totalPL: number
  errors: string[]
  macroContext?: Record<string, number>
}

const MARKET_ERA_PRESETS: Record<string, { start: string; end: string; label: string; description: string }> = {
  'black-monday-1987': { start: '1987-01-01', end: '1987-12-31', label: 'Black Monday 1987', description: 'Single-day 22% crash on Oct 19, 1987' },
  'bull-1990s': { start: '1990-01-01', end: '1999-12-31', label: '1990s Bull Market', description: 'Longest bull market in history, tech boom era' },
  'dot-com-bubble': { start: '1998-01-01', end: '2000-03-10', label: 'Dot-Com Bubble', description: 'Tech stock mania, NASDAQ soared 400%' },
  'dot-com-crash': { start: '2000-03-10', end: '2002-10-09', label: 'Dot-Com Crash', description: 'Market peak to bottom, NASDAQ fell ~78%' },
  'bull-2003-2007': { start: '2003-03-01', end: '2007-10-09', label: '2003-2007 Bull Run', description: 'Post dot-com recovery to pre-crisis high' },
  'financial-crisis': { start: '2007-10-09', end: '2009-03-09', label: '2008 Financial Crisis', description: 'Market peak to bottom, S&P fell ~57%' },
  'recovery-2009': { start: '2009-03-09', end: '2013-03-28', label: '2009-2013 Recovery', description: 'Post-crisis bottom to new highs' },
  'bull-2013-2020': { start: '2013-01-01', end: '2020-02-19', label: '2013-2020 Bull Market', description: 'Extended bull market before COVID' },
  'covid-crash': { start: '2020-02-19', end: '2020-04-01', label: 'COVID Crash', description: 'Fastest bear market in history, ~34% drop in 23 days' },
  'covid-recovery': { start: '2020-04-01', end: '2021-12-31', label: 'COVID Recovery', description: 'V-shaped recovery and stimulus-driven bull run' },
  'bear-2022': { start: '2022-01-03', end: '2022-12-30', label: '2022 Bear Market', description: 'Rate hikes, inflation fears, S&P fell ~25%' },
  'recovery-2023': { start: '2023-01-01', end: '2024-12-31', label: '2023-2024 Recovery', description: 'AI-driven rally and market recovery' },
}

export { MARKET_ERA_PRESETS }

export async function createSimulationRun(
  userId: string,
  params: CreateRunParams
): Promise<HistoricalSimulationRun | null> {
  const registered = strategyRegistry.get(params.accounts[0]?.strategyId || 'trade-surge')
  const rulesetSnapshot = registered ? {
    id: registered.strategy.config.id,
    name: registered.strategy.config.name,
    config: registered.strategy.config,
  } : {}

  const { data: run, error } = await supabase
    .from('historical_simulation_runs')
    .insert({
      user_id: userId,
      name: params.name,
      description: params.description,
      start_date: params.startDate,
      end_date: params.endDate,
      current_sim_date: params.startDate,
      speed_multiplier: params.speedMultiplier,
      symbols: params.symbols,
      symbol_mode: params.symbolMode || 'manual',
      index_name: params.indexName || '',
      sector_filter: params.sectorFilter || '',
      external_data_source_ids: params.externalDataSourceIds || [],
      ruleset_snapshot: rulesetSnapshot,
      status: 'pending',
    })
    .select()
    .maybeSingle()

  if (error || !run) return null

  for (const acct of params.accounts) {
    await supabase.from('historical_fleet_accounts').insert({
      user_id: userId,
      run_id: run.id,
      name: acct.name,
      account_type: acct.accountType,
      strategy_id: acct.strategyId,
      mode: acct.mode,
      starting_capital: acct.startingCapital,
      current_capital: acct.startingCapital,
      risk_per_trade: acct.riskPerTrade,
      max_positions: acct.maxPositions,
    })
  }

  return run as HistoricalSimulationRun
}

export async function getSimulationRuns(userId: string): Promise<HistoricalSimulationRun[]> {
  const { data } = await supabase
    .from('historical_simulation_runs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (data || []) as HistoricalSimulationRun[]
}

export async function getSimulationRun(runId: string): Promise<HistoricalSimulationRun | null> {
  const { data } = await supabase
    .from('historical_simulation_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle()

  return data as HistoricalSimulationRun | null
}

export async function getRunAccounts(runId: string): Promise<HistoricalFleetAccount[]> {
  const { data } = await supabase
    .from('historical_fleet_accounts')
    .select('*')
    .eq('run_id', runId)
    .order('account_type', { ascending: true })

  return (data || []) as HistoricalFleetAccount[]
}

export async function getRunTrades(
  runId: string,
  accountId?: string,
  limit: number = 200
): Promise<HistoricalFleetTrade[]> {
  let query = supabase
    .from('historical_fleet_trades')
    .select('*')
    .eq('run_id', runId)
    .order('sim_date', { ascending: false })
    .limit(limit)

  if (accountId) query = query.eq('account_id', accountId)

  const { data } = await query
  return (data || []) as HistoricalFleetTrade[]
}

export async function deleteSimulationRun(runId: string): Promise<boolean> {
  const { error } = await supabase
    .from('historical_simulation_runs')
    .delete()
    .eq('id', runId)

  return !error
}

export async function updateRunStatus(
  runId: string,
  status: HistoricalSimulationRun['status'],
  run?: HistoricalSimulationRun
): Promise<boolean> {
  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'running' && !updates.started_at) {
    updates.started_at = new Date().toISOString()
  }
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('historical_simulation_runs')
    .update(updates)
    .eq('id', runId)

  if (!error && status === 'completed' && run) {
    discoverCorrelationsFromSimulation(runId, run.start_date, run.end_date).catch(() => {})
  }

  return !error
}

const historicalCandleCache = new Map<string, Candle[]>()

async function getHistoricalCandles(symbol: string): Promise<Candle[]> {
  const cacheKey = `hist-${symbol}`
  if (historicalCandleCache.has(cacheKey)) {
    return historicalCandleCache.get(cacheKey)!
  }

  const candles = await getCandles(symbol, 'D', 5000)
  if (candles.length > 0) {
    historicalCandleCache.set(cacheKey, candles)
  }
  return candles
}

function getCandlesUpToDate(allCandles: Candle[], simDate: string, lookback: number = 200): Candle[] {
  const simTimestamp = new Date(simDate).getTime() / 1000
  const filtered = allCandles.filter(c => c.timestamp <= simTimestamp)
  return filtered.slice(-lookback)
}

function getCandleForDate(allCandles: Candle[], simDate: string): Candle | null {
  const simTimestamp = new Date(simDate).getTime() / 1000
  const dayStart = simTimestamp - 86400
  return allCandles.find(c => c.timestamp > dayStart && c.timestamp <= simTimestamp + 86400) || null
}

export async function simulateDay(
  run: HistoricalSimulationRun,
  accounts: HistoricalFleetAccount[],
  simDate: string
): Promise<SimDayResult> {
  const macroContext = await getMacroContextForDate(simDate)

  const result: SimDayResult = {
    date: simDate,
    tradesOpened: 0,
    tradesClosed: 0,
    totalPL: 0,
    errors: [],
    macroContext: Object.keys(macroContext).length > 0 ? macroContext : undefined,
  }

  for (const account of accounts) {
    try {
      await processAccountDay(account, run, simDate, result, macroContext)
    } catch (e) {
      result.errors.push(`${account.name}: ${e}`)
    }
  }

  await supabase
    .from('historical_simulation_runs')
    .update({
      current_sim_date: simDate,
      total_trading_days: run.total_trading_days + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', run.id)

  return result
}

async function processAccountDay(
  account: HistoricalFleetAccount,
  run: HistoricalSimulationRun,
  simDate: string,
  result: SimDayResult,
  _macroContext: Record<string, number> = {}
): Promise<void> {
  const { data: openTrades } = await supabase
    .from('historical_fleet_trades')
    .select('*')
    .eq('account_id', account.id)
    .eq('status', 'open')

  const open = (openTrades || []) as HistoricalFleetTrade[]

  for (const trade of open) {
    const isActive = await isSymbolActiveOnDate(trade.symbol, simDate)
    if (!isActive) {
      const lc = await getSymbolLifecycle(trade.symbol)
      const reason = lc?.delist_reason === 'bankruptcy' ? 'bankruptcy_stop' : 'delisted'
      const lastCandles = historicalCandleCache.get(`hist-${trade.symbol}`) || []
      const lastKnownCandle = lastCandles.length > 0 ? lastCandles[lastCandles.length - 1] : null
      const exitPrice = reason === 'bankruptcy_stop' ? trade.entry_price * 0.05 : (lastKnownCandle?.close ?? trade.entry_price)
      let profitLoss: number
      if (trade.trade_type === 'long') {
        profitLoss = (exitPrice - trade.entry_price) * trade.position_size
      } else {
        profitLoss = (trade.entry_price - exitPrice) * trade.position_size
      }
      profitLoss = Math.round(profitLoss * 100) / 100
      await supabase.from('historical_fleet_trades').update({
        exit_price: exitPrice,
        profit_loss: profitLoss,
        status: 'closed',
        exit_reason: 'manual',
        exit_time: `${simDate}T16:00:00Z`,
        drift_reason: `Symbol ${reason} on ${simDate}`,
      }).eq('id', trade.id)
      result.tradesClosed++
      result.totalPL += profitLoss
      continue
    }

    const allCandles = await getHistoricalCandles(trade.symbol)
    const todayCandle = getCandleForDate(allCandles, simDate)
    if (!todayCandle) continue

    let shouldClose = false
    let exitReason: 'target' | 'stop' = 'target'
    let exitPrice = todayCandle.close

    if (trade.trade_type === 'long') {
      if (todayCandle.high >= trade.target_price) {
        shouldClose = true
        exitReason = 'target'
        exitPrice = trade.target_price
      } else if (todayCandle.low <= trade.stop_loss) {
        shouldClose = true
        exitReason = 'stop'
        exitPrice = trade.stop_loss
      }
    } else {
      if (todayCandle.low <= trade.target_price) {
        shouldClose = true
        exitReason = 'target'
        exitPrice = trade.target_price
      } else if (todayCandle.high >= trade.stop_loss) {
        shouldClose = true
        exitReason = 'stop'
        exitPrice = trade.stop_loss
      }
    }

    if (shouldClose) {
      let profitLoss: number
      if (trade.trade_type === 'long') {
        profitLoss = (exitPrice - trade.entry_price) * trade.position_size
      } else {
        profitLoss = (trade.entry_price - exitPrice) * trade.position_size
      }
      profitLoss = Math.round((profitLoss - trade.position_size * 0.01) * 100) / 100

      await supabase
        .from('historical_fleet_trades')
        .update({
          exit_price: exitPrice,
          profit_loss: profitLoss,
          status: 'closed',
          exit_reason: exitReason,
          exit_time: `${simDate}T16:00:00Z`,
        })
        .eq('id', trade.id)

      result.tradesClosed++
      result.totalPL += profitLoss

      if (account.mode === 'adaptive' && trade.pattern_key) {
        await updateHistoricalDrift(account, trade.pattern_key, profitLoss)
      }
    }
  }

  const currentOpen = open.filter(t => {
    const allCandles = historicalCandleCache.get(`hist-${t.symbol}`)
    if (!allCandles) return true
    const todayCandle = getCandleForDate(allCandles, simDate)
    if (!todayCandle) return true

    if (t.trade_type === 'long') {
      return todayCandle.high < t.target_price && todayCandle.low > t.stop_loss
    }
    return todayCandle.low > t.target_price && todayCandle.high < t.stop_loss
  })

  const openSlots = account.max_positions - currentOpen.length
  if (openSlots <= 0) return

  const openSymbols = new Set(currentOpen.map(t => t.symbol))
  const registered = strategyRegistry.get(account.strategy_id)
  if (!registered) return

  const strategy = registered.strategy
  let slotsUsed = 0

  let symbolPool = run.symbols
  const runAny = run as any
  if (runAny.symbol_mode === 'index' && runAny.index_name) {
    symbolPool = await getIndexSymbolsOnDate(runAny.index_name, simDate)
    if (symbolPool.length === 0) symbolPool = run.symbols
  }

  for (const symbol of symbolPool) {
    if (slotsUsed >= openSlots) break
    if (openSymbols.has(symbol)) continue

    const isActive = await isSymbolActiveOnDate(symbol, simDate)
    if (!isActive) continue

    const allCandles = await getHistoricalCandles(symbol)
    if (allCandles.length === 0) continue

    const candlesUpToDate = getCandlesUpToDate(allCandles, simDate)
    if (candlesUpToDate.length < 50) continue

    const todayCandle = getCandleForDate(allCandles, simDate)
    if (!todayCandle) continue

    const currentPrice = todayCandle.close

    const setup = strategy.generateSetup(candlesUpToDate, currentPrice)
    if (!setup || setup.action === 'no_action') continue

    const curvePosition = strategy.analyzeCurvePosition(candlesUpToDate)
    const trendDirection = strategy.analyzeTrend(candlesUpToDate)
    const zones = strategy.detectZones(candlesUpToDate)
    if (zones.length === 0) continue

    const nearestZone = zones.reduce((nearest, zone) => {
      const dist = Math.abs((zone.high + zone.low) / 2 - currentPrice)
      const nearestDist = Math.abs((nearest.high + nearest.low) / 2 - currentPrice)
      return dist < nearestDist ? zone : nearest
    }, zones[0])

    const patternKey = `${curvePosition}-${trendDirection}-${nearestZone.type}`
    let wasDriftDecision = false
    let driftReason: string | null = null

    if (account.mode === 'adaptive') {
      const engine = new AIDriftEngine()
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

    const positionSize = calculatePositionSize(
      account.current_capital,
      account.risk_per_trade,
      setup.entryPrice,
      setup.stopLoss
    )

    if (positionSize <= 0) continue

    const firingTriggers = await checkActivePatternTriggers(simDate, symbol)
    const macroSignalNote = firingTriggers.length > 0
      ? `macro_triggers:${firingTriggers.map(t => t.pattern_name).join(',')}`
      : null

    const { error } = await supabase
      .from('historical_fleet_trades')
      .insert({
        account_id: account.id,
        run_id: run.id,
        user_id: account.user_id,
        sim_date: simDate,
        symbol,
        trade_type: tradeType,
        entry_price: setup.entryPrice,
        stop_loss: setup.stopLoss,
        target_price: setup.targetPrice,
        position_size: positionSize,
        odds_score: setup.oddsScore,
        pattern_key: patternKey,
        was_drift_decision: wasDriftDecision,
        drift_reason: macroSignalNote ?? driftReason,
        status: 'open',
        entry_time: `${simDate}T10:00:00Z`,
      })

    if (!error) {
      slotsUsed++
      result.tradesOpened++
    }
  }

  await updateHistoricalAccountStats(account.id)
}

async function updateHistoricalDrift(
  account: HistoricalFleetAccount,
  _patternKey: string,
  _profitLoss: number
): Promise<void> {
  const driftDecisions = account.drift_decisions + 1
  const totalDecisions = account.total_decisions + 1

  await supabase
    .from('historical_fleet_accounts')
    .update({
      drift_decisions: driftDecisions,
      total_decisions: totalDecisions,
      is_drifting: driftDecisions / totalDecisions > 0.1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id)
}

async function updateHistoricalAccountStats(accountId: string): Promise<void> {
  const { data: account } = await supabase
    .from('historical_fleet_accounts')
    .select('starting_capital, equity_curve')
    .eq('id', accountId)
    .maybeSingle()

  if (!account) return

  const { data: trades } = await supabase
    .from('historical_fleet_trades')
    .select('profit_loss')
    .eq('account_id', accountId)
    .eq('status', 'closed')

  if (!trades || trades.length === 0) return

  let wins = 0
  let totalPL = 0
  let grossWins = 0
  let grossLosses = 0
  let peak = account.starting_capital
  let maxDrawdown = 0
  let runningBalance = account.starting_capital

  for (const t of trades) {
    const pl = t.profit_loss || 0
    totalPL += pl
    runningBalance += pl
    if (runningBalance > peak) peak = runningBalance
    const dd = ((peak - runningBalance) / peak) * 100
    if (dd > maxDrawdown) maxDrawdown = dd
    if (pl > 0) { wins++; grossWins += pl }
    else { grossLosses += Math.abs(pl) }
  }

  const total = trades.length
  const winRate = total > 0 ? (wins / total) * 100 : 0
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : wins > 0 ? 999 : 0

  await supabase
    .from('historical_fleet_accounts')
    .update({
      current_capital: account.starting_capital + totalPL,
      total_trades: total,
      winning_trades: wins,
      total_profit_loss: Math.round(totalPL * 100) / 100,
      win_rate: Math.round(winRate * 100) / 100,
      profit_factor: Math.round(profitFactor * 100) / 100,
      max_drawdown: Math.round(maxDrawdown * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)
}

function getTradingDays(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const current = new Date(startDate)
  const end = new Date(endDate)

  while (current <= end) {
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6) {
      days.push(current.toISOString().split('T')[0])
    }
    current.setDate(current.getDate() + 1)
  }

  return days
}

export async function runSimulationBatch(
  runId: string,
  batchSize: number = 5
): Promise<{
  daysProcessed: number
  results: SimDayResult[]
  isComplete: boolean
}> {
  const run = await getSimulationRun(runId)
  if (!run || (run.status !== 'pending' && run.status !== 'running')) {
    return { daysProcessed: 0, results: [], isComplete: true }
  }

  if (run.status === 'pending') {
    await updateRunStatus(runId, 'running')
  }

  const accounts = await getRunAccounts(runId)
  if (accounts.length === 0) {
    await updateRunStatus(runId, 'failed')
    return { daysProcessed: 0, results: [], isComplete: true }
  }

  const allDays = getTradingDays(run.start_date, run.end_date)
  const currentIdx = run.current_sim_date
    ? allDays.indexOf(run.current_sim_date)
    : -1
  const startIdx = currentIdx + 1

  if (startIdx >= allDays.length) {
    await completeRun(runId, accounts)
    return { daysProcessed: 0, results: [], isComplete: true }
  }

  const daysToProcess = allDays.slice(startIdx, startIdx + batchSize)
  const results: SimDayResult[] = []

  for (const day of daysToProcess) {
    const freshAccounts = await getRunAccounts(runId)
    const dayResult = await simulateDay(
      { ...run, total_trading_days: run.total_trading_days + results.length },
      freshAccounts,
      day
    )
    results.push(dayResult)
  }

  const isLastBatch = startIdx + batchSize >= allDays.length
  if (isLastBatch) {
    const freshAccounts = await getRunAccounts(runId)
    await completeRun(runId, freshAccounts)
  }

  return {
    daysProcessed: results.length,
    results,
    isComplete: isLastBatch,
  }
}

async function completeRun(
  runId: string,
  accounts: HistoricalFleetAccount[]
): Promise<void> {
  const summary: Record<string, any> = {
    accounts: accounts.map(a => ({
      id: a.id,
      name: a.name,
      type: a.account_type,
      strategy: a.strategy_id,
      mode: a.mode,
      totalTrades: a.total_trades,
      winRate: a.win_rate,
      profitFactor: a.profit_factor,
      totalPL: a.total_profit_loss,
      maxDrawdown: a.max_drawdown,
      returnPct: a.starting_capital > 0
        ? ((a.current_capital - a.starting_capital) / a.starting_capital * 100)
        : 0,
      driftPct: a.total_decisions > 0
        ? (a.drift_decisions / a.total_decisions * 100)
        : 0,
    })),
  }

  const controls = accounts.filter(a => a.account_type === 'control')
  const experiments = accounts.filter(a => a.account_type === 'experimental')

  if (controls.length > 0 && experiments.length > 0) {
    const avgControlWR = controls.reduce((s, a) => s + a.win_rate, 0) / controls.length
    const avgExpWR = experiments.reduce((s, a) => s + a.win_rate, 0) / experiments.length
    const avgControlPL = controls.reduce((s, a) => s + a.total_profit_loss, 0) / controls.length
    const avgExpPL = experiments.reduce((s, a) => s + a.total_profit_loss, 0) / experiments.length

    summary.comparison = {
      controlAvgWinRate: avgControlWR,
      experimentalAvgWinRate: avgExpWR,
      winRateDiff: avgExpWR - avgControlWR,
      controlAvgPL: avgControlPL,
      experimentalAvgPL: avgExpPL,
      plDiff: avgExpPL - avgControlPL,
      verdict: avgExpWR > avgControlWR + 2
        ? 'Experimental outperforms control -- drift adds value in this era'
        : avgExpWR < avgControlWR - 2
          ? 'Control outperforms experimental -- strict rules win in this era'
          : 'No significant difference between control and experimental',
    }
  }

  await supabase
    .from('historical_simulation_runs')
    .update({
      status: 'completed',
      results_summary: summary,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
}

export async function getRunProgress(runId: string): Promise<{
  totalDays: number
  processedDays: number
  progressPct: number
  currentDate: string | null
}> {
  const run = await getSimulationRun(runId)
  if (!run) return { totalDays: 0, processedDays: 0, progressPct: 0, currentDate: null }

  const totalDays = getTradingDays(run.start_date, run.end_date).length
  return {
    totalDays,
    processedDays: run.total_trading_days,
    progressPct: totalDays > 0 ? (run.total_trading_days / totalDays) * 100 : 0,
    currentDate: run.current_sim_date,
  }
}
