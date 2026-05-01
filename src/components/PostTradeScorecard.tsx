import { Signal } from '@/lib/signalService'
import { Trophy, XCircle, Clock, Target } from 'lucide-react'

interface PostTradeScorecardProps {
  signal: Signal
}

export default function PostTradeScorecard({ signal }: PostTradeScorecardProps) {
  const isWin = (signal.profit_loss || 0) > 0
  const pl = signal.profit_loss || 0

  const borderColor = isWin ? 'border-green-700/50' : 'border-red-700/50'
  const bgColor = isWin ? 'bg-green-900/10' : 'bg-red-900/10'
  const plColor = isWin ? 'text-green-400' : 'text-red-400'

  return (
    <div className={`rounded-lg p-4 border ${borderColor} ${bgColor}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isWin ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
            {isWin ? (
              <Trophy className="h-5 w-5 text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{signal.symbol}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                signal.action === 'long' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
              }`}>
                {signal.action.toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                isWin ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
              }`}>
                {isWin ? 'WIN' : 'LOSS'}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${plColor}`}>
            {isWin ? '+' : ''}${pl.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500">Net P/L</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-3">
        <div className="bg-slate-800/50 rounded p-2 text-center">
          <p className="text-[10px] text-slate-500">Entry</p>
          <p className="text-xs font-medium text-white">${signal.entry_price.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2 text-center">
          <p className="text-[10px] text-slate-500">Exit</p>
          <p className="text-xs font-medium text-white">${(signal.exit_price || 0).toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2 text-center">
          <p className="text-[10px] text-slate-500">Target</p>
          <p className="text-xs font-medium text-slate-300">${signal.target_price.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2 text-center">
          <p className="text-[10px] text-slate-500">Stop</p>
          <p className="text-xs font-medium text-slate-300">${signal.stop_loss.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2 text-center">
          <p className="text-[10px] text-slate-500">Exit Reason</p>
          <p className="text-xs font-medium text-white capitalize">
            {signal.exit_reason || '-'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Target className="h-3 w-3" />
          Confidence at entry: {signal.confidence_score.toFixed(1)}/10
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(signal.created_at).toLocaleDateString()}
        </span>
        {signal.auto_executed && (
          <span className="text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
            Auto-executed
          </span>
        )}
      </div>
    </div>
  )
}
