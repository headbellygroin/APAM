import { useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Search,
  Link as LinkIcon,
} from 'lucide-react'
import { UserTradeAnomaly, ANOMALY_TYPES } from '@/lib/realWorldEvents'

interface AnomalyCardProps {
  anomaly: UserTradeAnomaly
  onInvestigate: (anomaly: UserTradeAnomaly) => void
  onDismiss: (anomalyId: string) => void
  onResolve: (anomaly: UserTradeAnomaly) => void
}

export default function AnomalyCard({ anomaly, onInvestigate, onDismiss, onResolve }: AnomalyCardProps) {
  const [expanded, setExpanded] = useState(false)

  const typeInfo = ANOMALY_TYPES.find(t => t.value === anomaly.anomaly_type)

  const statusColors: Record<string, string> = {
    detected: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    investigating: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    dismissed: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
  }

  const outcomeColors: Record<string, string> = {
    win: 'text-emerald-400',
    loss: 'text-red-400',
    pending: 'text-slate-400',
  }

  return (
    <div className={`rounded-lg border ${anomaly.status === 'detected' ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700 bg-slate-800'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${anomaly.status === 'detected' ? 'text-amber-400' : anomaly.status === 'investigating' ? 'text-sky-400' : 'text-slate-500'}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{anomaly.symbol}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[anomaly.status]}`}>
                {anomaly.status}
              </span>
              <span className="text-xs text-slate-500">
                {typeInfo?.label || anomaly.anomaly_type}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{anomaly.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right text-xs">
            <span className="text-slate-500">P/L</span>
            <div className={`font-medium ${anomaly.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${anomaly.profit_loss.toFixed(2)}
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="text-slate-500">Outcome</span>
            <div className={`font-medium ${outcomeColors[anomaly.outcome]}`}>
              {anomaly.outcome}
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="text-slate-500">Trades</span>
            <div className="font-medium text-white">{anomaly.user_trades.length}</div>
          </div>
          {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-3">
              <h4 className="text-xs font-medium text-slate-400 mb-2">AI Signal at Time</h4>
              {anomaly.ai_signal_at_time.hadSignal ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Signal</span>
                    <span className={anomaly.ai_signal_at_time.signalAction === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                      {anomaly.ai_signal_at_time.signalAction}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Confidence</span>
                    <span className="text-white">{anomaly.ai_signal_at_time.signalConfidence}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Odds Score</span>
                    <span className="text-white">{anomaly.ai_signal_at_time.signalOdds}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-400">No AI signal existed for this symbol</p>
              )}
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              <h4 className="text-xs font-medium text-slate-400 mb-2">Detection Info</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="text-white">{typeInfo?.label || anomaly.anomaly_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Confidence Gap</span>
                  <span className="text-amber-400">{anomaly.confidence_gap.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Detected</span>
                  <span className="text-white">{new Date(anomaly.detected_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-3">
            <h4 className="text-xs font-medium text-slate-400 mb-2">User Trades ({anomaly.user_trades.length})</h4>
            <div className="space-y-2">
              {anomaly.user_trades.map((trade, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{trade.userEmail?.split('@')[0] || 'User'}</span>
                    <span className={`flex items-center gap-0.5 ${trade.tradeType === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.tradeType === 'long' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {trade.tradeType}
                    </span>
                    <span className="text-slate-500">@ ${trade.entryPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{trade.status}</span>
                    {trade.profitLoss !== null && (
                      <span className={trade.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        ${trade.profitLoss.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {anomaly.review_notes && (
            <div className="bg-slate-900/50 rounded-lg p-3">
              <h4 className="text-xs font-medium text-slate-400 mb-1">Review Notes</h4>
              <p className="text-sm text-white">{anomaly.review_notes}</p>
            </div>
          )}

          {anomaly.status !== 'resolved' && anomaly.status !== 'dismissed' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onInvestigate(anomaly)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                Investigate
              </button>
              <button
                onClick={() => onResolve(anomaly)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Tag Event
              </button>
              <button
                onClick={() => onDismiss(anomaly.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Dismiss
              </button>
            </div>
          )}

          {anomaly.status === 'resolved' && anomaly.resolved_event_id && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Linked to Real World Event
            </div>
          )}
        </div>
      )}
    </div>
  )
}
