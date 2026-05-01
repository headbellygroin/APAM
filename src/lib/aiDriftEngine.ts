import { supabase } from './supabase'
import { OddsScores } from './strategies/types'

export interface PatternOverride {
  patternKey: string
  sampleSize: number
  actualWinRate: number
  expectedWinRate: number
  action: 'promote' | 'demote' | 'none'
  scoreAdjustment: number
}

export interface LearnedWeights {
  strengthScore: number
  timeScore: number
  freshnessScore: number
  trendScore: number
  curveScore: number
  profitZoneScore: number
}

export interface ThresholdAdjustments {
  minOddsScore: number
  minRiskReward: number
  confidenceFloor: number
}

export interface DriftRollback {
  id: string
  timestamp: number
  type: 'pattern_override' | 'weight_reset' | 'threshold_reset'
  reason: string
  rolledBackFrom: Record<string, any>
  rolledBackTo: Record<string, any>
  triggerMetric: string
}

export interface DriftState {
  patternOverrides: Map<string, PatternOverride>
  learnedWeights: LearnedWeights
  thresholdAdjustments: ThresholdAdjustments
  totalDecisions: number
  driftedDecisions: number
  isDrifting: boolean
  rollbacks: DriftRollback[]
}

export interface DriftDecision {
  drifted: boolean
  reason: string
  originalAction: string
  driftAction: string
  scoreAdjustment: number
}

const MIN_PATTERN_TRADES = 10
const MIN_TRADES_FOR_WEIGHTS = 30
const MIN_TRADES_FOR_THRESHOLDS = 50
const PROMOTE_WIN_RATE = 0.65
const DEMOTE_WIN_RATE = 0.35
const WEIGHT_DRIFT_STEP = 0.1
const MAX_WEIGHT_DRIFT = 0.5
const THRESHOLD_DRIFT_STEP = 0.25
const MAX_THRESHOLD_DRIFT = 1.0
const ROLLBACK_WINDOW = 10
const ROLLBACK_LOSS_RATE = 0.6
const ROLLBACK_WEIGHT_DEGRADATION = 0.15

const BASE_WEIGHTS: LearnedWeights = {
  strengthScore: 1.0,
  timeScore: 1.0,
  freshnessScore: 1.0,
  trendScore: 1.0,
  curveScore: 1.0,
  profitZoneScore: 1.0,
}

interface ScoreCorrelation {
  factor: keyof LearnedWeights
  winCorrelation: number
  sampleSize: number
}

export class AIDriftEngine {
  private state: DriftState = {
    patternOverrides: new Map(),
    learnedWeights: { ...BASE_WEIGHTS },
    thresholdAdjustments: { minOddsScore: 0, minRiskReward: 0, confidenceFloor: 0 },
    totalDecisions: 0,
    driftedDecisions: 0,
    isDrifting: false,
    rollbacks: [],
  }

  private tradeHistory: Array<{
    patternKey: string
    scores: OddsScores
    oddsScore: number
    profitLoss: number
    isWin: boolean
  }> = []

  async loadState(userId: string) {
    const { data } = await supabase
      .from('ai_learned_adjustments')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (data) {
      if (data.pattern_overrides) {
        const overrides = data.pattern_overrides as Record<string, PatternOverride>
        this.state.patternOverrides = new Map(Object.entries(overrides))
      }
      if (data.learned_weights) {
        this.state.learnedWeights = data.learned_weights as LearnedWeights
      }
      if (data.threshold_adjustments) {
        this.state.thresholdAdjustments = data.threshold_adjustments as ThresholdAdjustments
      }
      this.state.totalDecisions = data.total_decisions || 0
      this.state.driftedDecisions = data.drifted_decisions || 0
      this.state.isDrifting = data.is_drifting || false
    }

    const { data: rollbackData } = await supabase
      .from('ai_drift_rollbacks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (rollbackData) {
      this.state.rollbacks = rollbackData.map((r: any) => ({
        id: r.id,
        timestamp: new Date(r.created_at).getTime(),
        type: r.rollback_type,
        reason: r.reason,
        rolledBackFrom: r.rolled_back_from,
        rolledBackTo: r.rolled_back_to,
        triggerMetric: r.trigger_metric,
      }))
    }

    await this.loadTradeHistory(userId)
  }

