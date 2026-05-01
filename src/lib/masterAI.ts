import { supabase } from './supabase'
import { LearnedWeights, ThresholdAdjustments, PatternOverride } from './aiDriftEngine'

export interface UserContribution {
  userId: string
  email: string
  totalTrades: number
  winRate: number
  totalPL: number
  weights: LearnedWeights
  thresholds: ThresholdAdjustments
  patterns: Record<string, PatternOverride>
  patternCount: number
  isDrifting: boolean
  aiName: string | null
  nameStatus: string
  influence: number
  lastUpdated: string | null
}

export interface CollectiveIntelligence {
  synthesizedWeights: LearnedWeights
  synthesizedThresholds: ThresholdAdjustments
  synthesizedPatterns: Record<string, {
    patternKey: string
    consensus: 'promote' | 'demote' | 'mixed' | 'none'
    avgWinRate: number
    totalSampleSize: number
    userCount: number
    details: Array<{
      userId: string
      email: string
      action: string
      winRate: number
      sampleSize: number
    }>
  }>
  convergenceScore: number
  userCount: number
  totalTradesAnalyzed: number
  weightConvergence: Record<string, {
    mean: number
    stdDev: number
    min: number
    max: number
    agreement: 'strong' | 'moderate' | 'divergent'
  }>
}

export interface MasterAIOwnerState {
  weights: LearnedWeights
  thresholds: ThresholdAdjustments
  patterns: Record<string, PatternOverride>
  totalDecisions: number
  driftedDecisions: number
  isDrifting: boolean
  totalTrades: number
  winRate: number
  totalPL: number
  aiName: string | null
  nameStatus: string
}

export interface BoostReport {
  factor: string
  ownValue: number
  collectiveValue: number
  blendedValue: number
  boostDirection: 'reinforced' | 'cautioned' | 'neutral'
  boostMagnitude: number
}

export interface MasterAISynthesis {
  ownerState: MasterAIOwnerState
  collective: CollectiveIntelligence
  contributions: UserContribution[]
  boostReport: BoostReport[]
  lastSyncAt: string
}

const WEIGHT_KEYS: (keyof LearnedWeights)[] = [
  'strengthScore', 'timeScore', 'freshnessScore',
  'trendScore', 'curveScore', 'profitZoneScore',
]

const COLLECTIVE_BLEND_RATIO = 0.3
const MIN_COLLECTIVE_USERS = 1

function calcStdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sqDiffs = values.map(v => (v - mean) ** 2)
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length)
}

function calculateInfluence(totalTrades: number, winRate: number, totalPL: number): number {
  const tradeVolume = Math.min(1.0, totalTrades / 100)
  const performance = winRate >= 0.55 ? 1.5 : winRate >= 0.45 ? 1.0 : 0.5
  const profitability = totalPL > 0 ? 1.2 : totalPL > -100 ? 1.0 : 0.7
  return tradeVolume * performance * profitability
}

