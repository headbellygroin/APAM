import { supabase } from './supabase'

export interface LadderBuy {
  dropPct: number
  shares: number
  triggered: boolean
  triggeredAt?: string
}

export interface TrailingStopConfig {
  id: string
  user_id: string
  paper_account_id: string
  simulated_trade_id: string | null
  symbol: string
  entry_price: number
  initial_stop_pct: number
  trail_pct: number
  trail_activation_pct: number
  highest_price: number
  current_trail_stop: number
  ladder_buys: LadderBuy[]
  is_active: boolean
  created_at: string
  updated_at: string
}

async function createTrailingStop(
  userId: string,
  paperAccountId: string,
  symbol: string,
  entryPrice: number,
  opts: {
    initialStopPct?: number
    trailPct?: number
    trailActivationPct?: number
    ladderBuys?: LadderBuy[]
    simulatedTradeId?: string
  } = {}
): Promise<TrailingStopConfig> {
  const initialStopPct = opts.initialStopPct ?? 10
  const trailPct = opts.trailPct ?? 5
  const trailActivationPct = opts.trailActivationPct ?? 10
  const initialStop = Math.round(entryPrice * (1 - initialStopPct / 100) * 100) / 100

  const defaultLadderBuys: LadderBuy[] = opts.ladderBuys ?? [
    { dropPct: 15, shares: 10, triggered: false },
    { dropPct: 20, shares: 20, triggered: false },
    { dropPct: 30, shares: 30, triggered: false },
  ]

  const { data, error } = await supabase
    .from('trailing_stop_configs')
    .insert({
      user_id: userId,
      paper_account_id: paperAccountId,
      simulated_trade_id: opts.simulatedTradeId ?? null,
      symbol,
      entry_price: entryPrice,
      initial_stop_pct: initialStopPct,
      trail_pct: trailPct,
      trail_activation_pct: trailActivationPct,
      highest_price: entryPrice,
      current_trail_stop: initialStop,
      ladder_buys: defaultLadderBuys,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data as TrailingStopConfig
}

async function getActiveConfigs(userId: string): Promise<TrailingStopConfig[]> {
  const { data, error } = await supabase
    .from('trailing_stop_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as TrailingStopConfig[]
}

async function getAllConfigs(userId: string): Promise<TrailingStopConfig[]> {
  const { data, error } = await supabase
    .from('trailing_stop_configs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as TrailingStopConfig[]
}

async function updateConfig(
  configId: string,
  updates: Partial<TrailingStopConfig>
): Promise<void> {
  const { error } = await supabase
    .from('trailing_stop_configs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', configId)
  if (error) throw error
}

async function deactivate(configId: string): Promise<void> {
  await updateConfig(configId, { is_active: false })
}

function simulateUpdate(
  config: TrailingStopConfig,
  currentPrice: number
): {
  action: 'none' | 'trail_updated' | 'stop_triggered' | 'ladder_triggered'
  newHighest: number
  newStop: number
  ladderBuys: LadderBuy[]
  details: string
} {
  let newHighest = config.highest_price
  let newStop = config.current_trail_stop
  const ladderBuys: LadderBuy[] = JSON.parse(JSON.stringify(config.ladder_buys))

  if (currentPrice <= config.current_trail_stop) {
    return { action: 'stop_triggered', newHighest, newStop, ladderBuys, details: `Stop triggered at $${currentPrice.toFixed(2)}` }
  }

  if (currentPrice > config.highest_price) {
    newHighest = currentPrice
    const activationPrice = config.entry_price * (1 + config.trail_activation_pct / 100)
    if (currentPrice >= activationPrice) {
      const trailStop = Math.round(currentPrice * (1 - config.trail_pct / 100) * 100) / 100
      if (trailStop > newStop) {
        newStop = trailStop
        return { action: 'trail_updated', newHighest, newStop, ladderBuys, details: `Trail stop moved to $${newStop.toFixed(2)}` }
      }
    }
    return { action: 'none', newHighest, newStop, ladderBuys, details: 'New high recorded' }
  }

  for (let i = 0; i < ladderBuys.length; i++) {
    if (ladderBuys[i].triggered) continue
    const triggerPrice = config.entry_price * (1 - ladderBuys[i].dropPct / 100)
    if (currentPrice <= triggerPrice) {
      ladderBuys[i] = { ...ladderBuys[i], triggered: true, triggeredAt: new Date().toISOString() }
      return {
        action: 'ladder_triggered',
        newHighest,
        newStop,
        ladderBuys,
        details: `Ladder: buy ${ladderBuys[i].shares} shares at $${currentPrice.toFixed(2)} (-${ladderBuys[i].dropPct}%)`,
      }
    }
  }

  return { action: 'none', newHighest, newStop, ladderBuys, details: 'No action' }
}

export const trailingStopService = {
  createTrailingStop,
  getActiveConfigs,
  getAllConfigs,
  updateConfig,
  deactivate,
  simulateUpdate,
}