  private async loadTradeHistory(userId: string) {
    const { data: trades } = await supabase
      .from('simulated_trades')
      .select('profit_loss, ai_recommendations(*)')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .eq('is_ai_recommended', true)
      .order('exit_time', { ascending: false })
      .limit(200)

    if (!trades) return

    this.tradeHistory = []
    for (const trade of trades) {
      const rec = (trade as any).ai_recommendations?.[0]
      if (!rec?.reasoning) continue

      const reasoning = rec.reasoning as { curvePosition: string; trendDirection: string; zoneType: string; scores: OddsScores }
      const patternKey = `${reasoning.curvePosition}-${reasoning.trendDirection}-${reasoning.zoneType}`
      const pl = trade.profit_loss || 0

      this.tradeHistory.push({
        patternKey,
        scores: reasoning.scores || {},
        oddsScore: rec.odds_score || 0,
        profitLoss: pl,
        isWin: pl > 0,
      })
    }
  }

  getState(): DriftState {
    return {
      ...this.state,
      patternOverrides: new Map(this.state.patternOverrides),
    }
  }

  evaluateSetup(
    patternKey: string,
    baseOddsScore: number,
    baseScores: OddsScores,
    baseMinScore: number,
    baseAction: string
  ): DriftDecision {
    const noDrift: DriftDecision = {
      drifted: false,
      reason: '',
      originalAction: baseAction,
      driftAction: baseAction,
      scoreAdjustment: 0,
    }

    if (this.tradeHistory.length < MIN_PATTERN_TRADES) {
      return noDrift
    }

    const patternOverride = this.checkPatternOverride(patternKey, baseOddsScore, baseMinScore, baseAction)
    if (patternOverride.drifted) {
      this.state.driftedDecisions++
      this.state.totalDecisions++
      this.state.isDrifting = true
      return patternOverride
    }

    if (this.tradeHistory.length >= MIN_TRADES_FOR_WEIGHTS) {
      const weightAdjustedScore = this.applyLearnedWeights(baseScores)
      const scoreDiff = weightAdjustedScore - baseOddsScore

      if (Math.abs(scoreDiff) >= 0.5) {
        const adjustedScore = baseOddsScore + scoreDiff

        if (baseOddsScore < baseMinScore && adjustedScore >= baseMinScore) {
          this.state.driftedDecisions++
          this.state.totalDecisions++
          this.state.isDrifting = true
          return {
            drifted: true,
            reason: `Weight learning promotes setup: base ${baseOddsScore.toFixed(1)} adjusted to ${adjustedScore.toFixed(1)}`,
            originalAction: 'no_action',
            driftAction: baseAction,
            scoreAdjustment: scoreDiff,
          }
        }

        if (baseOddsScore >= baseMinScore && adjustedScore < baseMinScore) {
          this.state.driftedDecisions++
          this.state.totalDecisions++
          this.state.isDrifting = true
          return {
            drifted: true,
            reason: `Weight learning demotes setup: base ${baseOddsScore.toFixed(1)} adjusted to ${adjustedScore.toFixed(1)}`,
            originalAction: baseAction,
            driftAction: 'no_action',
            scoreAdjustment: scoreDiff,
          }
        }
      }
    }

    if (this.tradeHistory.length >= MIN_TRADES_FOR_THRESHOLDS) {
      const thresholdAdj = this.state.thresholdAdjustments
      const effectiveMinScore = baseMinScore + thresholdAdj.minOddsScore

      if (baseOddsScore >= baseMinScore && baseOddsScore < effectiveMinScore) {
        this.state.driftedDecisions++
        this.state.totalDecisions++
        this.state.isDrifting = true
        return {
          drifted: true,
          reason: `Threshold raised: effective min score ${effectiveMinScore.toFixed(1)} (base ${baseMinScore})`,
          originalAction: baseAction,
          driftAction: 'no_action',
          scoreAdjustment: 0,
        }
      }

      if (baseOddsScore < baseMinScore && baseOddsScore >= (baseMinScore + thresholdAdj.minOddsScore) && thresholdAdj.minOddsScore < 0) {
        this.state.driftedDecisions++
        this.state.totalDecisions++
        this.state.isDrifting = true
        return {
          drifted: true,
          reason: `Threshold lowered: effective min score ${effectiveMinScore.toFixed(1)} (base ${baseMinScore})`,
          originalAction: 'no_action',
          driftAction: baseAction,
          scoreAdjustment: 0,
        }
      }
    }

    this.state.totalDecisions++
    return noDrift
  }

