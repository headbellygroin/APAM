import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  Database,
  Plus,
  Trash2,
  Upload,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  TrendingUp,
  Wheat,
  Fuel,
  DollarSign,
  BarChart2,
  Globe,
  CloudRain,
  Activity,
  Info,
  CheckCircle,
  XCircle,
  Zap,
  RefreshCw,
  GitBranch,
  BarChart,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  getGlobalMacroStats,
  getMacroCorrelations,
  updateCorrelationStatus,
  promoteCorrelationToTrigger,
  getActivePatternTriggers,
  rebuildSnapshotCache,
  type MacroSignalCorrelation,
  type MacroPatternTrigger,
} from '@/lib/macroCorrelationEngine'

interface ExternalDataSource {
  id: string
  user_id: string
  name: string
  description: string
  category: string
  source_provider: string
  ticker_or_code: string
  unit: string
  frequency: string
  date_range_start: string | null
  date_range_end: string | null
  data_points_count: number
  source_url: string
  notes: string
  is_active: boolean
  created_at: string
}

interface DataPoint {
  series_date: string
  value: number
}

const CATEGORY_META: Record<string, { label: string; icon: typeof TrendingUp; color: string; description: string }> = {
  commodity: {
    label: 'Commodities',
    icon: TrendingUp,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    description: 'Gold, silver, copper, lumber, etc.',
  },
  energy: {
    label: 'Energy',
    icon: Fuel,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    description: 'Crude oil, natural gas, gasoline, heating oil',
  },
  agricultural: {
    label: 'Agricultural',
    icon: Wheat,
    color: 'text-lime-400 bg-lime-500/10 border-lime-500/20',
    description: 'Corn, wheat, soybeans, cotton, coffee, sugar',
  },
  macro_economic: {
    label: 'Macro Economic',
    icon: Globe,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    description: 'CPI, GDP, unemployment, PMI, retail sales',
  },
  interest_rates: {
    label: 'Interest Rates',
    icon: DollarSign,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    description: 'Fed funds rate, 10Y yield, yield curve',
  },
  currency: {
    label: 'Currency',
    icon: DollarSign,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    description: 'DXY, EUR/USD, JPY, currency indices',
  },
  volatility: {
    label: 'Volatility',
    icon: Activity,
    color: 'text-red-400 bg-red-500/10 border-red-500/20',
    description: 'VIX, VVIX, term structure, realized vol',
  },
  sentiment: {
    label: 'Sentiment',
    icon: BarChart2,
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    description: 'Put/call ratio, short interest, CNN Fear/Greed',
  },
  weather: {
    label: 'Weather',
    icon: CloudRain,
    color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    description: 'ENSO, drought index, temperature anomalies',
  },
  custom: {
    label: 'Custom',
    icon: Database,
    color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    description: 'Any custom dataset you upload',
  },
}

const FREE_SOURCES = [
  {
    name: 'FRED (Federal Reserve Economic Data)',
    url: 'https://fred.stlouisfed.org',
    description: 'CPI, interest rates, GDP, unemployment, yield curves. Download as CSV.',
    categories: ['macro_economic', 'interest_rates'],
    free: true,
  },
  {
    name: 'EIA (Energy Information Administration)',
    url: 'https://www.eia.gov/petroleum/data.php',
    description: 'Crude oil prices, natural gas, gasoline, heating oil — weekly going back decades.',
    categories: ['energy'],
    free: true,
  },
  {
    name: 'USDA NASS',
    url: 'https://www.nass.usda.gov/Statistics_by_Subject',
    description: 'Corn, wheat, soybean, cotton prices and production data.',
    categories: ['agricultural'],
    free: true,
  },
  {
    name: 'CBOE VIX Historical Data',
    url: 'https://www.cboe.com/tradable_products/vix/vix_historical_data',
    description: 'VIX daily open/high/low/close going back to 1990.',
    categories: ['volatility'],
    free: true,
  },
  {
    name: 'Yahoo Finance (via yfinance)',
    url: 'https://pypi.org/project/yfinance',
    description: 'Python library for bulk historical download of equities, futures, ETFs, forex.',
    categories: ['commodity', 'energy', 'currency'],
    free: true,
  },
  {
    name: 'Quandl / Nasdaq Data Link',
    url: 'https://data.nasdaq.com',
    description: 'Huge catalog including CME futures (corn, oil, gold), economic data.',
    categories: ['commodity', 'agricultural', 'energy', 'macro_economic'],
    free: false,
  },
  {
    name: 'World Bank Open Data',
    url: 'https://data.worldbank.org',
    description: 'Global macro: inflation, GDP, trade balances, commodity indices.',
    categories: ['macro_economic'],
    free: true,
  },
]

