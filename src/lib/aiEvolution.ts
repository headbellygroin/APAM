import { supabase } from './supabase'

export interface StrategyPerformanceSnapshot {
  strategyId: string
  totalTrades: number
  wins: number
  losses: number
  winRate: number
  avgWin: number
  avgLoss: number
  expectancy: number
  totalPL: number
  profitFactor: number
}

export interface RollingPerformance {
  windowSize: number
  trades: number
  winRate: number
  profitFactor: number
  expectancy: number
}

export interface DriftMetrics {
  baseStrategyId: string
  decisionsAligned: number
  decisionsDeviated: number
  driftPercentage: number
  aiPerformancePL: number
  basePerformancePL: number
  outperformancePercent: number
}

export interface EvolutionNotification {
  id: string
  type: 'drift_detected' | 'outperformance' | 'ready_to_evolve' | 'ai_naming' | 'name_warning' | 'name_revoked'
  title: string
  message: string
  metrics: Record<string, number>
  acknowledged: boolean
  createdAt: string
}

export type NameStatus = 'unearned' | 'earned' | 'warning' | 'revoked'

export interface AIIdentity {
  name: string | null
  earnedAt: string | null
  performanceAtNaming: StrategyPerformanceSnapshot | null
  isActive: boolean
  nameStatus: NameStatus
}

export interface AIGoals {
  earn: {
    minWinRate: number
    minProfitFactor: number
    minTrades: number
    requirePositiveExpectancy: boolean
  }
  maintain: {
    rollingWindow: number
    minWinRate: number
    minProfitFactor: number
    requirePositiveExpectancy: boolean
  }
  revoke: {
    rollingWindow: number
    winRateFloor: number
    profitFactorFloor: number
    negativeExpectancy: boolean
  }
}

const AI_GOALS: AIGoals = {
  earn: {
    minWinRate: 0.65,
    minProfitFactor: 1.5,
    minTrades: 100,
    requirePositiveExpectancy: true,
  },
  maintain: {
    rollingWindow: 50,
    minWinRate: 0.58,
    minProfitFactor: 1.3,
    requirePositiveExpectancy: true,
  },
  revoke: {
    rollingWindow: 50,
    winRateFloor: 0.55,
    profitFactorFloor: 1.0,
    negativeExpectancy: true,
  },
}

const DRIFT_THRESHOLDS = {
  MIN_TRADES_FOR_DRIFT: 50,
  MIN_TRADES_FOR_EVOLUTION: 100,
  OUTPERFORMANCE_PERCENT: 15,
  DRIFT_NOTIFICATION_PERCENT: 10,
}

export class AIEvolutionTracker {
  private identity: AIIdentity = {
    name: null,
    earnedAt: null,
    performanceAtNaming: null,
    isActive: false,
    nameStatus: 'unearned',
  }

  async loadIdentity(userId: string) {
    const { data } = await supabase
      .from('ai_evolution_state')
      .select('ai_name, ai_named_at, ai_performance_at_naming, is_ai_active, name_status')
      .eq('user_id', userId)
      .maybeSingle()

    if (data) {
      this.identity = {
        name: data.ai_name,
        earnedAt: data.ai_named_at,
        performanceAtNaming: data.ai_performance_at_naming as StrategyPerformanceSnapshot | null,
        isActive: data.is_ai_active || false,
        nameStatus: (data.name_status as NameStatus) || 'unearned',
      }
    }
  }

  getIdentity(): AIIdentity {
    return { ...this.identity }
  }

  getGoals(): AIGoals {
    return { ...AI_GOALS }
  }

  async calculateStrategyPerformance(userId: string, strategyId: string): Promise<StrategyPerformanceSnapshot> {
    const { data: trades } = await supabase
      .from('simulated_trades')
      .select('profit_loss, risk_amount, reward_amount, exit_reason')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .eq('is_ai_recommended', true)

    const filteredTrades = trades || []
    let wins = 0, losses = 0, totalWin = 0, totalLoss = 0, totalPL = 0

    for (const trade of filteredTrades) {
      const pl = trade.profit_loss || 0
      totalPL += pl
      if (pl > 0) {
        wins++
        totalWin += pl
      } else if (pl < 0) {
        losses++
        totalLoss += Math.abs(pl)
      }
    }

    const total = wins + losses
    const winRate = total > 0 ? wins / total : 0.5
    const avgWin = wins > 0 ? totalWin / wins : 0
    const avgLoss = losses > 0 ? totalLoss / losses : 0

    return {
      strategyId,
      totalTrades: total,
      wins,
      losses,
      winRate,
      avgWin,
      avgLoss,
      expectancy: total > 0 ? (winRate * avgWin) - ((1 - winRate) * avgLoss) : 0,
      totalPL,
      profitFactor: totalLoss > 0 ? totalWin / totalLoss : wins > 0 ? Infinity : 0,
    }
  }

