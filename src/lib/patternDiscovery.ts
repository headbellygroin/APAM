import { supabase } from './supabase'

export interface PatternObservation {
  id: string
  user_id: string
  account_id: string
  observation_key: string
  observation_type: string
  description: string
  conditions: Record<string, any>
  sample_size: number
  win_count: number
  loss_count: number
  win_rate: number
  avg_profit: number
  avg_loss: number
  baseline_win_rate: number
  significance_score: number
  edge_pct: number
  status: string
  strategy_id: string
  first_observed_at: string
  last_observed_at: string
  promoted_at: string | null
  created_at: string
  updated_at: string
}

export interface CandidateRule {
  id: string
  user_id: string
  observation_id: string | null
  rule_name: string
  rule_description: string
  rule_type: string
  conditions: Record<string, any>
  action: Record<string, any>
  source_strategy_id: string
  source_account_ids: string[]
  sample_size: number
  win_rate: number
  edge_pct: number
  confidence: string
  status: string
  target_ruleset_id: string | null
  testing_account_id: string | null
  test_results: Record<string, any>
  admin_notes: string
  created_at: string
  updated_at: string
}

export const OBSERVATION_TYPES = [
  { value: 'timing', label: 'Timing Pattern', description: 'Time-of-day or day-of-week correlations' },
  { value: 'sequence', label: 'Sequence Pattern', description: 'Specific sequences of conditions before wins/losses' },
  { value: 'correlation', label: 'Score Correlation', description: 'Unusual score combinations that predict outcomes' },
  { value: 'multi_factor', label: 'Multi-Factor', description: 'Combinations of factors not weighted in rules' },
  { value: 'context', label: 'Market Context', description: 'Broader market conditions affecting outcomes' },
  { value: 'volume', label: 'Volume Pattern', description: 'Position size or frequency patterns' },
  { value: 'streak', label: 'Streak Pattern', description: 'Win/loss streaks following specific conditions' },
] as const

export const RULE_TYPES = [
  { value: 'score_boost', label: 'Score Boost', description: 'Add points to odds score when conditions met' },
  { value: 'score_penalty', label: 'Score Penalty', description: 'Subtract points when conditions met' },
  { value: 'entry_filter', label: 'Entry Filter', description: 'Block trades when conditions met' },
  { value: 'exit_modifier', label: 'Exit Modifier', description: 'Adjust stop/target when conditions met' },
  { value: 'new_signal', label: 'New Signal', description: 'Generate a new trade signal from novel conditions' },
] as const

const MIN_SAMPLE_FOR_OBSERVATION = 8
const MIN_SAMPLE_FOR_CANDIDATE = 15
const MIN_EDGE_FOR_OBSERVATION = 10
const MIN_EDGE_FOR_CANDIDATE = 15
const MIN_SIGNIFICANCE_FOR_CANDIDATE = 60

interface TradeRecord {
  id: string
  symbol: string
  trade_type: string
  entry_price: number
  exit_price: number | null
  stop_loss: number
  target_price: number
  profit_loss: number | null
  status: string
  odds_score: number | null
  confidence_score: number | null
  pattern_key: string | null
  was_drift_decision: boolean
  entry_time: string | null
  exit_time: string | null
  exit_reason: string | null
}

export async function analyzeAccountForPatterns(
  userId: string,
  accountId: string,
  strategyId: string
): Promise<PatternObservation[]> {
  const { data: trades } = await supabase
    .from('ai_training_trades')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'closed')
    .order('exit_time', { ascending: false })
    .limit(200)

  if (!trades || trades.length < MIN_SAMPLE_FOR_OBSERVATION) return []

  const closedTrades = trades as TradeRecord[]
  const totalWins = closedTrades.filter(t => (t.profit_loss || 0) > 0).length
  const baselineWinRate = totalWins / closedTrades.length

  const observations: PatternObservation[] = []

  observations.push(...analyzeTimingPatterns(userId, accountId, strategyId, closedTrades, baselineWinRate))
  observations.push(...analyzeScoreCombinations(userId, accountId, strategyId, closedTrades, baselineWinRate))
  observations.push(...analyzeStreakPatterns(userId, accountId, strategyId, closedTrades, baselineWinRate))
  observations.push(...analyzeExitPatterns(userId, accountId, strategyId, closedTrades, baselineWinRate))
  observations.push(...analyzePatternKeyGaps(userId, accountId, strategyId, closedTrades, baselineWinRate))

  return observations.filter(o => o.significance_score >= 30 && Math.abs(o.edge_pct) >= MIN_EDGE_FOR_OBSERVATION)
}

