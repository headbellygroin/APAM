import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { aiEngine, AIRecommendation } from '@/lib/aiEngine'
import { signalService, Signal } from '@/lib/signalService'
import { trackRecordService } from '@/lib/signalTrackRecord'
import { followModeService } from '@/lib/followMode'
import { getMarketSymbols, MarketSegment } from '@/lib/marketScanner'
import { runEndOfDayReview, hasEODReviewForDate } from '@/lib/masterAIOrchestrator'
import { loadMarketScannerStrategyIds } from '@/lib/marketScanStrategies'

type BackgroundScanSettings = {
  enabled: boolean
  segment: MarketSegment
  minScore: number
  intervalMinutes: number
  maxSymbols: number
  /**
   * Combined delay model:
   * - provider delay (~15m)
   * - app cadence delay (~15m between pulls)
   *
   * Default 30m matches "second pull is first truly fresh bar after open" intuition.
   */
  delayMinutes: number
  /** Regular session defaults are US equities RTH (ET). */
  sessionOpenEtHour: number
  sessionOpenEtMinute: number
  sessionCloseEtHour: number
  sessionCloseEtMinute: number
  eodEnabled: boolean
  /** Master AI compilation time in America/New_York */
  eodHourEt: number
  eodMinuteEt: number
}

const STORAGE_KEY = 'apam.backgroundScan.v1'

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)))
}

export function getDefaultBackgroundScanSettings(): BackgroundScanSettings {
  return {
    enabled: false,
    segment: 'sp500',
    minScore: 7,
    intervalMinutes: 15,
    maxSymbols: 200,
    delayMinutes: 30,
    // US equities regular session (ET). Adjustable in Settings.
    sessionOpenEtHour: 9,
    sessionOpenEtMinute: 30,
    sessionCloseEtHour: 16,
    sessionCloseEtMinute: 0,
    eodEnabled: true,
    // 4:30pm ET (market close + combined delay)
    eodHourEt: 16,
    eodMinuteEt: 30,
  }
}

export function loadBackgroundScanSettings(): BackgroundScanSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultBackgroundScanSettings()
    const parsed = JSON.parse(raw) as Partial<BackgroundScanSettings>
    const d = getDefaultBackgroundScanSettings()
    const merged: BackgroundScanSettings = { ...d, ...parsed }
    merged.intervalMinutes = clampInt(merged.intervalMinutes, 1, 60)
    merged.maxSymbols = clampInt(merged.maxSymbols, 20, 2000)
    merged.minScore = Math.max(1, Math.min(10, merged.minScore))
    merged.delayMinutes = clampInt(merged.delayMinutes, 0, 180)
    merged.sessionOpenEtHour = clampInt(merged.sessionOpenEtHour, 0, 23)
    merged.sessionOpenEtMinute = clampInt(merged.sessionOpenEtMinute, 0, 59)
    merged.sessionCloseEtHour = clampInt(merged.sessionCloseEtHour, 0, 23)
    merged.sessionCloseEtMinute = clampInt(merged.sessionCloseEtMinute, 0, 59)
    merged.eodHourEt = clampInt(merged.eodHourEt, 0, 23)
    merged.eodMinuteEt = clampInt(merged.eodMinuteEt, 0, 59)
    return merged
  } catch {
    return getDefaultBackgroundScanSettings()
  }
}

export function saveBackgroundScanSettings(settings: BackgroundScanSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

function etCalendarParts(date: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value || '0')
  return { y: get('year'), m: get('month'), d: get('day') }
}

function etTimeParts(date: Date): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const hour = Number(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = Number(parts.find(p => p.type === 'minute')?.value || '0')
  return { hour, minute }
}

function etDateKey(date: Date): string {
  const { y, m, d } = etCalendarParts(date)
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function toEtMinuteOfDay(hour: number, minute: number): number {
  return hour * 60 + minute
}

function etWeekdayShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  }).format(date)
}

function etIsTradingWeekday(date: Date): boolean {
  const w = etWeekdayShort(date)
  return w !== 'Sat' && w !== 'Sun'
}

/**
 * Runs market scanning and EOD compilation while the app is open.
 * This is intentionally browser-driven (no cron) to match the "local app open" requirement.
 */
