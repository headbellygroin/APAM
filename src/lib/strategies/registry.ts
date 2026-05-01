import { TradingStrategy, StrategyConfig, StrategyGuide } from './types'
import { tradeSurgeStrategy, tradeSurgeGuide } from './tradeSurge'
import { apamStrategy, apamGuide } from './apam'
import { fibonacciORStrategy, fibonacciORGuide } from './fibonacciOR'
import { wheelStrategy, wheelStrategyGuide } from './wheelStrategy'

export interface RegisteredStrategy {
  strategy: TradingStrategy
  guide: StrategyGuide
}

class StrategyRegistry {
  private strategies: Map<string, RegisteredStrategy> = new Map()
  private activeStrategyId: string = 'trade-surge'

  constructor() {
    this.register(tradeSurgeStrategy, tradeSurgeGuide)
    this.register(apamStrategy, apamGuide)
    this.register(fibonacciORStrategy, fibonacciORGuide)
    this.register(wheelStrategy, wheelStrategyGuide)
  }

  register(strategy: TradingStrategy, guide: StrategyGuide): void {
    this.strategies.set(strategy.config.id, { strategy, guide })
  }

  unregister(strategyId: string): boolean {
    if (strategyId === 'trade-surge') {
      console.warn('Cannot unregister the default Trade Surge strategy')
      return false
    }
    return this.strategies.delete(strategyId)
  }

  get(strategyId: string): RegisteredStrategy | undefined {
    return this.strategies.get(strategyId)
  }

  getActive(): RegisteredStrategy {
    const active = this.strategies.get(this.activeStrategyId)
    if (!active) {
      return this.strategies.get('trade-surge')!
    }
    return active
  }

  setActive(strategyId: string): boolean {
    if (!this.strategies.has(strategyId)) {
      console.error(`Strategy ${strategyId} not found`)
      return false
    }
    this.activeStrategyId = strategyId
    return true
  }

  getActiveId(): string {
    return this.activeStrategyId
  }

  list(): StrategyConfig[] {
    return Array.from(this.strategies.values()).map(r => r.strategy.config)
  }

  listWithGuides(): Array<{ config: StrategyConfig; guide: StrategyGuide }> {
    return Array.from(this.strategies.values()).map(r => ({
      config: r.strategy.config,
      guide: r.guide,
    }))
  }

  has(strategyId: string): boolean {
    return this.strategies.has(strategyId)
  }
}

export const strategyRegistry = new StrategyRegistry()

export function getActiveStrategy(): TradingStrategy {
  return strategyRegistry.getActive().strategy
}

export function getActiveGuide(): StrategyGuide {
  return strategyRegistry.getActive().guide
}

export function setActiveStrategy(strategyId: string): boolean {
  return strategyRegistry.setActive(strategyId)
}

export function listStrategies(): StrategyConfig[] {
  return strategyRegistry.list()
}

export function listBaseStrategies(): StrategyConfig[] {
  return strategyRegistry.list().filter(s => s.type === 'base')
}

export function listOverlayStrategies(): StrategyConfig[] {
  return strategyRegistry.list().filter(s => s.type === 'overlay')
}

export function registerStrategy(strategy: TradingStrategy, guide: StrategyGuide): void {
  strategyRegistry.register(strategy, guide)
}
