import { useState } from 'react'
import { llmService, EODNarrativeResult } from '@/lib/llmService'
import { EODReview } from '@/lib/masterAIOrchestrator'
import {
  Brain, Loader2, FileText, ShieldAlert,
  ChevronDown, ChevronRight, Lightbulb, AlertTriangle,
  Activity,
} from 'lucide-react'

interface Props {
  review: EODReview
}

export default function EODNarrative({ review }: Props) {
  const [narrative, setNarrative] = useState<EODNarrativeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await llmService.generateEODNarrative(review)
      setNarrative(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Narrative generation failed')
    } finally {
      setLoading(false)
    }
  }

  if (!narrative && !loading) {
    return (
      <button
        onClick={generate}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-slate-200 rounded-lg hover:from-slate-600 hover:to-slate-700 transition-all text-sm border border-slate-600/50"
      >
        <Brain className="h-4 w-4" />
        Generate AI Narrative for This Review
      </button>
    )
  }

  if (loading) {
    return (
      <div className="bg-slate-900/60 rounded-lg p-5 border border-slate-700/50">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Master AI is reflecting on today's performance...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 rounded-lg p-3 border border-red-700/30">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={generate} className="text-xs text-red-300 underline mt-1">Retry</button>
      </div>
    )
  }

  if (!narrative) return null

  const healthColor = narrative.fleetHealthScore >= 70 ? 'text-emerald-400' :
    narrative.fleetHealthScore >= 50 ? 'text-amber-400' : 'text-red-400'
  const healthBg = narrative.fleetHealthScore >= 70 ? 'bg-emerald-500' :
    narrative.fleetHealthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-sky-700/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-sky-400" />
          <span className="text-sm font-semibold text-white">Master AI Narrative</span>
          <div className="flex items-center gap-1.5 ml-2">
            <Activity className={`h-3.5 w-3.5 ${healthColor}`} />
            <span className={`text-sm font-bold ${healthColor}`}>{narrative.fleetHealthScore}/100</span>
            <span className="text-xs text-slate-500">Fleet Health</span>
          </div>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${healthBg}`}
              style={{ width: `${narrative.fleetHealthScore}%` }}
            />
          </div>

          {narrative.narrative && (
            <div className="bg-slate-800/60 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="h-3.5 w-3.5 text-sky-400" />
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Narrative</p>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{narrative.narrative}</p>
            </div>
          )}

          {narrative.spawnReasoning && (
            <div className="bg-slate-800/60 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-3.5 w-3.5 text-teal-400" />
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Spawn / Retire / Promote Reasoning</p>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{narrative.spawnReasoning}</p>
            </div>
          )}

          {narrative.riskAssessment && (
            <div className="bg-red-900/10 rounded-lg p-4 border border-red-800/20">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Risk Assessment</p>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{narrative.riskAssessment}</p>
            </div>
          )}

          {narrative.nextDayStrategy && (
            <div className="bg-sky-900/10 rounded-lg p-4 border border-sky-800/20">
              <div className="flex items-center gap-1.5 mb-2">
                <Brain className="h-3.5 w-3.5 text-sky-400" />
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Tomorrow's Strategy</p>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{narrative.nextDayStrategy}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {narrative.keyDecisions.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Key Decisions</p>
                <ul className="space-y-1">
                  {narrative.keyDecisions.map((d, i) => (
                    <li key={i} className="text-xs text-slate-300 flex gap-1.5">
                      <span className="text-sky-400 font-mono">{i + 1}.</span> {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {narrative.warnings.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Warnings</p>
                <ul className="space-y-1">
                  {narrative.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-300 flex gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
