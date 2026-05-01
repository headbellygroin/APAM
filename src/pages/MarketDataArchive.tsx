import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  Archive,
  Plus,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Calendar,
  Database,
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import {
  backfillSymbol,
  getArchiveStats,
  getSymbolCoverageMap,
  importCandlesFromCSV,
  archiveEndOfDay,
  type ArchiveStats,
  type BackfillProgress,
} from '@/lib/marketArchiveService'

const PRESET_SYMBOL_LISTS: Record<string, string[]> = {
  'SP500 Core (30)': ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'META', 'BRK.B', 'LLY', 'AVGO', 'JPM',
    'UNH', 'XOM', 'TSLA', 'V', 'PG', 'MA', 'COST', 'JNJ', 'HD', 'MRK',
    'ABBV', 'CVX', 'BAC', 'KO', 'PEP', 'ADBE', 'WMT', 'CRM', 'TMO', 'ACN'],
  'ETFs (Major)': ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'GLD', 'SLV', 'TLT', 'HYG', 'EEM',
    'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE'],
  'Sector Leaders': ['XOM', 'CVX', 'JPM', 'BAC', 'AAPL', 'MSFT', 'JNJ', 'UNH', 'WMT', 'COST',
    'HD', 'LOW', 'CAT', 'DE', 'BA', 'LMT', 'NFLX', 'DIS', 'CMCSA', 'VZ'],
}

type BackfillMode = 'tradier' | 'csv'

interface SymbolEntry {
  symbol: string
  startDate: string
  endDate: string
}

