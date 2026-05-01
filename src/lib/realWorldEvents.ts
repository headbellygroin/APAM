import { supabase } from './supabase'

export interface UserTradeAnomaly {
  id: string
  user_id: string
  detected_by: string | null
  symbol: string
  anomaly_type: string
  description: string
  user_trades: AnomalyTrade[]
  ai_signal_at_time: Record<string, any>
  confidence_gap: number
  outcome: string
  profit_loss: number
  status: string
  resolved_event_id: string | null
  review_notes: string
  detected_at: string
  resolved_at: string | null
  created_at: string
  user_email?: string
}

export interface AnomalyTrade {
  tradeId: string
  userId: string
  userEmail: string
  symbol: string
  tradeType: string
  entryPrice: number
  exitPrice: number | null
  profitLoss: number | null
  status: string
  entryTime: string
  patternKey: string | null
  oddsScore: number | null
}

export interface RealWorldEvent {
  id: string
  created_by: string
  event_type: string
  title: string
  description: string
  symbols_affected: string[]
  event_date: string
  impact_direction: string
  impact_magnitude: string
  source_url: string
  discovery_method: string
  anomaly_ids: string[]
  tags: string[]
  is_predictive: boolean
  predictive_signals: string[]
  similar_past_events: string[]
  created_at: string
  updated_at: string
}

export interface EventPatternCatalog {
  id: string
  event_type: string
  pattern_name: string
  description: string
  avg_impact_pct: number
  avg_duration_hours: number
  occurrence_count: number
  win_rate_when_traded: number
  best_entry_timing: string
  typical_symbols: string[]
  precursor_signals: string[]
  last_occurred_at: string | null
  created_at: string
  updated_at: string
}

export const EVENT_TYPES = [
  { value: 'earnings', label: 'Earnings Report' },
  { value: 'fda', label: 'FDA Decision' },
  { value: 'geopolitical', label: 'Geopolitical Event' },
  { value: 'social_media', label: 'Social Media / Viral' },
  { value: 'insider', label: 'Insider Activity' },
  { value: 'macro', label: 'Macro Economic' },
  { value: 'sector_rotation', label: 'Sector Rotation' },
  { value: 'news_catalyst', label: 'News Catalyst' },
  { value: 'regulatory', label: 'Regulatory / Legal' },
  { value: 'technical_breakout', label: 'Technical Breakout (Human-spotted)' },
  { value: 'other', label: 'Other' },
] as const

export const ANOMALY_TYPES = [
  { value: 'unexplained_cluster', label: 'Unexplained Cluster', description: 'Multiple users independently traded the same symbol' },
  { value: 'counter_signal', label: 'Counter-Signal Trade', description: 'User traded opposite to AI recommendation' },
  { value: 'timing_anomaly', label: 'Timing Anomaly', description: 'Unusual timing pattern not matching AI signals' },
  { value: 'volume_spike', label: 'Volume Spike', description: 'Users trading much larger positions than normal' },
  { value: 'new_symbol', label: 'New Symbol Activity', description: 'Users trading symbols not in AI watchlist' },
  { value: 'correlated_exits', label: 'Correlated Exits', description: 'Multiple users exiting positions simultaneously' },
] as const

export const IMPACT_DIRECTIONS = ['bullish', 'bearish', 'neutral'] as const
export const IMPACT_MAGNITUDES = ['minor', 'moderate', 'major', 'extreme'] as const

