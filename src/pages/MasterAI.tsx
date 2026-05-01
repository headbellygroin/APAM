import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Navigate } from 'react-router-dom'
import {
  Crown,
  RefreshCw,
  Save,
  Camera,
  Brain,
  Users,
  Activity,
  Target,
  ChevronDown,
  ChevronRight,
  Zap,
  Eye,
  Shield,
  Clock,
} from 'lucide-react'
import {
  MasterAISynthesis,
  BoostReport,
  UserContribution,
  synthesizeMasterAI,
  saveMasterAIState,
  saveSnapshot,
  loadSnapshots,
} from '@/lib/masterAI'
import MasterAIOrchestrator from '@/components/MasterAIOrchestrator'
import LLMStrategyGenerator from '@/components/LLMStrategyGenerator'

const SYNC_INTERVAL = 30 * 60 * 1000

const WEIGHT_LABELS: Record<string, string> = {
  strengthScore: 'Strength',
  timeScore: 'Time',
  freshnessScore: 'Freshness',
  trendScore: 'Trend',
  curveScore: 'Curve',
  profitZoneScore: 'Profit Zone',
}

function AgreementBadge({ agreement }: { agreement: string }) {
  const styles: Record<string, string> = {
    strong: 'bg-emerald-500/20 text-emerald-400',
    moderate: 'bg-amber-500/20 text-amber-400',
    divergent: 'bg-red-500/20 text-red-400',
  }

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[agreement] || styles.divergent}`}>
      {agreement}
    </span>
  )
}

function BoostIndicator({ boost }: { boost: BoostReport }) {
  const color = boost.boostDirection === 'reinforced'
    ? 'text-emerald-400'
    : boost.boostDirection === 'cautioned'
      ? 'text-amber-400'
      : 'text-slate-500'

  const bgColor = boost.boostDirection === 'reinforced'
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : boost.boostDirection === 'cautioned'
      ? 'bg-amber-500/10 border-amber-500/20'
      : 'bg-slate-800/50 border-slate-700/50'

  const ownDrift = boost.ownValue - 1.0
  const collectiveDrift = boost.collectiveValue - 1.0

  return (
    <div className={`rounded-lg border p-3 ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white">{WEIGHT_LABELS[boost.factor] || boost.factor}</span>
        <div className="flex items-center gap-1.5">
          {boost.boostDirection === 'reinforced' && <Zap className="h-3.5 w-3.5 text-emerald-400" />}
          {boost.boostDirection === 'cautioned' && <Shield className="h-3.5 w-3.5 text-amber-400" />}
          <span className={`text-xs font-medium ${color}`}>
            {boost.boostDirection === 'reinforced' ? 'Reinforced' :
             boost.boostDirection === 'cautioned' ? 'Caution' : 'Neutral'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-slate-500 block">Your AI</span>
          <span className={`font-mono ${ownDrift > 0.02 ? 'text-emerald-400' : ownDrift < -0.02 ? 'text-red-400' : 'text-slate-400'}`}>
            {ownDrift > 0 ? '+' : ''}{(ownDrift * 100).toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Collective</span>
          <span className={`font-mono ${collectiveDrift > 0.02 ? 'text-emerald-400' : collectiveDrift < -0.02 ? 'text-red-400' : 'text-slate-400'}`}>
            {collectiveDrift > 0 ? '+' : ''}{(collectiveDrift * 100).toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Blended</span>
          <span className={`font-mono ${color}`}>
            {(boost.blendedValue - 1.0) > 0 ? '+' : ''}{((boost.blendedValue - 1.0) * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

function ContributorRow({ contribution }: { contribution: UserContribution }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-slate-700/50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-2.5 px-3 hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
          {contribution.email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white truncate">{contribution.email}</span>
            {contribution.aiName && contribution.nameStatus === 'earned' && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                <Brain className="h-3 w-3" />
                {contribution.aiName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs flex-shrink-0">
          <div className="text-right">
            <span className="text-slate-400">Trades</span>
            <div className="text-white font-medium">{contribution.totalTrades}</div>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Win Rate</span>
            <div className={`font-medium ${contribution.winRate >= 55 ? 'text-emerald-400' : contribution.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
              {contribution.winRate.toFixed(1)}%
            </div>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Influence</span>
            <div className="text-sky-400 font-medium">{(contribution.influence * 100).toFixed(0)}%</div>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Drifting</span>
            <div className={contribution.isDrifting ? 'text-amber-400' : 'text-slate-500'}>
              {contribution.isDrifting ? 'Yes' : 'No'}
            </div>
          </div>
          {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pl-14">
          <div className="bg-slate-900/50 rounded-lg p-3">
            <h5 className="text-xs font-medium text-slate-400 mb-2">Weight Adjustments</h5>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {Object.entries(contribution.weights).map(([key, val]) => {
                const drift = (val as number) - 1.0
                const isUp = drift > 0.02
                const isDown = drift < -0.02
                return (
                  <div key={key} className="flex justify-between">
                    <span className="text-slate-400">{WEIGHT_LABELS[key] || key}</span>
                    <span className={isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-slate-500'}>
                      {drift > 0 ? '+' : ''}{(drift * 100).toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-500">
              <span>Patterns: {contribution.patternCount}</span>
              <span>P/L: <span className={contribution.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}>${contribution.totalPL.toFixed(2)}</span></span>
              {contribution.lastUpdated && (
                <span>Last update: {new Date(contribution.lastUpdated).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MasterAI() {
  const { user, isAdmin, loading } = useAuth()
  const [synthesis, setSynthesis] = useState<MasterAISynthesis | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [snapshotNote, setSnapshotNote] = useState('')
  const [showSnapshotInput, setShowSnapshotInput] = useState(false)
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showContributors, setShowContributors] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!loading && isAdmin && user) {
      runSynthesis()
      loadHistory()

      syncTimerRef.current = setInterval(() => {
        runSynthesis()
      }, SYNC_INTERVAL)

      return () => {
        if (syncTimerRef.current) clearInterval(syncTimerRef.current)
      }
    }
  }, [loading, isAdmin, user])

  const runSynthesis = async () => {
    if (!user) return
    setIsLoading(true)
    const result = await synthesizeMasterAI(user.id)
    setSynthesis(result)
    setIsLoading(false)
  }

  const handleSync = async () => {
    if (!user) return
    setIsSyncing(true)
    const result = await synthesizeMasterAI(user.id)
    setSynthesis(result)

    const saved = await saveMasterAIState(user.id, result)
    setStatusMsg(saved ? 'Synced and saved' : 'Sync complete, save failed')

    setIsSyncing(false)
    setTimeout(() => setStatusMsg(''), 3000)
  }

  const handleSnapshot = async () => {
    if (!synthesis) return
    setIsSaving(true)
    const saved = await saveSnapshot(synthesis, snapshotNote)
    if (saved) {
      setStatusMsg('Snapshot saved')
      setSnapshotNote('')
      setShowSnapshotInput(false)
      await loadHistory()
    } else {
      setStatusMsg('Failed to save snapshot')
    }
    setIsSaving(false)
    setTimeout(() => setStatusMsg(''), 3000)
  }

  const loadHistory = async () => {
    const data = await loadSnapshots()
    setSnapshots(data)
  }

  if (!loading && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const owner = synthesis?.ownerState
  const collective = synthesis?.collective
  const boostReport = synthesis?.boostReport || []
  const contributions = synthesis?.contributions || []

  const patternEntries = collective ? Object.values(collective.synthesizedPatterns) : []
  const promotedPatterns = patternEntries.filter(p => p.consensus === 'promote')
  const demotedPatterns = patternEntries.filter(p => p.consensus === 'demote')
  const mixedPatterns = patternEntries.filter(p => p.consensus === 'mixed')

  const reinforced = boostReport.filter(b => b.boostDirection === 'reinforced')
  const cautioned = boostReport.filter(b => b.boostDirection === 'cautioned')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Crown className="h-8 w-8 text-amber-400" />
            Master AI
          </h1>
          <p className="text-slate-400 mt-1">
            Your personal AI with collective intelligence -- same standards, accelerated learning
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusMsg && (
            <span className="text-sm text-emerald-400 mr-2">{statusMsg}</span>
          )}
          <button
            onClick={() => setShowSnapshotInput(!showSnapshotInput)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
          >
            <Camera className="h-4 w-4" />
            Snapshot
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>
      </div>

      {showSnapshotInput && (
        <div className="bg-slate-800 rounded-lg border border-amber-500/30 p-4 flex items-center gap-3">
          <input
            value={snapshotNote}
            onChange={e => setSnapshotNote(e.target.value)}
            placeholder="Snapshot notes (optional)..."
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            onClick={handleSnapshot}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-slate-400">Synthesizing collective intelligence...</div>
        </div>
      ) : !synthesis ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <Brain className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">No Data Yet</h2>
          <p className="text-slate-400">Start trading and your AI will begin learning. Other users' AIs will feed into the collective intelligence as they trade.</p>
        </div>
      ) : (
        <>
          {/* Training Account Orchestrator */}
          <MasterAIOrchestrator />

          {/* AI Strategy Generator */}
          <LLMStrategyGenerator />

          {/* Owner AI Status */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-800/80 rounded-lg border border-amber-500/20 p-5">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Brain className="h-5 w-5 text-amber-400" />
              Your AI
              {owner?.aiName && owner.nameStatus === 'earned' && (
                <span className="text-sm bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full ml-2">
                  {owner.aiName}
                </span>
              )}
              {owner?.nameStatus === 'unearned' && (
                <span className="text-xs text-slate-500 ml-2">Name not yet earned</span>
              )}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { label: 'Trades', value: owner?.totalTrades || 0, color: 'text-white' },
                { label: 'Win Rate', value: `${(owner?.winRate || 0).toFixed(1)}%`, color: (owner?.winRate || 0) >= 55 ? 'text-emerald-400' : (owner?.winRate || 0) >= 45 ? 'text-amber-400' : 'text-red-400' },
                { label: 'P/L', value: `$${(owner?.totalPL || 0).toFixed(2)}`, color: (owner?.totalPL || 0) >= 0 ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Decisions', value: owner?.totalDecisions || 0, color: 'text-white' },
                { label: 'Drifted', value: owner?.driftedDecisions || 0, color: owner?.isDrifting ? 'text-amber-400' : 'text-slate-400' },
                { label: 'Patterns', value: Object.keys(owner?.patterns || {}).length, color: 'text-white' },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-0.5">{stat.label}</div>
                  <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Collective Intelligence Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Contributing AIs', value: collective?.userCount || 0, icon: Users, color: 'text-white' },
              { label: 'Collective Trades', value: collective?.totalTradesAnalyzed || 0, icon: Activity, color: 'text-white' },
              { label: 'Convergence', value: `${(collective?.convergenceScore || 0).toFixed(0)}%`, icon: Target, color: (collective?.convergenceScore || 0) >= 70 ? 'text-emerald-400' : (collective?.convergenceScore || 0) >= 40 ? 'text-amber-400' : 'text-red-400' },
              { label: 'Reinforced', value: reinforced.length, icon: Zap, color: 'text-emerald-400' },
              { label: 'Cautioned', value: cautioned.length, icon: Shield, color: 'text-amber-400' },
            ].map(stat => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                    <span className="text-xs text-slate-400">{stat.label}</span>
                  </div>
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                </div>
              )
            })}
          </div>

          {/* Boost Report */}
          {boostReport.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                Collective Intelligence Boost
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                How other AIs' learnings compare to yours. "Reinforced" = others agree with your AI's direction.
                "Caution" = others learned the opposite. Blended values factor in collective with {(0.3 * 100).toFixed(0)}% weight when agreement is strong.
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                {boostReport.map(boost => (
                  <BoostIndicator key={boost.factor} boost={boost} />
                ))}
              </div>
            </div>
          )}

          {/* Your AI Weights vs Collective */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
              <Eye className="h-5 w-5 text-sky-400" />
              Weight Comparison
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Side-by-side view of your AI's learned weights vs the collective consensus.
            </p>
            <div className="space-y-0">
              {Object.entries(collective?.weightConvergence || {}).map(([key, data]) => {
                const ownWeight = owner?.weights[key as keyof typeof owner.weights] || 1.0
                const ownDrift = ownWeight - 1.0
                const collectiveDrift = data.mean - 1.0

                return (
                  <div key={key} className="flex items-center gap-3 py-2.5 border-b border-slate-700/50 last:border-0">
                    <div className="w-24 text-sm text-slate-300 font-medium">{WEIGHT_LABELS[key] || key}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-slate-500 w-16">You</span>
                            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${ownDrift > 0.02 ? 'bg-amber-400' : ownDrift < -0.02 ? 'bg-amber-400' : 'bg-slate-500'}`}
                                style={{ width: `${Math.min(100, 50 + Math.abs(ownDrift) * 200)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-mono w-14 text-right ${ownDrift > 0.02 ? 'text-emerald-400' : ownDrift < -0.02 ? 'text-red-400' : 'text-slate-500'}`}>
                              {ownDrift > 0 ? '+' : ''}{(ownDrift * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-16">Collective</span>
                            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${collectiveDrift > 0.02 ? 'bg-sky-400' : collectiveDrift < -0.02 ? 'bg-sky-400' : 'bg-slate-500'}`}
                                style={{ width: `${Math.min(100, 50 + Math.abs(collectiveDrift) * 200)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-mono w-14 text-right ${collectiveDrift > 0.02 ? 'text-emerald-400' : collectiveDrift < -0.02 ? 'text-red-400' : 'text-slate-500'}`}>
                              {collectiveDrift > 0 ? '+' : ''}{(collectiveDrift * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <AgreementBadge agreement={data.agreement} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pattern Consensus */}
          {patternEntries.length > 0 && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
              <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-400" />
                Pattern Consensus ({patternEntries.length})
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                What other AIs have learned about specific patterns. "Mixed" = disagreement worth investigating.
              </p>

              {mixedPatterns.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-amber-400 mb-2">Disputed ({mixedPatterns.length})</h3>
                  <div className="space-y-2">
                    {mixedPatterns.map(p => (
                      <PatternCard key={p.patternKey} pattern={p} ownerPatterns={owner?.patterns || {}} />
                    ))}
                  </div>
                </div>
              )}

              {promotedPatterns.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-emerald-400 mb-2">Promote ({promotedPatterns.length})</h3>
                  <div className="space-y-2">
                    {promotedPatterns.map(p => (
                      <PatternCard key={p.patternKey} pattern={p} ownerPatterns={owner?.patterns || {}} />
                    ))}
                  </div>
                </div>
              )}

              {demotedPatterns.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-red-400 mb-2">Demote ({demotedPatterns.length})</h3>
                  <div className="space-y-2">
                    {demotedPatterns.map(p => (
                      <PatternCard key={p.patternKey} pattern={p} ownerPatterns={owner?.patterns || {}} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contributors */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
            <button
              onClick={() => setShowContributors(!showContributors)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-sky-400" />
                Other AIs Feeding In ({contributions.length})
              </h2>
              {showContributors ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
            </button>

            {showContributors && (
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-3">
                  Each AI's influence is based on trade volume, win rate, and profitability. Data flows one way -- in.
                </p>
                <div className="max-h-[500px] overflow-y-auto">
                  {contributions
                    .sort((a, b) => b.influence - a.influence)
                    .map(c => (
                      <ContributorRow key={c.userId} contribution={c} />
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Sync Info */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Last sync: {synthesis?.lastSyncAt ? new Date(synthesis.lastSyncAt).toLocaleString() : 'Never'}
            </div>
            <span>Auto-syncs every 30 minutes</span>
          </div>

          {/* Snapshot History */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Camera className="h-5 w-5 text-slate-400" />
                Snapshot History ({snapshots.length})
              </h2>
              {showHistory ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
            </button>

            {showHistory && (
              <div className="mt-4 space-y-3">
                {snapshots.length === 0 ? (
                  <p className="text-sm text-slate-500">No snapshots yet. Capture the current state to track how the collective intelligence evolves.</p>
                ) : (
                  snapshots.map(s => (
                    <div key={s.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white font-medium">
                          {new Date(s.created_at).toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-400">
                          {s.snapshot_data?.collective?.userCount || 0} AIs, {s.snapshot_data?.collective?.totalTradesAnalyzed || 0} trades
                        </span>
                      </div>
                      {s.notes && <p className="text-xs text-slate-400">{s.notes}</p>}
                      <div className="flex gap-3 mt-2 text-xs text-slate-500">
                        <span>Convergence: {(s.snapshot_data?.collective?.convergenceScore || 0).toFixed(0)}%</span>
                        <span>Contributors: {(s.user_contributions || []).length}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function PatternCard({ pattern, ownerPatterns }: {
  pattern: any
  ownerPatterns: Record<string, any>
}) {
  const ownerHasPattern = ownerPatterns[pattern.patternKey]

  const consensusColor: Record<string, string> = {
    promote: 'border-emerald-500/30 bg-emerald-500/5',
    demote: 'border-red-500/30 bg-red-500/5',
    mixed: 'border-amber-500/30 bg-amber-500/5',
    none: 'border-slate-600/30',
  }

  return (
    <div className={`rounded-lg border p-3 ${consensusColor[pattern.consensus] || consensusColor.none}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-white">{pattern.patternKey}</span>
          {ownerHasPattern && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
              Your AI: {ownerHasPattern.action}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">{pattern.userCount} AI{pattern.userCount !== 1 ? 's' : ''}</span>
          <span className="text-slate-400">{pattern.totalSampleSize} trades</span>
          <span className={`font-medium ${pattern.avgWinRate >= 0.55 ? 'text-emerald-400' : pattern.avgWinRate >= 0.45 ? 'text-amber-400' : 'text-red-400'}`}>
            {(pattern.avgWinRate * 100).toFixed(0)}% win
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {pattern.details.map((d: any, i: number) => (
          <span key={i} className={`text-xs px-2 py-0.5 rounded ${
            d.action === 'promote' ? 'bg-emerald-500/20 text-emerald-400' :
            d.action === 'demote' ? 'bg-red-500/20 text-red-400' :
            'bg-slate-600/30 text-slate-400'
          }`}>
            {d.email.split('@')[0]}: {d.action} ({(d.winRate * 100).toFixed(0)}%, n={d.sampleSize})
          </span>
        ))}
      </div>
    </div>
  )
}