  private checkPatternOverride(
    patternKey: string,
    baseOddsScore: number,
    baseMinScore: number,
    baseAction: string
  ): DriftDecision {
    const noDrift: DriftDecision = {
      drifted: false,
      reason: '',
      originalAction: baseAction,
      driftAction: baseAction,
      scoreAdjustment: 0,
    }

    const patternTrades = this.tradeHistory.filter(t => t.patternKey === patternKey)
    if (patternTrades.length < MIN_PATTERN_TRADES) return noDrift

    const wins = patternTrades.filter(t => t.isWin).length
    const winRate = wins / patternTrades.length

    const override: PatternOverride = {
      patternKey,
      sampleSize: patternTrades.length,
      actualWinRate: winRate,
      expectedWinRate: 0.5,
      action: 'none',
      scoreAdjustment: 0,
    }

    if (winRate >= PROMOTE_WIN_RATE && baseOddsScore < baseMinScore && baseOddsScore >= (baseMinScore - 1.5)) {
      const boost = Math.min(2.0, (winRate - 0.5) * 4)
      override.action = 'promote'
      override.scoreAdjustment = boost
      this.state.patternOverrides.set(patternKey, override)

      return {
        drifted: true,
        reason: `Pattern ${patternKey} wins ${(winRate * 100).toFixed(0)}% over ${patternTrades.length} trades - promoting despite base score ${baseOddsScore.toFixed(1)}`,
        originalAction: 'no_action',
        driftAction: baseAction,
        scoreAdjustment: boost,
      }
    }

    if (winRate <= DEMOTE_WIN_RATE && baseOddsScore >= baseMinScore) {
      const penalty = Math.min(2.0, (0.5 - winRate) * 4)
      override.action = 'demote'
      override.scoreAdjustment = -penalty
      this.state.patternOverrides.set(patternKey, override)

      return {
        drifted: true,
        reason: `Pattern ${patternKey} wins only ${(winRate * 100).toFixed(0)}% over ${patternTrades.length} trades - demoting despite base score ${baseOddsScore.toFixed(1)}`,
        originalAction: baseAction,
        driftAction: 'no_action',
        scoreAdjustment: -penalty,
      }
    }

    return noDrift
  }

  private applyLearnedWeights(baseScores: OddsScores): number {
    const weights = this.state.learnedWeights
    let total = 0

    const scoreKeys: (keyof LearnedWeights)[] = [
      'strengthScore', 'timeScore', 'freshnessScore',
      'trendScore', 'curveScore', 'profitZoneScore',
    ]

    for (const key of scoreKeys) {
      const baseValue = baseScores[key] || 0
      total += baseValue * weights[key]
    }

    return total
  }

  recalculateWeights() {
    if (this.tradeHistory.length < MIN_TRADES_FOR_WEIGHTS) return

    const correlations = this.calculateScoreCorrelations()

    for (const corr of correlations) {
      const currentWeight = this.state.learnedWeights[corr.factor]

      if (corr.winCorrelation > 0.1 && corr.sampleSize >= 10) {
        const increase = Math.min(WEIGHT_DRIFT_STEP, corr.winCorrelation * 0.2)
        this.state.learnedWeights[corr.factor] = Math.min(
          1.0 + MAX_WEIGHT_DRIFT,
          currentWeight + increase
        )
      } else if (corr.winCorrelation < -0.1 && corr.sampleSize >= 10) {
        const decrease = Math.min(WEIGHT_DRIFT_STEP, Math.abs(corr.winCorrelation) * 0.2)
        this.state.learnedWeights[corr.factor] = Math.max(
          1.0 - MAX_WEIGHT_DRIFT,
          currentWeight - decrease
        )
      }
    }
  }

