import { supabase } from './supabase'
import { tradeSimulator } from './tradeSimulator'
import { AIRecommendation } from './aiEngine'
import { signalService, StrengthTier, Signal } from './signalService'

export interface FollowModeSettings {
  id: string
  user_id: string
  enabled: boolean
  min_strength_tier: StrengthTier
  paper_account_id: string | null
  risk_percent: number
  max_daily_trades: number
  trades_today: number
  last_trade_date: string
  created_at: string
  updated_at: string
}

const TIER_RANK: Record<StrengthTier, number> = {
  strong_edge: 3,
  developing_edge: 2,
  experimental: 1,
}

function meetsMinTier(signalTier: StrengthTier, minTier: StrengthTier): boolean {
  return TIER_RANK[signalTier] >= TIER_RANK[minTier]
}

async function getSettings(userId: string): Promise<FollowModeSettings | null> {
  const { data } = await supabase
    .from('follow_mode_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return data as FollowModeSettings | null
}

async function saveSettings(
  userId: string,
  settings: Partial<FollowModeSettings>
): Promise<FollowModeSettings | null> {
  const { data, error } = await supabase
    .from('follow_mode_settings')
    .upsert({
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    console.error('Failed to save follow mode settings:', error)
    return null
  }

  return data as FollowModeSettings
}

async function toggleFollowMode(userId: string, enabled: boolean): Promise<boolean> {
  const result = await saveSettings(userId, { enabled })
  return result !== null
}

async function tryAutoExecute(
  userId: string,
  signal: Signal,
  recommendation: AIRecommendation
): Promise<{ executed: boolean; tradeId?: string }> {
  const settings = await getSettings(userId)

  if (!settings || !settings.enabled) {
    return { executed: false }
  }

  if (!settings.paper_account_id) {
    return { executed: false }
  }

  if (!meetsMinTier(signal.strength_tier as StrengthTier, settings.min_strength_tier as StrengthTier)) {
    return { executed: false }
  }

  const today = new Date().toISOString().split('T')[0]
  let tradesToday = settings.trades_today
  if (settings.last_trade_date !== today) {
    tradesToday = 0
  }

  if (tradesToday >= settings.max_daily_trades) {
    return { executed: false }
  }

  try {
    const trade = await tradeSimulator.executeRecommendation(
      userId,
      settings.paper_account_id,
      recommendation,
      settings.risk_percent
    )

    await signalService.markSignalExecuted(signal.id, trade.id, true)

    await supabase
      .from('follow_mode_settings')
      .update({
        trades_today: tradesToday + 1,
        last_trade_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    return { executed: true, tradeId: trade.id }
  } catch (error) {
    console.error('Follow mode auto-execute failed:', error)
    return { executed: false }
  }
}

export const followModeService = {
  getSettings,
  saveSettings,
  toggleFollowMode,
  tryAutoExecute,
  meetsMinTier,
  TIER_RANK,
}
