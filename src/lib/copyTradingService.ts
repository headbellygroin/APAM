import { supabase } from './supabase'

export interface CopyTarget {
  id: string
  user_id: string
  target_name: string
  target_type: 'politician' | 'whale' | 'insider'
  data_source: string
  is_active: boolean
  auto_copy: boolean
  max_position_pct: number
  delay_hours: number
  created_at: string
  updated_at: string
}

export interface CopyTradeEntry {
  id: string
  user_id: string
  target_id: string
  paper_account_id: string | null
  symbol: string
  action: 'buy' | 'sell'
  asset_type: 'stock' | 'option'
  quantity: number
  price_at_disclosure: number
  price_at_copy: number | null
  simulated_trade_id: string | null
  source_filing_date: string | null
  profit_loss: number
  status: 'pending' | 'executed' | 'closed' | 'skipped'
  skip_reason: string | null
  created_at: string
}

export interface PoliticianTrade {
  symbol: string
  action: 'buy' | 'sell'
  assetType: 'stock' | 'option'
  amount: string
  tradeDate: string
  filingDate: string
}

export interface KnownPolitician {
  name: string
  party: string
  state: string
  chamber: string
  tradeCount: number
  winRate: number
  notableHoldings: string[]
}

const KNOWN_POLITICIANS: KnownPolitician[] = [
  { name: 'Michael McCaul', party: 'R', state: 'TX', chamber: 'House', tradeCount: 147, winRate: 73, notableHoldings: ['NVDA', 'AAPL', 'MSFT', 'AMZN'] },
  { name: 'Nancy Pelosi', party: 'D', state: 'CA', chamber: 'House', tradeCount: 89, winRate: 68, notableHoldings: ['NVDA', 'AAPL', 'GOOGL', 'TSLA'] },
  { name: 'Tommy Tuberville', party: 'R', state: 'AL', chamber: 'Senate', tradeCount: 132, winRate: 61, notableHoldings: ['SPY', 'QQQ', 'XOM', 'CVX'] },
  { name: 'Josh Gottheimer', party: 'D', state: 'NJ', chamber: 'House', tradeCount: 56, winRate: 65, notableHoldings: ['MSFT', 'META', 'GOOGL', 'CRM'] },
  { name: 'Dan Crenshaw', party: 'R', state: 'TX', chamber: 'House', tradeCount: 43, winRate: 62, notableHoldings: ['XOM', 'LMT', 'NOC', 'RTX'] },
  { name: 'Ro Khanna', party: 'D', state: 'CA', chamber: 'House', tradeCount: 38, winRate: 67, notableHoldings: ['INTC', 'AMD', 'QCOM', 'AAPL'] },
  { name: 'Mark Green', party: 'R', state: 'TN', chamber: 'House', tradeCount: 29, winRate: 59, notableHoldings: ['UNH', 'CVS', 'HCA', 'AMGN'] },
  { name: 'Virginia Foxx', party: 'R', state: 'NC', chamber: 'House', tradeCount: 24, winRate: 58, notableHoldings: ['JPM', 'BAC', 'GS', 'V'] },
]

const SAMPLE_TRADES: Record<string, PoliticianTrade[]> = {
  'Michael McCaul': [
    { symbol: 'NVDA', action: 'buy', assetType: 'stock', amount: '$50,001-$100,000', tradeDate: '2025-12-15', filingDate: '2026-01-14' },
    { symbol: 'AAPL', action: 'buy', assetType: 'stock', amount: '$15,001-$50,000', tradeDate: '2025-11-22', filingDate: '2025-12-21' },
    { symbol: 'MSFT', action: 'sell', assetType: 'stock', amount: '$100,001-$250,000', tradeDate: '2025-11-10', filingDate: '2025-12-09' },
    { symbol: 'AMZN', action: 'buy', assetType: 'stock', amount: '$15,001-$50,000', tradeDate: '2025-10-28', filingDate: '2025-11-26' },
  ],
  'Nancy Pelosi': [
    { symbol: 'NVDA', action: 'buy', assetType: 'option', amount: '$1,000,001+', tradeDate: '2025-12-02', filingDate: '2026-01-01' },
    { symbol: 'GOOGL', action: 'buy', assetType: 'stock', amount: '$250,001-$500,000', tradeDate: '2025-11-18', filingDate: '2025-12-17' },
    { symbol: 'TSLA', action: 'sell', assetType: 'stock', amount: '$100,001-$250,000', tradeDate: '2025-10-05', filingDate: '2025-11-03' },
  ],
  'Tommy Tuberville': [
    { symbol: 'SPY', action: 'buy', assetType: 'stock', amount: '$100,001-$250,000', tradeDate: '2025-12-20', filingDate: '2026-01-18' },
    { symbol: 'XOM', action: 'buy', assetType: 'stock', amount: '$50,001-$100,000', tradeDate: '2025-12-05', filingDate: '2026-01-03' },
    { symbol: 'CVX', action: 'buy', assetType: 'stock', amount: '$15,001-$50,000', tradeDate: '2025-11-12', filingDate: '2025-12-11' },
  ],
}

