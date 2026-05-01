import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { aiEngine } from '@/lib/aiEngine'
import { supabase } from '@/lib/supabase'
import {
  Cpu,
  Radio,
  Zap,
  Shield,
} from 'lucide-react'

interface SignalPulse {
  id: string
  timestamp: number
  type: 'scan' | 'drift' | 'rollback' | 'trade' | 'learn'
  symbol?: string
  value: number
  label: string
}

interface NeuralSnapshot {
  weights: Record<string, number>
  thresholdShift: number
  patternCount: number
  driftPercent: number
  isDrifting: boolean
  totalDecisions: number
  activeOverrides: number
  totalRollbacks: number
  recentWinRate: number
  recentPL: number
  tradeCount: number
  openPositions: number
  patternStats: Array<{
    key: string
    wins: number
    losses: number
    winRate: number
    totalPL: number
  }>
}

function WeightHeatCell({ factor, value }: { factor: string; value: number }) {
  const drift = value - 1.0
  const intensity = Math.min(1, Math.abs(drift) / 0.5)

  let bg: string
  if (drift > 0.02) {
    bg = `rgba(16, 185, 129, ${0.15 + intensity * 0.6})`
  } else if (drift < -0.02) {
    bg = `rgba(239, 68, 68, ${0.15 + intensity * 0.6})`
  } else {
    bg = 'rgba(100, 116, 139, 0.2)'
  }

  return (
    <div
      className="rounded px-2 py-1.5 text-center transition-all duration-700"
      style={{ backgroundColor: bg }}
    >
      <p className="text-[10px] text-slate-400 uppercase tracking-wider leading-none mb-1">
        {factor.replace('Score', '')}
      </p>
      <p className="text-sm font-mono font-bold text-white leading-none">
        {value.toFixed(3)}
      </p>
      <p className={`text-[9px] font-mono leading-none mt-0.5 ${
        drift > 0.02 ? 'text-emerald-400' : drift < -0.02 ? 'text-red-400' : 'text-slate-500'
      }`}>
        {drift > 0 ? '+' : ''}{(drift * 100).toFixed(1)}%
      </p>
    </div>
  )
}

