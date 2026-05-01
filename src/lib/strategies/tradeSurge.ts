import { Candle } from '../marketData'
import {
  TradingStrategy,
  StrategyConfig,
  StrategyGuide,
  CurvePosition,
  TrendDirection,
  ZoneType,
  Zone,
  TradeAction,
  EntryType,
  MarketConditions,
  OddsScores,
  TradeSetup,
} from './types'

const DECISION_MATRIX: Record<ZoneType, Record<CurvePosition, Record<TrendDirection, TradeAction>>> = {
  demand: {
    low: {
      uptrend: 'long',
      sideways: 'long_advanced',
      downtrend: 'no_action',
    },
    middle: {
      uptrend: 'long_advanced',
      sideways: 'no_action',
      downtrend: 'no_action',
    },
    high: {
      uptrend: 'no_action',
      sideways: 'no_action',
      downtrend: 'no_action',
    },
  },
  supply: {
    high: {
      downtrend: 'short',
      sideways: 'short_advanced',
      uptrend: 'no_action',
    },
    middle: {
      downtrend: 'short_advanced',
      sideways: 'no_action',
      uptrend: 'no_action',
    },
    low: {
      downtrend: 'no_action',
      sideways: 'no_action',
      uptrend: 'no_action',
    },
  },
}

export const tradeSurgeGuide: StrategyGuide = {
  title: 'Trade Surge Strategy Guide',
  sections: [
    {
      heading: 'Core Concept',
      content: 'Trade Surge focuses on supply and demand zones combined with curve position and trend alignment for high-probability entries.',
    },
    {
      heading: 'Curve Position',
      content: 'Identifies where price is relative to recent trading range.',
      rules: [
        'LOW (< 30%): Price near bottom of range - look for demand zones',
        'MIDDLE (30-70%): Neutral zone - requires additional confluence',
        'HIGH (> 70%): Price near top of range - look for supply zones',
      ],
    },
    {
      heading: 'Decision Matrix',
      content: 'Combines curve position, trend direction, and zone type.',
      rules: [
        'LONG: Low curve + Uptrend + Demand zone',
        'SHORT: High curve + Downtrend + Supply zone',
        'Advanced entries allowed with sideways trend',
        'No action when conditions conflict',
      ],
    },
    {
      heading: 'Odds Enhancer Scoring',
      content: 'Score 0-10 based on multiple factors.',
      rules: [
        'Strength (0-2): Zone formation quality',
        'Time (0-2): Time at zone before breakout',
        'Freshness (0-2): First touch scores highest',
        'Trend (0-2): Alignment with bigger picture',
        'Curve (0-1): Position on the curve',
        'Profit Zone (0-2): Risk/reward ratio',
      ],
    },
    {
      heading: 'Entry Rules',
      content: 'Position sizing based on odds score.',
      rules: [
        '8.5-10: High Conviction - Full position',
        '7-8.5: Standard Entry - Normal position',
        '6-7: Reduced Size - Half position',
        'Below 6: No Trade',
      ],
    },
  ],
}

export class TradeSurgeStrategy implements TradingStrategy {
  config: StrategyConfig = {
    id: 'trade-surge',
    name: 'Trade Surge',
    description: 'Supply/demand zones with curve position and trend alignment',
    version: '1.0.0',
    author: 'Trade Surge',
    type: 'base',
    minOddsScore: 6,
    defaultRiskPercent: 1,
    maxPositions: 5,
  }

  analyzeCurvePosition(candles: Candle[]): CurvePosition {
    if (candles.length < 50) return 'middle'

    const recentCandles = candles.slice(-20)
    const longerCandles = candles.slice(-50)

    const recentAvg = recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length
    const max = Math.max(...longerCandles.map(c => c.high))
    const min = Math.min(...longerCandles.map(c => c.low))

    const range = max - min
    if (range === 0) return 'middle'

    const position = (recentAvg - min) / range

    if (position > 0.7) return 'high'
    if (position < 0.3) return 'low'
    return 'middle'
  }

  analyzeTrend(candles: Candle[]): TrendDirection {
    if (candles.length < 20) return 'sideways'

    const prices = candles.slice(-20).map(c => c.close)
    const firstHalf = prices.slice(0, 10)
    const secondHalf = prices.slice(10)

    const firstAvg = firstHalf.reduce((sum, p) => sum + p, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, p) => sum + p, 0) / secondHalf.length

    const change = ((secondAvg - firstAvg) / firstAvg) * 100

