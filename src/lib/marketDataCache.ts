import { getCandles, Candle } from './marketData'
import { getTopLiquidSymbols } from './marketScanner'

interface CachedData {
  candles: Candle[]
  timestamp: number
  currentPrice: number
  interval: string
}

export type TimeInterval = '1' | '5' | '15' | '30' | '60' | 'D'

class MarketDataCache {
  private cache: Map<string, CachedData> = new Map()
  private fetchPromises: Map<string, Promise<Candle[]>> = new Map()
  private readonly CACHE_DURATION = 15 * 60 * 1000
  private lastFullScan: number = 0
  private readonly FULL_SCAN_INTERVAL = 15 * 60 * 1000

  async getCandles(symbol: string, interval: TimeInterval = 'D'): Promise<Candle[]> {
    const cacheKey = `${symbol}-${interval}`
    const cached = this.cache.get(cacheKey)
    const now = Date.now()

    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      return cached.candles
    }

    const existingPromise = this.fetchPromises.get(cacheKey)
    if (existingPromise) {
      return existingPromise
    }

    const fetchPromise = this.fetchAndCache(symbol, interval)
    this.fetchPromises.set(cacheKey, fetchPromise)

    try {
      const candles = await fetchPromise
      return candles
    } finally {
      this.fetchPromises.delete(cacheKey)
    }
  }

  private async fetchAndCache(symbol: string, interval: TimeInterval): Promise<Candle[]> {
    try {
      // Intraday data is used as a rolling window; keep requests reasonably bounded.
      // Daily can remain long lookback for macro trend context.
      const daysBack =
        interval === 'D'
          ? 180
          : interval === '60'
            ? 30
            : interval === '30'
              ? 20
              : interval === '15'
                ? 14
                : interval === '5'
                  ? 10
                  : 7

      const candles = await getCandles(symbol, interval, daysBack)
      if (candles.length > 0) {
        const cacheKey = `${symbol}-${interval}`
        this.cache.set(cacheKey, {
          candles,
          timestamp: Date.now(),
          currentPrice: candles[0].close,
          interval,
        })
      }
      return candles
    } catch (error) {
      console.error(`Failed to fetch data for ${symbol} at ${interval}:`, error)
      return []
    }
  }

  getCurrentPrice(symbol: string): number | null {
    const cacheKey = `${symbol}-D`
    const cached = this.cache.get(cacheKey)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.CACHE_DURATION) {
      return null
    }

    return cached.currentPrice
  }

  aggregateCandles(candles: Candle[], interval: TimeInterval): Candle[] {
    if (interval === '1' || interval === 'D') return candles

    const minutes = interval === '5' ? 5 : interval === '15' ? 15 : interval === '30' ? 30 : 60
    const aggregated: Candle[] = []

    for (let i = 0; i < candles.length; i += minutes) {
      const batch = candles.slice(i, i + minutes)
      if (batch.length === 0) continue

      aggregated.push({
        timestamp: batch[0].timestamp,
        open: batch[0].open,
        high: Math.max(...batch.map(c => c.high)),
        low: Math.min(...batch.map(c => c.low)),
        close: batch[batch.length - 1].close,
        volume: batch.reduce((sum, c) => sum + c.volume, 0),
      })
    }

    return aggregated
  }

  async warmCache(symbols?: string[], interval: TimeInterval = 'D'): Promise<void> {
    const now = Date.now()
    if (now - this.lastFullScan < this.FULL_SCAN_INTERVAL) {
      return
    }

    const symbolsToWarm = symbols || getTopLiquidSymbols(100)

    console.log(`Warming cache for ${symbolsToWarm.length} symbols at ${interval} interval...`)

    const batchSize = 10
    for (let i = 0; i < symbolsToWarm.length; i += batchSize) {
      const batch = symbolsToWarm.slice(i, i + batchSize)
      await Promise.all(batch.map(symbol => this.getCandles(symbol, interval)))

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    this.lastFullScan = now
    console.log('Cache warming complete')
  }

  async prefetchSymbols(symbols: string[], interval: TimeInterval = 'D'): Promise<void> {
    const batchSize = 10
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      await Promise.all(batch.map(symbol => this.getCandles(symbol, interval)))
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  getCacheStatus(): { total: number; fresh: number; stale: number } {
    const now = Date.now()
    let fresh = 0
    let stale = 0

    this.cache.forEach(cached => {
      if (now - cached.timestamp < this.CACHE_DURATION) {
        fresh++
      } else {
        stale++
      }
    })

    return {
      total: this.cache.size,
      fresh,
      stale,
    }
  }

  clearStaleEntries(): void {
    const now = Date.now()
    const toDelete: string[] = []

    this.cache.forEach((cached, symbol) => {
      if (now - cached.timestamp > this.CACHE_DURATION) {
        toDelete.push(symbol)
      }
    })

    toDelete.forEach(symbol => this.cache.delete(symbol))
  }

  clear(): void {
    this.cache.clear()
    this.fetchPromises.clear()
  }
}

export const marketDataCache = new MarketDataCache()

export async function initializeMarketCache() {
  await marketDataCache.warmCache()

  setInterval(() => {
    marketDataCache.clearStaleEntries()
  }, 5 * 60 * 1000)

  setInterval(() => {
    marketDataCache.warmCache()
  }, 15 * 60 * 1000)
}
