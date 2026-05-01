import { supabase } from './supabase'
import { strategyRegistry } from './strategies/registry'
import type { OverlayStrategy, TradeAction, TradeSetup } from './strategies/types'
import type { Candle } from './marketData'

export type StrategyOverlayRow = {
  id: string
  overlay_strategy_id: string
  implementation_weight: number
  can_veto: boolean
  enabled: boolean
}

function isOverlayStrategy(strategy: unknown): strategy is OverlayStrategy {
  return typeof (strategy as OverlayStrategy).analyzeOverlay === 'function'
}

export async function fetchTrainingAccountOverlays(accountId: string): Promise<StrategyOverlayRow[]> {
  const { data } = await supabase
    .from('strategy_overlays')
    .select('id, overlay_strategy_id, implementation_weight, can_veto, enabled')
    .eq('training_account_id', accountId)
    .eq('enabled', true)

  return (data || []) as StrategyOverlayRow[]
}

export async function replaceTrainingAccountOverlays(
  userId: string,
  accountId: string,
  overlayStrategyIds: string[]
): Promise<void> {
  await supabase.from('strategy_overlays').delete().eq('training_account_id', accountId).eq('user_id', userId)

  const unique = [...new Set(overlayStrategyIds)].filter(Boolean)
  if (unique.length === 0) return

  await supabase.from('strategy_overlays').insert(
    unique.map((overlayId) => ({
      user_id: userId,
      training_account_id: accountId,
      overlay_strategy_id: overlayId,
      implementation_weight: 50,
      can_veto: false,
      enabled: true,
    }))
  )
}

export function applyOverlaysToTradeSetup(input: {
  baseSetup: TradeSetup
  candles: Candle[]
  overlays: StrategyOverlayRow[]
}): { setup: TradeSetup; vetoed: boolean; reasons: string[] } {
  let setup = input.baseSetup
  const reasons: string[] = []

  for (const row of input.overlays) {
    const registered = strategyRegistry.get(row.overlay_strategy_id)
    if (!registered) continue

    const strat = registered.strategy
    if (!isOverlayStrategy(strat)) continue

    const analysis = strat.analyzeOverlay(setup, input.candles)

    const weight = Math.max(0, Math.min(100, row.implementation_weight)) / 100
    const weightedAdj = analysis.oddsAdjustment * weight

    if (row.can_veto && analysis.action === 'veto') {
      reasons.push(`${row.overlay_strategy_id}: veto (${analysis.reasoning})`)
      return { setup, vetoed: true, reasons }
    }

    if (analysis.action === 'conflict' && row.can_veto && weightedAdj <= -1) {
      reasons.push(`${row.overlay_strategy_id}: conflict veto (${analysis.reasoning})`)
      return { setup, vetoed: true, reasons }
    }

    if (weightedAdj !== 0) {
      setup = {
        ...setup,
        oddsScore: setup.oddsScore + weightedAdj,
      }
      reasons.push(`${row.overlay_strategy_id}: ${analysis.action} (${weightedAdj >= 0 ? '+' : ''}${weightedAdj.toFixed(2)})`)
    }
  }

  return { setup, vetoed: false, reasons }
}

export function isOpeningRangeWindowEt(params: {
  candleTimestampSec: number
  sessionOpenEtHour: number
  sessionOpenEtMinute: number
  windowMinutes: number
}): boolean {
  const date = new Date(params.candleTimestampSec * 1000)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const hour = Number(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = Number(parts.find(p => p.type === 'minute')?.value || '0')

  const sessionOpen = params.sessionOpenEtHour * 60 + params.sessionOpenEtMinute
  const now = hour * 60 + minute
  return now >= sessionOpen && now < sessionOpen + params.windowMinutes
}

export function normalizeTradeDirection(action: TradeAction): 'long' | 'short' | 'none' {
  if (action === 'long' || action === 'long_advanced') return 'long'
  if (action === 'short' || action === 'short_advanced') return 'short'
  return 'none'
}