  async calculateRollingPerformance(userId: string, windowSize: number): Promise<RollingPerformance> {
    const { data: trades } = await supabase
      .from('simulated_trades')
      .select('profit_loss')
      .eq('user_id', userId)
      .eq('status', 'closed')
      .eq('is_ai_recommended', true)
      .order('exit_time', { ascending: false })
      .limit(windowSize)

    const recent = trades || []
    let wins = 0, losses = 0, totalWin = 0, totalLoss = 0

    for (const trade of recent) {
      const pl = trade.profit_loss || 0
      if (pl > 0) {
        wins++
        totalWin += pl
      } else if (pl < 0) {
        losses++
        totalLoss += Math.abs(pl)
      }
    }

    const total = wins + losses
    const winRate = total > 0 ? wins / total : 0
    const avgWin = wins > 0 ? totalWin / wins : 0
    const avgLoss = losses > 0 ? totalLoss / losses : 0

    return {
      windowSize,
      trades: total,
      winRate,
      profitFactor: totalLoss > 0 ? totalWin / totalLoss : wins > 0 ? Infinity : 0,
      expectancy: total > 0 ? (winRate * avgWin) - ((1 - winRate) * avgLoss) : 0,
    }
  }

  async evaluateNameStatus(userId: string, strategyId: string): Promise<{
    status: NameStatus
    notifications: EvolutionNotification[]
  }> {
    const notifications: EvolutionNotification[] = []
    const perf = await this.calculateStrategyPerformance(userId, strategyId)
    const rolling = await this.calculateRollingPerformance(userId, AI_GOALS.maintain.rollingWindow)

    const currentStatus = this.identity.nameStatus

    if (currentStatus === 'unearned' || currentStatus === 'revoked') {
      const meetsEarnCriteria =
        perf.totalTrades >= AI_GOALS.earn.minTrades &&
        perf.winRate >= AI_GOALS.earn.minWinRate &&
        perf.profitFactor >= AI_GOALS.earn.minProfitFactor &&
        perf.expectancy > 0

      if (meetsEarnCriteria) {
        return {
          status: 'earned',
          notifications: [{
            id: `naming-${Date.now()}`,
            type: 'ai_naming',
            title: 'AI Has Earned a Name',
            message: `After ${perf.totalTrades} trades with ${(perf.winRate * 100).toFixed(1)}% win rate and ${perf.profitFactor.toFixed(2)} profit factor, the AI has proven consistent edge and earned the right to name itself.`,
            metrics: {
              totalTrades: perf.totalTrades,
              winRate: perf.winRate * 100,
              profitFactor: perf.profitFactor,
              expectancy: perf.expectancy,
              totalPL: perf.totalPL,
            },
            acknowledged: false,
            createdAt: new Date().toISOString(),
          }],
        }
      }

      return { status: currentStatus, notifications: [] }
    }

    if (currentStatus === 'earned' || currentStatus === 'warning') {
      if (rolling.trades < AI_GOALS.maintain.rollingWindow) {
        return { status: currentStatus, notifications: [] }
      }

      const belowRevoke =
        rolling.winRate < AI_GOALS.revoke.winRateFloor ||
        rolling.profitFactor < AI_GOALS.revoke.profitFactorFloor ||
        rolling.expectancy < 0

      if (belowRevoke) {
        const reasons: string[] = []
        if (rolling.winRate < AI_GOALS.revoke.winRateFloor) {
          reasons.push(`win rate dropped to ${(rolling.winRate * 100).toFixed(1)}% (floor: ${AI_GOALS.revoke.winRateFloor * 100}%)`)
        }
        if (rolling.profitFactor < AI_GOALS.revoke.profitFactorFloor) {
          reasons.push(`profit factor dropped to ${rolling.profitFactor.toFixed(2)} (floor: ${AI_GOALS.revoke.profitFactorFloor})`)
        }
        if (rolling.expectancy < 0) {
          reasons.push(`expectancy went negative: $${rolling.expectancy.toFixed(2)}`)
        }

        notifications.push({
          id: `revoke-${Date.now()}`,
          type: 'name_revoked',
          title: 'AI Name Revoked',
          message: `Performance dropped below minimum standards over the last ${rolling.trades} trades: ${reasons.join('; ')}. The AI must re-earn its name.`,
          metrics: {
            rollingWinRate: rolling.winRate * 100,
            rollingProfitFactor: rolling.profitFactor,
            rollingExpectancy: rolling.expectancy,
            trades: rolling.trades,
          },
          acknowledged: false,
          createdAt: new Date().toISOString(),
        })

        return { status: 'revoked', notifications }
      }

      const belowMaintain =
        rolling.winRate < AI_GOALS.maintain.minWinRate ||
        rolling.profitFactor < AI_GOALS.maintain.minProfitFactor ||
        rolling.expectancy < 0

      if (belowMaintain && currentStatus !== 'warning') {
        const warnings: string[] = []
        if (rolling.winRate < AI_GOALS.maintain.minWinRate) {
          warnings.push(`win rate at ${(rolling.winRate * 100).toFixed(1)}% (maintain: ${AI_GOALS.maintain.minWinRate * 100}%)`)
        }
        if (rolling.profitFactor < AI_GOALS.maintain.minProfitFactor) {
          warnings.push(`profit factor at ${rolling.profitFactor.toFixed(2)} (maintain: ${AI_GOALS.maintain.minProfitFactor})`)
        }
        if (rolling.expectancy < 0) {
          warnings.push(`expectancy at $${rolling.expectancy.toFixed(2)}`)
        }

        notifications.push({
          id: `warning-${Date.now()}`,
          type: 'name_warning',
          title: 'AI Performance Warning',
          message: `Performance dropping in last ${rolling.trades} trades: ${warnings.join('; ')}. If this continues, the AI will lose its name.`,
          metrics: {
            rollingWinRate: rolling.winRate * 100,
            rollingProfitFactor: rolling.profitFactor,
            rollingExpectancy: rolling.expectancy,
            trades: rolling.trades,
          },
          acknowledged: false,
          createdAt: new Date().toISOString(),
        })

        return { status: 'warning', notifications }
      }

      if (currentStatus === 'warning' && !belowMaintain) {
        return { status: 'earned', notifications: [] }
      }

      return { status: currentStatus, notifications: [] }
    }

    return { status: currentStatus, notifications: [] }
  }

