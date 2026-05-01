import { supabase } from './supabase'
import { trainingAccountService, TrainingAccount, CreateAccountParams } from './trainingAccountService'
import { LearnedWeights, ThresholdAdjustments, PatternOverride } from './aiDriftEngine'
import { recordSpawnLineage, recordPromotionLineage } from './lineageService'
import { detectAnomalies, saveAnomalies, UserTradeAnomaly } from './realWorldEvents'
import { runDiscoveryForAllAccounts } from './patternDiscovery'
import { getSimulationRuns } from './historicalFleetService'

const MAX_SPAWNED_ACCOUNTS = 5
const MIN_TRADES_FOR_RANKING = 10
const MIN_TRADES_FOR_EVOLUTION = 100
const MIN_DRIFT_PCT_FOR_EVOLUTION = 15
const MIN_OUTPERFORMANCE_FOR_EVOLUTION = 10
const MIN_TRADES_FOR_PROMOTION = 50
const MIN_OUTPERFORMANCE_FOR_PROMOTION = 5
const TOP_N = 3
const BOTTOM_N = 3

export interface MasterNameTier {
  tier: number
  minAvgWinRate: number
  minAvgProfitFactor: number
  minTotalAccountTrades: number
  minSustainedDays: number
  maxAvgDrawdown: number
  nameLength: number
  title: string
  description: string
}

export const MASTER_NAME_TIERS: MasterNameTier[] = [
  {
    tier: 0, minAvgWinRate: 0, minAvgProfitFactor: 0, minTotalAccountTrades: 0,
    minSustainedDays: 0, maxAvgDrawdown: 100, nameLength: 0,
    title: 'Unranked', description: 'No name earned yet. The Master observes.',
  },
  {
    tier: 1, minAvgWinRate: 58, minAvgProfitFactor: 1.3, minTotalAccountTrades: 200,
    minSustainedDays: 7, maxAvgDrawdown: 20, nameLength: 3,
    title: 'Initiate', description: 'Avg 58%+ win rate across accounts, 200+ total trades, 7 days sustained.',
  },
  {
    tier: 2, minAvgWinRate: 62, minAvgProfitFactor: 1.6, minTotalAccountTrades: 500,
    minSustainedDays: 14, maxAvgDrawdown: 15, nameLength: 5,
    title: 'Strategist', description: 'Avg 62%+ win rate, 500+ trades, 14 days sustained, <15% avg drawdown.',
  },
  {
    tier: 3, minAvgWinRate: 66, minAvgProfitFactor: 1.8, minTotalAccountTrades: 1000,
    minSustainedDays: 30, maxAvgDrawdown: 10, nameLength: 8,
    title: 'Architect', description: 'Avg 66%+ win rate, 1000+ trades, 30 days sustained, <10% avg drawdown.',
  },
  {
    tier: 4, minAvgWinRate: 70, minAvgProfitFactor: 2.0, minTotalAccountTrades: 2500,
    minSustainedDays: 60, maxAvgDrawdown: 7, nameLength: 12,
    title: 'Grandmaster', description: 'Avg 70%+ win rate, 2500+ trades, 60 days sustained, <7% avg drawdown.',
  },
  {
    tier: 5, minAvgWinRate: 75, minAvgProfitFactor: 2.5, minTotalAccountTrades: 5000,
    minSustainedDays: 90, maxAvgDrawdown: 5, nameLength: 20,
    title: 'Sovereign', description: 'Avg 75%+ win rate, 5000+ trades, 90 days sustained, <5% avg drawdown. Legendary.',
  },
]

export interface AccountRanking {
  id: string
  name: string
  rank: number
  score: number
  win_rate: number
  profit_factor: number
  total_profit_loss: number
  total_trades: number
  max_drawdown: number
  mode: string
  strategy_id: string
  is_spawned: boolean
  fleet: 'base' | 'spawned'
  drift_pct: number
  generation: number
}

export interface SpawnRecommendation {
  sourceAccountIds: string[]
  sourceNames: string[]
  hybridWeights: LearnedWeights
  hybridThresholds: ThresholdAdjustments
  hybridPatterns: Record<string, PatternOverride>
  suggestedName: string
  suggestedStrategy: string
  reason: string
  generation: number
}

export interface RetireRecommendation {
  accountId: string
  accountName: string
  reason: string
  win_rate: number
  total_profit_loss: number
}

export interface EvolutionCandidate {
  accountId: string
  accountName: string
  strategyId: string
  driftPct: number
  winRate: number
  profitFactor: number
  totalTrades: number
  totalPL: number
  outperformancePct: number
  weights: LearnedWeights
  thresholds: ThresholdAdjustments
  patterns: Record<string, PatternOverride>
  generation: number
}