    if (change > 2) return 'uptrend'
    if (change < -2) return 'downtrend'
    return 'sideways'
  }

  detectZones(candles: Candle[]): Zone[] {
    if (candles.length < 50) return []

    const zones: Zone[] = []
    const recentCandles = candles.slice(-50)

    for (let i = 5; i < recentCandles.length - 5; i++) {
      const current = recentCandles[i]
      const before = recentCandles.slice(i - 5, i)
      const after = recentCandles.slice(i + 1, i + 6)

      const isBottom = before.every(c => c.low > current.low) && after.every(c => c.low > current.low)
      const isTop = before.every(c => c.high < current.high) && after.every(c => c.high < current.high)

      if (isBottom) {
        const moveOut = after.some(c => c.close > current.high * 1.02)
        zones.push({
          type: 'demand',
          high: current.high,
          low: current.low * 0.998,
          strength: moveOut ? 2 : 1,
          timestamp: current.timestamp,
        })
      }

      if (isTop) {
        const moveOut = after.some(c => c.close < current.low * 0.98)
        zones.push({
          type: 'supply',
          high: current.high * 1.002,
          low: current.low,
          strength: moveOut ? 2 : 1,
          timestamp: current.timestamp,
        })
      }
    }

    return zones.slice(-5)
  }

  getDecisionAction(conditions: MarketConditions): TradeAction {
    const { curvePosition, trendDirection, zones, currentPrice } = conditions

    if (zones.length === 0) return 'no_action'

    const nearestZone = zones.reduce((nearest, zone) => {
      const distToCurrent = Math.abs((zone.high + zone.low) / 2 - currentPrice)
      const distToNearest = Math.abs((nearest.high + nearest.low) / 2 - currentPrice)
      return distToCurrent < distToNearest ? zone : nearest
    }, zones[0])

    return DECISION_MATRIX[nearestZone.type]?.[curvePosition]?.[trendDirection] || 'no_action'
  }

  calculateOddsScore(conditions: MarketConditions, zone: Zone): OddsScores {
    const { trendDirection, curvePosition } = conditions

    const strengthScore = zone.strength
    const timeScore = 1
    const freshnessScore = 2

    const trendScore =
      (trendDirection === 'uptrend' && zone.type === 'demand') ||
      (trendDirection === 'downtrend' && zone.type === 'supply')
        ? 2
        : 0

    const curveScore =
      (curvePosition === 'low' && zone.type === 'demand') ||
      (curvePosition === 'high' && zone.type === 'supply')
        ? 1
        : 0.5

    const entryExit = this.calculateEntryExit(conditions, zone, 'long')
    const rr = Math.abs(entryExit.targetPrice - entryExit.entryPrice) /
               Math.abs(entryExit.entryPrice - entryExit.stopLoss)

    const profitZoneScore = rr >= 2.5 ? 2 : rr >= 2 ? 1 : 0

    return {
      strengthScore,
      timeScore,
      freshnessScore,
      trendScore,
      curveScore,
      profitZoneScore,
    }
  }

  calculateEntryExit(conditions: MarketConditions, zone: Zone, action: TradeAction): {
    entryPrice: number
    stopLoss: number
    targetPrice: number
  } {
    const { atr } = conditions
    const isLong = action === 'long' || action === 'long_advanced'

    if (isLong) {
      return {
        entryPrice: zone.high,
        stopLoss: zone.low * 0.995,
        targetPrice: zone.high + (atr * 3),
      }
    } else {
      return {
        entryPrice: zone.low,
        stopLoss: zone.high * 1.005,
        targetPrice: zone.low - (atr * 3),
      }
    }
  }

  getEntryType(oddsScore: number): EntryType {
    if (oddsScore >= 8.5) return 'high_conviction'
    if (oddsScore >= 7) return 'standard'
    if (oddsScore >= 6) return 'reduced_size'
    return 'no_trade'
  }

  generateSetup(candles: Candle[], currentPrice: number): TradeSetup | null {
    if (candles.length < 50) return null

    const curvePosition = this.analyzeCurvePosition(candles)
    const trendDirection = this.analyzeTrend(candles)
    const zones = this.detectZones(candles)

    if (zones.length === 0) return null

    const atr = this.calculateATR(candles.slice(-14))

    const conditions: MarketConditions = {
      curvePosition,
      trendDirection,
      zones,
      currentPrice,
      atr,
    }

    const action = this.getDecisionAction(conditions)
    if (action === 'no_action') return null

    const nearestZone = zones.reduce((nearest, zone) => {
      const distToCurrent = Math.abs((zone.high + zone.low) / 2 - currentPrice)
      const distToNearest = Math.abs((nearest.high + nearest.low) / 2 - currentPrice)
      return distToCurrent < distToNearest ? zone : nearest
    }, zones[0])

    const scores = this.calculateOddsScore(conditions, nearestZone)
    const oddsScore = Object.values(scores).reduce((sum, s) => sum + s, 0)

    const entryType = this.getEntryType(oddsScore)
    if (entryType === 'no_trade') return null

    const entryExit = this.calculateEntryExit(conditions, nearestZone, action)
    const riskRewardRatio = Math.abs(entryExit.targetPrice - entryExit.entryPrice) /
                           Math.abs(entryExit.entryPrice - entryExit.stopLoss)

    return {
      action,
      entryPrice: entryExit.entryPrice,
      stopLoss: entryExit.stopLoss,
      targetPrice: entryExit.targetPrice,
      riskRewardRatio,
      oddsScore,
      entryType,
      scores,
    }
  }

  private calculateATR(candles: Candle[]): number {
    if (candles.length < 2) return 0

    const trueRanges = candles.slice(1).map((candle, i) => {
      const prevClose = candles[i].close
      return Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - prevClose),
        Math.abs(candle.low - prevClose)
      )
    })

    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length
  }
}

export const tradeSurgeStrategy = new TradeSurgeStrategy()