async function getCopyTargets(userId: string): Promise<CopyTarget[]> {
  const { data, error } = await supabase
    .from('copy_trading_targets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CopyTarget[]
}

async function addCopyTarget(
  userId: string,
  targetName: string,
  targetType: 'politician' | 'whale' | 'insider',
  dataSource: string,
  maxPositionPct = 5,
  delayHours = 0
): Promise<CopyTarget> {
  const { data, error } = await supabase
    .from('copy_trading_targets')
    .insert({
      user_id: userId,
      target_name: targetName,
      target_type: targetType,
      data_source: dataSource,
      is_active: true,
      auto_copy: false,
      max_position_pct: maxPositionPct,
      delay_hours: delayHours,
    })
    .select()
    .single()
  if (error) throw error
  return data as CopyTarget
}

async function updateCopyTarget(targetId: string, updates: Partial<CopyTarget>): Promise<void> {
  const { error } = await supabase
    .from('copy_trading_targets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', targetId)
  if (error) throw error
}

async function removeCopyTarget(targetId: string): Promise<void> {
  const { error } = await supabase.from('copy_trading_targets').delete().eq('id', targetId)
  if (error) throw error
}

async function getCopyTradingLog(userId: string, limit = 50): Promise<CopyTradeEntry[]> {
  const { data, error } = await supabase
    .from('copy_trading_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as CopyTradeEntry[]
}

async function logCopyTrade(
  userId: string,
  targetId: string,
  entry: Omit<CopyTradeEntry, 'id' | 'user_id' | 'target_id' | 'created_at'>
): Promise<CopyTradeEntry> {
  const { data, error } = await supabase
    .from('copy_trading_log')
    .insert({ user_id: userId, target_id: targetId, ...entry })
    .select()
    .single()
  if (error) throw error
  return data as CopyTradeEntry
}

async function getCopyTradingSummary(userId: string): Promise<{
  totalTargets: number
  activeTargets: number
  totalCopiedTrades: number
  executedTrades: number
  skippedTrades: number
  totalProfitLoss: number
}> {
  const [targets, log] = await Promise.all([getCopyTargets(userId), getCopyTradingLog(userId)])

  return {
    totalTargets: targets.length,
    activeTargets: targets.filter(t => t.is_active).length,
    totalCopiedTrades: log.length,
    executedTrades: log.filter(l => l.status === 'executed' || l.status === 'closed').length,
    skippedTrades: log.filter(l => l.status === 'skipped').length,
    totalProfitLoss: log.reduce((sum, l) => sum + (l.profit_loss ?? 0), 0),
  }
}

function getKnownPoliticians(): KnownPolitician[] {
  return KNOWN_POLITICIANS
}

function getRecentTradesForTarget(targetName: string): PoliticianTrade[] {
  return SAMPLE_TRADES[targetName] ?? []
}

export const copyTradingService = {
  getCopyTargets,
  addCopyTarget,
  updateCopyTarget,
  removeCopyTarget,
  getCopyTradingLog,
  logCopyTrade,
  getCopyTradingSummary,
  getKnownPoliticians,
  getRecentTradesForTarget,
}
