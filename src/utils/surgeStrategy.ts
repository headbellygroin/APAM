export type { CurvePosition, TrendDirection, ZoneType, TradeAction, OddsScores } from '@/lib/strategies/types'

export interface OddsEnhancerScores {
  strengthScore: number
  timeScore: number
  freshnessScore: number
  trendScore: number
  curveScore: number
  profitZoneScore: number
}

export interface DecisionMatrixInput {
  curvePosition: 'high' | 'middle' | 'low'
  trendDirection: 'uptrend' | 'downtrend' | 'sideways'
  zoneType: 'supply' | 'demand'
}

export function calculateOddsEnhancerScore(scores: OddsEnhancerScores): number {
  const {
    strengthScore,
    timeScore,
    freshnessScore,
    trendScore,
    curveScore,
    profitZoneScore,
  } = scores

  return strengthScore + timeScore + freshnessScore + trendScore + curveScore + profitZoneScore
}

export function getEntryRecommendation(oddsScore: number): string {
  if (oddsScore >= 8.5) return 'high_conviction'
  if (oddsScore >= 7) return 'standard'
  if (oddsScore >= 6) return 'reduced_size'
  return 'no_trade'
}

export function calculateRiskRewardRatio(
  entryPrice: number,
  stopLoss: number,
  targetPrice: number
): number {
  const risk = Math.abs(entryPrice - stopLoss)
  const reward = Math.abs(targetPrice - entryPrice)
  return risk > 0 ? reward / risk : 0
}

export function calculatePositionSize(
  accountBalance: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number
): number {
  const riskAmount = accountBalance * (riskPercent / 100)
  const riskPerShare = Math.abs(entryPrice - stopLoss)
  return riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0
}

export function getDecisionMatrixAction(input: DecisionMatrixInput): 'long' | 'short' | 'long_advanced' | 'short_advanced' | 'no_action' {
  const { curvePosition, trendDirection, zoneType } = input

  if (zoneType === 'demand') {
    if (curvePosition === 'low') {
      if (trendDirection === 'uptrend') return 'long'
      if (trendDirection === 'sideways') return 'long_advanced'
      return 'no_action'
    }
    if (curvePosition === 'middle') {
      if (trendDirection === 'uptrend') return 'long_advanced'
      return 'no_action'
    }
    return 'no_action'
  }

  if (zoneType === 'supply') {
    if (curvePosition === 'high') {
      if (trendDirection === 'downtrend') return 'short'
      if (trendDirection === 'sideways') return 'short_advanced'
      return 'no_action'
    }
    if (curvePosition === 'middle') {
      if (trendDirection === 'downtrend') return 'short_advanced'
      return 'no_action'
    }
    return 'no_action'
  }

  return 'no_action'
}

export function getProfitZoneScore(rrRatio: number): number {
  if (rrRatio >= 2.5) return 2
  if (rrRatio >= 2) return 1
  return 0
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export const DECISION_MATRIX = {
  demand: {
    low: {
      uptrend: { action: 'long', quality: 'high' },
      sideways: { action: 'long_advanced', quality: 'medium' },
      downtrend: { action: 'no_action', quality: 'none' },
    },
    middle: {
      uptrend: { action: 'long_advanced', quality: 'medium' },
      sideways: { action: 'no_action', quality: 'none' },
      downtrend: { action: 'no_action', quality: 'none' },
    },
    high: {
      uptrend: { action: 'no_action', quality: 'none' },
      sideways: { action: 'no_action', quality: 'none' },
      downtrend: { action: 'no_action', quality: 'none' },
    },
  },
  supply: {
    high: {
      downtrend: { action: 'short', quality: 'high' },
      sideways: { action: 'short_advanced', quality: 'medium' },
      uptrend: { action: 'no_action', quality: 'none' },
    },
    middle: {
      downtrend: { action: 'short_advanced', quality: 'medium' },
      sideways: { action: 'no_action', quality: 'none' },
      uptrend: { action: 'no_action', quality: 'none' },
    },
    low: {
      downtrend: { action: 'no_action', quality: 'none' },
      sideways: { action: 'no_action', quality: 'none' },
      uptrend: { action: 'no_action', quality: 'none' },
    },
  },
}