export async function detectAnomalies(adminUserId: string): Promise<UserTradeAnomaly[]> {
  const anomalies: UserTradeAnomaly[] = []

  const { data: recentTrades } = await supabase
    .from('simulated_trades')
    .select('*, profiles!simulated_trades_user_id_fkey(email)')
    .gte('entry_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('entry_time', { ascending: false })

  if (!recentTrades || recentTrades.length === 0) return anomalies

  const { data: recentSignals } = await supabase
    .from('signal_queue')
    .select('*')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const signalMap = new Map<string, any[]>()
  for (const sig of recentSignals || []) {
    const existing = signalMap.get(sig.symbol) || []
    existing.push(sig)
    signalMap.set(sig.symbol, existing)
  }

  const symbolGroups = new Map<string, any[]>()
  for (const trade of recentTrades) {
    const existing = symbolGroups.get(trade.symbol) || []
    existing.push(trade)
    symbolGroups.set(trade.symbol, existing)
  }

  for (const [symbol, trades] of symbolGroups) {
    const uniqueUsers = new Set(trades.map((t: any) => t.user_id))

    if (uniqueUsers.size >= 2) {
      const signals = signalMap.get(symbol) || []
      const aiRecommended = signals.length > 0

      const tradeSummaries: AnomalyTrade[] = trades.map((t: any) => ({
        tradeId: t.id,
        userId: t.user_id,
        userEmail: t.profiles?.email || 'Unknown',
        symbol: t.symbol,
        tradeType: t.trade_type,
        entryPrice: Number(t.entry_price),
        exitPrice: t.exit_price ? Number(t.exit_price) : null,
        profitLoss: t.profit_loss ? Number(t.profit_loss) : null,
        status: t.status,
        entryTime: t.entry_time,
        patternKey: null,
        oddsScore: t.odds_score ? Number(t.odds_score) : null,
      }))

      const totalPL = trades.reduce((s: number, t: any) => s + (Number(t.profit_loss) || 0), 0)
      const closedTrades = trades.filter((t: any) => t.status === 'closed')
      const wins = closedTrades.filter((t: any) => Number(t.profit_loss) > 0).length
      const outcome = closedTrades.length === 0 ? 'pending' : wins > closedTrades.length / 2 ? 'win' : 'loss'

      const anomaly: UserTradeAnomaly = {
        id: crypto.randomUUID(),
        user_id: trades[0].user_id,
        detected_by: adminUserId,
        symbol,
        anomaly_type: aiRecommended ? 'unexplained_cluster' : 'new_symbol',
        description: `${uniqueUsers.size} users independently traded ${symbol} within 24h${!aiRecommended ? ' -- NOT in AI signals' : ''}. Combined ${trades.length} trades.`,
        user_trades: tradeSummaries,
        ai_signal_at_time: signals.length > 0 ? {
          hadSignal: true,
          signalAction: signals[0].action,
          signalConfidence: Number(signals[0].confidence_score),
          signalOdds: Number(signals[0].odds_score),
        } : { hadSignal: false },
        confidence_gap: signals.length > 0 ? Math.abs(Number(signals[0].confidence_score) - 50) : 100,
        outcome,
        profit_loss: totalPL,
        status: 'detected',
        resolved_event_id: null,
        review_notes: '',
        detected_at: new Date().toISOString(),
        resolved_at: null,
        created_at: new Date().toISOString(),
      }

      anomalies.push(anomaly)
    }
  }

  for (const trade of recentTrades) {
    const signals = signalMap.get(trade.symbol) || []
    if (signals.length === 0) continue

    const aiAction = signals[0].action
    const userAction = trade.trade_type

    if ((aiAction === 'long' && userAction === 'short') || (aiAction === 'short' && userAction === 'long')) {
      const anomaly: UserTradeAnomaly = {
        id: crypto.randomUUID(),
        user_id: trade.user_id,
        detected_by: adminUserId,
        symbol: trade.symbol,
        anomaly_type: 'counter_signal',
        description: `User went ${userAction} on ${trade.symbol} while AI signaled ${aiAction}. The human saw something different.`,
        user_trades: [{
          tradeId: trade.id,
          userId: trade.user_id,
          userEmail: (trade as any).profiles?.email || 'Unknown',
          symbol: trade.symbol,
          tradeType: trade.trade_type,
          entryPrice: Number(trade.entry_price),
          exitPrice: trade.exit_price ? Number(trade.exit_price) : null,
          profitLoss: trade.profit_loss ? Number(trade.profit_loss) : null,
          status: trade.status,
          entryTime: trade.entry_time,
          patternKey: null,
          oddsScore: trade.odds_score ? Number(trade.odds_score) : null,
        }],
        ai_signal_at_time: {
          hadSignal: true,
          signalAction: aiAction,
          signalConfidence: Number(signals[0].confidence_score),
          signalOdds: Number(signals[0].odds_score),
        },
        confidence_gap: Number(signals[0].confidence_score),
        outcome: trade.status === 'closed'
          ? (Number(trade.profit_loss) > 0 ? 'win' : 'loss')
          : 'pending',
        profit_loss: Number(trade.profit_loss) || 0,
        status: 'detected',
        resolved_event_id: null,
        review_notes: '',
        detected_at: new Date().toISOString(),
        resolved_at: null,
        created_at: new Date().toISOString(),
      }

      anomalies.push(anomaly)
    }
  }

  return anomalies
}

export async function saveAnomalies(anomalies: UserTradeAnomaly[]): Promise<number> {
  let saved = 0
  for (const anomaly of anomalies) {
    const { error } = await supabase.from('user_trade_anomalies').insert({
      user_id: anomaly.user_id,
      detected_by: anomaly.detected_by,
      symbol: anomaly.symbol,
      anomaly_type: anomaly.anomaly_type,
      description: anomaly.description,
      user_trades: anomaly.user_trades,
      ai_signal_at_time: anomaly.ai_signal_at_time,
      confidence_gap: anomaly.confidence_gap,
      outcome: anomaly.outcome,
      profit_loss: anomaly.profit_loss,
      status: anomaly.status,
      detected_at: anomaly.detected_at,
    })
    if (!error) saved++
  }
  return saved
}

export async function getAnomalies(filters?: {
  status?: string
  anomalyType?: string
  symbol?: string
}): Promise<UserTradeAnomaly[]> {
  let query = supabase
    .from('user_trade_anomalies')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(100)

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.anomalyType) query = query.eq('anomaly_type', filters.anomalyType)
  if (filters?.symbol) query = query.eq('symbol', filters.symbol)

  const { data } = await query
  return (data || []) as UserTradeAnomaly[]
}

