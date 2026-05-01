import { supabase } from './supabase'
import { tradierClient } from './tradierApi'

export interface DailyCandle {
  id: string
  symbol: string
  trade_date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  source: 'tradier_live' | 'tradier_backfill' | 'csv_import'
  created_at: string
  updated_at: string
}

export interface BackfillProgress {
  symbol: string
  status: 'pending' | 'running' | 'done' | 'error'
  rowsInserted: number
  error?: string
}

export interface ArchiveStats {
  totalSymbols: number
  totalCandles: number
  earliestDate: string | null
  latestDate: string | null
  lastArchivedAt: string | null
}

export async function getArchiveStats(): Promise<ArchiveStats> {
  const { data, error } = await supabase
    .from('daily_candles')
    .select('symbol, trade_date, updated_at')
    .order('trade_date', { ascending: false })

  if (error || !data) {
    return { totalSymbols: 0, totalCandles: 0, earliestDate: null, latestDate: null, lastArchivedAt: null }
  }

  const symbols = new Set(data.map(r => r.symbol))
  const dates = data.map(r => r.trade_date).sort()

  return {
    totalSymbols: symbols.size,
    totalCandles: data.length,
    earliestDate: dates[0] || null,
    latestDate: dates[dates.length - 1] || null,
    lastArchivedAt: data[0]?.updated_at || null,
  }
}

export async function getSymbolCoverageMap(symbols: string[]): Promise<Map<string, { count: number; earliest: string; latest: string }>> {
  if (symbols.length === 0) return new Map()

  const { data } = await supabase
    .from('daily_candles')
    .select('symbol, trade_date')
    .in('symbol', symbols)
    .order('trade_date', { ascending: true })

  const map = new Map<string, { count: number; earliest: string; latest: string }>()
  for (const row of data || []) {
    const existing = map.get(row.symbol)
    if (!existing) {
      map.set(row.symbol, { count: 1, earliest: row.trade_date, latest: row.trade_date })
    } else {
      existing.count++
      if (row.trade_date > existing.latest) existing.latest = row.trade_date
    }
  }
  return map
}

export async function backfillSymbol(
  symbol: string,
  startDate: string,
  endDate: string,
  source: 'tradier_backfill' | 'tradier_live' | 'csv_import' = 'tradier_backfill'
): Promise<{ rowsInserted: number; error?: string }> {
  try {
    const candles = await tradierClient.getHistoricalData(symbol, 'daily', startDate, endDate)

    if (!candles || candles.length === 0) {
      return { rowsInserted: 0, error: 'No data returned from Tradier' }
    }

    const rows = candles.map(c => ({
      symbol,
      trade_date: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      source,
      updated_at: new Date().toISOString(),
    }))

    const CHUNK = 500
    let inserted = 0
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const { error } = await supabase
        .from('daily_candles')
        .upsert(chunk, { onConflict: 'symbol,trade_date' })
      if (error) return { rowsInserted: inserted, error: error.message }
      inserted += chunk.length
    }

    return { rowsInserted: inserted }
  } catch (err: any) {
    return { rowsInserted: 0, error: err?.message || 'Unknown error' }
  }
}

export async function archiveEndOfDay(symbols: string[]): Promise<{ archived: number; errors: string[] }> {
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0]

  let archived = 0
  const errors: string[] = []

  const BATCH = 5
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (symbol) => {
        const result = await backfillSymbol(symbol, dateStr, dateStr, 'tradier_live')
        if (result.error) {
          errors.push(`${symbol}: ${result.error}`)
        } else {
          archived += result.rowsInserted
        }
      })
    )
    await new Promise(r => setTimeout(r, 200))
  }

  return { archived, errors }
}

export async function getStoredCandles(
  symbol: string,
  startDate?: string,
  endDate?: string
): Promise<DailyCandle[]> {
  let query = supabase
    .from('daily_candles')
    .select('*')
    .eq('symbol', symbol)
    .order('trade_date', { ascending: true })

  if (startDate) query = query.gte('trade_date', startDate)
  if (endDate) query = query.lte('trade_date', endDate)

  const { data } = await query
  return (data || []) as DailyCandle[]
}

export async function importCandlesFromCSV(
  symbol: string,
  csvText: string
): Promise<{ rowsInserted: number; error?: string }> {
  const rows = csvText.split('\n').map(r => r.trim()).filter(Boolean)
  const parsed: Array<{ trade_date: string; open: number; high: number; low: number; close: number; volume: number }> = []

  for (const row of rows.slice(1)) {
    const cols = row.split(',').map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 5) continue

    const [date, openStr, highStr, lowStr, closeStr, volStr] = cols
    const open = parseFloat(openStr)
    const high = parseFloat(highStr)
    const low = parseFloat(lowStr)
    const close = parseFloat(closeStr)
    const volume = parseInt(volStr || '0', 10)

    if (!date || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) continue
    parsed.push({ trade_date: date, open, high, low, close, volume: isNaN(volume) ? 0 : volume })
  }

  if (parsed.length === 0) return { rowsInserted: 0, error: 'No valid rows parsed from CSV' }

  const dbRows = parsed.map(r => ({
    symbol,
    trade_date: r.trade_date,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
    source: 'csv_import' as const,
    updated_at: new Date().toISOString(),
  }))

  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < dbRows.length; i += CHUNK) {
    const chunk = dbRows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('daily_candles')
      .upsert(chunk, { onConflict: 'symbol,trade_date' })
    if (error) return { rowsInserted: inserted, error: error.message }
    inserted += chunk.length
  }

  return { rowsInserted: inserted }
}
