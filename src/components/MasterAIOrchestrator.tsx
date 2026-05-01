import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  runEndOfDayReview,
  getLatestSavedEODReview,
  executeSpawn,
  executeRetire,
  executePromotion,
  codifyEvolution,
  getEvolvedRulesets,
  getMasterTierProgress,
  getEODReviews,
  getSpawnLog,
  MASTER_NAME_TIERS,
  EODReview,
  SpawnRecommendation,
  RetireRecommendation,
  PromotionRecommendation,
  EvolutionCandidate,
  EvolvedRuleset,
} from '@/lib/masterAIOrchestrator'
import { trainingAccountService, TrainingAccount } from '@/lib/trainingAccountService'
import { getLineageRecords, LineageRecord } from '@/lib/lineageService'
import LineageTree from './LineageTree'
import EODNarrative from './EODNarrative'
import { Link } from 'react-router-dom'
import {
  Sunrise, GitBranch, Trash2, Trophy, ChevronDown, ChevronRight,
  Play, Star, Clock, Layers, Dna, Shield, Zap, BookOpen, ArrowUpCircle, Network,
  AlertTriangle, Globe, Sparkles, History,
} from 'lucide-react'

export default function MasterAIOrchestrator() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<TrainingAccount[]>([])
  const [review, setReview] = useState<EODReview | null>(null)
  const [pastReviews, setPastReviews] = useState<any[]>([])
  const [spawnLog, setSpawnLog] = useState<any[]>([])
  const [evolvedRulesets, setEvolvedRulesets] = useState<EvolvedRuleset[]>([])
  const [lineageRecords, setLineageRecords] = useState<LineageRecord[]>([])
  const [isRunningReview, setIsRunningReview] = useState(false)
  const [showPastReviews, setShowPastReviews] = useState(false)
  const [showSpawnLog, setShowSpawnLog] = useState(false)
  const [showTiers, setShowTiers] = useState(false)
  const [showRulesets, setShowRulesets] = useState(false)
  const [showLineage, setShowLineage] = useState(false)
  const [namingCandidate, setNamingCandidate] = useState<EvolutionCandidate | null>(null)
  const [rulesetName, setRulesetName] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return
    const [accts, reviews, log, rulesets, lineage] = await Promise.all([
      trainingAccountService.getAccounts(user.id),
      getEODReviews(user.id),
      getSpawnLog(user.id),
      getEvolvedRulesets(user.id),
      getLineageRecords(user.id),
    ])
    setAccounts(accts)
    setPastReviews(reviews)
    setSpawnLog(log)
    setEvolvedRulesets(rulesets)
    setLineageRecords(lineage)

    const restored = await getLatestSavedEODReview(user.id)
    if (restored) {
      setReview(restored)
    }
  }

  const handleRunReview = async () => {
    if (!user) return
    setIsRunningReview(true)
    const result = await runEndOfDayReview(user.id)
    setReview(result)
    setIsRunningReview(false)
    await loadData()
  }

  const handleSpawn = async (rec: SpawnRecommendation) => {
    if (!user) return
    const spawned = await executeSpawn(user.id, rec)
    if (spawned) {
      showStatus(`Spawned: ${spawned.name}`)
      await loadData()
    }
  }

  const handleRetire = async (rec: RetireRecommendation) => {
    if (!user) return
    await executeRetire(user.id, rec)
    showStatus(`Retired: ${rec.accountName}`)
    await loadData()
  }

  const handlePromotion = async (rec: PromotionRecommendation) => {
    if (!user) return
    await executePromotion(user.id, rec)
    showStatus(`Promoted: ${rec.spawnedAccountName} replaced ${rec.baseAccountName}`)
    await loadData()
  }

  const handleCodify = async () => {
    if (!user || !namingCandidate || !rulesetName.trim()) return
    const result = await codifyEvolution(user.id, namingCandidate, rulesetName.trim())
    if (result) {
      showStatus(`Codified: ${rulesetName}`)
      setNamingCandidate(null)
      setRulesetName('')
      await loadData()
    }
  }

  const showStatus = (msg: string) => {
    setStatusMsg(msg)
    setTimeout(() => setStatusMsg(''), 4000)
  }

  const tierProgress = getMasterTierProgress(accounts)
  const currentTier = MASTER_NAME_TIERS[tierProgress.tier]
  const nextTier = tierProgress.tier < MASTER_NAME_TIERS.length - 1
    ? MASTER_NAME_TIERS[tierProgress.tier + 1]
    : null

  const baseCount = accounts.filter(a => !a.spawned_by_master).length
  const spawnedCount = accounts.filter(a => a.spawned_by_master && a.status !== 'stopped').length

  return (
    <div className="space-y-6">
      {/* Master AI Tier Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-amber-700/30 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-amber-900/50 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Master AI -- Tier {tierProgress.tier}: {currentTier.title}
              </h2>
              <p className="text-xs text-slate-400">
                {currentTier.description} | Base fleet: {baseCount} | Spawned fleet: {spawnedCount}/5
              </p>
            </div>
          </div>
          {statusMsg && <span className="text-sm text-green-400">{statusMsg}</span>}
        </div>

        <div className="grid grid-cols-5 gap-3 mb-4">
          <ProgressStat
            label="Avg Win Rate"
            value={`${tierProgress.progress.avgWinRate.toFixed(1)}%`}
            target={nextTier ? `${nextTier.minAvgWinRate}%` : 'Max'}
            pct={nextTier ? (tierProgress.progress.avgWinRate / nextTier.minAvgWinRate) * 100 : 100}
          />
          <ProgressStat
            label="Avg Profit Factor"
            value={tierProgress.progress.avgProfitFactor.toFixed(2)}
            target={nextTier ? `${nextTier.minAvgProfitFactor}` : 'Max'}
            pct={nextTier ? (tierProgress.progress.avgProfitFactor / nextTier.minAvgProfitFactor) * 100 : 100}
          />
          <ProgressStat
            label="Total Trades"
            value={tierProgress.progress.totalAccountTrades.toString()}
            target={nextTier ? `${nextTier.minTotalAccountTrades}` : 'Max'}
            pct={nextTier ? (tierProgress.progress.totalAccountTrades / nextTier.minTotalAccountTrades) * 100 : 100}
          />
          <ProgressStat
            label="Sustained Days"
            value={`${tierProgress.progress.sustainedDays}d`}
            target={nextTier ? `${nextTier.minSustainedDays}d` : 'Max'}
            pct={nextTier ? (tierProgress.progress.sustainedDays / nextTier.minSustainedDays) * 100 : 100}
          />
          <ProgressStat
            label="Avg Drawdown"
            value={`${tierProgress.progress.avgDrawdown.toFixed(1)}%`}
            target={nextTier ? `<${nextTier.maxAvgDrawdown}%` : '<5%'}
            pct={nextTier
              ? (tierProgress.progress.avgDrawdown <= nextTier.maxAvgDrawdown ? 100 : Math.max(0, (1 - (tierProgress.progress.avgDrawdown - nextTier.maxAvgDrawdown) / nextTier.maxAvgDrawdown) * 100))
              : 100}
          />
        </div>

        {nextTier && (
          <div className="bg-slate-900/60 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Next tier: <span className="text-amber-300 font-medium">{nextTier.title}</span> -- name can grow to {nextTier.nameLength} characters
              </span>
              <button onClick={() => setShowTiers(!showTiers)} className="text-slate-400 hover:text-white flex items-center space-x-1">
                <span>All tiers</span>
                {showTiers ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            </div>
          </div>
        )}

        {showTiers && (
          <div className="mt-3 space-y-2">
            {MASTER_NAME_TIERS.slice(1).map(tier => {
              const achieved = tierProgress.tier >= tier.tier
              return (
                <div key={tier.tier} className={`rounded-lg p-3 border ${
                  achieved ? 'bg-amber-900/20 border-amber-700/50'
                    : tierProgress.tier + 1 === tier.tier ? 'bg-slate-700/30 border-slate-600'
                    : 'bg-slate-800/30 border-slate-700/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Star className={`h-4 w-4 ${achieved ? 'text-amber-400' : 'text-slate-600'}`} />
                      <span className={`font-medium ${achieved ? 'text-amber-300' : 'text-slate-400'}`}>
                        Tier {tier.tier}: {tier.title}
                      </span>
                      <span className="text-xs text-slate-500">({tier.nameLength} char name)</span>
                    </div>
                    {achieved && <span className="text-xs text-amber-400 font-medium">Achieved</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{tier.description}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* End-of-Day Review */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sunrise className="h-5 w-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">End-of-Day Review</h3>
          </div>
          <button
            onClick={handleRunReview}
            disabled={isRunningReview}
            className="flex items-center space-x-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            <span>{isRunningReview ? 'Analyzing...' : 'Run Review'}</span>
          </button>
        </div>

        {review && (
          <div className="space-y-4">
            {/* AI-Generated Narrative */}
            <EODNarrative review={review} />

            {/* Base Fleet Rankings */}
            <FleetRankings
              title="Base Fleet"
              icon={<Shield className="h-4 w-4 text-blue-400" />}
              rankings={review.baseFleetRankings}
              color="blue"
            />

            {/* Spawned Fleet Rankings */}
            <FleetRankings
              title="Spawned Fleet (Master AI)"
              icon={<Zap className="h-4 w-4 text-amber-400" />}
              rankings={review.spawnedFleetRankings}
              color="amber"
            />

            {/* Rotation Advice */}
            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-2">Rotation Guidance</h4>
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{review.rotationAdvice}</pre>
            </div>

            {/* Next Day Notes */}
            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-2">Next Day Preparation</h4>
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{review.nextDayNotes}</pre>
            </div>

            {/* User Trade Anomalies */}
            {review.userTradeAnomalies && review.userTradeAnomalies.length > 0 && (
              <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-700/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h4 className="text-sm font-medium text-amber-300">
                      Human Trade Anomalies ({review.userTradeAnomalies.length})
                    </h4>
                  </div>
                  <Link
                    to="/real-world-events"
                    className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>Investigate</span>
                  </Link>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Users made trades the AI cannot explain from its own signals. These could indicate real-world events outside the system.
                </p>
                <pre className="text-sm text-amber-200 whitespace-pre-wrap font-sans">{review.anomalySummary}</pre>
                <div className="mt-3 space-y-1.5">
                  {review.userTradeAnomalies.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-slate-900/50 rounded p-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-amber-400 font-medium">{a.symbol}</span>
                        <span className="text-slate-400">{a.anomaly_type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-slate-500">{a.user_trades.length} trades</span>
                        <span className={a.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          ${a.profit_loss.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pattern Discovery */}
            {review.patternDiscoverySummary && (
              <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                    <h4 className="text-sm font-medium text-blue-300">Pattern Discovery</h4>
                  </div>
                  <Link
                    to="/pattern-discovery"
                    className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Review Patterns</span>
                  </Link>
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  AI scanned training accounts for patterns not in any existing ruleset.
                </p>
                <pre className="text-sm text-blue-200 whitespace-pre-wrap font-sans">{review.patternDiscoverySummary}</pre>
              </div>
            )}

            {/* Historical Fleet */}
            {review.historicalFleetSummary && (
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-600/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <History className="h-4 w-4 text-slate-400" />
                    <h4 className="text-sm font-medium text-slate-300">Historical Fleet</h4>
                  </div>
                  <Link
                    to="/historical-fleet"
                    className="flex items-center space-x-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>View Runs</span>
                  </Link>
                </div>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{review.historicalFleetSummary}</pre>
              </div>
            )}

            {/* Spawn Recommendations */}
            {review.spawnRecommendations.map((rec, i) => (
              <div key={i} className="bg-green-900/20 rounded-lg p-4 border border-green-700/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <GitBranch className="h-4 w-4 text-green-400" />
                    <h4 className="text-sm font-medium text-green-300">Spawn Recommendation</h4>
                  </div>
                  <button onClick={() => handleSpawn(rec)} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors">
                    Approve Spawn
                  </button>
                </div>
                <p className="text-sm text-slate-300 mb-1">{rec.suggestedName}</p>
                <p className="text-xs text-slate-400">{rec.reason}</p>
                <p className="text-xs text-slate-500 mt-1">Parents: {rec.sourceNames.join(' + ')} | Gen {rec.generation} | Always drift-enabled</p>
              </div>
            ))}

            {/* Retire Recommendations */}
            {review.retireRecommendations.map((rec, i) => (
              <div key={i} className="bg-red-900/20 rounded-lg p-4 border border-red-700/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Trash2 className="h-4 w-4 text-red-400" />
                    <h4 className="text-sm font-medium text-red-300">Retire Recommendation</h4>
                  </div>
                  <button onClick={() => handleRetire(rec)} className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors">
                    Approve Retire
                  </button>
                </div>
                <p className="text-sm text-slate-300">{rec.accountName}</p>
                <p className="text-xs text-slate-400">{rec.reason}</p>
              </div>
            ))}

            {/* Promotion Recommendations */}
            {review.promotionRecommendations.length > 0 && (
              <div className="bg-cyan-900/20 rounded-lg p-4 border border-cyan-700/30">
                <div className="flex items-center space-x-2 mb-3">
                  <ArrowUpCircle className="h-4 w-4 text-cyan-400" />
                  <h4 className="text-sm font-medium text-cyan-300">Promotion Recommendations -- Hybrids Ready to Replace Base Fleet</h4>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  These spawned hybrids have proven superior to your drift-enabled base accounts. Promoting them moves them into your base fleet and frees a spawned slot for the Master to create even better hybrids. Strict control accounts are never replaced.
                </p>
                <div className="space-y-2">
                  {review.promotionRecommendations.map(rec => (
                    <div key={rec.spawnedAccountId} className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-cyan-300">{rec.spawnedAccountName}</span>
                          <span className="text-xs text-slate-500">Gen {rec.spawnedGeneration}</span>
                        </div>
                        <button
                          onClick={() => handlePromotion(rec)}
                          className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs hover:bg-cyan-700 transition-colors"
                        >
                          Approve Promotion
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-800/50 rounded p-2">
                          <p className="text-slate-500 mb-1">Replaces (base fleet)</p>
                          <p className="text-white">{rec.baseAccountName}</p>
                          <p className="text-red-400">{rec.baseWinRate.toFixed(1)}% WR | ${rec.baseTotalPL.toFixed(0)} P&L</p>
                        </div>
                        <div className="bg-slate-800/50 rounded p-2">
                          <p className="text-slate-500 mb-1">Promoted hybrid (spawned)</p>
                          <p className="text-white">{rec.spawnedAccountName}</p>
                          <p className="text-green-400">{rec.spawnedWinRate.toFixed(1)}% WR | ${rec.spawnedTotalPL.toFixed(0)} P&L</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">+{rec.outperformancePct.toFixed(1)}% outperformance over {rec.spawnedTotalTrades} trades</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evolution Candidates */}
            {review.evolutionCandidates.length > 0 && (
              <div className="bg-teal-900/20 rounded-lg p-4 border border-teal-700/30">
                <div className="flex items-center space-x-2 mb-3">
                  <Dna className="h-4 w-4 text-teal-400" />
                  <h4 className="text-sm font-medium text-teal-300">Evolution Candidates -- Drift Ready to Become Rulesets</h4>
                </div>
                <div className="space-y-2">
                  {review.evolutionCandidates.map(c => (
                    <div key={c.accountId} className="flex items-center justify-between py-2 px-3 bg-slate-900/50 rounded-lg">
                      <div>
                        <span className="text-sm text-white">{c.accountName}</span>
                        <div className="flex space-x-3 text-xs text-slate-400 mt-0.5">
                          <span>{c.driftPct.toFixed(1)}% drift</span>
                          <span>+{c.outperformancePct.toFixed(1)}% vs base</span>
                          <span>{c.totalTrades} trades</span>
                          <span>{c.winRate.toFixed(1)}% WR</span>
                          <span>Gen {c.generation}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setNamingCandidate(c); setRulesetName('') }}
                        className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs hover:bg-teal-700 transition-colors"
                      >
                        Codify as Ruleset
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Naming Modal */}
            {namingCandidate && (
              <div className="bg-teal-900/30 rounded-lg p-5 border border-teal-600/50">
                <h4 className="text-sm font-medium text-teal-300 mb-2">Name This Evolved Ruleset</h4>
                <p className="text-xs text-slate-400 mb-3">
                  This drift from <span className="text-white">{namingCandidate.accountName}</span> has proven itself over {namingCandidate.totalTrades} trades.
                  It drifted {namingCandidate.driftPct.toFixed(1)}% from {namingCandidate.strategyId} and outperformed by +{namingCandidate.outperformancePct.toFixed(1)}%.
                  Give it a name to codify it as a new strategy ruleset.
                </p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={rulesetName}
                    onChange={e => setRulesetName(e.target.value)}
                    placeholder="e.g. APAM-Drift-Alpha, Surge-Evolved-1"
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                  />
                  <button
                    onClick={handleCodify}
                    disabled={!rulesetName.trim()}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    Codify
                  </button>
                  <button
                    onClick={() => setNamingCandidate(null)}
                    className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {review.spawnRecommendations.length === 0 && review.retireRecommendations.length === 0 && review.promotionRecommendations.length === 0 && review.evolutionCandidates.length === 0 && (
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-400">No spawn, retire, or evolution actions recommended. Fleet is stable.</p>
              </div>
            )}
          </div>
        )}

        {!review && !isRunningReview && (
          <div className="text-center py-6">
            <Sunrise className="h-10 w-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Run the end-of-day review after market close. Your base fleet ({baseCount} accounts) feeds data to the Master, which manages its spawned fleet ({spawnedCount}/5 slots).</p>
          </div>
        )}
      </div>

      {/* Evolved Rulesets */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <button onClick={() => setShowRulesets(!showRulesets)} className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-teal-400" />
            <h3 className="text-lg font-semibold text-white">Evolved Rulesets ({evolvedRulesets.length})</h3>
          </div>
          {showRulesets ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
        </button>

        {showRulesets && (
          <div className="mt-4 space-y-2">
            {evolvedRulesets.length === 0 ? (
              <p className="text-sm text-slate-500">No evolved rulesets yet. When a spawned account's drift consistently outperforms its base strategy, it can be codified as a new named ruleset.</p>
            ) : (
              evolvedRulesets.map(rs => (
                <div key={rs.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <Dna className={`h-4 w-4 ${rs.status === 'active' ? 'text-teal-400' : rs.status === 'candidate' ? 'text-amber-400' : 'text-slate-500'}`} />
                      <span className="text-sm font-medium text-white">{rs.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        rs.status === 'active' ? 'bg-teal-900/30 text-teal-300' :
                        rs.status === 'candidate' ? 'bg-amber-900/30 text-amber-300' :
                        'bg-slate-700 text-slate-400'
                      }`}>{rs.status}</span>
                    </div>
                    <span className="text-xs text-slate-500">Gen {rs.generation}</span>
                  </div>
                  <div className="flex space-x-4 text-xs text-slate-400 mt-1">
                    <span>Parent: {rs.parentStrategyId}</span>
                    <span>{rs.driftPercentage.toFixed(1)}% drift</span>
                    <span>+{rs.outperformancePct.toFixed(1)}% outperformance</span>
                    <span>{rs.minTradesObserved} trades observed</span>
                  </div>
                  {rs.performanceAtCreation && (
                    <div className="flex space-x-3 text-xs text-slate-500 mt-0.5">
                      <span>WR: {(rs.performanceAtCreation.winRate || 0).toFixed(1)}%</span>
                      <span>PF: {(rs.performanceAtCreation.profitFactor || 0).toFixed(2)}</span>
                      <span>P&L: ${(rs.performanceAtCreation.totalPL || 0).toFixed(0)}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Family Tree / Lineage */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <button onClick={() => setShowLineage(!showLineage)} className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Network className="h-5 w-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Family Tree -- Account Lineage</h3>
          </div>
          {showLineage ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
        </button>

        {showLineage && (
          <div className="mt-4">
            {accounts.length === 0 ? (
              <p className="text-sm text-slate-500">No accounts yet. Create training accounts to see the family tree.</p>
            ) : (
              <LineageTree
                accounts={accounts}
                lineageRecords={lineageRecords}
                onRefresh={loadData}
              />
            )}
          </div>
        )}
      </div>

      {/* Review History */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <button onClick={() => setShowPastReviews(!showPastReviews)} className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-slate-400" />
            <h3 className="text-lg font-semibold text-white">Review History ({pastReviews.length})</h3>
          </div>
          {showPastReviews ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
        </button>

        {showPastReviews && (
          <div className="mt-4 space-y-2">
            {pastReviews.length === 0 ? (
              <p className="text-sm text-slate-500">No reviews yet.</p>
            ) : (
              pastReviews.map((r: any) => (
                <div key={r.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{r.review_date}</span>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-400">Tier {r.master_name_tier}</span>
                      {r.master_name && <span className="text-amber-400">{r.master_name}</span>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 whitespace-pre-wrap">{r.next_day_notes}</p>
                  <div className="flex space-x-3 mt-1 text-xs text-slate-500">
                    <span>{(r.account_rankings || []).length} accounts ranked</span>
                    {r.spawn_recommendation && <span className="text-green-400">Spawn suggested</span>}
                    {r.retire_recommendation && <span className="text-red-400">Retire suggested</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Spawn/Retire Log */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <button onClick={() => setShowSpawnLog(!showSpawnLog)} className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-slate-400" />
            <h3 className="text-lg font-semibold text-white">Spawn/Retire/Evolve Log ({spawnLog.length})</h3>
          </div>
          {showSpawnLog ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
        </button>

        {showSpawnLog && (
          <div className="mt-4 space-y-2">
            {spawnLog.length === 0 ? (
              <p className="text-sm text-slate-500">No actions taken yet.</p>
            ) : (
              spawnLog.map((entry: any) => (
                <div key={entry.id} className="flex items-center space-x-3 py-2 px-2 bg-slate-900/50 rounded-lg text-sm">
                  {entry.action === 'spawn' ? (
                    <GitBranch className="h-4 w-4 text-green-400 flex-shrink-0" />
                  ) : entry.action === 'retire' ? (
                    <Trash2 className="h-4 w-4 text-red-400 flex-shrink-0" />
                  ) : entry.action === 'promote' ? (
                    <ArrowUpCircle className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                  ) : (
                    <Dna className="h-4 w-4 text-teal-400 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      entry.action === 'spawn' ? 'bg-green-900/30 text-green-300' :
                      entry.action === 'retire' ? 'bg-red-900/30 text-red-300' :
                      entry.action === 'promote' ? 'bg-cyan-900/30 text-cyan-300' :
                      'bg-teal-900/30 text-teal-300'
                    }`}>{entry.action}</span>
                    <span className="text-slate-300 ml-2">{entry.reason}</span>
                  </div>
                  <span className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FleetRankings({ title, icon, rankings, color }: {
  title: string
  icon: React.ReactNode
  rankings: import('@/lib/masterAIOrchestrator').AccountRanking[]
  color: 'blue' | 'amber'
}) {
  if (rankings.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-1">
          {icon}
          <h4 className="text-sm font-medium text-white">{title}</h4>
        </div>
        <p className="text-xs text-slate-500">No accounts with enough trades to rank yet.</p>
      </div>
    )
  }

  const borderColor = color === 'blue' ? 'border-blue-800/30' : 'border-amber-800/30'

  return (
    <div className={`bg-slate-900/50 rounded-lg p-4 border ${borderColor}`}>
      <div className="flex items-center space-x-2 mb-2">
        {icon}
        <h4 className="text-sm font-medium text-white">{title} ({rankings.length})</h4>
      </div>
      <div className="space-y-1.5">
        {rankings.map(r => (
          <div key={r.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-slate-800/50">
            <div className="flex items-center space-x-3">
              <span className={`w-6 text-center font-bold ${r.rank <= 3 ? 'text-amber-400' : 'text-slate-500'}`}>
                #{r.rank}
              </span>
              <span className="text-white">{r.name}</span>
              <span className="text-xs text-slate-500">{r.mode} / {r.strategy_id}</span>
              {r.generation > 0 && (
                <span className="text-xs bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">Gen {r.generation}</span>
              )}
            </div>
            <div className="flex items-center space-x-4 text-xs">
              <span className={r.win_rate >= 55 ? 'text-green-400' : r.win_rate >= 45 ? 'text-yellow-400' : 'text-red-400'}>
                {r.win_rate.toFixed(1)}% WR
              </span>
              <span className={r.total_profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}>
                ${r.total_profit_loss.toFixed(0)}
              </span>
              {r.drift_pct > 0 && <span className="text-slate-400">{r.drift_pct.toFixed(0)}% drift</span>}
              <span className="text-slate-500">{r.total_trades} trades</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressStat({ label, value, target, pct }: {
  label: string; value: string; target: string; pct: number
}) {
  const clampedPct = Math.min(100, Math.max(0, pct))
  const color = clampedPct >= 100 ? 'bg-green-500' : clampedPct >= 70 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="bg-slate-900/60 rounded-lg p-3">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
      <div className="mt-1.5">
        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${clampedPct}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Target: {target}</p>
      </div>
    </div>
  )
}
