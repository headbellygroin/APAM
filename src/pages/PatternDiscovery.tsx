import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  Search,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  ChevronDown,
  ChevronRight,
  Beaker,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Sparkles,
  Play,
  RefreshCw,
} from 'lucide-react'
import {
  getObservations,
  getCandidateRules,
  getDiscoveryStats,
  runDiscoveryForAllAccounts,
  promoteToCandidate,
  updateCandidateRule,
  PatternObservation,
  CandidateRule,
  OBSERVATION_TYPES,
  RULE_TYPES,
} from '@/lib/patternDiscovery'

type TabId = 'observations' | 'candidates'

export default function PatternDiscovery() {
  const { user, isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('observations')
  const [observations, setObservations] = useState<PatternObservation[]>([])
  const [candidates, setCandidates] = useState<CandidateRule[]>([])
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getDiscoveryStats>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<string>('')
  const [expandedObs, setExpandedObs] = useState<Set<string>>(new Set())
  const [expandedCands, setExpandedCands] = useState<Set<string>>(new Set())
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [promoteForm, setPromoteForm] = useState({ name: '', description: '', type: 'score_boost' })

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    const [obs, cands, s] = await Promise.all([
      getObservations({ status: statusFilter || undefined, observationType: typeFilter || undefined }),
      getCandidateRules({ status: candidateStatusFilter || undefined }),
      getDiscoveryStats(),
    ])
    setObservations(obs)
    setCandidates(cands)
    setStats(s)
    setLoading(false)
  }

  const handleRunDiscovery = async () => {
    if (!user || scanning) return
    setScanning(true)
    await runDiscoveryForAllAccounts(user.id)
    await loadData()
    setScanning(false)
  }

  const handlePromote = async (obs: PatternObservation) => {
    if (!user || !promoteForm.name.trim()) return
    await promoteToCandidate(
      user.id,
      obs,
      promoteForm.name,
      promoteForm.description,
      promoteForm.type,
      { boost: obs.edge_pct > 0 ? Math.round(obs.edge_pct / 10) : 0 }
    )
    setPromotingId(null)
    setPromoteForm({ name: '', description: '', type: 'score_boost' })
    await loadData()
  }

  const handleCandidateAction = async (rule: CandidateRule, newStatus: string) => {
    await updateCandidateRule(rule.id, { status: newStatus } as Partial<CandidateRule>)
    await loadData()
  }

  const toggleObs = (id: string) => {
    setExpandedObs(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleCand = (id: string) => {
    setExpandedCands(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (user && !loading) loadData()
  }, [statusFilter, typeFilter, candidateStatusFilter])

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-slate-400">Admin access required.</p>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'observations', label: 'Discovered Patterns', count: observations.length },
    { id: 'candidates', label: 'Candidate Rules', count: candidates.length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pattern Discovery</h1>
          <p className="text-sm text-slate-400 mt-1">
            AI-discovered patterns not in any ruleset -- potential new rules
          </p>
        </div>
        <button
          onClick={handleRunDiscovery}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {scanning ? 'Scanning...' : 'Run Discovery'}
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Observations', value: stats.totalObservations, color: 'text-white' },
            { label: 'Candidates', value: stats.candidates, color: 'text-amber-400' },
            { label: 'Promoted', value: stats.promoted, color: 'text-sky-400' },
            { label: 'Proposed Rules', value: stats.proposedRules, color: 'text-blue-400' },
            { label: 'Testing', value: stats.testingRules, color: 'text-amber-400' },
            { label: 'Accepted', value: stats.acceptedRules, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 rounded-lg border border-slate-700 p-3 text-center">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {stats?.topEdge && (
        <div className="bg-slate-800 rounded-lg border border-emerald-500/30 p-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-emerald-400">Top Edge Discovery</p>
            <p className="text-sm text-slate-300 mt-1">{stats.topEdge.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
              <span>Significance: {stats.topEdge.significance_score.toFixed(0)}</span>
              <span>Edge: {stats.topEdge.edge_pct > 0 ? '+' : ''}{stats.topEdge.edge_pct.toFixed(1)}%</span>
              <span>Sample: {stats.topEdge.sample_size} trades</span>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-slate-700">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'observations' && (
        <ObservationsTab
          observations={observations}
          loading={loading}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onStatusFilter={setStatusFilter}
          onTypeFilter={setTypeFilter}
          expandedObs={expandedObs}
          toggleObs={toggleObs}
          promotingId={promotingId}
          setPromotingId={setPromotingId}
          promoteForm={promoteForm}
          setPromoteForm={setPromoteForm}
          onPromote={handlePromote}
        />
      )}

      {activeTab === 'candidates' && (
        <CandidatesTab
          candidates={candidates}
          loading={loading}
          statusFilter={candidateStatusFilter}
          onStatusFilter={setCandidateStatusFilter}
          expandedCands={expandedCands}
          toggleCand={toggleCand}
          onAction={handleCandidateAction}
        />
      )}
    </div>
  )
}

function ObservationsTab({
  observations,
  loading,
  statusFilter,
  typeFilter,
  onStatusFilter,
  onTypeFilter,
  expandedObs,
  toggleObs,
  promotingId,
  setPromotingId,
  promoteForm,
  setPromoteForm,
  onPromote,
}: {
  observations: PatternObservation[]
  loading: boolean
  statusFilter: string
  typeFilter: string
  onStatusFilter: (v: string) => void
  onTypeFilter: (v: string) => void
  expandedObs: Set<string>
  toggleObs: (id: string) => void
  promotingId: string | null
  setPromotingId: (id: string | null) => void
  promoteForm: { name: string; description: string; type: string }
  setPromoteForm: (v: { name: string; description: string; type: string }) => void
  onPromote: (obs: PatternObservation) => void
}) {
  const statusColors: Record<string, string> = {
    observed: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
    candidate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    promoted: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  const statusIcons: Record<string, typeof Eye> = {
    observed: Eye,
    candidate: Lightbulb,
    promoted: ArrowUpRight,
    rejected: XCircle,
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading patterns...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-slate-500" />
        <select
          value={statusFilter}
          onChange={e => onStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-white"
        >
          <option value="">All Statuses</option>
          <option value="observed">Observed</option>
          <option value="candidate">Candidate</option>
          <option value="promoted">Promoted</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => onTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-white"
        >
          <option value="">All Types</option>
          {OBSERVATION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {observations.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>No patterns discovered yet. Run discovery to scan training accounts.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {observations.map(obs => {
            const expanded = expandedObs.has(obs.id)
            const typeInfo = OBSERVATION_TYPES.find(t => t.value === obs.observation_type)
            const StatusIcon = statusIcons[obs.status] || Eye

            return (
              <div key={obs.id} className={`rounded-lg border ${
                obs.status === 'candidate' ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700 bg-slate-800'
              }`}>
                <button
                  onClick={() => toggleObs(obs.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon className={`h-5 w-5 flex-shrink-0 ${
                      obs.status === 'candidate' ? 'text-amber-400' :
                      obs.status === 'promoted' ? 'text-sky-400' : 'text-slate-500'
                    }`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[obs.status]}`}>
                          {obs.status}
                        </span>
                        <span className="text-xs text-slate-500">
                          {typeInfo?.label || obs.observation_type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mt-1 line-clamp-1">{obs.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <div className="text-right text-xs">
                      <span className="text-slate-500">Edge</span>
                      <div className={`font-medium flex items-center gap-0.5 ${obs.edge_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {obs.edge_pct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {obs.edge_pct > 0 ? '+' : ''}{obs.edge_pct.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500">Sig.</span>
                      <div className={`font-medium ${
                        obs.significance_score >= 60 ? 'text-emerald-400' :
                        obs.significance_score >= 40 ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {obs.significance_score.toFixed(0)}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500">WR</span>
                      <div className={`font-medium ${obs.win_rate >= 0.55 ? 'text-emerald-400' : obs.win_rate < 0.45 ? 'text-red-400' : 'text-white'}`}>
                        {(obs.win_rate * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500">N</span>
                      <div className="font-medium text-white">{obs.sample_size}</div>
                    </div>
                    {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-700 p-4 space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <DetailBox label="Win Rate" value={`${(obs.win_rate * 100).toFixed(1)}%`} sub={`vs ${(obs.baseline_win_rate * 100).toFixed(1)}% baseline`} positive={obs.win_rate > obs.baseline_win_rate} />
                      <DetailBox label="Sample Size" value={`${obs.sample_size}`} sub={`${obs.win_count}W / ${obs.loss_count}L`} />
                      <DetailBox label="Avg Profit" value={`$${obs.avg_profit.toFixed(2)}`} positive={obs.avg_profit > 0} />
                      <DetailBox label="Avg Loss" value={`$${obs.avg_loss.toFixed(2)}`} />
                    </div>

                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <h4 className="text-xs font-medium text-slate-400 mb-2">Conditions</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(obs.conditions).map(([k, v]) => (
                          <span key={k} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                            <span className="text-slate-500">{k}:</span> {String(v)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <SignificanceBar score={obs.significance_score} />

                    {obs.status === 'candidate' && promotingId !== obs.id && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPromotingId(obs.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          Promote to Rule
                        </button>
                      </div>
                    )}

                    {promotingId === obs.id && (
                      <div className="bg-slate-900 rounded-lg border border-blue-500/30 p-4 space-y-3">
                        <h4 className="text-sm font-medium text-blue-400">Promote to Candidate Rule</h4>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Rule Name</label>
                          <input
                            type="text"
                            value={promoteForm.name}
                            onChange={e => setPromoteForm({ ...promoteForm, name: e.target.value })}
                            placeholder="e.g. Monday Morning Boost"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Description</label>
                          <textarea
                            value={promoteForm.description}
                            onChange={e => setPromoteForm({ ...promoteForm, description: e.target.value })}
                            placeholder="What this rule does..."
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-16 resize-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Rule Type</label>
                          <select
                            value={promoteForm.type}
                            onChange={e => setPromoteForm({ ...promoteForm, type: e.target.value })}
                            className="bg-slate-800 border border-slate-700 text-sm rounded-lg px-3 py-2 text-white w-full"
                          >
                            {RULE_TYPES.map(rt => (
                              <option key={rt.value} value={rt.value}>{rt.label} - {rt.description}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onPromote(obs)}
                            disabled={!promoteForm.name.trim()}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            Confirm Promotion
                          </button>
                          <button
                            onClick={() => setPromotingId(null)}
                            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>Key: {obs.observation_key}</span>
                      <span>First: {new Date(obs.first_observed_at).toLocaleDateString()}</span>
                      <span>Last: {new Date(obs.last_observed_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CandidatesTab({
  candidates,
  loading,
  statusFilter,
  onStatusFilter,
  expandedCands,
  toggleCand,
  onAction,
}: {
  candidates: CandidateRule[]
  loading: boolean
  statusFilter: string
  onStatusFilter: (v: string) => void
  expandedCands: Set<string>
  toggleCand: (id: string) => void
  onAction: (rule: CandidateRule, status: string) => void
}) {
  const statusColors: Record<string, string> = {
    proposed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    testing: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    accepted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  const statusIcons: Record<string, typeof Clock> = {
    proposed: Clock,
    testing: Beaker,
    accepted: CheckCircle,
    rejected: XCircle,
  }

  const confidenceColors: Record<string, string> = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-slate-400',
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading candidate rules...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-slate-500" />
        <select
          value={statusFilter}
          onChange={e => onStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-white"
        >
          <option value="">All Statuses</option>
          <option value="proposed">Proposed</option>
          <option value="testing">Testing</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {candidates.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Lightbulb className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p>No candidate rules yet. Promote patterns from the Discovered Patterns tab.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.map(rule => {
            const expanded = expandedCands.has(rule.id)
            const StatusIcon = statusIcons[rule.status] || Clock
            const ruleTypeInfo = RULE_TYPES.find(rt => rt.value === rule.rule_type)

            return (
              <div key={rule.id} className={`rounded-lg border ${
                rule.status === 'testing' ? 'border-amber-500/30 bg-amber-500/5' :
                rule.status === 'accepted' ? 'border-emerald-500/30 bg-emerald-500/5' :
                'border-slate-700 bg-slate-800'
              }`}>
                <button
                  onClick={() => toggleCand(rule.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon className={`h-5 w-5 flex-shrink-0 ${
                      rule.status === 'accepted' ? 'text-emerald-400' :
                      rule.status === 'testing' ? 'text-amber-400' :
                      rule.status === 'rejected' ? 'text-red-400' : 'text-blue-400'
                    }`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">{rule.rule_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[rule.status]}`}>
                          {rule.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {ruleTypeInfo?.label || rule.rule_type} -- {rule.rule_description || 'No description'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <div className="text-right text-xs">
                      <span className="text-slate-500">Edge</span>
                      <div className={`font-medium ${rule.edge_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {rule.edge_pct > 0 ? '+' : ''}{rule.edge_pct.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500">WR</span>
                      <div className={`font-medium ${rule.win_rate >= 0.55 ? 'text-emerald-400' : 'text-white'}`}>
                        {(rule.win_rate * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-500">Conf</span>
                      <div className={`font-medium ${confidenceColors[rule.confidence]}`}>
                        {rule.confidence}
                      </div>
                    </div>
                    {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-700 p-4 space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <DetailBox label="Win Rate" value={`${(rule.win_rate * 100).toFixed(1)}%`} positive={rule.win_rate >= 0.55} />
                      <DetailBox label="Edge" value={`${rule.edge_pct > 0 ? '+' : ''}${rule.edge_pct.toFixed(1)}%`} positive={rule.edge_pct > 0} />
                      <DetailBox label="Sample Size" value={`${rule.sample_size}`} />
                      <DetailBox label="Confidence" value={rule.confidence} positive={rule.confidence === 'high'} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-slate-400 mb-2">Conditions</h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(rule.conditions).map(([k, v]) => (
                            <span key={k} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                              <span className="text-slate-500">{k}:</span> {String(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-slate-400 mb-2">Action</h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(rule.action).map(([k, v]) => (
                            <span key={k} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                              <span className="text-slate-500">{k}:</span> {String(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {rule.admin_notes && (
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-slate-400 mb-1">Admin Notes</h4>
                        <p className="text-sm text-white">{rule.admin_notes}</p>
                      </div>
                    )}

                    {(rule.status === 'proposed' || rule.status === 'testing') && (
                      <div className="flex items-center gap-2">
                        {rule.status === 'proposed' && (
                          <button
                            onClick={() => onAction(rule, 'testing')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Start Testing
                          </button>
                        )}
                        {rule.status === 'testing' && (
                          <button
                            onClick={() => onAction(rule, 'accepted')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Accept Rule
                          </button>
                        )}
                        <button
                          onClick={() => onAction(rule, 'rejected')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    )}

                    <div className="text-xs text-slate-600 flex items-center gap-3">
                      <span>Created: {new Date(rule.created_at).toLocaleDateString()}</span>
                      <span>Strategy: {rule.source_strategy_id}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DetailBox({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function SignificanceBar({ score }: { score: number }) {
  const color = score >= 60 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-slate-500'
  const label = score >= 60 ? 'High Significance' : score >= 40 ? 'Moderate' : 'Low'

  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-400">Statistical Significance</span>
        <span className={`text-xs font-medium ${score >= 60 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-slate-400'}`}>
          {label} ({score.toFixed(0)}/100)
        </span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-slate-600">
        <span>0</span>
        <span>30</span>
        <span>60</span>
        <span>100</span>
      </div>
    </div>
  )
}
