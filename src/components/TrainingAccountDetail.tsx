import { useState, useEffect } from 'react'
import { TrainingAccount, TrainingTrade, trainingAccountService } from '@/lib/trainingAccountService'
import { isSimulationRunning, startAccountSimulation, stopAccountSimulation } from '@/lib/trainingSimulator'
import {
  ArrowLeft, Play, Pause, RotateCcw, Trash2, Crown, Lock, Unlock,
  Activity, BarChart3, Zap
} from 'lucide-react'

interface Props {
  account: TrainingAccount
  watchlistSymbols: string[]
  onBack: () => void
  onRefresh: () => void
  onPromote: (account: TrainingAccount) => void
}

export default function TrainingAccountDetail({ account, watchlistSymbols, onBack, onRefresh, onPromote }: Props) {
  const [trades, setTrades] = useState<TrainingTrade[]>([])
  const [running, setRunning] = useState(isSimulationRunning(account.id))
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  useEffect(() => {
    loadTrades()
  }, [account.id])

  const loadTrades = async () => {
    const data = await trainingAccountService.getAccountTrades(account.id)
    setTrades(data)
  }

  const toggleSimulation = async () => {
    if (running) {
      stopAccountSimulation(account.id)
      await trainingAccountService.updateStatus(account.id, 'paused')
      setRunning(false)
    } else {
      await trainingAccountService.updateStatus(account.id, 'active')
      startAccountSimulation(
        { ...account, status: 'active' },
        watchlistSymbols,
        () => {
          loadTrades()
          onRefresh()
        }
      )
      setRunning(true)
    }
    onRefresh()
  }

  const handleReset = async () => {
    stopAccountSimulation(account.id)
    await trainingAccountService.resetAccount(account.id)
    setShowConfirmReset(false)
    setRunning(false)
    onRefresh()
    loadTrades()
  }

  const handleDelete = async () => {
    stopAccountSimulation(account.id)
    await trainingAccountService.deleteAccount(account.id)
    setShowConfirmDelete(false)
    onBack()
    onRefresh()
  }

  const returnPct = account.starting_capital > 0
    ? ((account.current_capital - account.starting_capital) / account.starting_capital) * 100
    : 0
  const driftPct = account.total_decisions > 0
    ? (account.drift_decisions / account.total_decisions) * 100
    : 0
  const openTrades = trades.filter(t => t.status === 'open')
  const closedTrades = trades.filter(t => t.status === 'closed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-700 transition-colors">
            <ArrowLeft className="h-5 w-5 text-slate-300" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-bold text-white">{account.name}</h2>
              {account.mode === 'strict' ? (
                <span className="flex items-center space-x-1 text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                  <Lock className="h-3 w-3" />
                  <span>Strict</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-xs bg-amber-900/50 text-amber-300 px-2 py-1 rounded">
                  <Unlock className="h-3 w-3" />
                  <span>Adaptive</span>
                </span>
              )}
              {account.promoted_to_master && (
                <span className="flex items-center space-x-1 text-xs bg-yellow-900/50 text-yellow-300 px-2 py-1 rounded">
                  <Crown className="h-3 w-3" />
                  <span>Promoted</span>
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Strategy: {account.strategy_id} | Risk: {account.risk_per_trade}% | Max Positions: {account.max_positions}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!account.promoted_to_master && account.total_trades >= 20 && (
            <button
              onClick={() => onPromote(account)}
              className="flex items-center space-x-1.5 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
            >
              <Crown className="h-4 w-4" />
              <span>Promote to Master</span>
            </button>
          )}
          <button
            onClick={toggleSimulation}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              running
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{running ? 'Pause' : 'Start'}</span>
          </button>
          <button
            onClick={() => setShowConfirmReset(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset</span>
          </button>
          <button
            onClick={() => setShowConfirmDelete(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-red-900/50 text-red-300 rounded-lg hover:bg-red-900/70 transition-colors text-sm"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Balance" value={`$${account.current_capital.toFixed(0)}`} sub={`Started: $${account.starting_capital.toFixed(0)}`} color="blue" />
        <StatCard
          label="Total P&L"
          value={`${account.total_profit_loss >= 0 ? '+' : ''}$${account.total_profit_loss.toFixed(2)}`}
          sub={`${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`}
          color={account.total_profit_loss >= 0 ? 'green' : 'red'}
        />
        <StatCard label="Win Rate" value={`${account.win_rate.toFixed(1)}%`} sub={`${account.winning_trades}W / ${account.total_trades - account.winning_trades}L`} color={account.win_rate >= 55 ? 'green' : account.win_rate >= 45 ? 'yellow' : 'red'} />
        <StatCard label="Profit Factor" value={account.profit_factor.toFixed(2)} sub={`${account.total_trades} trades`} color={account.profit_factor >= 1.5 ? 'green' : account.profit_factor >= 1 ? 'yellow' : 'red'} />
        <StatCard label="Expectancy" value={`$${account.expectancy.toFixed(2)}`} sub="per trade" color={account.expectancy > 0 ? 'green' : 'red'} />
        <StatCard label="Max Drawdown" value={`${account.max_drawdown.toFixed(1)}%`} sub="peak to trough" color={account.max_drawdown < 5 ? 'green' : account.max_drawdown < 15 ? 'yellow' : 'red'} />
      </div>

      {account.mode === 'adaptive' && (
        <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
          <div className="flex items-center space-x-2 mb-4">
            <Zap className="h-5 w-5 text-amber-400" />
            <h3 className="font-semibold text-white">Drift Engine State</h3>
            {account.is_drifting && (
              <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded">Drifting</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">Drift Rate</p>
              <p className="text-lg font-bold text-white">{driftPct.toFixed(1)}%</p>
              <p className="text-xs text-slate-500">{account.drift_decisions} / {account.total_decisions} decisions</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Weight Shifts</p>
              <div className="space-y-0.5">
                {Object.entries(account.learned_weights || {}).map(([key, val]) => {
                  const drift = (val as number) - 1
                  if (Math.abs(drift) < 0.02) return null
                  return (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{key.replace('Score', '')}</span>
                      <span className={drift > 0 ? 'text-green-400' : 'text-red-400'}>
                        {drift > 0 ? '+' : ''}{(drift * 100).toFixed(0)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Threshold Shift</p>
              <p className="text-lg font-bold text-white">
                {(account.threshold_adjustments?.minOddsScore || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Pattern Overrides</p>
              <p className="text-lg font-bold text-white">
                {Object.keys(account.pattern_overrides || {}).length}
              </p>
            </div>
          </div>
        </div>
      )}

      {openTrades.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center space-x-2">
            <Activity className="h-4 w-4 text-green-400" />
            <h3 className="font-semibold text-white">Open Positions ({openTrades.length})</h3>
          </div>
          <TradeTable trades={openTrades} />
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex items-center space-x-2">
          <BarChart3 className="h-4 w-4 text-blue-400" />
          <h3 className="font-semibold text-white">Trade History ({closedTrades.length})</h3>
        </div>
        {closedTrades.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No completed trades yet</div>
        ) : (
          <TradeTable trades={closedTrades} />
        )}
      </div>

      {showConfirmReset && (
        <ConfirmDialog
          title="Reset Account"
          message={`This will delete all trades and reset "${account.name}" to its starting balance. This cannot be undone.`}
          confirmLabel="Reset"
          onConfirm={handleReset}
          onCancel={() => setShowConfirmReset(false)}
        />
      )}

      {showConfirmDelete && (
        <ConfirmDialog
          title="Delete Account"
          message={`This will permanently delete "${account.name}" and all its trade history. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowConfirmDelete(false)}
          destructive
        />
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-900/40 to-blue-800/20 border-blue-700/50',
    green: 'from-green-900/40 to-green-800/20 border-green-700/50',
    red: 'from-red-900/40 to-red-800/20 border-red-700/50',
    yellow: 'from-yellow-900/40 to-yellow-800/20 border-yellow-700/50',
  }

  return (
    <div className={`rounded-lg p-4 border bg-gradient-to-br ${colorMap[color] || colorMap.blue}`}>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}

function TradeTable({ trades }: { trades: TrainingTrade[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-700/50">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-300 uppercase">Symbol</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-300 uppercase">Type</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-300 uppercase">Entry</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-300 uppercase">Target</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-300 uppercase">Stop</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-300 uppercase">Shares</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-300 uppercase">Score</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-300 uppercase">Drift</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-300 uppercase">Exit</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-300 uppercase">P&L</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {trades.map(trade => (
            <tr key={trade.id} className="hover:bg-slate-700/20">
              <td className="px-4 py-2.5 text-sm font-medium text-white">{trade.symbol}</td>
              <td className="px-4 py-2.5 text-sm">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  trade.trade_type === 'long' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                }`}>
                  {trade.trade_type.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-300">${trade.entry_price.toFixed(2)}</td>
              <td className="px-4 py-2.5 text-sm text-slate-300">${trade.target_price.toFixed(2)}</td>
              <td className="px-4 py-2.5 text-sm text-slate-300">${trade.stop_loss.toFixed(2)}</td>
              <td className="px-4 py-2.5 text-sm text-slate-300">{Math.floor(trade.position_size)}</td>
              <td className="px-4 py-2.5 text-sm text-slate-300">{trade.odds_score?.toFixed(1) || '-'}</td>
              <td className="px-4 py-2.5 text-sm">
                {trade.was_drift_decision ? (
                  <span className="text-amber-400 text-xs" title={trade.drift_reason || ''}>Drifted</span>
                ) : (
                  <span className="text-slate-500 text-xs">Base</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-300">
                {trade.exit_reason ? (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    trade.exit_reason === 'target' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                  }`}>
                    {trade.exit_reason}
                  </span>
                ) : (
                  <span className="text-yellow-400 text-xs">Open</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-sm">
                {trade.profit_loss !== null ? (
                  <span className={`font-medium ${(trade.profit_loss || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.profit_loss >= 0 ? '+' : ''}${trade.profit_loss.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel, destructive
}: {
  title: string; message: string; confirmLabel: string
  onConfirm: () => void; onCancel: () => void; destructive?: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex space-x-3">
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              destructive
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