  async trackDecision(
    userId: string,
    strategyId: string,
    aiAction: string,
    baseAction: string,
    oddsScore: number,
    symbol: string
  ) {
    const isAligned = aiAction === baseAction

    await supabase.from('ai_drift_log').insert({
      user_id: userId,
      strategy_id: strategyId,
      symbol,
      ai_action: aiAction,
      base_action: baseAction,
      is_aligned: isAligned,
      odds_score: oddsScore,
    })
  }

  async calculateDrift(userId: string, strategyId: string): Promise<DriftMetrics> {
    const { data: logs } = await supabase
      .from('ai_drift_log')
      .select('is_aligned, odds_score')
      .eq('user_id', userId)
      .eq('strategy_id', strategyId)

    const decisions = logs || []
    const aligned = decisions.filter(d => d.is_aligned).length
    const deviated = decisions.filter(d => !d.is_aligned).length
    const total = aligned + deviated

    const perf = await this.calculateStrategyPerformance(userId, strategyId)

    return {
      baseStrategyId: strategyId,
      decisionsAligned: aligned,
      decisionsDeviated: deviated,
      driftPercentage: total > 0 ? (deviated / total) * 100 : 0,
      aiPerformancePL: perf.totalPL,
      basePerformancePL: 0,
      outperformancePercent: 0,
    }
  }