export default function MarketScanBackgroundRunner() {
  const { user } = useAuth()
  const runningRef = useRef(false)
  const lastScanAtRef = useRef<number>(0)
  const lastEodDayRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      runningRef.current = false
      lastScanAtRef.current = 0
      lastEodDayRef.current = null
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const tick = async () => {
      if (!user) return
      if (runningRef.current) return

      const settings = loadBackgroundScanSettings()

      const now = new Date()
      const et = etTimeParts(now)
      const etMinNow = toEtMinuteOfDay(et.hour, et.minute)
      const sessionOpen = toEtMinuteOfDay(settings.sessionOpenEtHour, settings.sessionOpenEtMinute)
      const sessionClose = toEtMinuteOfDay(settings.sessionCloseEtHour, settings.sessionCloseEtMinute)
      const delayedNow = etMinNow - settings.delayMinutes

      // EOD compilation (Master AI) once per ET trading day after configured ET time
      if (settings.eodEnabled) {
        const eodEtMin = toEtMinuteOfDay(settings.eodHourEt, settings.eodMinuteEt)
        const dayEt = etDateKey(now)
        const weekdayOk = etIsTradingWeekday(now)
        const alreadySaved = weekdayOk ? await hasEODReviewForDate(user.id, dayEt) : true
        if (
          weekdayOk &&
          etMinNow >= eodEtMin &&
          lastEodDayRef.current !== dayEt &&
          !alreadySaved
        ) {
          runningRef.current = true
          try {
            await runEndOfDayReview(user.id)
            lastEodDayRef.current = dayEt
          } finally {
            runningRef.current = false
          }
        }
      }

      if (!settings.enabled) return

      const nowMs = Date.now()
      const intervalMs = settings.intervalMinutes * 60 * 1000
      if (lastScanAtRef.current && nowMs - lastScanAtRef.current < intervalMs) return

      // Only scan on interval boundaries in ET.
      if (et.minute % settings.intervalMinutes !== 0) return

      // Don't scan until delayed clock has entered the configured session window.
      if (delayedNow < sessionOpen || delayedNow >= sessionClose) return

      const symbols = getMarketSymbols(settings.segment).slice(0, settings.maxSymbols)
      if (symbols.length === 0) return

      runningRef.current = true
      try {
        // Scan and compute recommendations
        const scannerStrategyIds = loadMarketScannerStrategyIds()
        const results = await aiEngine.scanMarket(symbols, settings.minScore, user.id, undefined, {
          strategyIds: scannerStrategyIds,
        })

        // Persist scan summary for history / dashboard
        await supabase.from('market_scans').insert({
          user_id: user.id,
          scan_type: 'background_market_scan',
          timeframe: '1min',
          min_score: settings.minScore,
          results: results.map((r) => ({
            symbol: r.symbol,
            score: r.score,
            action: r.recommendation.action,
            strategy_id: r.recommendation.strategyId,
          })),
        })

        const symbolSet = [...new Set(results.map((r) => r.recommendation.symbol))]
        const { data: existingActive } = symbolSet.length
          ? await supabase
              .from('signal_queue')
              .select('symbol, strategy_id')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .in('symbol', symbolSet)
          : { data: [] as { symbol: string; strategy_id: string }[] }

        const existingKeys = new Set(
          (existingActive || []).map((r) => `${r.symbol}|${r.strategy_id || ''}`)
        )
        const patternStats = aiEngine.getPatternStats()

        for (const r of results) {
          const rec = r.recommendation
          const dedupeKey = `${rec.symbol}|${rec.strategyId}`
          if (existingKeys.has(dedupeKey)) continue
          const patternKey = `${rec.reasoning.curvePosition}-${rec.reasoning.trendDirection}-${rec.reasoning.zoneType}`
          const perf = patternStats.get(patternKey)
          const winRate = perf ? perf.wins / ((perf.wins + perf.losses) || 1) : 0.5
          const tradeCount = perf ? perf.wins + perf.losses : 0

          const signal = await signalService.persistSignal(user.id, rec, winRate, tradeCount)
          if (!signal) continue

          existingKeys.add(dedupeKey)

          await trackRecordService.incrementSignalCount(user.id, patternKey)

          // Optional auto-execution if Follow Mode is enabled.
          await followModeService.tryAutoExecute(user.id, signal as Signal, rec as AIRecommendation)
        }

        lastScanAtRef.current = nowMs
      } catch (e) {
        console.error('Background market scan failed:', e)
      } finally {
        runningRef.current = false
      }
    }

    // Check frequently, but actual work is gated by interval + once/day EOD checks.
    tick()
    const timer = window.setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, [user])

  return null
}