function analyzeTimingPatterns(
  userId: string,
  accountId: string,
  strategyId: string,
  trades: TradeRecord[],
  baselineWinRate: number
): PatternObservation[] {
  const results: PatternObservation[] = []

  const byDow = new Map<number, { wins: number; losses: number; profits: number[]; losses_amts: number[] }>()

  for (const t of trades) {
    if (!t.entry_time) continue
    const dow = new Date(t.entry_time).getDay()
    const entry = byDow.get(dow) || { wins: 0, losses: 0, profits: [], losses_amts: [] }
    const isWin = (t.profit_loss || 0) > 0

    if (isWin) {
      entry.wins++
      entry.profits.push(t.profit_loss || 0)
    } else {
      entry.losses++
      entry.losses_amts.push(Math.abs(t.profit_loss || 0))
    }
    byDow.set(dow, entry)
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  for (const [dow, data] of byDow) {
    const total = data.wins + data.losses
    if (total < MIN_SAMPLE_FOR_OBSERVATION) continue

    const winRate = data.wins / total
    const edgePct = ((winRate - baselineWinRate) / Math.max(0.01, baselineWinRate)) * 100
    const avgProfit = data.profits.length > 0 ? data.profits.reduce((s, p) => s + p, 0) / data.profits.length : 0
    const avgLoss = data.losses_amts.length > 0 ? data.losses_amts.reduce((s, p) => s + p, 0) / data.losses_amts.length : 0

    if (Math.abs(edgePct) < MIN_EDGE_FOR_OBSERVATION) continue

    const significance = calculateSignificance(total, winRate, baselineWinRate)

    results.push(makeObservation({
      userId, accountId, strategyId,
      key: `timing-dow-${dow}`,
      type: 'timing',
      description: edgePct > 0
        ? `Trades entered on ${dayNames[dow]} win ${(winRate * 100).toFixed(0)}% vs ${(baselineWinRate * 100).toFixed(0)}% baseline (+${edgePct.toFixed(0)}% edge)`
        : `Trades entered on ${dayNames[dow]} underperform: ${(winRate * 100).toFixed(0)}% vs ${(baselineWinRate * 100).toFixed(0)}% baseline (${edgePct.toFixed(0)}% edge)`,
      conditions: { dayOfWeek: dow, dayName: dayNames[dow] },
      sampleSize: total, wins: data.wins, losses: data.losses,
      winRate, avgProfit, avgLoss,
      baselineWinRate, significance, edgePct,
    }))
  }

  const byHour = new Map<string, { wins: number; losses: number }>()
  for (const t of trades) {
    if (!t.entry_time) continue
    const hour = new Date(t.entry_time).getHours()
    const bucket = hour < 11 ? 'morning' : hour < 14 ? 'midday' : 'afternoon'
    const entry = byHour.get(bucket) || { wins: 0, losses: 0 }
    if ((t.profit_loss || 0) > 0) entry.wins++
    else entry.losses++
    byHour.set(bucket, entry)
  }

  for (const [bucket, data] of byHour) {
    const total = data.wins + data.losses
    if (total < MIN_SAMPLE_FOR_OBSERVATION) continue

    const winRate = data.wins / total
    const edgePct = ((winRate - baselineWinRate) / Math.max(0.01, baselineWinRate)) * 100

    if (Math.abs(edgePct) < MIN_EDGE_FOR_OBSERVATION) continue

    const significance = calculateSignificance(total, winRate, baselineWinRate)

    results.push(makeObservation({
      userId, accountId, strategyId,
      key: `timing-session-${bucket}`,
      type: 'timing',
      description: edgePct > 0
        ? `${bucket.charAt(0).toUpperCase() + bucket.slice(1)} entries win ${(winRate * 100).toFixed(0)}% vs ${(baselineWinRate * 100).toFixed(0)}% baseline`
        : `${bucket.charAt(0).toUpperCase() + bucket.slice(1)} entries underperform: ${(winRate * 100).toFixed(0)}% vs ${(baselineWinRate * 100).toFixed(0)}%`,
      conditions: { session: bucket },
      sampleSize: total, wins: data.wins, losses: data.losses,
      winRate, avgProfit: 0, avgLoss: 0,
      baselineWinRate, significance, edgePct,
    }))
  }

  return results
}

function analyzeScoreCombinations(
  userId: string,
  accountId: string,
  strategyId: string,
  trades: TradeRecord[],
  baselineWinRate: number
): PatternObservation[] {
  const results: PatternObservation[] = []

  const scoreBuckets = [
    { key: 'high-odds', label: 'High odds score (8+)', filter: (t: TradeRecord) => (t.odds_score || 0) >= 8 },
    { key: 'mid-odds', label: 'Mid odds score (6-8)', filter: (t: TradeRecord) => (t.odds_score || 0) >= 6 && (t.odds_score || 0) < 8 },
    { key: 'borderline-odds', label: 'Borderline odds score (5-6)', filter: (t: TradeRecord) => (t.odds_score || 0) >= 5 && (t.odds_score || 0) < 6 },
    { key: 'drift-trades', label: 'Drift-enabled trades', filter: (t: TradeRecord) => t.was_drift_decision },
    { key: 'non-drift', label: 'Non-drift trades', filter: (t: TradeRecord) => !t.was_drift_decision },
    { key: 'long-only', label: 'Long trades', filter: (t: TradeRecord) => t.trade_type === 'long' },
    { key: 'short-only', label: 'Short trades', filter: (t: TradeRecord) => t.trade_type === 'short' },
  ]

  for (const bucket of scoreBuckets) {
    const matching = trades.filter(bucket.filter)
    if (matching.length < MIN_SAMPLE_FOR_OBSERVATION) continue

    const wins = matching.filter(t => (t.profit_loss || 0) > 0).length
    const winRate = wins / matching.length
    const edgePct = ((winRate - baselineWinRate) / Math.max(0.01, baselineWinRate)) * 100

    if (Math.abs(edgePct) < MIN_EDGE_FOR_OBSERVATION) continue

    const significance = calculateSignificance(matching.length, winRate, baselineWinRate)

    const profits = matching.filter(t => (t.profit_loss || 0) > 0).map(t => t.profit_loss || 0)
    const losses = matching.filter(t => (t.profit_loss || 0) <= 0).map(t => Math.abs(t.profit_loss || 0))
    const avgProfit = profits.length > 0 ? profits.reduce((s, p) => s + p, 0) / profits.length : 0
    const avgLoss = losses.length > 0 ? losses.reduce((s, p) => s + p, 0) / losses.length : 0

    results.push(makeObservation({
      userId, accountId, strategyId,
      key: `score-${bucket.key}`,
      type: 'correlation',
      description: `${bucket.label}: ${(winRate * 100).toFixed(0)}% win rate over ${matching.length} trades (${edgePct > 0 ? '+' : ''}${edgePct.toFixed(0)}% vs baseline)`,
      conditions: { bucket: bucket.key },
      sampleSize: matching.length, wins, losses: matching.length - wins,
      winRate, avgProfit, avgLoss,
      baselineWinRate, significance, edgePct,
    }))
  }

  return results
}

function analyzeStreakPatterns(
  userId: string,
  accountId: string,
  strategyId: string,
  trades: TradeRecord[],
  baselineWinRate: number
): PatternObservation[] {
  const results: PatternObservation[] = []

  if (trades.length < 20) return results

  const sorted = [...trades].sort((a, b) => {
    const ta = a.exit_time ? new Date(a.exit_time).getTime() : 0
    const tb = b.exit_time ? new Date(b.exit_time).getTime() : 0
    return ta - tb
  })

  let afterWinStreak = { wins: 0, total: 0 }
  let afterLossStreak = { wins: 0, total: 0 }
  let consecutiveWins = 0
  let consecutiveLosses = 0

  for (let i = 0; i < sorted.length; i++) {
    const isWin = (sorted[i].profit_loss || 0) > 0

    if (consecutiveWins >= 3 && i < sorted.length) {
      afterWinStreak.total++
      if (isWin) afterWinStreak.wins++
    }

    if (consecutiveLosses >= 3 && i < sorted.length) {
      afterLossStreak.total++
      if (isWin) afterLossStreak.wins++
    }

    if (isWin) {
      consecutiveWins++
      consecutiveLosses = 0
    } else {
      consecutiveLosses++
      consecutiveWins = 0
    }
  }

  if (afterWinStreak.total >= MIN_SAMPLE_FOR_OBSERVATION) {
    const wr = afterWinStreak.wins / afterWinStreak.total
    const edge = ((wr - baselineWinRate) / Math.max(0.01, baselineWinRate)) * 100
    const sig = calculateSignificance(afterWinStreak.total, wr, baselineWinRate)

    if (Math.abs(edge) >= MIN_EDGE_FOR_OBSERVATION) {
      results.push(makeObservation({
        userId, accountId, strategyId,
        key: 'streak-after-3-wins',
        type: 'streak',
        description: `After 3+ consecutive wins: next trade wins ${(wr * 100).toFixed(0)}% (${edge > 0 ? '+' : ''}${edge.toFixed(0)}% vs baseline)`,
        conditions: { afterStreak: 'win', minStreak: 3 },
        sampleSize: afterWinStreak.total,
        wins: afterWinStreak.wins,
        losses: afterWinStreak.total - afterWinStreak.wins,
        winRate: wr, avgProfit: 0, avgLoss: 0,
        baselineWinRate, significance: sig, edgePct: edge,
      }))
    }
  }

  if (afterLossStreak.total >= MIN_SAMPLE_FOR_OBSERVATION) {
    const wr = afterLossStreak.wins / afterLossStreak.total
    const edge = ((wr - baselineWinRate) / Math.max(0.01, baselineWinRate)) * 100
    const sig = calculateSignificance(afterLossStreak.total, wr, baselineWinRate)

    if (Math.abs(edge) >= MIN_EDGE_FOR_OBSERVATION) {
      results.push(makeObservation({
        userId, accountId, strategyId,
        key: 'streak-after-3-losses',
        type: 'streak',
        description: `After 3+ consecutive losses: next trade wins ${(wr * 100).toFixed(0)}% (${edge > 0 ? '+' : ''}${edge.toFixed(0)}% vs baseline)`,
        conditions: { afterStreak: 'loss', minStreak: 3 },
        sampleSize: afterLossStreak.total,
        wins: afterLossStreak.wins,
        losses: afterLossStreak.total - afterLossStreak.wins,
        winRate: wr, avgProfit: 0, avgLoss: 0,
        baselineWinRate, significance: sig, edgePct: edge,
      }))
    }
  }

  return results
}

function analyzeExitPatterns(
  userId: string,
  accountId: string,
  strategyId: string,
  trades: TradeRecord[],
  baselineWinRate: number
): PatternObservation[] {
  const results: PatternObservation[] = []

  const targetHits = trades.filter(t => t.exit_reason === 'target')
  const stopHits = trades.filter(t => t.exit_reason === 'stop')

  if (targetHits.length >= MIN_SAMPLE_FOR_OBSERVATION && stopHits.length >= MIN_SAMPLE_FOR_OBSERVATION) {
    const targetRate = targetHits.length / trades.length
    const expectedTargetRate = baselineWinRate

    const edge = ((targetRate - expectedTargetRate) / Math.max(0.01, expectedTargetRate)) * 100
    const sig = calculateSignificance(trades.length, targetRate, expectedTargetRate)

    if (Math.abs(edge) >= MIN_EDGE_FOR_OBSERVATION) {
      const avgTargetProfit = targetHits.reduce((s, t) => s + (t.profit_loss || 0), 0) / targetHits.length
      const avgStopLoss = stopHits.reduce((s, t) => s + Math.abs(t.profit_loss || 0), 0) / stopHits.length

      results.push(makeObservation({
        userId, accountId, strategyId,
        key: 'exit-ratio-target-vs-stop',
        type: 'correlation',
        description: `Target hit rate ${(targetRate * 100).toFixed(0)}% vs expected ${(expectedTargetRate * 100).toFixed(0)}%. Avg win $${avgTargetProfit.toFixed(2)}, avg loss $${avgStopLoss.toFixed(2)}`,
        conditions: { targetRate, stopRate: 1 - targetRate, avgTargetProfit, avgStopLoss },
        sampleSize: trades.length,
        wins: targetHits.length,
        losses: stopHits.length,
        winRate: targetRate,
        avgProfit: avgTargetProfit,
        avgLoss: avgStopLoss,
        baselineWinRate: expectedTargetRate,
        significance: sig,
        edgePct: edge,
      }))
    }
  }

  const rrGroups = new Map<string, { wins: number; losses: number }>()
  for (const t of trades) {
    const rr = Math.abs(t.target_price - t.entry_price) / Math.abs(t.entry_price - t.stop_loss)
    const bucket = rr < 1.5 ? 'tight' : rr < 2.5 ? 'standard' : rr < 4 ? 'wide' : 'extended'
    const entry = rrGroups.get(bucket) || { wins: 0, losses: 0 }
    if ((t.profit_loss || 0) > 0) entry.wins++
    else entry.losses++
    rrGroups.set(bucket, entry)
  }

  for (const [bucket, data] of rrGroups) {
    const total = data.wins + data.losses
    if (total < MIN_SAMPLE_FOR_OBSERVATION) continue

    const wr = data.wins / total
    const edge = ((wr - baselineWinRate) / Math.max(0.01, baselineWinRate)) * 100

    if (Math.abs(edge) < MIN_EDGE_FOR_OBSERVATION) continue

    const sig = calculateSignificance(total, wr, baselineWinRate)

    results.push(makeObservation({
      userId, accountId, strategyId,
      key: `rr-bucket-${bucket}`,
      type: 'correlation',
      description: `${bucket.charAt(0).toUpperCase() + bucket.slice(1)} R:R setups win ${(wr * 100).toFixed(0)}% over ${total} trades (${edge > 0 ? '+' : ''}${edge.toFixed(0)}% vs baseline)`,
      conditions: { rrBucket: bucket },
      sampleSize: total, wins: data.wins, losses: data.losses,
      winRate: wr, avgProfit: 0, avgLoss: 0,
      baselineWinRate, significance: sig, edgePct: edge,
    }))
  }

  return results
}

function analyzePatternKeyGaps(
  userId: string,
  accountId: string,
  strategyId: string,
  trades: TradeRecord[],
  baselineWinRate: number
): PatternObservation[] {
  const results: PatternObservation[] = []

  const byPattern = new Map<string, { wins: number; losses: number; driftCount: number }>()

  for (const t of trades) {
    if (!t.pattern_key) continue
    const entry = byPattern.get(t.pattern_key) || { wins: 0, losses: 0, driftCount: 0 }
    if ((t.profit_loss || 0) > 0) entry.wins++
    else entry.losses++
    if (t.was_drift_decision) entry.driftCount++
    byPattern.set(t.pattern_key, entry)
  }

  for (const [pattern, data] of byPattern) {
    const total = data.wins + data.losses
    if (total < MIN_SAMPLE_FOR_OBSERVATION) continue

    const wr = data.wins / total
    const edge = ((wr - baselineWinRate) / Math.max(0.01, baselineWinRate)) * 100

    if (Math.abs(edge) < MIN_EDGE_FOR_OBSERVATION) continue

    const sig = calculateSignificance(total, wr, baselineWinRate)
    const driftPct = (data.driftCount / total) * 100

    results.push(makeObservation({
      userId, accountId, strategyId,
      key: `pattern-${pattern}`,
      type: 'multi_factor',
      description: `Pattern "${pattern}": ${(wr * 100).toFixed(0)}% win rate over ${total} trades. ${driftPct.toFixed(0)}% were drift decisions.`,
      conditions: { patternKey: pattern, driftPct },
      sampleSize: total, wins: data.wins, losses: data.losses,
      winRate: wr, avgProfit: 0, avgLoss: 0,
      baselineWinRate, significance: sig, edgePct: edge,
    }))
  }

  return results
}

function calculateSignificance(sampleSize: number, observedRate: number, baselineRate: number): number {
  if (sampleSize < 5) return 0

  const stdErr = Math.sqrt((baselineRate * (1 - baselineRate)) / sampleSize)
  if (stdErr === 0) return 0

  const zScore = Math.abs(observedRate - baselineRate) / stdErr
  const sampleBonus = Math.min(30, Math.sqrt(sampleSize) * 3)
  const significance = Math.min(100, zScore * 25 + sampleBonus)

  return significance
}

function makeObservation(params: {
  userId: string
  accountId: string
  strategyId: string
  key: string
  type: string
  description: string
  conditions: Record<string, any>
  sampleSize: number
  wins: number
  losses: number
  winRate: number
  avgProfit: number
  avgLoss: number
  baselineWinRate: number
  significance: number
  edgePct: number
}): PatternObservation {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    user_id: params.userId,
    account_id: params.accountId,
    observation_key: params.key,
    observation_type: params.type,
    description: params.description,
    conditions: params.conditions,
    sample_size: params.sampleSize,
    win_count: params.wins,
    loss_count: params.losses,
    win_rate: params.winRate,
    avg_profit: params.avgProfit,
    avg_loss: params.avgLoss,
    baseline_win_rate: params.baselineWinRate,
    significance_score: params.significance,
    edge_pct: params.edgePct,
    status: params.significance >= MIN_SIGNIFICANCE_FOR_CANDIDATE && params.sampleSize >= MIN_SAMPLE_FOR_CANDIDATE && Math.abs(params.edgePct) >= MIN_EDGE_FOR_CANDIDATE
      ? 'candidate'
      : 'observed',
    strategy_id: params.strategyId,
    first_observed_at: now,
    last_observed_at: now,
    promoted_at: null,
    created_at: now,
    updated_at: now,
  }
}