  recalculateThresholds() {
    if (this.tradeHistory.length < MIN_TRADES_FOR_THRESHOLDS) return

    const recentTrades = this.tradeHistory.slice(0, 50)
    const wins = recentTrades.filter(t => t.isWin)
    const losses = recentTrades.filter(t => !t.isWin)

    if (wins.length === 0 || losses.length === 0) return

    const avgWinScore = wins.reduce((s, t) => s + t.oddsScore, 0) / wins.length
    const avgLossScore = losses.reduce((s, t) => s + t.oddsScore, 0) / losses.length

    if (avgLossScore > avgWinScore - 0.5) {
      const bump = Math.min(THRESHOLD_DRIFT_STEP, (avgLossScore - avgWinScore + 1) * 0.25)
      this.state.thresholdAdjustments.minOddsScore = Math.min(
        MAX_THRESHOLD_DRIFT,
        this.state.thresholdAdjustments.minOddsScore + bump
      )
    } else if (avgWinScore - avgLossScore > 2) {
      const drop = Math.min(THRESHOLD_DRIFT_STEP, 0.1)
      this.state.thresholdAdjustments.minOddsScore = Math.max(
        -MAX_THRESHOLD_DRIFT,
        this.state.thresholdAdjustments.minOddsScore - drop
      )
    }
  }

  private calculateScoreCorrelations(): ScoreCorrelation[] {
    const factors: (keyof LearnedWeights)[] = [
      'strengthScore', 'timeScore', 'freshnessScore',
      'trendScore', 'curveScore', 'profitZoneScore',
    ]

    return factors.map(factor => {
      const tradesWithFactor = this.tradeHistory.filter(t => t.scores[factor] !== undefined)

      if (tradesWithFactor.length < 10) {
        return { factor, winCorrelation: 0, sampleSize: tradesWithFactor.length }
      }

      const highScoreTrades = tradesWithFactor.filter(t => (t.scores[factor] || 0) > 1)
      const lowScoreTrades = tradesWithFactor.filter(t => (t.scores[factor] || 0) <= 0.5)

      const highWinRate = highScoreTrades.length > 0
        ? highScoreTrades.filter(t => t.isWin).length / highScoreTrades.length
        : 0.5
      const lowWinRate = lowScoreTrades.length > 0
        ? lowScoreTrades.filter(t => t.isWin).length / lowScoreTrades.length
        : 0.5

      return {
        factor,
        winCorrelation: highWinRate - lowWinRate,
        sampleSize: tradesWithFactor.length,
      }
    })
  }

