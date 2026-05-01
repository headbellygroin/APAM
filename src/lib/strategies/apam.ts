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

const ZONE_MAX_AGE_BARS = 200
const FRESHNESS_BAR_WINDOW = 20
const VOLUME_CONFIRMATION_RATIO = 1.5
const GAP_INVALIDATION_ATR_MULTIPLE = 1.0
const BASE_MIN_CANDLES = 1
const BASE_MAX_CANDLES = 6
const BASE_WICK_BODY_RATIO = 2.0
const BASE_MIN_REJECTION_ATR = 1.0
const EMA_PERIOD = 20
const EMA_UP_SLOPE = 0.01
const EMA_DOWN_SLOPE = -0.01
const ADX_TREND_THRESHOLD = 25
const ADX_COUNTER_TREND_MAX = 30
const RSI_PERIOD = 14
const MOMENTUM_HIGH = 0.80
const MOMENTUM_MID_HIGH = 0.60
const MOMENTUM_MID_LOW = 0.40
const MOMENTUM_LOW = 0.20
const MIN_DIVERGENCE_SEPARATION = 3
const STOP_ATR_BUFFER = 1.5
const MIN_RR = 2.0
const COUNTER_TREND_MIN_SCORE = 8

const DECISION_MATRIX: Record<ZoneType, Record<CurvePosition, Record<TrendDirection, TradeAction>>> = {
  demand: {
    low: { uptrend: 'long', sideways: 'long_advanced', downtrend: 'no_action' },
    middle: { uptrend: 'long_advanced', sideways: 'no_action', downtrend: 'no_action' },
    high: { uptrend: 'no_action', sideways: 'no_action', downtrend: 'no_action' },
  },
  supply: {
    high: { downtrend: 'short', sideways: 'short_advanced', uptrend: 'no_action' },
    middle: { downtrend: 'short_advanced', sideways: 'no_action', uptrend: 'no_action' },
    low: { downtrend: 'no_action', sideways: 'no_action', uptrend: 'no_action' },
  },
}

const COUNTER_TREND_MATRIX: Record<ZoneType, Record<CurvePosition, Record<TrendDirection, TradeAction>>> = {
  supply: {
    high: { uptrend: 'short_advanced', sideways: 'no_action', downtrend: 'short' },
    middle: { uptrend: 'no_action', sideways: 'no_action', downtrend: 'short_advanced' },
    low: { uptrend: 'no_action', sideways: 'no_action', downtrend: 'no_action' },
  },
  demand: {
    low: { downtrend: 'long_advanced', sideways: 'no_action', uptrend: 'long' },
    middle: { downtrend: 'no_action', sideways: 'no_action', uptrend: 'long_advanced' },
    high: { downtrend: 'no_action', sideways: 'no_action', uptrend: 'no_action' },
  },
}