export async function saveObservations(observations: PatternObservation[]): Promise<number> {
  let saved = 0
  for (const obs of observations) {
    const { data: existing } = await supabase
      .from('ai_pattern_observations')
      .select('id, sample_size, first_observed_at')
      .eq('account_id', obs.account_id)
      .eq('observation_key', obs.observation_key)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('ai_pattern_observations')
        .update({
          sample_size: obs.sample_size,
          win_count: obs.win_count,
          loss_count: obs.loss_count,
          win_rate: obs.win_rate,
          avg_profit: obs.avg_profit,
          avg_loss: obs.avg_loss,
          baseline_win_rate: obs.baseline_win_rate,
          significance_score: obs.significance_score,
          edge_pct: obs.edge_pct,
          status: obs.status,
          description: obs.description,
          conditions: obs.conditions,
          last_observed_at: obs.last_observed_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (!error) saved++
    } else {
      const { error } = await supabase
        .from('ai_pattern_observations')
        .insert({
          user_id: obs.user_id,
          account_id: obs.account_id,
          observation_key: obs.observation_key,
          observation_type: obs.observation_type,
          description: obs.description,
          conditions: obs.conditions,
          sample_size: obs.sample_size,
          win_count: obs.win_count,
          loss_count: obs.loss_count,
          win_rate: obs.win_rate,
          avg_profit: obs.avg_profit,
          avg_loss: obs.avg_loss,
          baseline_win_rate: obs.baseline_win_rate,
          significance_score: obs.significance_score,
          edge_pct: obs.edge_pct,
          status: obs.status,
          strategy_id: obs.strategy_id,
          first_observed_at: obs.first_observed_at,
          last_observed_at: obs.last_observed_at,
        })
      if (!error) saved++
    }
  }
  return saved
}

export async function getObservations(filters?: {
  accountId?: string
  status?: string
  observationType?: string
  minSignificance?: number
}): Promise<PatternObservation[]> {
  let query = supabase
    .from('ai_pattern_observations')
    .select('*')
    .order('significance_score', { ascending: false })
    .limit(100)

  if (filters?.accountId) query = query.eq('account_id', filters.accountId)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.observationType) query = query.eq('observation_type', filters.observationType)
  if (filters?.minSignificance) query = query.gte('significance_score', filters.minSignificance)

  const { data } = await query
  return (data || []) as PatternObservation[]
}

