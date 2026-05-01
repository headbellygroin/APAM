import { supabase } from './supabase'

export interface AdminUser {
  id: string
  email: string
  created_at: string
}

export interface AdminPaperAccount {
  id: string
  user_id: string
  name: string
  starting_balance: number
  current_balance: number
  total_profit_loss: number
  is_active: boolean
  created_at: string
}

export interface AdminTrade {
  id: string
  user_id: string
  paper_account_id: string
  symbol: string
  trade_type: string
  status: string
  entry_price: number
  stop_loss: number
  target_price: number
  exit_price: number | null
  position_size: number
  profit_loss: number | null
  odds_score: number | null
  ai_confidence_score: number | null
  is_ai_recommended: boolean
  exit_reason: string | null
  entry_time: string
  exit_time: string | null
}

export interface AdminAIState {
  user_id: string
  ai_name: string | null
  name_status: string
  evolution_permission: boolean
  is_active: boolean
  performance_at_naming: Record<string, any> | null
}

export interface AdminLearnedAdjustments {
  user_id: string
  learned_weights: Record<string, number> | null
  threshold_adjustments: Record<string, number> | null
  total_decisions: number
  drifted_decisions: number
  is_drifting: boolean
}

export interface AdminUserSummary {
  user: AdminUser
  accounts: AdminPaperAccount[]
  recentTrades: AdminTrade[]
  aiState: AdminAIState | null
  learnedAdjustments: AdminLearnedAdjustments | null
  stats: {
    totalTrades: number
    openTrades: number
    winRate: number
    totalPL: number
  }
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, created_at')
    .order('created_at', { ascending: false })

  return (data || []).map(p => ({
    id: p.id,
    email: p.email || 'Unknown',
    created_at: p.created_at,
  }))
}

export async function fetchAdminUserSummary(userId: string): Promise<AdminUserSummary | null> {
  const [
    { data: profile },
    { data: accounts },
    { data: trades },
    { data: aiState },
    { data: learned },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('paper_accounts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('simulated_trades').select('*').eq('user_id', userId).order('entry_time', { ascending: false }).limit(50),
    supabase.from('ai_evolution_state').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('ai_learned_adjustments').select('*').eq('user_id', userId).maybeSingle(),
  ])

  if (!profile) return null

  const allTrades = trades || []
  const closedTrades = allTrades.filter(t => t.status === 'closed')
  const wins = closedTrades.filter(t => (t.profit_loss || 0) > 0)
  const totalPL = closedTrades.reduce((s, t) => s + (t.profit_loss || 0), 0)

  return {
    user: {
      id: profile.id,
      email: profile.email || 'Unknown',
      created_at: profile.created_at,
    },
    accounts: accounts || [],
    recentTrades: allTrades,
    aiState: aiState ? {
      user_id: aiState.user_id,
      ai_name: aiState.ai_name,
      name_status: aiState.name_status || 'unearned',
      evolution_permission: aiState.evolution_permission || false,
      is_active: aiState.is_active || false,
      performance_at_naming: aiState.performance_at_naming,
    } : null,
    learnedAdjustments: learned ? {
      user_id: learned.user_id,
      learned_weights: learned.learned_weights,
      threshold_adjustments: learned.threshold_adjustments,
      total_decisions: learned.total_decisions || 0,
      drifted_decisions: learned.drifted_decisions || 0,
      is_drifting: learned.is_drifting || false,
    } : null,
    stats: {
      totalTrades: closedTrades.length,
      openTrades: allTrades.filter(t => t.status === 'open').length,
      winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
      totalPL,
    },
  }
}

export async function fetchAllUserSummaries(): Promise<AdminUserSummary[]> {
  const users = await fetchAdminUsers()
  const summaries: AdminUserSummary[] = []

  for (const user of users) {
    const summary = await fetchAdminUserSummary(user.id)
    if (summary) summaries.push(summary)
  }

  return summaries
}
