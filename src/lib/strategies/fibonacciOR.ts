import { Candle } from '../marketData'
import {
  TradingStrategy,
  StrategyConfig,
  CurvePosition,
  TrendDirection,
  Zone,
  TradeAction,
  OddsScores,
  TradeSetup,
  MarketConditions,
  EntryType,
  OverlayStrategy,
  OverlayAnalysis,
} from './types'

const config: StrategyConfig = {
  id: 'fibonacci-or',
  name: 'Fibonacci Opening Range',
  description: 'First 90-minute opening range with Fibonacci retracement levels',
  version: '1.0.0',
  author: 'Trading Platform',
  type: 'overlay',
  minOddsScore: 6.5,
  defaultRiskPercent: 1,
  maxPositions: 3,
}

const FIBONACCI_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786]

class FibonacciORStrategy implements TradingStrategy, OverlayStrategy {
  config = config

  analyzeOverlay(baseSignal: TradeSetup, candles: Candle[]): OverlayAnalysis {
    const overlaySetup = this.generateSetup(candles, baseSignal.entryPrice)

    if (!overlaySetup || overlaySetup.action === 'no_action') {
      return {
        overlayId: this.config.id,
        action: 'neutral',
        oddsAdjustment: 0,
        reasoning: 'Fibonacci OR has no actionable overlay opinion for current candles.',
        confidence: 0.35,
      }
    }

    const baseAction = baseSignal.action
    const ovAction = overlaySetup.action

    const dir = (a: TradeAction): 'long' | 'short' | 'none' =>
      a === 'long' || a === 'long_advanced'
        ? 'long'
        : a === 'short' || a === 'short_advanced'
          ? 'short'
          : 'none'

    const baseDir = dir(baseAction)
    const ovDir = dir(ovAction)

    if (baseDir !== 'none' && ovDir !== 'none' && baseDir === ovDir) {
      return {
        overlayId: this.config.id,
        action: 'confirm',
        oddsAdjustment: 0.35,
        reasoning: `Fibonacci OR aligns with base direction (${ovAction}).`,
        confidence: 0.65,
      }
    }

    if (baseDir !== 'none' && ovDir !== 'none' && baseDir !== ovDir) {
      return {
        overlayId: this.config.id,
        action: 'conflict',
        oddsAdjustment: -1.25,
        reasoning: `Fibonacci OR disagrees with base (${ovAction} vs ${baseAction}).`,
        confidence: 0.7,
      }
    }

    return {
      overlayId: this.config.id,
      action: 'neutral',
      oddsAdjustment: 0,
      reasoning: 'Fibonacci OR does not materially alter the base signal.',
      confidence: 0.4,
    }
  }

  analyzeCurvePosition(candles: Candle[]): CurvePosition {
    if (candles.length < 20) return 'middle'

    const recent = candles.slice(0, 20)
    const high = Math.max(...recent.map(c => c.high))
    const low = Math.min(...recent.map(c => c.low))
    const current = candles[0].close
    const range = high - low

    if (range === 0) return 'middle'

    const position = (current - low) / range

    if (position < 0.33) return 'low'
    if (position > 0.67) return 'high'
    return 'middle'
  }

  analyzeTrend(candles: Candle[]): TrendDirection {
    if (candles.length < 20) return 'sideways'

    const sma20 = candles.slice(0, 20).reduce((sum, c) => sum + c.close, 0) / 20
    const sma50 = candles.length >= 50
      ? candles.slice(0, 50).reduce((sum, c) => sum + c.close, 0) / 50
      : sma20

    const current = candles[0].close
    const prev20 = candles[20]?.close || current

    if (current > sma20 && sma20 > sma50 && current > prev20) return 'uptrend'
    if (current < sma20 && sma20 < sma50 && current < prev20) return 'downtrend'
    return 'sideways'
  }

