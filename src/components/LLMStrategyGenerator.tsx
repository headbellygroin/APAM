import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { trainingAccountService, TrainingAccount } from '@/lib/trainingAccountService'
import { llmService, StrategyProposalResult, FleetAccountSummary } from '@/lib/llmService'
import {
  Cpu, Loader2, ChevronDown, ChevronRight,
  Check, X, Sparkles, BarChart3, ArrowRight,
} from 'lucide-react'

const WEIGHT_LABELS: Record<string, string> = {
  strengthScore: 'Strength',
  timeScore: 'Time',
  freshnessScore: 'Freshness',
  trendScore: 'Trend',
  curveScore: 'Curve',
  profitZoneScore: 'Profit Zone',
}

const THRESHOLD_LABELS: Record<string, string> = {
  minOddsScore: 'Min Odds',
  minRiskReward: 'Min R:R',
  confidenceFloor: 'Confidence Floor',
}

export default function LLMStrategyGenerator() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<TrainingAccount[]>([])
  const [proposal, setProposal] = useState<StrategyProposalResult | null>(null)
  const [pastProposals, setPastProposals] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return
    const [accts, proposals] = await Promise.all([
      trainingAccountService.getAccounts(user.id),
      llmService.getStrategyProposals(user.id),
    ])
    setAccounts(accts)
    setPastProposals(proposals)
  }

  const generateStrategy = async () => {
    if (!user || accounts.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const fleetData: FleetAccountSummary[] = accounts
        .filter(a => a.total_trades >= 10)
        .map(a => ({
          name: a.name,
          strategy: a.strategy_id,
          mode: a.mode,
          winRate: a.win_rate,
          profitFactor: a.profit_factor,
          totalTrades: a.total_trades,
          totalPL: a.total_profit_loss,
          maxDrawdown: a.max_drawdown,
          learnedWeights: { ...(a.learned_weights || {}) } as Record<string, number>,
          thresholdAdjustments: { ...(a.threshold_adjustments || {}) } as Record<string, number>,
          driftPct: a.total_decisions > 0 ? (a.drift_decisions / a.total_decisions) * 100 : 0,
          generation: a.generation || 0,
        }))

      if (fleetData.length === 0) {
        setError('Need at least one account with 10+ trades to generate strategy proposals')
        return
      }

      const result = await llmService.generateStrategy(fleetData)
      setProposal(result)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Strategy generation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleProposalAction = async (id: string, action: 'applied' | 'rejected') => {
    await llmService.updateProposalStatus(id, action)
    await loadData()
  }

  const eligibleCount = accounts.filter(a => a.total_trades >= 10).length

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-teal-400" />
          <h2 className="text-lg font-semibold text-white">AI Strategy Generator</h2>
          <span className="text-xs text-slate-500">({eligibleCount} eligible accounts)</span>
        </div>
        <button
          onClick={generateStrategy}
          disabled={loading || eligibleCount === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Generating...' : 'Generate Proposal'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 rounded-lg p-3 border border-red-700/30 mb-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!proposal && !loading && (
        <div className="text-center py-6">
          <Cpu className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            Feed your fleet's performance data to AI to generate optimized strategy configurations.
          </p>
        </div>
      )}

      {proposal && (
        <div className="space-y-4">
          <div className="bg-teal-900/20 rounded-lg p-4 border border-teal-700/30">
            <h3 className="text-base font-semibold text-teal-300 mb-2">{proposal.proposalName}</h3>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Proposed Weights</p>
                <div className="space-y-1.5">
                  {Object.entries(proposal.proposedWeights).map(([key, val]) => {
                    const drift = (val as number) - 1.0
                    return (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{WEIGHT_LABELS[key] || key}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">1.0</span>
                          <ArrowRight className="h-3 w-3 text-slate-600" />
                          <span className={`font-mono font-medium ${
                            drift > 0.02 ? 'text-emerald-400' : drift < -0.02 ? 'text-red-400' : 'text-slate-300'
                          }`}>
                            {(val as number).toFixed(3)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Proposed Thresholds</p>
                <div className="space-y-1.5">
                  {Object.entries(proposal.proposedThresholds).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{THRESHOLD_LABELS[key] || key}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">0</span>
                        <ArrowRight className="h-3 w-3 text-slate-600" />
                        <span className={`font-mono font-medium ${
                          (val as number) > 0 ? 'text-emerald-400' : (val as number) < 0 ? 'text-red-400' : 'text-slate-300'
                        }`}>
                          {(val as number) > 0 ? '+' : ''}{(val as number).toFixed(3)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {proposal.reasoning && (
              <div className="bg-slate-800/60 rounded-lg p-3 mb-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Reasoning</p>
                <p className="text-sm text-slate-300 leading-relaxed">{proposal.reasoning}</p>
              </div>
            )}

            {proposal.expectedImprovement && (
              <div className="bg-slate-800/60 rounded-lg p-3 mb-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Expected Improvement</p>
                <p className="text-sm text-teal-300">{proposal.expectedImprovement}</p>
              </div>
            )}

            {proposal.fleetInsights.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Fleet Insights</p>
                <ul className="space-y-1">
                  {proposal.fleetInsights.map((ins, i) => (
                    <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5 text-teal-400 flex-shrink-0 mt-0.5" />
                      {ins}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {proposal.convergenceAnalysis && (
              <div className="bg-slate-800/60 rounded-lg p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Convergence Analysis</p>
                <p className="text-xs text-slate-400">{proposal.convergenceAnalysis}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {pastProposals.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-sm font-medium text-white mb-2"
          >
            Past Proposals ({pastProposals.length})
            {showPast ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>
          {showPast && (
            <div className="space-y-2">
              {pastProposals.map((p: any) => (
                <div key={p.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{p.proposal_name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        p.status === 'applied' ? 'bg-emerald-900/30 text-emerald-300' :
                        p.status === 'rejected' ? 'bg-red-900/30 text-red-300' :
                        'bg-amber-900/30 text-amber-300'
                      }`}>{p.status}</span>
                    </div>
                    {p.status === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleProposalAction(p.id, 'applied')}
                          className="p-1 bg-emerald-600/30 rounded hover:bg-emerald-600/50 transition-colors"
                          title="Mark as applied"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        </button>
                        <button
                          onClick={() => handleProposalAction(p.id, 'rejected')}
                          className="p-1 bg-red-600/30 rounded hover:bg-red-600/50 transition-colors"
                          title="Reject"
                        >
                          <X className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</p>
                  {p.reasoning && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.reasoning}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
