import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { aiEngine, AIRecommendation } from '@/lib/aiEngine'
import { searchSymbols, getQuote, Quote } from '@/lib/marketData'
import {
  Search,
  TrendingUp,
  TrendingDown,
  Activity,
  Eye,
  Brain,
  X,
  RefreshCw,
  ChevronRight,
  Clock,
  BarChart3,
  Zap,
} from 'lucide-react'

interface ActiveTrade {
  id: string
  symbol: string
  trade_type: string
  entry_price: number
  stop_loss: number
  target_price: number
  position_size: number
  status: string
  profit_loss: number | null
  entry_time: string
  exit_time: string | null
  exit_reason: string | null
  is_ai_recommended: boolean
}

interface SymbolSearchResult {
  symbol: string
  description: string
}

interface SymbolAnalysis {
  symbol: string
  quote: Quote
  recommendation: AIRecommendation | null
  loading: boolean
}

export default function MarketMonitor() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([])
  const [, setSearching] = useState(false)
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([])
  const [recentTrades, setRecentTrades] = useState<ActiveTrade[]>([])
  const [selectedAnalysis, setSelectedAnalysis] = useState<SymbolAnalysis | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [liveQuotes, setLiveQuotes] = useState<Map<string, Quote>>(new Map())

  useEffect(() => {
    if (user) {
      loadTrades()
    }
  }, [user])

  useEffect(() => {
    if (activeTrades.length > 0) {
      refreshQuotes()
      const interval = setInterval(refreshQuotes, 60000)
      return () => clearInterval(interval)
    }
  }, [activeTrades])

  const loadTrades = async () => {
    if (!user) return

    const { data: open } = await supabase
      .from('simulated_trades')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .order('entry_time', { ascending: false })

    if (open) setActiveTrades(open)

    const { data: closed } = await supabase
      .from('simulated_trades')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'closed')
      .order('exit_time', { ascending: false })
      .limit(20)

    if (closed) setRecentTrades(closed)
  }

  const refreshQuotes = async () => {
    const symbols = activeTrades.map(t => t.symbol)
    if (symbols.length === 0) return

    setRefreshing(true)
    const newQuotes = new Map<string, Quote>()
    for (const symbol of symbols) {
      const quote = await getQuote(symbol)
      if (quote) newQuotes.set(symbol, quote)
    }
    setLiveQuotes(newQuotes)
    setRefreshing(false)
  }

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 1) {
      setSearchResults([])
      return
    }

    setSearching(true)
    const results = await searchSymbols(query)
    setSearchResults(results)
    setSearching(false)
  }, [])

  const analyzeSymbol = async (symbol: string) => {
    setSearchResults([])
    setSearchQuery('')

    const quote = await getQuote(symbol)
    if (!quote) return

    setSelectedAnalysis({
      symbol,
      quote,
      recommendation: null,
      loading: true,
    })

    const recommendation = await aiEngine.generateRecommendation(symbol, user?.id)
    setSelectedAnalysis({
      symbol,
      quote,
      recommendation,
      loading: false,
    })
  }

  const getUnrealizedPL = (trade: ActiveTrade): { pl: number; pct: number } | null => {
    const quote = liveQuotes.get(trade.symbol)
    if (!quote) return null

    const direction = trade.trade_type === 'long' ? 1 : -1
    const pl = (quote.price - trade.entry_price) * direction * trade.position_size
    const pct = ((quote.price - trade.entry_price) / trade.entry_price) * direction * 100
    return { pl, pct }
  }

  const getDistanceToTarget = (trade: ActiveTrade): number | null => {
    const quote = liveQuotes.get(trade.symbol)
    if (!quote) return null
    return ((trade.target_price - quote.price) / quote.price) * 100
  }

  const getDistanceToStop = (trade: ActiveTrade): number | null => {
    const quote = liveQuotes.get(trade.symbol)
    if (!quote) return null
    return ((quote.price - trade.stop_loss) / quote.price) * 100
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="h-8 w-8 text-sky-400" />
            Market Monitor
          </h1>
          <p className="text-slate-400 mt-1">Search markets, analyze setups, and track live trades</p>
        </div>
        <button
          onClick={() => { loadTrades(); refreshQuotes() }}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for a stock symbol or company name..."
            className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-lg"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="absolute z-20 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
            {searchResults.map((result) => (
              <button
                key={result.symbol}
                onClick={() => analyzeSymbol(result.symbol)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-700 transition-colors text-left"
              >
                <div>
                  <span className="font-semibold text-white">{result.symbol}</span>
                  <span className="text-sm text-slate-400 ml-3">{result.description}</span>
                </div>
                <div className="flex items-center gap-2 text-sky-400">
                  <Brain className="h-4 w-4" />
                  <span className="text-xs">Analyze</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedAnalysis && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedAnalysis.symbol}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xl text-white">${selectedAnalysis.quote.price.toFixed(2)}</span>
                  <span className={`text-sm font-medium ${
                    selectedAnalysis.quote.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {selectedAnalysis.quote.change >= 0 ? '+' : ''}{selectedAnalysis.quote.change.toFixed(2)} ({selectedAnalysis.quote.percentChange.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedAnalysis(null)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid sm:grid-cols-4 gap-4 p-6 border-b border-slate-700">
            <div className="bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-slate-500">Open</p>
              <p className="text-sm font-medium text-white">${selectedAnalysis.quote.open.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-slate-500">High</p>
              <p className="text-sm font-medium text-white">${selectedAnalysis.quote.high.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-slate-500">Low</p>
              <p className="text-sm font-medium text-white">${selectedAnalysis.quote.low.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <p className="text-xs text-slate-500">Volume</p>
              <p className="text-sm font-medium text-white">
                {selectedAnalysis.quote.volume ? (selectedAnalysis.quote.volume / 1000000).toFixed(2) + 'M' : 'N/A'}
              </p>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-sky-400" />
              <h3 className="text-lg font-semibold text-white">AI Analysis</h3>
              {selectedAnalysis.loading && (
                <span className="text-xs text-slate-400 animate-pulse">Analyzing...</span>
              )}
            </div>

            {selectedAnalysis.loading ? (
              <div className="bg-slate-900 rounded-lg p-8 text-center">
                <Brain className="h-10 w-10 text-sky-400 mx-auto mb-3 animate-pulse" />
                <p className="text-slate-400">Running strategy analysis...</p>
              </div>
            ) : selectedAnalysis.recommendation ? (
              <div className="space-y-4">
                <div className={`rounded-lg p-4 border ${
                  selectedAnalysis.recommendation.action === 'long'
                    ? 'bg-emerald-950/30 border-emerald-500/30'
                    : 'bg-red-950/30 border-red-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {selectedAnalysis.recommendation.action === 'long' ? (
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-400" />
                      )}
                      <span className={`text-lg font-bold ${
                        selectedAnalysis.recommendation.action === 'long' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {selectedAnalysis.recommendation.action.toUpperCase()} SETUP
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Odds Score</p>
                      <p className="text-xl font-bold text-white">
                        {selectedAnalysis.recommendation.oddsScore.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Entry</p>
                      <p className="text-sm font-medium text-white">${selectedAnalysis.recommendation.entryPrice.toFixed(2)}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Stop Loss</p>
                      <p className="text-sm font-medium text-red-400">${selectedAnalysis.recommendation.stopLoss.toFixed(2)}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Target</p>
                      <p className="text-sm font-medium text-emerald-400">${selectedAnalysis.recommendation.targetPrice.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="flex justify-between bg-black/10 rounded px-2 py-1">
                      <span className="text-slate-500">R:R</span>
                      <span className="text-white font-medium">{selectedAnalysis.recommendation.reasoning.riskRewardRatio.toFixed(2)}:1</span>
                    </div>
                    <div className="flex justify-between bg-black/10 rounded px-2 py-1">
                      <span className="text-slate-500">Curve</span>
                      <span className="text-white font-medium">{selectedAnalysis.recommendation.reasoning.curvePosition}</span>
                    </div>
                    <div className="flex justify-between bg-black/10 rounded px-2 py-1">
                      <span className="text-slate-500">Trend</span>
                      <span className="text-white font-medium">{selectedAnalysis.recommendation.reasoning.trendDirection}</span>
                    </div>
                    <div className="flex justify-between bg-black/10 rounded px-2 py-1">
                      <span className="text-slate-500">Zone</span>
                      <span className={`font-medium ${
                        selectedAnalysis.recommendation.reasoning.zoneType === 'demand' ? 'text-emerald-400' : 'text-red-400'
                      }`}>{selectedAnalysis.recommendation.reasoning.zoneType}</span>
                    </div>
                  </div>

                  {selectedAnalysis.recommendation.driftApplied && (
                    <div className="mt-3 bg-sky-950/30 border border-sky-500/20 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-sky-400" />
                        <span className="text-xs text-sky-400 font-medium">Drift Applied</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{selectedAnalysis.recommendation.driftReason}</p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Score Breakdown</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {Object.entries(selectedAnalysis.recommendation.reasoning.scores).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <p className="text-xs text-slate-500 capitalize">{key.replace('Score', '')}</p>
                        <p className="text-lg font-bold text-white">{(value as number).toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-lg p-8 text-center">
                <Eye className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No actionable setup found for {selectedAnalysis.symbol}</p>
                <p className="text-xs text-slate-500 mt-1">The AI did not find a high-probability entry at current levels</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTrades.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400 animate-pulse" />
              <h2 className="text-xl font-semibold text-white">Live Trades</h2>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                {activeTrades.length} open
              </span>
            </div>
            {refreshing && <span className="text-xs text-slate-400 animate-pulse">Updating prices...</span>}
          </div>

          <div className="divide-y divide-slate-700">
            {activeTrades.map((trade) => {
              const unrealized = getUnrealizedPL(trade)
              const toTarget = getDistanceToTarget(trade)
              const toStop = getDistanceToStop(trade)
              const quote = liveQuotes.get(trade.symbol)

              return (
                <div key={trade.id} className="p-5 hover:bg-slate-700/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-white">{trade.symbol}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        trade.trade_type === 'long' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.trade_type.toUpperCase()}
                      </span>
                      {trade.is_ai_recommended && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400">
                          AI
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {unrealized ? (
                        <div>
                          <p className={`text-lg font-bold ${unrealized.pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {unrealized.pl >= 0 ? '+' : ''}${unrealized.pl.toFixed(2)}
                          </p>
                          <p className={`text-xs ${unrealized.pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {unrealized.pct >= 0 ? '+' : ''}{unrealized.pct.toFixed(2)}%
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Waiting for quote...</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">Entry</p>
                      <p className="text-sm font-medium text-white">${trade.entry_price.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Current</p>
                      <p className="text-sm font-medium text-white">
                        {quote ? `$${quote.price.toFixed(2)}` : '...'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Target</p>
                      <p className="text-sm font-medium text-emerald-400">
                        ${trade.target_price.toFixed(2)}
                        {toTarget !== null && <span className="text-xs text-slate-500 ml-1">({toTarget.toFixed(1)}%)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Stop</p>
                      <p className="text-sm font-medium text-red-400">
                        ${trade.stop_loss.toFixed(2)}
                        {toStop !== null && <span className="text-xs text-slate-500 ml-1">({toStop.toFixed(1)}%)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Entered</p>
                      <p className="text-sm text-slate-300">
                        {new Date(trade.entry_time).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {unrealized && toTarget !== null && toStop !== null && (
                    <div className="mt-3">
                      <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                        {(() => {
                          const totalRange = Math.abs(toTarget) + Math.abs(toStop)
                          const progressPct = totalRange > 0 ? (Math.abs(toStop) / totalRange) * 100 : 50
                          return (
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                                unrealized.pl >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                            />
                          )
                        })()}
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-slate-500">
                        <span>Stop</span>
                        <span>Entry</span>
                        <span>Target</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-400" />
            <h2 className="text-xl font-semibold text-white">Recent Closed Trades</h2>
          </div>
        </div>

        {recentTrades.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No closed trades yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase">Symbol</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase">Entry</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase">Exit</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase">P&L</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase">Reason</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-300 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {recentTrades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{trade.symbol}</span>
                        {trade.is_ai_recommended && (
                          <Brain className="h-3.5 w-3.5 text-sky-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        trade.trade_type === 'long' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.trade_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-300">${trade.entry_price.toFixed(2)}</td>
                    <td className="px-5 py-3 text-sm text-slate-300">
                      {trade.exit_reason === 'target_hit' ? (
                        <span className="text-emerald-400">${trade.target_price.toFixed(2)}</span>
                      ) : trade.exit_reason === 'stop_hit' ? (
                        <span className="text-red-400">${trade.stop_loss.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {trade.profit_loss !== null ? (
                        <span className={`text-sm font-medium ${trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {trade.profit_loss >= 0 ? '+' : ''}${trade.profit_loss.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        trade.exit_reason === 'target_hit' ? 'bg-emerald-500/20 text-emerald-400' :
                        trade.exit_reason === 'stop_hit' ? 'bg-red-500/20 text-red-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {trade.exit_reason?.replace('_', ' ') || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {trade.exit_time ? new Date(trade.exit_time).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
