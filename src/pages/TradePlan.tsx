import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { calculateRiskRewardRatio, calculatePositionSize, formatCurrency } from '@/utils/surgeStrategy'
import { Calculator, Save } from 'lucide-react'

interface TradePlan {
  id: string
  symbol: string
  trade_type: 'long' | 'short'
  entry_price: number
  stop_loss: number
  target_price: number
  risk_reward_ratio: number
  position_size: number | null
  notes: string | null
  status: string
  created_at: string
}

export default function TradePlan() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<TradePlan[]>([])
  const [loading, setLoading] = useState(true)

  const [symbol, setSymbol] = useState('')
  const [tradeType, setTradeType] = useState<'long' | 'short'>('long')
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [accountBalance, setAccountBalance] = useState('10000')
  const [riskPercent, setRiskPercent] = useState('1')
  const [notes, setNotes] = useState('')

  const [calculatedRR, setCalculatedRR] = useState<number>(0)
  const [calculatedPosition, setCalculatedPosition] = useState<number>(0)
  const [riskAmount, setRiskAmount] = useState<number>(0)
  const [rewardAmount, setRewardAmount] = useState<number>(0)

  useEffect(() => {
    if (user) {
      loadPlans()
      loadPaperAccount()
    }
  }, [user])

  useEffect(() => {
    calculateOdds()
  }, [entryPrice, stopLoss, targetPrice, accountBalance, riskPercent])

  const loadPlans = async () => {
    if (!user) return

    const { data } = await supabase
      .from('trade_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setPlans(data)
    }
    setLoading(false)
  }

  const loadPaperAccount = async () => {
    if (!user) return

    const { data } = await supabase
      .from('paper_accounts')
      .select('current_balance')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setAccountBalance(data.current_balance.toString())
    }
  }

  const calculateOdds = () => {
    const entry = parseFloat(entryPrice)
    const stop = parseFloat(stopLoss)
    const target = parseFloat(targetPrice)
    const balance = parseFloat(accountBalance)
    const risk = parseFloat(riskPercent)

    if (entry && stop && target) {
      const rr = calculateRiskRewardRatio(entry, stop, target)
      setCalculatedRR(rr)

      if (balance && risk) {
        const position = calculatePositionSize(balance, risk, entry, stop)
        setCalculatedPosition(position)

        const riskAmt = balance * (risk / 100)
        const rewardAmt = position * Math.abs(target - entry)
        setRiskAmount(riskAmt)
        setRewardAmount(rewardAmt)
      }
    }
  }

  const savePlan = async () => {
    if (!user || !symbol || !entryPrice || !stopLoss || !targetPrice) {
      alert('Please fill in all required fields')
      return
    }

    const { error } = await supabase.from('trade_plans').insert({
      user_id: user.id,
      symbol: symbol.toUpperCase(),
      trade_type: tradeType,
      entry_price: parseFloat(entryPrice),
      stop_loss: parseFloat(stopLoss),
      target_price: parseFloat(targetPrice),
      risk_reward_ratio: calculatedRR,
      position_size: calculatedPosition,
      notes,
      status: 'planned',
    })

    if (!error) {
      setSymbol('')
      setEntryPrice('')
      setStopLoss('')
      setTargetPrice('')
      setNotes('')
      loadPlans()
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Trade Plan & Odds Calculator</h1>
        <p className="text-slate-400 mt-2">Plan your trades and calculate risk/reward ratios</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center space-x-2 mb-6">
            <Calculator className="h-6 w-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Odds Calculator</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Symbol</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Trade Type</label>
                <select
                  value={tradeType}
                  onChange={(e) => setTradeType(e.target.value as 'long' | 'short')}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Entry Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder="100.00"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Stop Loss</label>
                <input
                  type="number"
                  step="0.01"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="95.00"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Target Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="110.00"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Account Balance ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Risk (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Trade setup notes..."
                rows={3}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-lg p-6 border border-blue-700/50">
            <h3 className="text-lg font-bold text-white mb-4">Calculated Results</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300">Risk:Reward Ratio</span>
                <span className="text-2xl font-bold text-white">
                  {calculatedRR > 0 ? `${calculatedRR.toFixed(2)}:1` : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                <span className="text-slate-300">Position Size</span>
                <span className="text-2xl font-bold text-white">
                  {calculatedPosition > 0 ? `${calculatedPosition} shares` : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-900/30 rounded-lg border border-red-700/50">
                <span className="text-red-300">Risk Amount</span>
                <span className="text-xl font-bold text-red-400">
                  {riskAmount > 0 ? formatCurrency(riskAmount) : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-green-900/30 rounded-lg border border-green-700/50">
                <span className="text-green-300">Potential Reward</span>
                <span className="text-xl font-bold text-green-400">
                  {rewardAmount > 0 ? formatCurrency(rewardAmount) : '-'}
                </span>
              </div>
            </div>

            {calculatedRR >= 2 ? (
              <div className="mt-4 p-3 bg-green-900/30 rounded-lg border border-green-700">
                <p className="text-sm text-green-300">Great R:R ratio! This trade meets the minimum 2:1 requirement.</p>
              </div>
            ) : calculatedRR > 0 ? (
              <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg border border-yellow-700">
                <p className="text-sm text-yellow-300">R:R ratio below 2:1. Consider adjusting your targets.</p>
              </div>
            ) : null}

            <button
              onClick={savePlan}
              className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="h-5 w-5" />
              <span>Save Trade Plan</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Saved Trade Plans</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Entry</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Stop</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">R:R</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-slate-400">
                    No trade plans yet. Create one using the calculator above!
                  </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-700/30">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{plan.symbol}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          plan.trade_type === 'long' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                        }`}
                      >
                        {plan.trade_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${plan.entry_price.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${plan.stop_loss.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${plan.target_price.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                      {plan.risk_reward_ratio.toFixed(2)}:1
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {plan.position_size ? `${plan.position_size} shares` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300">
                        {plan.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
