import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { aiEngine, MarketScanResult } from '@/lib/aiEngine'
import { listBaseStrategies } from '@/lib/strategies'
import {
  loadMarketScannerStrategyIds,
  saveMarketScannerStrategyIds,
} from '@/lib/marketScanStrategies'
import { tradeSimulator } from '@/lib/tradeSimulator'
import { getTopLiquidSymbols, getMarketSymbols, getSegmentCount, MarketSegment } from '@/lib/marketScanner'
import { getMarketStatus } from '@/lib/marketData'
import { Brain, Search, TrendingUp, Play, Users, Globe } from 'lucide-react'

export default function AIRecommendations() {
  const { user, isAdmin } = useAuth()
  const [scanResults, setScanResults] = useState<MarketScanResult[]>([])
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [minScore, setMinScore] = useState(7)
  const [paperAccount, setPaperAccount] = useState<any>(null)
  const [executing, setExecuting] = useState<string | null>(null)
  const [aiMode, setAIMode] = useState<'personal' | 'master'>('personal')
  const [scanMode, setScanMode] = useState<'watchlist' | 'market'>('watchlist')
  const [marketSegment, setMarketSegment] = useState<MarketSegment>('sp500')
  const [scannerStrategyIds, setScannerStrategyIds] = useState<string[]>(() =>
    loadMarketScannerStrategyIds()
  )

  useEffect(() => {
    if (user) {
      loadWatchlist()
      loadPaperAccount()
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

  const loadWatchlist = async () => {
    if (!user) return

    const { data } = await supabase
      .from('watchlists')
      .select('symbol')
      .eq('user_id', user.id)

    if (data) {
      setWatchlistSymbols(data.map(w => w.symbol))
    }
  }

  const loadPaperAccount = async () => {
    if (!user) return

    const account = await tradeSimulator.getPaperAccount(user.id)
    setPaperAccount(account)
  }

  const runScan = async () => {
    const marketStatus = await getMarketStatus()
    if (marketStatus && !marketStatus.isOpen) {
      alert('Market is currently closed. Scan results may not reflect current conditions.')
    }

    let symbolsToScan: string[]

    if (scanMode === 'watchlist') {
      if (watchlistSymbols.length === 0) {
        alert('Add symbols to your watchlist first!')
        return
      }
      symbolsToScan = watchlistSymbols
    } else {
      symbolsToScan = marketSegment === 'all' ? getTopLiquidSymbols(100) : getMarketSymbols(marketSegment)
    }

    setScanning(true)
    try {
      const results = await aiEngine.scanMarket(
        symbolsToScan,
        minScore,
        (isAdmin && aiMode === 'master') ? undefined : user?.id,
        undefined,
        { strategyIds: scannerStrategyIds }
      )
      setScanResults(results)

      if (user) {
        await supabase.from('market_scans').insert({
          user_id: user.id,
          scan_type: (isAdmin && aiMode === 'master') ? 'high_probability_master' : 'high_probability_personal',
          timeframe: '1D',
          min_score: minScore,
          results: results.map(r => ({
            symbol: r.symbol,
            score: r.score,
            action: r.recommendation.action,
          })),
        })
      }
    } finally {
      setScanning(false)
    }
  }

  const executeRecommendation = async (result: MarketScanResult) => {
    if (!user || !paperAccount) {
      alert('Create a paper trading account first!')
      return
    }

    setExecuting(`${result.symbol}-${result.recommendation.strategyId}`)
    try {
      await tradeSimulator.executeRecommendation(
        user.id,
        paperAccount.id,
        result.recommendation,
        1
      )
      alert(`Trade executed for ${result.symbol}!`)
    } catch (error) {
      console.error('Error executing trade:', error)
      alert('Failed to execute trade')
    } finally {
      setExecuting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">AI Recommendations</h1>
        <p className="text-slate-400 mt-2">Let AI find high-probability trade setups for you</p>
      </div>

      <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-lg p-6 border border-blue-700/50">
        <div className="flex items-start space-x-4">
          <div className="bg-blue-900/50 p-3 rounded-lg">
            <Brain className="h-8 w-8 text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-2">How AI Recommendations Work</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              The AI engine scans your watchlist with one or more base strategies in parallel (configured below).
              It analyzes curve position, trend direction, and supply/demand zones to calculate an Odds Enhancer score.
              Only setups scoring {minScore}+ are shown. The AI learns from every trade outcome to improve future recommendations.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Market Scanner</h2>
            <p className="text-sm text-slate-400 mt-1">
              {scanMode === 'watchlist'
                ? `${watchlistSymbols.length} symbols from your watchlist`
                : `Scanning ${marketSegment === 'all' ? '100 top liquid' : marketSegment.toUpperCase()} stocks`
              }
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Scan Mode</label>
              <div className="flex bg-slate-700 rounded-lg p-1">
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
            </div>
            {scanMode === 'market' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Market Segment</label>
                <select
                  value={marketSegment}
                  onChange={(e) => setMarketSegment(e.target.value as MarketSegment)}
                  className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sp500">S&P 500 Top 100 ({getSegmentCount('sp500')})</option>
                  <option value="sp500_full">Full S&P 500 ({getSegmentCount('sp500_full')})</option>
                  <option value="nasdaq">NASDAQ 100 ({getSegmentCount('nasdaq')})</option>
                  <option value="etfs">ETFs ({getSegmentCount('etfs')})</option>
                  <option value="volatile">Volatile ({getSegmentCount('volatile')})</option>
                  <option value="midcap">Mid-Cap Growth ({getSegmentCount('midcap')})</option>
                  <option value="all">Full Universe ({getSegmentCount('all')})</option>
                </select>
              </div>
            )}
            {isAdmin && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">AI Mode</label>
                <div className="flex bg-slate-700 rounded-lg p-1">
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
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Min Score</label>
              <select
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="6">6.0+</option>
                <option value="7">7.0+</option>
                <option value="8">8.0+</option>
                <option value="8.5">8.5+ (Best)</option>
              </select>
            </div>
            <button
              onClick={runScan}
              disabled={
                scanning ||
                (scanMode === 'watchlist' && watchlistSymbols.length === 0) ||
                scannerStrategyIds.length === 0
              }
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className={`h-5 w-5 ${scanning ? 'animate-pulse' : ''}`} />
              <span>{scanning ? 'Scanning...' : 'Scan'}</span>
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-700">
          <p className="text-xs text-slate-400 mb-3">
            Base strategies for this scan (shared with Live Signals). Each selected strategy evaluates every symbol; results are merged and sorted by score.
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
      </div>

      {scanResults.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">
            Found {scanResults.length} High-Probability Setup{scanResults.length !== 1 ? 's' : ''}
          </h2>

          {scanResults.map((result) => {
            const rec = result.recommendation
            const stratLabel =
              listBaseStrategies().find((s) => s.id === rec.strategyId)?.name ?? rec.strategyId
            const rowKey = `${result.symbol}-${rec.strategyId}`
            return (
              <div key={rowKey} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{result.symbol}</h3>
                    <p className="text-xs text-slate-500 mt-1">Strategy: {stratLabel}</p>
                    <p className={`text-sm mt-1 ${
                      rec.action === 'long' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {rec.action === 'long' ? 'LONG SETUP' : 'SHORT SETUP'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="bg-blue-900/50 px-4 py-2 rounded-lg inline-block">
                      <p className="text-xs text-blue-300">Odds Score</p>
                      <p className="text-2xl font-bold text-white">{rec.oddsScore.toFixed(1)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400">Entry Price</p>
                    <p className="text-lg font-medium text-white">${rec.entryPrice.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400">Stop Loss</p>
                    <p className="text-lg font-medium text-white">${rec.stopLoss.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400">Target</p>
                    <p className="text-lg font-medium text-white">${rec.targetPrice.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-xs text-slate-400">R:R Ratio</p>
                    <p className="text-lg font-medium text-white">{rec.reasoning.riskRewardRatio.toFixed(2)}:1</p>
                  </div>
                </div>

                <div className="bg-slate-700/30 rounded-lg p-4 mb-4">
                  <p className="text-xs text-slate-400 mb-2">AI Analysis</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-slate-400">Curve:</span>{' '}
                      <span className="text-white font-medium">{rec.reasoning.curvePosition.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Trend:</span>{' '}
                      <span className="text-white font-medium">{rec.reasoning.trendDirection.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Zone:</span>{' '}
                      <span className={rec.reasoning.zoneType === 'demand' ? 'text-green-400' : 'text-red-400'}>
                        {rec.reasoning.zoneType.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Strength:</span>{' '}
                      <span className="text-white font-medium">{rec.reasoning.scores.strength}/2</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Freshness:</span>{' '}
                      <span className="text-white font-medium">{rec.reasoning.scores.freshness}/2</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Entry Type:</span>{' '}
                      <span className="text-white font-medium">{rec.reasoning.entryType.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="bg-green-900/30 border border-green-700 rounded-lg px-3 py-1">
                      <span className="text-xs text-green-300">
                        Confidence: {rec.confidenceScore.toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => executeRecommendation(result)}
                    disabled={!paperAccount || executing === rowKey}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="h-4 w-4" />
                    <span>{executing === rowKey ? 'Executing...' : 'Execute Paper Trade'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {scanResults.length === 0 && !scanning && watchlistSymbols.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <TrendingUp className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No high-probability setups found. Try lowering the minimum score or check back later!</p>
        </div>
      )}
    </div>
  )
}
