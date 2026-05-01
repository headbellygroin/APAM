import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { aiEngine } from '@/lib/aiEngine'
import { DriftRollback } from '@/lib/aiDriftEngine'
import {
  BookOpen,
  Shield,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  Layers,
  Scale,
  SlidersHorizontal,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

type RuleType = 'pattern_override' | 'weight_adjustment' | 'threshold_shift'

interface ActiveRule {
  type: RuleType
  description: string
  detail: Record<string, any>
  confidence: string
}

function RuleIcon({ type }: { type: RuleType }) {
  switch (type) {
    case 'pattern_override':
      return <Layers className="h-5 w-5 text-sky-400" />
    case 'weight_adjustment':
      return <Scale className="h-5 w-5 text-amber-400" />
    case 'threshold_shift':
      return <SlidersHorizontal className="h-5 w-5 text-emerald-400" />
  }
}

function ConfidenceBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    high: 'bg-emerald-500/20 text-emerald-400',
    medium: 'bg-amber-500/20 text-amber-400',
    low: 'bg-red-500/20 text-red-400',
  }

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[level] || styles.low}`}>
      {level}
    </span>
  )
}

function RollbackTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'pattern_override':
      return <Layers className="h-4 w-4 text-red-400" />
    case 'weight_reset':
      return <Scale className="h-4 w-4 text-amber-400" />
    case 'threshold_reset':
      return <SlidersHorizontal className="h-4 w-4 text-amber-400" />
    default:
      return <RotateCcw className="h-4 w-4 text-slate-400" />
  }
}

export default function AIRulebook() {
  const { user } = useAuth()
  const [activeRules, setActiveRules] = useState<ActiveRule[]>([])
  const [rollbacks, setRollbacks] = useState<DriftRollback[]>([])
  const [driftSummary, setDriftSummary] = useState<ReturnType<typeof aiEngine.getDriftSummary> | null>(null)
  const [expandedRollback, setExpandedRollback] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return
    setLoading(true)

    await aiEngine.initialize(user.id)
    setActiveRules(aiEngine.getActiveRules())
    setRollbacks(aiEngine.getRollbacks())
    setDriftSummary(aiEngine.getDriftSummary())

    setLoading(false)
  }

  const patternRules = activeRules.filter(r => r.type === 'pattern_override')
  const weightRules = activeRules.filter(r => r.type === 'weight_adjustment')
  const thresholdRules = activeRules.filter(r => r.type === 'threshold_shift')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-400">Loading rulebook...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-sky-400" />
          AI Rulebook
        </h1>
        <p className="text-slate-400 mt-1">
          Every rule the AI has created, modified, or rolled back -- fully transparent
        </p>
      </div>

      {driftSummary && (
        <div className="grid sm:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</p>
            <p className={`text-lg font-bold ${driftSummary.isDrifting ? 'text-sky-400' : 'text-slate-500'}`}>
              {driftSummary.isDrifting ? 'Drifting' : 'Baseline'}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Active Rules</p>
            <p className="text-lg font-bold text-white">{activeRules.length}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Drift Rate</p>
            <p className="text-lg font-bold text-white">{driftSummary.driftPercent.toFixed(1)}%</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Rollbacks</p>
            <p className={`text-lg font-bold ${driftSummary.totalRollbacks > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
              {driftSummary.totalRollbacks}
            </p>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-sky-400" />
            <h2 className="text-xl font-semibold text-white">Active AI Rules</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Rules the AI is currently applying on top of the base strategy
          </p>
        </div>

        {activeRules.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No drift rules active. The AI is following the base strategy exactly.</p>
            <p className="text-xs text-slate-500 mt-2">
              Rules appear after enough trade data to learn from (10+ trades for patterns, 30+ for weights, 50+ for thresholds)
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {patternRules.length > 0 && (
              <div className="p-6">
                <h3 className="text-sm font-semibold text-sky-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Pattern Overrides
                </h3>
                <div className="space-y-3">
                  {patternRules.map((rule, idx) => (
                    <div key={idx} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <RuleIcon type={rule.type} />
                          <div>
                            <p className="text-sm text-white">{rule.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                              <span>Sample: {rule.detail.sampleSize} trades</span>
                              <span>Win Rate: {(rule.detail.actualWinRate * 100).toFixed(0)}%</span>
                              <span>Score Adj: {rule.detail.scoreAdjustment > 0 ? '+' : ''}{rule.detail.scoreAdjustment?.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        <ConfidenceBadge level={rule.confidence} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {weightRules.length > 0 && (
              <div className="p-6">
                <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Weight Adjustments
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {weightRules.map((rule, idx) => (
                    <div key={idx} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          {rule.detail.drift > 0 ? (
                            <ArrowUpRight className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          ) : (
                            <ArrowDownRight className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                          )}
                          <div>
                            <p className="text-sm text-white capitalize">{rule.detail.factor?.replace('Score', '')}</p>
                            <p className="text-xs text-slate-400 mt-1">{rule.description}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              Weight: {rule.detail.baseWeight?.toFixed(2)} {'->'} {rule.detail.weight?.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <ConfidenceBadge level={rule.confidence} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {thresholdRules.length > 0 && (
              <div className="p-6">
                <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Threshold Shifts
                </h3>
                <div className="space-y-3">
                  {thresholdRules.map((rule, idx) => (
                    <div key={idx} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <RuleIcon type={rule.type} />
                          <div>
                            <p className="text-sm text-white">{rule.description}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              Shift: {rule.detail.shift > 0 ? '+' : ''}{rule.detail.shift?.toFixed(2)} points
                            </p>
                          </div>
                        </div>
                        <ConfidenceBadge level={rule.confidence} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-400" />
            <h2 className="text-xl font-semibold text-white">Rollback History</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            When drifted rules stopped working, the AI walked them back
          </p>
        </div>

        {rollbacks.length === 0 ? (
          <div className="p-12 text-center">
            <RotateCcw className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No rollbacks yet.</p>
            <p className="text-xs text-slate-500 mt-2">
              When the AI detects its drifted rules are losing, it automatically walks them back and logs it here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {rollbacks.sort((a, b) => b.timestamp - a.timestamp).map((rollback) => (
              <div key={rollback.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                <button
                  onClick={() => setExpandedRollback(expandedRollback === rollback.id ? null : rollback.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <RollbackTypeIcon type={rollback.type} />
                      <div>
                        <p className="text-sm text-white">{rollback.reason}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(rollback.timestamp).toLocaleDateString()} {new Date(rollback.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {rollback.triggerMetric}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        rollback.type === 'pattern_override' ? 'bg-sky-500/20 text-sky-400' :
                        rollback.type === 'weight_reset' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {rollback.type.replace('_', ' ')}
                      </span>
                      {expandedRollback === rollback.id ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                </button>

                {expandedRollback === rollback.id && (
                  <div className="mt-3 ml-8 grid sm:grid-cols-2 gap-3">
                    <div className="bg-red-950/30 rounded-lg p-3 border border-red-500/20">
                      <p className="text-xs text-red-400 uppercase tracking-wider mb-2 font-semibold">Before Rollback</p>
                      <div className="space-y-1">
                        {Object.entries(rollback.rolledBackFrom).map(([key, val]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-slate-400">{key}</span>
                            <span className="text-red-300 font-mono">
                              {typeof val === 'number' ? val.toFixed(3) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-emerald-950/30 rounded-lg p-3 border border-emerald-500/20">
                      <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2 font-semibold">After Rollback</p>
                      <div className="space-y-1">
                        {Object.entries(rollback.rolledBackTo).map(([key, val]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-slate-400">{key}</span>
                            <span className="text-emerald-300 font-mono">
                              {typeof val === 'number' ? val.toFixed(3) : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
