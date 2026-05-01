import { supabase } from './supabase'
import { AIRecommendation } from './aiEngine'

export type StrengthTier = 'strong_edge' | 'developing_edge' | 'experimental'
export type SignalStatus = 'active' | 'expired' | 'executed' | 'closed'

export interface Signal {
  id: string
  user_id: string
  symbol: string
  action: string
  confidence_score: number
  odds_score: number
  entry_price: number
  stop_loss: number
  target_price: number
  pattern_key: string
  strength_tier: StrengthTier
  reasoning: AIRecommendation['reasoning']
  strategy_id: string
  status: SignalStatus
  expired_at: string | null
  executed_at: string | null
  trade_id: string | null
  exit_price: number | null
  profit_loss: number | null
  exit_reason: string | null
  auto_executed: boolean
  created_at: string
}

const SIGNAL_EXPIRY_HOURS = 4

function computeStrengthTier(
  patternWinRate: number,
  patternTradeCount: number,
  oddsScore: number
): StrengthTier {
  if (patternTradeCount >= 20 && patternWinRate >= 0.60) return 'strong_edge'
  if (patternTradeCount >= 10 && patternWinRate >= 0.55) return 'developing_edge'
  if (oddsScore >= 8.5 && patternWinRate >= 0.50) return 'developing_edge'
  return 'experimental'
}

function getStrengthLabel(tier: StrengthTier): string {
  switch (tier) {
    case 'strong_edge': return 'Strong Edge'
    case 'developing_edge': return 'Developing Edge'
    case 'experimental': return 'Experimental'
  }
}

function getStrengthDescription(tier: StrengthTier): string {
  switch (tier) {
    case 'strong_edge': return '60%+ win rate with 20+ historical trades'
    case 'developing_edge': return '55%+ win rate but fewer than 20 trades'
    case 'experimental': return 'AI sees a setup but not enough history to call it proven'
  }
}

async function persistSignal(
  userId: string,
  recommendation: AIRecommendation,
  patternWinRate: number,
  patternTradeCount: number
): Promise<Signal | null> {
  const patternKey = `${recommendation.reasoning.curvePosition}-${recommendation.reasoning.trendDirection}-${recommendation.reasoning.zoneType}`
  const tier = computeStrengthTier(patternWinRate, patternTradeCount, recommendation.oddsScore)
  const expiresAt = new Date(Date.now() + SIGNAL_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('signal_queue')
    .insert({
      user_id: userId,
      symbol: recommendation.symbol,
      action: recommendation.action,
      confidence_score: recommendation.confidenceScore,
      odds_score: recommendation.oddsScore,
      entry_price: recommendation.entryPrice,
      stop_loss: recommendation.stopLoss,
      target_price: recommendation.targetPrice,
      pattern_key: patternKey,
      strength_tier: tier,
      reasoning: recommendation.reasoning,
      strategy_id: recommendation.strategyId,
      status: 'active',
      expired_at: expiresAt,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to persist signal:', error)
    return null
  }

  return data as Signal
}

async function getActiveSignals(userId: string): Promise<Signal[]> {
  const now = new Date().toISOString()

  await supabase
    .from('signal_queue')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'active')
    .lt('expired_at', now)

  const { data } = await supabase
    .from('signal_queue')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('expired_at', now)
    .order('created_at', { ascending: false })

  return (data || []) as Signal[]
}

async function getSignalFeed(userId: string, limit: number = 50): Promise<Signal[]> {
  const { data } = await supabase
    .from('signal_queue')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data || []) as Signal[]
}

async function getClosedSignals(userId: string, limit: number = 30): Promise<Signal[]> {
  const { data } = await supabase
    .from('signal_queue')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data || []) as Signal[]
}

async function markSignalExecuted(
  signalId: string,
  tradeId: string,
  autoExecuted: boolean = false
): Promise<void> {
  await supabase
    .from('signal_queue')
    .update({
      status: 'executed',
      executed_at: new Date().toISOString(),
      trade_id: tradeId,
      auto_executed: autoExecuted,
    })
    .eq('id', signalId)
}

async function markSignalClosed(
  signalId: string,
  exitPrice: number,
  profitLoss: number,
  exitReason: string
): Promise<void> {
  await supabase
    .from('signal_queue')
    .update({
      status: 'closed',
      exit_price: exitPrice,
      profit_loss: profitLoss,
      exit_reason: exitReason,
    })
    .eq('id', signalId)
}

async function getSignalsByTradeId(tradeId: string): Promise<Signal | null> {
  const { data } = await supabase
    .from('signal_queue')
    .select('*')
    .eq('trade_id', tradeId)
    .maybeSingle()

  return data as Signal | null
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export const signalService = {
  persistSignal,
  getActiveSignals,
  getSignalFeed,
  getClosedSignals,
  markSignalExecuted,
  markSignalClosed,
  getSignalsByTradeId,
  computeStrengthTier,
  getStrengthLabel,
  getStrengthDescription,
  timeAgo,
  SIGNAL_EXPIRY_HOURS,
}
