import { useState } from 'react'
import { Signal } from '@/lib/signalService'
import { llmService, TradeAnalysisResult } from '@/lib/llmService'
import { Brain, Loader2, ShieldCheck, ShieldAlert, ShieldQuestion, ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  signal: Signal
}

export default function LLMTradeAnalysis({ signal }: Props) {
  const [analysis, setAnalysis] = useState<TradeAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const reasoning = signal.reasoning as any

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await llmService.analyzeTradeSignal({
        symbol: signal.symbol,
        action: signal.action,
        oddsScore: signal.odds_score,
        entryPrice: signal.entry_price,
        stopLoss: signal.stop_loss,
        targetPrice: signal.target_price,
        reasoning: {
          curvePosition: reasoning?.curvePosition || '',
          trendDirection: reasoning?.trendDirection || '',
          zoneType: reasoning?.zoneType || '',
          scores: reasoning?.scores || {},
        },
        patternWinRate: (signal as any).pattern_win_rate,
        patternTradeCount: (signal as any).pattern_trade_count,
      })
      setAnalysis(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  if (!analysis && !loading) {
    return (
      <button
        onClick={runAnalysis}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm border border-slate-600/50"
      >
        <Brain className="h-4 w-4" />
        Deep Analysis (LLM)
      </button>
    )
  }

  if (loading) {
    return (
      <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700/50">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Analyzing {signal.symbol} with AI...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 rounded-lg p-3 border border-red-700/30">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={runAnalysis} className="text-xs text-red-300 underline mt-1">Retry</button>
      </div>
    )
  }

  if (!analysis) return null

  const verdictConfig: Record<string, { color: string, bg: string, border: string, icon: typeof ShieldCheck, label: string }> = {
    strong_buy: { color: 'text-emerald-300', bg: 'bg-emerald-900/30', border: 'border-emerald-700/50', icon: ShieldCheck, label: 'Strong Buy' },
    buy: { color: 'text-green-300', bg: 'bg-green-900/20', border: 'border-green-700/40', icon: ShieldCheck, label: 'Buy' },
    neutral: { color: 'text-amber-300', bg: 'bg-amber-900/20', border: 'border-amber-700/40', icon: ShieldQuestion, label: 'Neutral' },
    avoid: { color: 'text-red-300', bg: 'bg-red-900/20', border: 'border-red-700/40', icon: ShieldAlert, label: 'Avoid' },
  }

  const vc = verdictConfig[analysis.llmVerdict] || verdictConfig.neutral
  const VerdictIcon = vc.icon

  return (
    <div className={`rounded-lg border ${vc.border} ${vc.bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-white">LLM Analysis</span>
          <div className="flex items-center gap-1.5">
            <VerdictIcon className={`h-4 w-4 ${vc.color}`} />
            <span className={`text-sm font-semibold ${vc.color}`}>{vc.label}</span>
          </div>
          <span className="text-xs text-slate-500">({analysis.confidence}% confidence)</span>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                analysis.confidence >= 70 ? 'bg-emerald-500' :
                analysis.confidence >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${analysis.confidence}%` }}
            />
          </div>

          {analysis.keyFactors.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Key Factors</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.keyFactors.map((f, i) => (
                  <span key={i} className="text-xs bg-slate-800/80 text-slate-300 px-2 py-1 rounded">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.risks.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Risks</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.risks.map((r, i) => (
                  <span key={i} className="text-xs bg-red-900/30 text-red-300 px-2 py-1 rounded">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.marketContext && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Market Context</p>
              <p className="text-xs text-slate-300 leading-relaxed">{analysis.marketContext}</p>
            </div>
          )}

          {analysis.suggestion && (
            <div className="bg-slate-800/60 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Suggestion</p>
              <p className="text-sm text-slate-200 leading-relaxed">{analysis.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