  async checkEvolutionReadiness(userId: string, strategyId: string): Promise<EvolutionNotification[]> {
    const notifications: EvolutionNotification[] = []
    const perf = await this.calculateStrategyPerformance(userId, strategyId)
    const drift = await this.calculateDrift(userId, strategyId)

    if (perf.totalTrades >= DRIFT_THRESHOLDS.MIN_TRADES_FOR_DRIFT && drift.driftPercentage > DRIFT_THRESHOLDS.DRIFT_NOTIFICATION_PERCENT) {
      notifications.push({
        id: `drift-${Date.now()}`,
        type: 'drift_detected',
        title: 'Strategy Drift Detected',
        message: `AI decisions have deviated ${drift.driftPercentage.toFixed(1)}% from ${strategyId} base rules over ${perf.totalTrades} trades.`,
        metrics: {
          driftPercent: drift.driftPercentage,
          totalTrades: perf.totalTrades,
          winRate: perf.winRate * 100,
        },
        acknowledged: false,
        createdAt: new Date().toISOString(),
      })
    }

    if (perf.totalTrades >= DRIFT_THRESHOLDS.MIN_TRADES_FOR_EVOLUTION &&
        perf.winRate > 0.6 && perf.expectancy > 0) {
      notifications.push({
        id: `evolve-${Date.now()}`,
        type: 'ready_to_evolve',
        title: 'AI Ready to Create Own Rules',
        message: `After ${perf.totalTrades} trades with ${(perf.winRate * 100).toFixed(1)}% win rate and positive expectancy, the AI has outperformed base strategy rules. Grant permission to create evolved strategy?`,
        metrics: {
          totalTrades: perf.totalTrades,
          winRate: perf.winRate * 100,
          expectancy: perf.expectancy,
          profitFactor: perf.profitFactor,
          totalPL: perf.totalPL,
        },
        acknowledged: false,
        createdAt: new Date().toISOString(),
      })
    }

    const nameEval = await this.evaluateNameStatus(userId, strategyId)
    notifications.push(...nameEval.notifications)

    if (nameEval.status !== this.identity.nameStatus) {
      await this.updateNameStatus(userId, nameEval.status)
    }

    for (const notif of notifications) {
      await supabase.from('ai_evolution_notifications').insert({
        user_id: userId,
        notification_type: notif.type,
        title: notif.title,
        message: notif.message,
        metrics: notif.metrics,
        is_acknowledged: false,
      })
    }

    return notifications
  }

  private async updateNameStatus(userId: string, newStatus: NameStatus) {
    this.identity.nameStatus = newStatus

    if (newStatus === 'revoked') {
      this.identity.isActive = false
    }

    await supabase
      .from('ai_evolution_state')
      .upsert({
        user_id: userId,
        name_status: newStatus,
        is_ai_active: newStatus === 'earned',
        ai_name: newStatus === 'revoked' ? null : this.identity.name,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
  }

  async acknowledgeNotification(userId: string, notificationId: string) {
    await supabase
      .from('ai_evolution_notifications')
      .update({ is_acknowledged: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
  }

  async getUnacknowledgedNotifications(userId: string): Promise<EvolutionNotification[]> {
    const { data } = await supabase
      .from('ai_evolution_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_acknowledged', false)
      .order('created_at', { ascending: false })

    if (!data) return []

    return data.map(d => ({
      id: d.id,
      type: d.notification_type,
      title: d.title,
      message: d.message,
      metrics: d.metrics as Record<string, number>,
      acknowledged: d.is_acknowledged,
      createdAt: d.created_at,
    }))
  }

  async grantEvolutionPermission(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('ai_evolution_state')
      .upsert({
        user_id: userId,
        evolution_permitted: true,
        permitted_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    return !error
  }

  async setAIName(userId: string, name: string, performance: StrategyPerformanceSnapshot): Promise<boolean> {
    this.identity = {
      name,
      earnedAt: new Date().toISOString(),
      performanceAtNaming: performance,
      isActive: true,
      nameStatus: 'earned',
    }

    const { error } = await supabase
      .from('ai_evolution_state')
      .upsert({
        user_id: userId,
        ai_name: name,
        ai_named_at: this.identity.earnedAt,
        ai_performance_at_naming: performance,
        is_ai_active: true,
        name_status: 'earned',
      }, {
        onConflict: 'user_id',
      })

    return !error
  }

  async isEvolutionPermitted(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('ai_evolution_state')
      .select('evolution_permitted')
      .eq('user_id', userId)
      .maybeSingle()

    return data?.evolution_permitted || false
  }
}

export const evolutionTracker = new AIEvolutionTracker()
