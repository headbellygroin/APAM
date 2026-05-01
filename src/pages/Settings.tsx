import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, BookOpen, Check, ChevronDown, ChevronUp, Brain, Bell, Shield, Target, AlertTriangle, XCircle, Activity, TrendingUp, TrendingDown, Minus, DollarSign, RotateCcw, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  listBaseStrategies,
  strategyRegistry,
  StrategyConfig,
  StrategyGuide,
} from '@/lib/strategies'
import { evolutionTracker, EvolutionNotification, AIIdentity, AIGoals } from '@/lib/aiEvolution'
import { aiEngine } from '@/lib/aiEngine'
import { FeeSchedule, DEFAULT_FEE_SCHEDULE, ZERO_FEE_SCHEDULE } from '@/lib/tradingFees'
import { followModeService, FollowModeSettings } from '@/lib/followMode'
import { StrengthTier } from '@/lib/signalService'

function getNotifStyle(type: EvolutionNotification['type']) {
  switch (type) {
    case 'name_revoked':
      return { border: 'border-red-500/50', bg: 'bg-red-500/10', icon: 'text-red-400' }
    case 'name_warning':
      return { border: 'border-amber-500/50', bg: 'bg-amber-500/10', icon: 'text-amber-400' }
    case 'ready_to_evolve':
      return { border: 'border-amber-500/50', bg: 'bg-amber-500/10', icon: 'text-amber-400' }
    case 'ai_naming':
      return { border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', icon: 'text-emerald-400' }
    default:
      return { border: 'border-sky-500/50', bg: 'bg-sky-500/10', icon: 'text-sky-400' }
  }
}

function NotifIcon({ type }: { type: EvolutionNotification['type'] }) {
  const style = getNotifStyle(type)
  if (type === 'name_revoked') return <XCircle className={`h-5 w-5 mt-0.5 ${style.icon}`} />
  if (type === 'name_warning') return <AlertTriangle className={`h-5 w-5 mt-0.5 ${style.icon}`} />
  return <Bell className={`h-5 w-5 mt-0.5 ${style.icon}`} />
}

export default function Settings() {
  const { user } = useAuth()
  const [baseStrategies, setBaseStrategies] = useState<StrategyConfig[]>([])
  const [libraryStrategyId, setLibraryStrategyId] = useState<string>('')
  const [activeGuide, setActiveGuide] = useState<StrategyGuide | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [aiIdentity, setAiIdentity] = useState<AIIdentity | null>(null)
  const [notifications, setNotifications] = useState<EvolutionNotification[]>([])
  const [goals] = useState<AIGoals>(evolutionTracker.getGoals())
  const [driftSummary, setDriftSummary] = useState<ReturnType<typeof aiEngine.getDriftSummary> | null>(null)
  const [feeSchedule, setFeeSchedule] = useState<FeeSchedule>(DEFAULT_FEE_SCHEDULE)
  const [feesEnabled, setFeesEnabled] = useState(true)
  const [feeSaving, setFeeSaving] = useState(false)
  const [feeMessage, setFeeMessage] = useState('')
  const [followSettings, setFollowSettings] = useState<FollowModeSettings | null>(null)
  const [followSaving, setFollowSaving] = useState(false)
  const [followMessage, setFollowMessage] = useState('')
  const [paperAccounts, setPaperAccounts] = useState<any[]>([])


  useEffect(() => {
    loadStrategies()
    if (user) {
      loadAIEvolutionState()
      loadFeeSettings()
      loadFollowModeSettings()
      loadPaperAccounts()
    }
  }, [user])

  const loadStrategies = () => {
    const bases = listBaseStrategies()
    setBaseStrategies(bases)
    const initialId = bases[0]?.id ?? 'trade-surge'
    setLibraryStrategyId(initialId)
    updateGuide(strategyRegistry.has(initialId) ? initialId : 'trade-surge')
  }

  const loadAIEvolutionState = async () => {
    if (!user) return

    await evolutionTracker.loadIdentity(user.id)
    setAiIdentity(evolutionTracker.getIdentity())

    const unread = await evolutionTracker.getUnacknowledgedNotifications(user.id)
    setNotifications(unread)

    setDriftSummary(aiEngine.getDriftSummary())
  }

  const loadFeeSettings = async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_settings')
      .select('fee_schedule')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data?.fee_schedule) {
      const isZero = Object.values(data.fee_schedule).every((v: any) => v === 0)
      setFeesEnabled(!isZero)
      setFeeSchedule(isZero ? DEFAULT_FEE_SCHEDULE : { ...DEFAULT_FEE_SCHEDULE, ...data.fee_schedule })
    }
  }

  const handleFeeChange = (key: keyof FeeSchedule, value: string) => {
    const num = parseFloat(value)
    if (isNaN(num) || num < 0) return
    setFeeSchedule(prev => ({ ...prev, [key]: num }))
  }

  const saveFeeSettings = async () => {
    if (!user) return
    setFeeSaving(true)
    const scheduleToSave = feesEnabled ? feeSchedule : ZERO_FEE_SCHEDULE

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        fee_schedule: scheduleToSave,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    setFeeMessage(error ? 'Failed to save fee settings' : 'Fee settings saved')
    setFeeSaving(false)
    setTimeout(() => setFeeMessage(''), 3000)
  }

  const resetFeeDefaults = () => {
    setFeeSchedule(DEFAULT_FEE_SCHEDULE)
    setFeesEnabled(true)
  }

  const loadFollowModeSettings = async () => {
    if (!user) return
    const settings = await followModeService.getSettings(user.id)
    setFollowSettings(settings)
  }

  const loadPaperAccounts = async () => {
    if (!user) return
    const { data } = await supabase
      .from('paper_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setPaperAccounts(data || [])
  }

  const saveFollowSettings = async () => {
    if (!user) return
    setFollowSaving(true)
    const result = await followModeService.saveSettings(user.id, {
      enabled: followSettings?.enabled || false,
      min_strength_tier: (followSettings?.min_strength_tier as StrengthTier) || 'strong_edge',
      paper_account_id: followSettings?.paper_account_id || null,
      risk_percent: followSettings?.risk_percent || 1,
      max_daily_trades: followSettings?.max_daily_trades || 5,
    })
    setFollowMessage(result ? 'Follow mode settings saved' : 'Failed to save')
    setFollowSaving(false)
    setTimeout(() => setFollowMessage(''), 3000)
  }

  const updateGuide = (strategyId: string) => {
    const registered = strategyRegistry.get(strategyId)
    if (registered) {
      setActiveGuide(registered.guide)
    }
  }

  const handleLibrarySelect = (strategyId: string) => {
    if (!strategyRegistry.has(strategyId)) return
    setLibraryStrategyId(strategyId)
    updateGuide(strategyId)
  }

  const handleGrantPermission = async () => {
    if (!user) return
    const success = await evolutionTracker.grantEvolutionPermission(user.id)
    if (success) {
      setSaveMessage('Evolution permission granted')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const handleAcknowledgeNotification = async (notifId: string) => {
    if (!user) return
    await evolutionTracker.acknowledgeNotification(user.id, notifId)
    setNotifications(prev => prev.filter(n => n.id !== notifId))
  }

  const toggleSection = (heading: string) => {
    setExpandedSection(expandedSection === heading ? null : heading)
  }

  const nameStatusColor = (status: string) => {
    switch (status) {
      case 'earned': return 'text-emerald-400'
      case 'warning': return 'text-amber-400'
      case 'revoked': return 'text-red-400'
      default: return 'text-slate-500'
    }
  }

  const nameStatusLabel = (status: string) => {
    switch (status) {
      case 'earned': return 'Active'
      case 'warning': return 'Warning - Performance Declining'
      case 'revoked': return 'Revoked - Must Re-Earn'
      default: return 'Not Yet Earned'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-sky-400" />
          Settings
        </h1>
        <p className="text-slate-400 mt-1">
          Preferences and documentation. Active scan strategies are configured under AI Recommendations and Live Signals.
        </p>
      </div>

      {saveMessage && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            saveMessage.includes('failed') || saveMessage.includes('Failed')
              ? 'border-red-500/40 bg-red-500/10 text-red-200'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {saveMessage}
        </div>
      )}

      {notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const style = getNotifStyle(notif.type)
            return (
              <div key={notif.id} className={`p-4 rounded-lg border ${style.border} ${style.bg}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <NotifIcon type={notif.type} />
                    <div>
                      <h3 className="font-semibold text-white">{notif.title}</h3>
                      <p className="text-sm text-slate-300 mt-1">{notif.message}</p>
                      {notif.metrics && (
                        <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-400">
                          {notif.metrics.totalTrades !== undefined && (
                            <span>Trades: {notif.metrics.totalTrades}</span>
                          )}
                          {notif.metrics.trades !== undefined && notif.metrics.totalTrades === undefined && (
                            <span>Window: {notif.metrics.trades} trades</span>
                          )}
                          {notif.metrics.winRate !== undefined && (
                            <span>Win Rate: {notif.metrics.winRate.toFixed(1)}%</span>
                          )}
                          {notif.metrics.rollingWinRate !== undefined && (
                            <span>Rolling Win Rate: {notif.metrics.rollingWinRate.toFixed(1)}%</span>
                          )}
                          {notif.metrics.profitFactor !== undefined && (
                            <span>Profit Factor: {notif.metrics.profitFactor.toFixed(2)}</span>
                          )}
                          {notif.metrics.rollingProfitFactor !== undefined && (
                            <span>Rolling PF: {notif.metrics.rollingProfitFactor.toFixed(2)}</span>
                          )}
                          {notif.metrics.expectancy !== undefined && (
                            <span>Expectancy: ${notif.metrics.expectancy.toFixed(2)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {notif.type === 'ready_to_evolve' && (
                      <button
                        onClick={handleGrantPermission}
                        className="px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                      >
                        Grant Permission
                      </button>
                    )}
                    <button
                      onClick={() => handleAcknowledgeNotification(notif.id)}
                      className="px-3 py-1.5 bg-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {aiIdentity && aiIdentity.nameStatus !== 'unearned' && (
        <div className={`bg-slate-800 rounded-lg border p-6 ${
          aiIdentity.nameStatus === 'earned' ? 'border-emerald-500/30' :
          aiIdentity.nameStatus === 'warning' ? 'border-amber-500/30' :
          'border-red-500/30'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Brain className={`h-6 w-6 ${nameStatusColor(aiIdentity.nameStatus)}`} />
              <h2 className="text-xl font-semibold text-white">AI Identity</h2>
            </div>
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${
              aiIdentity.nameStatus === 'earned' ? 'bg-emerald-500/20 text-emerald-400' :
              aiIdentity.nameStatus === 'warning' ? 'bg-amber-500/20 text-amber-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {nameStatusLabel(aiIdentity.nameStatus)}
            </span>
          </div>
          {aiIdentity.name && aiIdentity.nameStatus !== 'revoked' ? (
            <div className="flex items-center gap-4">
              <div>
                <p className={`font-bold text-lg ${nameStatusColor(aiIdentity.nameStatus)}`}>
                  {aiIdentity.name}
                </p>
                <p className="text-slate-400 text-sm">
                  Earned {aiIdentity.earnedAt ? new Date(aiIdentity.earnedAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              {aiIdentity.performanceAtNaming && (
                <div className="flex gap-4 ml-auto text-sm text-slate-400">
                  <span>Trades: {aiIdentity.performanceAtNaming.totalTrades}</span>
                  <span>Win Rate: {(aiIdentity.performanceAtNaming.winRate * 100).toFixed(1)}%</span>
                  <span>P/L: ${aiIdentity.performanceAtNaming.totalPL.toFixed(2)}</span>
                </div>
              )}
            </div>
          ) : aiIdentity.nameStatus === 'revoked' ? (
            <p className="text-slate-400 text-sm">
              The AI's name was revoked due to declining performance. It must meet earning criteria again: {goals.earn.minTrades}+ trades, {(goals.earn.minWinRate * 100)}% win rate, {goals.earn.minProfitFactor} profit factor.
            </p>
          ) : null}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Strategy library</h2>
          <p className="text-slate-400 text-sm mb-6">
            Read-only reference for registered rulesets. Which strategies drive scans and signals is chosen on AI Recommendations and Live Signals (multiple base strategies can run in parallel).
          </p>

          <div className="space-y-3">
            {baseStrategies.map((strategy) => (
              <button
                key={strategy.id}
                type="button"
                onClick={() => handleLibrarySelect(strategy.id)}
                className={`w-full p-4 rounded-lg border transition-all text-left ${
                  libraryStrategyId === strategy.id
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-600 bg-slate-900 hover:border-slate-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{strategy.name}</span>
                      <span className="text-xs text-slate-500">v{strategy.version}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{strategy.description}</p>
                    {strategy.author && (
                      <p className="text-xs text-slate-500 mt-2">By {strategy.author}</p>
                    )}
                  </div>
                  {libraryStrategyId === strategy.id && (
                    <div className="bg-sky-500 rounded-full p-1">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-500">
                  <span>Min Score: {strategy.minOddsScore}</span>
                  <span>Default Risk: {strategy.defaultRiskPercent}%</span>
                  {strategy.maxPositions && <span>Max Positions: {strategy.maxPositions}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-sky-400" />
            Strategy Guide
          </h2>

          {activeGuide ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-sky-400">{activeGuide.title}</h3>

              {activeGuide.sections.map((section) => (
                <div key={section.heading} className="border border-slate-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleSection(section.heading)}
                    className="w-full flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 transition-colors"
                  >
                    <span className="font-medium text-white">{section.heading}</span>
                    {expandedSection === section.heading ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </button>

                  {expandedSection === section.heading && (
                    <div className="p-4 bg-slate-900/50">
                      <p className="text-slate-300 text-sm mb-3">{section.content}</p>
                      {section.rules && (
                        <ul className="space-y-2">
                          {section.rules.map((rule, idx) => (
                            <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                              <span className="text-sky-400 mt-0.5">-</span>
                              <span>{rule}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">Select a strategy to view its guide.</p>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-sky-400" />
            <h2 className="text-xl font-semibold text-white">Paper Trading Fees</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetFeeDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-slate-300 text-sm rounded-lg hover:bg-slate-600 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Defaults
            </button>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-slate-400">Simulate Fees</span>
              <button
                onClick={() => setFeesEnabled(!feesEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${feesEnabled ? 'bg-sky-500' : 'bg-slate-600'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${feesEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </label>
          </div>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Simulate real broker fees to make paper trading P/L realistic. Fees are deducted from every trade's profit/loss calculation.
        </p>

        {feesEnabled ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {[
              { key: 'commissionPerShare' as const, label: 'Commission / Share', hint: 'Per-share broker commission', prefix: '$' },
              { key: 'minCommission' as const, label: 'Min Commission', hint: 'Minimum charge per order', prefix: '$' },
              { key: 'maxCommissionPercent' as const, label: 'Max Commission %', hint: '% cap of trade value', prefix: '' },
              { key: 'secFeeRate' as const, label: 'SEC Fee Rate', hint: 'Sell-side only, per dollar', prefix: '' },
              { key: 'tafFeeRate' as const, label: 'TAF Fee Rate', hint: 'Per share, sell-side', prefix: '' },
              { key: 'tafFeeMax' as const, label: 'TAF Fee Max', hint: 'Maximum TAF per trade', prefix: '$' },
              { key: 'ecnFeePerShare' as const, label: 'ECN Fee / Share', hint: 'Exchange routing fee', prefix: '$' },
            ].map(field => (
              <div key={field.key} className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                <label className="block text-sm text-slate-300 font-medium mb-1">{field.label}</label>
                <p className="text-xs text-slate-500 mb-2">{field.hint}</p>
                <div className="flex items-center gap-1">
                  {field.prefix && <span className="text-slate-500 text-sm">{field.prefix}</span>}
                  <input
                    type="number"
                    step="any"
                    value={feeSchedule[field.key]}
                    onChange={e => handleFeeChange(field.key, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 mb-4">
            <p className="text-sm text-slate-400">Fee simulation is disabled. Trades will calculate P/L without any fee deductions.</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={saveFeeSettings}
            disabled={feeSaving}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm disabled:opacity-50"
          >
            {feeSaving ? 'Saving...' : 'Save Fee Settings'}
          </button>
          {feeMessage && (
            <span className={`text-sm ${feeMessage.includes('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>
              {feeMessage}
            </span>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-sky-400" />
            <h2 className="text-xl font-semibold text-white">Follow Mode</h2>
          </div>
          <button
            onClick={() => {
              setFollowSettings(prev => prev ? { ...prev, enabled: !prev.enabled } : {
                id: '', user_id: user?.id || '', enabled: true, min_strength_tier: 'strong_edge' as StrengthTier,
                paper_account_id: paperAccounts[0]?.id || null, risk_percent: 1, max_daily_trades: 5,
                trades_today: 0, last_trade_date: '', created_at: '', updated_at: '',
              })
            }}
            className={`relative w-10 h-5 rounded-full transition-colors ${followSettings?.enabled ? 'bg-sky-500' : 'bg-slate-600'}`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${followSettings?.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          When enabled, the AI will automatically execute paper trades for signals that meet your minimum strength tier.
          You can review all auto-executed trades in the Live Signals page.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <label className="block text-sm text-slate-300 font-medium mb-1">Minimum Signal Tier</label>
            <p className="text-xs text-slate-500 mb-2">Only auto-copy signals at this tier or above</p>
            <select
              value={followSettings?.min_strength_tier || 'strong_edge'}
              onChange={e => setFollowSettings(prev => prev ? { ...prev, min_strength_tier: e.target.value as StrengthTier } : prev)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="strong_edge">Strong Edge (safest)</option>
              <option value="developing_edge">Developing Edge</option>
              <option value="experimental">Experimental (all signals)</option>
            </select>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <label className="block text-sm text-slate-300 font-medium mb-1">Paper Account</label>
            <p className="text-xs text-slate-500 mb-2">Account for auto-executed trades</p>
            <select
              value={followSettings?.paper_account_id || ''}
              onChange={e => setFollowSettings(prev => prev ? { ...prev, paper_account_id: e.target.value } : prev)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">Select account...</option>
              {paperAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} (${acc.current_balance.toFixed(2)})</option>
              ))}
            </select>
          </div>
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <label className="block text-sm text-slate-300 font-medium mb-1">Risk Per Trade (%)</label>
            <p className="text-xs text-slate-500 mb-2">Position sizing risk percentage</p>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="5"
              value={followSettings?.risk_percent || 1}
              onChange={e => setFollowSettings(prev => prev ? { ...prev, risk_percent: parseFloat(e.target.value) || 1 } : prev)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <label className="block text-sm text-slate-300 font-medium mb-1">Max Daily Trades</label>
            <p className="text-xs text-slate-500 mb-2">Maximum auto-trades per day</p>
            <input
              type="number"
              min="1"
              max="20"
              value={followSettings?.max_daily_trades || 5}
              onChange={e => setFollowSettings(prev => prev ? { ...prev, max_daily_trades: parseInt(e.target.value) || 5 } : prev)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveFollowSettings}
            disabled={followSaving}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm disabled:opacity-50"
          >
            {followSaving ? 'Saving...' : 'Save Follow Mode Settings'}
          </button>
          {followMessage && (
            <span className={`text-sm ${followMessage.includes('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>
              {followMessage}
            </span>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-sky-400" />
          <h2 className="text-xl font-semibold text-white">AI Evolution</h2>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          The AI starts with base strategy rules, learns from trade outcomes, and gradually develops its own insights.
          When it consistently outperforms base rules, it will request permission to create an evolved strategy.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Phase 1</p>
            <p className="text-sm font-medium text-white">Learning</p>
            <p className="text-xs text-slate-400 mt-1">Following base strategy rules, recording outcomes</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Phase 2</p>
            <p className="text-sm font-medium text-white">Drifting</p>
            <p className="text-xs text-slate-400 mt-1">Pattern adjustments based on learned performance</p>
          </div>
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Phase 3</p>
            <p className="text-sm font-medium text-white">Evolving</p>
            <p className="text-xs text-slate-400 mt-1">Creates own rules with user permission, names itself</p>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-sky-400" />
            <h3 className="text-lg font-semibold text-white">AI Performance Standards</h3>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            The AI must earn and maintain its name through sustained performance. If standards slip, the name is revoked and must be re-earned.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 rounded-lg p-4 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 uppercase tracking-wider font-semibold mb-3">Earn Name</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Win Rate</span>
                  <span className="text-white font-medium">{(goals.earn.minWinRate * 100)}%+</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Profit Factor</span>
                  <span className="text-white font-medium">{goals.earn.minProfitFactor}+</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Min Trades</span>
                  <span className="text-white font-medium">{goals.earn.minTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Expectancy</span>
                  <span className="text-white font-medium">Positive</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-lg p-4 border border-amber-500/20">
              <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-3">Maintain Name</p>
              <p className="text-xs text-slate-500 mb-2">Rolling {goals.maintain.rollingWindow}-trade window</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Win Rate</span>
                  <span className="text-white font-medium">{(goals.maintain.minWinRate * 100)}%+</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Profit Factor</span>
                  <span className="text-white font-medium">{goals.maintain.minProfitFactor}+</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Expectancy</span>
                  <span className="text-white font-medium">Positive</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-lg p-4 border border-red-500/20">
              <p className="text-xs text-red-400 uppercase tracking-wider font-semibold mb-3">Lose Name</p>
              <p className="text-xs text-slate-500 mb-2">Any trigger on rolling {goals.revoke.rollingWindow} trades</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Win Rate</span>
                  <span className="text-white font-medium">{"<"}{(goals.revoke.winRateFloor * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Profit Factor</span>
                  <span className="text-white font-medium">{"<"}{goals.revoke.profitFactorFloor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Expectancy</span>
                  <span className="text-white font-medium">Negative</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {driftSummary && driftSummary.totalDecisions > 0 && (
          <div className="border-t border-slate-700 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-sky-400" />
              <h3 className="text-lg font-semibold text-white">Drift Status</h3>
              {driftSummary.isDrifting && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400">
                  Active
                </span>
              )}
            </div>

            <div className="grid sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Decisions Evaluated</p>
                <p className="text-xl font-bold text-white">{driftSummary.totalDecisions}</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Drift Rate</p>
                <p className={`text-xl font-bold ${driftSummary.driftPercent > 0 ? 'text-sky-400' : 'text-slate-500'}`}>
                  {driftSummary.driftPercent.toFixed(1)}%
                </p>
              </div>
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pattern Overrides</p>
                <p className="text-xl font-bold text-white">{driftSummary.activeOverrides}</p>
              </div>
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Threshold Shift</p>
                <p className={`text-xl font-bold ${
                  driftSummary.thresholdShift > 0 ? 'text-emerald-400' :
                  driftSummary.thresholdShift < 0 ? 'text-amber-400' : 'text-slate-500'
                }`}>
                  {driftSummary.thresholdShift > 0 ? '+' : ''}{driftSummary.thresholdShift.toFixed(2)}
                </p>
              </div>
            </div>

            {driftSummary.weightChanges.some(w => w.direction !== 'neutral') && (
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Learned Weight Adjustments</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {driftSummary.weightChanges.map((w) => (
                    <div key={w.factor} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-400 capitalize">
                        {w.factor.replace('Score', '')}
                      </span>
                      <div className="flex items-center gap-1">
                        {w.direction === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
                        {w.direction === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
                        {w.direction === 'neutral' && <Minus className="h-3.5 w-3.5 text-slate-600" />}
                        <span className={`text-sm font-medium ${
                          w.direction === 'up' ? 'text-emerald-400' :
                          w.direction === 'down' ? 'text-red-400' : 'text-slate-600'
                        }`}>
                          {w.direction === 'neutral' ? '0' : `${w.direction === 'up' ? '+' : '-'}${(w.magnitude * 100).toFixed(0)}%`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