  async saveState(userId: string) {
    const overridesObj: Record<string, PatternOverride> = {}
    this.state.patternOverrides.forEach((v, k) => { overridesObj[k] = v })

    await supabase
      .from('ai_learned_adjustments')
      .upsert({
        user_id: userId,
        pattern_overrides: overridesObj,
        learned_weights: this.state.learnedWeights,
        threshold_adjustments: this.state.thresholdAdjustments,
        total_decisions: this.state.totalDecisions,
        drifted_decisions: this.state.driftedDecisions,
        is_drifting: this.state.isDrifting,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    const unsavedRollbacks = this.state.rollbacks.filter(r => !r.id.includes('-saved'))
    if (unsavedRollbacks.length > 0) {
      const rows = unsavedRollbacks.map(r => ({
        user_id: userId,
        rollback_type: r.type,
        reason: r.reason,
        rolled_back_from: r.rolledBackFrom,
        rolled_back_to: r.rolledBackTo,
        trigger_metric: r.triggerMetric,
      }))

      const { data: inserted } = await supabase
        .from('ai_drift_rollbacks')
        .insert(rows)
        .select('id')

      if (inserted) {
        for (let i = 0; i < unsavedRollbacks.length && i < inserted.length; i++) {
          unsavedRollbacks[i].id = inserted[i].id + '-saved'
        }
      }
    }
  }

  onTradeCompleted(
    patternKey: string,
    scores: OddsScores,
    oddsScore: number,
    profitLoss: number
  ) {
    this.tradeHistory.unshift({
      patternKey,
      scores,
      oddsScore,
      profitLoss,
      isWin: profitLoss > 0,
    })

    if (this.tradeHistory.length > 200) {
      this.tradeHistory = this.tradeHistory.slice(0, 200)
    }

    this.evaluateRollbacks()
    this.recalculateWeights()
    this.recalculateThresholds()
  }

  private evaluateRollbacks() {
    if (this.tradeHistory.length < ROLLBACK_WINDOW) return

    const recentTrades = this.tradeHistory.slice(0, ROLLBACK_WINDOW)
    const recentLossRate = recentTrades.filter(t => !t.isWin).length / recentTrades.length

    this.rollbackPatternOverrides(recentTrades)

    if (recentLossRate >= ROLLBACK_LOSS_RATE && this.state.isDrifting) {
      this.rollbackWeights(recentLossRate)
      this.rollbackThresholds(recentLossRate)
    }
  }

  private rollbackPatternOverrides(recentTrades: typeof this.tradeHistory) {
    const overridesToRemove: string[] = []

    for (const [patternKey, override] of this.state.patternOverrides) {
      const patternRecent = recentTrades.filter(t => t.patternKey === patternKey)
      if (patternRecent.length < 3) continue

      const patternLossRate = patternRecent.filter(t => !t.isWin).length / patternRecent.length

      if (override.action === 'promote' && patternLossRate >= ROLLBACK_LOSS_RATE) {
        overridesToRemove.push(patternKey)
        this.state.rollbacks.push({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'pattern_override',
          reason: `Promoted pattern "${patternKey}" lost ${(patternLossRate * 100).toFixed(0)}% of last ${patternRecent.length} trades - rolling back to baseline`,
          rolledBackFrom: { action: 'promote', scoreAdjustment: override.scoreAdjustment, winRate: override.actualWinRate },
          rolledBackTo: { action: 'none', scoreAdjustment: 0 },
          triggerMetric: `${(patternLossRate * 100).toFixed(0)}% loss rate over ${patternRecent.length} trades`,
        })
      }

      if (override.action === 'demote') {
        const patternWinRate = patternRecent.filter(t => t.isWin).length / patternRecent.length
        if (patternWinRate >= PROMOTE_WIN_RATE) {
          overridesToRemove.push(patternKey)
          this.state.rollbacks.push({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: 'pattern_override',
            reason: `Demoted pattern "${patternKey}" now winning ${(patternWinRate * 100).toFixed(0)}% - rolling back demotion`,
            rolledBackFrom: { action: 'demote', scoreAdjustment: override.scoreAdjustment },
            rolledBackTo: { action: 'none', scoreAdjustment: 0 },
            triggerMetric: `${(patternWinRate * 100).toFixed(0)}% win rate over ${patternRecent.length} trades`,
          })
        }
      }
    }

    for (const key of overridesToRemove) {
      this.state.patternOverrides.delete(key)
    }
  }

  private rollbackWeights(recentLossRate: number) {
    const factors: (keyof LearnedWeights)[] = [
      'strengthScore', 'timeScore', 'freshnessScore',
      'trendScore', 'curveScore', 'profitZoneScore',
    ]

    let anyRolledBack = false
    const rolledFrom: Record<string, number> = {}
    const rolledTo: Record<string, number> = {}

    for (const factor of factors) {
      const drift = Math.abs(this.state.learnedWeights[factor] - 1.0)
      if (drift > ROLLBACK_WEIGHT_DEGRADATION) {
        rolledFrom[factor] = this.state.learnedWeights[factor]
        this.state.learnedWeights[factor] = 1.0 + (this.state.learnedWeights[factor] - 1.0) * 0.5
        rolledTo[factor] = this.state.learnedWeights[factor]
        anyRolledBack = true
      }
    }

    if (anyRolledBack) {
      this.state.rollbacks.push({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'weight_reset',
        reason: `Recent loss rate ${(recentLossRate * 100).toFixed(0)}% - halving weight drift toward baseline`,
        rolledBackFrom: rolledFrom,
        rolledBackTo: rolledTo,
        triggerMetric: `${(recentLossRate * 100).toFixed(0)}% loss rate over last ${ROLLBACK_WINDOW} trades`,
      })
    }
  }

  private rollbackThresholds(recentLossRate: number) {
    const adj = this.state.thresholdAdjustments
    if (adj.minOddsScore === 0 && adj.minRiskReward === 0) return

    const from = { ...adj }
    this.state.thresholdAdjustments = {
      minOddsScore: adj.minOddsScore * 0.5,
      minRiskReward: adj.minRiskReward * 0.5,
      confidenceFloor: adj.confidenceFloor * 0.5,
    }

    this.state.rollbacks.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'threshold_reset',
      reason: `Recent loss rate ${(recentLossRate * 100).toFixed(0)}% - halving threshold drift toward baseline`,
      rolledBackFrom: from,
      rolledBackTo: { ...this.state.thresholdAdjustments },
      triggerMetric: `${(recentLossRate * 100).toFixed(0)}% loss rate over last ${ROLLBACK_WINDOW} trades`,
    })

    if (this.state.patternOverrides.size === 0 &&
        Math.abs(this.state.thresholdAdjustments.minOddsScore) < 0.1 &&
        Object.values(this.state.learnedWeights).every(w => Math.abs(w - 1.0) < 0.05)) {
      this.state.isDrifting = false
    }
  }

