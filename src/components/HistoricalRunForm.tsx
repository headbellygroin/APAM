import { useState } from 'react'
import { Plus, Trash2, Play, Clock, Info } from 'lucide-react'
import { MARKET_ERA_PRESETS, CreateRunParams } from '@/lib/historicalFleetService'

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'AMD']

const INDEX_OPTIONS = [
  { value: 'SP500', label: 'S&P 500 (as-of that date)' },
  { value: 'NASDAQ100', label: 'Nasdaq 100 (as-of that date)' },
  { value: 'DOW30', label: 'Dow 30' },
  { value: 'RUSSELL2000', label: 'Russell 2000' },
]

interface Props {
  onSubmit: (params: CreateRunParams) => void
  loading: boolean
}

export default function HistoricalRunForm({ onSubmit, loading }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('2022-01-03')
  const [endDate, setEndDate] = useState('2022-12-30')
  const [speedMultiplier, setSpeedMultiplier] = useState(5)
  const [symbolMode, setSymbolMode] = useState<'manual' | 'index' | 'sector'>('manual')
  const [indexName, setIndexName] = useState('SP500')
  const [sectorFilter] = useState('')
  const [symbolInput, setSymbolInput] = useState(DEFAULT_SYMBOLS.join(', '))
  const [accounts, setAccounts] = useState([
    { name: 'Strict Control', accountType: 'control' as const, strategyId: 'trade-surge', mode: 'strict' as const, startingCapital: 25000, riskPerTrade: 1, maxPositions: 3 },
    { name: 'Adaptive Drift', accountType: 'experimental' as const, strategyId: 'trade-surge', mode: 'adaptive' as const, startingCapital: 25000, riskPerTrade: 1, maxPositions: 3 },
  ])

  const handlePreset = (key: string) => {
    const preset = MARKET_ERA_PRESETS[key]
    if (preset) {
      setStartDate(preset.start)
      setEndDate(preset.end)
      setName(preset.label)
      setDescription(preset.description)
    }
  }

  const addAccount = () => {
    setAccounts(prev => [...prev, {
      name: `Account ${prev.length + 1}`,
      accountType: 'experimental' as const,
      strategyId: 'trade-surge',
      mode: 'adaptive' as const,
      startingCapital: 25000,
      riskPerTrade: 1,
      maxPositions: 3,
    }])
  }

  const removeAccount = (idx: number) => {
    if (accounts.length <= 1) return
    setAccounts(prev => prev.filter((_, i) => i !== idx))
  }

  const updateAccount = (idx: number, field: string, value: any) => {
    setAccounts(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const manualSymbols = symbolInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    const symbols = symbolMode === 'manual' ? manualSymbols : manualSymbols
    if (!name.trim() || accounts.length === 0) return

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      startDate,
      endDate,
      speedMultiplier,
      symbols: symbolMode === 'manual' ? symbols : ['SPY'],
      symbolMode,
      indexName: symbolMode === 'index' ? indexName : undefined,
      sectorFilter: symbolMode === 'sector' ? sectorFilter : undefined,
      accounts,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          Market Era Presets
        </h4>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(MARKET_ERA_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePreset(key)}
              className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors border border-slate-600"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Or use the date fields below to create a custom historical period (e.g., 1950-01-01 to 1979-12-31)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Run Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. APAM vs Trade Surge - 2008 Crisis"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Speed (days per tick)</label>
          <select
            value={speedMultiplier}
            onChange={e => setSpeedMultiplier(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value={1}>1 day per tick (slow)</option>
            <option value={5}>5 days per tick</option>
            <option value={10}>10 days per tick</option>
            <option value={20}>20 days per tick (fast)</option>
            <option value={50}>50 days per tick (turbo)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What are you testing with this historical run?"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-16 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            required
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Symbol Universe</label>
          <div className="flex gap-2">
            {(['manual', 'index'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setSymbolMode(mode)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  symbolMode === mode
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-slate-600 bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'manual' ? 'Manual List' : 'Index (as of date)'}
              </button>
            ))}
          </div>
        </div>

        {symbolMode === 'index' && (
          <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400">
                The simulator will use the index composition <strong className="text-white">as it existed on each simulation date</strong> —
                stocks that weren't added yet are excluded, and de-listed stocks are automatically dropped.
                Requires index component data in the <strong className="text-white">External Data Sources</strong> system.
              </p>
            </div>
            <select
              value={indexName}
              onChange={e => setIndexName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {INDEX_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {symbolMode === 'manual' && (
          <div>
            <label className="text-xs text-slate-400 block mb-1">Symbols (comma-separated)</label>
            <input
              type="text"
              value={symbolInput}
              onChange={e => setSymbolInput(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              placeholder="AAPL, MSFT, XOM, ..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Symbols that didn't exist yet on a given date are automatically skipped. De-listed stocks force-close open positions at last known price.
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-slate-400">Fleet Accounts</label>
          <button
            type="button"
            onClick={addAccount}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="h-3 w-3" /> Add Account
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Create multiple accounts to compare strategies and modes. Strict accounts follow rules exactly (control group), while Adaptive accounts learn and drift (experimental group).
        </p>

        <div className="space-y-2">
          {accounts.map((acct, idx) => (
            <div key={idx} className="bg-slate-900/50 rounded-lg border border-slate-700 p-3">
              <div className="flex items-center justify-between mb-2">
                <input
                  type="text"
                  value={acct.name}
                  onChange={e => updateAccount(idx, 'name', e.target.value)}
                  className="bg-transparent border-none text-sm font-medium text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeAccount(idx)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                  disabled={accounts.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <select
                  value={acct.accountType}
                  onChange={e => updateAccount(idx, 'accountType', e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 text-white"
                >
                  <option value="control">Control</option>
                  <option value="experimental">Experimental</option>
                </select>
                <select
                  value={acct.strategyId}
                  onChange={e => updateAccount(idx, 'strategyId', e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 text-white"
                >
                  <option value="trade-surge">Trade Surge</option>
                  <option value="apam">APAM</option>
                </select>
                <select
                  value={acct.mode}
                  onChange={e => updateAccount(idx, 'mode', e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 text-white"
                >
                  <option value="strict">Strict (no drift)</option>
                  <option value="adaptive">Adaptive (drift)</option>
                </select>
                <input
                  type="number"
                  value={acct.startingCapital}
                  onChange={e => updateAccount(idx, 'startingCapital', Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 text-white"
                  min={1000}
                  step={1000}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
      >
        <Play className="h-4 w-4" />
        {loading ? 'Creating...' : 'Create Historical Run'}
      </button>
    </form>
  )
}
