import { tradierClient, TradierQuote, TradierCandle } from './tradierApi'

export interface Quote {
  price: number
  change: number
  percentChange: number
  high: number
  low: number
  open: number
  previousClose: number
  timestamp: number
  bid?: number
  ask?: number
  volume?: number
}

export interface Candle {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

const cache = new Map<string, { data: any; timestamp: number }>()
// Align with delayed market feed cadence.
// Tradier is ~15 minutes delayed; fetching more frequently doesn't add signal and can burn rate limits.
const CACHE_DURATION = 15 * 60 * 1000

function getCachedData(key: string): any | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() })
}

function tradierQuoteToQuote(tq: TradierQuote): Quote {
  return {
    price: tq.last,
    change: tq.change || 0,
    percentChange: tq.change_percentage || 0,
    high: tq.high,
    low: tq.low,
    open: tq.open,
    previousClose: tq.prevclose,
    timestamp: Date.now(),
    bid: tq.bid,
    ask: tq.ask,
    volume: tq.volume,
  }
}

function tradierCandleToCandle(tc: TradierCandle): Candle {
  return {
    open: tc.open,
    high: tc.high,
    low: tc.low,
    close: tc.close,
    volume: tc.volume,
    timestamp: new Date(tc.date).getTime() / 1000,
  }
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const cacheKey = `quote-${symbol}`
  const cached = getCachedData(cacheKey)
  if (cached) return cached

  try {
    const tradierQuote = await tradierClient.getQuote(symbol)

    if (!tradierQuote || tradierQuote.last === 0 || tradierQuote.last === null) {
      console.error(`Invalid quote data for ${symbol}`)
      return null
    }

    const quote = tradierQuoteToQuote(tradierQuote)
    setCachedData(cacheKey, quote)
    return quote
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error)
    return null
  }
}

export async function getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const result = new Map<string, Quote>()
  const uncachedSymbols: string[] = []

  for (const symbol of symbols) {
    const cached = getCachedData(`quote-${symbol}`)
    if (cached) {
      result.set(symbol, cached)
    } else {
      uncachedSymbols.push(symbol)
    }
  }

  if (uncachedSymbols.length > 0) {
    try {
      const tradierQuotes = await tradierClient.getQuotes(uncachedSymbols)

      for (const tq of tradierQuotes) {
        if (tq.last && tq.last !== 0) {
          const quote = tradierQuoteToQuote(tq)
          result.set(tq.symbol, quote)
          setCachedData(`quote-${tq.symbol}`, quote)
        }
      }
    } catch (error) {
      console.error('Error fetching batch quotes:', error)
    }
  }

  return result
}

export async function getCandles(
  symbol: string,
  resolution: 'D' | '60' | '30' | '15' | '5' | '1' = 'D',
  daysBack: number = 180
): Promise<Candle[]> {
  const cacheKey = `candles-${symbol}-${resolution}-${daysBack}`
  const cached = getCachedData(cacheKey)
  if (cached) return cached

  try {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - daysBack)

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    let candles: Candle[] = []

    if (resolution === 'D') {
      const tradierCandles = await tradierClient.getHistoricalData(
        symbol,
        'daily',
        startStr,
        endStr
      )
      candles = tradierCandles.map(tradierCandleToCandle)
    } else {
      const intervalMap: Record<string, '1min' | '5min' | '15min'> = {
        '1': '1min',
        '5': '5min',
        '15': '15min',
        '30': '15min',
        '60': '15min',
      }
      const interval = intervalMap[resolution] || '5min'

      const tradierCandles = await tradierClient.getIntradayData(
        symbol,
        interval,
        startStr,
        endStr
      )
      candles = tradierCandles.map(tradierCandleToCandle)
    }

    if (candles.length > 0) {
      setCachedData(cacheKey, candles)
    }

    return candles
  } catch (error) {
    console.error(`Error fetching candles for ${symbol}:`, error)
    return []
  }
}

export async function searchSymbols(query: string): Promise<Array<{ symbol: string; description: string }>> {
  if (!query || query.length < 1) return []

  const cacheKey = `search-${query}`
  const cached = getCachedData(cacheKey)
  if (cached) return cached

  try {
    const results = await tradierClient.searchSymbols(query)

    const mapped = results.map(r => ({
      symbol: r.symbol,
      description: r.description,
    }))

    setCachedData(cacheKey, mapped)
    return mapped
  } catch (error) {
    console.error('Error searching symbols:', error)
    return []
  }
}

export async function getMarketStatus(): Promise<{
  isOpen: boolean
  state: string
  nextChange: string
} | null> {
  try {
    const clock = await tradierClient.getMarketClock()
    if (!clock) return null

    return {
      isOpen: clock.state === 'open',
      state: clock.description,
      nextChange: clock.next_change,
    }
  } catch (error) {
    console.error('Error fetching market status:', error)
    return null
  }
}

export async function getCompanyProfile(symbol: string): Promise<any | null> {
  const cacheKey = `profile-${symbol}`
  const cached = getCachedData(cacheKey)
  if (cached) return cached

  try {
    const quote = await tradierClient.getQuote(symbol)
    if (!quote) return null

    const profile = {
      symbol: quote.symbol,
      name: quote.description,
    }

    setCachedData(cacheKey, profile)
    return profile
  } catch (error) {
    console.error(`Error fetching profile for ${symbol}:`, error)
    return null
  }
}