export interface PromotionRecommendation {
  spawnedAccountId: string
  spawnedAccountName: string
  spawnedWinRate: number
  spawnedProfitFactor: number
  spawnedTotalPL: number
  spawnedTotalTrades: number
  spawnedGeneration: number
  baseAccountId: string
  baseAccountName: string
  baseWinRate: number
  baseTotalPL: number
  outperformancePct: number
  reason: string
}

export interface EvolvedRuleset {
  id: string
  name: string
  parentStrategyId: string
  sourceAccountId: string
  generation: number
  learnedWeights: LearnedWeights
  thresholdAdjustments: ThresholdAdjustments
  patternOverrides: Record<string, PatternOverride>
  performanceAtCreation: Record<string, number>
  minTradesObserved: number
  driftPercentage: number
  outperformancePct: number
  status: 'candidate' | 'active' | 'retired' | 'superseded'
  isRegistered: boolean
  createdAt: string
}

export interface EODReview {
  reviewDate: string
  baseFleetRankings: AccountRanking[]
  spawnedFleetRankings: AccountRanking[]
  topPerformers: AccountRanking[]
  bottomSpawned: AccountRanking[]
  spawnRecommendations: SpawnRecommendation[]
  retireRecommendations: RetireRecommendation[]
  promotionRecommendations: PromotionRecommendation[]
  evolutionCandidates: EvolutionCandidate[]
  masterNameTier: number
  masterName: string | null
  nextDayNotes: string
  rotationAdvice: string
  userTradeAnomalies: UserTradeAnomaly[]
  anomalySummary: string
  patternDiscoverySummary: string
  historicalFleetSummary: string
}

function scoreAccount(account: TrainingAccount): number {
  if (account.total_trades < MIN_TRADES_FOR_RANKING) return -9999

  const winRateScore = account.win_rate * 2
  const pfScore = Math.min(account.profit_factor, 5) * 10
  const plScore = account.total_profit_loss > 0
    ? Math.log(account.total_profit_loss + 1) * 5
    : account.total_profit_loss * 0.1
  const drawdownPenalty = account.max_drawdown * -0.5
  const tradeBonus = Math.min(account.total_trades / 50, 10)

  return winRateScore + pfScore + plScore + drawdownPenalty + tradeBonus
}

function getDriftPct(account: TrainingAccount): number {
  if (account.total_decisions <= 0) return 0
  return (account.drift_decisions / account.total_decisions) * 100
}

function blendWeights(accounts: TrainingAccount[]): LearnedWeights {
  const result: LearnedWeights = {
    strengthScore: 0, timeScore: 0, freshnessScore: 0,
    trendScore: 0, curveScore: 0, profitZoneScore: 0,
  }
  if (accounts.length === 0) return result

  const scores = accounts.map(a => scoreAccount(a))
  const totalScore = scores.reduce((s, v) => s + Math.max(v, 0.01), 0)
  const keys: (keyof LearnedWeights)[] = [
    'strengthScore', 'timeScore', 'freshnessScore',
    'trendScore', 'curveScore', 'profitZoneScore',
  ]

  for (let i = 0; i < accounts.length; i++) {
    const weight = Math.max(scores[i], 0.01) / totalScore
    const aw = accounts[i].learned_weights || {
      strengthScore: 1, timeScore: 1, freshnessScore: 1,
      trendScore: 1, curveScore: 1, profitZoneScore: 1,
    }
    for (const key of keys) {
      result[key] += (aw[key] || 1) * weight
    }
  }
  return result
}

function blendThresholds(accounts: TrainingAccount[]): ThresholdAdjustments {
  if (accounts.length === 0) return { minOddsScore: 0, minRiskReward: 0, confidenceFloor: 0 }

  const scores = accounts.map(a => scoreAccount(a))
  const totalScore = scores.reduce((s, v) => s + Math.max(v, 0.01), 0)
  let minOdds = 0, minRR = 0, confFloor = 0

  for (let i = 0; i < accounts.length; i++) {
    const weight = Math.max(scores[i], 0.01) / totalScore
    const t = accounts[i].threshold_adjustments || { minOddsScore: 0, minRiskReward: 0, confidenceFloor: 0 }
    minOdds += (t.minOddsScore || 0) * weight
    minRR += (t.minRiskReward || 0) * weight
    confFloor += (t.confidenceFloor || 0) * weight
  }
  return { minOddsScore: minOdds, minRiskReward: minRR, confidenceFloor: confFloor }
}

