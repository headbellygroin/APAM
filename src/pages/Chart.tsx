import { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts'
import { Search, RefreshCw, TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react'
import { getCandles, getQuote, searchSymbols, getMarketStatus } from '@/lib/marketData'
import { aiEngine } from '@/lib/aiEngine'
import { loadMarketScannerStrategyIds } from '@/lib/marketScanStrategies'

type TimeframeOption = { label: string; resolution: 'D' | '60' | '30' | '15' | '5' | '1'; days: number }

const timeframes: TimeframeOption[] = [
  { label: '1D', resolution: 'D', days: 365 },
  { label: '1H', resolution: '60', days: 30 },
  { label: '30m', resolution: '30', days: 14 },
  { label: '15m', resolution: '15', days: 7 },
  { label: '5m', resolution: '5', days: 3 },
  { label: '1m', resolution: '1', days: 1 },
]

interface Zone {
  type: 'demand' | 'supply'
  high: number
  low: number
  strength: number
}

export default function Chart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  const [symbol, setSymbol] = useState('AAPL')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; description: string }>>([])
  const [showSearch, setShowSearch] = useState(false)
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>(timeframes[0])
  const [isLoading, setIsLoading] = useState(false)
  const [quote, setQuote] = useState<{ price: number; change: number; percentChange: number } | null>(null)
  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean; state: string } | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [curvePosition, setCurvePosition] = useState<string>('')
  const [trendDirection, setTrendDirection] = useState<string>('')

  const loadChartData = useCallback(async () => {
    if (!chartRef.current || !candleSeriesRef.current) return

    setIsLoading(true)
    try {
      const [candles, quoteData, status] = await Promise.all([
        getCandles(symbol, selectedTimeframe.resolution, selectedTimeframe.days),
        getQuote(symbol),
        getMarketStatus(),
      ])

      if (quoteData) {
        setQuote({
          price: quoteData.price,
          change: quoteData.change,
          percentChange: quoteData.percentChange,
        })
      }

      if (status) {
        setMarketStatus(status)
      }

      if (candles && candles.length > 0) {
        const chartData: CandlestickData<Time>[] = candles.map(c => ({
          time: c.timestamp as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))

        candleSeriesRef.current.setData(chartData)
        chartRef.current.timeScale().fitContent()

        if (selectedTimeframe.resolution === 'D' && candles.length >= 50) {
          const chartStrategyId = loadMarketScannerStrategyIds()[0]
          const detectedZones = aiEngine.detectZones(candles, chartStrategyId)
          setZones(detectedZones)

          const curve = aiEngine.analyzeCurvePosition(candles, chartStrategyId)
          const trend = aiEngine.analyzeTrend(candles, chartStrategyId)
          setCurvePosition(curve)
          setTrendDirection(trend)
        } else {
          setZones([])
          setCurvePosition('')
          setTrendDirection('')
        }
      }
    } catch (error) {
      console.error('Error loading chart data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [symbol, selectedTimeframe])

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1e293b' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#475569',
      },
      timeScale: {
        borderColor: '#475569',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  useEffect(() => {
    loadChartData()
  }, [loadChartData])

  useEffect(() => {
    const searchDebounce = setTimeout(async () => {
      if (searchQuery.length >= 1) {
        const results = await searchSymbols(searchQuery)
        setSearchResults(results)
        setShowSearch(true)
      } else {
        setSearchResults([])
        setShowSearch(false)
      }
    }, 300)

    return () => clearTimeout(searchDebounce)
  }, [searchQuery])

  const selectSymbol = (newSymbol: string) => {
    setSymbol(newSymbol)
    setSearchQuery('')
    setShowSearch(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Charts</h1>
          <p className="text-slate-400 mt-1">Technical analysis with supply and demand zones</p>
        </div>
        {marketStatus && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            marketStatus.isOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
          }`}>
            <Clock className="h-4 w-4" />
            {marketStatus.state}
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                placeholder="Search symbol..."
                className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-48"
              />
              {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-600 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.symbol}
                      onClick={() => selectSymbol(result.symbol)}
                      className="w-full px-4 py-2 text-left hover:bg-slate-800 transition-colors"
                    >
                      <div className="font-medium text-white">{result.symbol}</div>
                      <div className="text-xs text-slate-400 truncate">{result.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-white">{symbol}</span>
              {quote && (
                <>
                  <span className="text-xl font-semibold text-white">${quote.price.toFixed(2)}</span>
                  <span className={`flex items-center gap-1 text-sm font-medium ${
                    quote.change >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {quote.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)} ({quote.percentChange.toFixed(2)}%)
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-900 rounded-lg p-1">
              {timeframes.map((tf) => (
                <button
                  key={tf.label}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    selectedTimeframe.label === tf.label
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            <button
              onClick={loadChartData}
              disabled={isLoading}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 text-slate-300 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />

        {zones.length > 0 && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Curve Position</div>
              <div className={`font-semibold ${
                curvePosition === 'low' ? 'text-emerald-400' :
                curvePosition === 'high' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {curvePosition.toUpperCase()}
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Trend Direction</div>
              <div className={`font-semibold ${
                trendDirection === 'uptrend' ? 'text-emerald-400' :
                trendDirection === 'downtrend' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {trendDirection.toUpperCase()}
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Demand Zones</div>
              <div className="font-semibold text-emerald-400">
                {zones.filter(z => z.type === 'demand').length}
              </div>
            </div>
            <div className="bg-slate-900 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">Supply Zones</div>
              <div className="font-semibold text-red-400">
                {zones.filter(z => z.type === 'supply').length}
              </div>
            </div>
          </div>
        )}
      </div>

      {zones.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-sky-400" />
            Detected Zones
          </h2>
          <div className="grid gap-3">
            {zones.map((zone, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  zone.type === 'demand' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    zone.type === 'demand' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {zone.type.toUpperCase()}
                  </span>
                  <span className="text-slate-300">
                    ${zone.low.toFixed(2)} - ${zone.high.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Strength:</span>
                  <div className="flex gap-1">
                    {[...Array(zone.strength)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          zone.type === 'demand' ? 'bg-emerald-400' : 'bg-red-400'
                        }`}
                      />
                    ))}
                    {[...Array(2 - zone.strength)].map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-slate-600" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