export default function MarketDataArchive() {
  const { user } = useAuth()
  const [stats, setStats] = useState<ArchiveStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  const [tab, setTab] = useState<'backfill' | 'eod' | 'coverage'>('backfill')

  const [mode, setMode] = useState<BackfillMode>('tradier')
  const [symbolInput, setSymbolInput] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 5)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [queue, setQueue] = useState<SymbolEntry[]>([])
  const [progress, setProgress] = useState<BackfillProgress[]>([])
  const [running, setRunning] = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  const [csvSymbol, setCsvSymbol] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<{ rowsInserted: number; error?: string } | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const [eodSymbolInput, setEodSymbolInput] = useState('')
  const [eodRunning, setEodRunning] = useState(false)
  const [eodResult, setEodResult] = useState<{ archived: number; errors: string[] } | null>(null)

  const [coverageSymbols, setCoverageSymbols] = useState('')
  const [coverageMap, setCoverageMap] = useState<Map<string, { count: number; earliest: string; latest: string }>>(new Map())
  const [coverageLoading, setCoverageLoading] = useState(false)

  const abortRef = useRef(false)

  useEffect(() => {
    if (user) loadStats()
  }, [user])

  const loadStats = async () => {
    setLoadingStats(true)
    const s = await getArchiveStats()
    setStats(s)
    setLoadingStats(false)
  }

  const addSymbolsToQueue = () => {
    const syms = symbolInput.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
    const entries: SymbolEntry[] = syms.map(s => ({ symbol: s, startDate, endDate }))
    setQueue(prev => {
      const existing = new Set(prev.map(e => e.symbol))
      return [...prev, ...entries.filter(e => !existing.has(e.symbol))]
    })
    setSymbolInput('')
  }

  const addPreset = (symbols: string[]) => {
    setQueue(prev => {
      const existing = new Set(prev.map(e => e.symbol))
      const entries: SymbolEntry[] = symbols
        .filter(s => !existing.has(s))
        .map(s => ({ symbol: s, startDate, endDate }))
      return [...prev, ...entries]
    })
    setShowPresets(false)
  }

  const removeFromQueue = (symbol: string) => {
    setQueue(prev => prev.filter(e => e.symbol !== symbol))
    setProgress(prev => prev.filter(p => p.symbol !== symbol))
  }

  const runBackfill = async () => {
    if (queue.length === 0 || running) return
    setRunning(true)
    abortRef.current = false

    setProgress(queue.map(e => ({ symbol: e.symbol, status: 'pending', rowsInserted: 0 })))

    for (const entry of queue) {
      if (abortRef.current) break

      setProgress(prev => prev.map(p =>
        p.symbol === entry.symbol ? { ...p, status: 'running' } : p
      ))

      const result = await backfillSymbol(entry.symbol, entry.startDate, entry.endDate, 'tradier_backfill')

      setProgress(prev => prev.map(p =>
        p.symbol === entry.symbol
          ? { ...p, status: result.error ? 'error' : 'done', rowsInserted: result.rowsInserted, error: result.error }
          : p
      ))

      await new Promise(r => setTimeout(r, 300))
    }

    setRunning(false)
    await loadStats()
  }

  const handleCsvUpload = async () => {
    if (!csvFile || !csvSymbol.trim()) return
    setCsvUploading(true)
    setCsvResult(null)
    const text = await csvFile.text()
    const result = await importCandlesFromCSV(csvSymbol.trim().toUpperCase(), text)
    setCsvResult(result)
    setCsvUploading(false)
    if (!result.error) {
      setCsvFile(null)
      setCsvSymbol('')
      if (csvInputRef.current) csvInputRef.current.value = ''
      await loadStats()
    }
  }

  const handleEodArchive = async () => {
    const syms = eodSymbolInput.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
    if (syms.length === 0) return
    setEodRunning(true)
    setEodResult(null)
    const result = await archiveEndOfDay(syms)
    setEodResult(result)
    setEodRunning(false)
    await loadStats()
  }

  const handleCheckCoverage = async () => {
    const syms = coverageSymbols.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
    if (syms.length === 0) return
    setCoverageLoading(true)
    const map = await getSymbolCoverageMap(syms)
    setCoverageMap(map)
    setCoverageLoading(false)
  }

  const totalDone = progress.filter(p => p.status === 'done').length
  const totalError = progress.filter(p => p.status === 'error').length
  const totalRows = progress.reduce((sum, p) => sum + p.rowsInserted, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Archive className="h-6 w-6 text-slate-400" />
            Market Data Archive
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Build and maintain a persistent historical candle database from Tradier or CSV imports
          </p>
        </div>
        <button
          onClick={loadStats}
          disabled={loadingStats}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Symbols Archived', value: stats.totalSymbols.toLocaleString(), icon: BarChart3 },
            { label: 'Total Candles', value: stats.totalCandles.toLocaleString(), icon: Database },
            { label: 'Earliest Date', value: stats.earliestDate || '—', icon: Calendar },
            { label: 'Latest Date', value: stats.latestDate || '—', icon: Calendar },
            { label: 'Last Updated', value: stats.lastArchivedAt ? new Date(stats.lastArchivedAt).toLocaleDateString() : '—', icon: Clock },
          ].map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="bg-slate-800 rounded-lg border border-slate-700 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500">{stat.label}</span>
                </div>
                <p className="text-sm font-semibold text-white">{stat.value}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700 w-fit">
        {([
          { key: 'backfill', label: 'Historical Backfill', icon: Download },
          { key: 'eod', label: 'End-of-Day Archive', icon: Clock },
          { key: 'coverage', label: 'Coverage Check', icon: Search },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              tab === t.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'backfill' && (
        <div className="space-y-4">
          <div className="flex gap-1 bg-slate-900 rounded-lg p-1 border border-slate-700 w-fit">
            <button
              onClick={() => setMode('tradier')}
              className={`px-3 py-1 rounded text-sm transition-colors ${mode === 'tradier' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Pull from Tradier API
            </button>
            <button
              onClick={() => setMode('csv')}
              className={`px-3 py-1 rounded text-sm transition-colors ${mode === 'csv' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Import from CSV
            </button>
          </div>

          {mode === 'tradier' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white">Add Symbols to Backfill Queue</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Symbols (comma or space separated)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={symbolInput}
                      onChange={e => setSymbolInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSymbolsToQueue()}
                      placeholder="AAPL MSFT TSLA or AAPL, MSFT, TSLA"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                    <button
                      onClick={addSymbolsToQueue}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => setShowPresets(!showPresets)}
                    className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {showPresets ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Load preset symbol list
                  </button>
                  {showPresets && (
                    <div className="mt-2 space-y-2">
                      {Object.entries(PRESET_SYMBOL_LISTS).map(([name, symbols]) => (
                        <button
                          key={name}
                          onClick={() => addPreset(symbols)}
                          className="w-full text-left flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg hover:border-blue-500/50 transition-colors"
                        >
                          <span className="text-sm text-white">{name}</span>
                          <span className="text-xs text-slate-500">{symbols.length} symbols</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {queue.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={runBackfill}
                      disabled={running}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm font-medium"
                    >
                      {running ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Running... ({totalDone}/{queue.length})
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Start Backfill ({queue.length} symbols)
                        </>
                      )}
                    </button>
                    {running && (
                      <button
                        onClick={() => { abortRef.current = true }}
                        className="px-3 py-2 bg-red-600/80 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                )}

                {progress.length > 0 && (
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span className="text-emerald-400">{totalDone} done</span>
                    <span className="text-red-400">{totalError} errors</span>
                    <span className="text-white">{totalRows.toLocaleString()} rows inserted</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Queue ({queue.length})</h3>
                  {queue.length > 0 && !running && (
                    <button
                      onClick={() => { setQueue([]); setProgress([]) }}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {queue.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No symbols queued yet.</p>
                    <p className="text-xs text-slate-600 mt-1">Add symbols above or load a preset.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {queue.map(entry => {
                      const prog = progress.find(p => p.symbol === entry.symbol)
                      return (
                        <div key={entry.symbol} className="flex items-center justify-between py-1.5 px-2 bg-slate-900/50 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            {!prog && <Clock className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />}
                            {prog?.status === 'running' && <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin flex-shrink-0" />}
                            {prog?.status === 'done' && <CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                            {prog?.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
                            {prog?.status === 'pending' && <Clock className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />}
                            <span className="text-sm font-mono text-white">{entry.symbol}</span>
                            {prog?.status === 'done' && (
                              <span className="text-xs text-slate-500">{prog.rowsInserted} rows</span>
                            )}
                            {prog?.status === 'error' && (
                              <span className="text-xs text-red-400 truncate">{prog.error}</span>
                            )}
                          </div>
                          {!running && (
                            <button onClick={() => removeFromQueue(entry.symbol)} className="text-slate-600 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === 'csv' && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 max-w-xl space-y-4">
              <h3 className="text-sm font-semibold text-white">Import OHLCV from CSV</h3>

              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400 font-medium mb-1">Expected CSV format</p>
                <code className="text-xs text-slate-300 block">date,open,high,low,close,volume</code>
                <code className="text-xs text-slate-500 block mt-0.5">2024-01-02,185.20,188.44,183.75,185.85,79568900</code>
                <p className="text-xs text-slate-500 mt-1.5">First row is treated as header and skipped. Date format: YYYY-MM-DD.</p>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Symbol</label>
                <input
                  type="text"
                  value={csvSymbol}
                  onChange={e => setCsvSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. AAPL"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">CSV File</label>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={e => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-700 file:text-slate-300 hover:file:bg-slate-600"
                />
              </div>

              <button
                onClick={handleCsvUpload}
                disabled={csvUploading || !csvSymbol.trim() || !csvFile}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
              >
                {csvUploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </>
                )}
              </button>

              {csvResult && (
                <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${csvResult.error ? 'bg-red-900/20 border border-red-500/30 text-red-400' : 'bg-emerald-900/20 border border-emerald-500/30 text-emerald-400'}`}>
                  {csvResult.error ? <XCircle className="h-4 w-4 flex-shrink-0" /> : <CheckCircle className="h-4 w-4 flex-shrink-0" />}
                  {csvResult.error ? csvResult.error : `${csvResult.rowsInserted.toLocaleString()} candles imported successfully`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'eod' && (
        <div className="space-y-4 max-w-xl">
          <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-400">
                <p>Run this after market close (4 PM ET) to archive today's candle for each symbol.</p>
                <p className="mt-1">This saves the day's OHLCV data permanently so it becomes part of your historical dataset for future backtests.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Archive Today's Candles</h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Symbols to archive (comma or space separated)</label>
              <textarea
                value={eodSymbolInput}
                onChange={e => setEodSymbolInput(e.target.value)}
                placeholder="AAPL MSFT TSLA NVDA SPY QQQ..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-20 resize-none font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEodSymbolInput(PRESET_SYMBOL_LISTS['SP500 Core (30)'].join(' '))}
                className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
              >
                Load SP500 Core
              </button>
              <button
                onClick={() => setEodSymbolInput(PRESET_SYMBOL_LISTS['ETFs (Major)'].join(' '))}
                className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
              >
                Load ETFs
              </button>
            </div>

            <button
              onClick={handleEodArchive}
              disabled={eodRunning || !eodSymbolInput.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm"
            >
              {eodRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  Archive Today's Candles
                </>
              )}
            </button>

            {eodResult && (
              <div className="space-y-2">
                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  {eodResult.archived} candles archived successfully
                </div>
                {eodResult.errors.length > 0 && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 space-y-1">
                    <p className="text-xs text-red-400 font-medium">{eodResult.errors.length} errors:</p>
                    {eodResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-400/80">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'coverage' && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Check Symbol Coverage</h3>
            <p className="text-xs text-slate-500">See how many candles are stored for each symbol and what date range is covered.</p>

            <div className="flex gap-2">
              <textarea
                value={coverageSymbols}
                onChange={e => setCoverageSymbols(e.target.value)}
                placeholder="AAPL MSFT TSLA SPY QQQ..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-16 resize-none font-mono"
              />
              <button
                onClick={handleCheckCoverage}
                disabled={coverageLoading || !coverageSymbols.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm self-start"
              >
                {coverageLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Check
              </button>
            </div>
          </div>

          {coverageMap.size > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-sm font-medium text-white">{coverageMap.size} symbols checked</p>
              </div>
              <div className="divide-y divide-slate-700/50">
                {Array.from(coverageMap.entries()).map(([symbol, data]) => (
                  <div key={symbol} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-mono text-white">{symbol}</span>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="text-white font-medium">{data.count.toLocaleString()} candles</span>
                      <span>{data.earliest} → {data.latest}</span>
                    </div>
                  </div>
                ))}
                {Array.from(
                  coverageSymbols.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(s => s && !coverageMap.has(s))
                ).map(missing => (
                  <div key={missing} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-mono text-white">{missing}</span>
                    <span className="text-xs text-slate-600">No data archived</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