function SignalStream({ pulses }: { pulses: SignalPulse[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [pulses.length])

  const typeColor: Record<string, string> = {
    scan: 'text-sky-400',
    drift: 'text-amber-400',
    rollback: 'text-red-400',
    trade: 'text-emerald-400',
    learn: 'text-cyan-400',
  }

  const typeGlow: Record<string, string> = {
    scan: 'bg-sky-400',
    drift: 'bg-amber-400',
    rollback: 'bg-red-400',
    trade: 'bg-emerald-400',
    learn: 'bg-cyan-400',
  }

  return (
    <div ref={containerRef} className="h-48 overflow-y-auto scrollbar-thin space-y-0.5 font-mono text-[11px]">
      {pulses.length === 0 ? (
        <div className="text-slate-600 text-center py-8">
          <Radio className="h-5 w-5 mx-auto mb-2 opacity-40" />
          <p>Awaiting signal...</p>
        </div>
      ) : (
        pulses.map((pulse) => (
          <div key={pulse.id} className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-slate-800/50 transition-colors">
            <div className={`w-1.5 h-1.5 rounded-full ${typeGlow[pulse.type]} animate-pulse flex-shrink-0`} />
            <span className="text-slate-600 flex-shrink-0">
              {new Date(pulse.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`${typeColor[pulse.type]} flex-shrink-0 uppercase w-12`}>{pulse.type}</span>
            <span className="text-slate-300 truncate">{pulse.label}</span>
            {pulse.symbol && <span className="text-white font-semibold flex-shrink-0">{pulse.symbol}</span>}
            <span className={`ml-auto flex-shrink-0 ${pulse.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pulse.value > 0 ? '+' : ''}{pulse.value.toFixed(2)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

function ConfidenceWave({ values }: { values: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, rect.width, rect.height)

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.15)'
    ctx.lineWidth = 1
    for (let y = 0; y <= 4; y++) {
      const py = (y / 4) * rect.height
      ctx.beginPath()
      ctx.moveTo(0, py)
      ctx.lineTo(rect.width, py)
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)'
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, rect.height * 0.5)
    ctx.lineTo(rect.width, rect.height * 0.5)
    ctx.stroke()
    ctx.setLineDash([])

    if (values.length < 2) return

    const stepX = rect.width / (values.length - 1)

    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height)
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)')
    gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.05)')
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.15)')

    ctx.beginPath()
    ctx.moveTo(0, rect.height)
    values.forEach((v, i) => {
      const x = i * stepX
      const y = rect.height - (v / 10) * rect.height
      if (i === 0) ctx.lineTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.lineTo((values.length - 1) * stepX, rect.height)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    ctx.beginPath()
    values.forEach((v, i) => {
      const x = i * stepX
      const y = rect.height - (v / 10) * rect.height
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'
    ctx.lineWidth = 2
    ctx.stroke()

    const lastVal = values[values.length - 1]
    const lastX = (values.length - 1) * stepX
    const lastY = rect.height - (lastVal / 10) * rect.height
    ctx.beginPath()
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgb(56, 189, 248)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(lastX, lastY, 7, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [values])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-24"
      style={{ imageRendering: 'auto' }}
    />
  )
}

function PatternHeatmap({ patterns }: { patterns: NeuralSnapshot['patternStats'] }) {
  if (patterns.length === 0) {
    return (
      <div className="text-center py-6 text-slate-600 font-mono text-[10px]">
        NO PATTERN DATA
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
      {patterns.slice(0, 12).map((p) => {
        const total = p.wins + p.losses
        const intensity = Math.min(1, total / 20)
        const winBias = p.winRate - 0.5

        let bg: string
        if (winBias > 0.1) {
          bg = `rgba(16, 185, 129, ${0.1 + intensity * 0.5})`
        } else if (winBias < -0.1) {
          bg = `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`
        } else {
          bg = `rgba(100, 116, 139, ${0.1 + intensity * 0.2})`
        }

        const parts = p.key.split('-')
        return (
          <div
            key={p.key}
            className="rounded p-1.5 transition-all duration-500"
            style={{ backgroundColor: bg }}
          >
            <div className="flex items-center gap-1 mb-0.5">
              {parts.map((part, i) => (
                <span key={i} className="text-[8px] text-slate-400 uppercase font-mono">
                  {part.slice(0, 4)}
                  {i < parts.length - 1 && <span className="text-slate-600 mx-0.5">/</span>}
                </span>
              ))}
            </div>
            <div className="flex items-baseline justify-between">
              <span className={`text-xs font-mono font-bold ${
                p.winRate > 0.55 ? 'text-emerald-400' :
                p.winRate < 0.45 ? 'text-red-400' :
                'text-slate-400'
              }`}>
                {(p.winRate * 100).toFixed(0)}%
              </span>
              <span className="text-[9px] text-slate-500 font-mono">{total}t</span>
            </div>
            <div className="w-full h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  p.winRate > 0.55 ? 'bg-emerald-500' :
                  p.winRate < 0.45 ? 'bg-red-500' :
                  'bg-slate-500'
                }`}
                style={{ width: `${p.winRate * 100}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AINeural() {
  const { user } = useAuth()
  const [snapshot, setSnapshot] = useState<NeuralSnapshot | null>(null)
  const [pulses, setPulses] = useState<SignalPulse[]>([])
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const tickRef = useRef(0)

  const generateSnapshot = useCallback(async (): Promise<NeuralSnapshot | null> => {
    if (!user) return null

    await aiEngine.initialize(user.id)
    const drift = aiEngine.getDriftSummary()
    const patternStats = aiEngine.getPatternStats()

    const { data: trades } = await supabase
      .from('simulated_trades')
      .select('profit_loss, status')
      .eq('user_id', user.id)
      .eq('status', 'closed')
      .eq('is_ai_recommended', true)
      .order('exit_time', { ascending: false })
      .limit(20)

    const { data: openTrades } = await supabase
      .from('simulated_trades')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'open')

    let recentWinRate = 0.5
    let recentPL = 0
    let tradeCount = 0

    if (trades && trades.length > 0) {
      tradeCount = trades.length
      const wins = trades.filter(t => (t.profit_loss || 0) > 0).length
      recentWinRate = wins / trades.length
      recentPL = trades.reduce((s, t) => s + (t.profit_loss || 0), 0)
    }

    const patterns: NeuralSnapshot['patternStats'] = []
    patternStats.forEach((perf, key) => {
      const total = perf.wins + perf.losses
      if (total > 0) {
        patterns.push({
          key,
          wins: perf.wins,
          losses: perf.losses,
          winRate: perf.wins / total,
          totalPL: perf.totalPL,
        })
      }
    })
    patterns.sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))

    return {
      weights: drift.weightChanges.reduce((acc, wc) => {
        acc[wc.factor] = 1.0 + (wc.direction === 'up' ? wc.magnitude : wc.direction === 'down' ? -wc.magnitude : 0)
        return acc
      }, {} as Record<string, number>),
      thresholdShift: drift.thresholdShift,
      patternCount: patterns.length,
      driftPercent: drift.driftPercent,
      isDrifting: drift.isDrifting,
      totalDecisions: drift.totalDecisions,
      activeOverrides: drift.activeOverrides,
      totalRollbacks: drift.totalRollbacks,
      recentWinRate,
      recentPL,
      tradeCount,
      openPositions: openTrades?.length || 0,
      patternStats: patterns,
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadInitial()
    }
  }, [user])

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current++
      setTick(tickRef.current)

      if (tickRef.current % 30 === 0 && user) {
        generateSnapshot().then(s => {
          if (s) setSnapshot(s)
        })
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [user, generateSnapshot])

  const loadInitial = async () => {
    setLoading(true)
    const snap = await generateSnapshot()
    if (snap) {
      setSnapshot(snap)
      setConfidenceHistory(
        Array.from({ length: 20 }, () => 4 + Math.random() * 3)
      )

      const initialPulses: SignalPulse[] = []
      if (snap.isDrifting) {
        initialPulses.push({
          id: crypto.randomUUID(),
          timestamp: Date.now() - 5000,
          type: 'drift',
          value: snap.driftPercent,
          label: `Drift active: ${snap.driftPercent.toFixed(1)}% of decisions modified`,
        })
      }
      if (snap.activeOverrides > 0) {
        initialPulses.push({
          id: crypto.randomUUID(),
          timestamp: Date.now() - 3000,
          type: 'learn',
          value: snap.activeOverrides,
          label: `${snap.activeOverrides} pattern override${snap.activeOverrides === 1 ? '' : 's'} active`,
        })
      }
      if (snap.tradeCount > 0) {
        initialPulses.push({
          id: crypto.randomUUID(),
          timestamp: Date.now() - 1000,
          type: 'trade',
          value: snap.recentPL,
          label: `Last ${snap.tradeCount} trades: ${snap.recentWinRate >= 0.5 ? 'positive' : 'negative'} edge`,
        })
      }
      initialPulses.push({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'scan',
        value: 0,
        label: 'Neural view initialized -- monitoring',
      })
      setPulses(initialPulses)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!snapshot) return
    if (tick % 5 === 0 && tick > 0) {
      const jitter = (Math.random() - 0.5) * 1.5
      const base = snapshot.recentWinRate * 10
      const newVal = Math.max(0, Math.min(10, base + jitter))
      setConfidenceHistory(prev => [...prev.slice(-29), newVal])
    }

    if (tick % 8 === 0 && tick > 0 && snapshot.isDrifting) {
      const newPulse: SignalPulse = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'drift',
        value: snapshot.driftPercent / 100,
        label: `Weight vector recalculation tick`,
      }
      setPulses(prev => [newPulse, ...prev].slice(0, 50))
    }
  }, [tick, snapshot])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-slate-400">
          <Cpu className="h-5 w-5 animate-pulse" />
          <span className="font-mono text-sm">Initializing neural view...</span>
        </div>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-500 font-mono text-sm">No data available</div>
      </div>
    )
  }

  const healthScore = Math.min(10, Math.max(0,
    (snapshot.recentWinRate * 5) +
    (snapshot.totalRollbacks === 0 ? 2 : Math.max(0, 2 - snapshot.totalRollbacks * 0.5)) +
    (snapshot.tradeCount > 10 ? 1.5 : snapshot.tradeCount * 0.15) +
    (snapshot.isDrifting ? 0.5 : 1.5)
  ))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Cpu className="h-7 w-7 text-sky-400" />
            <div className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
              snapshot.isDrifting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
            }`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white font-mono tracking-tight">AI NEURAL VIEW</h1>
            <p className="text-[11px] text-slate-500 font-mono">
              INTERNAL STATE MONITOR // {snapshot.isDrifting ? 'DRIFT ACTIVE' : 'BASELINE MODE'} // TICK {tick}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${snapshot.isDrifting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="text-slate-400">{snapshot.isDrifting ? 'DRIFTING' : 'STABLE'}</span>
          </div>
          <div className="text-slate-500">
            DECISIONS: {snapshot.totalDecisions}
          </div>
          <div className="text-slate-500">
            OPEN: {snapshot.openPositions}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-6 sm:col-span-2 bg-slate-800/80 rounded-lg border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">System Health</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgb(30, 41, 59)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={healthScore >= 7 ? 'rgb(16, 185, 129)' : healthScore >= 4 ? 'rgb(245, 158, 11)' : 'rgb(239, 68, 68)'}
                  strokeWidth="6"
                  strokeDasharray={`${(healthScore / 10) * 213.6} 213.6`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-mono font-bold text-white">{healthScore.toFixed(1)}</span>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-mono">WIN RATE</span>
                <span className={`font-mono font-medium ${snapshot.recentWinRate >= 0.5 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(snapshot.recentWinRate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-mono">NET P&L</span>
                <span className={`font-mono font-medium ${snapshot.recentPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {snapshot.recentPL >= 0 ? '+' : ''}{snapshot.recentPL.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-mono">ROLLBACKS</span>
                <span className={`font-mono font-medium ${
                  snapshot.totalRollbacks > 0 ? 'text-amber-400' : 'text-slate-500'
                }`}>
                  {snapshot.totalRollbacks}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 font-mono">DRIFT</span>
                <span className="font-mono font-medium text-slate-300">
                  {snapshot.driftPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-6 sm:col-span-4 bg-slate-800/80 rounded-lg border border-slate-700/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-sky-400" />
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Confidence Wave</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              CURRENT: {confidenceHistory.length > 0 ? confidenceHistory[confidenceHistory.length - 1].toFixed(2) : '0.00'}
            </span>
          </div>
          <ConfidenceWave values={confidenceHistory} />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-6 lg:col-span-3 bg-slate-800/80 rounded-lg border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Weight Vector</span>
            <span className="text-[9px] font-mono text-slate-600 ml-auto">BASE: 1.000</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {['strengthScore', 'timeScore', 'freshnessScore', 'trendScore', 'curveScore', 'profitZoneScore'].map(factor => (
              <WeightHeatCell
                key={factor}
                factor={factor}
                value={snapshot.weights[factor] ?? 1.0}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-emerald-500/50" />
                Positive drift
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-red-500/50" />
                Negative drift
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-slate-500/30" />
                Neutral
              </span>
            </div>
            {snapshot.thresholdShift !== 0 && (
              <div className="flex items-center gap-1 text-[10px] font-mono">
                <span className="text-slate-500">THRESH:</span>
                <span className={snapshot.thresholdShift > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                  {snapshot.thresholdShift > 0 ? '+' : ''}{snapshot.thresholdShift.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-6 lg:col-span-3 bg-slate-800/80 rounded-lg border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Radio className="h-4 w-4 text-sky-400 animate-pulse" />
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Signal Stream</span>
            <span className="text-[9px] font-mono text-slate-600 ml-auto">{pulses.length} signals</span>
          </div>
          <SignalStream pulses={pulses} />
        </div>
      </div>

      <div className="bg-slate-800/80 rounded-lg border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="h-4 w-4 text-sky-400" />
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Pattern Recognition Matrix</span>
          <span className="text-[9px] font-mono text-slate-600 ml-auto">{snapshot.patternStats.length} patterns tracked</span>
        </div>
        <PatternHeatmap patterns={snapshot.patternStats} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { label: 'DECISIONS', value: snapshot.totalDecisions.toString(), color: 'text-white' },
          { label: 'OVERRIDES', value: snapshot.activeOverrides.toString(), color: snapshot.activeOverrides > 0 ? 'text-amber-400' : 'text-slate-500' },
          { label: 'PATTERNS', value: snapshot.patternCount.toString(), color: 'text-sky-400' },
          { label: 'TRADES', value: snapshot.tradeCount.toString(), color: 'text-white' },
          { label: 'WIN RATE', value: `${(snapshot.recentWinRate * 100).toFixed(0)}%`, color: snapshot.recentWinRate >= 0.5 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'DRIFT %', value: `${snapshot.driftPercent.toFixed(1)}`, color: snapshot.driftPercent > 10 ? 'text-amber-400' : 'text-slate-400' },
          { label: 'ROLLBACKS', value: snapshot.totalRollbacks.toString(), color: snapshot.totalRollbacks > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'HEALTH', value: healthScore.toFixed(1), color: healthScore >= 7 ? 'text-emerald-400' : healthScore >= 4 ? 'text-amber-400' : 'text-red-400' },
        ].map((item) => (
          <div key={item.label} className="bg-slate-800/60 rounded-lg border border-slate-700/30 p-2.5 text-center">
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">{item.label}</p>
            <p className={`text-lg font-mono font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
