import { useState } from 'react'
import { Plus, Trash2, Play, Brain, Users, Cpu, Wand2 } from 'lucide-react'
import {
  MARKET_ERA_PRESETS,
  CreateRunParams,
} from '@/lib/historicalFleetService'
import {
  buildMasterAIDefaultFleet,
  CreateMasterFleetParams,
  MasterAIFleetGeneration,
} from '@/lib/masterAIFleetService'

const SYMBOLS_BY_ERA: Record<string, string[]> = {
  modern: ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NVDA', 'SPY', 'QQQ', 'AMD'],
  legacy: ['GE', 'IBM', 'XOM', 'T', 'GM', 'F', 'BA', 'DD', 'MMM', 'JPM'],
  indices: ['SPY', 'QQQ', 'DIA', 'IWM', 'MDY', 'VTI'],
}

interface Props {
  onSubmit: (params: CreateMasterFleetParams) => void
  loading: boolean
  existingGenerations: MasterAIFleetGeneration[]
}

export default function MasterAIFleetForm({ onSubmit, loading, existingGenerations }: Props) {
  const [genLabel, setGenLabel] = useState('')
  const [description, setDescription] = useState('')
  const [sourceType, setSourceType] = useState<'user_pool' | 'self_generated' | 'hybrid'>('self_generated')
  const [parentGenId, setParentGenId] = useState('')
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState('2022-01-03')
  const [endDate, setEndDate] = useState('2022-12-30')
  const [speedMultiplier, setSpeedMultiplier] = useState(10)
  const [symbolPreset, setSymbolPreset] = useState('modern')
  const [symbolInput, setSymbolInput] = useState(SYMBOLS_BY_ERA.modern.join(', '))
  const [accounts, setAccounts] = useState<CreateRunParams['accounts']>([])
  const [buildingFleet, setBuildingFleet] = useState(false)

  const handlePreset = (key: string) => {
    const preset = MARKET_ERA_PRESETS[key]
    if (preset) {
      setStartDate(preset.start)
      setEndDate(preset.end)
      if (!genLabel) setGenLabel(`Gen - ${preset.label}`)
      if (!description) setDescription(preset.description)
    }
  }

  const handleSymbolPreset = (key: string) => {
    setSymbolPreset(key)
    setSymbolInput(SYMBOLS_BY_ERA[key].join(', '))
  }

  const handleAutoFleet = async () => {
    setBuildingFleet(true)
    const fleet = await buildMasterAIDefaultFleet(10)
    setAccounts(fleet)
    setBuildingFleet(false)
  }

  const addAccount = () => {
    setAccounts(prev => [...prev, {
      name: `MasterAI-Account-${prev.length + 1}`,
      accountType: 'experimental',
      strategyId: 'trade-surge',
      mode: 'adaptive',
      startingCapital: 50000,
      riskPerTrade: 1,
      maxPositions: 3,
    }])
  }

  const removeAccount = (idx: number) => {
    setAccounts(prev => prev.filter((_, i) => i !== idx))
  }

  const updateAccount = (idx: number, field: string, value: any) => {
    setAccounts(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!genLabel.trim() || accounts.length === 0) return

    const symbols = symbolInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)

    onSubmit({
      generationLabel: genLabel.trim(),
      description: description.trim(),
      sourceType,
      parentGenerationId: parentGenId || undefined,
      notes: notes.trim(),
      runParams: {
        name: genLabel.trim(),
        description: description.trim(),
        startDate,
        endDate,
        speedMultiplier,
        symbols,
        accounts,
      },
    })
  }

  const sourceLabels = {
    self_generated: 'Self-Generated — Master AI creates its own rulesets from scratch',
    user_pool: 'User Pool — Pulls learned weights from your live training accounts',
    hybrid: 'Hybrid — Combines user pool data + Master AI own discoveries',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(['self_generated', 'user_pool', 'hybrid'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => setSourceType(type)}
            className={`p-3 rounded-lg border text-left transition-all ${
              sourceType === type
                ? 'border-sky-500 bg-sky-500/10 text-white'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {type === 'self_generated' && <Cpu className="h-4 w-4 text-sky-400" />}
              {type === 'user_pool' && <Users className="h-4 w-4 text-emerald-400" />}
              {type === 'hybrid' && <Wand2 className="h-4 w-4 text-amber-400" />}
              <span className="text-sm font-medium capitalize">{type.replace('_', ' ')}</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">{sourceLabels[type]}</p>
          </button>
        ))}
      </div>

      {existingGenerations.length > 0 && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">
            Parent Generation (optional — leave blank for Gen 1)
          </label>
          <select
            value={parentGenId}
            onChange={e => setParentGenId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">-- No parent (this is the first generation) --</option>
            {existingGenerations.map(g => (
              <option key={g.id} value={g.id}>
                Gen {g.generation_number}: {g.label}
                {g.avg_win_rate > 0 ? ` (${g.avg_win_rate.toFixed(1)}% avg WR)` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Linking to a parent lets the system compare improvements across generations
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Generation Label</label>
          <input
            type="text"
            value={genLabel}
            onChange={e => setGenLabel(e.target.value)}
            placeholder="e.g. Gen 1 — 2008 Crisis, Mixed Strategies"
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
            <option value={1}>1 day/tick — real-time speed</option>
            <option value={5}>5 days/tick</option>
            <option value={10}>10 days/tick</option>
            <option value={20}>20 days/tick (fast)</option>
            <option value={50}>50 days/tick (turbo)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-1">Description / What is being tested</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. First full historical pass. 5 strict + 5 adaptive accounts across Trade Surge and APAM. Goal: identify which strategies survive the 2008 crisis."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-20 resize-none"
        />
      </div>

      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
        <h4 className="text-xs font-medium text-slate-400 mb-2">Market Era</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(MARKET_ERA_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => handlePreset(key)}
              className="px-2.5 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors border border-slate-600"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-white"
              required
            />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-1">Symbol Set</label>
        <div className="flex gap-2 mb-2">
          {Object.keys(SYMBOLS_BY_ERA).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => handleSymbolPreset(k)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                symbolPreset === k
                  ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                  : 'border-slate-600 bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={symbolInput}
          onChange={e => setSymbolInput(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          placeholder="Comma-separated symbols"
          required
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="text-xs text-slate-400">Master AI Fleet Accounts</label>
            <p className="text-xs text-slate-600 mt-0.5">
              10 accounts recommended — mix of strict (control) and adaptive (experimental), across multiple strategies
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAutoFleet}
              disabled={buildingFleet}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-sky-600 text-white rounded hover:bg-sky-700 transition-colors disabled:opacity-50"
            >
              <Brain className="h-3.5 w-3.5" />
              {buildingFleet ? 'Building...' : 'Auto-Build 10 Accounts'}
            </button>
            <button
              type="button"
              onClick={addAccount}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Account
            </button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-700 rounded-lg">
            <Brain className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No accounts yet</p>
            <p className="text-xs text-slate-600 mt-1">
              Click "Auto-Build 10 Accounts" to generate a balanced Master AI fleet
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {accounts.map((acct, idx) => (
              <div key={idx} className="bg-slate-900/50 rounded-lg border border-slate-700 p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={acct.name}
                    onChange={e => updateAccount(idx, 'name', e.target.value)}
                    className="flex-1 bg-transparent border-none text-sm font-medium text-white focus:outline-none min-w-0"
                  />
                  <button
                    type="button"
                    onClick={() => removeAccount(idx)}
                    className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                  <select
                    value={acct.accountType}
                    onChange={e => updateAccount(idx, 'accountType', e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs rounded px-1.5 py-1 text-white"
                  >
                    <option value="control">Control</option>
                    <option value="experimental">Experimental</option>
                  </select>
                  <select
                    value={acct.strategyId}
                    onChange={e => updateAccount(idx, 'strategyId', e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs rounded px-1.5 py-1 text-white"
                  >
                    <option value="trade-surge">Trade Surge</option>
                    <option value="apam">APAM</option>
                    <option value="fibonacci-or">Fib OR</option>
                  </select>
                  <select
                    value={acct.mode}
                    onChange={e => updateAccount(idx, 'mode', e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-xs rounded px-1.5 py-1 text-white"
                  >
                    <option value="strict">Strict</option>
                    <option value="adaptive">Adaptive</option>
                  </select>
                  <input
                    type="number"
                    value={acct.riskPerTrade}
                    onChange={e => updateAccount(idx, 'riskPerTrade', Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-xs rounded px-1.5 py-1 text-white"
                    min={0.5}
                    max={5}
                    step={0.5}
                    title="Risk % per trade"
                  />
                  <input
                    type="number"
                    value={acct.startingCapital}
                    onChange={e => updateAccount(idx, 'startingCapital', Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-xs rounded px-1.5 py-1 text-white"
                    min={10000}
                    step={10000}
                    title="Starting capital"
                  />
                </div>
                <div className="flex gap-2 mt-1 text-xs text-slate-600">
                  <span>Type | Strategy | Mode | Risk% | Capital</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {accounts.length > 0 && (
          <div className="mt-2 flex gap-3 text-xs text-slate-500">
            <span>
              {accounts.filter(a => a.accountType === 'control').length} control
            </span>
            <span>
              {accounts.filter(a => a.accountType === 'experimental').length} experimental
            </span>
            <span>
              {accounts.filter(a => a.strategyId === 'trade-surge').length} Trade Surge
            </span>
            <span>
              {accounts.filter(a => a.strategyId === 'apam').length} APAM
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Internal notes about this generation..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white h-14 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !genLabel.trim() || accounts.length === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 font-medium"
      >
        <Play className="h-4 w-4" />
        {loading ? 'Creating...' : `Launch Master AI Fleet — ${accounts.length} Accounts`}
      </button>
    </form>
  )
}