export async function promoteToCandidate(
  userId: string,
  observation: PatternObservation,
  ruleName: string,
  ruleDescription: string,
  ruleType: string,
  action: Record<string, any>
): Promise<CandidateRule | null> {
  const { data, error } = await supabase
    .from('ai_candidate_rules')
    .insert({
      user_id: userId,
      observation_id: observation.id,
      rule_name: ruleName,
      rule_description: ruleDescription,
      rule_type: ruleType,
      conditions: observation.conditions,
      action,
      source_strategy_id: observation.strategy_id,
      source_account_ids: [observation.account_id],
      sample_size: observation.sample_size,
      win_rate: observation.win_rate,
      edge_pct: observation.edge_pct,
      confidence: observation.sample_size >= 50 ? 'high' : observation.sample_size >= 25 ? 'medium' : 'low',
      status: 'proposed',
    })
    .select()
    .maybeSingle()

  if (error || !data) return null

  await supabase
    .from('ai_pattern_observations')
    .update({
      status: 'promoted',
      promoted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', observation.id)

  return data as CandidateRule
}

export async function getCandidateRules(filters?: {
  status?: string
}): Promise<CandidateRule[]> {
  let query = supabase
    .from('ai_candidate_rules')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (filters?.status) query = query.eq('status', filters.status)

  const { data } = await query
  return (data || []) as CandidateRule[]
}

export async function updateCandidateRule(
  ruleId: string,
  updates: Partial<CandidateRule>
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_candidate_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', ruleId)

  return !error
}

export async function getDiscoveryStats(): Promise<{
  totalObservations: number
  candidates: number
  promoted: number
  proposedRules: number
  testingRules: number
  acceptedRules: number
  topEdge: PatternObservation | null
}> {
  const [{ data: obs }, { data: rules }] = await Promise.all([
    supabase.from('ai_pattern_observations').select('*').order('significance_score', { ascending: false }).limit(200),
    supabase.from('ai_candidate_rules').select('status'),
  ])

  const observations = (obs || []) as PatternObservation[]
  const candidates = observations.filter(o => o.status === 'candidate')
  const promoted = observations.filter(o => o.status === 'promoted')

  const ruleStatuses = { proposed: 0, testing: 0, accepted: 0 }
  for (const r of rules || []) {
    const s = r.status as keyof typeof ruleStatuses
    if (s in ruleStatuses) ruleStatuses[s]++
  }

  return {
    totalObservations: observations.length,
    candidates: candidates.length,
    promoted: promoted.length,
    proposedRules: ruleStatuses.proposed,
    testingRules: ruleStatuses.testing,
    acceptedRules: ruleStatuses.accepted,
    topEdge: candidates.length > 0 ? candidates[0] : null,
  }
}

export async function runDiscoveryForAllAccounts(userId: string): Promise<{
  accountsScanned: number
  observationsFound: number
  observationsSaved: number
  newCandidates: number
}> {
  const { data: accounts } = await supabase
    .from('ai_training_accounts')
    .select('id, strategy_id, total_trades, status')
    .eq('user_id', userId)
    .gte('total_trades', MIN_SAMPLE_FOR_OBSERVATION)

  if (!accounts || accounts.length === 0) {
    return { accountsScanned: 0, observationsFound: 0, observationsSaved: 0, newCandidates: 0 }
  }

  let totalFound = 0
  let totalSaved = 0
  let newCandidates = 0

  for (const acct of accounts) {
    const observations = await analyzeAccountForPatterns(userId, acct.id, acct.strategy_id)
    totalFound += observations.length
    newCandidates += observations.filter(o => o.status === 'candidate').length

    if (observations.length > 0) {
      const saved = await saveObservations(observations)
      totalSaved += saved
    }
  }

  return {
    accountsScanned: accounts.length,
    observationsFound: totalFound,
    observationsSaved: totalSaved,
    newCandidates,
  }
}
