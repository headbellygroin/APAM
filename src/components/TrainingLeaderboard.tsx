import { LeaderboardEntry } from '@/lib/trainingAccountService'
import { Trophy, TrendingUp, TrendingDown, Lock, Unlock, Crown, ArrowRight } from 'lucide-react'

interface Props {
  entries: LeaderboardEntry[]
  onSelectAccount: (id: string) => void
}

export default function TrainingLeaderboard({ entries, onSelectAccount }: Props) {
  if (entries.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-8 border border-slate-700 text-center">
        <Trophy className="h-12 w-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No training accounts yet. Create some to start competing!</p>
      </div>
    )
  }

  const getRankColor = (index: number) => {
    if (index === 0) return 'text-yellow-400'
    if (index === 1) return 'text-slate-300'
    if (index === 2) return 'text-amber-600'
    return 'text-slate-500'
  }

  const getRankBg = (index: number) => {
    if (index === 0) return 'bg-yellow-900/20 border-yellow-700/50'
    if (index === 1) return 'bg-slate-700/30 border-slate-600/50'
    if (index === 2) return 'bg-amber-900/20 border-amber-700/50'
    return 'bg-slate-800 border-slate-700'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2 mb-4">
        <Trophy className="h-5 w-5 text-yellow-400" />
        <h3 className="text-lg font-bold text-white">Leaderboard</h3>
      </div>

      {entries.map((entry, index) => (
        <button
          key={entry.id}
          onClick={() => onSelectAccount(entry.id)}
          className={`w-full rounded-lg p-4 border transition-all hover:scale-[1.01] hover:brightness-110 ${getRankBg(index)}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`text-2xl font-bold w-8 text-center ${getRankColor(index)}`}>
                {index + 1}
              </div>
              <div className="text-left">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-white">{entry.name}</span>
                  {entry.mode === 'strict' ? (
                    <Lock className="h-3.5 w-3.5 text-blue-400" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-amber-400" />
                  )}
                  {entry.promoted_to_master && (
                    <Crown className="h-3.5 w-3.5 text-yellow-400" />
                  )}
                </div>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-xs text-slate-400">{entry.strategy_id}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    entry.status === 'active' ? 'bg-green-900/50 text-green-300' :
                    entry.status === 'paused' ? 'bg-yellow-900/50 text-yellow-300' :
                    'bg-red-900/50 text-red-300'
                  }`}>
                    {entry.status}
                  </span>
                  {entry.is_drifting && (
                    <span className="text-xs text-amber-400">
                      Drifting {entry.drift_pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-xs text-slate-400">Trades</div>
                <div className="text-sm font-medium text-white">{entry.total_trades}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Win Rate</div>
                <div className={`text-sm font-medium ${entry.win_rate >= 55 ? 'text-green-400' : entry.win_rate >= 45 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {entry.win_rate.toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">P&L</div>
                <div className="flex items-center space-x-1">
                  {entry.total_profit_loss >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                  )}
                  <span className={`text-sm font-bold ${entry.total_profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${Math.abs(entry.total_profit_loss).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Return</div>
                <div className={`text-sm font-medium ${entry.return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.return_pct >= 0 ? '+' : ''}{entry.return_pct.toFixed(2)}%
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500" />
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
