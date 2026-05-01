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
      sideways: 'long',
      downtrend: 'long_advanced',
    },
    middle: {
      uptrend: 'long',
      sideways: 'long_advanced',
      downtrend: 'no_action',
    },
    high: {
      uptrend: 'no_action',
      sideways: 'no_action',
      downtrend: 'no_action',
    },
  },
  supply: {
    low: {
      uptrend: 'no_action',
      sideways: 'no_action',
      downtrend: 'no_action',
    },
    middle: {
      uptrend: 'no_action',
      sideways: 'short_advanced',
      downtrend: 'short',
    },
    high: {
      uptrend: 'short_advanced',
      sideways: 'short',
      downtrend: 'short',
    },
  },
}

const PUT_STRIKE_DISCOUNT = 0.10
const CALL_STRIKE_PREMIUM = 0.10
const IV_HIGH_THRESHOLD = 40
const IV_LOW_THRESHOLD = 20

function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0
  let sum = 0
  for (let i = candles.length - period; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    )
    sum += tr
  }
  return sum / period
}

function calculateRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50
  let gains = 0
  let losses = 0
  for (let i = candles.length - period; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close
    if (change > 0) gains += change
    else losses += Math.abs(change)
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function estimateIV(candles: Candle[], period = 20): number {
  if (candles.length < period + 1) return 30
  const returns: number[] = []
  for (let i = candles.length - period; i < candles.length; i++) {
    returns.push(Math.log(candles[i].close / candles[i - 1].close))
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1)
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

class WheelStrategyImpl implements TradingStrategy {
  config: StrategyConfig = {
    id: 'wheel-strategy',
    name: 'Wheel Strategy',
    description:
      'Options income strategy: sell cash-secured puts to acquire shares at a discount, then sell covered calls to generate income. Collects premiums at every stage regardless of market direction.',
    version: '1.0.0',
    author: 'Trading Platform',
    type: 'base',
    minOddsScore: 6,
    defaultRiskPercent: 2,
    maxPositions: 3,
  }

  analyzeCurvePosition(candles: Candle[]): CurvePosition {
    if (candles.length < 50) return 'middle'
    const recent = candles.slice(-50)
    const high = Math.max(...recent.map(c => c.high))
    const low = Math.min(...recent.map(c => c.low))
    const range = high - low
    if (range === 0) return 'middle'
    const pos = (candles[candles.length - 1].close - low) / range
    if (pos < 0.33) return 'low'
    if (pos > 0.67) return 'high'
    return 'middle'
  }

  analyzeTrend(candles: Candle[]): TrendDirection {
    if (candles.length < 50) return 'sideways'
    const sma20 = candles.slice(-20).reduce((s, c) => s + c.close, 0) / 20
    const sma50 = candles.slice(-50).reduce((s, c) => s + c.close, 0) / 50
    const diff = (sma20 - sma50) / sma50
    if (diff > 0.02) return 'uptrend'
    if (diff < -0.02) return 'downtrend'
    return 'sideways'
  }

  detectZones(candles: Candle[]): Zone[] {
    if (candles.length < 20) return []
    const zones: Zone[] = []
    const recent = candles.slice(-30)
    for (let i = 2; i < recent.length - 2; i++) {
      const c = recent[i]
      const isLocalLow =
        c.low < recent[i - 1].low &&
        c.low < recent[i - 2].low &&
        c.low < recent[i + 1].low &&
        c.low < recent[i + 2].low
      const isLocalHigh =
        c.high > recent[i - 1].high &&
        c.high > recent[i - 2].high &&
        c.high > recent[i + 1].high &&
        c.high > recent[i + 2].high

      if (isLocalLow) {
        zones.push({ type: 'demand', high: c.low * 1.002, low: c.low * 0.998, strength: 1, barAge: recent.length - i })
      }
      if (isLocalHigh) {
        zones.push({ type: 'supply', high: c.high * 1.002, low: c.high * 0.998, strength: 1, barAge: recent.length - i })
      }
    }
    return zones.slice(-6)
  }

  getDecisionAction(conditions: MarketConditions): TradeAction {
    const sorted = [...conditions.zones].sort(
      (a, b) =>
        Math.abs(conditions.currentPrice - (a.high + a.low) / 2) -
        Math.abs(conditions.currentPrice - (b.high + b.low) / 2)
    )
    const nearestZone = sorted[0]
    if (!nearestZone) return 'no_action'
    return DECISION_MATRIX[nearestZone.type]?.[conditions.curvePosition]?.[conditions.trendDirection] ?? 'no_action'
  }

  calculateOddsScore(conditions: MarketConditions, zone: Zone): OddsScores {
    const strengthScore = Math.min(2, zone.strength)
    const timeScore = (zone.barAge ?? 100) < 20 ? 1.5 : (zone.barAge ?? 100) < 50 ? 1 : 0.5
    const freshnessScore = (zone.barAge ?? 100) < 10 ? 2 : (zone.barAge ?? 100) < 30 ? 1 : 0.5

    let trendScore = 1
    if (zone.type === 'demand' && conditions.trendDirection === 'uptrend') trendScore = 2
    else if (zone.type === 'supply' && conditions.trendDirection === 'downtrend') trendScore = 2
    else if (conditions.trendDirection === 'sideways') trendScore = 1.5
    else trendScore = 0.5

    let curveScore = 1
    if (zone.type === 'demand' && conditions.curvePosition === 'low') curveScore = 2
    else if (zone.type === 'supply' && conditions.curvePosition === 'high') curveScore = 2
    else if (conditions.curvePosition === 'middle') curveScore = 1
    else curveScore = 0.5

    const profitZoneScore =
      conditions.atr > 0
        ? Math.min(2, (Math.abs(conditions.currentPrice - (zone.high + zone.low) / 2) / conditions.atr) * 0.5)
        : 1

    return { strengthScore, timeScore, freshnessScore, trendScore, curveScore, profitZoneScore }
  }

  calculateEntryExit(
    conditions: MarketConditions,
    _zone: Zone,
    action: TradeAction
  ): { entryPrice: number; stopLoss: number; targetPrice: number } {
    const price = conditions.currentPrice
    if (action === 'long' || action === 'long_advanced') {
      const putStrike = Math.round(price * (1 - PUT_STRIKE_DISCOUNT) * 100) / 100
      return {
        entryPrice: putStrike,
        stopLoss: Math.round(putStrike * 0.9 * 100) / 100,
        targetPrice: Math.round(putStrike * (1 + CALL_STRIKE_PREMIUM) * 100) / 100,
      }
    } else {
      const callStrike = Math.round(price * (1 + CALL_STRIKE_PREMIUM) * 100) / 100
      return {
        entryPrice: price,
        stopLoss: Math.round(price * 1.1 * 100) / 100,
        targetPrice: callStrike,
      }
    }
  }

  getEntryType(oddsScore: number): EntryType {
    if (oddsScore >= 8) return 'high_conviction'
    if (oddsScore >= 7) return 'standard'
    if (oddsScore >= 6) return 'reduced_size'
    return 'no_trade'
  }

  generateSetup(candles: Candle[], currentPrice: number): TradeSetup | null {
    if (candles.length < 50) return null

    const atr = calculateATR(candles)
    const rsi = calculateRSI(candles)
    const iv = estimateIV(candles)
    const curvePosition = this.analyzeCurvePosition(candles)
    const trendDirection = this.analyzeTrend(candles)
    const zones = this.detectZones(candles)
    if (zones.length === 0) return null

    const conditions: MarketConditions = { curvePosition, trendDirection, zones, currentPrice, atr }
    const action = this.getDecisionAction(conditions)
    if (action === 'no_action') return null

    const nearestZone = [...zones].sort(
      (a, b) =>
        Math.abs(currentPrice - (a.high + a.low) / 2) -
        Math.abs(currentPrice - (b.high + b.low) / 2)
    )[0]

    const scores = this.calculateOddsScore(conditions, nearestZone)

    const ivBonus = iv > IV_HIGH_THRESHOLD ? 1 : iv > IV_LOW_THRESHOLD ? 0.5 : 0
    const rsiBonus =
      (action === 'long' || action === 'long_advanced') && rsi < 35
        ? 0.5
        : (action === 'short' || action === 'short_advanced') && rsi > 65
        ? 0.5
        : 0

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) + ivBonus + rsiBonus
    const entryType = this.getEntryType(totalScore)
    if (entryType === 'no_trade') return null

    const { entryPrice, stopLoss, targetPrice } = this.calculateEntryExit(conditions, nearestZone, action)
    const risk = Math.abs(entryPrice - stopLoss)
    const reward = Math.abs(targetPrice - entryPrice)
    const riskRewardRatio = risk > 0 ? reward / risk : 0

    return { action, entryPrice, stopLoss, targetPrice, riskRewardRatio, oddsScore: totalScore, entryType, scores }
  }
}

export const wheelStrategy = new WheelStrategyImpl()

export const wheelStrategyGuide: StrategyGuide = {
  title: 'Wheel Strategy (Options Income)',
  sections: [
    {
      heading: 'Overview',
      content:
        'The Wheel Strategy is an options income strategy that generates consistent premium income by cycling between selling cash-secured puts and covered calls. You act as the insurance company, collecting premiums at every stage regardless of market direction.',
      rules: [
        'Stage 1: Sell cash-secured puts at a strike ~10% below current price',
        'Stage 2: If assigned, sell covered calls at ~10% above cost basis',
        'Stage 3: If called away, return to Stage 1 and repeat',
        'Premium collected at every stage creates steady income',
      ],
    },
    {
      heading: 'Put Selling (Stage 1)',
      content:
        'Sell puts on stocks you want to own at a lower price. Pick strike prices ~10% below current market price with 2-4 week expirations.',
      rules: [
        'Only sell puts on stocks you genuinely want to own',
        'Must have enough cash to buy 100 shares per contract if assigned',
        'Target strike price at ~10% below current market price',
        'Pick expirations 2-4 weeks out for optimal time decay',
        'Close early at 50% profit to free up capital',
      ],
    },
    {
      heading: 'Covered Call Selling (Stage 2)',
      content:
        'Once assigned shares, sell covered calls at a strike above your cost basis to generate additional income.',
      rules: [
        'Never sell calls below your cost basis',
        'Target strike price at ~10% above effective cost basis',
        'Same 2-4 week expiration window',
        'If call expires worthless, sell another immediately',
        'Track total premium per cycle for performance measurement',
      ],
    },
    {
      heading: 'Scoring & Stock Selection',
      content:
        'The wheel works best on stable stocks with moderate-to-high implied volatility. Higher IV means bigger premiums.',
      rules: [
        'High IV (>40%): +1 bonus score — bigger premiums available',
        'Moderate IV (20-40%): +0.5 bonus — acceptable premiums',
        'Oversold RSI (<35) for puts: +0.5 bonus — better entry if assigned',
        'Overbought RSI (>65) for calls: +0.5 bonus — more likely to expire worthless',
        'Minimum combined score of 6 required to initiate a wheel position',
      ],
    },
    {
      heading: 'Risk Management',
      content: 'Defined risk at every stage: you might buy shares at a price you chose and sell at a price you chose.',
      rules: [
        'Maximum 3 simultaneous wheel positions',
        'Each position requires full cash coverage (no margin)',
        'Default 2% portfolio risk per position',
        'Emergency stop at 10% below assignment price',
        'Track cumulative premiums to measure true income generated',
      ],
    },
  ],
}
