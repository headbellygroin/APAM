import { supabase } from './supabase'
import { getQuote } from './marketData'
import { AIRecommendation } from './aiEngine'
import { calculatePositionSize } from '@/utils/surgeStrategy'
import {
  FeeSchedule,
  DEFAULT_FEE_SCHEDULE,
  calculateEntryFees,
  calculateExitFees,
} from './tradingFees'
import { signalService } from './signalService'
import { trackRecordService } from './signalTrackRecord'

export interface SimulatedTrade {
  id: string
  symbol: string
  tradeType: 'long' | 'short'
  entryPrice: number
  stopLoss: number
  targetPrice: number
  positionSize: number
  status: 'pending' | 'open' | 'closed' | 'cancelled'
  profitLoss?: number
  exitReason?: 'target' | 'stop' | 'manual' | 'time'
}

export class TradeSimulator {
  async createPaperAccount(userId: string, name: string, startingBalance: number) {
    const { data, error } = await supabase
      .from('paper_accounts')
      .insert({
        user_id: userId,
        name,
        starting_balance: startingBalance,
        current_balance: startingBalance,
        total_profit_loss: 0,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getPaperAccount(userId: string, accountId?: string) {
    if (accountId) {
      const { data, error } = await supabase
        .from('paper_accounts')
        .select('*')
        .eq('id', accountId)
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return data
    }

    const { data } = await supabase
      .from('paper_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return data
  }

  async executeRecommendation(
    userId: string,
    paperAccountId: string,
    recommendation: AIRecommendation,
    riskPercent: number = 1
  ) {
    const account = await this.getPaperAccount(userId, paperAccountId)
    if (!account) throw new Error('Paper account not found')

    const feeSchedule = await this.getFeeSchedule(userId)

    const positionSize = calculatePositionSize(
      account.current_balance,
      riskPercent,
      recommendation.entryPrice,
      recommendation.stopLoss
    )

    const riskAmount = account.current_balance * (riskPercent / 100)
    const rewardAmount = positionSize * Math.abs(recommendation.targetPrice - recommendation.entryPrice)

    const entryFees = calculateEntryFees(positionSize, recommendation.entryPrice, feeSchedule)

    const { data: trade, error: tradeError } = await supabase
      .from('simulated_trades')
      .insert({
        user_id: userId,
        paper_account_id: paperAccountId,
        symbol: recommendation.symbol,
        trade_type: recommendation.action,
        is_ai_recommended: true,
        ai_confidence_score: recommendation.confidenceScore,
        odds_score: recommendation.oddsScore,
        entry_price: recommendation.entryPrice,
        stop_loss: recommendation.stopLoss,
        target_price: recommendation.targetPrice,
        position_size: positionSize,
        risk_amount: riskAmount,
        reward_amount: rewardAmount,
        entry_fees: entryFees.totalFees,
        fee_breakdown: entryFees,
        status: 'open',
        entry_time: new Date().toISOString(),
      })
      .select()
      .single()

    if (tradeError) throw tradeError

    const { error: recError } = await supabase
      .from('ai_recommendations')
      .insert({
        user_id: userId,
        symbol: recommendation.symbol,
        action: recommendation.action,
        confidence_score: recommendation.confidenceScore,
        odds_score: recommendation.oddsScore,
        entry_price: recommendation.entryPrice,
        stop_loss: recommendation.stopLoss,
        target_price: recommendation.targetPrice,
        reasoning: recommendation.reasoning,
        was_taken: true,
        simulated_trade_id: trade.id,
        outcome: 'pending',
      })

    if (recError) console.error('Error saving recommendation:', recError)

    return trade
  }

  async checkAndUpdateTrade(tradeId: string) {
    const { data: trade, error } = await supabase
      .from('simulated_trades')
      .select('*')
      .eq('id', tradeId)
      .single()

    if (error || !trade || trade.status !== 'open') return null

    const quote = await getQuote(trade.symbol)
    if (!quote) return null

    const currentPrice = quote.price
    let shouldClose = false
    let exitReason: 'target' | 'stop' | 'time' | 'manual' = 'manual'
    let exitPrice = currentPrice

    if (trade.trade_type === 'long') {
      if (currentPrice >= trade.target_price) {
        shouldClose = true
        exitReason = 'target'
        exitPrice = trade.target_price
      } else if (currentPrice <= trade.stop_loss) {
        shouldClose = true
        exitReason = 'stop'
        exitPrice = trade.stop_loss
      }
    } else {
      if (currentPrice <= trade.target_price) {
        shouldClose = true
        exitReason = 'target'
        exitPrice = trade.target_price
      } else if (currentPrice >= trade.stop_loss) {
        shouldClose = true
        exitReason = 'stop'
        exitPrice = trade.stop_loss
      }
    }

    if (shouldClose) {
      return await this.closeTrade(trade.id, exitPrice, exitReason)
    }

    return null
  }

  async closeTrade(tradeId: string, exitPrice: number, exitReason: 'target' | 'stop' | 'manual' | 'time') {
    const { data: trade, error: fetchError } = await supabase
      .from('simulated_trades')
      .select('*')
      .eq('id', tradeId)
      .single()

    if (fetchError || !trade) throw new Error('Trade not found')

    const feeSchedule = await this.getFeeSchedule(trade.user_id)

    let grossPL: number
    if (trade.trade_type === 'long') {
      grossPL = (exitPrice - trade.entry_price) * trade.position_size
    } else {
      grossPL = (trade.entry_price - exitPrice) * trade.position_size
    }

    const exitFees = calculateExitFees(trade.position_size, exitPrice, feeSchedule)
    const entryFees = trade.entry_fees || 0
    const totalFees = entryFees + exitFees.totalFees
    const profitLoss = Math.round((grossPL - totalFees) * 100) / 100

    const { error: updateError } = await supabase
      .from('simulated_trades')
      .update({
        status: 'closed',
        exit_time: new Date().toISOString(),
        exit_price: exitPrice,
        profit_loss: profitLoss,
        gross_profit_loss: Math.round(grossPL * 100) / 100,
        exit_fees: exitFees.totalFees,
        total_fees: totalFees,
        exit_reason: exitReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tradeId)

    if (updateError) throw updateError

    const { data: account } = await supabase
      .from('paper_accounts')
      .select('*')
      .eq('id', trade.paper_account_id)
      .single()

    if (account) {
      const newBalance = account.current_balance + profitLoss
      const newTotalPL = account.total_profit_loss + profitLoss

      await supabase
        .from('paper_accounts')
        .update({
          current_balance: newBalance,
          total_profit_loss: newTotalPL,
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id)
    }

    await supabase
      .from('ai_recommendations')
      .update({
        outcome: profitLoss > 0 ? 'win' : 'loss',
        updated_at: new Date().toISOString(),
      })
      .eq('simulated_trade_id', tradeId)

    await supabase
      .from('ai_learning_history')
      .insert({
        user_id: trade.user_id,
        event_type: 'trade_completed',
        performance_metric: profitLoss,
        adjustments: {
          symbol: trade.symbol,
          outcome: profitLoss > 0 ? 'win' : 'loss',
          profitLoss,
          exitReason,
        },
      })

    try {
      const linkedSignal = await signalService.getSignalsByTradeId(tradeId)
      if (linkedSignal) {
        await signalService.markSignalClosed(linkedSignal.id, exitPrice, profitLoss, exitReason)
        await trackRecordService.recordTradeResult(
          trade.user_id,
          linkedSignal.pattern_key,
          profitLoss,
          linkedSignal.confidence_score
        )
      }
    } catch (e) {
      console.error('Signal close tracking failed:', e)
    }

    return { ...trade, profit_loss: profitLoss, status: 'closed', exit_reason: exitReason }
  }

  async monitorAllOpenTrades(userId: string) {
    const { data: trades } = await supabase
      .from('simulated_trades')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'open')

    if (!trades || trades.length === 0) return []

    const results = []
    for (const trade of trades) {
      const result = await this.checkAndUpdateTrade(trade.id)
      if (result) results.push(result)
    }

    return results
  }

  async getAccountPerformance(userId: string, paperAccountId: string) {
    const { data: trades } = await supabase
      .from('simulated_trades')
      .select('*')
      .eq('user_id', userId)
      .eq('paper_account_id', paperAccountId)
      .eq('status', 'closed')

    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalProfitLoss: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
      }
    }

    const winningTrades = trades.filter(t => (t.profit_loss || 0) > 0)
    const losingTrades = trades.filter(t => (t.profit_loss || 0) < 0)

    const totalProfit = winningTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0)
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0))

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      totalProfitLoss: totalProfit - totalLoss,
      averageWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 0,
    }
  }

  private async getFeeSchedule(userId: string): Promise<FeeSchedule> {
    const { data } = await supabase
      .from('user_settings')
      .select('fee_schedule')
      .eq('user_id', userId)
      .maybeSingle()

    if (data?.fee_schedule) {
      return { ...DEFAULT_FEE_SCHEDULE, ...data.fee_schedule }
    }
    return DEFAULT_FEE_SCHEDULE
  }
}

export const tradeSimulator = new TradeSimulator()
