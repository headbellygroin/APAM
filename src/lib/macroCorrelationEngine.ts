import { supabase } from './supabase'

export interface MacroConditionSnapshot {
  snapshot_date: string
  conditions: Record<string, number>
  source_ids: string[]
}

export interface MacroCondition {
  source_id: string
  source_name: string
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'rising' | 'falling' | 'spike'
  value?: number
  value_low?: number
  value_high?: number
  description: string
}

export interface MacroSignalCorrelation {
  id: string
  name: string
  description: string
  condition_sources: string[]
  conditions: MacroCondition[]
  outcome_type: string
  outcome_description: string
  applicable_symbols: string[]
  applicable_sectors: string[]
  hit_count: number
  miss_count: number
  hit_rate: number
  avg_outcome_magnitude: number
  significance_score: number
  first_observed_date: string | null
  last_observed_date: string | null
  observation_dates: string[]
  status: 'candidate' | 'validated' | 'rejected' | 'monitoring'
  promoted_to_ruleset: boolean
  notes: string
  created_at: string
}

export interface MacroPatternTrigger {
  id: string
  correlation_id: string
  pattern_name: string
  description: string
  condition_set: MacroCondition[]
  confirmed_occurrences: Array<{
    date: string
    symbol: string
    outcome_pct: number
    days_to_outcome: number
  }>
  occurrence_count: number
  success_count: number
  success_rate: number
  avg_days_to_outcome: number
  avg_outcome_pct: number
  worst_outcome_pct: number
  best_outcome_pct: number
  applicable_symbols: string[]
  is_active: boolean
  confidence_level: 'low' | 'medium' | 'high' | 'very_high'
  notes: string
  created_at: string
}

const snapshotCache = new Map<string, Record<string, number>>()

export async function getMacroContextForDate(date: string): Promise<Record<string, number>> {
  if (snapshotCache.has(date)) return snapshotCache.get(date)!

  const { data } = await supabase
    .from('macro_condition_snapshots')
    .select('conditions')
    .eq('snapshot_date', date)
    .maybeSingle()

  if (data?.conditions) {
    const conditions = data.conditions as Record<string, number>
    snapshotCache.set(date, conditions)
    return conditions
  }

  const computed = await computeMacroContextForDate(date)
  snapshotCache.set(date, computed)
  return computed
}

async function computeMacroContextForDate(date: string): Promise<Record<string, number>> {
  const { data: series } = await supabase
    .from('external_data_series')
    .select('source_id, series_date, value')
    .lte('series_date', date)
    .order('series_date', { ascending: false })

  if (!series || series.length === 0) return {}

  const latestBySource = new Map<string, number>()
  for (const row of series) {
    if (!latestBySource.has(row.source_id)) {
      latestBySource.set(row.source_id, Number(row.value))
    }
  }

  const conditions: Record<string, number> = {}
  latestBySource.forEach((val, sourceId) => {
    conditions[sourceId] = val
  })

  if (Object.keys(conditions).length > 0) {
    const sourceIds = Array.from(latestBySource.keys())
    await supabase.from('macro_condition_snapshots').upsert({
      snapshot_date: date,
      conditions,
      source_ids: sourceIds,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'snapshot_date' })
  }

  return conditions
}

export async function getMacroContextRange(
  startDate: string,
  endDate: string
): Promise<Map<string, Record<string, number>>> {
  const { data } = await supabase
    .from('macro_condition_snapshots')
    .select('snapshot_date, conditions')
    .gte('snapshot_date', startDate)
    .lte('snapshot_date', endDate)
    .order('snapshot_date', { ascending: true })

  const result = new Map<string, Record<string, number>>()
  for (const row of data || []) {
    result.set(row.snapshot_date, row.conditions as Record<string, number>)
  }
  return result
}

