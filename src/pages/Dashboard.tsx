import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { DollarSign, TrendingUp, TrendingDown, Activity, Target } from 'lucide-react'

interface DashboardStats {
  paperAccounts: number
  totalBalance: number
  totalProfitLoss: number
  openTrades: number
  closedTrades: number
  winRate: number
  watchlistCount: number
  aiRecommendations: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    paperAccounts: 0,
    totalBalance: 0,
    totalProfitLoss: 0,
    openTrades: 0,
    closedTrades: 0,
    winRate: 0,
    watchlistCount: 0,
    aiRecommendations: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentTrades, setRecentTrades] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return

    try {
      const [accountsRes, tradesRes, watchlistRes, recsRes, recentTradesRes] = await Promise.all([
        supabase.from('paper_accounts').select('*').eq('user_id', user.id),
        supabase.from('simulated_trades').select('*').eq('user_id', user.id),
        supabase.from('watchlists').select('*').eq('user_id', user.id),
        supabase.from('ai_recommendations').select('*').eq('user_id', user.id).eq('was_taken', false),
        supabase.from('simulated_trades').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ])

      const accounts = accountsRes.data || []
      const trades = tradesRes.data || []
      const watchlist = watchlistRes.data || []
      const recommendations = recsRes.data || []
      const recent = recentTradesRes.data || []

      const totalBalance = accounts.reduce((sum, acc) => sum + acc.current_balance, 0)
      const totalProfitLoss = accounts.reduce((sum, acc) => sum + acc.total_profit_loss, 0)

      const openTrades = trades.filter((t) => t.status === 'open').length
      const closedTrades = trades.filter((t) => t.status === 'closed')
      const winningTrades = closedTrades.filter((t) => (t.profit_loss || 0) > 0).length
      const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0

      setStats({
        paperAccounts: accounts.length,
        totalBalance,
        totalProfitLoss,
        openTrades,
        closedTrades: closedTrades.length,
        winRate,
        watchlistCount: watchlist.length,
        aiRecommendations: recommendations.length,
      })

      setRecentTrades(recent)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">Welcome back! Here's your trading overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/50 rounded-lg p-6 border border-blue-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-blue-300 text-sm">Total Balance</p>
            <DollarSign className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">${stats.totalBalance.toFixed(2)}</p>
          <p className="text-xs text-blue-400 mt-1">{stats.paperAccounts} account{stats.paperAccounts !== 1 ? 's' : ''}</p>
        </div>

        <div
          className={`rounded-lg p-6 border ${
            stats.totalProfitLoss >= 0
              ? 'bg-gradient-to-br from-green-900/50 to-green-800/50 border-green-700'
              : 'bg-gradient-to-br from-red-900/50 to-red-800/50 border-red-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm" style={{ color: stats.totalProfitLoss >= 0 ? '#86efac' : '#fca5a5' }}>
              Total P&L
            </p>
            {stats.totalProfitLoss >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-400" />
            )}
          </div>
          <p className={`text-3xl font-bold ${stats.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${Math.abs(stats.totalProfitLoss).toFixed(2)}
          </p>
          <p className={`text-xs mt-1 ${stats.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.totalProfitLoss >= 0 ? '+' : '-'}{stats.closedTrades} closed trade{stats.closedTrades !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm">Win Rate</p>
            <Target className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.winRate.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">{stats.openTrades} open trade{stats.openTrades !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm">AI Recommendations</p>
            <Activity className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.aiRecommendations}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.watchlistCount} symbols tracked</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">Recent Trades</h2>
          </div>
          <div className="p-6">
            {recentTrades.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No trades yet. Start with AI Recommendations!</p>
            ) : (
              <div className="space-y-3">
                {recentTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-white">{trade.symbol}</p>
                      <p className="text-xs text-slate-400">
                        {trade.trade_type.toUpperCase()} @ ${trade.entry_price.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          trade.status === 'open'
                            ? 'bg-yellow-900/50 text-yellow-300'
                            : trade.status === 'closed'
                            ? 'bg-blue-900/50 text-blue-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {trade.status.toUpperCase()}
                      </span>
                      {trade.profit_loss !== null && (
                        <p
                          className={`text-sm mt-1 font-medium ${
                            trade.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          ${trade.profit_loss.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-700/50 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Quick Start Guide</h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="bg-purple-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">1</span>
              </div>
              <div>
                <p className="text-white font-medium">Add Symbols to Watchlist</p>
                <p className="text-slate-400 text-sm">Track stocks you're interested in trading</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-purple-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">2</span>
              </div>
              <div>
                <p className="text-white font-medium">Scan for Opportunities</p>
                <p className="text-slate-400 text-sm">Use AI to find high-probability setups</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-purple-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">3</span>
              </div>
              <div>
                <p className="text-white font-medium">Execute Paper Trades</p>
                <p className="text-slate-400 text-sm">Practice with virtual money risk-free</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-purple-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">4</span>
              </div>
              <div>
                <p className="text-white font-medium">Track & Learn</p>
                <p className="text-slate-400 text-sm">Monitor performance and improve your strategy</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
