import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { wheelStrategyService, WheelCycle, WheelPremiumEntry, WheelSummary } from '@/lib/wheelStrategyService'
import { trailingStopService, TrailingStopConfig, LadderBuy } from '@/lib/trailingStopService'
import {
  RotateCcw,
  Plus,
  DollarSign,
  TrendingUp,
  ChevronRight,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react'

interface PaperAccount {
  id: string
  name: string
  current_balance: number
}

type Tab = 'cycles' | 'premiums' | 'trailing' | 'guide'

const STAGE_LABELS: Record<string, string> = {
  selling_puts: 'Selling Puts',
  assigned_selling_calls: 'Selling Calls',
  called_away: 'Called Away',
}

const OUTCOME_COLORS: Record<string, string> = {
  expired_worthless: 'text-green-400',
  assigned: 'text-amber-400',
  called_away: 'text-blue-400',
  closed_early: 'text-emerald-400',
  rolled: 'text-slate-400',
  pending: 'text-slate-500',
}

export default function WheelStrategy() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('cycles')
  const [accounts, setAccounts] = useState<PaperAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [cycles, setCycles] = useState<WheelCycle[]>([])
  const [premiums, setPremiums] = useState<WheelPremiumEntry[]>([])
  const [trailingStops, setTrailingStops] = useState<TrailingStopConfig[]>([])
  const [summary, setSummary] = useState<WheelSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const [showNewCycle, setShowNewCycle] = useState(false)
  const [showNewTrailing, setShowNewTrailing] = useState(false)

  const [ncSymbol, setNcSymbol] = useState('')
  const [ncStrike, setNcStrike] = useState('')
  const [ncContracts, setNcContracts] = useState('1')
  const [ncPremium, setNcPremium] = useState('')
  const [ncExpiry, setNcExpiry] = useState('')

  const [ntSymbol, setNtSymbol] = useState('')
  const [ntEntry, setNtEntry] = useState('')
  const [ntInitialStop, setNtInitialStop] = useState('10')
  const [ntTrailPct, setNtTrailPct] = useState('5')
  const [ntActivation, setNtActivation] = useState('10')

  useEffect(() => {
    if (user) loadAccounts()
  }, [user])

  useEffect(() => {
    if (user && selectedAccount) loadAll()
  }, [user, selectedAccount])

  const loadAccounts = async () => {
    if (!user) return
    const { data } = await supabase
      .from('paper_accounts')
      .select('id, name, current_balance')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data && data.length > 0) {
      setAccounts(data)
      setSelectedAccount(data[0].id)
    }
    setLoading(false)
  }

  const loadAll = async () => {
    if (!user) return
    try {
      const [c, p, s, ts] = await Promise.all([
        wheelStrategyService.getAllCycles(user.id, selectedAccount),
        wheelStrategyService.getPremiumLog(user.id),
        wheelStrategyService.getSummary(user.id),
        trailingStopService.getAllConfigs(user.id),
      ])
      setCycles(c)
      setPremiums(p)
      setSummary(s)
      setTrailingStops(ts)
    } catch (err) {
      console.error(err)
    }
  }

  const startCycle = async () => {
    if (!user || !selectedAccount || !ncSymbol || !ncStrike || !ncPremium) return
    try {
      await wheelStrategyService.startCycle(
        user.id,
        selectedAccount,
        ncSymbol.toUpperCase(),
        parseFloat(ncStrike),
        parseInt(ncContracts),
        parseFloat(ncPremium),
        ncExpiry || undefined
      )
      setShowNewCycle(false)
      setNcSymbol(''); setNcStrike(''); setNcContracts('1'); setNcPremium(''); setNcExpiry('')
      await loadAll()
    } catch (err: any) {
      alert('Error: ' + (err.message ?? 'Failed'))
    }
  }

  const createTrailingStop = async () => {
    if (!user || !selectedAccount || !ntSymbol || !ntEntry) return
    try {
      await trailingStopService.createTrailingStop(
        user.id,
        selectedAccount,
        ntSymbol.toUpperCase(),
        parseFloat(ntEntry),
        {
          initialStopPct: parseFloat(ntInitialStop),
          trailPct: parseFloat(ntTrailPct),
          trailActivationPct: parseFloat(ntActivation),
        }
      )
      setShowNewTrailing(false)
      setNtSymbol(''); setNtEntry(''); setNtInitialStop('10'); setNtTrailPct('5'); setNtActivation('10')
      await loadAll()
    } catch (err: any) {
      alert('Error: ' + (err.message ?? 'Failed'))
    }
  }

  const handleCycleAction = async (cycle: WheelCycle, action: string) => {
    if (!user) return
    try {
      if (action === 'put_expired') {
        await wheelStrategyService.recordPutExpired(cycle.id, user.id)
      } else if (action === 'assigned') {
        const price = parseFloat(prompt('Assignment price:') ?? '0')
        if (price > 0) await wheelStrategyService.recordAssignment(cycle.id, user.id, price)
      } else if (action === 'call_expired') {
        await wheelStrategyService.recordCallExpired(cycle.id)
      } else if (action === 'called_away') {
        const price = parseFloat(prompt('Sale price (call strike):') ?? '0')
        if (price > 0) await wheelStrategyService.recordCallAway(cycle.id, user.id, price)
      } else if (action === 'add_call') {
        const strike = parseFloat(prompt('Call strike price:') ?? '0')
        const prem = parseFloat(prompt('Premium per share (e.g. 3.50):') ?? '0')
        if (strike > 0 && prem > 0) await wheelStrategyService.recordCoveredCall(cycle.id, user.id, strike, prem)
      }
      await loadAll()
    } catch (err: any) {
      alert('Error: ' + (err.message ?? 'Failed'))
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  if (accounts.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Wheel Strategy</h1>
          <p className="text-slate-400 mt-1">Collect premium income by cycling puts and covered calls</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-12 border border-slate-700 text-center">
          <RotateCcw className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-4">You need a Paper Trading account first.</p>
          <a href="/paper-trading" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
            Go to Paper Trading
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Wheel Strategy</h1>
          <p className="text-slate-400 mt-1">Options income through systematic premium collection</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} (${a.current_balance.toFixed(0)})</option>
            ))}
          </select>
          <button
            onClick={() => setShowNewCycle(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New Cycle
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/30 rounded-xl p-5 border border-emerald-700/40">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              <p className="text-emerald-300 text-sm font-medium">Total Premium</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400">${summary.totalPremiumCollected.toFixed(2)}</p>
            <p className="text-xs text-emerald-500 mt-1">Collected income</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <RotateCcw className="h-5 w-5 text-blue-400" />
              <p className="text-blue-300 text-sm font-medium">Active Cycles</p>
            </div>
            <p className="text-2xl font-bold text-white">{summary.activeCycles}</p>
            <p className="text-xs text-slate-500 mt-1">{summary.completedCycles} completed</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="h-5 w-5 text-amber-400" />
              <p className="text-amber-300 text-sm font-medium">Put Premiums</p>
            </div>
            <p className="text-2xl font-bold text-white">${summary.putPremiums.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="h-5 w-5 text-blue-400" />
              <p className="text-blue-300 text-sm font-medium">Call Premiums</p>
            </div>
            <p className="text-2xl font-bold text-white">${summary.callPremiums.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700">
        {(['cycles', 'premiums', 'trailing', 'guide'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {t === 'cycles' ? 'Active Cycles' : t === 'premiums' ? 'Premium Log' : t === 'trailing' ? 'Trailing Stops' : 'Strategy Guide'}
          </button>
        ))}
      </div>

      {tab === 'cycles' && (
        <div className="space-y-4">
          {cycles.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-10 border border-slate-700 text-center">
              <RotateCcw className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-3">No wheel cycles yet. Start by selling a cash-secured put.</p>
              <button onClick={() => setShowNewCycle(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm">
                Start First Cycle
              </button>
            </div>
          ) : (
            cycles.map(cycle => (
              <div key={cycle.id} className={`bg-slate-800 rounded-xl border p-5 ${
                cycle.status === 'active' ? 'border-slate-600' : 'border-slate-700/50 opacity-70'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-white">{cycle.symbol}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        cycle.stage === 'selling_puts' ? 'bg-amber-900/40 text-amber-300' :
                        cycle.stage === 'assigned_selling_calls' ? 'bg-blue-900/40 text-blue-300' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {STAGE_LABELS[cycle.stage]}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        cycle.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}>
                        {cycle.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      <span className="text-slate-400">Strike: <span className="text-white font-medium">${cycle.strike_price.toFixed(2)}</span></span>
                      <span className="text-slate-400">Contracts: <span className="text-white font-medium">{cycle.contracts}</span></span>
                      <span className="text-slate-400">Premium: <span className="text-emerald-400 font-medium">${cycle.premium_collected.toFixed(2)}</span></span>
                      {cycle.shares_held > 0 && (
                        <span className="text-slate-400">Shares: <span className="text-white font-medium">{cycle.shares_held}</span></span>
                      )}
                      {cycle.cost_basis > 0 && (
                        <span className="text-slate-400">Cost Basis: <span className="text-white font-medium">${cycle.cost_basis.toFixed(2)}</span></span>
                      )}
                      {cycle.expiration_date && (
                        <span className="text-slate-400">Expires: <span className="text-white font-medium">{cycle.expiration_date}</span></span>
                      )}
                    </div>
                  </div>
                  {cycle.status === 'active' && (
                    <div className="flex flex-col gap-1.5">
                      {cycle.stage === 'selling_puts' && (
                        <>
                          <button onClick={() => handleCycleAction(cycle, 'put_expired')} className="text-xs px-3 py-1.5 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50 border border-green-700/40 transition-colors">
                            Put Expired Worthless
                          </button>
                          <button onClick={() => handleCycleAction(cycle, 'assigned')} className="text-xs px-3 py-1.5 bg-amber-900/30 text-amber-400 rounded-lg hover:bg-amber-900/50 border border-amber-700/40 transition-colors">
                            Got Assigned
                          </button>
                        </>
                      )}
                      {cycle.stage === 'assigned_selling_calls' && (
                        <>
                          <button onClick={() => handleCycleAction(cycle, 'add_call')} className="text-xs px-3 py-1.5 bg-blue-900/30 text-blue-400 rounded-lg hover:bg-blue-900/50 border border-blue-700/40 transition-colors">
                            Sell Covered Call
                          </button>
                          <button onClick={() => handleCycleAction(cycle, 'call_expired')} className="text-xs px-3 py-1.5 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50 border border-green-700/40 transition-colors">
                            Call Expired Worthless
                          </button>
                          <button onClick={() => handleCycleAction(cycle, 'called_away')} className="text-xs px-3 py-1.5 bg-blue-900/30 text-blue-300 rounded-lg hover:bg-blue-900/50 border border-blue-700/40 transition-colors">
                            Shares Called Away
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'premiums' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Premium Income Log</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Symbol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Strike</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Contracts</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Premium</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Outcome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">P&L</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {premiums.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No premiums recorded yet</td></tr>
                ) : (
                  premiums.map(p => (
                    <tr key={p.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-sm font-medium text-white">{p.symbol}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          p.option_type === 'put' ? 'bg-amber-900/30 text-amber-300' : 'bg-blue-900/30 text-blue-300'
                        }`}>
                          {p.option_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">${p.strike_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{p.contracts}</td>
                      <td className="px-4 py-3 text-sm text-emerald-400">${p.premium_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`capitalize text-xs ${OUTCOME_COLORS[p.outcome]}`}>
                          {p.outcome.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={p.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}>
                          ${p.profit_loss.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'trailing' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewTrailing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New Trailing Stop
            </button>
          </div>
          {trailingStops.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-10 border border-slate-700 text-center">
              <TrendingUp className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-3">No trailing stops configured.</p>
              <p className="text-slate-500 text-sm">Trailing stops protect your gains by automatically moving your floor up as the stock climbs.</p>
            </div>
          ) : (
            trailingStops.map(ts => (
              <div key={ts.id} className={`bg-slate-800 rounded-xl border p-5 ${ts.is_active ? 'border-slate-600' : 'border-slate-700/50 opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-white">{ts.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ts.is_active ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                      {ts.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {ts.is_active && (
                    <button
                      onClick={() => trailingStopService.deactivate(ts.id).then(loadAll)}
                      className="text-xs px-3 py-1 text-red-400 hover:text-red-300 border border-red-800/50 rounded-lg transition-colors"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                  <div className="bg-slate-700/50 rounded-lg p-2.5">
                    <p className="text-slate-400 text-xs mb-1">Entry Price</p>
                    <p className="text-white font-medium">${ts.entry_price?.toFixed(2) ?? 'N/A'}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-2.5">
                    <p className="text-slate-400 text-xs mb-1">Current Stop</p>
                    <p className="text-red-400 font-medium">${ts.current_trail_stop.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-2.5">
                    <p className="text-slate-400 text-xs mb-1">Highest Price</p>
                    <p className="text-green-400 font-medium">${ts.highest_price.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-2.5">
                    <p className="text-slate-400 text-xs mb-1">Trail %</p>
                    <p className="text-white font-medium">{ts.trail_pct}%</p>
                  </div>
                </div>
                {ts.ladder_buys?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Ladder Buys</p>
                    <div className="flex flex-wrap gap-2">
                      {(ts.ladder_buys as LadderBuy[]).map((lb, i) => (
                        <div key={i} className={`px-3 py-1.5 rounded-lg text-xs border ${
                          lb.triggered ? 'bg-green-900/20 border-green-700/40 text-green-400' : 'bg-slate-700/50 border-slate-600 text-slate-300'
                        }`}>
                          -{lb.dropPct}%: buy {lb.shares} shares
                          {lb.triggered && <span className="ml-1 text-green-500">✓</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'guide' && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <RotateCcw className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-bold text-white">The Wheel Strategy</h2>
            </div>
            <p className="text-slate-300 mb-6 leading-relaxed">
              The Wheel Strategy generates consistent premium income by acting as the insurance company in the options market.
              You collect premiums at every stage regardless of whether the stock goes up, down, or sideways.
            </p>

            <div className="space-y-4">
              {[
                {
                  step: '1',
                  title: 'Sell a Cash-Secured Put',
                  color: 'amber',
                  desc: 'Pick a stock you\'d want to own. Sell a put at ~10% below the current price with 2-4 week expiry. Collect the premium immediately.',
                  outcomes: ['Put expires worthless → Keep premium, sell another put', 'Price drops below strike → Get assigned (move to Stage 2)'],
                },
                {
                  step: '2',
                  title: 'Sell a Covered Call',
                  color: 'blue',
                  desc: 'You now own 100 shares per contract. Your effective cost basis is lower than the strike price because you collected premium. Sell a call at ~10% above your cost basis.',
                  outcomes: ['Call expires worthless → Keep premium + shares, sell another call', 'Stock rises above strike → Shares get called away (Stage 3)'],
                },
                {
                  step: '3',
                  title: 'Called Away — Repeat',
                  color: 'emerald',
                  desc: 'Your shares were sold at the strike price (above your cost basis). You profited from the stock gain plus all premiums collected. Return to Stage 1.',
                  outcomes: ['Return to Stage 1 and sell another put', 'Every rotation generates income'],
                },
              ].map(s => (
                <div key={s.step} className={`bg-${s.color}-900/10 border border-${s.color}-700/30 rounded-xl p-5`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full bg-${s.color}-600/30 flex items-center justify-center text-${s.color}-300 font-bold text-sm`}>
                      {s.step}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                  </div>
                  <p className="text-slate-300 text-sm mb-3 leading-relaxed">{s.desc}</p>
                  <div className="space-y-1.5">
                    {s.outcomes.map((o, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                        <span className="text-slate-400">{o}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-amber-700/30 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-300 font-medium mb-1">Key Rules</p>
                <ul className="space-y-1 text-sm text-slate-400">
                  <li>• Never sell a put unless you have enough cash to buy 100 shares per contract</li>
                  <li>• Never sell a covered call below your cost basis</li>
                  <li>• Only wheel stocks you genuinely want to own long-term</li>
                  <li>• Close early at 50% profit to free up capital faster</li>
                  <li>• Higher implied volatility = bigger premiums</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewCycle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Start Wheel Cycle (Sell Put)</h2>
            <div className="space-y-3">
              {[
                { label: 'Symbol', value: ncSymbol, set: setNcSymbol, placeholder: 'TSLA', type: 'text' },
                { label: 'Strike Price ($)', value: ncStrike, set: setNcStrike, placeholder: '230.00', type: 'number' },
                { label: 'Contracts', value: ncContracts, set: setNcContracts, placeholder: '1', type: 'number' },
                { label: 'Premium Per Share ($)', value: ncPremium, set: setNcPremium, placeholder: '5.00', type: 'number' },
                { label: 'Expiration Date', value: ncExpiry, set: setNcExpiry, placeholder: '', type: 'date' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}
              {ncContracts && ncPremium && (
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3 text-sm">
                  <p className="text-emerald-300">Total premium collected: <span className="font-bold">${(parseFloat(ncPremium || '0') * parseInt(ncContracts || '1') * 100).toFixed(2)}</span></p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={startCycle} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm">
                  Start Cycle
                </button>
                <button onClick={() => setShowNewCycle(false)} className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewTrailing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">New Trailing Stop</h2>
            <div className="space-y-3">
              {[
                { label: 'Symbol', value: ntSymbol, set: setNtSymbol, placeholder: 'TSLA', type: 'text' },
                { label: 'Entry Price ($)', value: ntEntry, set: setNtEntry, placeholder: '250.00', type: 'number' },
                { label: 'Initial Stop Loss (%)', value: ntInitialStop, set: setNtInitialStop, placeholder: '10', type: 'number' },
                { label: 'Trail Percentage (%)', value: ntTrailPct, set: setNtTrailPct, placeholder: '5', type: 'number' },
                { label: 'Trail Activation (% gain)', value: ntActivation, set: setNtActivation, placeholder: '10', type: 'number' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              {ntEntry && ntInitialStop && (
                <div className="bg-slate-700/50 rounded-lg p-3 text-sm space-y-1">
                  <p className="text-slate-400">Initial floor: <span className="text-red-400">${(parseFloat(ntEntry || '0') * (1 - parseFloat(ntInitialStop || '10') / 100)).toFixed(2)}</span></p>
                  <p className="text-slate-400">Trailing activates at: <span className="text-green-400">${(parseFloat(ntEntry || '0') * (1 + parseFloat(ntActivation || '10') / 100)).toFixed(2)}</span></p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={createTrailingStop} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                  Create
                </button>
                <button onClick={() => setShowNewTrailing(false)} className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm">
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
