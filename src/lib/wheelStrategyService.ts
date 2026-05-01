import { supabase } from './supabase'

export type WheelStage = 'selling_puts' | 'assigned_selling_calls' | 'called_away'
export type WheelStatus = 'active' | 'completed' | 'rolled'
export type PremiumOutcome = 'expired_worthless' | 'assigned' | 'called_away' | 'closed_early' | 'rolled' | 'pending'

export interface WheelCycle {
  id: string
  user_id: string
  paper_account_id: string
  symbol: string
  stage: WheelStage
  strike_price: number
  expiration_date: string | null
  contracts: number
  premium_collected: number
  cost_basis: number
  shares_held: number
  status: WheelStatus
  created_at: string
  updated_at: string
}

export interface WheelPremiumEntry {
  id: string
  user_id: string
  cycle_id: string
  symbol: string
  option_type: 'put' | 'call'
  strike_price: number
  expiration_date: string | null
  premium_amount: number
  contracts: number
  outcome: PremiumOutcome
  closed_at: string | null
  profit_loss: number
  created_at: string
}

export interface WheelSummary {
  totalPremiumCollected: number
  activeCycles: number
  completedCycles: number
  avgPremiumPerCycle: number
  putPremiums: number
  callPremiums: number
}

async function getActiveCycles(userId: string): Promise<WheelCycle[]> {
  const { data, error } = await supabase
    .from('wheel_strategy_cycles')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as WheelCycle[]
}

