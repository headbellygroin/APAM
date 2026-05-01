import { Signal, signalService } from '@/lib/signalService'
import { TrendingUp, TrendingDown, Clock, Zap, Play } from 'lucide-react'
import { TrackRecord, trackRecordService } from '@/lib/signalTrackRecord'
import LLMTradeAnalysis from './LLMTradeAnalysis'

interface SignalCardProps {
  signal: Signal
  patternRecord?: TrackRecord | null
  onExecute?: (signal: Signal) => void
  executing?: boolean
}

export default function SignalCard({ signal, patternRecord, onExecute, executing }: SignalCardProps) {
  const isLong = signal.action === 'long'
  const tierLabel = signalService.getStrengthLabel(signal.strength_tier as any)
  const tierDesc = signalService.getStrengthDescription(signal.strength_tier as any)
  const timeStr = signalService.timeAgo(signal.created_at)
  const isActive = signal.status === 'active'
  const reasoning = signal.reasoning as any

  const tierColor = {
    strong_edge: 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400',
    developing_edge: 'bg-sky-900/30 border-sky-700/50 text-sky-400',
    experimental: 'bg-slate-700/30 border-slate-600/50 text-slate-400',
  }[signal.strength_tier] || 'bg-slate-700/30 border-slate-600/50 text-slate-400'

  const tierBadgeColor = {
    strong_edge: 'bg-emerald-500/20 text-emerald-300',
    developing_edge: 'bg-sky-500/20 text-sky-300',
    experimental: 'bg-slate-600/20 text-slate-400',
  }[signal.strength_tier] || 'bg-slate-600/20 text-slate-400'

  const rr = reasoning?.riskRewardRatio?.toFixed(2) || '0'

  return (
    <div className={`rounded-lg p-5 border transition-all ${tierColor}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isLong ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
            {isLong ? (
              <TrendingUp className="h-5 w-5 text-green-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-white">{signal.symbol}</h3>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                isLong ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
              }`}>
                {signal.action.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="h-3 w-3 text-slate-500" />
              <span className="text-xs text-slate-500">{timeStr}</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Score</p>
            <p className="text-xl font-bold text-white">{signal.odds_score.toFixed(1)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${tierBadgeColor}`}>
          <Zap className="h-3 w-3 inline mr-1" />
          {tierLabel}
        </span>
        <span className="text-xs text-slate-500">{tierDesc}</span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3">
        <div className="bg-slate-800/50 rounded p-2">
          <p className="text-[10px] text-slate-500 uppercase">Entry</p>
          <p className="text-sm font-medium text-white">${signal.entry_price.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2">
          <p className="text-[10px] text-slate-500 uppercase">Stop</p>
          <p className="text-sm font-medium text-red-400">${signal.stop_loss.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2">
          <p className="text-[10px] text-slate-500 uppercase">Target</p>
          <p className="text-sm font-medium text-green-400">${signal.target_price.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2">
          <p className="text-[10px] text-slate-500 uppercase">R:R</p>
          <p className="text-sm font-medium text-white">{rr}:1</p>
        </div>
      </div>

      {patternRecord && patternRecord.total_executed > 0 && (
        <div className="bg-slate-900/60 rounded-lg p-3 mb-3 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
            AI Track Record for this pattern
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-sm font-bold text-white">
                {(trackRecordService.getWinRate(patternRecord) * 100).toFixed(0)}%
              </p>
              <p className="text-[10px] text-slate-500">Win Rate</p>
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {patternRecord.wins}/{patternRecord.wins + patternRecord.losses}
              </p>
              <p className="text-[10px] text-slate-500">W / L</p>
            </div>
            <div>
              <p className="text-sm font-bold text-green-400">
                ${patternRecord.avg_win.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-500">Avg Win</p>
            </div>
            <div>
              <p className={`text-sm font-bold ${
                trackRecordService.getExpectancy(patternRecord) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${trackRecordService.getExpectancy(patternRecord).toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-500">Expectancy</p>
            </div>
          </div>
        </div>
      )}

      {isActive && (
        <div className="mb-3">
          <LLMTradeAnalysis signal={signal} />
        </div>
      )}

      {isActive && onExecute && (
        <button
          onClick={() => onExecute(signal)}
          disabled={executing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          <Play className="h-4 w-4" />
          {executing ? 'Executing...' : 'Execute Paper Trade'}
        </button>
      )}

      {signal.auto_executed && (
        <div className="mt-2 text-center">
          <span className="text-xs text-sky-400 bg-sky-500/10 px-2 py-1 rounded-full">
            Auto-executed by Follow Mode
          </span>
        </div>
      )}
    </div>
  )
}