export async function updateAnomalyStatus(
  anomalyId: string,
  status: string,
  reviewNotes?: string,
  resolvedEventId?: string
): Promise<boolean> {
  const updates: Record<string, any> = { status }
  if (reviewNotes !== undefined) updates.review_notes = reviewNotes
  if (resolvedEventId) {
    updates.resolved_event_id = resolvedEventId
    updates.resolved_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('user_trade_anomalies')
    .update(updates)
    .eq('id', anomalyId)

  return !error
}

export async function createRealWorldEvent(event: Omit<RealWorldEvent, 'id' | 'created_at' | 'updated_at'>): Promise<RealWorldEvent | null> {
  const { data, error } = await supabase
    .from('real_world_events')
    .insert({
      created_by: event.created_by,
      event_type: event.event_type,
      title: event.title,
      description: event.description,
      symbols_affected: event.symbols_affected,
      event_date: event.event_date,
      impact_direction: event.impact_direction,
      impact_magnitude: event.impact_magnitude,
      source_url: event.source_url,
      discovery_method: event.discovery_method,
      anomaly_ids: event.anomaly_ids,
      tags: event.tags,
      is_predictive: event.is_predictive,
      predictive_signals: event.predictive_signals,
      similar_past_events: event.similar_past_events,
    })
    .select()
    .maybeSingle()

  if (error || !data) return null

  if (event.anomaly_ids.length > 0) {
    for (const anomalyId of event.anomaly_ids) {
      await updateAnomalyStatus(anomalyId, 'resolved', undefined, data.id)
    }
  }

  await updatePatternCatalog(event.event_type, event.symbols_affected, event.impact_direction)

  return data as RealWorldEvent
}

export async function getRealWorldEvents(filters?: {
  eventType?: string
  symbol?: string
  limit?: number
}): Promise<RealWorldEvent[]> {
  let query = supabase
    .from('real_world_events')
    .select('*')
    .order('event_date', { ascending: false })
    .limit(filters?.limit || 50)

  if (filters?.eventType) query = query.eq('event_type', filters.eventType)

  const { data } = await query
  return (data || []) as RealWorldEvent[]
}

export async function updateRealWorldEvent(
  eventId: string,
  updates: Partial<RealWorldEvent>
): Promise<boolean> {
  const { error } = await supabase
    .from('real_world_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', eventId)

  return !error
}

export async function deleteRealWorldEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase
    .from('real_world_events')
    .delete()
    .eq('id', eventId)

  return !error
}

async function updatePatternCatalog(eventType: string, symbols: string[], _impactDirection: string): Promise<void> {
  const { data: existing } = await supabase
    .from('event_pattern_catalog')
    .select('*')
    .eq('event_type', eventType)
    .maybeSingle()

  if (existing) {
    const currentSymbols = (existing.typical_symbols || []) as string[]
    const merged = [...new Set([...currentSymbols, ...symbols])]

    await supabase
      .from('event_pattern_catalog')
      .update({
        occurrence_count: existing.occurrence_count + 1,
        typical_symbols: merged,
        last_occurred_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    const typeLabel = EVENT_TYPES.find(t => t.value === eventType)?.label || eventType
    await supabase.from('event_pattern_catalog').insert({
      event_type: eventType,
      pattern_name: typeLabel,
      description: `Auto-cataloged from first ${typeLabel} event`,
      typical_symbols: symbols,
      occurrence_count: 1,
      last_occurred_at: new Date().toISOString(),
    })
  }
}

export async function getPatternCatalog(): Promise<EventPatternCatalog[]> {
  const { data } = await supabase
    .from('event_pattern_catalog')
    .select('*')
    .order('occurrence_count', { ascending: false })

  return (data || []) as EventPatternCatalog[]
}

export async function updatePatternEntry(
  id: string,
  updates: Partial<EventPatternCatalog>
): Promise<boolean> {
  const { error } = await supabase
    .from('event_pattern_catalog')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  return !error
}

export async function getAnomalyStats(): Promise<{
  total: number
  detected: number
  investigating: number
  resolved: number
  dismissed: number
  totalEvents: number
  eventTypes: Record<string, number>
  topSymbols: Array<{ symbol: string; count: number }>
}> {
  const [{ data: anomalies }, { data: events }] = await Promise.all([
    supabase.from('user_trade_anomalies').select('status, symbol'),
    supabase.from('real_world_events').select('event_type'),
  ])

  const statusCounts = { detected: 0, investigating: 0, resolved: 0, dismissed: 0 }
  const symbolCounts = new Map<string, number>()

  for (const a of anomalies || []) {
    const st = a.status as keyof typeof statusCounts
    if (st in statusCounts) statusCounts[st]++
    symbolCounts.set(a.symbol, (symbolCounts.get(a.symbol) || 0) + 1)
  }

  const eventTypes: Record<string, number> = {}
  for (const e of events || []) {
    eventTypes[e.event_type] = (eventTypes[e.event_type] || 0) + 1
  }

  const topSymbols = [...symbolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([symbol, count]) => ({ symbol, count }))

  return {
    total: (anomalies || []).length,
    ...statusCounts,
    totalEvents: (events || []).length,
    eventTypes,
    topSymbols,
  }
}
