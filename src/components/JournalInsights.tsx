import { useState } from 'react'
import { llmService, JournalInsightResult } from '@/lib/llmService'
import {
  Brain, Loader2, TrendingUp, TrendingDown, Minus,
  Lightbulb, Heart, Target, ChevronDown, ChevronRight,
} from 'lucide-react'

export default function JournalInsights() {
  const [insight, setInsight] = useState<JournalInsightResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const [showPatterns, setShowPatterns] = useState(true)
  const [showEmotions, setShowEmotions] = useState(false)

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await llmService.analyzeJournal(days)
      setInsight(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-sky-400" />
          <h2 className="text-lg font-semibold text-white">AI Journal Analysis</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 rounded-lg p-3 border border-red-700/30 mb-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!insight && !loading && !error && (
        <div className="text-center py-8">
          <Brain className="h-10 w-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            Analyze your journal entries to discover behavioral patterns, emotional trends, and get personalized recommendations.
          </p>
        </div>
      )}

      {insight && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <StatBox label="Entries Analyzed" value={String(insight.entriesAnalyzed)} />
            <StatBox label="Trades" value={String(insight.tradesInPeriod)} />
            <StatBox
              label="Win Rate"
              value={`${insight.winRate}%`}
              color={Number(insight.winRate) >= 55 ? 'text-emerald-400' : Number(insight.winRate) >= 45 ? 'text-amber-400' : 'text-red-400'}
            />
            <StatBox
              label="Total P&L"
              value={`$${insight.totalPL.toFixed(2)}`}
              color={insight.totalPL >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
          </div>

          {insight.summary && (
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{insight.summary}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {insight.strengths.length > 0 && (
              <div className="bg-emerald-900/15 rounded-lg p-3 border border-emerald-800/30">
                <p className="text-xs text-emerald-400 font-medium mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Strengths
                </p>
                <ul className="space-y-1">
                  {insight.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-slate-300">{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {insight.weaknesses.length > 0 && (
              <div className="bg-red-900/15 rounded-lg p-3 border border-red-800/30">
                <p className="text-xs text-red-400 font-medium mb-2 flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5" /> Areas to Improve
                </p>
                <ul className="space-y-1">
                  {insight.weaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-slate-300">{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {insight.recommendations.length > 0 && (
            <div className="bg-sky-900/15 rounded-lg p-4 border border-sky-800/30">
              <p className="text-xs text-sky-400 font-medium mb-2 flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5" /> Recommendations
              </p>
              <ul className="space-y-2">
                {insight.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-sky-400 font-mono text-xs mt-0.5">{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insight.patterns.length > 0 && (
            <div>
              <button
                onClick={() => setShowPatterns(!showPatterns)}
                className="flex items-center gap-2 text-sm font-medium text-white mb-2"
              >
                <Target className="h-4 w-4 text-amber-400" />
                Behavioral Patterns ({insight.patterns.length})
                {showPatterns ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>
              {showPatterns && (
                <div className="space-y-2">
                  {insight.patterns.map((p, i) => (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{p.name}</span>
                        <ImpactBadge impact={p.impact} />
                        <span className="text-xs text-slate-500">{p.frequency}</span>
                      </div>
                      <p className="text-xs text-slate-400">{p.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {insight.emotionalTrends.length > 0 && (
            <div>
              <button
                onClick={() => setShowEmotions(!showEmotions)}
                className="flex items-center gap-2 text-sm font-medium text-white mb-2"
              >
                <Heart className="h-4 w-4 text-rose-400" />
                Emotional Trends ({insight.emotionalTrends.length})
                {showEmotions ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>
              {showEmotions && (
                <div className="space-y-2">
                  {insight.emotionalTrends.map((e, i) => (
                    <div key={i} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{e.emotion}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 mt-1">
                        <div>
                          <span className="text-slate-500">Trigger: </span>{e.trigger}
                        </div>
                        <div>
                          <span className="text-slate-500">Impact: </span>{e.tradingImpact}
                        </div>
                        <div>
                          <span className="text-slate-500">Tip: </span>
                          <span className="text-sky-300">{e.managementTip}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

function ImpactBadge({ impact }: { impact: string }) {
  const config: Record<string, { color: string; icon: typeof TrendingUp }> = {
    positive: { color: 'bg-emerald-500/20 text-emerald-300', icon: TrendingUp },
    negative: { color: 'bg-red-500/20 text-red-300', icon: TrendingDown },
    neutral: { color: 'bg-slate-600/20 text-slate-400', icon: Minus },
  }
  const c = config[impact] || config.neutral
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${c.color}`}>
      <Icon className="h-3 w-3" />{impact}
    </span>
  )
}
