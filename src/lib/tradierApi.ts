const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// IMPORTANT: Tradier data is delayed 15 minutes (live market data feed)
// This system uses Tradier for market data ONLY - all trading is simulated internally
export const TRADIER_DATA_DELAY_MINUTES = 15

export interface TradierQuote {
  symbol: string
  description: string
  last: number
  change: number
  change_percentage: number
  open: number
  high: number
  low: number
  close: number
  prevclose: number
  volume: number
  bid: number
  ask: number
  bidsize: number
  asksize: number
}

export interface TradierCandle {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TradierPosition {
  id: number
  account_id: string
  symbol: string
  quantity: number
  cost_basis: number
  date_acquired: string
}

export interface TradierOrder {
  id: number
  type: string
  symbol: string
  side: 'buy' | 'sell' | 'buy_to_cover' | 'sell_short'
  quantity: number
  status: string
  duration: string
  price?: number
  stop?: number
  avg_fill_price?: number
  exec_quantity?: number
  last_fill_price?: number
  last_fill_quantity?: number
  remaining_quantity?: number
  create_date: string
  transaction_date?: string
}

export interface TradierAccount {
  account_number: string
  classification: string
  date_created: string
  day_trader: boolean
  option_level: number
  status: string
  type: string
}

export interface TradierBalance {
  account_number: string
  account_type: string
  cash: number
  close_pl: number
  current_requirement: number
  day_trade_buying_power: number
  equity: number
  long_market_value: number
  market_value: number
  open_pl: number
  option_buying_power: number
  option_long_value: number
  option_requirement: number
  option_short_value: number
  pending_cash: number
  pending_orders_count: number
  short_market_value: number
  stock_buying_power: number
  stock_long_value: number
  uncleared_funds: number
  unsettled_funds: number
  total_cash: number
  total_equity: number
}

async function callTradierProxy(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const url = `${SUPABASE_URL}/functions/v1/tradier-proxy`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint,
      method,
      body,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Tradier API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

export class TradierClient {
  async getQuote(symbol: string): Promise<TradierQuote | null> {
    try {
      const data = await callTradierProxy(`/markets/quotes?symbols=${symbol}`)

      if (!data?.quotes?.quote) {
        return null
      }

      const quote = Array.isArray(data.quotes.quote)
        ? data.quotes.quote[0]
        : data.quotes.quote

      return quote
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error)
      return null
    }
  }

  async getQuotes(symbols: string[]): Promise<TradierQuote[]> {
    try {
      const symbolList = symbols.join(',')
      const data = await callTradierProxy(`/markets/quotes?symbols=${symbolList}`)

      if (!data?.quotes?.quote) {
        return []
      }

      return Array.isArray(data.quotes.quote)
        ? data.quotes.quote
        : [data.quotes.quote]
    } catch (error) {
      console.error('Error fetching quotes:', error)
      return []
    }
  }

  async getHistoricalData(
    symbol: string,
    interval: 'daily' | 'weekly' | 'monthly' = 'daily',
    start?: string,
    end?: string
  ): Promise<TradierCandle[]> {
    try {
      let endpoint = `/markets/history?symbol=${symbol}&interval=${interval}`
      if (start) endpoint += `&start=${start}`
      if (end) endpoint += `&end=${end}`

      const data = await callTradierProxy(endpoint)

      if (!data?.history?.day) {
        return []
      }

      return Array.isArray(data.history.day)
        ? data.history.day
        : [data.history.day]
    } catch (error) {
      console.error(`Error fetching history for ${symbol}:`, error)
      return []
    }
  }

  async getIntradayData(
    symbol: string,
    interval: '1min' | '5min' | '15min' = '5min',
    start?: string,
    end?: string
  ): Promise<TradierCandle[]> {
    try {
      let endpoint = `/markets/timesales?symbol=${symbol}&interval=${interval}`
      if (start) endpoint += `&start=${start}`
      if (end) endpoint += `&end=${end}`

      const data = await callTradierProxy(endpoint)

      if (!data?.series?.data) {
        return []
      }

      const rawData = Array.isArray(data.series.data)
        ? data.series.data
        : [data.series.data]

      return rawData.map((item: any) => ({
        date: item.time,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }))
    } catch (error) {
      console.error(`Error fetching intraday data for ${symbol}:`, error)
      return []
    }
  }

  async searchSymbols(query: string): Promise<Array<{ symbol: string; description: string; type: string }>> {
    try {
      const data = await callTradierProxy(`/markets/search?q=${encodeURIComponent(query)}`)

      if (!data?.securities?.security) {
        return []
      }

      const securities = Array.isArray(data.securities.security)
        ? data.securities.security
        : [data.securities.security]

      return securities
        .filter((s: any) => s.type === 'stock')
        .slice(0, 10)
        .map((s: any) => ({
          symbol: s.symbol,
          description: s.description,
          type: s.type,
        }))
    } catch (error) {
      console.error('Error searching symbols:', error)
      return []
    }
  }

  async getAccount(): Promise<TradierAccount | null> {
    try {
      const data = await callTradierProxy('/user/profile')

      if (!data?.profile?.account) {
        return null
      }

      const account = Array.isArray(data.profile.account)
        ? data.profile.account[0]
        : data.profile.account

      return account
    } catch (error) {
      console.error('Error fetching account:', error)
      return null
    }
  }

  async getBalance(accountId: string): Promise<TradierBalance | null> {
    try {
      const data = await callTradierProxy(`/accounts/${accountId}/balances`)

      if (!data?.balances) {
        return null
      }

      return data.balances
    } catch (error) {
      console.error('Error fetching balance:', error)
      return null
    }
  }

  async getPositions(accountId: string): Promise<TradierPosition[]> {
    try {
      const data = await callTradierProxy(`/accounts/${accountId}/positions`)

      if (!data?.positions?.position) {
        return []
      }

      return Array.isArray(data.positions.position)
        ? data.positions.position
        : [data.positions.position]
    } catch (error) {
      console.error('Error fetching positions:', error)
      return []
    }
  }

  async getOrders(accountId: string): Promise<TradierOrder[]> {
    try {
      const data = await callTradierProxy(`/accounts/${accountId}/orders`)

      if (!data?.orders?.order) {
        return []
      }

      return Array.isArray(data.orders.order)
        ? data.orders.order
        : [data.orders.order]
    } catch (error) {
      console.error('Error fetching orders:', error)
      return []
    }
  }

  async placeOrder(
    _accountId: string,
    _params: {
      symbol: string
      side: 'buy' | 'sell' | 'buy_to_cover' | 'sell_short'
      quantity: number
      type: 'market' | 'limit' | 'stop' | 'stop_limit'
      duration: 'day' | 'gtc' | 'pre' | 'post'
      price?: number
      stop?: number
    }
  ): Promise<TradierOrder | null> {
    // BLOCKED: This system uses Tradier for data feed only
    // All trading operations are handled internally via paper trading simulation
    throw new Error('Trading operations blocked: This system uses Tradier for market data only. All trades are executed internally via paper trading simulation.')
  }

  async cancelOrder(_accountId: string, _orderId: number): Promise<boolean> {
    // BLOCKED: This system uses Tradier for data feed only
    // All trading operations are handled internally via paper trading simulation
    throw new Error('Trading operations blocked: This system uses Tradier for market data only. All trades are executed internally via paper trading simulation.')
  }

  async getMarketClock(): Promise<{ state: string; description: string; next_state: string; next_change: string } | null> {
    try {
      const data = await callTradierProxy('/markets/clock')
      return data?.clock || null
    } catch (error) {
      console.error('Error fetching market clock:', error)
      return null
    }
  }

  async getMarketCalendar(month?: number, year?: number): Promise<any[]> {
    try {
      let endpoint = '/markets/calendar'
      if (month && year) {
        endpoint += `?month=${month}&year=${year}`
      }

      const data = await callTradierProxy(endpoint)

      if (!data?.calendar?.days?.day) {
        return []
      }

      return Array.isArray(data.calendar.days.day)
        ? data.calendar.days.day
        : [data.calendar.days.day]
    } catch (error) {
      console.error('Error fetching calendar:', error)
      return []
    }
  }
}

export const tradierClient = new TradierClient()