export async function rebuildSnapshotCache(
  startDate: string,
  endDate: string,
  onProgress?: (pct: number) => void
): Promise<number> {
  const { data: series } = await supabase
    .from('external_data_series')
    .select('source_id, series_date, value')
    .gte('series_date', startDate)
    .lte('series_date', endDate)
    .order('series_date', { ascending: true })

  if (!series || series.length === 0) return 0

  const byDate = new Map<string, Map<string, number>>()
  for (const row of series) {
    if (!byDate.has(row.series_date)) byDate.set(row.series_date, new Map())
    byDate.get(row.series_date)!.set(row.source_id, Number(row.value))
  }

  const dates = Array.from(byDate.keys()).sort()
  const rollingState = new Map<string, number>()

  const CHUNK = 100
  let built = 0

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]
    const dayData = byDate.get(date)!
    dayData.forEach((val, srcId) => rollingState.set(srcId, val))

    const conditions: Record<string, number> = {}
    rollingState.forEach((val, srcId) => { conditions[srcId] = val })

    if (i % CHUNK === 0 || i === dates.length - 1) {
      const chunk = dates.slice(Math.max(0, i - CHUNK + 1), i + 1).map(d => {
        const c: Record<string, number> = {}
        const dData = byDate.get(d)
        rollingState.forEach((val, srcId) => { c[srcId] = val })
        if (dData) dData.forEach((val, srcId) => { c[srcId] = val })
        return {
          snapshot_date: d,
          conditions: c,
          source_ids: Object.keys(c),
          computed_at: new Date().toISOString(),
        }
      })
      await supabase.from('macro_condition_snapshots').upsert(chunk, { onConflict: 'snapshot_date' })
      built += chunk.length
      if (onProgress) onProgress(Math.round((i / dates.length) * 100))
    }
  }

  return built
}

export function evaluateCondition(
  condition: MacroCondition,
  context: Record<string, number>,
  prevContext: Record<string, number> | null
): boolean {
  const current = context[condition.source_id]
  if (current === undefined) return false

  switch (condition.operator) {
    case 'gt':
      return current > (condition.value ?? 0)
    case 'lt':
      return current < (condition.value ?? 0)
    case 'gte':
      return current >= (condition.value ?? 0)
    case 'lte':
      return current <= (condition.value ?? 0)
    case 'between':
      return current >= (condition.value_low ?? 0) && current <= (condition.value_high ?? Infinity)
    case 'rising': {
      if (!prevContext) return false
      const prev = prevContext[condition.source_id]
      if (prev === undefined) return false
      const changePct = ((current - prev) / Math.abs(prev)) * 100
      return changePct > (condition.value ?? 1)
    }
    case 'falling': {
      if (!prevContext) return false
      const prev = prevContext[condition.source_id]
      if (prev === undefined) return false
      const changePct = ((current - prev) / Math.abs(prev)) * 100
      return changePct < -(condition.value ?? 1)
    }
    case 'spike': {
      if (!prevContext) return false
      const prev = prevContext[condition.source_id]
      if (prev === undefined) return false
      const changePct = Math.abs(((current - prev) / Math.abs(prev)) * 100)
      return changePct > (condition.value ?? 5)
    }
    default:
      return false
  }
}

export function evaluateConditionSet(
  conditions: MacroCondition[],
  context: Record<string, number>,
  prevContext: Record<string, number> | null
): boolean {
  if (conditions.length === 0) return false
  return conditions.every(c => evaluateCondition(c, context, prevContext))
}

export async function checkActivePatternTriggers(
  date: string,
  symbol: string
): Promise<MacroPatternTrigger[]> {
  const { data: triggers } = await supabase
    .from('macro_pattern_triggers')
    .select('*')
    .eq('is_active', true)
    .in('confidence_level', ['medium', 'high', 'very_high'])

  if (!triggers || triggers.length === 0) return []

  const context = await getMacroContextForDate(date)
  const prevDate = getPreviousDate(date, 7)
  const prevContext = await getMacroContextForDate(prevDate)

  const firing: MacroPatternTrigger[] = []

  for (const trigger of triggers) {
    const applicable =
      (trigger.applicable_symbols as string[]).length === 0 ||
      (trigger.applicable_symbols as string[]).includes(symbol)

    if (!applicable) continue

    const conditions = trigger.condition_set as MacroCondition[]
    if (evaluateConditionSet(conditions, context, prevContext)) {
      firing.push(trigger as MacroPatternTrigger)
    }
  }

  return firing
}

function getPreviousDate(date: string, daysBack: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() - daysBack)
  return d.toISOString().split('T')[0]
}

