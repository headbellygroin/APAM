import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { copyTradingService, CopyTarget, CopyTradeEntry, PoliticianTrade } from '@/lib/copyTradingService'
import {
  Plus,
  Users,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  Eye,
  Power,
  PowerOff,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

type Tab = 'targets' | 'log' | 'discover'

export default function CopyTrading() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('targets')
  const [targets, setTargets] = useState<CopyTarget[]>([])
  const [tradeLog, setTradeLog] = useState<CopyTradeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTarget, setShowAddTarget] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [targetTrades, setTargetTrades] = useState<PoliticianTrade[]>([])
  const [summary, setSummary] = useState({
    totalTargets: 0,
    activeTargets: 0,
    totalCopiedTrades: 0,
    executedTrades: 0,
    skippedTrades: 0,
    totalProfitLoss: 0,
  })

  const [newTargetName, setNewTargetName] = useState('')
  const [newTargetType, setNewTargetType] = useState<'politician' | 'whale' | 'insider'>('politician')
  const [newMaxPosition, setNewMaxPosition] = useState('5')

  const politicians = copyTradingService.getKnownPoliticians()

  useEffect(() => {
    if (user) loadAll()
  }, [user])

  const loadAll = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [tgts, log, sum] = await Promise.all([
        copyTradingService.getCopyTargets(user.id),
        copyTradingService.getCopyTradingLog(user.id),
        copyTradingService.getCopyTradingSummary(user.id),
      ])
      setTargets(tgts)
      setTradeLog(log)
      setSummary(sum)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const addTarget = async () => {
    if (!user || !newTargetName.trim()) return
    try {
      await copyTradingService.addCopyTarget(
        user.id,
        newTargetName.trim(),
        newTargetType,
        newTargetType === 'politician' ? 'capitol_trades' : 'sec_filings',
        parseFloat(newMaxPosition)
      )
      setShowAddTarget(false)
      setNewTargetName('')
      await loadAll()
    } catch (err: any) {
      alert('Error: ' + (err.message ?? 'Failed'))
    }
  }

  const addFromDiscover = async (name: string) => {
    if (!user) return
    try {
      await copyTradingService.addCopyTarget(user.id, name, 'politician', 'capitol_trades', 5)
      await loadAll()
    } catch (err: any) {
      alert('Error: ' + (err.message ?? 'Failed'))
    }
  }

  const toggleTarget = async (target: CopyTarget) => {
    try {
      await copyTradingService.updateCopyTarget(target.id, { is_active: !target.is_active })
      await loadAll()
    } catch (err: any) {
      alert('Error: ' + (err.message ?? 'Failed'))
    }
  }

  const removeTarget = async (targetId: string) => {
    if (!confirm('Remove this target?')) return
    try {
      await copyTradingService.removeCopyTarget(targetId)
      await loadAll()
    } catch (err: any) {
      alert('Error: ' + (err.message ?? 'Failed'))
    }
  }

  const viewTrades = (targetName: string) => {
    setSelectedTarget(selectedTarget === targetName ? null : targetName)
    setTargetTrades(copyTradingService.getRecentTradesForTarget(targetName))
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Copy Trading</h1>
          <p className="text-slate-400 mt-1">Track and copy trades from politicians, whales, and insiders</p>
        </div>
        <button
          onClick={() => setShowAddTarget(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Target
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/30 rounded-xl p-5 border border-blue-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-blue-400" />
            <p className="text-blue-300 text-sm font-medium">Tracking</p>
          </div>
          <p className="text-2xl font-bold text-white">{summary.activeTargets}</p>
          <p className="text-xs text-blue-400/70 mt-1">{summary.totalTargets} total targets</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/30 rounded-xl p-5 border border-emerald-700/50">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-5 w-5 text-emerald-400" />
            <p className="text-emerald-300 text-sm font-medium">Copied</p>
          </div>
          <p className="text-2xl font-bold text-white">{summary.executedTrades}</p>
          <p className="text-xs text-emerald-400/70 mt-1">{summary.skippedTrades} skipped</p>
        </div>

        <div className={`rounded-xl p-5 border ${
          summary.totalProfitLoss >= 0
            ? 'bg-gradient-to-br from-green-900/40 to-green-800/30 border-green-700/50'
            : 'bg-gradient-to-br from-red-900/40 to-red-800/30 border-red-700/50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className={`h-5 w-5 ${summary.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            <p className={`text-sm font-medium ${summary.totalProfitLoss >= 0 ? 'text-green-300' : 'text-red-300'}`}>Copy P&L</p>
          </div>
          <p className={`text-2xl font-bold ${summary.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${summary.totalProfitLoss.toFixed(2)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-900/40 to-amber-800/30 rounded-xl p-5 border border-amber-700/50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <p className="text-amber-300 text-sm font-medium">Filing Delay</p>
          </div>
          <p className="text-2xl font-bold text-white">~30d</p>
          <p className="text-xs text-amber-400/70 mt-1">Congressional reporting lag</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700">
        {(['targets', 'log', 'discover'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {t === 'targets' ? 'My Targets' : t === 'log' ? 'Trade Log' : 'Discover'}
          </button>
        ))}
      </div>

      {tab === 'targets' && (
        <div className="space-y-3">
          {targets.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-12 border border-slate-700 text-center">
              <Users className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-4">No targets yet. Track politicians or whales to see their trades.</p>
              <button onClick={() => setTab('discover')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                Discover Politicians
              </button>
            </div>
          ) : (
            targets.map(target => (
              <div key={target.id}>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        target.target_type === 'politician' ? 'bg-blue-900/50 text-blue-300' :
                        target.target_type === 'whale' ? 'bg-emerald-900/50 text-emerald-300' :
                        'bg-amber-900/50 text-amber-300'
                      }`}>
                        {target.target_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{target.target_name}</p>
                        <p className="text-xs text-slate-500 capitalize">{target.target_type} · {target.data_source}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        target.is_active ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}>
                        {target.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => viewTrades(target.target_name)} className="p-2 text-slate-400 hover:text-white transition-colors" title="View trades">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleTarget(target)} className="p-2 text-slate-400 hover:text-white transition-colors">
                        {target.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </button>
                      <button onClick={() => removeTarget(target.id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-slate-500">
                    <span>Max position: <span className="text-slate-300">{target.max_position_pct}%</span></span>
                    <span>Auto-copy: <span className={target.auto_copy ? 'text-green-400' : 'text-slate-400'}>{target.auto_copy ? 'On' : 'Off'}</span></span>
                  </div>
                </div>

                {selectedTarget === target.target_name && (
                  <div className="bg-slate-800/60 rounded-xl border border-slate-600 mt-1 overflow-hidden">
                    <div className="p-3 border-b border-slate-700">
                      <p className="text-sm font-medium text-slate-300">Recent Disclosed Trades</p>
                    </div>
                    {targetTrades.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">No recent trades found for this target.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-700/40">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs text-slate-400">Symbol</th>
                            <th className="px-4 py-2 text-left text-xs text-slate-400">Action</th>
                            <th className="px-4 py-2 text-left text-xs text-slate-400">Type</th>
                            <th className="px-4 py-2 text-left text-xs text-slate-400">Amount</th>
                            <th className="px-4 py-2 text-left text-xs text-slate-400">Trade Date</th>
                            <th className="px-4 py-2 text-left text-xs text-slate-400">Filed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {targetTrades.map((t, i) => (
                            <tr key={i} className="hover:bg-slate-700/20">
                              <td className="px-4 py-2.5 font-medium text-white">{t.symbol}</td>
                              <td className="px-4 py-2.5">
                                <span className="flex items-center gap-1">
                                  {t.action === 'buy'
                                    ? <ArrowUpRight className="h-3.5 w-3.5 text-green-400" />
                                    : <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />
                                  }
                                  <span className={t.action === 'buy' ? 'text-green-400' : 'text-red-400'}>
                                    {t.action.toUpperCase()}
                                  </span>
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-300 capitalize">{t.assetType}</td>
                              <td className="px-4 py-2.5 text-slate-300 text-xs">{t.amount}</td>
                              <td className="px-4 py-2.5 text-slate-400 text-xs">{t.tradeDate}</td>
                              <td className="px-4 py-2.5 text-slate-400 text-xs">{t.filingDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'log' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Copy Trading History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">P&L</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {tradeLog.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No copy trades recorded yet</td></tr>
                ) : (
                  tradeLog.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-sm font-medium text-white">{entry.symbol}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          entry.action === 'buy' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'
                        }`}>{entry.action.toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300 capitalize">{entry.asset_type}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          entry.status === 'executed' ? 'bg-green-900/30 text-green-400' :
                          entry.status === 'skipped' ? 'bg-amber-900/30 text-amber-400' :
                          entry.status === 'closed' ? 'bg-blue-900/30 text-blue-400' :
                          'bg-slate-700 text-slate-300'
                        }`}>{entry.status.toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {entry.price_at_disclosure > 0 ? `$${entry.price_at_disclosure.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={entry.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}>
                          ${entry.profit_loss.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'discover' && (
        <div className="space-y-4">
          <div className="bg-amber-900/20 rounded-xl p-4 border border-amber-700/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-300 text-sm font-medium">Congressional Trading Data</p>
                <p className="text-slate-400 text-xs mt-1">
                  Members of Congress are required by the STOCK Act to disclose stock trades within 45 days.
                  Data has a 15-45 day filing delay. Historical win rates shown below are based on past disclosures.
                  This is not financial advice — copy at your own risk.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {politicians.map(p => {
              const isTracked = targets.some(t => t.target_name === p.name)
              return (
                <div key={p.name} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-300 font-bold text-lg">
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.party} · {p.state} · {p.chamber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">{p.tradeCount} disclosures</p>
                        <p className={`text-sm font-semibold ${p.winRate >= 65 ? 'text-green-400' : p.winRate >= 55 ? 'text-amber-400' : 'text-red-400'}`}>
                          {p.winRate}% win rate
                        </p>
                      </div>
                      {isTracked ? (
                        <span className="px-3 py-1.5 bg-green-900/30 text-green-400 rounded-lg text-sm font-medium border border-green-700/50">
                          Tracking
                        </span>
                      ) : (
                        <button
                          onClick={() => addFromDiscover(p.name)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium"
                        >
                          Track
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {p.notableHoldings.map(h => (
                      <span key={h} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">{h}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showAddTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Add Copy Target</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={newTargetName}
                  onChange={e => setNewTargetName(e.target.value)}
                  placeholder="e.g., Nancy Pelosi"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
                <select
                  value={newTargetType}
                  onChange={e => setNewTargetType(e.target.value as 'politician' | 'whale' | 'insider')}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="politician">Politician</option>
                  <option value="whale">Whale</option>
                  <option value="insider">Insider</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Max Position (%)</label>
                <input
                  type="number"
                  value={newMaxPosition}
                  onChange={e => setNewMaxPosition(e.target.value)}
                  min={1}
                  max={25}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Max % of portfolio per copied trade</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={addTarget} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                  Add Target
                </button>
                <button onClick={() => setShowAddTarget(false)} className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