export async function synthesizeMasterAI(adminUserId: string): Promise<MasterAISynthesis> {
  const [
    { data: allAdjustments },
    { data: profiles },
    { data: evolutionStates },
    { data: allTrades },
  ] = await Promise.all([
    supabase.from('ai_learned_adjustments').select('*'),
    supabase.from('profiles').select('id, email'),
    supabase.from('ai_evolution_state').select('user_id, ai_name, name_status'),
    supabase.from('simulated_trades').select('user_id, profit_loss, status'),
  ])

  const emailMap = new Map<string, string>()
  for (const p of profiles || []) {
    emailMap.set(p.id, p.email || 'Unknown')
  }

  const evoMap = new Map<string, { ai_name: string | null; name_status: string }>()
  for (const e of evolutionStates || []) {
    evoMap.set(e.user_id, { ai_name: e.ai_name, name_status: e.name_status || 'unearned' })
  }

  const tradeStats = new Map<string, { total: number; wins: number; pl: number }>()
  for (const t of allTrades || []) {
    if (t.status !== 'closed') continue
    const stat = tradeStats.get(t.user_id) || { total: 0, wins: 0, pl: 0 }
    stat.total++
    if ((t.profit_loss || 0) > 0) stat.wins++
    stat.pl += t.profit_loss || 0
    tradeStats.set(t.user_id, stat)
  }

  let ownerAdj: any = null
  const otherAdjustments: any[] = []

  for (const adj of allAdjustments || []) {
    if (adj.user_id === adminUserId) {
      ownerAdj = adj
    } else {
      otherAdjustments.push(adj)
    }
  }

  const ownerStat = tradeStats.get(adminUserId) || { total: 0, wins: 0, pl: 0 }
  const ownerEvo = evoMap.get(adminUserId)

  const ownerState: MasterAIOwnerState = {
    weights: (ownerAdj?.learned_weights || {
      strengthScore: 1.0, timeScore: 1.0, freshnessScore: 1.0,
      trendScore: 1.0, curveScore: 1.0, profitZoneScore: 1.0,
    }) as LearnedWeights,
    thresholds: (ownerAdj?.threshold_adjustments || {
      minOddsScore: 0, minRiskReward: 0, confidenceFloor: 0,
    }) as ThresholdAdjustments,
    patterns: (ownerAdj?.pattern_overrides || {}) as Record<string, PatternOverride>,
    totalDecisions: ownerAdj?.total_decisions || 0,
    driftedDecisions: ownerAdj?.drifted_decisions || 0,
    isDrifting: ownerAdj?.is_drifting || false,
    totalTrades: ownerStat.total,
    winRate: ownerStat.total > 0 ? (ownerStat.wins / ownerStat.total) * 100 : 0,
    totalPL: ownerStat.pl,
    aiName: ownerEvo?.ai_name || null,
    nameStatus: ownerEvo?.name_status || 'unearned',
  }

  const contributions: UserContribution[] = []
  const collectiveWeights: Record<keyof LearnedWeights, number[]> = {
    strengthScore: [], timeScore: [], freshnessScore: [],
    trendScore: [], curveScore: [], profitZoneScore: [],
  }
  const collectiveThresholds: ThresholdAdjustments[] = []
  const collectivePatterns = new Map<string, Array<{ userId: string; email: string; override: PatternOverride }>>()
  const contributionInfluences: number[] = []

  for (const adj of otherAdjustments) {
    const stat = tradeStats.get(adj.user_id) || { total: 0, wins: 0, pl: 0 }
    const evo = evoMap.get(adj.user_id)
    const influence = calculateInfluence(stat.total, stat.total > 0 ? stat.wins / stat.total : 0, stat.pl)

    const weights = (adj.learned_weights || {}) as LearnedWeights
    const thresholds = (adj.threshold_adjustments || {}) as ThresholdAdjustments
    const patterns = (adj.pattern_overrides || {}) as Record<string, PatternOverride>

    contributions.push({
      userId: adj.user_id,
      email: emailMap.get(adj.user_id) || 'Unknown',
      totalTrades: stat.total,
      winRate: stat.total > 0 ? (stat.wins / stat.total) * 100 : 0,
      totalPL: stat.pl,
      weights,
      thresholds,
      patterns,
      patternCount: Object.keys(patterns).length,
      isDrifting: adj.is_drifting || false,
      aiName: evo?.ai_name || null,
      nameStatus: evo?.name_status || 'unearned',
      influence,
      lastUpdated: adj.updated_at || null,
    })

    contributionInfluences.push(influence)

    for (const key of WEIGHT_KEYS) {
      if (weights[key] !== undefined) {
        collectiveWeights[key].push(weights[key])
      }
    }

    collectiveThresholds.push(thresholds)

    for (const [patternKey, override] of Object.entries(patterns)) {
      const existing = collectivePatterns.get(patternKey) || []
      existing.push({ userId: adj.user_id, email: emailMap.get(adj.user_id) || 'Unknown', override })
      collectivePatterns.set(patternKey, existing)
    }
  }

  const synthesizedWeights = {} as LearnedWeights
  const weightConvergence: CollectiveIntelligence['weightConvergence'] = {}

  for (const key of WEIGHT_KEYS) {
    const values = collectiveWeights[key]
    if (values.length === 0) {
      synthesizedWeights[key] = 1.0
      weightConvergence[key] = { mean: 1.0, stdDev: 0, min: 1.0, max: 1.0, agreement: 'strong' }
      continue
    }

    const totalInfluence = contributionInfluences.reduce((s, inf) => s + inf, 0)
    const weightedMean = totalInfluence > 0
      ? values.reduce((s, v, i) => s + v * contributionInfluences[i], 0) / totalInfluence
      : values.reduce((a, b) => a + b, 0) / values.length

    synthesizedWeights[key] = weightedMean

    const stdDev = calcStdDev(values)
    const agreement = stdDev < 0.05 ? 'strong' as const
      : stdDev < 0.15 ? 'moderate' as const
      : 'divergent' as const

    weightConvergence[key] = {
      mean: weightedMean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      agreement,
    }
  }

  const synthesizedThresholds: ThresholdAdjustments = { minOddsScore: 0, minRiskReward: 0, confidenceFloor: 0 }
  if (collectiveThresholds.length > 0) {
    const totalInf = contributionInfluences.reduce((s, inf) => s + inf, 0)
    for (let i = 0; i < collectiveThresholds.length; i++) {
      const weight = totalInf > 0 ? contributionInfluences[i] / totalInf : 1 / collectiveThresholds.length
      synthesizedThresholds.minOddsScore += (collectiveThresholds[i].minOddsScore || 0) * weight
      synthesizedThresholds.minRiskReward += (collectiveThresholds[i].minRiskReward || 0) * weight
      synthesizedThresholds.confidenceFloor += (collectiveThresholds[i].confidenceFloor || 0) * weight
    }
  }

  const synthesizedPatterns: CollectiveIntelligence['synthesizedPatterns'] = {}
  for (const [patternKey, entries] of collectivePatterns) {
    const promotes = entries.filter(e => e.override.action === 'promote')
    const demotes = entries.filter(e => e.override.action === 'demote')

    let consensus: 'promote' | 'demote' | 'mixed' | 'none' = 'none'
    if (promotes.length > 0 && demotes.length === 0) consensus = 'promote'
    else if (demotes.length > 0 && promotes.length === 0) consensus = 'demote'
    else if (promotes.length > 0 && demotes.length > 0) consensus = 'mixed'

    const totalSampleSize = entries.reduce((s, e) => s + e.override.sampleSize, 0)
    const avgWinRate = entries.reduce((s, e) => s + e.override.actualWinRate * e.override.sampleSize, 0) / (totalSampleSize || 1)

    synthesizedPatterns[patternKey] = {
      patternKey,
      consensus,
      avgWinRate,
      totalSampleSize,
      userCount: entries.length,
      details: entries.map(e => ({
        userId: e.userId,
        email: e.email,
        action: e.override.action,
        winRate: e.override.actualWinRate,
        sampleSize: e.override.sampleSize,
      })),
    }
  }

  const convergenceValues = Object.values(weightConvergence)
  const convergenceScore = convergenceValues.length > 0
    ? convergenceValues.reduce((s, c) => {
        if (c.agreement === 'strong') return s + 100
        if (c.agreement === 'moderate') return s + 60
        return s + 20
      }, 0) / convergenceValues.length
    : 0

  const totalTradesAnalyzed = contributions.reduce((s, c) => s + c.totalTrades, 0)

  const collective: CollectiveIntelligence = {
    synthesizedWeights,
    synthesizedThresholds,
    synthesizedPatterns,
    convergenceScore,
    userCount: contributions.length,
    totalTradesAnalyzed,
    weightConvergence,
  }

  const boostReport = generateBoostReport(ownerState, collective)

  return {
    ownerState,
    collective,
    contributions,
    boostReport,
    lastSyncAt: new Date().toISOString(),
  }
}