export async function recordPatternOccurrence(
  triggerId: string,
  symbol: string,
  date: string,
  outcomePct: number,
  daysToOutcome: number,
  wasSuccess: boolean
): Promise<void> {
  const { data: trigger } = await supabase
    .from('macro_pattern_triggers')
    .select('*')
    .eq('id', triggerId)
    .maybeSingle()

  if (!trigger) return

  const occurrences = (trigger.confirmed_occurrences || []) as Array<{
    date: string; symbol: string; outcome_pct: number; days_to_outcome: number
  }>

  occurrences.push({ date, symbol, outcome_pct: outcomePct, days_to_outcome: daysToOutcome })

  const newCount = trigger.occurrence_count + 1
  const newSuccess = wasSuccess ? trigger.success_count + 1 : trigger.success_count
  const allPcts = occurrences.map(o => o.outcome_pct)
  const avgPct = allPcts.reduce((s, v) => s + v, 0) / allPcts.length
  const worstPct = Math.min(...allPcts)
  const bestPct = Math.max(...allPcts)
  const allDays = occurrences.map(o => o.days_to_outcome)
  const avgDays = Math.round(allDays.reduce((s, v) => s + v, 0) / allDays.length)
  const successRate = newSuccess / newCount

  const confidence: MacroPatternTrigger['confidence_level'] =
    newCount >= 20 && successRate >= 0.8 ? 'very_high' :
    newCount >= 10 && successRate >= 0.7 ? 'high' :
    newCount >= 5 && successRate >= 0.6 ? 'medium' : 'low'

  await supabase.from('macro_pattern_triggers').update({
    confirmed_occurrences: occurrences,
    occurrence_count: newCount,
    success_count: newSuccess,
    success_rate: successRate,
    avg_days_to_outcome: avgDays,
    avg_outcome_pct: avgPct,
    worst_outcome_pct: worstPct,
    best_outcome_pct: bestPct,
    confidence_level: confidence,
    updated_at: new Date().toISOString(),
  }).eq('id', triggerId)
}

export async function discoverCorrelationsFromSimulation(
  runId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const { data: trades } = await supabase
    .from('historical_fleet_trades')
    .select('*')
    .eq('run_id', runId)
    .eq('status', 'closed')
    .not('profit_loss', 'is', null)

  if (!trades || trades.length < 10) return 0

  const macroRange = await getMacroContextRange(startDate, endDate)
  if (macroRange.size === 0) return 0

  const { data: sources } = await supabase
    .from('external_data_sources')
    .select('id, name, unit, category')
    .eq('is_active', true)

  if (!sources || sources.length === 0) return 0

  const sourceMap = new Map(sources.map(s => [s.id, s]))
  let discovered = 0

  const winTrades = trades.filter(t => (t.profit_loss ?? 0) > 0)
  const lossTrades = trades.filter(t => (t.profit_loss ?? 0) <= 0)

  for (const source of sources) {
    const winValues = winTrades
      .map(t => macroRange.get(t.sim_date)?.[source.id])
      .filter(v => v !== undefined) as number[]

    const lossValues = lossTrades
      .map(t => macroRange.get(t.sim_date)?.[source.id])
      .filter(v => v !== undefined) as number[]

    if (winValues.length < 5 || lossValues.length < 5) continue

    const winMean = winValues.reduce((s, v) => s + v, 0) / winValues.length
    const lossMean = lossValues.reduce((s, v) => s + v, 0) / lossValues.length

    if (winMean === 0 || lossMean === 0) continue

    const divergence = Math.abs((winMean - lossMean) / lossMean)

    if (divergence > 0.1) {
      const direction = winMean > lossMean ? 'higher' : 'lower'
      const name = `${sourceMap.get(source.id)?.name ?? source.id} ${direction} on wins`
      const hitRate = winValues.length / (winValues.length + lossValues.length)
      const significance = Math.min(1, divergence * hitRate * Math.log(winValues.length + 1) / 5)

      if (significance > 0.15) {
        const existing = await supabase
          .from('macro_signal_correlations')
          .select('id')
          .eq('discovered_by_run_id', runId)
          .contains('condition_sources', [source.id])
          .maybeSingle()

        if (!existing.data) {
          const condition: MacroCondition = {
            source_id: source.id,
            source_name: sourceMap.get(source.id)?.name ?? source.id,
            operator: direction === 'higher' ? 'gte' : 'lte',
            value: winMean,
            description: `${sourceMap.get(source.id)?.name} is ${direction} than average during winning trades`,
          }

          await supabase.from('macro_signal_correlations').insert({
            discovered_by_run_id: runId,
            name,
            description: `Discovered in simulation ${runId}: wins occurred when ${condition.source_name} was ${direction} (mean=${winMean.toFixed(2)} vs loss mean=${lossMean.toFixed(2)})`,
            condition_sources: [source.id],
            conditions: [condition],
            outcome_type: direction === 'higher' ? 'price_up' : 'price_down',
            outcome_description: `Trades tended to win when ${condition.source_name} was ${direction}`,
            hit_count: winValues.length,
            miss_count: lossValues.length,
            hit_rate: hitRate,
            significance_score: significance,
            status: significance > 0.4 ? 'monitoring' : 'candidate',
          })
          discovered++
        }
      }
    }
  }

  return discovered
}

