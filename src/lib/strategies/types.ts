import { Candle } from '../marketData'

export type CurvePosition = 'high' | 'middle' | 'low'
export type TrendDirection = 'uptrend' | 'downtrend' | 'sideways'
export type ZoneType = 'supply' | 'demand'
export type TradeAction = 'long' | 'short' | 'long_advanced' | 'short_advanced' | 'no_action'
export type EntryType = 'high_conviction' | 'standard' | 'reduced_size' | 'no_trade'
export type StrategyType = 'base' | 'overlay'
export type OverlayAction = 'confirm' | 'neutral' | 'conflict' | 'veto'

export interface Zone {
  type: ZoneType
  high: number
  low: number
  strength: number
  timestamp?: number
  barAge?: number
  volumeRatio?: number
  gapInvalidated?: boolean
  baseCandles?: number
  tested?: boolean
}

export interface MarketConditions {
  curvePosition: CurvePosition
  trendDirection: TrendDirection
  zones: Zone[]
  currentPrice: number
  atr: number
}

export interface OddsScores {
  strengthScore: number
  timeScore: number
  freshnessScore: number
  trendScore: number
  curveScore: number
  profitZoneScore: number
  [key: string]: number
}

export interface TradeSetup {
  action: TradeAction
  entryPrice: number
  stopLoss: number
  targetPrice: number
  riskRewardRatio: number
  oddsScore: number
  entryType: EntryType
  scores: OddsScores
}

export interface StrategyConfig {
  id: string
  name: string
  description: string
  version: string
  author?: string
  type: StrategyType
  minOddsScore: number
  defaultRiskPercent: number
  maxPositions?: number
}

export interface TradingStrategy {
  config: StrategyConfig

  analyzeCurvePosition(candles: Candle[]): CurvePosition
  analyzeTrend(candles: Candle[]): TrendDirection
  detectZones(candles: Candle[]): Zone[]

  getDecisionAction(conditions: MarketConditions): TradeAction
  calculateOddsScore(conditions: MarketConditions, zone: Zone): OddsScores
  calculateEntryExit(conditions: MarketConditions, zone: Zone, action: TradeAction): {
    entryPrice: number
    stopLoss: number
    targetPrice: number
  }
  getEntryType(oddsScore: number): EntryType

  generateSetup(candles: Candle[], currentPrice: number): TradeSetup | null
}

export interface StrategyGuide {
  title: string
  sections: Array<{
    heading: string
    content: string
    rules?: string[]
  }>
}

export interface OverlayAnalysis {
  overlayId: string
  action: OverlayAction
  oddsAdjustment: number
  reasoning: string
  confidence: number
}

export interface BlendedSignal {
  baseSignal: TradeSetup
  overlayResults: OverlayAnalysis[]
  finalOddsScore: number
  finalAction: TradeAction
  blendingExplanation: string
}

export interface OverlayStrategy extends TradingStrategy {
  analyzeOverlay(baseSignal: TradeSetup, candles: Candle[]): OverlayAnalysis
}
