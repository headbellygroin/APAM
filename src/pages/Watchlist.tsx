import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { getQuote, searchSymbols } from '@/lib/marketData'
import { Plus, Trash2, Search, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'

interface WatchlistItem {
  id: string
  symbol: string
  notes: string | null
  created_at: string
  quote?: {
    price: number
    change: number
    percentChange: number
  }
}

export default function Watchlist() {
  const { user } = useAuth()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddSymbol, setShowAddSymbol] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; description: string }>>([])
  const [notes, setNotes] = useState('')
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (user) {
      loadWatchlist()
    }
  }, [user])

  const loadWatchlist = async () => {
    if (!user) return

    const { data } = await supabase
      .from('watchlists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
      setWatchlist(data)
      loadQuotes(data)
    }
    setLoading(false)
  }

  const loadQuotes = async (items: WatchlistItem[]) => {
    setLoadingQuotes(true)
    const updatedItems = await Promise.all(
      items.map(async (item) => {
        const quote = await getQuote(item.symbol)
        return { ...item, quote: quote || undefined }
      })
    )
    setWatchlist(updatedItems)
    setLoadingQuotes(false)
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 1) {
      setSearchResults([])
      return
    }

    const results = await searchSymbols(query)
    setSearchResults(results)
  }

  const addSymbol = async (symbol: string) => {
    if (!user || !symbol) return
    setAddError(null)

    const cleanSymbol = symbol.toUpperCase().trim()
    if (!cleanSymbol) return

    const exists = watchlist.some((item) => item.symbol === cleanSymbol)
    if (exists) {
      setAddError(`${cleanSymbol} is already in your watchlist`)
      return
    }

    setAdding(true)
    const { error } = await supabase.from('watchlists').insert({
      user_id: user.id,
      symbol: cleanSymbol,
      notes: notes || '',
    })

    if (error) {
      setAddError(`Failed to add ${cleanSymbol}: ${error.message}`)
      setAdding(false)
      return
    }

    setShowAddSymbol(false)
    setSearchQuery('')
    setSearchResults([])
    setNotes('')
    setAddError(null)
    setAdding(false)
    loadWatchlist()
  }

  const removeSymbol = async (id: string) => {
    const { error } = await supabase.from('watchlists').delete().eq('id', id)

    if (!error) {
      setWatchlist(watchlist.filter((item) => item.id !== id))
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading watchlist...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Watchlist</h1>
          <p className="text-slate-400 mt-2">Track your favorite stocks</p>
        </div>
        <button
          onClick={() => setShowAddSymbol(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Add Symbol</span>
        </button>
      </div>

      {watchlist.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <Search className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-6">Your watchlist is empty. Add some symbols to get started!</p>
          <button
            onClick={() => setShowAddSymbol(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Symbol
          </button>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Symbol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Change</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">% Change</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Notes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {watchlist.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-700/30">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-bold text-white">{item.symbol}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {loadingQuotes ? (
                        <span className="text-slate-500">Loading...</span>
                      ) : item.quote ? (
                        <span className="text-white font-medium">${item.quote.price.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.quote && (
                        <div className="flex items-center space-x-1">
                          {item.quote.change >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-400" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          )}
                          <span className={item.quote.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                            ${Math.abs(item.quote.change).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.quote && (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.quote.percentChange >= 0
                              ? 'bg-green-900/50 text-green-300'
                              : 'bg-red-900/50 text-red-300'
                          }`}
                        >
                          {item.quote.percentChange >= 0 ? '+' : ''}
                          {item.quote.percentChange.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-400">{item.notes || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => removeSymbol(item.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddSymbol && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Add Symbol to Watchlist</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Symbol
                  <span className="text-xs text-slate-400 ml-2">(Type or search)</span>
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase()
                    setSearchQuery(value)
                    if (value.length >= 1) {
                      handleSearch(value)
                    } else {
                      setSearchResults([])
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      e.preventDefault()
                      addSymbol(searchQuery.trim())
                    }
                  }}
                  placeholder="AAPL, TSLA, etc."
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  autoFocus
                />
                <p className="text-xs text-slate-400 mt-1">Type a ticker symbol and press Enter or click Add</p>
              </div>

              {addError && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {addError}
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto bg-slate-700 rounded-lg border border-slate-600">
                  {searchResults.map((result) => (
                    <button
                      key={result.symbol}
                      onClick={() => {
                        addSymbol(result.symbol)
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-600 transition-colors"
                    >
                      <p className="text-white font-medium">{result.symbol}</p>
                      <p className="text-xs text-slate-400">{result.description}</p>
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Why are you watching this stock?"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => addSymbol(searchQuery.trim())}
                  disabled={!searchQuery.trim() || adding}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? 'Adding...' : 'Add to Watchlist'}
                </button>
                <button
                  onClick={() => {
                    setShowAddSymbol(false)
                    setSearchQuery('')
                    setSearchResults([])
                    setNotes('')
                    setAddError(null)
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