export default function ExternalDataSources() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'sources' | 'correlations' | 'triggers'>('sources')
  const [sources, setSources] = useState<ExternalDataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [sourceData, setSourceData] = useState<Map<string, DataPoint[]>>(new Map())
  const [showGuide, setShowGuide] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUploadSourceId, setPendingUploadSourceId] = useState<string | null>(null)
  const [globalStats, setGlobalStats] = useState<Awaited<ReturnType<typeof getGlobalMacroStats>> | null>(null)
  const [correlations, setCorrelations] = useState<MacroSignalCorrelation[]>([])
  const [triggers, setTriggers] = useState<MacroPatternTrigger[]>([])
  const [rebuildProgress, setRebuildProgress] = useState<number | null>(null)

  useEffect(() => {
    if (user) {
      loadSources()
      loadGlobalStats()
    }
  }, [user])

  const loadGlobalStats = async () => {
    const stats = await getGlobalMacroStats()
    setGlobalStats(stats)
  }

  const loadSources = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('external_data_sources')
      .select('*')
      .order('category', { ascending: true })
    setSources((data || []) as ExternalDataSource[])
    setLoading(false)
  }

  const loadCorrelations = async () => {
    const [corrs, trigs] = await Promise.all([
      getMacroCorrelations(),
      getActivePatternTriggers(),
    ])
    setCorrelations(corrs)
    setTriggers(trigs)
  }

  const handleRebuildCache = async () => {
    if (!globalStats) return
    const [startYear] = (globalStats.dateRangeCovered || '').split(' to ')
    if (!startYear || startYear === 'No data yet') return
    setRebuildProgress(0)
    const end = new Date().toISOString().split('T')[0]
    await rebuildSnapshotCache(startYear, end, (pct) => setRebuildProgress(pct))
    setRebuildProgress(null)
    await loadGlobalStats()
  }

  const handleTabChange = (t: typeof tab) => {
    setTab(t)
    if (t === 'correlations' || t === 'triggers') loadCorrelations()
  }

  const handleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (sourceData.has(id)) return
    const { data } = await supabase
      .from('external_data_series')
      .select('series_date, value')
      .eq('source_id', id)
      .order('series_date', { ascending: false })
      .limit(20)
    setSourceData(prev => new Map(prev).set(id, (data || []) as DataPoint[]))
  }

  const handleDelete = async (id: string) => {
    await supabase.from('external_data_sources').delete().eq('id', id)
    setSources(prev => prev.filter(s => s.id !== id))
    setExpanded(null)
  }

  const handleUploadCSV = (sourceId: string) => {
    setPendingUploadSourceId(sourceId)
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingUploadSourceId) return
    setUploading(pendingUploadSourceId)

    const text = await file.text()
    const rows = text.split('\n').map(r => r.trim()).filter(Boolean)
    const parsed: Array<{ series_date: string; value: number }> = []

    for (const row of rows.slice(1)) {
      const [rawDate, rawValue] = row.split(',').map(c => c.trim().replace(/"/g, ''))
      if (!rawDate || !rawValue) continue
      const val = parseFloat(rawValue)
      if (isNaN(val)) continue
      parsed.push({ series_date: rawDate, value: val })
    }

    if (parsed.length === 0) {
      setUploading(null)
      return
    }

    const CHUNK = 500
    for (let i = 0; i < parsed.length; i += CHUNK) {
      const chunk = parsed.slice(i, i + CHUNK).map(p => ({
        source_id: pendingUploadSourceId,
        series_date: p.series_date,
        value: p.value,
      }))
      await supabase.from('external_data_series').upsert(chunk, { onConflict: 'source_id,series_date' })
    }

    const datesSorted = parsed.map(p => p.series_date).sort()
    await supabase.from('external_data_sources').update({
      data_points_count: parsed.length,
      date_range_start: datesSorted[0],
      date_range_end: datesSorted[datesSorted.length - 1],
      updated_at: new Date().toISOString(),
    }).eq('id', pendingUploadSourceId)

    await loadSources()
    setSourceData(prev => {
      const next = new Map(prev)
      next.delete(pendingUploadSourceId!)
      return next
    })

    setUploading(null)
    setPendingUploadSourceId(null)
    e.target.value = ''
  }

  const groupedSources = sources.reduce<Record<string, ExternalDataSource[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <input
        type="file"
        accept=".csv,.txt"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="h-6 w-6 text-slate-400" />
            External Data Sources
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Shared macro knowledge base — loaded once, used by all AIs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
          >
            <Info className="h-4 w-4" />
            Where to get data
          </button>
          {tab === 'sources' && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              Add Data Source
            </button>
          )}
        </div>
      </div>

      {globalStats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Data Sources', value: globalStats.totalSources, icon: Database },
            { label: 'Data Points', value: globalStats.totalDataPoints.toLocaleString(), icon: BarChart },
            { label: 'Date Range', value: globalStats.dateRangeCovered, icon: Globe, wide: true },
            { label: 'Correlations Found', value: globalStats.totalCorrelations, icon: GitBranch },
            { label: 'Validated', value: globalStats.validatedPatterns, icon: CheckCircle },
            { label: 'Active Triggers', value: globalStats.activePatternTriggers, icon: Zap },
          ].map(stat => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className={`bg-slate-800 rounded-lg border border-slate-700 p-3 ${(stat as any).wide ? 'col-span-2' : ''}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500">{stat.label}</span>
                </div>
                <p className="text-sm font-semibold text-white truncate">{stat.value}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700 w-fit">
        {([
          { key: 'sources', label: 'Data Sources', icon: Database },
          { key: 'correlations', label: 'Discovered Correlations', icon: GitBranch },
          { key: 'triggers', label: 'Active Pattern Triggers', icon: Zap },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              tab === t.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {showGuide && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Where to Get Historical Data</h3>
            <button onClick={() => setShowGuide(false)} className="text-slate-400 hover:text-white">
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-medium text-blue-300 mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" />
              How This Works
            </h4>
            <div className="text-sm text-slate-400 space-y-1">
              <p>
                External data gives the AI <strong className="text-white">context signals</strong> during simulation.
                For example, when testing an energy stock like <strong className="text-white">XOM</strong> during 2008,
                the AI can see that crude oil was at $145/barrel in July and dropped to $35 by December —
                and learn that oil price direction is a leading signal for energy stock performance.
              </p>
              <p className="mt-2">
                Similarly, a grain processor stock (like ADM) tested against corn price data lets the AI
                discover cost-pressure patterns. A bank stock tested alongside the yield curve lets it
                learn margin compression signals.
              </p>
              <p className="mt-2">
                <strong className="text-white">Format:</strong> Upload a CSV with two columns — <code className="bg-slate-700 px-1 rounded">date,value</code>.
                Date format: <code className="bg-slate-700 px-1 rounded">YYYY-MM-DD</code>.
                The first row is treated as a header and skipped.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FREE_SOURCES.map(src => (
              <div key={src.name} className="bg-slate-900/50 rounded-lg border border-slate-700 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{src.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                        src.free ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {src.free ? 'Free' : 'Paid/Freemium'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{src.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {src.categories.map(c => {
                        const m = CATEGORY_META[c]
                        return m ? (
                          <span key={c} className={`text-xs px-1.5 py-0.5 rounded-full border ${m.color}`}>
                            {m.label}
                          </span>
                        ) : null
                      })}
                    </div>
                  </div>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddForm && (
        <AddSourceForm
          userId={user?.id || ''}
          onSaved={() => { setShowAddForm(false); loadSources() }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {tab === 'sources' && (
        loading ? (
          <div className="text-center py-12 text-slate-400">Loading data sources...</div>
        ) : sources.length === 0 ? (
          <div className="text-center py-16">
            <Database className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No external data sources yet.</p>
            <p className="text-sm text-slate-500 max-w-lg mx-auto">
              Add macro and alternative datasets here. Load them once and every AI in the system will
              use them as context during historical simulation. Corn prices, crude oil, interest rates,
              VIX — all get cross-referenced automatically.
            </p>
            <button
              onClick={() => setShowGuide(true)}
              className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              See where to get data
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Data is global — loaded once and available to all AIs and simulations.
              </p>
              <button
                onClick={handleRebuildCache}
                disabled={rebuildProgress !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${rebuildProgress !== null ? 'animate-spin' : ''}`} />
                {rebuildProgress !== null ? `Rebuilding cache ${rebuildProgress}%...` : 'Rebuild Snapshot Cache'}
              </button>
            </div>
            {Object.entries(groupedSources).map(([category, categorySources]) => {
              const meta = CATEGORY_META[category] || CATEGORY_META.custom
              const Icon = meta.icon
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${meta.color.split(' ')[0]}`} />
                    <span className="text-sm font-medium text-slate-300">{meta.label}</span>
                    <span className="text-xs text-slate-500">({categorySources.length})</span>
                  </div>
                  <div className="space-y-2">
                    {categorySources.map(source => (
                      <SourceCard
                        key={source.id}
                        source={source}
                        isExpanded={expanded === source.id}
                        dataPoints={sourceData.get(source.id) || []}
                        uploading={uploading === source.id}
                        onExpand={() => handleExpand(source.id)}
                        onDelete={() => handleDelete(source.id)}
                        onUpload={() => handleUploadCSV(source.id)}
                        categoryMeta={meta}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {tab === 'correlations' && (
        <CorrelationsPanel
          correlations={correlations}
          onStatusChange={async (id, status) => {
            await updateCorrelationStatus(id, status)
            await loadCorrelations()
          }}
          onPromote={async (corr) => {
            const name = prompt(`Pattern name for: ${corr.name}`, corr.name)
            if (!name) return
            await promoteCorrelationToTrigger(corr, name, corr.description)
            await loadCorrelations()
          }}
        />
      )}

      {tab === 'triggers' && (
        <TriggersPanel triggers={triggers} onRefresh={loadCorrelations} />
      )}
    </div>
  )
}

function SourceCard({
  source, isExpanded, dataPoints, uploading,
  onExpand, onDelete, onUpload, categoryMeta,
}: {
  source: ExternalDataSource
  isExpanded: boolean
  dataPoints: DataPoint[]
  uploading: boolean
  onExpand: () => void
  onDelete: () => void
  onUpload: () => void
  categoryMeta: typeof CATEGORY_META[string]
}) {
  const Icon = categoryMeta.icon
  const hasData = source.data_points_count > 0

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800">
      <button
        onClick={onExpand}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-1.5 rounded-lg border ${categoryMeta.color}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{source.name}</span>
              {source.ticker_or_code && (
                <span className="text-xs text-slate-500 font-mono">{source.ticker_or_code}</span>
              )}
              {hasData ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {source.data_points_count.toLocaleString()} pts
                </span>
              ) : (
                <span className="text-xs text-amber-400">No data uploaded</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
              {source.source_provider && <span>{source.source_provider}</span>}
              {source.unit && <span>Unit: {source.unit}</span>}
              {source.date_range_start && source.date_range_end && (
                <span>{source.date_range_start} to {source.date_range_end}</span>
              )}
              <span className="capitalize">{source.frequency}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-700 p-4 space-y-3">
          {source.description && (
            <p className="text-sm text-slate-400">{source.description}</p>
          )}
          {source.notes && (
            <p className="text-xs text-slate-500 italic">{source.notes}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onUpload}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? 'Uploading...' : hasData ? 'Replace Data (CSV)' : 'Upload CSV'}
            </button>
            {source.source_url && (
              <a
                href={source.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Source
              </a>
            )}
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 text-white rounded-lg text-sm hover:bg-red-700 transition-colors ml-auto"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">
              CSV Format: <code className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">date,value</code>
            </p>
            <p className="text-xs text-slate-500">
              Example row: <code className="text-slate-400">2023-01-03,75.84</code>
            </p>
          </div>

          {dataPoints.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">
                Recent data points (most recent first)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-500">
                      <th className="text-left py-1 px-2">Date</th>
                      <th className="text-right py-1 px-2">Value ({source.unit || 'units'})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataPoints.slice(0, 10).map(dp => (
                      <tr key={dp.series_date} className="border-b border-slate-800">
                        <td className="py-1 px-2 text-slate-400">{dp.series_date}</td>
                        <td className="py-1 px-2 text-right text-white">{Number(dp.value).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddSourceForm({
  userId,
  onSaved,
  onCancel,
}: {
  userId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('energy')
  const [provider, setProvider] = useState('')
  const [ticker, setTicker] = useState('')
  const [unit, setUnit] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedSourceId, setSavedSourceId] = useState<string | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ count: number; error?: string } | null>(null)
  const inlineFileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !userId) return
    setSaving(true)

    const { data, error } = await supabase.from('external_data_sources').insert({
      user_id: userId,
      name: name.trim(),
      description: description.trim(),
      category,
      source_provider: provider.trim(),
      ticker_or_code: ticker.trim().toUpperCase(),
      unit: unit.trim(),
      frequency,
      source_url: sourceUrl.trim(),
      notes: notes.trim(),
    }).select('id').maybeSingle()

    setSaving(false)
    if (!error && data) {
      setSavedSourceId(data.id)
    } else if (!error) {
      onSaved()
    }
  }

  const handleInlineUpload = async () => {
    if (!csvFile || !savedSourceId) return
    setUploading(true)
    setUploadResult(null)

    const text = await csvFile.text()
    const rows = text.split('\n').map(r => r.trim()).filter(Boolean)
    const parsed: Array<{ series_date: string; value: number }> = []

    for (const row of rows.slice(1)) {
      const [rawDate, rawValue] = row.split(',').map(c => c.trim().replace(/"/g, ''))
      if (!rawDate || !rawValue) continue
      const val = parseFloat(rawValue)
      if (isNaN(val)) continue
      parsed.push({ series_date: rawDate, value: val })
    }

    if (parsed.length === 0) {
      setUploadResult({ count: 0, error: 'No valid rows found in CSV' })
      setUploading(false)
      return
    }

    const CHUNK = 500
    for (let i = 0; i < parsed.length; i += CHUNK) {
      const chunk = parsed.slice(i, i + CHUNK).map(p => ({
        source_id: savedSourceId,
        series_date: p.series_date,
        value: p.value,
      }))
      await supabase.from('external_data_series').upsert(chunk, { onConflict: 'source_id,series_date' })
    }

    const datesSorted = parsed.map(p => p.series_date).sort()
    await supabase.from('external_data_sources').update({
      data_points_count: parsed.length,
      date_range_start: datesSorted[0],
      date_range_end: datesSorted[datesSorted.length - 1],
      updated_at: new Date().toISOString(),
    }).eq('id', savedSourceId)

    setUploadResult({ count: parsed.length })
    setUploading(false)
  }

  if (savedSourceId) {
    return (
      <div className="bg-slate-800 rounded-lg border border-emerald-500/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          <h3 className="text-base font-semibold text-white">Source saved — upload your CSV data</h3>
        </div>

        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 mb-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Expected CSV format</p>
          <code className="text-xs text-slate-300 block">date,value</code>
          <code className="text-xs text-slate-500 block mt-0.5">2024-01-02,75.84</code>
          <p className="text-xs text-slate-500 mt-1.5">Two columns only. First row is header and will be skipped. Date format: YYYY-MM-DD.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Select CSV file</label>
            <input
              ref={inlineFileRef}
              type="file"
              accept=".csv,.txt"
              onChange={e => setCsvFile(e.target.files?.[0] || null)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-700 file:text-slate-300 hover:file:bg-slate-600"
            />
          </div>

          {uploadResult && !uploadResult.error && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              {uploadResult.count.toLocaleString()} data points uploaded successfully
            </div>
          )}
          {uploadResult?.error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              {uploadResult.error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleInlineUpload}
              disabled={uploading || !csvFile}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
            >
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload CSV
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onSaved}
              className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
            >
              {uploadResult?.count ? 'Done' : 'Skip — Upload Later'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-blue-500/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Plus className="h-5 w-5 text-blue-400" />
          Add External Data Source
        </h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-white">
          <XCircle className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. WTI Crude Oil Price"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {Object.entries(CATEGORY_META).map(([key, m]) => (
                <option key={key} value={key}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What this data is, what stocks it relates to, why it matters..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-16 resize-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Source Provider</label>
            <input
              type="text"
              value={provider}
              onChange={e => setProvider(e.target.value)}
              placeholder="e.g. EIA, FRED, USDA"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Ticker / Code</label>
            <input
              type="text"
              value={ticker}
              onChange={e => setTicker(e.target.value)}
              placeholder="e.g. WTI, CL1, DCOILWTICO"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Unit</label>
            <input
              type="text"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="e.g. $/barrel, $/bushel, %"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Source URL (optional)</label>
            <input
              type="url"
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Which stocks this is relevant to, download instructions, etc."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-14 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save & Upload Data'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

const CONFIDENCE_COLORS: Record<string, string> = {
  low: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  high: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  very_high: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
}

const STATUS_COLORS: Record<string, string> = {
  candidate: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  monitoring: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  validated: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  rejected: 'text-red-400 bg-red-500/10 border-red-500/20',
}

function CorrelationsPanel({
  correlations,
  onStatusChange,
  onPromote,
}: {
  correlations: MacroSignalCorrelation[]
  onStatusChange: (id: string, status: MacroSignalCorrelation['status']) => void
  onPromote: (corr: MacroSignalCorrelation) => void
}) {
  if (correlations.length === 0) {
    return (
      <div className="text-center py-16">
        <GitBranch className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 mb-2">No correlations discovered yet.</p>
        <p className="text-sm text-slate-500 max-w-lg mx-auto">
          Correlations are discovered automatically when historical fleet simulations complete.
          Run a simulation with external data sources loaded and the AI will identify which
          macro conditions were consistently present during winning and losing trades.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400 space-y-1">
            <p>
              These correlations were discovered by the AI during historical simulations.
              They represent observations like <em className="text-white">"winning trades in energy stocks occurred when crude oil
              was above $75/barrel AND the VIX was below 20"</em> — connections the AI found without being told to look for them.
            </p>
            <p>
              Promote high-confidence correlations to <strong className="text-white">Active Pattern Triggers</strong> to make them
              available as live signals across all AI accounts.
            </p>
          </div>
        </div>
      </div>

      {correlations.map(corr => (
        <div key={corr.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{corr.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[corr.status] || STATUS_COLORS.candidate}`}>
                  {corr.status}
                </span>
                {corr.promoted_to_ruleset && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full border text-blue-400 bg-blue-500/10 border-blue-500/20">
                    promoted
                  </span>
                )}
              </div>
              {corr.description && (
                <p className="text-xs text-slate-500 mt-1">{corr.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
              <div className="text-right">
                <p className="text-lg font-bold text-white">{(corr.hit_rate * 100).toFixed(0)}%</p>
                <p className="text-xs text-slate-500">hit rate</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-slate-500">Wins w/ signal</p>
              <p className="text-white font-medium">{corr.hit_count}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-slate-500">Misses</p>
              <p className="text-white font-medium">{corr.miss_count}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-slate-500">Significance</p>
              <p className={`font-medium ${corr.significance_score > 0.4 ? 'text-emerald-400' : corr.significance_score > 0.2 ? 'text-yellow-400' : 'text-slate-400'}`}>
                {(corr.significance_score * 100).toFixed(0)}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-slate-500">Outcome</p>
              <p className="text-white font-medium capitalize">{corr.outcome_type.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {corr.status === 'candidate' && (
              <button
                onClick={() => onStatusChange(corr.id, 'monitoring')}
                className="text-xs px-2.5 py-1 bg-yellow-600/80 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Start Monitoring
              </button>
            )}
            {(corr.status === 'monitoring' || corr.status === 'candidate') && (
              <button
                onClick={() => onStatusChange(corr.id, 'validated')}
                className="text-xs px-2.5 py-1 bg-emerald-600/80 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Validate
              </button>
            )}
            {corr.status !== 'rejected' && (
              <button
                onClick={() => onStatusChange(corr.id, 'rejected')}
                className="text-xs px-2.5 py-1 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Reject
              </button>
            )}
            {!corr.promoted_to_ruleset && corr.status === 'validated' && (
              <button
                onClick={() => onPromote(corr)}
                className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <Zap className="h-3 w-3" />
                Promote to Active Trigger
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function TriggersPanel({
  triggers,
  onRefresh,
}: {
  triggers: MacroPatternTrigger[]
  onRefresh: () => void
}) {
  if (triggers.length === 0) {
    return (
      <div className="text-center py-16">
        <Zap className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 mb-2">No active pattern triggers yet.</p>
        <p className="text-sm text-slate-500 max-w-lg mx-auto">
          Validate discovered correlations and promote them to Active Triggers.
          Once active, these patterns fire across all AI accounts in real time —
          when conditions A + B + C are all present, the AI is alerted that outcome D historically follows.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          These patterns fire in real time across all AI accounts and simulations. When all conditions are met on a given date, the AI flags it.
        </p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-600 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {triggers.map(trigger => (
        <div key={trigger.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{trigger.pattern_name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full border ${CONFIDENCE_COLORS[trigger.confidence_level] || CONFIDENCE_COLORS.low}`}>
                  {trigger.confidence_level.replace('_', ' ')} confidence
                </span>
                {trigger.is_active && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-500/20 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    active
                  </span>
                )}
              </div>
              {trigger.description && (
                <p className="text-xs text-slate-500 mt-1">{trigger.description}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-bold text-white">{(trigger.success_rate * 100).toFixed(0)}%</p>
              <p className="text-xs text-slate-500">{trigger.occurrence_count} occurrences</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-slate-500">Avg outcome</p>
              <p className={`font-medium ${trigger.avg_outcome_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {trigger.avg_outcome_pct > 0 ? '+' : ''}{trigger.avg_outcome_pct.toFixed(1)}%
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-slate-500">Best</p>
              <p className="text-emerald-400 font-medium">+{trigger.best_outcome_pct.toFixed(1)}%</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-slate-500">Worst</p>
              <p className="text-red-400 font-medium">{trigger.worst_outcome_pct.toFixed(1)}%</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2">
              <p className="text-slate-500">Avg days</p>
              <p className="text-white font-medium">{trigger.avg_days_to_outcome}d</p>
            </div>
          </div>

          {trigger.condition_set && Array.isArray(trigger.condition_set) && trigger.condition_set.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Trigger conditions (all must be true):</p>
              <div className="space-y-1">
                {(trigger.condition_set as any[]).map((cond: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-4">{i + 1}.</span>
                    <span className="text-slate-300">
                      {cond.source_name || cond.source_id}
                    </span>
                    <span className="text-slate-500 font-mono">{cond.operator}</span>
                    <span className="text-white font-mono">
                      {cond.value !== undefined ? cond.value :
                       cond.value_low !== undefined ? `${cond.value_low} – ${cond.value_high}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trigger.applicable_symbols.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {trigger.applicable_symbols.map(sym => (
                <span key={sym} className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded font-mono">{sym}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
