import { supabase } from './supabase'

export interface TrackRecord {
  id: string
  user_id: string
  pattern_key: string
  total_signals: number
  total_executed: number
  wins: number
  losses: number
  total_profit: number
  total_loss: number
  avg_win: number
  avg_loss: number
  best_win: number
  worst_loss: number
  avg_confidence_at_entry: number
  last_signal_at: string
  updated_at: string
}

async function incrementSignalCount(userId: string, patternKey: string): Promise<void> {
  const { data: existing } = await supabase
    .from('signal_track_record')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_key', patternKey)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('signal_track_record')
      .update({
        total_signals: existing.total_signals + 1,
        last_signal_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('signal_track_record')
      .insert({
        user_id: userId,
        pattern_key: patternKey,
        total_signals: 1,
        last_signal_at: new Date().toISOString(),
      })
  }
}

async function recordTradeResult(
  userId: string,
  patternKey: string,
  profitLoss: number,
  confidenceAtEntry: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('signal_track_record')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_key', patternKey)
    .maybeSingle()

  if (!existing) return

  const isWin = profitLoss > 0
  const newWins = existing.wins + (isWin ? 1 : 0)
  const newLosses = existing.losses + (isWin ? 0 : 1)
  const newExecuted = existing.total_executed + 1
  const newTotalProfit = existing.total_profit + (isWin ? profitLoss : 0)
  const newTotalLoss = existing.total_loss + (isWin ? 0 : Math.abs(profitLoss))
  const newAvgWin = newWins > 0 ? newTotalProfit / newWins : 0
  const newAvgLoss = newLosses > 0 ? newTotalLoss / newLosses : 0
  const newBestWin = isWin ? Math.max(existing.best_win, profitLoss) : existing.best_win
  const newWorstLoss = !isWin ? Math.max(existing.worst_loss, Math.abs(profitLoss)) : existing.worst_loss
  const prevConfTotal = existing.avg_confidence_at_entry * existing.total_executed
  const newAvgConf = newExecuted > 0 ? (prevConfTotal + confidenceAtEntry) / newExecuted : 0

  await supabase
    .from('signal_track_record')
    .update({
      total_executed: newExecuted,
      wins: newWins,
      losses: newLosses,
      total_profit: newTotalProfit,
      total_loss: newTotalLoss,
      avg_win: Math.round(newAvgWin * 100) / 100,
      avg_loss: Math.round(newAvgLoss * 100) / 100,
      best_win: Math.round(newBestWin * 100) / 100,
      worst_loss: Math.round(newWorstLoss * 100) / 100,
      avg_confidence_at_entry: Math.round(newAvgConf * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
}

async function getTrackRecords(userId: string): Promise<TrackRecord[]> {
  const { data } = await supabase
    .from('signal_track_record')
    .select('*')
    .eq('user_id', userId)
    .order('total_executed', { ascending: false })

  return (data || []) as TrackRecord[]
}

async function getPatternRecord(userId: string, patternKey: string): Promise<TrackRecord | null> {
  const { data } = await supabase
    .from('signal_track_record')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_key', patternKey)
    .maybeSingle()

  return data as TrackRecord | null
}

function getWinRate(record: TrackRecord): number {
  const total = record.wins + record.losses
  if (total === 0) return 0
  return record.wins / total
}

function getExpectancy(record: TrackRecord): number {
  const total = record.wins + record.losses
  if (total === 0) return 0
  const winRate = record.wins / total
  return (winRate * record.avg_win) - ((1 - winRate) * record.avg_loss)
}

function getProfitFactor(record: TrackRecord): number {
  if (record.total_loss === 0) return record.total_profit > 0 ? 999 : 0
  return record.total_profit / record.total_loss
}

function formatPatternKey(key: string): { curve: string; trend: string; zone: string } {
  const parts = key.split('-')
  return {
    curve: parts[0] || 'unknown',
    trend: parts[1] || 'unknown',
    zone: parts[2] || 'unknown',
  }
}

export const trackRecordService = {
  incrementSignalCount,
  recordTradeResult,
  getTrackRecords,
  getPatternRecord,
  getWinRate,
  getExpectancy,
  getProfitFactor,
  formatPatternKey,
}
