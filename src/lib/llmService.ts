import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Authorization': `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  }
}

async function callEdgeFunction<T>(functionName: string, body: Record<string, any>): Promise<T> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `Edge function ${functionName} failed`)
  }

  return response.json()
}

export interface TradeAnalysisInput {
  symbol: string
  action: string
  oddsScore: number
  entryPrice: number
  stopLoss: number
  targetPrice: number
  reasoning: {
    curvePosition: string
    trendDirection: string
    zoneType: string
    scores: Record<string, number>
  }
  patternWinRate?: number
  patternTradeCount?: number
  recentMarketContext?: string
}

export interface TradeAnalysisResult {
  symbol: string
  action: string
  oddsScore: number
  riskReward: string
  llmVerdict: 'strong_buy' | 'buy' | 'neutral' | 'avoid'
  confidence: number
  keyFactors: string[]
  risks: string[]
  marketContext: string
  suggestion: string
  raw: string
}

export interface JournalInsightResult {
  periodStart: string
  periodEnd: string
  entriesAnalyzed: number
  tradesInPeriod: number
  totalPL: number
  winRate: string
  patterns: Array<{
    name: string
    description: string
    frequency: string
    impact: 'positive' | 'negative' | 'neutral'
  }>
  emotionalTrends: Array<{
    emotion: string
    trigger: string
    tradingImpact: string
    managementTip: string
  }>
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  summary: string
  raw: string
}

export interface StrategyProposalResult {
  proposalName: string
  proposedWeights: Record<string, number>
  proposedThresholds: Record<string, number>
  proposedPatterns: Record<string, any>
  reasoning: string
  expectedImprovement: string
  fleetInsights: string[]
  convergenceAnalysis: string
  raw: string
}

export interface FleetAccountSummary {
  name: string
  strategy: string
  mode: string
  winRate: number
  profitFactor: number
  totalTrades: number
  totalPL: number
  maxDrawdown: number
  learnedWeights: Record<string, number>
  thresholdAdjustments: Record<string, number>
  driftPct: number
  generation: number
}

export interface EODNarrativeResult {
  narrative: string
  spawnReasoning: string
  riskAssessment: string
  nextDayStrategy: string
  fleetHealthScore: number
  keyDecisions: string[]
  warnings: string[]
  raw: string
}

export const llmService = {
  async analyzeTradeSignal(input: TradeAnalysisInput): Promise<TradeAnalysisResult> {
    return callEdgeFunction<TradeAnalysisResult>('ai-trade-analysis', input)
  },

  async analyzeJournal(days: number = 30): Promise<JournalInsightResult> {
    return callEdgeFunction<JournalInsightResult>('ai-journal-analysis', { days })
  },

  async generateStrategy(fleetData: FleetAccountSummary[]): Promise<StrategyProposalResult> {
    return callEdgeFunction<StrategyProposalResult>('ai-strategy-generator', { fleetData })
  },

  async generateEODNarrative(eodReview: any): Promise<EODNarrativeResult> {
    return callEdgeFunction<EODNarrativeResult>('ai-eod-narrative', { eodReview })
  },

  async getTradeAnalysisHistory(userId: string, limit = 20) {
    const { data } = await supabase
      .from('llm_trade_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return data || []
  },

  async getJournalInsightHistory(userId: string, limit = 10) {
    const { data } = await supabase
      .from('llm_journal_insights')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return data || []
  },

  async getStrategyProposals(userId: string) {
    const { data } = await supabase
      .from('llm_strategy_proposals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    return data || []
  },

  async updateProposalStatus(proposalId: string, status: 'applied' | 'rejected') {
    const { error } = await supabase
      .from('llm_strategy_proposals')
      .update({ status })
      .eq('id', proposalId)
    return !error
  },

  async getEODNarrativeHistory(userId: string, limit = 10) {
    const { data } = await supabase
      .from('llm_eod_narratives')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return data || []
  },
}
