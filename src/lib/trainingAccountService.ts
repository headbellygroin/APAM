import { supabase } from './supabase'
import { replaceTrainingAccountOverlays } from './strategyOverlays'
import { LearnedWeights, ThresholdAdjustments, PatternOverride } from './aiDriftEngine'

export type TrainingMode = 'strict' | 'adaptive'
export type TrainingStatus = 'active' | 'paused' | 'stopped'

export interface TrainingAccount {
  id: string
  user_id: string
  name: string
  strategy_id: string
  mode: TrainingMode
  starting_capital: number
  current_capital: number
  risk_per_trade: number
  max_positions: number
  scan_interval_seconds: number
  status: TrainingStatus
  total_trades: number
  winning_trades: number
  total_profit_loss: number
  win_rate: number
  profit_factor: number
  expectancy: number
  max_drawdown: number
  learned_weights: LearnedWeights
  threshold_adjustments: ThresholdAdjustments
  pattern_overrides: Record<string, PatternOverride>
  drift_decisions: number
  total_decisions: number
  is_drifting: boolean
  promoted_to_master: boolean
  promoted_at: string | null
  spawned_by_master: boolean
  parent_account_ids: string[]
  generation: number
  promoted_from_spawned: boolean
  replaced_account_id: string | null
  lineage_name: string | null
  origin_type: 'user_created' | 'master_spawned' | 'promoted'
  created_at: string
  updated_at: string
}

export interface TrainingTrade {
  id: string
  account_id: string
  user_id: string
  symbol: string
  trade_type: 'long' | 'short'
  entry_price: number
  exit_price: number | null
  stop_loss: number
  target_price: number
  position_size: number
  profit_loss: number | null
  gross_profit_loss: number | null
  total_fees: number
  status: 'open' | 'closed' | 'cancelled'
  exit_reason: 'target' | 'stop' | 'manual' | 'time' | null
  odds_score: number | null
  confidence_score: number | null
  pattern_key: string | null
  was_drift_decision: boolean
  drift_reason: string | null
  entry_time: string
  exit_time: string | null
  created_at: string
}

export interface CreateAccountParams {
  name: string
  strategyId: string
  mode: TrainingMode
  startingCapital: number
  riskPerTrade: number
  maxPositions: number
  scanIntervalSeconds: number
  overlayStrategyIds?: string[]
}

export interface LeaderboardEntry {
  id: string
  name: string
  strategy_id: string
  mode: TrainingMode
  status: TrainingStatus
  total_trades: number
  win_rate: number
  total_profit_loss: number
  profit_factor: number
  expectancy: number
  max_drawdown: number
  return_pct: number
  is_drifting: boolean
  drift_pct: number
  promoted_to_master: boolean
}

function generateRandomPersonality() {
  const risk = Math.floor(Math.random() * 10) + 1
  const frequency = Math.floor(Math.random() * 10) + 1
  const adaptation = Math.floor(Math.random() * 10) + 1

  let personalityName = 'The Professor'
  if (risk <= 3 && frequency <= 3) {
    personalityName = 'The Sniper'
  } else if (risk >= 8 && frequency >= 8) {
    personalityName = 'The Gambler'
  } else if (risk >= 8 && adaptation <= 4) {
    personalityName = 'The Cowboy'
  } else if (risk <= 4 && adaptation >= 7) {
    personalityName = 'The Scholar'
  } else if (risk >= 7 && adaptation >= 7) {
    personalityName = 'The Maverick'
  } else if (risk <= 3 && adaptation <= 3) {
    personalityName = 'The Guardian'
  } else if (frequency >= 8 && adaptation >= 7) {
    personalityName = 'The Dynamo'
  } else if (frequency <= 3 && adaptation >= 7) {
    personalityName = 'The Strategist'
  }

  return { risk, frequency, adaptation, personalityName }
}

