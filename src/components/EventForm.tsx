import { useState } from 'react'
import { Plus, Save, X } from 'lucide-react'
import {
  RealWorldEvent,
  EVENT_TYPES,
  IMPACT_DIRECTIONS,
  IMPACT_MAGNITUDES,
  createRealWorldEvent,
} from '@/lib/realWorldEvents'

interface EventFormProps {
  userId: string
  prefillSymbol?: string
  prefillAnomalyIds?: string[]
  onSaved: (event: RealWorldEvent) => void
  onCancel: () => void
}

export default function EventForm({ userId, prefillSymbol, prefillAnomalyIds, onSaved, onCancel }: EventFormProps) {
  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState('other')
  const [description, setDescription] = useState('')
  const [symbolsText, setSymbolsText] = useState(prefillSymbol || '')
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])
  const [impactDirection, setImpactDirection] = useState<string>('neutral')
  const [impactMagnitude, setImpactMagnitude] = useState<string>('moderate')
  const [sourceUrl, setSourceUrl] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [isPredictive, setIsPredictive] = useState(false)
  const [predictiveText, setPredictiveText] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)

    const symbols = symbolsText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    const tags = tagsText.split(',').map(s => s.trim()).filter(Boolean)
    const predictiveSignals = predictiveText.split(',').map(s => s.trim()).filter(Boolean)

    const event = await createRealWorldEvent({
      created_by: userId,
      event_type: eventType,
      title: title.trim(),
      description: description.trim(),
      symbols_affected: symbols,
      event_date: eventDate,
      impact_direction: impactDirection,
      impact_magnitude: impactMagnitude,
      source_url: sourceUrl.trim(),
      discovery_method: (prefillAnomalyIds && prefillAnomalyIds.length > 0) ? 'user_anomaly' : 'manual',
      anomaly_ids: prefillAnomalyIds || [],
      tags,
      is_predictive: isPredictive,
      predictive_signals: predictiveSignals,
      similar_past_events: [],
    })

    setSaving(false)

    if (event) {
      onSaved(event)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg border border-sky-500/30 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Plus className="h-5 w-5 text-sky-400" />
          Log Real World Event
        </h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {prefillAnomalyIds && prefillAnomalyIds.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400">
          Linking to {prefillAnomalyIds.length} anomal{prefillAnomalyIds.length === 1 ? 'y' : 'ies'}. These will be marked as resolved.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., AAPL earnings beat expectations"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Event Type</label>
          <select
            value={eventType}
            onChange={e => setEventType(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {EVENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What happened, why it matters, and how it affected the market..."
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 h-20 resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Symbols (comma-separated)</label>
          <input
            value={symbolsText}
            onChange={e => setSymbolsText(e.target.value)}
            placeholder="AAPL, MSFT, QQQ"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Event Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Source URL</label>
          <input
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Impact Direction</label>
          <select
            value={impactDirection}
            onChange={e => setImpactDirection(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {IMPACT_DIRECTIONS.map(d => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Impact Magnitude</label>
          <select
            value={impactMagnitude}
            onChange={e => setImpactMagnitude(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {IMPACT_MAGNITUDES.map(m => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Tags (comma-separated)</label>
          <input
            value={tagsText}
            onChange={e => setTagsText(e.target.value)}
            placeholder="tech, earnings, surprise"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPredictive}
            onChange={e => setIsPredictive(e.target.checked)}
            className="rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
          />
          <span className="text-sm text-slate-300">This event type could be predicted in the future</span>
        </label>
      </div>

      {isPredictive && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Predictive Signals (comma-separated)</label>
          <input
            value={predictiveText}
            onChange={e => setPredictiveText(e.target.value)}
            placeholder="unusual options volume, social media buzz, insider buying"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Event'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