  detectZones(candles: Candle[]): Zone[] {
    if (candles.length < 2) return []

    const orHigh = Math.max(...candles.slice(0, 6).map(c => c.high))
    const orLow = Math.min(...candles.slice(0, 6).map(c => c.low))
    const orRange = orHigh - orLow

    if (orRange === 0) return []

    const zones: Zone[] = []
    const current = candles[0].close

    FIBONACCI_LEVELS.forEach(level => {
      const retracement = orHigh - (orRange * level)

      if (current > orHigh) {
        zones.push({
          type: 'supply',
          high: orHigh * 1.005,
          low: orHigh * 0.995,
          strength: level === 0.618 ? 2 : 1,
          barAge: 0,
        })
      } else if (current < orLow) {
        zones.push({
          type: 'demand',
          high: orLow * 1.005,
          low: orLow * 0.995,
          strength: level === 0.618 ? 2 : 1,
          barAge: 0,
        })
      }

      if (Math.abs(current - retracement) / current < 0.02) {
        zones.push({
          type: current < retracement ? 'supply' : 'demand',
          high: retracement * 1.005,
          low: retracement * 0.995,
          strength: level === 0.618 || level === 0.5 ? 2 : 1,
          barAge: 0,
        })
      }
    })

    if (zones.length === 0) {
      zones.push({
        type: current > (orHigh + orLow) / 2 ? 'supply' : 'demand',
        high: orHigh,
        low: orLow,
        strength: 1,
        barAge: 0,
      })
    }

    return zones
  }

  getDecisionAction(conditions: MarketConditions): TradeAction {
    const { zones } = conditions
    const price = conditions.currentPrice
    const orHigh = Math.max(...zones.map(z => z.high))
    const orLow = Math.min(...zones.map(z => z.low))
    const orMid = (orHigh + orLow) / 2

    if (price > orHigh * 1.01) {
      return 'long'
    } else if (price < orLow * 0.99) {
      return 'short'
    } else if (price > orMid && price < orHigh) {
      return 'long_advanced'
    } else if (price < orMid && price > orLow) {
      return 'short_advanced'
    }

    return 'no_action'
  }

  calculateOddsScore(conditions: MarketConditions, zone: Zone): OddsScores {
    const { curvePosition, trendDirection, atr } = conditions

    let strengthScore = zone.strength
    let timeScore = zone.barAge !== undefined && zone.barAge < 20 ? 2 : 1
    let freshnessScore = zone.tested ? 1 : 2
    let trendScore = 0
    let curveScore = 0
    let profitZoneScore = 1

    if (zone.type === 'demand') {
      if (trendDirection === 'uptrend') trendScore = 2
      else if (trendDirection === 'sideways') trendScore = 1

      if (curvePosition === 'low') curveScore = 2
      else if (curvePosition === 'middle') curveScore = 1
    } else {
      if (trendDirection === 'downtrend') trendScore = 2
      else if (trendDirection === 'sideways') trendScore = 1

      if (curvePosition === 'high') curveScore = 2
      else if (curvePosition === 'middle') curveScore = 1
    }

    const zoneRange = zone.high - zone.low
    if (atr > 0 && zoneRange / atr > 1.5) {
      profitZoneScore = 2
    }

    return {
      strengthScore,
      timeScore,
      freshnessScore,
      trendScore,
      curveScore,
      profitZoneScore,
    }
  }

  calculateEntryExit(
    conditions: MarketConditions,
    zone: Zone,
    action: TradeAction
  ): { entryPrice: number; stopLoss: number; targetPrice: number } {
    const { currentPrice, atr } = conditions

    let entryPrice = currentPrice
    let stopLoss: number
    let targetPrice: number

    if (action === 'long' || action === 'long_advanced') {
      stopLoss = zone.low - atr * 0.5
      targetPrice = entryPrice + (Math.abs(entryPrice - stopLoss) * 2)
    } else {
      stopLoss = zone.high + atr * 0.5
      targetPrice = entryPrice - (Math.abs(stopLoss - entryPrice) * 2)
    }

    return { entryPrice, stopLoss, targetPrice }
  }

  getEntryType(oddsScore: number): EntryType {
    if (oddsScore >= 8.5) return 'high_conviction'
    if (oddsScore >= 7) return 'standard'
    if (oddsScore >= 6.5) return 'reduced_size'
    return 'no_trade'
  }

