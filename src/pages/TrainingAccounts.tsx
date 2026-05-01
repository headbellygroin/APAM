import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  trainingAccountService,
  TrainingAccount,
  CreateAccountParams,
} from '@/lib/trainingAccountService'
import { stopAllSimulations, startAccountSimulation } from '@/lib/trainingSimulator'
import { listBaseStrategies, listOverlayStrategies } from '@/lib/strategies/registry'
import TrainingLeaderboard from '@/components/TrainingLeaderboard'
import TrainingAccountDetail from '@/components/TrainingAccountDetail'
import { Plus, Users, Play, Square, RefreshCw, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function TrainingAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<TrainingAccount[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([])

  useEffect(() => {
    if (user) {
      loadAccounts()
      loadWatchlist()
    }
    return () => { stopAllSimulations() }
  }, [user])

  const loadAccounts = async () => {
    if (!user) return
    const data = await trainingAccountService.getAccounts(user.id)
    setAccounts(data)
    setLoading(false)
  }

  const loadWatchlist = async () => {
    if (!user) return
    const { data } = await supabase
      .from('watchlists')
      .select('symbol')
      .eq('user_id', user.id)

    if (data) {
      setWatchlistSymbols(data.map(d => d.symbol))
    }
  }

  const handleCreate = async (params: CreateAccountParams) => {
    if (!user) return
    const created = await trainingAccountService.createAccount(user.id, params)
    if (created) {
      setShowCreate(false)
      loadAccounts()
    }
  }

  const handleStartAll = async () => {
    for (const account of accounts) {
      if (account.status === 'paused' || account.status === 'active') {
        await trainingAccountService.updateStatus(account.id, 'active')
        startAccountSimulation(
          { ...account, status: 'active' },
          watchlistSymbols,
          () => loadAccounts()
        )
      }
    }
    loadAccounts()
  }

  const handleStopAll = async () => {
    stopAllSimulations()
    for (const account of accounts) {
      if (account.status === 'active') {
        await trainingAccountService.updateStatus(account.id, 'paused')
      }
    }
    loadAccounts()
  }

  const handlePromote = async (account: TrainingAccount) => {
    await trainingAccountService.promoteToMaster(account.id)
    loadAccounts()
  }

  const selectedAccount = accounts.find(a => a.id === selectedId) || null
  const leaderboard = trainingAccountService.buildLeaderboard(accounts)
  const activeCount = accounts.filter(a => a.status === 'active').length

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading training accounts...</div>
  }

  if (selectedAccount) {
    return (
      <TrainingAccountDetail
        account={selectedAccount}
        watchlistSymbols={watchlistSymbols}
        onBack={() => { setSelectedId(null); loadAccounts() }}
        onRefresh={loadAccounts}
        onPromote={handlePromote}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Training Accounts</h1>
          <p className="text-slate-400 mt-1">
            Run multiple AI accounts in parallel to accelerate learning.
            {accounts.length > 0 && (
              <span className="text-slate-300"> {accounts.length} accounts, {activeCount} active</span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {accounts.length > 0 && (
            <>
              <button
                onClick={handleStartAll}
                className="flex items-center space-x-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Play className="h-4 w-4" />
                <span>Start All</span>
              </button>
              <button
                onClick={handleStopAll}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
              >
                <Square className="h-4 w-4" />
                <span>Stop All</span>
              </button>
              <button
                onClick={loadAccounts}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <EmptyState onCreateClick={() => setShowCreate(true)} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Total Accounts" value={accounts.length} icon={Users} />
            <SummaryCard
              label="Combined P&L"
              value={`$${accounts.reduce((s, a) => s + a.total_profit_loss, 0).toFixed(2)}`}
              icon={TrendingUp}
              color={accounts.reduce((s, a) => s + a.total_profit_loss, 0) >= 0 ? 'green' : 'red'}
            />
            <SummaryCard
              label="Avg Win Rate"
              value={`${accounts.length > 0 ? (accounts.reduce((s, a) => s + a.win_rate, 0) / accounts.length).toFixed(1) : 0}%`}
              icon={RefreshCw}
            />
            <SummaryCard
              label="Total Trades"
              value={accounts.reduce((s, a) => s + a.total_trades, 0)}
              icon={Play}
            />
          </div>

          <TrainingLeaderboard
            entries={leaderboard}
            onSelectAccount={setSelectedId}
          />
        </>
      )}

      {showCreate && (
        <CreateAccountModal
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color?: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400">{label}</p>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p className={`text-2xl font-bold ${
        color === 'green' ? 'text-green-400' :
        color === 'red' ? 'text-red-400' :
        'text-white'
      }`}>{value}</p>
    </div>
  )
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
      <Users className="h-16 w-16 text-slate-600 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">No Training Accounts Yet</h2>
      <p className="text-slate-400 mb-2 max-w-lg mx-auto">
        Create multiple AI training accounts to run different strategy variations simultaneously.
        Each account can be configured as Strict (locked rules) or Adaptive (drift enabled).
      </p>
      <p className="text-sm text-slate-500 mb-6 max-w-lg mx-auto">
        Your Master AI watches all accounts and can absorb the best-performing configurations.
      </p>
      <button
        onClick={onCreateClick}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Create Training Account
      </button>
    </div>
  )
}

function CreateAccountModal({ onSubmit, onCancel }: { onSubmit: (p: CreateAccountParams) => void; onCancel: () => void }) {
  const baseStrategies = listBaseStrategies()
  const overlayStrategies = listOverlayStrategies()
  const [name, setName] = useState('')
  const [strategyId, setStrategyId] = useState(baseStrategies[0]?.id || 'trade-surge')
  const [enabledOverlays, setEnabledOverlays] = useState<string[]>([])
  const [mode, setMode] = useState<'strict' | 'adaptive'>('adaptive')
  const [capital, setCapital] = useState(25000)
  const [risk, setRisk] = useState(1)
  const [maxPositions, setMaxPositions] = useState(3)
  const [scanInterval, setScanInterval] = useState(60)

  const toggleOverlay = (overlayId: string) => {
    setEnabledOverlays(prev =>
      prev.includes(overlayId)
        ? prev.filter(id => id !== overlayId)
        : [...prev, overlayId]
    )
  }

  const handleSubmit = () => {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      strategyId,
      mode,
      startingCapital: capital,
      riskPerTrade: risk,
      maxPositions,
      scanIntervalSeconds: scanInterval,
      overlayStrategyIds: enabledOverlays,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-xl p-6 max-w-lg w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-5">Create Training Account</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Strict APAM #1, Drift Explorer"
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Base Strategy</label>
            <select
              value={strategyId}
              onChange={e => setStrategyId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {baseStrategies.map(s => (
                <option key={s.id} value={s.id}>{s.name} (v{s.version})</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Primary trading ruleset (Trade Surge or APAM)</p>
          </div>

          {overlayStrategies.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Optional Strategy Overlays
              </label>
              <p className="text-xs text-slate-400 mb-2">
                Additional strategies that layer on top of the base strategy
              </p>
              <div className="space-y-2">
                {overlayStrategies.map(overlay => (
                  <label
                    key={overlay.id}
                    className="flex items-center justify-between p-3 bg-slate-700 rounded-lg border border-slate-600 hover:border-slate-500 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{overlay.name}</p>
                      <p className="text-xs text-slate-400">{overlay.description}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enabledOverlays.includes(overlay.id)}
                      onChange={() => toggleOverlay(overlay.id)}
                      className="h-5 w-5 rounded border-slate-500 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('strict')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  mode === 'strict'
                    ? 'bg-blue-900/30 border-blue-500 ring-1 ring-blue-500'
                    : 'bg-slate-700 border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-semibold text-white">Strict</span>
                </div>
                <p className="text-xs text-slate-400">Follows rules exactly. No drift. Control group.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('adaptive')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  mode === 'adaptive'
                    ? 'bg-amber-900/30 border-amber-500 ring-1 ring-amber-500'
                    : 'bg-slate-700 border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-semibold text-white">Adaptive</span>
                </div>
                <p className="text-xs text-slate-400">Drift enabled. Learns and evolves from results.</p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Starting Capital ($)</label>
              <input
                type="number"
                value={capital}
                onChange={e => setCapital(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Risk Per Trade (%)</label>
              <input
                type="number"
                value={risk}
                onChange={e => setRisk(Number(e.target.value))}
                step="0.25"
                min="0.25"
                max="5"
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Max Positions</label>
              <input
                type="number"
                value={maxPositions}
                onChange={e => setMaxPositions(Number(e.target.value))}
                min="1"
                max="20"
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Scan Interval (sec)</label>
              <select
                value={scanInterval}
                onChange={e => setScanInterval(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={30}>30s (Fast)</option>
                <option value={60}>60s (Normal)</option>
                <option value={120}>2min (Relaxed)</option>
                <option value={300}>5min (Slow)</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Account
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
