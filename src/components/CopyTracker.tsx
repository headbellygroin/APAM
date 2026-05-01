import { Signal } from '@/lib/signalService'
import { Copy, TrendingUp, TrendingDown } from 'lucide-react'

interface CopyTrackerProps {
  closedSignals: Signal[]
}

export default function CopyTracker({ closedSignals }: CopyTrackerProps) {
  const executed = closedSignals.filter(s => s.profit_loss !== null)
  const wins = executed.filter(s => (s.profit_loss || 0) > 0)
  const losses = executed.filter(s => (s.profit_loss || 0) <= 0)
  const netPL = executed.reduce((sum, s) => sum + (s.profit_loss || 0), 0)
  const winRate = executed.length > 0 ? (wins.length / executed.length) * 100 : 0

  if (executed.length === 0) return null

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Copy className="h-5 w-5 text-sky-400" />
        <h3 className="text-lg font-bold text-white">Your Copy Performance</h3>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900/60 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{executed.length}</p>
          <p className="text-xs text-slate-500">Trades Copied</p>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-3 text-center">
          <p className={`text-2xl font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
            {winRate.toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500">Win Rate</p>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">
            <span className="text-green-400">{wins.length}</span>
            <span className="text-slate-600 mx-1">/</span>
            <span className="text-red-400">{losses.length}</span>
          </p>
          <p className="text-xs text-slate-500">Wins / Losses</p>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {netPL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
            <p className={`text-2xl font-bold ${netPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${Math.abs(netPL).toFixed(2)}
            </p>
          </div>
          <p className="text-xs text-slate-500">Net P/L</p>
        </div>
      </div>
    </div>
  )
}
