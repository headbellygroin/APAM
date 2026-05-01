import { supabase } from './supabase'

export type RiskTier = 'bankrupt' | 'critical' | 'warning' | 'comfortable'

export interface AccountRiskStatus {
  accountId: string
  currentCapital: number
  startingBalance: number
  criticalThreshold: number
  warningThreshold: number
  riskTier: RiskTier
  isBankrupt: boolean
  riskMultiplier: number
  minOddsScore: number
  maxPositionSize: number
  canTrade: boolean
}

export interface PersonalityTraits {
  riskAppetite: number
  tradeFrequency: number
  adaptationSpeed: number
  personalityName: string
}

class BankruptcyProtectionService {
  calculateRiskTier(
    currentCapital: number,
    criticalThreshold: number,
    warningThreshold: number
  ): RiskTier {
    if (currentCapital < criticalThreshold) {
      return 'bankrupt'
    } else if (currentCapital < warningThreshold) {
      return 'critical'
    } else if (currentCapital < warningThreshold * 1.6) {
      return 'warning'
    } else {
      return 'comfortable'
    }
  }

  async getAccountRiskStatus(accountId: string): Promise<AccountRiskStatus | null> {
    const { data: account } = await supabase
      .from('ai_training_accounts')
      .select('*')
      .eq('id', accountId)
      .maybeSingle()

    if (!account) return null

    const riskTier = this.calculateRiskTier(
      account.current_capital,
      account.critical_threshold,
      account.warning_threshold
    )

    const isBankrupt = riskTier === 'bankrupt'
    const riskMultiplier = this.getRiskMultiplier(riskTier, account.risk_appetite)
    const minOddsScore = this.getMinOddsScore(riskTier, account.risk_appetite)
    const maxPositionSize = this.getMaxPositionSize(
      account.current_capital,
      riskTier,
      account.risk_appetite
    )

    return {
      accountId: account.id,
      currentCapital: account.current_capital,
      startingBalance: account.starting_balance,
      criticalThreshold: account.critical_threshold,
      warningThreshold: account.warning_threshold,
      riskTier,
      isBankrupt,
      riskMultiplier,
      minOddsScore,
      maxPositionSize,
      canTrade: !isBankrupt,
    }
  }

  getRiskMultiplier(tier: RiskTier, riskAppetite: number): number {
    const baseMultiplier = {
      bankrupt: 0,
      critical: 0.5,
      warning: 0.8,
      comfortable: 1.0,
    }[tier]

    const appetiteBonus = riskAppetite >= 7 ? 0.2 : 0
    return Math.min(baseMultiplier + appetiteBonus, 1.5)
  }

  getMinOddsScore(tier: RiskTier, riskAppetite: number): number {
    const baseScores = {
      bankrupt: 10,
      critical: 8.5,
      warning: 7.0,
      comfortable: 6.0,
    }

    const baseScore = baseScores[tier]
    const appetiteAdjustment = (10 - riskAppetite) * 0.1

    return Math.max(5.0, Math.min(10.0, baseScore + appetiteAdjustment))
  }

  getMaxPositionSize(currentCapital: number, tier: RiskTier, riskAppetite: number): number {
    const tierLimits = {
      bankrupt: 0,
      critical: 0.005,
      warning: 0.015,
      comfortable: 0.025,
    }

    const baseLimit = tierLimits[tier]
    const appetiteMultiplier = riskAppetite / 10

    const effectiveLimit = baseLimit * (0.5 + appetiteMultiplier * 0.5)
    return currentCapital * effectiveLimit
  }

  async updateRiskTier(accountId: string): Promise<void> {
    const { data: account } = await supabase
      .from('ai_training_accounts')
      .select('current_capital, critical_threshold, warning_threshold, risk_tier, is_bankrupt')
      .eq('id', accountId)
      .maybeSingle()

    if (!account) return

    const newTier = this.calculateRiskTier(
      account.current_capital,
      account.critical_threshold,
      account.warning_threshold
    )

    const newBankruptStatus = newTier === 'bankrupt'

    if (newTier !== account.risk_tier) {
      await supabase
        .from('ai_training_accounts')
        .update({
          risk_tier: newTier,
          is_bankrupt: newBankruptStatus,
          bankrupt_at: newBankruptStatus && !account.is_bankrupt ? new Date().toISOString() : account.is_bankrupt ? undefined : null,
        })
        .eq('id', accountId)

      await this.logBankruptcyEvent(accountId, 'tier_change', account.current_capital, newTier, account.risk_tier)
    }
  }

  async logBankruptcyEvent(
    accountId: string,
    eventType: 'bankrupt' | 'recovered' | 'tier_change',
    newBalance: number,
    newTier?: string,
    previousTier?: string
  ): Promise<void> {
    const { data: account } = await supabase
      .from('ai_training_accounts')
      .select('current_capital')
      .eq('id', accountId)
      .maybeSingle()

    if (!account) return

    await supabase.from('ai_bankruptcy_events').insert({
      account_id: accountId,
      event_type: eventType,
      previous_balance: account.current_capital,
      new_balance: newBalance,
      previous_tier: previousTier,
      new_tier: newTier,
      notes:
        eventType === 'bankrupt'
          ? 'Account fell below critical threshold and is now paused'
          : eventType === 'recovered'
          ? 'Account recovered above critical threshold'
          : `Risk tier changed from ${previousTier} to ${newTier}`,
    })
  }

  async getPersonalityTraits(accountId: string): Promise<PersonalityTraits | null> {
    const { data: account } = await supabase
      .from('ai_training_accounts')
      .select('risk_appetite, trade_frequency, adaptation_speed, personality_name')
      .eq('id', accountId)
      .maybeSingle()

    if (!account) return null

    return {
      riskAppetite: account.risk_appetite,
      tradeFrequency: account.trade_frequency,
      adaptationSpeed: account.adaptation_speed,
      personalityName: account.personality_name,
    }
  }

  calculatePersonalityBasedRisk(
    baseRiskPercent: number,
    personality: PersonalityTraits,
    riskStatus: AccountRiskStatus
  ): number {
    const appetiteMultiplier = personality.riskAppetite / 5

    let adjustedRisk = baseRiskPercent * appetiteMultiplier * riskStatus.riskMultiplier

    adjustedRisk = Math.max(0.5, Math.min(5.0, adjustedRisk))

    return adjustedRisk
  }

  shouldTakeTrade(
    oddsScore: number,
    personality: PersonalityTraits,
    riskStatus: AccountRiskStatus
  ): boolean {
    if (!riskStatus.canTrade) return false

    if (oddsScore < riskStatus.minOddsScore) return false

    const frequencyThreshold = 10 - personality.tradeFrequency

    const randomChance = Math.random() * 10
    if (randomChance < frequencyThreshold) return false

    return true
  }
}

export const bankruptcyProtection = new BankruptcyProtectionService()