export async function getActivePatternTriggers(): Promise<MacroPatternTrigger[]> {
  const { data } = await supabase
    .from('macro_pattern_triggers')
    .select('*')
    .eq('is_active', true)
    .order('success_rate', { ascending: false })
  return (data || []) as MacroPatternTrigger[]
}

export async function getMacroCorrelations(
  status?: string
): Promise<MacroSignalCorrelation[]> {
  let query = supabase
    .from('macro_signal_correlations')
    .select('*')
    .order('significance_score', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data } = await query
  return (data || []) as MacroSignalCorrelation[]
}

export async function updateCorrelationStatus(
  id: string,
  status: MacroSignalCorrelation['status']
): Promise<void> {
  await supabase.from('macro_signal_correlations').update({
    status,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
}

export async function promoteCorrelationToTrigger(
  correlation: MacroSignalCorrelation,
  patternName: string,
  description: string,
  minimumSamples: number = 5
): Promise<string | null> {
  const { data, error } = await supabase.from('macro_pattern_triggers').insert({
    correlation_id: correlation.id,
    pattern_name: patternName,
    description,
    condition_set: correlation.conditions,
    confirmed_occurrences: [],
    occurrence_count: correlation.hit_count,
    success_count: Math.round(correlation.hit_count * correlation.hit_rate),
    success_rate: correlation.hit_rate,
    applicable_symbols: correlation.applicable_symbols,
    minimum_samples_required: minimumSamples,
    is_active: true,
    confidence_level: correlation.hit_rate >= 0.8 ? 'high' : correlation.hit_rate >= 0.65 ? 'medium' : 'low',
  }).select('id').maybeSingle()

  if (error || !data) return null

  await supabase.from('macro_signal_correlations').update({
    promoted_to_ruleset: true,
    status: 'validated',
    updated_at: new Date().toISOString(),
  }).eq('id', correlation.id)

  return data.id
}

export async function getGlobalMacroStats(): Promise<{
  totalSources: number
  totalDataPoints: number
  dateRangeCovered: string
  totalCorrelations: number
  validatedPatterns: number
  activePatternTriggers: number
}> {
  const [sourcesRes, correlationsRes, triggersRes] = await Promise.all([
    supabase.from('external_data_sources').select('id, data_points_count, date_range_start, date_range_end').eq('is_active', true),
    supabase.from('macro_signal_correlations').select('id, status'),
    supabase.from('macro_pattern_triggers').select('id').eq('is_active', true),
  ])

  const sources = sourcesRes.data || []
  const correlations = correlationsRes.data || []

  const totalPoints = sources.reduce((s, r) => s + (r.data_points_count || 0), 0)
  const allStarts = sources.map(s => s.date_range_start).filter(Boolean).sort()
  const allEnds = sources.map(s => s.date_range_end).filter(Boolean).sort()
  const earliest = allStarts[0] || 'N/A'
  const latest = allEnds[allEnds.length - 1] || 'N/A'

  return {
    totalSources: sources.length,
    totalDataPoints: totalPoints,
    dateRangeCovered: earliest === 'N/A' ? 'No data yet' : `${earliest} to ${latest}`,
    totalCorrelations: correlations.length,
    validatedPatterns: correlations.filter(c => c.status === 'validated').length,
    activePatternTriggers: triggersRes.data?.length || 0,
  }
}
