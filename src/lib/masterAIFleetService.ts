import { supabase } from './supabase'
import { createSimulationRun, CreateRunParams } from './historicalFleetService'

export interface MasterAIFleetRun {
  id: string
  user_id: string
  run_id: string
  generation_number: number
  fleet_label: string
  source_type: 'user_pool' | 'self_generated' | 'hybrid'
  parent_generation_id: string | null
  ruleset_source: Record<string, any>
  improvement_vs_parent: Record<string, any>
  notes: string
  created_at: string
  updated_at: string
}

export interface MasterAIFleetGeneration {
  id: string
  user_id: string
  generation_number: number
  label: string
  description: string
  run_ids: string[]
  best_account_configs: Array<Record<string, any>>
  avg_win_rate: number
  avg_profit_factor: number
  top_strategy: string
  top_mode: string
  what_improved: string
  ruleset_changes: Array<Record<string, any>>
  promoted_to_live: boolean
  created_at: string
  updated_at: string
  runs?: MasterAIFleetRun[]
}

export interface CreateMasterFleetParams {
  generationLabel: string
  description: string
  sourceType: 'user_pool' | 'self_generated' | 'hybrid'
  parentGenerationId?: string
  runParams: CreateRunParams
  notes?: string
}

export async function getMasterAIGenerations(userId: string): Promise<MasterAIFleetGeneration[]> {
  const { data } = await supabase
    .from('master_ai_fleet_generations')
    .select('*')
    .eq('user_id', userId)
    .order('generation_number', { ascending: false })

  return (data || []) as MasterAIFleetGeneration[]
}

export async function getMasterAIFleetRuns(userId: string, generationNumber?: number): Promise<MasterAIFleetRun[]> {
  let query = supabase
    .from('master_ai_fleet_runs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (generationNumber !== undefined) {
    query = query.eq('generation_number', generationNumber)
  }

  const { data } = await query
  return (data || []) as MasterAIFleetRun[]
}

export async function getNextGenerationNumber(userId: string): Promise<number> {
  const { data } = await supabase
    .from('master_ai_fleet_generations')
    .select('generation_number')
    .eq('user_id', userId)
    .order('generation_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? (data.generation_number as number) + 1 : 1
}

export async function createMasterAIFleetRun(
  userId: string,
  params: CreateMasterFleetParams
): Promise<{ generation: MasterAIFleetGeneration; fleetRun: MasterAIFleetRun } | null> {
  const genNumber = await getNextGenerationNumber(userId)

  const { data: gen, error: genError } = await supabase
    .from('master_ai_fleet_generations')
    .insert({
      user_id: userId,
      generation_number: genNumber,
      label: params.generationLabel,
      description: params.description,
      run_ids: [],
      best_account_configs: [],
    })
    .select()
    .maybeSingle()

  if (genError || !gen) return null

  const simRun = await createSimulationRun(userId, params.runParams)
  if (!simRun) return null

  const { data: fleetRun, error: frError } = await supabase
    .from('master_ai_fleet_runs')
    .insert({
      user_id: userId,
      run_id: simRun.id,
      generation_number: genNumber,
      fleet_label: params.generationLabel,
      source_type: params.sourceType,
      parent_generation_id: params.parentGenerationId || null,
      ruleset_source: { runName: params.runParams.name, accounts: params.runParams.accounts.length },
      notes: params.notes || '',
    })
    .select()
    .maybeSingle()

  if (frError || !fleetRun) return null

  await supabase
    .from('master_ai_fleet_generations')
    .update({ run_ids: [simRun.id] })
    .eq('id', gen.id)

  return {
    generation: gen as MasterAIFleetGeneration,
    fleetRun: fleetRun as MasterAIFleetRun,
  }
}

export async function updateGenerationResults(
  generationId: string,
  results: {
    avgWinRate: number
    avgProfitFactor: number
    topStrategy: string
    topMode: string
    whatImproved: string
    bestAccountConfigs: Array<Record<string, any>>
    rulesetChanges: Array<Record<string, any>>
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('master_ai_fleet_generations')
    .update({
      avg_win_rate: results.avgWinRate,
      avg_profit_factor: results.avgProfitFactor,
      top_strategy: results.topStrategy,
      top_mode: results.topMode,
      what_improved: results.whatImproved,
      best_account_configs: results.bestAccountConfigs,
      ruleset_changes: results.rulesetChanges,
      updated_at: new Date().toISOString(),
    })
    .eq('id', generationId)

  return !error
}

export async function promoteGenerationToLive(generationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('master_ai_fleet_generations')
    .update({ promoted_to_live: true, updated_at: new Date().toISOString() })
    .eq('id', generationId)

  return !error
}

export async function getUserPoolWeights(userId: string): Promise<Record<string, any>> {
  const { data: accounts } = await supabase
    .from('paper_trading_accounts')
    .select('ai_state, total_trades, win_rate')
    .eq('user_id', userId)
    .gt('total_trades', 20)

  if (!accounts || accounts.length === 0) return {}

  const combined: Record<string, number[]> = {}
  for (const acct of accounts) {
    if (!acct.ai_state?.learnedWeights) continue
    for (const [key, val] of Object.entries(acct.ai_state.learnedWeights as Record<string, number>)) {
      if (!combined[key]) combined[key] = []
      combined[key].push(val)
    }
  }

  const averaged: Record<string, number> = {}
  for (const [key, vals] of Object.entries(combined)) {
    averaged[key] = vals.reduce((a, b) => a + b, 0) / vals.length
  }

  return averaged
}

export async function buildMasterAIDefaultFleet(accounts: number = 10): Promise<Array<CreateRunParams['accounts'][0]>> {
  const strategies = ['trade-surge', 'apam']
  const modes: Array<'strict' | 'adaptive'> = ['strict', 'adaptive']
  const configs: Array<CreateRunParams['accounts'][0]> = []

  const variations = [
    { risk: 1, maxPos: 3 },
    { risk: 1.5, maxPos: 3 },
    { risk: 2, maxPos: 4 },
    { risk: 1, maxPos: 5 },
    { risk: 0.5, maxPos: 3 },
  ]

  let idx = 0
  for (const strategy of strategies) {
    for (const mode of modes) {
      for (const v of variations) {
        if (idx >= accounts) break
        const suffix = mode === 'strict' ? 'Strict' : 'Adaptive'
        const stratLabel = strategy === 'trade-surge' ? 'TradeSurge' : 'APAM'
        configs.push({
          name: `MasterAI-${stratLabel}-${suffix}-${idx + 1}`,
          accountType: mode === 'strict' ? 'control' : 'experimental',
          strategyId: strategy,
          mode,
          startingCapital: 50000,
          riskPerTrade: v.risk,
          maxPositions: v.maxPos,
        })
        idx++
      }
    }
  }

  return configs.slice(0, accounts)
}