  generateSetup(candles: Candle[], currentPrice: number): TradeSetup | null {
    if (candles.length < 10) return null

    const curvePosition = this.analyzeCurvePosition(candles)
    const trendDirection = this.analyzeTrend(candles)
    const zones = this.detectZones(candles)

    if (zones.length === 0) return null

    const atr = this.calculateATR(candles)

    const conditions: MarketConditions = {
      curvePosition,
      trendDirection,
      zones,
      currentPrice,
      atr,
    }

    const nearestZone = zones.reduce((nearest, zone) => {
      const distToCurrent = Math.abs((zone.high + zone.low) / 2 - currentPrice)
      const distToNearest = Math.abs((nearest.high + nearest.low) / 2 - currentPrice)
      return distToCurrent < distToNearest ? zone : nearest
    })

    const action = this.getDecisionAction(conditions)
    if (action === 'no_action') return null

    const scores = this.calculateOddsScore(conditions, nearestZone)
    const oddsScore =
      scores.strengthScore +
      scores.timeScore +
      scores.freshnessScore +
      scores.trendScore +
      scores.curveScore +
      scores.profitZoneScore

    if (oddsScore < this.config.minOddsScore) return null

    const { entryPrice, stopLoss, targetPrice } = this.calculateEntryExit(
      conditions,
      nearestZone,
      action
    )

    const riskRewardRatio = Math.abs(targetPrice - entryPrice) / Math.abs(entryPrice - stopLoss)
    const entryType = this.getEntryType(oddsScore)

    if (entryType === 'no_trade') return null

    return {
      action,
      entryPrice,
      stopLoss,
      targetPrice,
      riskRewardRatio,
      oddsScore,
      entryType,
      scores,
    }
  }

  private calculateATR(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 0

    const trueRanges = []
    for (let i = 0; i < period; i++) {
      const high = candles[i].high
      const low = candles[i].low
      const prevClose = i < candles.length - 1 ? candles[i + 1].close : candles[i].close

      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
      trueRanges.push(tr)
    }

    return trueRanges.reduce((sum, tr) => sum + tr, 0) / period
  }
}

export const fibonacciORStrategy = new FibonacciORStrategy()

export const fibonacciORGuide = {
  title: 'Fibonacci Opening Range Strategy',
  sections: [
    {
      heading: 'Strategy Overview',
      content:
        'The Fibonacci Opening Range strategy focuses on the first 90 minutes of trading. It identifies the opening range high and low, then uses Fibonacci retracement levels to find optimal entry points when price breaks out or retraces.',
    },
    {
      heading: 'Opening Range Definition',
      content:
        'The first 90 minutes (6 x 15-minute candles) establish the opening range. The high and low of this period become key reference levels for the rest of the trading day.',
    },
    {
      heading: 'Fibonacci Levels',
      content:
        'Key retracement levels: 23.6%, 38.2%, 50%, 61.8%, and 78.6%. The 50% and 61.8% levels are considered the most significant for entries.',
      rules: [
        'Breakout above OR high: Look for long entries',
        'Breakdown below OR low: Look for short entries',
        'Retracement to 50% or 61.8%: High-probability reversal zones',
        'OR midpoint acts as support/resistance throughout the day',
      ],
    },
    {
      heading: 'Entry Rules',
      content:
        'Entries are taken when price breaks the opening range or retraces to key Fibonacci levels with confirmation from trend and volume.',
      rules: [
        'LONG: Price breaks above OR high with trend confirmation',
        'LONG (Advanced): Price retraces to 61.8% or 50% in uptrend',
        'SHORT: Price breaks below OR low with trend confirmation',
        'SHORT (Advanced): Price retraces to 61.8% or 50% in downtrend',
      ],
    },
    {
      heading: 'Stop Loss Placement',
      content:
        'Stops are placed beyond the OR extremes or below/above the Fibonacci retracement level, with a buffer of 0.5x ATR.',
    },
    {
      heading: 'Profit Targets',
      content:
        'Targets are set at 2:1 risk-reward ratio minimum. Extended targets can be placed at the next Fibonacci extension level (127.2% or 161.8%).',
    },
    {
      heading: 'Time Restrictions',
      content:
        'This strategy is designed for the first 4 hours of the trading session. After 1:30 PM ET, signals lose reliability as volume decreases.',
    },
  ],
}
