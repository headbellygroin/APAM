export interface FeeSchedule {
  commissionPerShare: number
  minCommission: number
  maxCommissionPercent: number
  secFeeRate: number
  tafFeeRate: number
  tafFeeMax: number
  ecnFeePerShare: number
}

export interface FeeBreakdown {
  commission: number
  secFee: number
  tafFee: number
  ecnFee: number
  totalFees: number
}

export const DEFAULT_FEE_SCHEDULE: FeeSchedule = {
  commissionPerShare: 0.005,
  minCommission: 1.00,
  maxCommissionPercent: 1.0,
  secFeeRate: 0.0000278,
  tafFeeRate: 0.000166,
  tafFeeMax: 8.30,
  ecnFeePerShare: 0.003,
}

export const ZERO_FEE_SCHEDULE: FeeSchedule = {
  commissionPerShare: 0,
  minCommission: 0,
  maxCommissionPercent: 0,
  secFeeRate: 0,
  tafFeeRate: 0,
  tafFeeMax: 0,
  ecnFeePerShare: 0,
}

export function calculateEntryFees(
  shares: number,
  pricePerShare: number,
  schedule: FeeSchedule = DEFAULT_FEE_SCHEDULE
): FeeBreakdown {
  const tradeValue = shares * pricePerShare

  let commission = Math.max(
    schedule.minCommission,
    shares * schedule.commissionPerShare
  )
  const maxComm = tradeValue * (schedule.maxCommissionPercent / 100)
  if (maxComm > 0) {
    commission = Math.min(commission, maxComm)
  }

  const ecnFee = shares * schedule.ecnFeePerShare

  return {
    commission: round(commission),
    secFee: 0,
    tafFee: 0,
    ecnFee: round(ecnFee),
    totalFees: round(commission + ecnFee),
  }
}

export function calculateExitFees(
  shares: number,
  pricePerShare: number,
  schedule: FeeSchedule = DEFAULT_FEE_SCHEDULE
): FeeBreakdown {
  const tradeValue = shares * pricePerShare

  let commission = Math.max(
    schedule.minCommission,
    shares * schedule.commissionPerShare
  )
  const maxComm = tradeValue * (schedule.maxCommissionPercent / 100)
  if (maxComm > 0) {
    commission = Math.min(commission, maxComm)
  }

  const secFee = Math.max(0.01, round(tradeValue * schedule.secFeeRate))

  const tafFee = Math.min(
    schedule.tafFeeMax,
    Math.max(0.01, round(shares * schedule.tafFeeRate))
  )

  const ecnFee = shares * schedule.ecnFeePerShare

  return {
    commission: round(commission),
    secFee: round(secFee),
    tafFee: round(tafFee),
    ecnFee: round(ecnFee),
    totalFees: round(commission + secFee + tafFee + ecnFee),
  }
}

export function calculateRoundTripFees(
  shares: number,
  entryPrice: number,
  exitPrice: number,
  schedule: FeeSchedule = DEFAULT_FEE_SCHEDULE
): { entry: FeeBreakdown; exit: FeeBreakdown; totalFees: number } {
  const entry = calculateEntryFees(shares, entryPrice, schedule)
  const exit = calculateExitFees(shares, exitPrice, schedule)

  return {
    entry,
    exit,
    totalFees: round(entry.totalFees + exit.totalFees),
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
