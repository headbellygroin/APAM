import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { BookOpen, Plus } from 'lucide-react'
import JournalInsights from '@/components/JournalInsights'

interface JournalEntry {
  id: string
  symbol: string | null
  trade_date: string
  trade_type: 'long' | 'short' | null
  entry_price: number | null
  exit_price: number | null
  profit_loss: number | null
  notes: string | null
  emotions: string | null
  lessons_learned: string | null
  created_at: string
}

export default function Journal() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddEntry, setShowAddEntry] = useState(false)

  const [symbol, setSymbol] = useState('')
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split('T')[0])
  const [tradeType, setTradeType] = useState<'long' | 'short'>('long')
  const [entryPrice, setEntryPrice] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [emotions, setEmotions] = useState('')
  const [lessonsLearned, setLessonsLearned] = useState('')

  useEffect(() => {
    if (user) {
      loadEntries()
    }
  }, [user])

  const loadEntries = async () => {
    if (!user) return

    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('trade_date', { ascending: false })

    if (data) {
      setEntries(data)
    }
    setLoading(false)
  }

  const saveEntry = async () => {
    if (!user) return

    const entry = parseFloat(entryPrice)
    const exit = parseFloat(exitPrice)
    const profitLoss = entry && exit ? exit - entry : null

    const { error } = await supabase.from('journal_entries').insert({
      user_id: user.id,
      symbol: symbol.trim() || null,
      trade_date: tradeDate,
      trade_type: tradeType,
      entry_price: entry || null,
      exit_price: exit || null,
      profit_loss: profitLoss,
      notes: notes.trim() || null,
      emotions: emotions.trim() || null,
      lessons_learned: lessonsLearned.trim() || null,
    })

    if (error) {
      console.error('Error saving journal entry:', error)
      alert('Failed to save entry: ' + error.message)
    } else {
      setShowAddEntry(false)
      resetForm()
      await loadEntries()
    }
  }

  const resetForm = () => {
    setSymbol('')
    setTradeDate(new Date().toISOString().split('T')[0])
    setTradeType('long')
    setEntryPrice('')
    setExitPrice('')
    setNotes('')
    setEmotions('')
    setLessonsLearned('')
  }

  if (loading) {
    return <div className="text-center py-12">Loading journal...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Trade Journal</h1>
          <p className="text-slate-400 mt-2">Track your trades and reflect on your decisions</p>
        </div>
        <button
          onClick={() => setShowAddEntry(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>New Entry</span>
        </button>
      </div>

      <JournalInsights />

      {entries.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <BookOpen className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-6">Your journal is empty. Start documenting your trading journey!</p>
          <button
            onClick={() => setShowAddEntry(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {entry.symbol ? `${entry.symbol} Trade` : 'General Entry'}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {new Date(entry.trade_date).toLocaleDateString()}
                    {entry.trade_type && (
                      <span
                        className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${
                          entry.trade_type === 'long' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                        }`}
                      >
                        {entry.trade_type.toUpperCase()}
                      </span>
                    )}
                  </p>
                </div>
                {entry.profit_loss !== null && (
                  <div className="text-right">
                    <p className="text-xs text-slate-400">P&L</p>
                    <p
                      className={`text-2xl font-bold ${
                        entry.profit_loss >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      ${entry.profit_loss.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {entry.entry_price && (
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Entry Price</p>
                    <p className="text-lg font-medium text-white">${entry.entry_price.toFixed(2)}</p>
                  </div>
                )}
                {entry.exit_price && (
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">Exit Price</p>
                    <p className="text-lg font-medium text-white">${entry.exit_price.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {entry.notes && (
                <div className="mb-4">
                  <p className="text-xs text-slate-400 mb-2">Notes</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{entry.notes}</p>
                </div>
              )}

              {entry.emotions && (
                <div className="mb-4">
                  <p className="text-xs text-slate-400 mb-2">Emotions</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{entry.emotions}</p>
                </div>
              )}

              {entry.lessons_learned && (
                <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700">
                  <p className="text-xs text-blue-300 font-medium mb-2">LESSONS LEARNED</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{entry.lessons_learned}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full m-4 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">New Journal Entry</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Symbol (optional)</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Trade Date</label>
                  <input
                    type="date"
                    value={tradeDate}
                    onChange={(e) => setTradeDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Entry Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Exit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Trade Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was your setup? Why did you take this trade?"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Emotions</label>
                <textarea
                  value={emotions}
                  onChange={(e) => setEmotions(e.target.value)}
                  placeholder="How did you feel during and after the trade?"
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Lessons Learned</label>
                <textarea
                  value={lessonsLearned}
                  onChange={(e) => setLessonsLearned(e.target.value)}
                  placeholder="What did you learn from this trade?"
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={saveEntry}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Entry
                </button>
                <button
                  onClick={() => {
                    setShowAddEntry(false)
                    resetForm()
                  }}
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
