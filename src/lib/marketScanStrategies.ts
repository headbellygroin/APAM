import { listBaseStrategies } from '@/lib/strategies'

const STORAGE_KEY = 'apam.marketScanner.strategyIds.v1'

/** Default: scan with every registered base strategy in parallel. */
export function getDefaultScannerStrategyIds(): string[] {
  return listBaseStrategies().map((s) => s.id)
}

export function loadMarketScannerStrategyIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultScannerStrategyIds()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return getDefaultScannerStrategyIds()
    const valid = new Set(listBaseStrategies().map((s) => s.id))
    const filtered = parsed.filter((id): id is string => typeof id === 'string' && valid.has(id))
    return filtered.length > 0 ? filtered : getDefaultScannerStrategyIds()
  } catch {
    return getDefaultScannerStrategyIds()
  }
}

export function saveMarketScannerStrategyIds(ids: string[]): void {
  const unique = [...new Set(ids.filter(Boolean))]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unique))
}