  getRollbacks(): DriftRollback[] {
    return [...this.state.rollbacks]
  }

  getActiveRules(): Array<{
    type: 'pattern_override' | 'weight_adjustment' | 'threshold_shift'
    description: string
    detail: Record<string, any>
    confidence: string
  }> {
    const rules: Array<{
      type: 'pattern_override' | 'weight_adjustment' | 'threshold_shift'
      description: string
      detail: Record<string, any>
      confidence: string
    }> = []

    for (const [key, override] of this.state.patternOverrides) {
      if (override.action === 'none') continue
      rules.push({
        type: 'pattern_override',
        description: override.action === 'promote'
          ? `Promote pattern "${key}" (base score below threshold) because it wins ${(override.actualWinRate * 100).toFixed(0)}% over ${override.sampleSize} trades`
          : `Demote pattern "${key}" (base score above threshold) because it wins only ${(override.actualWinRate * 100).toFixed(0)}% over ${override.sampleSize} trades`,
        detail: { ...override },
        confidence: override.sampleSize >= 30 ? 'high' : override.sampleSize >= 15 ? 'medium' : 'low',
      })
    }

    const factors: (keyof LearnedWeights)[] = [
      'strengthScore', 'timeScore', 'freshnessScore',
      'trendScore', 'curveScore', 'profitZoneScore',
    ]
    for (const factor of factors) {
      const weight = this.state.learnedWeights[factor]
      if (Math.abs(weight - 1.0) < 0.05) continue

      const direction = weight > 1.0 ? 'increased' : 'decreased'
      const pct = ((weight - 1.0) * 100).toFixed(0)
      rules.push({
        type: 'weight_adjustment',
        description: `${factor.replace('Score', '')} weight ${direction} by ${Math.abs(Number(pct))}% -- ${weight > 1.0 ? 'this factor correlates with winning trades' : 'this factor correlates with losing trades'}`,
        detail: { factor, weight, baseWeight: 1.0, drift: weight - 1.0 },
        confidence: this.tradeHistory.length >= 50 ? 'high' : 'medium',
      })
    }

    const thresh = this.state.thresholdAdjustments
    if (Math.abs(thresh.minOddsScore) >= 0.1) {
      rules.push({
        type: 'threshold_shift',
        description: thresh.minOddsScore > 0
          ? `Minimum score raised by ${thresh.minOddsScore.toFixed(2)} -- losing trades cluster near the base threshold`
          : `Minimum score lowered by ${Math.abs(thresh.minOddsScore).toFixed(2)} -- winning trades found below base threshold`,
        detail: { shift: thresh.minOddsScore },
        confidence: this.tradeHistory.length >= 50 ? 'high' : 'medium',
      })
    }

    return rules
  }

  getDriftSummary(): {
    isDrifting: boolean
    driftPercent: number
    totalDecisions: number
    activeOverrides: number
    weightChanges: Array<{ factor: string; direction: 'up' | 'down' | 'neutral'; magnitude: number }>
    thresholdShift: number
    totalRollbacks: number
    recentRollbacks: DriftRollback[]
  } {
    const weightChanges = (Object.entries(this.state.learnedWeights) as [keyof LearnedWeights, number][]).map(([factor, weight]) => ({
      factor,
      direction: weight > 1.02 ? 'up' as const : weight < 0.98 ? 'down' as const : 'neutral' as const,
      magnitude: Math.abs(weight - 1.0),
    }))

    return {
      isDrifting: this.state.isDrifting,
      driftPercent: this.state.totalDecisions > 0
        ? (this.state.driftedDecisions / this.state.totalDecisions) * 100
        : 0,
      totalDecisions: this.state.totalDecisions,
      activeOverrides: this.state.patternOverrides.size,
      weightChanges,
      thresholdShift: this.state.thresholdAdjustments.minOddsScore,
      totalRollbacks: this.state.rollbacks.length,
      recentRollbacks: this.state.rollbacks.slice(-5),
    }
  }
}

export const driftEngine = new AIDriftEngine()
