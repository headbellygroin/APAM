import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { tradeSimulator } from '@/lib/tradeSimulator'
import { DollarSign, Plus, RefreshCw } from 'lucide-react'

interface PaperAccount {
  id: string
  name: string
  starting_balance: number
  current_balance: number
  total_profit_loss: number
  is_active: boolean
}

interface SimTrade {
  id: string
  symbol: string
  trade_type: string
  entry_price: number
  stop_loss: number
  target_price: number
  position_size: number
  status: string
  profit_loss: number | null
  gross_profit_loss: number | null
  total_fees: number | null
  entry_fees: number | null
  exit_fees: number | null
  exit_reason: string | null
  entry_time: string
}

export default function PaperTrading() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<PaperAccount[]>([])
  const [activeAccount, setActiveAccount] = useState<PaperAccount | null>(null)
  const [trades, setTrades] = useState<SimTrade[]>([])
  const [showCreateAccount, setShowCreateAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState(10000)
  const [loading, setLoading] = useState(true)
  const [monitoring, setMonitoring] = useState(false)

  useEffect(() => {
    if (user) {
      loadAccounts()
    }
  }, [user])

  useEffect(() => {
    if (activeAccount) {
      loadTrades()
    }
  }, [activeAccount])

  const loadAccounts = async () => {
    if (!user) return

    const { data } = await supabase
      .from('paper_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      setAccounts(data)
      setActiveAccount(data[0])
    }
    setLoading(false)
  }

  const loadTrades = async () => {
    if (!user || !activeAccount) return

    const { data } = await supabase
      .from('simulated_trades')
      .select('*')
      .eq('user_id', user.id)
      .eq('paper_account_id', activeAccount.id)
      .order('created_at', { ascending: false })

    if (data) {
      setTrades(data)
    }
  }

  const createAccount = async () => {
    if (!user) return

    if (!newAccountName.trim()) {
      alert('Please enter an account name')
      return
    }

    if (newAccountBalance <= 0) {
      alert('Starting balance must be greater than 0')
      return
    }

    try {
      await tradeSimulator.createPaperAccount(user.id, newAccountName.trim(), newAccountBalance)
      setShowCreateAccount(false)
      setNewAccountName('')
      setNewAccountBalance(10000)
      await loadAccounts()
    } catch (error: any) {
      console.error('Error creating account:', error)
      alert('Failed to create account: ' + (error.message || 'Unknown error'))
    }
  }

  const monitorTrades = async () => {
    if (!user) return

    setMonitoring(true)
    try {
      await tradeSimulator.monitorAllOpenTrades(user.id)
      loadTrades()
      loadAccounts()
    } finally {
      setMonitoring(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Paper Trading</h1>
          <p className="text-slate-400 mt-2">Practice trading with virtual money</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <DollarSign className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-6">No paper trading accounts yet. Create one to get started!</p>
          <button
            onClick={() => setShowCreateAccount(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Paper Account
          </button>
        </div>

        {showCreateAccount && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
              <h2 className="text-xl font-bold text-white mb-4">Create Paper Trading Account</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Account Name</label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="e.g., Practice Account"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Starting Balance ($)</label>
                  <input
                    type="number"
                    value={newAccountBalance}
                    onChange={(e) => setNewAccountBalance(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={createAccount}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateAccount(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                  >
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

  const profitPercent = activeAccount ? ((activeAccount.total_profit_loss / activeAccount.starting_balance) * 100) : 0
  const openTrades = trades.filter(t => t.status === 'open')
  const closedTrades = trades.filter(t => t.status === 'closed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Paper Trading</h1>
          <p className="text-slate-400 mt-2">Practice trading with AI recommendations</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={monitorTrades}
            disabled={monitoring}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${monitoring ? 'animate-spin' : ''}`} />
            <span>Update Trades</span>
          </button>
          <button
            onClick={() => setShowCreateAccount(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {activeAccount && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/50 rounded-lg p-6 border border-blue-700">
            <p className="text-blue-300 text-sm mb-2">Current Balance</p>
            <p className="text-3xl font-bold text-white">${activeAccount.current_balance.toFixed(2)}</p>
            <p className="text-xs text-blue-400 mt-1">Started with ${activeAccount.starting_balance.toFixed(2)}</p>
          </div>

          <div className={`rounded-lg p-6 border ${
            activeAccount.total_profit_loss >= 0
              ? 'bg-gradient-to-br from-green-900/50 to-green-800/50 border-green-700'
              : 'bg-gradient-to-br from-red-900/50 to-red-800/50 border-red-700'
          }`}>
            <p className="text-sm mb-2" style={{ color: activeAccount.total_profit_loss >= 0 ? '#86efac' : '#fca5a5' }}>
              Total P&L
            </p>
            <p className={`text-3xl font-bold ${activeAccount.total_profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${activeAccount.total_profit_loss.toFixed(2)}
            </p>
            <p className={`text-xs mt-1 ${activeAccount.total_profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">Open Trades</p>
            <p className="text-3xl font-bold text-white">{openTrades.length}</p>
            <p className="text-xs text-slate-500 mt-1">Active positions</p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">Closed Trades</p>
            <p className="text-3xl font-bold text-white">{closedTrades.length}</p>
            <p className="text-xs text-slate-500 mt-1">Completed trades</p>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Trade History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Shares</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Entry</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Stop</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Fees</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Net P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-slate-400">
                    No trades yet. Check AI Recommendations to start!
                  </td>
                </tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-slate-700/30">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{trade.symbol}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        trade.trade_type === 'long' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                      }`}>
                        {trade.trade_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{Math.floor(trade.position_size)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${trade.entry_price.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${trade.target_price.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">${trade.stop_loss.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        trade.status === 'open' ? 'bg-yellow-900/50 text-yellow-300' :
                        trade.status === 'closed' ? 'bg-blue-900/50 text-blue-300' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {trade.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(trade.total_fees || 0) > 0 ? (
                        <span className="text-amber-400" title={`Entry: $${(trade.entry_fees || 0).toFixed(2)} | Exit: $${(trade.exit_fees || 0).toFixed(2)}`}>
                          -${(trade.total_fees || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-500">$0.00</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {trade.profit_loss !== null ? (
                        <span className={trade.profit_loss >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                          ${trade.profit_loss.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Create Paper Trading Account</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Account Name</label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="e.g., Practice Account"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Starting Balance ($)</label>
                <input
                  type="number"
                  value={newAccountBalance}
                  onChange={(e) => setNewAccountBalance(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={createAccount}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreateAccount(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
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
