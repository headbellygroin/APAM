import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { aiEngine, ScanProgress } from '@/lib/aiEngine'
import { tradeSimulator } from '@/lib/tradeSimulator'
import { signalService, Signal } from '@/lib/signalService'
import { trackRecordService, TrackRecord } from '@/lib/signalTrackRecord'
import { followModeService, FollowModeSettings } from '@/lib/followMode'
import { getMarketSymbols, getSegmentCount, MarketSegment } from '@/lib/marketScanner'
import { listBaseStrategies } from '@/lib/strategies'
import {
  loadMarketScannerStrategyIds,
  saveMarketScannerStrategyIds,
} from '@/lib/marketScanStrategies'
import SignalCard from '@/components/SignalCard'
import PostTradeScorecard from '@/components/PostTradeScorecard'
import PostMortem from '@/components/PostMortem'
import TrackRecordPanel from '@/components/TrackRecordPanel'
import CopyTracker from '@/components/CopyTracker'
import {
  Radio,
  Search,
  History,
  BarChart3,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Zap,
  AlertCircle,
  Brain,
  Users,
  Globe,
} from 'lucide-react'

type Tab = 'live' | 'history' | 'track_record'

export default function LiveSignals() {
  const { user, isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('live')
  const [activeSignals, setActiveSignals] = useState<Signal[]>([])
  const [closedSignals, setClosedSignals] = useState<Signal[]>([])
  const [trackRecords, setTrackRecords] = useState<TrackRecord[]>([])
  const [recordMap, setRecordMap] = useState<Map<string, TrackRecord>>(new Map())
  const [followSettings, setFollowSettings] = useState<FollowModeSettings | null>(null)
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([])
  const [paperAccount, setPaperAccount] = useState<any>(null)
  const [scanning, setScanning] = useState(false)
  const [executing, setExecuting] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoExecuteResults, setAutoExecuteResults] = useState<string[]>([])
  const [aiMode, setAIMode] = useState<'personal' | 'master'>('personal')
  const [scanMode, setScanMode] = useState<'watchlist' | 'market'>('market')
  const [marketSegment, setMarketSegment] = useState<MarketSegment>('sp500')
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [scannerStrategyIds, setScannerStrategyIds] = useState<string[]>(() =>
    loadMarketScannerStrategyIds()
  )

  useEffect(() => {
    if (user) {
      loadAll()
    }
  }, [user])

  useEffect(() => {
    saveMarketScannerStrategyIds(scannerStrategyIds)
  }, [scannerStrategyIds])

  const toggleScannerStrategy = (id: string) => {
    setScannerStrategyIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      const bases = listBaseStrategies().map((s) => s.id)
      const filtered = next.filter((x) => bases.includes(x))
      return filtered.length > 0 ? filtered : prev
    })
  }

  const loadAll = async () => {
    if (!user) return
    setLoading(true)
    await Promise.all([
      loadSignals(),
      loadTrackRecords(),
      loadFollowSettings(),
      loadWatchlist(),
      loadPaperAccount(),
    ])
    setLoading(false)
  }

  const loadSignals = async () => {
    if (!user) return
    const [active, closed] = await Promise.all([
      signalService.getActiveSignals(user.id),
      signalService.getClosedSignals(user.id),
    ])
    setActiveSignals(active)
    setClosedSignals(closed)
  }

  const loadTrackRecords = async () => {
    if (!user) return
    const records = await trackRecordService.getTrackRecords(user.id)
    setTrackRecords(records)
    const map = new Map<string, TrackRecord>()
    records.forEach(r => map.set(r.pattern_key, r))
    setRecordMap(map)
  }

  const loadFollowSettings = async () => {
    if (!user) return
    const settings = await followModeService.getSettings(user.id)
    setFollowSettings(settings)
  }

  const loadWatchlist = async () => {
    if (!user) return
    const { data } = await supabase
      .from('watchlists')
      .select('symbol')
      .eq('user_id', user.id)
    if (data) setWatchlistSymbols(data.map(w => w.symbol))
  }

  const loadPaperAccount = async () => {
    if (!user) return
    const account = await tradeSimulator.getPaperAccount(user.id)
    setPaperAccount(account)
  }

  const runScan = async () => {
    if (!user) return

    let symbolsToScan: string[]
    if (scanMode === 'watchlist') {
      if (watchlistSymbols.length === 0) {
        alert('Add symbols to your watchlist first!')
        return
      }
      symbolsToScan = watchlistSymbols
    } else {
      symbolsToScan = getMarketSymbols(marketSegment)
    }

    setScanning(true)
    setScanProgress(null)
    setAutoExecuteResults([])
    try {
      const results = await aiEngine.scanMarket(
        symbolsToScan,
        6,
        (isAdmin && aiMode === 'master') ? undefined : user.id,
        (progress) => setScanProgress(progress),
        { strategyIds: scannerStrategyIds }
      )
      const patternStats = aiEngine.getPatternStats()

      const symbolSet = [...new Set(results.map((r) => r.recommendation.symbol))]
      const { data: existingActive } = symbolSet.length
        ? await supabase
            .from('signal_queue')
            .select('symbol, strategy_id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .in('symbol', symbolSet)
        : { data: [] as { symbol: string; strategy_id: string }[] }

      const existingKeys = new Set(
        (existingActive || []).map((r) => `${r.symbol}|${r.strategy_id || ''}`)
      )

      for (const result of results) {
        const rec = result.recommendation
        const dedupeKey = `${rec.symbol}|${rec.strategyId}`
        if (existingKeys.has(dedupeKey)) continue

        const patternKey = `${rec.reasoning.curvePosition}-${rec.reasoning.trendDirection}-${rec.reasoning.zoneType}`
        const perf = patternStats.get(patternKey)
        const winRate = perf ? perf.wins / (perf.wins + perf.losses || 1) : 0.5
        const tradeCount = perf ? perf.wins + perf.losses : 0

        const signal = await signalService.persistSignal(user.id, rec, winRate, tradeCount)
        if (!signal) continue

        existingKeys.add(dedupeKey)

        await trackRecordService.incrementSignalCount(user.id, patternKey)

        const autoResult = await followModeService.tryAutoExecute(user.id, signal, rec)
        if (autoResult.executed) {
          setAutoExecuteResults(prev => [...prev, `${rec.symbol} (${rec.strategyId}) auto-executed`])
        }
      }

      await Promise.all([loadSignals(), loadTrackRecords()])
    } finally {
      setScanning(false)
      setScanProgress(null)
    }
  }

  const handleExecuteSignal = async (signal: Signal) => {
    if (!user || !paperAccount) return
    setExecuting(signal.id)
    try {
      const rec = {
        symbol: signal.symbol,
        action: signal.action as 'long' | 'short' | 'no_action',
        confidenceScore: signal.confidence_score,
        oddsScore: signal.odds_score,
        entryPrice: signal.entry_price,
        stopLoss: signal.stop_loss,
        targetPrice: signal.target_price,
        strategyId: signal.strategy_id,
        reasoning: signal.reasoning as any,
      }

      const trade = await tradeSimulator.executeRecommendation(
        user.id,
        paperAccount.id,
        rec,
        1
      )

      await signalService.markSignalExecuted(signal.id, trade.id, false)
      await loadSignals()
    } catch (error) {
      console.error('Execute failed:', error)
    } finally {
      setExecuting(null)
    }
  }

  const toggleFollowMode = async () => {
    if (!user) return
    const newEnabled = !followSettings?.enabled
    if (!followSettings) {
      await followModeService.saveSettings(user.id, {
        enabled: newEnabled,
        paper_account_id: paperAccount?.id || null,
        min_strength_tier: 'strong_edge',
        risk_percent: 1,
        max_daily_trades: 5,
      })
    } else {
      await followModeService.toggleFollowMode(user.id, newEnabled)
    }
    await loadFollowSettings()
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading signals...</div>
  }

  const tabs = [
    { id: 'live' as Tab, label: 'Live Signals', icon: Radio, count: activeSignals.length },
    { id: 'history' as Tab, label: 'Signal History', icon: History, count: closedSignals.length },
    { id: 'track_record' as Tab, label: 'Track Record', icon: BarChart3, count: trackRecords.length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Radio className="h-8 w-8 text-sky-400" />
            Live Signals
          </h1>
          <p className="text-slate-400 mt-1">AI-generated trade signals with full track records</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setScanMode('watchlist')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition-all ${
                scanMode === 'watchlist'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Watchlist</span>
            </button>
            <button
              onClick={() => setScanMode('market')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition-all ${
                scanMode === 'market'
                  ? 'bg-green-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Market</span>
            </button>
          </div>
          {scanMode === 'market' && (
            <select
              value={marketSegment}
              onChange={(e) => setMarketSegment(e.target.value as MarketSegment)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="sp500">S&P 500 Top 100 ({getSegmentCount('sp500')})</option>
              <option value="sp500_full">Full S&P 500 ({getSegmentCount('sp500_full')})</option>
              <option value="nasdaq">NASDAQ 100 ({getSegmentCount('nasdaq')})</option>
              <option value="etfs">ETFs ({getSegmentCount('etfs')})</option>
              <option value="volatile">Volatile ({getSegmentCount('volatile')})</option>
              <option value="midcap">Mid-Cap Growth ({getSegmentCount('midcap')})</option>
              <option value="all">Full Universe ({getSegmentCount('all')})</option>
            </select>
          )}
          {isAdmin && (
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                onClick={() => setAIMode('personal')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition-all ${
                  aiMode === 'personal'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Brain className="h-3.5 w-3.5" />
                <span>Personal</span>
              </button>
              <button
                onClick={() => setAIMode('master')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs transition-all ${
                  aiMode === 'master'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Master</span>
              </button>
            </div>
          )}
          <button
            onClick={toggleFollowMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              followSettings?.enabled
                ? 'bg-sky-600/20 border-sky-500 text-sky-300 hover:bg-sky-600/30'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
            }`}
          >
            {followSettings?.enabled ? (
              <ToggleRight className="h-5 w-5" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
            Follow Mode {followSettings?.enabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={runScan}
            disabled={
              scanning ||
              (scanMode === 'watchlist' && watchlistSymbols.length === 0) ||
              scannerStrategyIds.length === 0
            }
            className="flex items-center gap-2 px-5 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {scanning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {scanning ? `Scanning...` : 'Scan'}
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <p className="text-xs text-slate-400 mb-3">
          Base strategies for scans (shared with AI Recommendations). Multiple strategies run in parallel; signals are deduped per symbol and strategy.
        </p>
        <div className="flex flex-wrap gap-3">
          {listBaseStrategies().map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 cursor-pointer text-sm text-slate-200 hover:bg-slate-700"
            >
              <input
                type="checkbox"
                className="rounded border-slate-500"
                checked={scannerStrategyIds.includes(s.id)}
                onChange={() => toggleScannerStrategy(s.id)}
              />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
      </div>

      {followSettings?.enabled && (
        <div className="bg-sky-900/20 border border-sky-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-medium text-sky-300">Follow Mode Active</span>
          </div>
          <p className="text-xs text-slate-400">
            Auto-copying {followSettings.min_strength_tier.replace('_', ' ')} signals and above.
            Max {followSettings.max_daily_trades} trades/day at {followSettings.risk_percent}% risk.
            {followSettings.trades_today > 0 && ` ${followSettings.trades_today} auto-trades today.`}
          </p>
        </div>
      )}

      {scanning && scanProgress && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-sky-400 animate-spin" />
              <span className="text-sm font-medium text-white">
                Scanning {scanProgress.currentSymbol || '...'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-emerald-400 font-medium">
                {scanProgress.signalsFound} signal{scanProgress.signalsFound !== 1 ? 's' : ''} found
              </span>
              <span className="text-xs text-slate-400">
                {scanProgress.scanned} / {scanProgress.total}
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-sky-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${
                  scanProgress.total > 0
                    ? Math.round((scanProgress.scanned / scanProgress.total) * 100)
                    : 100
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {autoExecuteResults.length > 0 && (
        <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-3">
          <p className="text-sm text-emerald-300">
            Follow Mode executed: {autoExecuteResults.join(', ')}
          </p>
        </div>
      )}

      <CopyTracker closedSignals={closedSignals} />

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex-1 justify-center ${
              tab === t.id
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                tab === t.id ? 'bg-sky-500/30 text-sky-300' : 'bg-slate-600/50 text-slate-500'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'live' && (
        <div className="space-y-4">
          {scanMode === 'watchlist' && watchlistSymbols.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
              <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Add symbols to your watchlist or switch to Market scan mode.</p>
            </div>
          ) : activeSignals.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
              <Radio className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-2">No active signals right now.</p>
              <p className="text-slate-500 text-sm">
                Click "Scan" to find high-probability setups across {scanMode === 'market' ? 'the entire market' : 'your watchlist'}. Signals expire after {signalService.SIGNAL_EXPIRY_HOURS} hours.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                {activeSignals.length} active signal{activeSignals.length !== 1 ? 's' : ''}
              </p>
              {activeSignals.map(signal => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  patternRecord={recordMap.get(signal.pattern_key)}
                  onExecute={handleExecuteSignal}
                  executing={executing === signal.id}
                />
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {closedSignals.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
              <History className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No closed signals yet. Execute trades from live signals to build history.</p>
            </div>
          ) : (
            closedSignals.map(signal => (
              <div key={signal.id}>
                <PostTradeScorecard signal={signal} />
                <PostMortem signal={signal} />
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'track_record' && (
        <TrackRecordPanel records={trackRecords} />
      )}
    </div>
  )
}
