import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Navigate } from 'react-router-dom'
import {
  Globe,
  AlertTriangle,
  BookOpen,
  RefreshCw,
  Plus,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Zap,
} from 'lucide-react'
import {
  UserTradeAnomaly,
  RealWorldEvent,
  EventPatternCatalog,
  EVENT_TYPES,
  ANOMALY_TYPES,
  getAnomalies,
  getRealWorldEvents,
  getPatternCatalog,
  getAnomalyStats,
  updateAnomalyStatus,
  detectAnomalies,
  saveAnomalies,
} from '@/lib/realWorldEvents'
import AnomalyCard from '@/components/AnomalyCard'
import EventForm from '@/components/EventForm'

type TabId = 'anomalies' | 'events' | 'catalog'

export default function RealWorldEvents() {
  const { user, isAdmin, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('anomalies')
  const [anomalies, setAnomalies] = useState<UserTradeAnomaly[]>([])
  const [events, setEvents] = useState<RealWorldEvent[]>([])
  const [catalog, setCatalog] = useState<EventPatternCatalog[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [showEventForm, setShowEventForm] = useState(false)
  const [selectedAnomaly, setSelectedAnomaly] = useState<UserTradeAnomaly | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    if (!loading && isAdmin) {
      loadAll()
    }
  }, [loading, isAdmin])

  const loadAll = async () => {
    setIsLoading(true)
    const [anomalyData, eventData, catalogData, statsData] = await Promise.all([
      getAnomalies({ status: statusFilter || undefined }),
      getRealWorldEvents(),
      getPatternCatalog(),
      getAnomalyStats(),
    ])
    setAnomalies(anomalyData)
    setEvents(eventData)
    setCatalog(catalogData)
    setStats(statsData)
    setIsLoading(false)
  }

  const handleScan = async () => {
    if (!user) return
    setScanning(true)
    const detected = await detectAnomalies(user.id)
    if (detected.length > 0) {
      const saved = await saveAnomalies(detected)
      setStatusMsg(`Detected ${detected.length} anomalies, saved ${saved}`)
    } else {
      setStatusMsg('No anomalies detected in recent trades')
    }
    await loadAll()
    setScanning(false)
    setTimeout(() => setStatusMsg(''), 4000)
  }

  const handleDismiss = async (anomalyId: string) => {
    await updateAnomalyStatus(anomalyId, 'dismissed')
    await loadAll()
  }

  const handleInvestigate = async (anomaly: UserTradeAnomaly) => {
    await updateAnomalyStatus(anomaly.id, 'investigating')
    setAnomalies(prev => prev.map(a => a.id === anomaly.id ? { ...a, status: 'investigating' } : a))
  }

  const handleResolve = (anomaly: UserTradeAnomaly) => {
    setSelectedAnomaly(anomaly)
    setShowEventForm(true)
  }

  const handleEventSaved = async () => {
    setShowEventForm(false)
    setSelectedAnomaly(null)
    setStatusMsg('Event saved and anomaly resolved')
    await loadAll()
    setTimeout(() => setStatusMsg(''), 3000)
  }

  if (!loading && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const tabs: Array<{ id: TabId; label: string; icon: typeof Globe; count?: number }> = [
    { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle, count: stats?.detected || 0 },
    { id: 'events', label: 'Events', icon: Globe, count: stats?.totalEvents || 0 },
    { id: 'catalog', label: 'Pattern Catalog', icon: BookOpen, count: catalog.length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Globe className="h-8 w-8 text-sky-400" />
            Real World Events
          </h1>
          <p className="text-slate-400 mt-1">
            Track what the AI missed -- human trades reveal real-world events the system can learn from
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusMsg && (
            <span className="text-sm text-emerald-400 mr-2">{statusMsg}</span>
          )}
          <button
            onClick={() => { setShowEventForm(true); setSelectedAnomaly(null) }}
            className="flex items-center gap-2 px-3 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Log Event
          </button>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            <Search className={`h-4 w-4 ${scanning ? 'animate-pulse' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan for Anomalies'}
          </button>
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: 'Total Anomalies', value: stats.total, color: 'text-white' },
            { label: 'Needs Review', value: stats.detected, color: stats.detected > 0 ? 'text-amber-400' : 'text-slate-500' },
            { label: 'Investigating', value: stats.investigating, color: stats.investigating > 0 ? 'text-sky-400' : 'text-slate-500' },
            { label: 'Resolved', value: stats.resolved, color: 'text-emerald-400' },
            { label: 'Events Logged', value: stats.totalEvents, color: 'text-white' },
            { label: 'Event Types', value: Object.keys(stats.eventTypes).length, color: 'text-white' },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-800 rounded-lg border border-slate-700 p-3">
              <div className="text-xs text-slate-400">{stat.label}</div>
              <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {showEventForm && (
        <EventForm
          userId={user?.id || ''}
          prefillSymbol={selectedAnomaly?.symbol}
          prefillAnomalyIds={selectedAnomaly ? [selectedAnomaly.id] : undefined}
          onSaved={handleEventSaved}
          onCancel={() => { setShowEventForm(false); setSelectedAnomaly(null) }}
        />
      )}

      <div className="flex items-center gap-1 border-b border-slate-700">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-sky-400 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-700 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-slate-400">Loading...</div>
        </div>
      ) : (
        <>
          {activeTab === 'anomalies' && (
            <AnomaliesTab
              anomalies={anomalies}
              statusFilter={statusFilter}
              typeFilter={typeFilter}
              onStatusFilter={setStatusFilter}
              onTypeFilter={setTypeFilter}
              onInvestigate={handleInvestigate}
              onDismiss={handleDismiss}
              onResolve={handleResolve}
              onRefresh={loadAll}
            />
          )}

          {activeTab === 'events' && (
            <EventsTab events={events} />
          )}

          {activeTab === 'catalog' && (
            <CatalogTab catalog={catalog} />
          )}
        </>
      )}
    </div>
  )
}

function AnomaliesTab({
  anomalies,
  statusFilter,
  typeFilter,
  onStatusFilter,
  onTypeFilter,
  onInvestigate,
  onDismiss,
  onResolve,
  onRefresh,
}: {
  anomalies: UserTradeAnomaly[]
  statusFilter: string
  typeFilter: string
  onStatusFilter: (f: string) => void
  onTypeFilter: (f: string) => void
  onInvestigate: (a: UserTradeAnomaly) => void
  onDismiss: (id: string) => void
  onResolve: (a: UserTradeAnomaly) => void
  onRefresh: () => void
}) {
  const filtered = anomalies.filter(a => {
    if (statusFilter && a.status !== statusFilter) return false
    if (typeFilter && a.anomaly_type !== typeFilter) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-slate-500" />
        <select
          value={statusFilter}
          onChange={e => { onStatusFilter(e.target.value); onRefresh() }}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="">All Statuses</option>
          <option value="detected">Detected</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => onTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="">All Types</option>
          {ANOMALY_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{filtered.length} anomalies</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No anomalies found. Run a scan to detect user trade patterns the AI missed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(anomaly => (
            <AnomalyCard
              key={anomaly.id}
              anomaly={anomaly}
              onInvestigate={onInvestigate}
              onDismiss={onDismiss}
              onResolve={onResolve}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EventsTab({ events }: { events: RealWorldEvent[] }) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [eventTypeFilter, setEventTypeFilter] = useState('')

  const filtered = eventTypeFilter
    ? events.filter(e => e.event_type === eventTypeFilter)
    : events

  const directionIcon = (dir: string) => {
    if (dir === 'bullish') return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
    if (dir === 'bearish') return <TrendingDown className="h-3.5 w-3.5 text-red-400" />
    return <Minus className="h-3.5 w-3.5 text-slate-400" />
  }

  const magnitudeColor = (mag: string) => {
    if (mag === 'extreme') return 'text-red-400 bg-red-500/20'
    if (mag === 'major') return 'text-amber-400 bg-amber-500/20'
    if (mag === 'moderate') return 'text-sky-400 bg-sky-500/20'
    return 'text-slate-400 bg-slate-600/20'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-slate-500" />
        <select
          value={eventTypeFilter}
          onChange={e => setEventTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="">All Event Types</option>
          {EVENT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{filtered.length} events</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
          <Globe className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No events logged yet. Investigate anomalies and tag the real-world events behind them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(event => {
            const isExpanded = expandedEvent === event.id
            const typeLabel = EVENT_TYPES.find(t => t.value === event.event_type)?.label || event.event_type

            return (
              <div key={event.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {directionIcon(event.impact_direction)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{event.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${magnitudeColor(event.impact_magnitude)}`}>
                          {event.impact_magnitude}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">{typeLabel}</span>
                        <span className="text-xs text-slate-600">|</span>
                        <span className="text-xs text-slate-500">{event.event_date}</span>
                        {event.symbols_affected.length > 0 && (
                          <>
                            <span className="text-xs text-slate-600">|</span>
                            <span className="text-xs text-sky-400">{event.symbols_affected.join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {event.is_predictive && (
                      <span className="flex items-center" aria-label="Potentially predictable">
                        <Zap className="h-4 w-4 text-amber-400" />
                      </span>
                    )}
                    {event.discovery_method === 'user_anomaly' && (
                      <span className="flex items-center" aria-label="Discovered via user anomaly">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      </span>
                    )}
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-700 p-4 space-y-3">
                    {event.description && (
                      <p className="text-sm text-slate-300">{event.description}</p>
                    )}

                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <span className="text-slate-500 block mb-1">Discovery Method</span>
                        <span className="text-white">
                          {event.discovery_method === 'user_anomaly' ? 'User Trade Anomaly' :
                           event.discovery_method === 'news_scan' ? 'News Scan' : 'Manual Entry'}
                        </span>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <span className="text-slate-500 block mb-1">Impact</span>
                        <div className="flex items-center gap-1">
                          {directionIcon(event.impact_direction)}
                          <span className="text-white">{event.impact_direction} / {event.impact_magnitude}</span>
                        </div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <span className="text-slate-500 block mb-1">Linked Anomalies</span>
                        <span className="text-white">{event.anomaly_ids.length}</span>
                      </div>
                    </div>

                    {event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {event.tags.map((tag, i) => (
                          <span key={i} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {event.is_predictive && event.predictive_signals.length > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-amber-400 mb-1 flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          Predictive Signals
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {event.predictive_signals.map((sig, i) => (
                            <span key={i} className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                              {sig}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {event.source_url && (
                      <a
                        href={event.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CatalogTab({ catalog }: { catalog: EventPatternCatalog[] }) {
  if (catalog.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-8 text-center">
        <BookOpen className="h-12 w-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">
          The pattern catalog builds automatically as you log events. Each event type gets cataloged with its frequency, affected symbols, and predictive value.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        The catalog grows as you log events. Over time, this becomes a reference the Master AI can use to recognize familiar setups.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {catalog.map(entry => {
          const typeLabel = EVENT_TYPES.find(t => t.value === entry.event_type)?.label || entry.event_type

          return (
            <div key={entry.id} className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-white">{entry.pattern_name}</h3>
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                  {typeLabel}
                </span>
              </div>
              {entry.description && (
                <p className="text-xs text-slate-400 mb-3">{entry.description}</p>
              )}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block">Occurrences</span>
                  <span className="text-white font-medium">{entry.occurrence_count}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Avg Impact</span>
                  <span className="text-white font-medium">
                    {entry.avg_impact_pct > 0 ? `${entry.avg_impact_pct.toFixed(1)}%` : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Win Rate</span>
                  <span className={`font-medium ${entry.win_rate_when_traded >= 55 ? 'text-emerald-400' : entry.win_rate_when_traded >= 45 ? 'text-amber-400' : entry.win_rate_when_traded > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                    {entry.win_rate_when_traded > 0 ? `${entry.win_rate_when_traded.toFixed(0)}%` : '--'}
                  </span>
                </div>
              </div>
              {(entry.typical_symbols as string[]).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {(entry.typical_symbols as string[]).slice(0, 8).map((sym, i) => (
                    <span key={i} className="text-xs bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded">
                      {sym}
                    </span>
                  ))}
                  {(entry.typical_symbols as string[]).length > 8 && (
                    <span className="text-xs text-slate-500">+{(entry.typical_symbols as string[]).length - 8} more</span>
                  )}
                </div>
              )}
              {entry.best_entry_timing && (
                <div className="mt-2 text-xs text-slate-500">
                  Best entry: {entry.best_entry_timing}
                </div>
              )}
              {entry.last_occurred_at && (
                <div className="mt-1 text-xs text-slate-600">
                  Last seen: {new Date(entry.last_occurred_at).toLocaleDateString()}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
