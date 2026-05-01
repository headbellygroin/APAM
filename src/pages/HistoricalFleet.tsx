import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  History,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Shield,
  Beaker,
  Plus,
  Clock,
  Crown,
  User,
  GitBranch,
  Cpu,
  Users,
  Wand2,
} from 'lucide-react'
import {
  getSimulationRuns,
  getRunAccounts,
  getRunTrades,
  createSimulationRun,
  deleteSimulationRun,
  updateRunStatus,
  runSimulationBatch,
  getRunProgress,
  HistoricalSimulationRun,
  HistoricalFleetAccount,
  HistoricalFleetTrade,
  CreateRunParams,
} from '@/lib/historicalFleetService'
import {
  getMasterAIGenerations,
  getMasterAIFleetRuns,
  createMasterAIFleetRun,
  CreateMasterFleetParams,
  MasterAIFleetGeneration,
  MasterAIFleetRun,
} from '@/lib/masterAIFleetService'
import HistoricalRunForm from '@/components/HistoricalRunForm'
import MasterAIFleetForm from '@/components/MasterAIFleetForm'

type PageTab = 'my-runs' | 'master-ai'

export default function HistoricalFleet() {
  const { user, isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState<PageTab>('my-runs')

  const [runs, setRuns] = useState<HistoricalSimulationRun[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const [runAccounts, setRunAccounts] = useState<Map<string, HistoricalFleetAccount[]>>(new Map())
  const [runTrades, setRunTrades] = useState<Map<string, HistoricalFleetTrade[]>>(new Map())
  const [simulating, setSimulating] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<Map<string, { pct: number; date: string | null }>>(new Map())
  const simTimers = useRef<Map<string, number>>(new Map())

  const [masterGenerations, setMasterGenerations] = useState<MasterAIFleetGeneration[]>([])
  const [masterFleetRuns, setMasterFleetRuns] = useState<MasterAIFleetRun[]>([])
  const [masterLoading, setMasterLoading] = useState(false)
  const [showMasterForm, setShowMasterForm] = useState(false)
  const [creatingMaster, setCreatingMaster] = useState(false)
  const [expandedGen, setExpandedGen] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadRuns()
      loadMasterAIData()
    }
    return () => {
      simTimers.current.forEach(t => clearInterval(t))
    }
  }, [user])

  const loadRuns = async () => {
    if (!user) return
    setLoading(true)
    const data = await getSimulationRuns(user.id)
    setRuns(data)
    setLoading(false)
  }

  const loadMasterAIData = async () => {
    if (!user) return
    setMasterLoading(true)
    const [gens, fleetRuns] = await Promise.all([
      getMasterAIGenerations(user.id),
      getMasterAIFleetRuns(user.id),
    ])
    setMasterGenerations(gens)
    setMasterFleetRuns(fleetRuns)
    setMasterLoading(false)
  }

  const handleCreateRun = async (params: CreateRunParams) => {
    if (!user) return
    setCreating(true)
    const run = await createSimulationRun(user.id, params)
    if (run) {
      setShowCreateForm(false)
      await loadRuns()
    }
    setCreating(false)
  }

  const handleCreateMasterRun = async (params: CreateMasterFleetParams) => {
    if (!user) return
    setCreatingMaster(true)
    const result = await createMasterAIFleetRun(user.id, params)
    if (result) {
      setShowMasterForm(false)
      await Promise.all([loadMasterAIData(), loadRuns()])
    }
    setCreatingMaster(false)
  }

  const handleDeleteRun = async (runId: string) => {
    stopSimTimer(runId)
    await deleteSimulationRun(runId)
    setExpandedRun(null)
    await loadRuns()
  }

  const handleExpandRun = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null)
      return
    }
    setExpandedRun(runId)
    const [accounts, trades] = await Promise.all([
      getRunAccounts(runId),
      getRunTrades(runId),
    ])
    setRunAccounts(prev => new Map(prev).set(runId, accounts))
    setRunTrades(prev => new Map(prev).set(runId, trades))
  }

  const handleStartSimulation = async (runId: string) => {
    setSimulating(prev => new Set(prev).add(runId))
    await runBatchLoop(runId)
  }

  const handlePauseSimulation = async (runId: string) => {
    stopSimTimer(runId)
    await updateRunStatus(runId, 'paused')
    setSimulating(prev => {
      const next = new Set(prev)
      next.delete(runId)
      return next
    })
    await loadRuns()
  }

  const stopSimTimer = (runId: string) => {
    const timer = simTimers.current.get(runId)
    if (timer) {
      clearInterval(timer)
      simTimers.current.delete(runId)
    }
  }

  const runBatchLoop = async (runId: string) => {
    const run = runs.find(r => r.id === runId)
    if (!run) return
    const batchSize = run.speed_multiplier

    const processBatch = async () => {
      const result = await runSimulationBatch(runId, batchSize)
      const prog = await getRunProgress(runId)
      setProgress(prev => new Map(prev).set(runId, { pct: prog.progressPct, date: prog.currentDate }))
      const accounts = await getRunAccounts(runId)
      setRunAccounts(prev => new Map(prev).set(runId, accounts))

      if (result.isComplete) {
        stopSimTimer(runId)
        setSimulating(prev => {
          const next = new Set(prev)
          next.delete(runId)
          return next
        })
        await loadRuns()
        const trades = await getRunTrades(runId)
        setRunTrades(prev => new Map(prev).set(runId, trades))
      }
    }

    await processBatch()
    const timer = window.setInterval(async () => {
      if (!simulating.has(runId) && !simTimers.current.has(runId)) return
      await processBatch()
    }, 2000)
    simTimers.current.set(runId, timer)
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-slate-400">Admin access required.</p>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
  const statusIcons: Record<string, typeof Clock> = {
    pending: Clock,
    running: Play,
    paused: Pause,
    completed: CheckCircle,
    failed: XCircle,
  }

  const masterRunIds = new Set(masterFleetRuns.map(r => r.run_id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="h-6 w-6 text-slate-400" />
            Historical Fleet
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Backtest AI accounts against historical market eras — your runs and Master AI fleet
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('my-runs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'my-runs'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <User className="h-4 w-4" />
          My Runs
          {runs.length > 0 && (
            <span className="bg-slate-600 text-slate-300 text-xs px-1.5 py-0.5 rounded-full">
              {runs.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('master-ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'master-ai'
              ? 'bg-sky-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Crown className="h-4 w-4" />
          Master AI Fleet
          {masterGenerations.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === 'master-ai' ? 'bg-sky-500 text-white' : 'bg-slate-600 text-slate-300'
            }`}>
              {masterGenerations.length} gen{masterGenerations.length !== 1 ? 's' : ''}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'my-runs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Your personal historical simulation runs — test individual strategies and compare performance
            </p>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              New Historical Run
            </button>
          </div>

          {showCreateForm && (
            <div className="bg-slate-800 rounded-lg border border-blue-500/30 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Create Historical Simulation</h3>
                <button onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-white">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <HistoricalRunForm onSubmit={handleCreateRun} loading={creating} />
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading historical runs...</div>
          ) : runs.filter(r => !masterRunIds.has(r.id)).length === 0 ? (
            <div className="text-center py-16">
              <History className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">No personal historical simulations yet.</p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Create a run to test how a strategy performs in a past market era.
                Use the Master AI Fleet tab to launch large-scale multi-account training runs.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.filter(r => !masterRunIds.has(r.id)).map(run => (
                <RunCard
                  key={run.id}
                  run={run}
                  isExpanded={expandedRun === run.id}
                  isSim={simulating.has(run.id)}
                  accounts={runAccounts.get(run.id) || []}
                  trades={runTrades.get(run.id) || []}
                  prog={progress.get(run.id)}
                  statusColors={statusColors}
                  statusIcons={statusIcons}
                  onExpand={handleExpandRun}
                  onStart={handleStartSimulation}
                  onPause={handlePauseSimulation}
                  onDelete={handleDeleteRun}
                  onRefresh={async (id) => {
                    const [a, t] = await Promise.all([getRunAccounts(id), getRunTrades(id)])
                    setRunAccounts(prev => new Map(prev).set(id, a))
                    setRunTrades(prev => new Map(prev).set(id, t))
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'master-ai' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-sky-900/30 to-slate-800 rounded-lg border border-sky-500/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Crown className="h-5 w-5 text-sky-400" />
                  Master AI Fleet System
                </h2>
                <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                  The Master AI maintains its own fleet of historical accounts — separate from your personal runs.
                  It creates generations of 10 accounts with varied rulesets, runs them through historical eras,
                  identifies what works, and builds improved generations. It can pull learned weights from your
                  live training accounts or generate its own from scratch.
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Cpu className="h-3.5 w-3.5 text-sky-400" />
                    Self-Generated: Master AI creates rulesets independently
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Users className="h-3.5 w-3.5 text-emerald-400" />
                    User Pool: Inherits learned weights from your accounts
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Wand2 className="h-3.5 w-3.5 text-amber-400" />
                    Hybrid: Combines both sources
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                    Generations: Each run links to a parent to track improvements
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowMasterForm(!showMasterForm)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
                New Generation
              </button>
            </div>
          </div>

          {showMasterForm && (
            <div className="bg-slate-800 rounded-lg border border-sky-500/30 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Crown className="h-5 w-5 text-sky-400" />
                  Launch Master AI Fleet Generation
                </h3>
                <button onClick={() => setShowMasterForm(false)} className="text-slate-400 hover:text-white">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <MasterAIFleetForm
                onSubmit={handleCreateMasterRun}
                loading={creatingMaster}
                existingGenerations={masterGenerations}
              />
            </div>
          )}

          {masterLoading ? (
            <div className="text-center py-12 text-slate-400">Loading Master AI generations...</div>
          ) : masterGenerations.length === 0 ? (
            <div className="text-center py-16">
              <Crown className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">No Master AI generations yet.</p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Launch your first generation to start the Master AI fleet training cycle.
                It will run 10 accounts through historical market eras and build a lineage
                of improving strategies over time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {masterGenerations.map(gen => {
                const genFleetRuns = masterFleetRuns.filter(fr => fr.generation_number === gen.generation_number)
                const genSimRuns = runs.filter(r => genFleetRuns.some(fr => fr.run_id === r.id))
                const isExpanded = expandedGen === gen.id

                return (
                  <div key={gen.id} className="rounded-lg border border-slate-700 bg-slate-800">
                    <button
                      onClick={() => setExpandedGen(isExpanded ? null : gen.id)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/30 flex-shrink-0">
                          <span className="text-xs font-bold text-sky-400">G{gen.generation_number}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{gen.label}</span>
                            {gen.promoted_to_live && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Promoted
                              </span>
                            )}
                            <SourceTypeBadge type={genFleetRuns[0]?.source_type || 'self_generated'} />
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                            {gen.avg_win_rate > 0 && (
                              <span className="text-emerald-400">{gen.avg_win_rate.toFixed(1)}% avg WR</span>
                            )}
                            {gen.avg_profit_factor > 0 && (
                              <span>PF {gen.avg_profit_factor.toFixed(2)}</span>
                            )}
                            {gen.top_strategy && (
                              <span>Best: {gen.top_strategy} / {gen.top_mode}</span>
                            )}
                            <span>{genSimRuns.length} run{genSimRuns.length !== 1 ? 's' : ''}</span>
                            <span>{new Date(gen.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-700 p-4 space-y-4">
                        {gen.description && (
                          <p className="text-sm text-slate-400">{gen.description}</p>
                        )}

                        {gen.what_improved && (
                          <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-lg p-3">
                            <p className="text-xs text-slate-400 mb-0.5">Improvements vs previous generation</p>
                            <p className="text-sm text-emerald-300">{gen.what_improved}</p>
                          </div>
                        )}

                        {genFleetRuns[0]?.notes && (
                          <p className="text-xs text-slate-500 italic">{genFleetRuns[0].notes}</p>
                        )}

                        {genSimRuns.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                              <History className="h-4 w-4 text-slate-500" />
                              Simulation Runs
                            </h4>
                            {genSimRuns.map(run => (
                              <RunCard
                                key={run.id}
                                run={run}
                                isExpanded={expandedRun === run.id}
                                isSim={simulating.has(run.id)}
                                accounts={runAccounts.get(run.id) || []}
                                trades={runTrades.get(run.id) || []}
                                prog={progress.get(run.id)}
                                statusColors={statusColors}
                                statusIcons={statusIcons}
                                onExpand={handleExpandRun}
                                onStart={handleStartSimulation}
                                onPause={handlePauseSimulation}
                                onDelete={async (id) => {
                                  await handleDeleteRun(id)
                                  await loadMasterAIData()
                                }}
                                onRefresh={async (id) => {
                                  const [a, t] = await Promise.all([getRunAccounts(id), getRunTrades(id)])
                                  setRunAccounts(prev => new Map(prev).set(id, a))
                                  setRunTrades(prev => new Map(prev).set(id, t))
                                }}
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SourceTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; icon: typeof Cpu; color: string }> = {
    self_generated: { label: 'Self-Gen', icon: Cpu, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    user_pool: { label: 'User Pool', icon: Users, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    hybrid: { label: 'Hybrid', icon: Wand2, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  }
  const m = map[type] || map.self_generated
  const Icon = m.icon
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${m.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {m.label}
    </span>
  )
}

interface RunCardProps {
  run: HistoricalSimulationRun
  isExpanded: boolean
  isSim: boolean
  accounts: HistoricalFleetAccount[]
  trades: HistoricalFleetTrade[]
  prog?: { pct: number; date: string | null }
  statusColors: Record<string, string>
  statusIcons: Record<string, typeof Clock>
  onExpand: (id: string) => void
  onStart: (id: string) => void
  onPause: (id: string) => void
  onDelete: (id: string) => void
  onRefresh: (id: string) => void
  compact?: boolean
}

function RunCard({
  run, isExpanded, isSim, accounts, trades, prog,
  statusColors, statusIcons, onExpand, onStart, onPause, onDelete, onRefresh,
  compact = false,
}: RunCardProps) {
  const StatusIcon = statusIcons[run.status] || Clock

  return (
    <div className={`rounded-lg border ${
      run.status === 'running' ? 'border-blue-500/30 bg-blue-500/5' :
      run.status === 'completed' ? 'border-emerald-500/20 bg-slate-800' :
      'border-slate-700 bg-slate-800'
    } ${compact ? 'ml-2' : ''}`}>
      <button
        onClick={() => onExpand(run.id)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <StatusIcon className={`h-5 w-5 flex-shrink-0 ${
            run.status === 'completed' ? 'text-emerald-400' :
            run.status === 'running' ? 'text-blue-400' :
            run.status === 'paused' ? 'text-amber-400' : 'text-slate-500'
          }`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-white">{run.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[run.status]}`}>
                {run.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
              <span>{run.start_date} to {run.end_date}</span>
              <span>{run.symbols.length} symbols</span>
              <span>{run.total_trading_days} days processed</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {(run.status === 'running' || isSim) && prog && (
            <div className="text-right text-xs">
              <span className="text-blue-400">{prog.pct.toFixed(0)}%</span>
              <div className="text-slate-500">{prog.date}</div>
            </div>
          )}
          {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {(run.status === 'running' || isSim) && prog && (
        <div className="px-4 pb-2">
          <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, prog.pct)}%` }}
            />
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          {run.description && <p className="text-sm text-slate-400">{run.description}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            {(run.status === 'pending' || run.status === 'paused') && !isSim && (
              <button
                onClick={() => onStart(run.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                <Play className="h-3.5 w-3.5" />
                {run.status === 'paused' ? 'Resume' : 'Start'} Simulation
              </button>
            )}
            {(run.status === 'running' || isSim) && (
              <button
                onClick={() => onPause(run.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors"
              >
                <Pause className="h-3.5 w-3.5" />
                Pause
              </button>
            )}
            <button
              onClick={() => onDelete(run.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
            {run.status !== 'pending' && (
              <button
                onClick={() => onRefresh(run.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 flex flex-wrap gap-3">
            <span>Speed: {run.speed_multiplier} days/tick</span>
            <span>Symbols: {run.symbols.join(', ')}</span>
            {run.started_at && <span>Started: {new Date(run.started_at).toLocaleString()}</span>}
            {run.completed_at && <span>Completed: {new Date(run.completed_at).toLocaleString()}</span>}
          </div>

          {accounts.length > 0 && <AccountsSection accounts={accounts} />}

          {run.status === 'completed' && run.results_summary?.comparison && (
            <ComparisonSection comparison={run.results_summary.comparison} />
          )}

          {trades.length > 0 && <TradesSection trades={trades} />}
        </div>
      )}
    </div>
  )
}

function AccountsSection({ accounts }: { accounts: HistoricalFleetAccount[] }) {
  const controls = accounts.filter(a => a.account_type === 'control')
  const experiments = accounts.filter(a => a.account_type === 'experimental')

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-white flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-slate-400" />
        Fleet Performance
      </h4>
      {controls.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
            <Shield className="h-3 w-3" /> Control Accounts (strict rules)
          </p>
          <div className="space-y-1.5">
            {controls.map(a => <AccountRow key={a.id} account={a} />)}
          </div>
        </div>
      )}
      {experiments.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">
            <Beaker className="h-3 w-3" /> Experimental Accounts (drift-enabled)
          </p>
          <div className="space-y-1.5">
            {experiments.map(a => <AccountRow key={a.id} account={a} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function AccountRow({ account }: { account: HistoricalFleetAccount }) {
  const returnPct = account.starting_capital > 0
    ? ((account.current_capital - account.starting_capital) / account.starting_capital) * 100
    : 0
  const driftPct = account.total_decisions > 0
    ? (account.drift_decisions / account.total_decisions) * 100
    : 0

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-white font-medium truncate">{account.name}</span>
        <span className="text-xs text-slate-500 flex-shrink-0">{account.strategy_id} / {account.mode}</span>
      </div>
      <div className="flex items-center gap-3 text-xs flex-shrink-0">
        <span className={account.win_rate >= 55 ? 'text-emerald-400' : account.win_rate < 45 ? 'text-red-400' : 'text-white'}>
          {account.win_rate.toFixed(1)}% WR
        </span>
        <span className={account.total_profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          ${account.total_profit_loss.toFixed(0)}
        </span>
        <span className="text-slate-400">PF {account.profit_factor.toFixed(2)}</span>
        <span className="text-slate-400">DD {account.max_drawdown.toFixed(1)}%</span>
        <span className={returnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {returnPct > 0 ? '+' : ''}{returnPct.toFixed(1)}%
        </span>
        {driftPct > 0 && <span className="text-amber-400">{driftPct.toFixed(0)}% drift</span>}
        <span className="text-slate-500">{account.total_trades} trades</span>
      </div>
    </div>
  )
}

function ComparisonSection({ comparison }: { comparison: Record<string, any> }) {
  const wrDiff = comparison.winRateDiff || 0
  const plDiff = comparison.plDiff || 0

  return (
    <div className={`rounded-lg p-4 border ${
      wrDiff > 2 ? 'bg-emerald-900/20 border-emerald-500/30' :
      wrDiff < -2 ? 'bg-red-900/20 border-red-500/30' :
      'bg-slate-900/50 border-slate-700'
    }`}>
      <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
        {wrDiff > 0 ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
        Control vs Experimental — Verdict
      </h4>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Control Avg WR</p>
          <p className="text-lg font-bold text-white">{(comparison.controlAvgWinRate || 0).toFixed(1)}%</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Experimental Avg WR</p>
          <p className="text-lg font-bold text-white">{(comparison.experimentalAvgWinRate || 0).toFixed(1)}%</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-500">WR Difference</p>
          <p className={`text-lg font-bold ${wrDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {wrDiff > 0 ? '+' : ''}{wrDiff.toFixed(1)}%
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-500">P&L Difference</p>
          <p className={`text-lg font-bold ${plDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {plDiff > 0 ? '+' : ''}${plDiff.toFixed(0)}
          </p>
        </div>
      </div>
      <p className={`text-sm font-medium ${
        wrDiff > 2 ? 'text-emerald-400' : wrDiff < -2 ? 'text-red-400' : 'text-slate-400'
      }`}>
        {comparison.verdict}
      </p>
    </div>
  )
}

function TradesSection({ trades }: { trades: HistoricalFleetTrade[] }) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? trades : trades.slice(0, 10)

  return (
    <div>
      <h4 className="text-sm font-medium text-white mb-2">Recent Trades ({trades.length})</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-500">
              <th className="text-left py-1.5 px-2">Date</th>
              <th className="text-left py-1.5 px-2">Symbol</th>
              <th className="text-left py-1.5 px-2">Type</th>
              <th className="text-right py-1.5 px-2">Entry</th>
              <th className="text-right py-1.5 px-2">Exit</th>
              <th className="text-right py-1.5 px-2">P&L</th>
              <th className="text-left py-1.5 px-2">Reason</th>
              <th className="text-left py-1.5 px-2">Pattern</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(t => (
              <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                <td className="py-1.5 px-2 text-slate-400">{t.sim_date}</td>
                <td className="py-1.5 px-2 text-white font-medium">{t.symbol}</td>
                <td className="py-1.5 px-2">
                  <span className={t.trade_type === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                    {t.trade_type}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-right text-slate-300">${t.entry_price.toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right text-slate-300">
                  {t.exit_price ? `$${t.exit_price.toFixed(2)}` : '-'}
                </td>
                <td className={`py-1.5 px-2 text-right font-medium ${
                  t.profit_loss === null ? 'text-slate-500' :
                  t.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {t.profit_loss !== null ? `$${t.profit_loss.toFixed(2)}` : 'open'}
                </td>
                <td className="py-1.5 px-2 text-slate-400">{t.exit_reason || '-'}</td>
                <td className="py-1.5 px-2 text-slate-500 truncate max-w-[120px]">{t.pattern_key || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {trades.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors"
        >
          {showAll ? 'Show less' : `Show all ${trades.length} trades`}
        </button>
      )}
    </div>
  )
}