async function createAccount(userId: string, params: CreateAccountParams): Promise<TrainingAccount | null> {
  const personality = generateRandomPersonality()

  const { data, error } = await supabase
    .from('ai_training_accounts')
    .insert({
      user_id: userId,
      name: params.name,
      strategy_id: params.strategyId,
      mode: params.mode,
      starting_capital: params.startingCapital,
      current_capital: params.startingCapital,
      risk_per_trade: params.riskPerTrade,
      max_positions: params.maxPositions,
      scan_interval_seconds: params.scanIntervalSeconds,
      status: 'paused',
      risk_appetite: personality.risk,
      trade_frequency: personality.frequency,
      adaptation_speed: personality.adaptation,
      personality_name: personality.personalityName,
      starting_balance: params.startingCapital,
      critical_threshold: params.startingCapital * 0.2,
      warning_threshold: params.startingCapital * 0.5,
      risk_tier: 'comfortable',
      is_bankrupt: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create training account:', error)
    return null
  }

  const account = data as TrainingAccount
  if (params.overlayStrategyIds?.length) {
    await replaceTrainingAccountOverlays(userId, account.id, params.overlayStrategyIds)
  }
  return account
}

async function getAccounts(userId: string): Promise<TrainingAccount[]> {
  const { data } = await supabase
    .from('ai_training_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (data || []) as TrainingAccount[]
}

async function getAccount(accountId: string): Promise<TrainingAccount | null> {
  const { data } = await supabase
    .from('ai_training_accounts')
    .select('*')
    .eq('id', accountId)
    .maybeSingle()

  return data as TrainingAccount | null
}

async function updateStatus(accountId: string, status: TrainingStatus): Promise<boolean> {
  const { error } = await supabase
    .from('ai_training_accounts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', accountId)

  return !error
}

async function deleteAccount(accountId: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_training_accounts')
    .delete()
    .eq('id', accountId)

  return !error
}

async function resetAccount(accountId: string): Promise<boolean> {
  const account = await getAccount(accountId)
  if (!account) return false

  await supabase
    .from('ai_training_trades')
    .delete()
    .eq('account_id', accountId)

  const { error } = await supabase
    .from('ai_training_accounts')
    .update({
      current_capital: account.starting_capital,
      total_trades: 0,
      winning_trades: 0,
      total_profit_loss: 0,
      win_rate: 0,
      profit_factor: 0,
      expectancy: 0,
      max_drawdown: 0,
      learned_weights: { strengthScore: 1, timeScore: 1, freshnessScore: 1, trendScore: 1, curveScore: 1, profitZoneScore: 1 },
      threshold_adjustments: { minOddsScore: 0, minRiskReward: 0, confidenceFloor: 0 },
      pattern_overrides: {},
      drift_decisions: 0,
      total_decisions: 0,
      is_drifting: false,
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)

  return !error
}

async function getAccountTrades(accountId: string, limit: number = 100): Promise<TrainingTrade[]> {
  const { data } = await supabase
    .from('ai_training_trades')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data || []) as TrainingTrade[]
}

async function getOpenTrades(accountId: string): Promise<TrainingTrade[]> {
  const { data } = await supabase
    .from('ai_training_trades')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'open')

  return (data || []) as TrainingTrade[]
}

async function recordTrade(
  accountId: string,
  userId: string,
  trade: {
    symbol: string
    tradeType: 'long' | 'short'
    entryPrice: number
    stopLoss: number
    targetPrice: number
    positionSize: number
    oddsScore?: number
    confidenceScore?: number
    patternKey?: string
    wasDriftDecision?: boolean
    driftReason?: string
  }
): Promise<TrainingTrade | null> {
  const { data, error } = await supabase
    .from('ai_training_trades')
    .insert({
      account_id: accountId,
      user_id: userId,
      symbol: trade.symbol,
      trade_type: trade.tradeType,
      entry_price: trade.entryPrice,
      stop_loss: trade.stopLoss,
      target_price: trade.targetPrice,
      position_size: trade.positionSize,
      odds_score: trade.oddsScore,
      confidence_score: trade.confidenceScore,
      pattern_key: trade.patternKey,
      was_drift_decision: trade.wasDriftDecision || false,
      drift_reason: trade.driftReason,
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to record training trade:', error)
    return null
  }
  return data as TrainingTrade
}

async function closeTrade(
  tradeId: string,
  exitPrice: number,
  exitReason: 'target' | 'stop' | 'manual' | 'time'
): Promise<{ profitLoss: number } | null> {
  const { data: trade } = await supabase
    .from('ai_training_trades')
    .select('*')
    .eq('id', tradeId)
    .maybeSingle()

  if (!trade || trade.status !== 'open') return null

  let grossPL: number
  if (trade.trade_type === 'long') {
    grossPL = (exitPrice - trade.entry_price) * trade.position_size
  } else {
    grossPL = (trade.entry_price - exitPrice) * trade.position_size
  }

  const fees = trade.position_size * 0.01
  const profitLoss = Math.round((grossPL - fees) * 100) / 100

  await supabase
    .from('ai_training_trades')
    .update({
      exit_price: exitPrice,
      profit_loss: profitLoss,
      gross_profit_loss: Math.round(grossPL * 100) / 100,
      total_fees: Math.round(fees * 100) / 100,
      status: 'closed',
      exit_reason: exitReason,
      exit_time: new Date().toISOString(),
    })
    .eq('id', tradeId)

  await updateAccountStats(trade.account_id)

  return { profitLoss }
}

async function updateAccountStats(accountId: string): Promise<void> {
  const account = await getAccount(accountId)
  if (!account) return

  const { data: trades } = await supabase
    .from('ai_training_trades')
    .select('profit_loss, gross_profit_loss')
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
    const drawdown = ((peak - runningBalance) / peak) * 100
    if (drawdown > maxDrawdown) maxDrawdown = drawdown

    if (pl > 0) {
      wins++
      grossWins += pl
    } else {
      grossLosses += Math.abs(pl)
    }
  }

  const total = trades.length
  const winRate = total > 0 ? (wins / total) * 100 : 0
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : wins > 0 ? 999 : 0
  const avgWin = wins > 0 ? grossWins / wins : 0
  const avgLoss = (total - wins) > 0 ? grossLosses / (total - wins) : 0
  const wr = winRate / 100
  const expectancy = total > 0 ? (wr * avgWin) - ((1 - wr) * avgLoss) : 0

  await supabase
    .from('ai_training_accounts')
    .update({
      current_capital: account.starting_capital + totalPL,
      total_trades: total,
      winning_trades: wins,
      total_profit_loss: Math.round(totalPL * 100) / 100,
      win_rate: Math.round(winRate * 100) / 100,
      profit_factor: Math.round(profitFactor * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
      max_drawdown: Math.round(maxDrawdown * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)
}

async function updateDriftState(
  accountId: string,
  weights: LearnedWeights,
  thresholds: ThresholdAdjustments,
  patterns: Record<string, PatternOverride>,
  driftDecisions: number,
  totalDecisions: number,
  isDrifting: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_training_accounts')
    .update({
      learned_weights: weights,
      threshold_adjustments: thresholds,
      pattern_overrides: patterns,
      drift_decisions: driftDecisions,
      total_decisions: totalDecisions,
      is_drifting: isDrifting,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)

  return !error
}

function buildLeaderboard(accounts: TrainingAccount[]): LeaderboardEntry[] {
  return accounts
    .map(a => ({
      id: a.id,
      name: a.name,
      strategy_id: a.strategy_id,
      mode: a.mode,
      status: a.status,
      total_trades: a.total_trades,
      win_rate: a.win_rate,
      total_profit_loss: a.total_profit_loss,
      profit_factor: a.profit_factor,
      expectancy: a.expectancy,
      max_drawdown: a.max_drawdown,
      return_pct: a.starting_capital > 0
        ? ((a.current_capital - a.starting_capital) / a.starting_capital) * 100
        : 0,
      is_drifting: a.is_drifting,
      drift_pct: a.total_decisions > 0
        ? (a.drift_decisions / a.total_decisions) * 100
        : 0,
      promoted_to_master: a.promoted_to_master,
    }))
    .sort((a, b) => b.total_profit_loss - a.total_profit_loss)
}

async function promoteToMaster(accountId: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_training_accounts')
    .update({
      promoted_to_master: true,
      promoted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)

  return !error
}

export const trainingAccountService = {
  createAccount,
  getAccounts,
  getAccount,
  updateStatus,
  deleteAccount,
  resetAccount,
  getAccountTrades,
  getOpenTrades,
  recordTrade,
  closeTrade,
  updateAccountStats,
  updateDriftState,
  buildLeaderboard,
  promoteToMaster,
}
