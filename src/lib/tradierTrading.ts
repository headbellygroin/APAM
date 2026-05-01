import { tradierClient, TradierOrder, TradierPosition, TradierBalance } from './tradierApi'
import { supabase } from './supabase'
import { AIRecommendation } from './aiEngine'
import { calculatePositionSize } from '@/utils/surgeStrategy'

export interface TradierTradeResult {
  success: boolean
  orderId?: number
  message: string
  order?: TradierOrder
}

export class TradierTrading {
  private accountId: string | null = null

  async initialize(): Promise<boolean> {
    try {
      const account = await tradierClient.getAccount()
      if (account) {
        this.accountId = account.account_number
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to initialize Tradier trading:', error)
      return false
    }
  }

  async getAccountId(): Promise<string | null> {
    if (!this.accountId) {
      await this.initialize()
    }
    return this.accountId
  }

  async getBalance(): Promise<TradierBalance | null> {
    const accountId = await this.getAccountId()
    if (!accountId) return null
    return tradierClient.getBalance(accountId)
  }

  async getPositions(): Promise<TradierPosition[]> {
    const accountId = await this.getAccountId()
    if (!accountId) return []
    return tradierClient.getPositions(accountId)
  }

  async getOrders(): Promise<TradierOrder[]> {
    const accountId = await this.getAccountId()
    if (!accountId) return []
    return tradierClient.getOrders(accountId)
  }

  async executeMarketOrder(
    _symbol: string,
    _side: 'buy' | 'sell' | 'buy_to_cover' | 'sell_short',
    _quantity: number
  ): Promise<TradierTradeResult> {
    // BLOCKED: Tradier is used for data feed only (15-min delayed)
    // All trading is simulated internally via paper trading
    return {
      success: false,
      message: 'Trading operations blocked: This system uses Tradier for market data only. Use paper trading instead.',
    }
  }

  async executeLimitOrder(
    _symbol: string,
    _side: 'buy' | 'sell' | 'buy_to_cover' | 'sell_short',
    _quantity: number,
    _limitPrice: number
  ): Promise<TradierTradeResult> {
    // BLOCKED: Tradier is used for data feed only (15-min delayed)
    // All trading is simulated internally via paper trading
    return {
      success: false,
      message: 'Trading operations blocked: This system uses Tradier for market data only. Use paper trading instead.',
    }
  }

  async executeStopOrder(
    _symbol: string,
    _side: 'buy' | 'sell' | 'buy_to_cover' | 'sell_short',
    _quantity: number,
    _stopPrice: number
  ): Promise<TradierTradeResult> {
    // BLOCKED: Tradier is used for data feed only (15-min delayed)
    // All trading is simulated internally via paper trading
    return {
      success: false,
      message: 'Trading operations blocked: This system uses Tradier for market data only. Use paper trading instead.',
    }
  }

  async cancelOrder(_orderId: number): Promise<boolean> {
    // BLOCKED: Tradier is used for data feed only (15-min delayed)
    // All trading is simulated internally via paper trading
    throw new Error('Trading operations blocked: This system uses Tradier for market data only. Use paper trading instead.')
  }

  async executeAIRecommendation(
    userId: string,
    recommendation: AIRecommendation,
    riskPercent: number = 1
  ): Promise<{ success: boolean; message: string; orderId?: number; tradeId?: string }> {
    const balance = await this.getBalance()
    if (!balance) {
      return { success: false, message: 'Could not fetch account balance' }
    }

    const accountEquity = balance.total_equity

    const positionSize = calculatePositionSize(
      accountEquity,
      riskPercent,
      recommendation.entryPrice,
      recommendation.stopLoss
    )

    if (positionSize <= 0) {
      return { success: false, message: 'Position size calculation resulted in 0 shares' }
    }

    // REMOVED: Tradier paper trading option - all trading is now internal only
    // Tradier is used for market data feed only (15-min delayed)

    const { data: account } = await supabase
      .from('paper_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!account) {
      return { success: false, message: 'No active paper account found' }
    }

    const riskAmount = account.current_balance * (riskPercent / 100)
    const rewardAmount = positionSize * Math.abs(recommendation.targetPrice - recommendation.entryPrice)

    const { data: trade, error } = await supabase
      .from('simulated_trades')
      .insert({
        user_id: userId,
        paper_account_id: account.id,
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
        status: 'open',
        entry_time: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return { success: false, message: error.message }
    }

    await supabase.from('ai_recommendations').insert({
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

    return {
      success: true,
      message: `Simulated trade opened: ${recommendation.action} ${positionSize} ${recommendation.symbol}`,
      tradeId: trade.id,
    }
  }

  // REMOVED: This method is no longer used since Tradier trading is blocked
  // All trading now happens via internal paper trading simulation

  async syncTradierPositionsToDatabase(_userId: string): Promise<void> {
    const positions = await this.getPositions()
    const orders = await this.getOrders()

    console.log(`Syncing ${positions.length} positions and ${orders.length} orders`)
  }
}

export const tradierTrading = new TradierTrading()