function blendPatterns(accounts: TrainingAccount[]): Record<string, PatternOverride> {
  const allKeys = new Set<string>()
  for (const a of accounts) {
    for (const key of Object.keys(a.pattern_overrides || {})) {
      allKeys.add(key)
    }
  }

  const result: Record<string, PatternOverride> = {}
  for (const key of allKeys) {
    const overrides = accounts
      .map(a => (a.pattern_overrides || {})[key])
      .filter(Boolean)

    if (overrides.length === 0) continue

    const avgWinRate = overrides.reduce((s, o) => s + o.actualWinRate, 0) / overrides.length
    const totalSample = overrides.reduce((s, o) => s + o.sampleSize, 0)
    const promotes = overrides.filter(o => o.action === 'promote').length
    const demotes = overrides.filter(o => o.action === 'demote').length

    result[key] = {
      patternKey: key,
      sampleSize: totalSample,
      actualWinRate: avgWinRate,
      expectedWinRate: overrides[0].expectedWinRate,
      action: promotes >= demotes ? 'promote' : 'demote',
      scoreAdjustment: overrides.reduce((s, o) => s + o.scoreAdjustment, 0) / overrides.length,
    }
  }
  return result
}

export async function getSpawnedCount(userId: string): Promise<number> {
  const { data } = await supabase
    .from('ai_training_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('spawned_by_master', true)
    .neq('status', 'stopped')

  return data?.length || 0
}

function splitFleets(accounts: TrainingAccount[]): {
  baseFleet: TrainingAccount[]
  spawnedFleet: TrainingAccount[]
} {
  const baseFleet = accounts.filter(a => !a.spawned_by_master)
  const spawnedFleet = accounts.filter(a => a.spawned_by_master)
  return { baseFleet, spawnedFleet }
}

function rankAccounts(accounts: TrainingAccount[], fleet: 'base' | 'spawned'): AccountRanking[] {
  return accounts
    .filter(a => a.total_trades >= MIN_TRADES_FOR_RANKING)
    .map(a => ({
      id: a.id,
      name: a.name,
      rank: 0,
      score: scoreAccount(a),
      win_rate: a.win_rate,
      profit_factor: a.profit_factor,
      total_profit_loss: a.total_profit_loss,
      total_trades: a.total_trades,
      max_drawdown: a.max_drawdown,
      mode: a.mode,
      strategy_id: a.strategy_id,
      is_spawned: a.spawned_by_master,
      fleet,
      drift_pct: getDriftPct(a),
      generation: a.generation || 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

function findEvolutionCandidates(
  spawnedFleet: TrainingAccount[],
  baseFleet: TrainingAccount[]
): EvolutionCandidate[] {
  const candidates: EvolutionCandidate[] = []

  for (const account of spawnedFleet) {
    if (account.total_trades < MIN_TRADES_FOR_EVOLUTION) continue
    if (account.mode !== 'adaptive') continue

    const driftPct = getDriftPct(account)
    if (driftPct < MIN_DRIFT_PCT_FOR_EVOLUTION) continue

    const sameStrategyBase = baseFleet.filter(
      b => b.strategy_id === account.strategy_id && b.mode === 'strict' && b.total_trades >= MIN_TRADES_FOR_RANKING
    )
    if (sameStrategyBase.length === 0) continue

    const avgBaseWR = sameStrategyBase.reduce((s, b) => s + b.win_rate, 0) / sameStrategyBase.length
    const outperformance = account.win_rate - avgBaseWR

    if (outperformance < MIN_OUTPERFORMANCE_FOR_EVOLUTION) continue

    candidates.push({
      accountId: account.id,
      accountName: account.name,
      strategyId: account.strategy_id,
      driftPct,
      winRate: account.win_rate,
      profitFactor: account.profit_factor,
      totalTrades: account.total_trades,
      totalPL: account.total_profit_loss,
      outperformancePct: outperformance,
      weights: account.learned_weights,
      thresholds: account.threshold_adjustments,
      patterns: account.pattern_overrides || {},
      generation: (account.generation || 0) + 1,
    })
  }

  return candidates.sort((a, b) => b.outperformancePct - a.outperformancePct)
}

function findPromotionCandidates(
  spawnedFleet: TrainingAccount[],
  baseFleet: TrainingAccount[]
): PromotionRecommendation[] {
  const recommendations: PromotionRecommendation[] = []

  const eligibleBase = baseFleet.filter(
    b => b.mode === 'adaptive' && b.status !== 'stopped' && b.total_trades >= MIN_TRADES_FOR_RANKING
  )
  if (eligibleBase.length === 0) return []

  const eligibleSpawned = spawnedFleet.filter(
    s => s.status !== 'stopped' && s.total_trades >= MIN_TRADES_FOR_PROMOTION
  )

  for (const spawned of eligibleSpawned) {
    const spawnedScore = scoreAccount(spawned)

    const weakerBase = eligibleBase
      .filter(b => {
        const baseScore = scoreAccount(b)
        const outperformance = spawned.win_rate - b.win_rate
        return spawnedScore > baseScore && outperformance >= MIN_OUTPERFORMANCE_FOR_PROMOTION
      })
      .sort((a, b) => scoreAccount(a) - scoreAccount(b))

    if (weakerBase.length === 0) continue

    const weakest = weakerBase[0]
    const outperformance = spawned.win_rate - weakest.win_rate

    recommendations.push({
      spawnedAccountId: spawned.id,
      spawnedAccountName: spawned.name,
      spawnedWinRate: spawned.win_rate,
      spawnedProfitFactor: spawned.profit_factor,
      spawnedTotalPL: spawned.total_profit_loss,
      spawnedTotalTrades: spawned.total_trades,
      spawnedGeneration: spawned.generation || 0,
      baseAccountId: weakest.id,
      baseAccountName: weakest.name,
      baseWinRate: weakest.win_rate,
      baseTotalPL: weakest.total_profit_loss,
      outperformancePct: outperformance,
      reason: `${spawned.name} (${spawned.win_rate.toFixed(1)}% WR, $${spawned.total_profit_loss.toFixed(0)}) outperforms base account ${weakest.name} (${weakest.win_rate.toFixed(1)}% WR, $${weakest.total_profit_loss.toFixed(0)}) by +${outperformance.toFixed(1)}% over ${spawned.total_trades} trades`,
    })
  }

  return recommendations.sort((a, b) => b.outperformancePct - a.outperformancePct)
}

function generateRotationAdvice(
  spawnedRankings: AccountRanking[],
  spawnedCount: number,
  baseRankings: AccountRanking[],
  promotions: PromotionRecommendation[] = []
): string {
  if (spawnedRankings.length === 0 && spawnedCount === 0) {
    return 'No spawned accounts yet. Run a review to get spawn recommendations based on your base fleet performance.'
  }
  if (spawnedRankings.length === 0) {
    return 'Spawned accounts have not accumulated enough trades to rank yet. Let them learn.'
  }

  const lines: string[] = []
  const avgSpawnedWR = spawnedRankings.reduce((s, r) => s + r.win_rate, 0) / spawnedRankings.length
  const avgBaseWR = baseRankings.length > 0
    ? baseRankings.reduce((s, r) => s + r.win_rate, 0) / baseRankings.length
    : 0

  if (baseRankings.length > 0) {
    const spread = avgSpawnedWR - avgBaseWR
    if (spread > 3) {
      lines.push(`Spawned fleet outperforming base by +${spread.toFixed(1)}% WR. Rotation not urgent -- let winners keep learning.`)
    } else if (spread < -3) {
      lines.push(`Spawned fleet trailing base by ${spread.toFixed(1)}% WR. Consider rotating underperformers.`)
    } else {
      lines.push('Spawned fleet performing inline with base fleet. Monitor for emerging separation.')
    }
  }

  const underperformers = spawnedRankings.filter(r => r.win_rate < 45)
  if (underperformers.length > 0) {
    lines.push(`${underperformers.length} spawned account(s) below 45% WR -- candidates for retirement.`)
  }

  const drifters = spawnedRankings.filter(r => r.drift_pct > 25 && r.win_rate > 55)
  if (drifters.length > 0) {
    lines.push(`${drifters.length} spawned account(s) drifting >25% with good results -- potential ruleset evolution candidates.`)
  }

  if (promotions.length > 0) {
    lines.push(`${promotions.length} hybrid(s) ready to promote into base fleet, replacing weaker drift accounts. This frees spawn slots for better hybrids.`)
  }

  if (spawnedCount >= MAX_SPAWNED_ACCOUNTS) {
    if (promotions.length > 0) {
      lines.push(`At max capacity (${MAX_SPAWNED_ACCOUNTS}). Promoting hybrids to base fleet will free slots for new spawns.`)
    } else {
      lines.push(`At max capacity (${MAX_SPAWNED_ACCOUNTS}). Must retire before spawning new accounts.`)
    }
  } else {
    lines.push(`${MAX_SPAWNED_ACCOUNTS - spawnedCount} spawn slot(s) available.`)
  }

  return lines.join('\n')
}

export async function runEndOfDayReview(userId: string): Promise<EODReview> {
  const accounts = await trainingAccountService.getAccounts(userId)
  const { baseFleet, spawnedFleet } = splitFleets(accounts)

  const baseFleetRankings = rankAccounts(baseFleet, 'base')
  const spawnedFleetRankings = rankAccounts(spawnedFleet, 'spawned')

  const allRankings = [...baseFleetRankings, ...spawnedFleetRankings]
    .sort((a, b) => b.score - a.score)
  const topPerformers = allRankings.slice(0, TOP_N)

  const bottomSpawned = [...spawnedFleetRankings]
    .sort((a, b) => a.score - b.score)
    .slice(0, BOTTOM_N)

  const spawnedCount = spawnedFleet.filter(a => a.status !== 'stopped').length
  const slotsAvailable = MAX_SPAWNED_ACCOUNTS - spawnedCount

  const spawnRecommendations: SpawnRecommendation[] = []
  if (slotsAvailable > 0 && baseFleetRankings.length >= 2) {
    const topBaseAccounts = baseFleet
      .filter(a => a.total_trades >= MIN_TRADES_FOR_RANKING)
      .sort((a, b) => scoreAccount(b) - scoreAccount(a))
      .slice(0, 3)

    if (topBaseAccounts.length >= 2) {
      for (let i = 0; i < Math.min(slotsAvailable, 1); i++) {
        const sources = topBaseAccounts.slice(0, 2 + i)
        const hybridWeights = blendWeights(sources)
        const hybridThresholds = blendThresholds(sources)
        const hybridPatterns = blendPatterns(sources)
        const parentNames = sources.map(a => a.name)
        const maxGen = Math.max(...sources.map(a => a.generation || 0))

        spawnRecommendations.push({
          sourceAccountIds: sources.map(a => a.id),
          sourceNames: parentNames,
          hybridWeights,
          hybridThresholds,
          hybridPatterns,
          suggestedName: `Hybrid Gen${maxGen + 1} [${parentNames.map(n => n.slice(0, 6)).join('+')}]`,
          suggestedStrategy: sources[0].strategy_id,
          reason: `Blending top base fleet performers: ${parentNames.join(' + ')} (avg WR: ${(sources.reduce((s, a) => s + a.win_rate, 0) / sources.length).toFixed(1)}%)`,
          generation: maxGen + 1,
        })
      }
    }
  }

  const retireRecommendations: RetireRecommendation[] = []
  if (slotsAvailable <= 0 && bottomSpawned.length > 0) {
    const worst = bottomSpawned[0]
    if (worst.win_rate < 50 || worst.total_profit_loss < 0) {
      retireRecommendations.push({
        accountId: worst.id,
        accountName: worst.name,
        reason: `Lowest-ranked spawned account (rank #${worst.rank}, ${worst.win_rate.toFixed(1)}% WR, $${worst.total_profit_loss.toFixed(0)} P&L)`,
        win_rate: worst.win_rate,
        total_profit_loss: worst.total_profit_loss,
      })
    }
  }

  const promotionRecommendations = findPromotionCandidates(spawnedFleet, baseFleet)
  const evolutionCandidates = findEvolutionCandidates(spawnedFleet, baseFleet)
  const masterTierResult = evaluateMasterTier(spawnedFleet)
  const rotationAdvice = generateRotationAdvice(spawnedFleetRankings, spawnedCount, baseFleetRankings, promotionRecommendations)
  const nextDayNotes = generateNextDayNotes(baseFleetRankings, spawnedFleetRankings, topPerformers)

  let userTradeAnomalies: UserTradeAnomaly[] = []
  let anomalySummary = ''
  try {
    userTradeAnomalies = await detectAnomalies(userId)
    if (userTradeAnomalies.length > 0) {
      await saveAnomalies(userTradeAnomalies)
      const clusters = userTradeAnomalies.filter(a => a.anomaly_type === 'unexplained_cluster')
      const counterSignals = userTradeAnomalies.filter(a => a.anomaly_type === 'counter_signal')
      const newSymbols = userTradeAnomalies.filter(a => a.anomaly_type === 'new_symbol')
      const lines: string[] = []
      if (clusters.length > 0) {
        lines.push(`${clusters.length} cluster(s): multiple users independently traded ${clusters.map(c => c.symbol).join(', ')}`)
      }
      if (counterSignals.length > 0) {
        lines.push(`${counterSignals.length} counter-signal trade(s): users went opposite to AI on ${counterSignals.map(c => c.symbol).join(', ')}`)
      }
      if (newSymbols.length > 0) {
        lines.push(`${newSymbols.length} new symbol(s) not in AI watchlist: ${newSymbols.map(c => c.symbol).join(', ')}`)
      }
      anomalySummary = lines.join('\n')
    }
  } catch {
    anomalySummary = 'Anomaly detection encountered an error'
  }

  let patternDiscoverySummary = ''
  try {
    const discovery = await runDiscoveryForAllAccounts(userId)
    if (discovery.observationsFound > 0) {
      const lines: string[] = []
      lines.push(`Scanned ${discovery.accountsScanned} account(s): found ${discovery.observationsFound} pattern(s)`)
      if (discovery.newCandidates > 0) {
        lines.push(`${discovery.newCandidates} new candidate(s) met significance threshold -- review in Pattern Discovery`)
      }
      lines.push(`${discovery.observationsSaved} observation(s) saved/updated`)
      patternDiscoverySummary = lines.join('\n')
    }
  } catch {
    patternDiscoverySummary = 'Pattern discovery encountered an error'
  }

  let historicalFleetSummary = ''
  try {
    const historicalRuns = await getSimulationRuns(userId)
    const completedRuns = historicalRuns.filter(r => r.status === 'completed' && r.results_summary?.comparison)
    const runningRuns = historicalRuns.filter(r => r.status === 'running')

    if (completedRuns.length > 0 || runningRuns.length > 0) {
      const lines: string[] = []
      if (runningRuns.length > 0) {
        lines.push(`${runningRuns.length} historical simulation(s) currently running`)
      }
      if (completedRuns.length > 0) {
        lines.push(`${completedRuns.length} completed historical run(s):`)
        for (const run of completedRuns.slice(0, 3)) {
          const comp = run.results_summary.comparison
          const wrDiff = comp.winRateDiff || 0
          lines.push(`  ${run.name}: ${wrDiff > 0 ? '+' : ''}${wrDiff.toFixed(1)}% WR diff (${comp.verdict})`)
        }
      }
      historicalFleetSummary = lines.join('\n')
    }
  } catch {
    historicalFleetSummary = 'Historical fleet check encountered an error'
  }

  const review: EODReview = {
    reviewDate: new Date().toISOString().split('T')[0],
    baseFleetRankings,
    spawnedFleetRankings,
    topPerformers,
    bottomSpawned,
    spawnRecommendations,
    retireRecommendations,
    promotionRecommendations,
    evolutionCandidates,
    masterNameTier: masterTierResult.tier,
    masterName: masterTierResult.name,
    nextDayNotes,
    rotationAdvice,
    userTradeAnomalies,
    anomalySummary,
    patternDiscoverySummary,
    historicalFleetSummary,
  }

  await supabase.from('master_ai_eod_reviews').upsert(
    {
      user_id: userId,
      review_date: review.reviewDate,
      account_rankings: [...baseFleetRankings, ...spawnedFleetRankings],
      top_performers: review.topPerformers,
      bottom_performers: review.bottomSpawned,
      actions_taken: [],
      spawn_recommendation: review.spawnRecommendations[0] || null,
      retire_recommendation: review.retireRecommendations[0] || null,
      next_day_notes: review.nextDayNotes,
      master_name_tier: review.masterNameTier,
      master_name: review.masterName,
      full_review: review as unknown as Record<string, unknown>,
    },
    { onConflict: 'user_id,review_date' }
  )

  return review
}

/** Latest saved review with full payload (for restoring UI across sessions). */
export async function getLatestSavedEODReview(userId: string): Promise<EODReview | null> {
  const { data } = await supabase
    .from('master_ai_eod_reviews')
    .select('full_review, review_date')
    .eq('user_id', userId)
    .not('full_review', 'is', null)
    .order('review_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.full_review) return null
  return data.full_review as EODReview
}

/** Whether an EOD row already exists for this calendar review date (YYYY-MM-DD). */
export async function hasEODReviewForDate(userId: string, reviewDate: string): Promise<boolean> {
  const { data } = await supabase
    .from('master_ai_eod_reviews')
    .select('id')
    .eq('user_id', userId)
    .eq('review_date', reviewDate)
    .maybeSingle()

  return !!data
}

export async function executeSpawn(
  userId: string,
  recommendation: SpawnRecommendation
): Promise<TrainingAccount | null> {
  const spawnedCount = await getSpawnedCount(userId)
  if (spawnedCount >= MAX_SPAWNED_ACCOUNTS) return null

  const params: CreateAccountParams = {
    name: recommendation.suggestedName,
    strategyId: recommendation.suggestedStrategy,
    mode: 'adaptive',
    startingCapital: 25000,
    riskPerTrade: 1,
    maxPositions: 3,
    scanIntervalSeconds: 15 * 60,
  }

  const account = await trainingAccountService.createAccount(userId, params)
  if (!account) return null

  await supabase
    .from('ai_training_accounts')
    .update({
      spawned_by_master: true,
      parent_account_ids: recommendation.sourceAccountIds,
      generation: recommendation.generation,
      learned_weights: recommendation.hybridWeights,
      threshold_adjustments: recommendation.hybridThresholds,
      pattern_overrides: recommendation.hybridPatterns,
      origin_type: 'master_spawned',
    })
    .eq('id', account.id)

  await supabase.from('master_ai_spawn_log').insert({
    user_id: userId,
    action: 'spawn',
    source_account_ids: recommendation.sourceAccountIds,
    spawned_account_id: account.id,
    hybrid_config: {
      weights: recommendation.hybridWeights,
      thresholds: recommendation.hybridThresholds,
      patterns: recommendation.hybridPatterns,
    },
    reason: recommendation.reason,
  })

  const parentAccounts = await Promise.all(
    recommendation.sourceAccountIds.map(id => trainingAccountService.getAccount(id))
  )
  const validParents = parentAccounts.filter((a): a is TrainingAccount => a !== null)
  if (validParents.length > 0) {
    await recordSpawnLineage(userId, account.id, validParents, recommendation.generation)
  }

  return account
}

export async function executeRetire(
  userId: string,
  recommendation: RetireRecommendation
): Promise<boolean> {
  await trainingAccountService.updateStatus(recommendation.accountId, 'stopped')

  await supabase.from('master_ai_spawn_log').insert({
    user_id: userId,
    action: 'retire',
    retired_account_id: recommendation.accountId,
    reason: recommendation.reason,
  })

  return true
}

export async function executePromotion(
  userId: string,
  recommendation: PromotionRecommendation
): Promise<boolean> {
  await trainingAccountService.updateStatus(recommendation.baseAccountId, 'stopped')

  await supabase
    .from('ai_training_accounts')
    .update({
      spawned_by_master: false,
      promoted_from_spawned: true,
      replaced_account_id: recommendation.baseAccountId,
      origin_type: 'promoted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', recommendation.spawnedAccountId)

  await supabase.from('master_ai_spawn_log').insert({
    user_id: userId,
    action: 'promote',
    source_account_ids: [recommendation.spawnedAccountId],
    retired_account_id: recommendation.baseAccountId,
    hybrid_config: {
      promotedAccount: recommendation.spawnedAccountName,
      replacedAccount: recommendation.baseAccountName,
      outperformance: recommendation.outperformancePct,
      generation: recommendation.spawnedGeneration,
    },
    reason: recommendation.reason,
  })

  const [promotedAcct, replacedAcct] = await Promise.all([
    trainingAccountService.getAccount(recommendation.spawnedAccountId),
    trainingAccountService.getAccount(recommendation.baseAccountId),
  ])
  if (promotedAcct && replacedAcct) {
    await recordPromotionLineage(userId, recommendation.spawnedAccountId, replacedAcct, promotedAcct)
  }

  return true
}

export async function codifyEvolution(
  userId: string,
  candidate: EvolutionCandidate,
  name: string
): Promise<EvolvedRuleset | null> {
  const { data, error } = await supabase
    .from('evolved_rulesets')
    .insert({
      user_id: userId,
      name,
      parent_strategy_id: candidate.strategyId,
      source_account_id: candidate.accountId,
      generation: candidate.generation,
      learned_weights: candidate.weights,
      threshold_adjustments: candidate.thresholds,
      pattern_overrides: candidate.patterns,
      performance_at_creation: {
        winRate: candidate.winRate,
        profitFactor: candidate.profitFactor,
        totalTrades: candidate.totalTrades,
        totalPL: candidate.totalPL,
      },
      min_trades_observed: candidate.totalTrades,
      drift_percentage: candidate.driftPct,
      outperformance_pct: candidate.outperformancePct,
      status: 'candidate',
    })
    .select()
    .single()

  if (error) return null

  await supabase.from('master_ai_spawn_log').insert({
    user_id: userId,
    action: 'evolve',
    source_account_ids: [candidate.accountId],
    hybrid_config: {
      weights: candidate.weights,
      thresholds: candidate.thresholds,
      patterns: candidate.patterns,
      rulesetName: name,
    },
    reason: `Codified drift from ${candidate.accountName} -- ${candidate.driftPct.toFixed(1)}% drift, +${candidate.outperformancePct.toFixed(1)}% outperformance over ${candidate.totalTrades} trades`,
  })

  return mapRuleset(data)
}

export async function activateRuleset(rulesetId: string): Promise<boolean> {
  const { error } = await supabase
    .from('evolved_rulesets')
    .update({ status: 'active', is_registered: true, updated_at: new Date().toISOString() })
    .eq('id', rulesetId)

  return !error
}

export async function retireRuleset(rulesetId: string): Promise<boolean> {
  const { error } = await supabase
    .from('evolved_rulesets')
    .update({ status: 'retired', is_registered: false, updated_at: new Date().toISOString() })
    .eq('id', rulesetId)

  return !error
}

export async function getEvolvedRulesets(userId: string): Promise<EvolvedRuleset[]> {
  const { data } = await supabase
    .from('evolved_rulesets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (data || []).map(mapRuleset)
}

function mapRuleset(row: any): EvolvedRuleset {
  return {
    id: row.id,
    name: row.name,
    parentStrategyId: row.parent_strategy_id,
    sourceAccountId: row.source_account_id,
    generation: row.generation,
    learnedWeights: row.learned_weights as LearnedWeights,
    thresholdAdjustments: row.threshold_adjustments as ThresholdAdjustments,
    patternOverrides: row.pattern_overrides as Record<string, PatternOverride>,
    performanceAtCreation: row.performance_at_creation as Record<string, number>,
    minTradesObserved: row.min_trades_observed,
    driftPercentage: Number(row.drift_percentage),
    outperformancePct: Number(row.outperformance_pct),
    status: row.status,
    isRegistered: row.is_registered,
    createdAt: row.created_at,
  }
}

interface MasterTierResult {
  tier: number
  name: string | null
  tierInfo: MasterNameTier
  progress: {
    avgWinRate: number
    avgProfitFactor: number
    totalAccountTrades: number
    avgDrawdown: number
    sustainedDays: number
  }
}

function evaluateMasterTier(spawnedFleet: TrainingAccount[]): MasterTierResult {
  const active = spawnedFleet.filter(a => a.total_trades >= MIN_TRADES_FOR_RANKING && a.status !== 'stopped')

  const avgWinRate = active.length > 0
    ? active.reduce((s, a) => s + a.win_rate, 0) / active.length : 0
  const avgProfitFactor = active.length > 0
    ? active.reduce((s, a) => s + Math.min(a.profit_factor, 10), 0) / active.length : 0
  const totalTrades = active.reduce((s, a) => s + a.total_trades, 0)
  const avgDrawdown = active.length > 0
    ? active.reduce((s, a) => s + a.max_drawdown, 0) / active.length : 100

  const oldestAccount = active.length > 0
    ? active.reduce((oldest, a) => {
        const created = new Date(a.created_at).getTime()
        return created < oldest ? created : oldest
      }, Date.now())
    : Date.now()
  const sustainedDays = Math.floor((Date.now() - oldestAccount) / (1000 * 60 * 60 * 24))

  const progress = { avgWinRate, avgProfitFactor, totalAccountTrades: totalTrades, avgDrawdown, sustainedDays }

  let achievedTier = 0
  for (const tier of MASTER_NAME_TIERS) {
    if (
      avgWinRate >= tier.minAvgWinRate &&
      avgProfitFactor >= tier.minAvgProfitFactor &&
      totalTrades >= tier.minTotalAccountTrades &&
      sustainedDays >= tier.minSustainedDays &&
      avgDrawdown <= tier.maxAvgDrawdown
    ) {
      achievedTier = tier.tier
    }
  }

  return {
    tier: achievedTier,
    name: null,
    tierInfo: MASTER_NAME_TIERS[achievedTier],
    progress,
  }
}

export function getMasterTierProgress(accounts: TrainingAccount[]): MasterTierResult {
  const { spawnedFleet } = splitFleets(accounts)
  return evaluateMasterTier(spawnedFleet)
}

export async function getEODReviews(userId: string, limit: number = 10): Promise<any[]> {
  const { data } = await supabase
    .from('master_ai_eod_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('review_date', { ascending: false })
    .limit(limit)

  return data || []
}

export async function getSpawnLog(userId: string, limit: number = 20): Promise<any[]> {
  const { data } = await supabase
    .from('master_ai_spawn_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return data || []
}

function generateNextDayNotes(
  baseRankings: AccountRanking[],
  spawnedRankings: AccountRanking[],
  topOverall: AccountRanking[]
): string {
  const lines: string[] = []

  if (baseRankings.length === 0 && spawnedRankings.length === 0) {
    return 'No accounts with sufficient trade history to review yet.'
  }

  if (baseRankings.length > 0) {
    const avgBaseWR = baseRankings.reduce((s, r) => s + r.win_rate, 0) / baseRankings.length
    lines.push(`Base fleet (${baseRankings.length} ranked): avg ${avgBaseWR.toFixed(1)}% WR`)
  }

  if (spawnedRankings.length > 0) {
    const avgSpawnedWR = spawnedRankings.reduce((s, r) => s + r.win_rate, 0) / spawnedRankings.length
    lines.push(`Spawned fleet (${spawnedRankings.length} ranked): avg ${avgSpawnedWR.toFixed(1)}% WR`)
  }

  if (topOverall.length > 0) {
    lines.push(`Top overall: ${topOverall[0].name} (${topOverall[0].win_rate.toFixed(1)}% WR, $${topOverall[0].total_profit_loss.toFixed(0)} P&L) [${topOverall[0].fleet}]`)
  }

  const strictBase = baseRankings.filter(r => r.mode === 'strict')
  const adaptiveBase = baseRankings.filter(r => r.mode === 'adaptive')
  if (strictBase.length > 0 && adaptiveBase.length > 0) {
    const sAvg = strictBase.reduce((s, r) => s + r.win_rate, 0) / strictBase.length
    const aAvg = adaptiveBase.reduce((s, r) => s + r.win_rate, 0) / adaptiveBase.length
    const diff = aAvg - sAvg
    if (Math.abs(diff) > 2) {
      lines.push(`Base fleet drift spread: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}% -- ${diff > 0 ? 'adaptive adding value' : 'strict outperforming drift'}`)
    }
  }

  const driftingWinners = spawnedRankings.filter(r => r.drift_pct > 20 && r.win_rate > 55)
  if (driftingWinners.length > 0) {
    lines.push(`${driftingWinners.length} spawned account(s) showing promising drift (>20% deviation, >55% WR)`)
  }

  return lines.join('\n')
}