async function getAllCycles(userId: string, paperAccountId?: string): Promise<WheelCycle[]> {
  let query = supabase
    .from('wheel_strategy_cycles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (paperAccountId) query = query.eq('paper_account_id', paperAccountId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as WheelCycle[]
}

async function startCycle(
  userId: string,
  paperAccountId: string,
  symbol: string,
  strikePrice: number,
  contracts: number,
  premiumAmount: number,
  expirationDate?: string
): Promise<WheelCycle> {
  const { data: cycle, error: cycleError } = await supabase
    .from('wheel_strategy_cycles')
    .insert({
      user_id: userId,
      paper_account_id: paperAccountId,
      symbol,
      stage: 'selling_puts',
      strike_price: strikePrice,
      expiration_date: expirationDate ?? null,
      contracts,
      premium_collected: premiumAmount * contracts * 100,
      cost_basis: 0,
      shares_held: 0,
      status: 'active',
    })
    .select()
    .single()
  if (cycleError) throw cycleError

  await supabase.from('wheel_premium_log').insert({
    user_id: userId,
    cycle_id: cycle.id,
    symbol,
    option_type: 'put',
    strike_price: strikePrice,
    expiration_date: expirationDate ?? null,
    premium_amount: premiumAmount * contracts * 100,
    contracts,
    outcome: 'pending',
    profit_loss: 0,
  })

  return cycle as WheelCycle
}

async function recordPutExpired(cycleId: string, _userId?: string): Promise<void> {
  const { data: cycle } = await supabase
    .from('wheel_strategy_cycles')
    .select('*')
    .eq('id', cycleId)
    .single()
  if (!cycle) return

  await supabase
    .from('wheel_premium_log')
    .update({ outcome: 'expired_worthless', closed_at: new Date().toISOString(), profit_loss: cycle.premium_collected })
    .eq('cycle_id', cycleId)
    .eq('outcome', 'pending')
    .eq('option_type', 'put')
}

async function recordAssignment(
  cycleId: string,
  _userId: string,
  assignmentPrice: number
): Promise<void> {
  const { data: cycle } = await supabase
    .from('wheel_strategy_cycles')
    .select('*')
    .eq('id', cycleId)
    .single()
  if (!cycle) return

  const sharesHeld = cycle.contracts * 100
  const effectiveCostBasis = assignmentPrice - cycle.premium_collected / sharesHeld

  await supabase
    .from('wheel_strategy_cycles')
    .update({
      stage: 'assigned_selling_calls',
      shares_held: sharesHeld,
      cost_basis: effectiveCostBasis,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId)

  await supabase
    .from('wheel_premium_log')
    .update({ outcome: 'assigned', closed_at: new Date().toISOString(), profit_loss: 0 })
    .eq('cycle_id', cycleId)
    .eq('outcome', 'pending')
    .eq('option_type', 'put')
}

async function recordCoveredCall(
  cycleId: string,
  userId: string,
  strikePrice: number,
  premiumAmount: number,
  expirationDate?: string
): Promise<void> {
  const { data: cycle } = await supabase
    .from('wheel_strategy_cycles')
    .select('*')
    .eq('id', cycleId)
    .single()
  if (!cycle) return

  const totalPremium = premiumAmount * cycle.contracts * 100
  await supabase
    .from('wheel_strategy_cycles')
    .update({
      strike_price: strikePrice,
      expiration_date: expirationDate ?? null,
      premium_collected: cycle.premium_collected + totalPremium,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId)

  await supabase.from('wheel_premium_log').insert({
    user_id: userId,
    cycle_id: cycleId,
    symbol: cycle.symbol,
    option_type: 'call',
    strike_price: strikePrice,
    expiration_date: expirationDate ?? null,
    premium_amount: totalPremium,
    contracts: cycle.contracts,
    outcome: 'pending',
    profit_loss: 0,
  })
}

async function recordCallExpired(cycleId: string): Promise<void> {
  const { data: cycle } = await supabase
    .from('wheel_strategy_cycles')
    .select('*')
    .eq('id', cycleId)
    .single()
  if (!cycle) return

  const { data: pending } = await supabase
    .from('wheel_premium_log')
    .select('premium_amount')
    .eq('cycle_id', cycleId)
    .eq('outcome', 'pending')
    .eq('option_type', 'call')
    .maybeSingle()

  await supabase
    .from('wheel_premium_log')
    .update({ outcome: 'expired_worthless', closed_at: new Date().toISOString(), profit_loss: pending?.premium_amount ?? 0 })
    .eq('cycle_id', cycleId)
    .eq('outcome', 'pending')
    .eq('option_type', 'call')
}

async function recordCallAway(cycleId: string, _userId: string, salePrice: number): Promise<void> {
  const { data: cycle } = await supabase
    .from('wheel_strategy_cycles')
    .select('*')
    .eq('id', cycleId)
    .single()
  if (!cycle) return

  const stockGain = (salePrice - cycle.cost_basis) * cycle.shares_held
  const totalProfit = stockGain + cycle.premium_collected

  await supabase
    .from('wheel_premium_log')
    .update({ outcome: 'called_away', closed_at: new Date().toISOString(), profit_loss: totalProfit })
    .eq('cycle_id', cycleId)
    .eq('outcome', 'pending')
    .eq('option_type', 'call')

  await supabase
    .from('wheel_strategy_cycles')
    .update({
      stage: 'called_away',
      shares_held: 0,
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', cycleId)
}

async function closeEarly(_cycleId: string, premiumEntryId: string): Promise<void> {
  const { data: entry } = await supabase
    .from('wheel_premium_log')
    .select('*')
    .eq('id', premiumEntryId)
    .single()
  if (!entry || entry.outcome !== 'pending') return

  const profit = Math.round(entry.premium_amount * 0.5 * 100) / 100
  await supabase
    .from('wheel_premium_log')
    .update({ outcome: 'closed_early', closed_at: new Date().toISOString(), profit_loss: profit })
    .eq('id', premiumEntryId)
}

async function getPremiumLog(userId: string, cycleId?: string): Promise<WheelPremiumEntry[]> {
  let query = supabase
    .from('wheel_premium_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (cycleId) query = query.eq('cycle_id', cycleId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as WheelPremiumEntry[]
}

async function getSummary(userId: string): Promise<WheelSummary> {
  const [cycles, premiums] = await Promise.all([
    getAllCycles(userId),
    getPremiumLog(userId),
  ])

  const totalPremiumCollected = premiums
    .filter(p => p.outcome !== 'pending')
    .reduce((sum, p) => sum + p.profit_loss, 0)

  const putPremiums = premiums
    .filter(p => p.option_type === 'put' && p.outcome !== 'pending')
    .reduce((sum, p) => sum + p.profit_loss, 0)

  const callPremiums = premiums
    .filter(p => p.option_type === 'call' && p.outcome !== 'pending')
    .reduce((sum, p) => sum + p.profit_loss, 0)

  const activeCycles = cycles.filter(c => c.status === 'active').length
  const completedCycles = cycles.filter(c => c.status === 'completed').length

  return {
    totalPremiumCollected,
    activeCycles,
    completedCycles,
    avgPremiumPerCycle: cycles.length > 0 ? totalPremiumCollected / cycles.length : 0,
    putPremiums,
    callPremiums,
  }
}

export const wheelStrategyService = {
  getActiveCycles,
  getAllCycles,
  startCycle,
  recordPutExpired,
  recordAssignment,
  recordCoveredCall,
  recordCallExpired,
  recordCallAway,
  closeEarly,
  getPremiumLog,
  getSummary,
}
