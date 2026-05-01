import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Navigate } from 'react-router-dom'
import {
  Shield,
  Users,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Brain,
  Wallet,
  Activity,
  RefreshCw,
} from 'lucide-react'
import { AdminUserSummary, fetchAllUserSummaries } from '@/lib/adminData'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    earned: 'bg-emerald-500/20 text-emerald-400',
    warning: 'bg-amber-500/20 text-amber-400',
    revoked: 'bg-red-500/20 text-red-400',
    unearned: 'bg-slate-600/30 text-slate-400',
  }

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || styles.unearned}`}>
      {status}
    </span>
  )
}

function WeightBar({ label, value }: { label: string; value: number }) {
  const drift = value - 1.0
  const pct = Math.abs(drift) * 100
  const isUp = drift > 0.02
  const isDown = drift < -0.02

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-slate-400 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-slate-500'}`}
          style={{ width: `${Math.min(100, 50 + pct * 5)}%` }}
        />
      </div>
      <span className={`w-12 text-right ${isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-500'}`}>
        {drift > 0 ? '+' : ''}{(drift * 100).toFixed(0)}%
      </span>
    </div>
  )
}

function UserCard({ summary, isExpanded, onToggle }: {
  summary: AdminUserSummary
  isExpanded: boolean
  onToggle: () => void
}) {
  const { user, accounts, recentTrades, aiState, learnedAdjustments, stats } = summary

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-750 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{user.email}</span>
              {aiState?.ai_name && aiState.name_status === 'earned' && (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  {aiState.ai_name}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">
              Joined {new Date(user.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-slate-400">Trades</div>
            <div className="text-sm font-medium text-white">{stats.totalTrades}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Win Rate</div>
            <div className={`text-sm font-medium ${stats.winRate >= 55 ? 'text-emerald-400' : stats.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
              {stats.winRate.toFixed(1)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">P/L</div>
            <div className={`text-sm font-medium ${stats.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${stats.totalPL.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Open</div>
            <div className="text-sm font-medium text-sky-400">{stats.openTrades}</div>
          </div>
          {isExpanded ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-sky-400" />
                <h4 className="text-sm font-medium text-white">Paper Accounts</h4>
              </div>
              {accounts.length === 0 ? (
                <p className="text-xs text-slate-500">No accounts created</p>
              ) : (
                <div className="space-y-2">
                  {accounts.map(acc => (
                    <div key={acc.id} className="text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-300">{acc.name}</span>
                        <span className={acc.total_profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          ${acc.current_balance.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Started: ${acc.starting_balance.toFixed(0)}</span>
                        <span>P/L: ${acc.total_profit_loss.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-amber-400" />
                <h4 className="text-sm font-medium text-white">AI State</h4>
              </div>
              {aiState ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Name</span>
                    <span className="text-white">{aiState.ai_name || 'None'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Status</span>
                    <StatusBadge status={aiState.name_status} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Evolution</span>
                    <span className={aiState.evolution_permission ? 'text-emerald-400' : 'text-slate-500'}>
                      {aiState.evolution_permission ? 'Permitted' : 'Not Permitted'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No AI state yet</p>
              )}
            </div>

            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <h4 className="text-sm font-medium text-white">Drift Engine</h4>
              </div>
              {learnedAdjustments ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Drifting</span>
                    <span className={learnedAdjustments.is_drifting ? 'text-amber-400' : 'text-slate-500'}>
                      {learnedAdjustments.is_drifting ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Decisions</span>
                    <span className="text-white">{learnedAdjustments.total_decisions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Drifted</span>
                    <span className="text-white">
                      {learnedAdjustments.drifted_decisions}
                      {learnedAdjustments.total_decisions > 0 &&
                        ` (${((learnedAdjustments.drifted_decisions / learnedAdjustments.total_decisions) * 100).toFixed(0)}%)`
                      }
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No drift data yet</p>
              )}
            </div>
          </div>

          {learnedAdjustments?.learned_weights && (
            <div className="bg-slate-900/50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2">Learned Weight Adjustments</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {Object.entries(learnedAdjustments.learned_weights).map(([key, val]) => (
                  <WeightBar key={key} label={key.replace('Score', '')} value={val as number} />
                ))}
              </div>
            </div>
          )}

          {recentTrades.length > 0 && (
            <div className="bg-slate-900/50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-white mb-2">Recent Trades (last 50)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-1.5 pr-3">Symbol</th>
                      <th className="text-left py-1.5 pr-3">Type</th>
                      <th className="text-left py-1.5 pr-3">Status</th>
                      <th className="text-right py-1.5 pr-3">Entry</th>
                      <th className="text-right py-1.5 pr-3">Score</th>
                      <th className="text-right py-1.5 pr-3">P/L</th>
                      <th className="text-left py-1.5 pr-3">Exit Reason</th>
                      <th className="text-left py-1.5">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.slice(0, 20).map(trade => (
                      <tr key={trade.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                        <td className="py-1.5 pr-3 font-medium text-white">{trade.symbol}</td>
                        <td className="py-1.5 pr-3">
                          <span className={`flex items-center gap-1 ${trade.trade_type === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trade.trade_type === 'long' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {trade.trade_type}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3">
                          <span className={`px-1.5 py-0.5 rounded ${
                            trade.status === 'open' ? 'bg-sky-500/20 text-sky-400' :
                            trade.status === 'closed' ? 'bg-slate-600/30 text-slate-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {trade.status}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3 text-right text-slate-300">${trade.entry_price.toFixed(2)}</td>
                        <td className="py-1.5 pr-3 text-right text-slate-300">{trade.odds_score?.toFixed(1) || '-'}</td>
                        <td className={`py-1.5 pr-3 text-right font-medium ${
                          trade.profit_loss === null ? 'text-slate-500' :
                          trade.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {trade.profit_loss !== null ? `$${trade.profit_loss.toFixed(2)}` : '-'}
                        </td>
                        <td className="py-1.5 pr-3 text-slate-400">{trade.exit_reason || '-'}</td>
                        <td className="py-1.5 text-slate-400">
                          {new Date(trade.entry_time).toLocaleDateString()}
                        </td>
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

export default function AdminDashboard() {
  const { isAdmin, loading } = useAuth()
  const [summaries, setSummaries] = useState<AdminUserSummary[]>([])
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!loading && isAdmin) {
      loadData()
    }
  }, [loading, isAdmin])

  const loadData = async () => {
    setIsLoading(true)
    const data = await fetchAllUserSummaries()
    setSummaries(data)
    setIsLoading(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  if (!loading && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const totalUsers = summaries.length
  const totalTrades = summaries.reduce((s, u) => s + u.stats.totalTrades, 0)
  const totalOpenTrades = summaries.reduce((s, u) => s + u.stats.openTrades, 0)
  const totalPL = summaries.reduce((s, u) => s + u.stats.totalPL, 0)
  const avgWinRate = totalUsers > 0
    ? summaries.reduce((s, u) => s + u.stats.winRate, 0) / summaries.filter(u => u.stats.totalTrades > 0).length || 0
    : 0
  const driftingAIs = summaries.filter(u => u.learnedAdjustments?.is_drifting).length
  const namedAIs = summaries.filter(u => u.aiState?.name_status === 'earned').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="h-8 w-8 text-sky-400" />
            Admin Dashboard
          </h1>
          <p className="text-slate-400 mt-1">View-only overview of all platform activity</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Users', value: totalUsers, color: 'text-white' },
          { label: 'Total Trades', value: totalTrades, color: 'text-white' },
          { label: 'Open Trades', value: totalOpenTrades, color: 'text-sky-400' },
          { label: 'Avg Win Rate', value: `${avgWinRate.toFixed(1)}%`, color: avgWinRate >= 55 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Total P/L', value: `$${totalPL.toFixed(0)}`, color: totalPL >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Named AIs', value: namedAIs, color: 'text-emerald-400' },
          { label: 'Drifting AIs', value: driftingAIs, color: driftingAIs > 0 ? 'text-amber-400' : 'text-slate-500' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800 rounded-lg border border-slate-700 p-3">
            <div className="text-xs text-slate-400">{stat.label}</div>
            <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-400">Loading platform data...</div>
        </div>
      ) : summaries.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <Users className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No users have signed up yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map(summary => (
            <UserCard
              key={summary.user.id}
              summary={summary}
              isExpanded={expandedUser === summary.user.id}
              onToggle={() => setExpandedUser(
                expandedUser === summary.user.id ? null : summary.user.id
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
