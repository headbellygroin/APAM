import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { BarChart3, TrendingUp, TrendingDown, Target, Calendar } from 'lucide-react'

interface AnalyticsData {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalProfitLoss: number
  averageWin: number
  averageLoss: number
  profitFactor: number
  largestWin: number
  largestLoss: number
  averageHoldTime: number
  aiRecommendationPerformance: {
    total: number
    wins: number
    losses: number
    winRate: number
  }
}

export default function Analytics() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'all' | '30d' | '7d'>('all')

  useEffect(() => {
    if (user) {
      loadAnalytics()
    }
  }, [user, timeframe])

  const loadAnalytics = async () => {
    if (!user) return

    try {
      let query = supabase
        .from('simulated_trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'closed')

      if (timeframe === '30d') {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        query = query.gte('created_at', thirtyDaysAgo.toISOString())
      } else if (timeframe === '7d') {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        query = query.gte('created_at', sevenDaysAgo.toISOString())
      }

      const { data: trades } = await query

      if (!trades || trades.length === 0) {
        setAnalytics({
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          totalProfitLoss: 0,
          averageWin: 0,
          averageLoss: 0,
          profitFactor: 0,
          largestWin: 0,
          largestLoss: 0,
          averageHoldTime: 0,
          aiRecommendationPerformance: { total: 0, wins: 0, losses: 0, winRate: 0 },
        })
        setLoading(false)
        return
      }

      const winningTrades = trades.filter((t) => (t.profit_loss || 0) > 0)
      const losingTrades = trades.filter((t) => (t.profit_loss || 0) < 0)

      const totalProfit = winningTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0)
      const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0))

      const largestWin = Math.max(...winningTrades.map((t) => t.profit_loss || 0), 0)
      const largestLoss = Math.min(...losingTrades.map((t) => t.profit_loss || 0), 0)

      const tradesWithTime = trades.filter((t) => t.entry_time && t.exit_time)
      const averageHoldTime =
        tradesWithTime.length > 0
          ? tradesWithTime.reduce((sum, t) => {
              const entry = new Date(t.entry_time!).getTime()
              const exit = new Date(t.exit_time!).getTime()
              return sum + (exit - entry) / (1000 * 60 * 60)
            }, 0) / tradesWithTime.length
          : 0

      const aiTrades = trades.filter((t) => t.is_ai_recommended)
      const aiWins = aiTrades.filter((t) => (t.profit_loss || 0) > 0).length

      setAnalytics({
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: (winningTrades.length / trades.length) * 100,
        totalProfitLoss: totalProfit - totalLoss,
        averageWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
        averageLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
        profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 0,
        largestWin,
        largestLoss,
        averageHoldTime,
        aiRecommendationPerformance: {
          total: aiTrades.length,
          wins: aiWins,
          losses: aiTrades.length - aiWins,
          winRate: aiTrades.length > 0 ? (aiWins / aiTrades.length) * 100 : 0,
        },
      })
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading analytics...</div>
  }

  if (!analytics) {
    return <div className="text-center py-12">No data available</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Performance Analytics</h1>
          <p className="text-slate-400 mt-2">Track your trading performance over time</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTimeframe('7d')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeframe === '7d' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeframe('30d')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeframe === '30d' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeframe('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeframe === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {analytics.totalTrades === 0 ? (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <BarChart3 className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No closed trades yet. Complete some trades to see your analytics!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-sm">Total Trades</p>
                <BarChart3 className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-3xl font-bold text-white">{analytics.totalTrades}</p>
              <p className="text-xs text-slate-500 mt-1">
                {analytics.winningTrades}W / {analytics.losingTrades}L
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/50 rounded-lg p-6 border border-blue-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-blue-300 text-sm">Win Rate</p>
                <Target className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-white">{analytics.winRate.toFixed(1)}%</p>
              <p className="text-xs text-blue-400 mt-1">
                {analytics.winningTrades} winning trades
              </p>
            </div>

            <div
              className={`rounded-lg p-6 border ${
                analytics.totalProfitLoss >= 0
                  ? 'bg-gradient-to-br from-green-900/50 to-green-800/50 border-green-700'
                  : 'bg-gradient-to-br from-red-900/50 to-red-800/50 border-red-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm" style={{ color: analytics.totalProfitLoss >= 0 ? '#86efac' : '#fca5a5' }}>
                  Total P&L
                </p>
                {analytics.totalProfitLoss >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-400" />
                )}
              </div>
              <p className={`text-3xl font-bold ${analytics.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${Math.abs(analytics.totalProfitLoss).toFixed(2)}
              </p>
              <p className={`text-xs mt-1 ${analytics.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {analytics.totalProfitLoss >= 0 ? 'Profit' : 'Loss'}
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-sm">Profit Factor</p>
                <Calendar className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-3xl font-bold text-white">{analytics.profitFactor.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {analytics.profitFactor >= 2 ? 'Excellent' : analytics.profitFactor >= 1.5 ? 'Good' : 'Needs Improvement'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-xl font-bold text-white mb-4">Trade Statistics</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <span className="text-slate-300">Average Win</span>
                  <span className="text-green-400 font-medium">${analytics.averageWin.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <span className="text-slate-300">Average Loss</span>
                  <span className="text-red-400 font-medium">${analytics.averageLoss.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <span className="text-slate-300">Largest Win</span>
                  <span className="text-green-400 font-medium">${analytics.largestWin.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <span className="text-slate-300">Largest Loss</span>
                  <span className="text-red-400 font-medium">${Math.abs(analytics.largestLoss).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <span className="text-slate-300">Avg Hold Time</span>
                  <span className="text-white font-medium">{analytics.averageHoldTime.toFixed(1)} hours</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-6 border border-purple-700/50">
              <h2 className="text-xl font-bold text-white mb-4">AI Recommendation Performance</h2>
              <div className="space-y-4">
                <div className="text-center py-6">
                  <p className="text-5xl font-bold text-white mb-2">
                    {analytics.aiRecommendationPerformance.winRate.toFixed(1)}%
                  </p>
                  <p className="text-slate-400">AI Win Rate</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white">{analytics.aiRecommendationPerformance.total}</p>
                    <p className="text-xs text-slate-400 mt-1">Total</p>
                  </div>
                  <div className="bg-green-900/30 rounded-lg p-3 text-center border border-green-700">
                    <p className="text-2xl font-bold text-green-400">{analytics.aiRecommendationPerformance.wins}</p>
                    <p className="text-xs text-green-400 mt-1">Wins</p>
                  </div>
                  <div className="bg-red-900/30 rounded-lg p-3 text-center border border-red-700">
                    <p className="text-2xl font-bold text-red-400">{analytics.aiRecommendationPerformance.losses}</p>
                    <p className="text-xs text-red-400 mt-1">Losses</p>
                  </div>
                </div>
                <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700">
                  <p className="text-xs text-blue-300 font-medium mb-2">PERFORMANCE NOTE</p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {analytics.aiRecommendationPerformance.winRate >= 60
                      ? 'Excellent performance! The AI is consistently identifying high-probability setups.'
                      : analytics.aiRecommendationPerformance.winRate >= 50
                      ? 'Good performance. Continue following AI recommendations and refining your execution.'
                      : 'Review your trade execution and market conditions. Consider adjusting your minimum score threshold.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Performance Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-700/30 rounded-lg">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Win/Loss Ratio</h3>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-slate-600 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${analytics.winRate}%` }}
                    />
                  </div>
                  <span className="text-sm text-white font-medium">{analytics.winRate.toFixed(0)}%</span>
                </div>
              </div>

              <div className="p-4 bg-slate-700/30 rounded-lg">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Risk Management</h3>
                <p className="text-sm text-slate-300">
                  Your profit factor of {analytics.profitFactor.toFixed(2)} means you make $
                  {analytics.profitFactor.toFixed(2)} for every $1 you risk.
                </p>
              </div>

              <div className="p-4 bg-slate-700/30 rounded-lg">
                <h3 className="text-sm font-medium text-slate-300 mb-2">Trade Consistency</h3>
                <p className="text-sm text-slate-300">
                  Average win is {(analytics.averageWin / Math.abs(analytics.averageLoss || 1)).toFixed(2)}x your average loss.
                </p>
              </div>

              <div className="p-4 bg-slate-700/30 rounded-lg">
                <h3 className="text-sm font-medium text-slate-300 mb-2">AI Effectiveness</h3>
                <p className="text-sm text-slate-300">
                  AI recommendations have a {analytics.aiRecommendationPerformance.winRate.toFixed(1)}% success rate across{' '}
                  {analytics.aiRecommendationPerformance.total} trades.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