export const apamGuide: StrategyGuide = {
  title: 'Adaptive Price Action Model (APAM) v1.0 Guide',
  sections: [
    {
      heading: 'Core Concept',
      content: 'APAM is a fully objective, machine-executable trading framework. It defines supply/demand zones, trend structure, momentum conditions, scoring criteria, and risk protocols using quantifiable metrics only. All decisions are numeric -- human labels exist only at the output layer.',
    },
    {
      heading: 'Zone Identification',
      content: 'Zones are identified using base formation patterns with strict numeric criteria.',
      rules: [
        'Demand Zone: Drop-Base-Rally (DBR) or Rally-Base-Rally (RBR)',
        'Supply Zone: Rally-Base-Drop (RBD) or Drop-Base-Drop (DBD)',
        'Proximal line: median body value of base candles (demand=highest, supply=lowest)',
        'Distal line: median wick value of structure (demand=lowest, supply=highest)',
        'Base requires 1-6 candles with average wick >= 2x average body across all base candles',
        'Rejection move >= 1 ATR(14) from the base confirms the zone',
        'Zone expires after 200 bars regardless of freshness',
        'Zone invalidated if price gaps through by >1 ATR without touching',
        'Zone invalidated if >50% retrace into zone has occurred',
        'Volume on breakout candle must be >1.5x 20-period average (if available)',
      ],
    },
    {
      heading: 'Trend Determination',
      content: 'Objective trend classification using EMA slope and ADX.',
      rules: [
        'Uptrend: Higher highs/lows + EMA(20) slope > +0.01',
        'Downtrend: Lower highs/lows + EMA(20) slope < -0.01',
        'Sideways: ADX < 25 (insufficient directional strength)',
        'Trend valid only when ADX > 25',
      ],
    },
    {
      heading: 'Momentum Position',
      content: 'Quantified momentum using HTF swing range percentage and RSI(14).',
      rules: [
        'High: Zone at >80% of swing range',
        'Mid: Zone between 40-60% of swing range',
        'Low: Zone at <20% of swing range',
        'RSI >70 or <30 at extremes confirms exhaustion',
        'RSI divergence: price makes new extreme while RSI does not (min 3-bar separation)',
        'Divergence at momentum extremes is the highest-value signal',
      ],
    },
    {
      heading: 'Probability Scoring (10 Points)',
      content: 'Minimum 7/10 required for any trade.',
      rules: [
        'Strength (0-2): Breakout >2x ATR + volume >1.5x avg = 2, 1-2x ATR = 1, <1x ATR = 0',
        'Time Spent (0-1): 1-3 base candles = 1, 4-6 = 0.5, >6 = 0',
        'Freshness (0-1.5): Untested in last 20 HTF bars + age <200 = 1.5, <50% retrace = 0.75, tested/expired = 0',
        'Trend Alignment (0-2): With trend + ADX >25 = 2, sideways = 1, against trend = 0',
        'Momentum Position (0-1.5): Extreme + RSI divergence = 1.5, mid-range = 0.75, neutral = 0',
        'Reward Potential (0-2): >4:1 R:R = 2, 2-4:1 = 1, <2:1 = 0',
      ],
    },
    {
      heading: 'Execution',
      content: 'Evaluate, Execute, Manage.',
      rules: [
        'Score >= 8.5: Limit-edge entry at zone boundary',
        'Score 7-8.5: Confirmation entry (candle close in zone or break of structure)',
        'Score < 7: No trade',
        'Stop: Distal line +/- 1.5x ATR(14)',
        'Target: Next opposing fresh zone (approximated as 3x risk)',
        'Partial 50% at 1:1 R:R, 25% at 2:1, trail remainder',
      ],
    },
    {
      heading: 'Risk Management',
      content: 'Strict capital preservation rules.',
      rules: [
        'Max 1% account risk per trade',
        'Position Size = (Balance x 0.01) / (Entry - Stop)',
        'Max 3 open trades, 3% daily risk cap',
        'No new trades after daily loss limit reached',
        'Min 2:1 R:R required for any setup',
      ],
    },
    {
      heading: 'Counter-Trend',
      content: 'Allowed only under strict conditions.',
      rules: [
        'RSI(14) divergence must be present (min 3-bar separation)',
        'ADX must be < 30 (only fade weak/fading trends)',
        'Minimum score of 8 required (higher bar than trend-aligned)',
        'Momentum must be at extreme (>80% or <20% of swing range)',
      ],
    },
    {
      heading: 'AI Evolution',
      content: 'The AI learns from outcomes, operating natively in numeric space.',
      rules: [
        'Tracks pattern performance per zone/trend/momentum combination as numeric vectors',
        'Detects drift when AI decisions diverge from base APAM rules',
        'Weight vector adjustments applied in numeric space -- human labels only at output',
        'Earns name: 65% win rate + profit factor >= 1.5 + positive expectancy over 100+ trades',
        'Keeps name: Rolling 50-trade window >= 58% WR, >= 1.3 PF, positive expectancy',
        'Name revoked: Rolling 50 drops below 55% WR OR PF < 1.0 OR negative expectancy',
        'Requires user permission to adopt evolved weights as new strategy',
      ],
    },
  ],
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export class APAMStrategy implements TradingStrategy {
  config: StrategyConfig = {
    id: 'apam',
    name: 'Adaptive Price Action Model',
    description: 'Machine-executable supply/demand framework using ATR, EMA(20), ADX, RSI(14) for fully objective AI-driven analysis',
    version: '2.0.0',
    author: 'APAM Framework',
    type: 'base',
    minOddsScore: 7,
    defaultRiskPercent: 1,
    maxPositions: 3,
  }

  analyzeCurvePosition(candles: Candle[]): CurvePosition {
    if (candles.length < 50) return 'middle'

    const longerCandles = candles.slice(-50)
    const swingHigh = Math.max(...longerCandles.map(c => c.high))
    const swingLow = Math.min(...longerCandles.map(c => c.low))
    const range = swingHigh - swingLow
    if (range === 0) return 'middle'

    const currentPrice = candles[candles.length - 1].close
    const position = (currentPrice - swingLow) / range

    if (position >= MOMENTUM_HIGH) return 'high'
    if (position <= MOMENTUM_LOW) return 'low'
    if (position >= MOMENTUM_MID_LOW && position <= MOMENTUM_MID_HIGH) return 'middle'
    if (position > MOMENTUM_MID_HIGH) return 'high'
    if (position < MOMENTUM_MID_LOW) return 'low'
    return 'middle'
  }

  analyzeTrend(candles: Candle[]): TrendDirection {
    if (candles.length < EMA_PERIOD) return 'sideways'

    const emaSlope = this.calculateEMASlope(candles.slice(-EMA_PERIOD))
    const adx = this.calculateADX(candles.slice(-14))

    if (adx < ADX_TREND_THRESHOLD) return 'sideways'

    if (emaSlope > EMA_UP_SLOPE) return 'uptrend'
    if (emaSlope < EMA_DOWN_SLOPE) return 'downtrend'
    return 'sideways'
  }

  detectZones(candles: Candle[]): Zone[] {
    if (candles.length < 50) return []

    const zones: Zone[] = []
    const recentCandles = candles.slice(-50)
    const atr = this.calculateATR(candles.slice(-15))
    const avgVolume = this.calculateAvgVolume(candles.slice(-20))
    const totalBars = recentCandles.length

    for (let i = 5; i < recentCandles.length - 5; i++) {
      const current = recentCandles[i]
      const before = recentCandles.slice(Math.max(0, i - 5), i)
      const after = recentCandles.slice(i + 1, Math.min(recentCandles.length, i + 6))

      const isBottom = before.every(c => c.low > current.low) && after.every(c => c.low > current.low)
      const isTop = before.every(c => c.high < current.high) && after.every(c => c.high < current.high)

      const barAge = totalBars - i
      if (barAge > ZONE_MAX_AGE_BARS) continue

      if (isBottom) {
        const baseResult = this.extractBase(before, current, atr, 'demand')
        if (!baseResult) continue

        const rejectionMove = after.reduce((mx, c) => Math.max(mx, c.close - baseResult.proximal), 0)
        if (rejectionMove < atr * BASE_MIN_REJECTION_ATR) continue

        const strengthRating = rejectionMove > atr * 2 ? 2 : 1
        const breakoutVolume = after[0]?.volume || 0
        const volumeRatio = avgVolume > 0 ? breakoutVolume / avgVolume : 1

        const gapInvalidated = this.checkGapInvalidation(
          recentCandles.slice(i + 1), baseResult.proximal, baseResult.distal, atr, 'demand'
        )
        if (gapInvalidated) continue

        const tested = this.checkZoneTested(
          recentCandles.slice(i + 1), baseResult.proximal, baseResult.distal, 'demand'
        )

        zones.push({
          type: 'demand',
          high: baseResult.proximal,
          low: baseResult.distal,
          strength: strengthRating,
          timestamp: current.timestamp,
          barAge,
          volumeRatio,
          gapInvalidated: false,
          baseCandles: baseResult.candleCount,
          tested,
        })
      }

      if (isTop) {
        const baseResult = this.extractBase(before, current, atr, 'supply')
        if (!baseResult) continue

        const rejectionMove = after.reduce((mx, c) => Math.max(mx, baseResult.proximal - c.close), 0)
        if (rejectionMove < atr * BASE_MIN_REJECTION_ATR) continue

        const strengthRating = rejectionMove > atr * 2 ? 2 : 1
        const breakoutVolume = after[0]?.volume || 0
        const volumeRatio = avgVolume > 0 ? breakoutVolume / avgVolume : 1

        const gapInvalidated = this.checkGapInvalidation(
          recentCandles.slice(i + 1), baseResult.distal, baseResult.proximal, atr, 'supply'
        )
        if (gapInvalidated) continue

        const tested = this.checkZoneTested(
          recentCandles.slice(i + 1), baseResult.distal, baseResult.proximal, 'supply'
        )

        zones.push({
          type: 'supply',
          high: baseResult.distal,
          low: baseResult.proximal,
          strength: strengthRating,
          timestamp: current.timestamp,
          barAge,
          volumeRatio,
          gapInvalidated: false,
          baseCandles: baseResult.candleCount,
          tested,
        })
      }
    }

    return zones.slice(-6)
  }

  private extractBase(
    before: Candle[],
    pivot: Candle,
    atr: number,
    zoneType: ZoneType
  ): { proximal: number; distal: number; candleCount: number } | null {
    const candidates = [pivot]
    const pivotBody = Math.abs(pivot.close - pivot.open)
    const threshold = Math.max(pivotBody * 3, atr * 0.5)

    for (let i = before.length - 1; i >= 0 && candidates.length < BASE_MAX_CANDLES; i--) {
      const c = before[i]
      const cBody = Math.abs(c.close - c.open)
      if (cBody <= threshold) {
        candidates.unshift(c)
      } else {
        break
      }
    }

    if (candidates.length < BASE_MIN_CANDLES || candidates.length > BASE_MAX_CANDLES) return null

    const bodies = candidates.map(c => Math.abs(c.close - c.open))
    const wicks = candidates.map(c => (c.high - c.low) - Math.abs(c.close - c.open))
    const avgBody = bodies.reduce((s, b) => s + b, 0) / bodies.length
    const avgWick = wicks.reduce((s, w) => s + w, 0) / wicks.length

    if (avgBody > 0 && avgWick / avgBody < BASE_WICK_BODY_RATIO) return null

    if (zoneType === 'demand') {
      const bodyValues = candidates.map(c => Math.max(c.open, c.close))
      const wickLows = candidates.map(c => c.low)
      return {
        proximal: median(bodyValues),
        distal: median(wickLows),
        candleCount: candidates.length,
      }
    } else {
      const bodyValues = candidates.map(c => Math.min(c.open, c.close))
      const wickHighs = candidates.map(c => c.high)
      return {
        proximal: median(bodyValues),
        distal: median(wickHighs),
        candleCount: candidates.length,
      }
    }
  }

  private checkZoneTested(
    subsequentCandles: Candle[],
    zoneHigh: number,
    zoneLow: number,
    zoneType: ZoneType
  ): boolean {
    const zoneWidth = Math.abs(zoneHigh - zoneLow)
    const testThreshold = zoneWidth * 0.5
    const recentBars = subsequentCandles.slice(-FRESHNESS_BAR_WINDOW)

    for (const c of recentBars) {
      if (zoneType === 'demand') {
        if (c.low <= zoneHigh && c.low >= zoneLow - testThreshold) return true
      } else {
        if (c.high >= zoneLow && c.high <= zoneHigh + testThreshold) return true
      }
    }
    return false
  }

  getDecisionAction(conditions: MarketConditions): TradeAction {
    const { curvePosition, trendDirection, zones, currentPrice } = conditions

    if (zones.length === 0) return 'no_action'

    const nearestZone = this.findNearestZone(zones, currentPrice)
    const baseAction = DECISION_MATRIX[nearestZone.type]?.[curvePosition]?.[trendDirection] || 'no_action'

    if (baseAction !== 'no_action') return baseAction

    const counterAction = COUNTER_TREND_MATRIX[nearestZone.type]?.[curvePosition]?.[trendDirection]
    if (counterAction && counterAction !== 'no_action') {
      return counterAction
    }

    return 'no_action'
  }

  calculateOddsScore(conditions: MarketConditions, zone: Zone): OddsScores {
    const { trendDirection, curvePosition, atr, currentPrice } = conditions

    const rejectionMove = zone.strength * atr
    let strengthScore = 0
    const hasVolumeConfirmation = (zone.volumeRatio || 0) >= VOLUME_CONFIRMATION_RATIO
    if (rejectionMove > atr * 2 && hasVolumeConfirmation) strengthScore = 2
    else if (rejectionMove > atr * 2) strengthScore = 1.5
    else if (rejectionMove >= atr) strengthScore = 1

    const baseCandleCount = zone.baseCandles || 3
    let timeScore = 0
    if (baseCandleCount >= BASE_MIN_CANDLES && baseCandleCount <= 3) timeScore = 1
    else if (baseCandleCount <= BASE_MAX_CANDLES) timeScore = 0.5

    let freshnessScore = 0
    const barAge = zone.barAge || 0
    if (barAge > ZONE_MAX_AGE_BARS) {
      freshnessScore = 0
    } else if (zone.tested) {
      const zoneCenter = (zone.high + zone.low) / 2
      const zoneWidth = Math.abs(zone.high - zone.low)
      if (zoneWidth > 0) {
        const retrace = Math.abs(currentPrice - zoneCenter) / zoneWidth
        freshnessScore = retrace <= 0.5 ? 0.75 : 0
      }
    } else {
      freshnessScore = 1.5
    }

    let trendScore = 0
    const isAligned = (trendDirection === 'uptrend' && zone.type === 'demand') ||
                      (trendDirection === 'downtrend' && zone.type === 'supply')
    if (isAligned) trendScore = 2
    else if (trendDirection === 'sideways') trendScore = 1

    let curveScore = 0
    const isFavorable = (curvePosition === 'low' && zone.type === 'demand') ||
                        (curvePosition === 'high' && zone.type === 'supply')
    if (isFavorable) {
      const rsi = this.lastRSI
      const hasDivergence = this.lastDivergenceResult
      if (hasDivergence || (zone.type === 'demand' && rsi < 30) || (zone.type === 'supply' && rsi > 70)) {
        curveScore = 1.5
      } else {
        curveScore = 1.0
      }
    } else if (curvePosition === 'middle') {
      curveScore = 0.75
    }

    const entryExit = this.calculateEntryExit(conditions, zone, zone.type === 'demand' ? 'long' : 'short')
    const risk = Math.abs(entryExit.entryPrice - entryExit.stopLoss)
    const rr = risk > 0 ? Math.abs(entryExit.targetPrice - entryExit.entryPrice) / risk : 0

    let profitZoneScore = 0
    if (rr >= 4) profitZoneScore = 2
    else if (rr >= 2) profitZoneScore = 1

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
    const atrBuffer = atr * STOP_ATR_BUFFER

    if (isLong) {
      const entryPrice = zone.high
      const stopLoss = zone.low - atrBuffer
      const risk = entryPrice - stopLoss
      return {
        entryPrice,
        stopLoss,
        targetPrice: entryPrice + (risk * 3),
      }
    } else {
      const entryPrice = zone.low
      const stopLoss = zone.high + atrBuffer
      const risk = stopLoss - entryPrice
      return {
        entryPrice,
        stopLoss,
        targetPrice: entryPrice - (risk * 3),
      }
    }
  }

  getEntryType(oddsScore: number): EntryType {
    if (oddsScore >= 8.5) return 'high_conviction'
    if (oddsScore >= 7) return 'standard'
    return 'no_trade'
  }

  private lastRSI = 50
  private lastDivergenceResult = false
  private lastADX = 25

  generateSetup(candles: Candle[], currentPrice: number): TradeSetup | null {
    if (candles.length < 50) return null

    this.lastRSI = this.calculateRSI(candles.slice(-(RSI_PERIOD + 1)))
    this.lastDivergenceResult = this.detectRSIDivergence(candles.slice(-10))
    this.lastADX = this.calculateADX(candles.slice(-14))

    const curvePosition = this.analyzeCurvePosition(candles)
    const trendDirection = this.analyzeTrend(candles)
    const zones = this.detectZones(candles)

    if (zones.length === 0) return null

    const atr = this.calculateATR(candles.slice(-15))

    const conditions: MarketConditions = {
      curvePosition,
      trendDirection,
      zones,
      currentPrice,
      atr,
    }

    const action = this.getDecisionAction(conditions)
    if (action === 'no_action') return null

    const nearestZone = this.findNearestZone(zones, currentPrice)

    const isCounterTrend =
      (action === 'long_advanced' && trendDirection === 'downtrend') ||
      (action === 'short_advanced' && trendDirection === 'uptrend')

    if (isCounterTrend) {
      if (this.lastADX >= ADX_COUNTER_TREND_MAX) return null
      if (!this.lastDivergenceResult) return null
      const position = this.getSwingPosition(candles)
      if (position > MOMENTUM_LOW && position < MOMENTUM_HIGH) return null
    }

    const scores = this.calculateOddsScore(conditions, nearestZone)
    const oddsScore = Object.values(scores).reduce((sum, s) => sum + s, 0)

    if (isCounterTrend && oddsScore < COUNTER_TREND_MIN_SCORE) return null
    if (oddsScore < this.config.minOddsScore) return null

    const entryType = this.getEntryType(oddsScore)
    if (entryType === 'no_trade') return null

    const entryExit = this.calculateEntryExit(conditions, nearestZone, action)
    const risk = Math.abs(entryExit.entryPrice - entryExit.stopLoss)
    const riskRewardRatio = risk > 0 ? Math.abs(entryExit.targetPrice - entryExit.entryPrice) / risk : 0

    if (riskRewardRatio < MIN_RR) return null

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

  private getSwingPosition(candles: Candle[]): number {
    const longerCandles = candles.slice(-50)
    const swingHigh = Math.max(...longerCandles.map(c => c.high))
    const swingLow = Math.min(...longerCandles.map(c => c.low))
    const range = swingHigh - swingLow
    if (range === 0) return 0.5
    return (candles[candles.length - 1].close - swingLow) / range
  }

  private findNearestZone(zones: Zone[], currentPrice: number): Zone {
    return zones.reduce((nearest, zone) => {
      const distToCurrent = Math.abs((zone.high + zone.low) / 2 - currentPrice)
      const distToNearest = Math.abs((nearest.high + nearest.low) / 2 - currentPrice)
      return distToCurrent < distToNearest ? zone : nearest
    }, zones[0])
  }

  private checkGapInvalidation(
    subsequentCandles: Candle[],
    zoneHigh: number,
    zoneLow: number,
    atr: number,
    zoneType: ZoneType
  ): boolean {
    for (let i = 1; i < subsequentCandles.length; i++) {
      const prev = subsequentCandles[i - 1]
      const curr = subsequentCandles[i]

      if (zoneType === 'demand') {
        const gapDown = prev.low - curr.high
        if (gapDown > atr * GAP_INVALIDATION_ATR_MULTIPLE && curr.high < zoneLow) {
          return true
        }
      } else {
        const gapUp = curr.low - prev.high
        if (gapUp > atr * GAP_INVALIDATION_ATR_MULTIPLE && curr.low > zoneHigh) {
          return true
        }
      }
    }
    return false
  }

  private calculateAvgVolume(candles: Candle[]): number {
    if (candles.length === 0) return 0
    const totalVol = candles.reduce((sum, c) => sum + (c.volume || 0), 0)
    return totalVol / candles.length
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

  private calculateEMASlope(candles: Candle[]): number {
    if (candles.length < 10) return 0

    const prices = candles.map(c => c.close)
    const period = Math.min(EMA_PERIOD, prices.length)
    const multiplier = 2 / (period + 1)

    let ema = prices.slice(0, period).reduce((s, p) => s + p, 0) / period
    const emaValues: number[] = [ema]

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema
      emaValues.push(ema)
    }

    if (emaValues.length < 2) return 0
    const last = emaValues[emaValues.length - 1]
    const prev = emaValues[Math.max(0, emaValues.length - 5)]
    if (prev === 0) return 0
    return (last - prev) / prev
  }

  private calculateADX(candles: Candle[]): number {
    if (candles.length < 14) return 25

    let plusDMSum = 0
    let minusDMSum = 0
    let trSum = 0

    for (let i = 1; i < Math.min(14, candles.length); i++) {
      const highDiff = candles[i].high - candles[i - 1].high
      const lowDiff = candles[i - 1].low - candles[i].low

      plusDMSum += highDiff > lowDiff && highDiff > 0 ? highDiff : 0
      minusDMSum += lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0

      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      )
      trSum += tr
    }

    if (trSum === 0) return 25

    const plusDI = (plusDMSum / trSum) * 100
    const minusDI = (minusDMSum / trSum) * 100
    const diSum = plusDI + minusDI

    if (diSum === 0) return 0
    return Math.abs(plusDI - minusDI) / diSum * 100
  }

  private calculateRSI(candles: Candle[]): number {
    if (candles.length < 2) return 50

    let gains = 0
    let losses = 0
    const period = Math.min(RSI_PERIOD, candles.length - 1)

    for (let i = 1; i <= period; i++) {
      const change = candles[i].close - candles[i - 1].close
      if (change > 0) gains += change
      else losses += Math.abs(change)
    }

    const avgGain = gains / period
    const avgLoss = losses / period

    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    return 100 - (100 / (1 + rs))
  }

  private detectRSIDivergence(candles: Candle[]): boolean {
    if (candles.length < 6) return false

    const splitIdx = Math.max(MIN_DIVERGENCE_SEPARATION, Math.floor(candles.length / 2))
    const firstWindow = candles.slice(0, splitIdx)
    const secondWindow = candles.slice(splitIdx)

    if (firstWindow.length < MIN_DIVERGENCE_SEPARATION || secondWindow.length < MIN_DIVERGENCE_SEPARATION) return false

    const firstHighIdx = firstWindow.reduce((maxIdx, c, idx) =>
      c.high > firstWindow[maxIdx].high ? idx : maxIdx, 0)
    const secondHighIdx = secondWindow.reduce((maxIdx, c, idx) =>
      c.high > secondWindow[maxIdx].high ? idx : maxIdx, 0)

    const firstLowIdx = firstWindow.reduce((minIdx, c, idx) =>
      c.low < firstWindow[minIdx].low ? idx : minIdx, 0)
    const secondLowIdx = secondWindow.reduce((minIdx, c, idx) =>
      c.low < secondWindow[minIdx].low ? idx : minIdx, 0)

    const firstRSI = this.calculateRSI(firstWindow)
    const secondRSI = this.calculateRSI(secondWindow)

    const bearishDivergence =
      secondWindow[secondHighIdx].high > firstWindow[firstHighIdx].high &&
      secondRSI < firstRSI &&
      (splitIdx + secondHighIdx - firstHighIdx) >= MIN_DIVERGENCE_SEPARATION

    const bullishDivergence =
      secondWindow[secondLowIdx].low < firstWindow[firstLowIdx].low &&
      secondRSI > firstRSI &&
      (splitIdx + secondLowIdx - firstLowIdx) >= MIN_DIVERGENCE_SEPARATION

    return bearishDivergence || bullishDivergence
  }
}

export const apamStrategy = new APAMStrategy()