function generateBoostReport(
  owner: MasterAIOwnerState,
  collective: CollectiveIntelligence
): BoostReport[] {
  if (collective.userCount < MIN_COLLECTIVE_USERS) return []

  return WEIGHT_KEYS.map(key => {
    const ownValue = owner.weights[key]
    const collectiveValue = collective.synthesizedWeights[key]
    const convergence = collective.weightConvergence[key]

    const blendStrength = convergence && convergence.agreement === 'strong'
      ? COLLECTIVE_BLEND_RATIO
      : convergence && convergence.agreement === 'moderate'
        ? COLLECTIVE_BLEND_RATIO * 0.6
        : COLLECTIVE_BLEND_RATIO * 0.2

    const blendedValue = ownValue * (1 - blendStrength) + collectiveValue * blendStrength

    const ownDrift = ownValue - 1.0
    const collectiveDrift = collectiveValue - 1.0
    const sameDirection = (ownDrift > 0 && collectiveDrift > 0) || (ownDrift < 0 && collectiveDrift < 0)

    let boostDirection: BoostReport['boostDirection'] = 'neutral'
    if (Math.abs(ownDrift) > 0.02 && Math.abs(collectiveDrift) > 0.02) {
      boostDirection = sameDirection ? 'reinforced' : 'cautioned'
    }

    return {
      factor: key,
      ownValue,
      collectiveValue,
      blendedValue,
      boostDirection,
      boostMagnitude: Math.abs(blendedValue - ownValue),
    }
  })
}

export async function saveMasterAIState(
  _adminUserId: string,
  synthesis: MasterAISynthesis
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('master_ai_state')
    .select('id')
    .limit(1)
    .maybeSingle()

  const payload = {
    synthesized_weights: synthesis.collective.synthesizedWeights,
    synthesized_thresholds: synthesis.collective.synthesizedThresholds,
    synthesized_patterns: synthesis.collective.synthesizedPatterns,
    user_count: synthesis.collective.userCount,
    total_trades_analyzed: synthesis.collective.totalTradesAnalyzed,
    convergence_score: synthesis.collective.convergenceScore,
    last_synthesis_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await supabase
      .from('master_ai_state')
      .update(payload)
      .eq('id', existing.id)
    return !error
  }

  const { error } = await supabase
    .from('master_ai_state')
    .insert(payload)
  return !error
}

export async function saveSnapshot(
  synthesis: MasterAISynthesis,
  notes: string
): Promise<boolean> {
  const { error } = await supabase
    .from('master_ai_snapshots')
    .insert({
      snapshot_data: {
        ownerState: synthesis.ownerState,
        collective: synthesis.collective,
        boostReport: synthesis.boostReport,
      },
      user_contributions: synthesis.contributions.map(c => ({
        userId: c.userId,
        email: c.email,
        totalTrades: c.totalTrades,
        winRate: c.winRate,
        totalPL: c.totalPL,
        influence: c.influence,
        aiName: c.aiName,
        nameStatus: c.nameStatus,
        isDrifting: c.isDrifting,
      })),
      notes,
    })

  return !error
}

export async function loadSnapshots(): Promise<Array<{
  id: string
  snapshot_data: any
  user_contributions: any[]
  notes: string
  created_at: string
}>> {
  const { data } = await supabase
    .from('master_ai_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  return (data || []) as any
}
