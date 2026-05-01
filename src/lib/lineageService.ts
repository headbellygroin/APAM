import { supabase } from './supabase'
import { TrainingAccount } from './trainingAccountService'

export interface LineageRecord {
  id: string
  user_id: string
  account_id: string
  parent_account_id: string | null
  event_type: 'spawn' | 'promote' | 'evolve' | 'create'
  generation: number
  blend_weight: number
  performance_snapshot: {
    winRate?: number
    profitFactor?: number
    totalPL?: number
    totalTrades?: number
    maxDrawdown?: number
  }
  notes: string
  created_at: string
}

export interface LineageNode {
  accountId: string
  accountName: string
  lineageName: string | null
  generation: number
  originType: string
  status: string
  mode: string
  strategyId: string
  winRate: number
  profitFactor: number
  totalPL: number
  totalTrades: number
  maxDrawdown: number
  isSpawned: boolean
  isPromoted: boolean
  parentIds: string[]
  childIds: string[]
  events: LineageRecord[]
}

export interface FamilyTree {
  nodes: Map<string, LineageNode>
  roots: string[]
  generations: Map<number, string[]>
  maxGeneration: number
}

export async function recordLineageEvent(
  userId: string,
  accountId: string,
  parentAccountId: string | null,
  eventType: 'spawn' | 'promote' | 'evolve' | 'create',
  generation: number,
  blendWeight: number,
  performanceSnapshot: Record<string, number>,
  notes: string
): Promise<void> {
  await supabase.from('ai_account_lineage').insert({
    user_id: userId,
    account_id: accountId,
    parent_account_id: parentAccountId,
    event_type: eventType,
    generation,
    blend_weight: blendWeight,
    performance_snapshot: performanceSnapshot,
    notes,
  })
}

export async function recordSpawnLineage(
  userId: string,
  spawnedAccountId: string,
  parentAccounts: TrainingAccount[],
  generation: number
): Promise<void> {
  const totalScore = parentAccounts.length
  for (let i = 0; i < parentAccounts.length; i++) {
    const parent = parentAccounts[i]
    const weight = 1 / totalScore
    await recordLineageEvent(
      userId,
      spawnedAccountId,
      parent.id,
      'spawn',
      generation,
      weight,
      {
        winRate: parent.win_rate,
        profitFactor: parent.profit_factor,
        totalPL: parent.total_profit_loss,
        totalTrades: parent.total_trades,
        maxDrawdown: parent.max_drawdown,
      },
      `Blended from ${parent.name} (${parent.win_rate.toFixed(1)}% WR, Gen ${parent.generation || 0})`
    )
  }
}

export async function recordPromotionLineage(
  userId: string,
  promotedAccountId: string,
  replacedAccount: TrainingAccount,
  promotedAccount: TrainingAccount
): Promise<void> {
  await recordLineageEvent(
    userId,
    promotedAccountId,
    null,
    'promote',
    promotedAccount.generation || 0,
    1.0,
    {
      winRate: promotedAccount.win_rate,
      profitFactor: promotedAccount.profit_factor,
      totalPL: promotedAccount.total_profit_loss,
      totalTrades: promotedAccount.total_trades,
      maxDrawdown: promotedAccount.max_drawdown,
      replacedWinRate: replacedAccount.win_rate,
      replacedTotalPL: replacedAccount.total_profit_loss,
    },
    `Promoted to base fleet, replacing ${replacedAccount.name} (${replacedAccount.win_rate.toFixed(1)}% WR -> ${promotedAccount.win_rate.toFixed(1)}% WR)`
  )
}

export async function getLineageRecords(userId: string): Promise<LineageRecord[]> {
  const { data } = await supabase
    .from('ai_account_lineage')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  return (data || []) as LineageRecord[]
}

export function buildFamilyTree(
  accounts: TrainingAccount[],
  lineageRecords: LineageRecord[]
): FamilyTree {
  const nodes = new Map<string, LineageNode>()
  const parentToChildren = new Map<string, Set<string>>()

  for (const account of accounts) {
    const node: LineageNode = {
      accountId: account.id,
      accountName: account.name,
      lineageName: account.lineage_name,
      generation: account.generation || 0,
      originType: account.origin_type || 'user_created',
      status: account.status,
      mode: account.mode,
      strategyId: account.strategy_id,
      winRate: account.win_rate,
      profitFactor: account.profit_factor,
      totalPL: account.total_profit_loss,
      totalTrades: account.total_trades,
      maxDrawdown: account.max_drawdown,
      isSpawned: account.spawned_by_master,
      isPromoted: account.promoted_from_spawned || false,
      parentIds: account.parent_account_ids || [],
      childIds: [],
      events: [],
    }
    nodes.set(account.id, node)

    for (const parentId of node.parentIds) {
      if (!parentToChildren.has(parentId)) {
        parentToChildren.set(parentId, new Set())
      }
      parentToChildren.get(parentId)!.add(account.id)
    }
  }

  for (const record of lineageRecords) {
    const node = nodes.get(record.account_id)
    if (node) {
      node.events.push(record)
    }

    if (record.parent_account_id) {
      if (!parentToChildren.has(record.parent_account_id)) {
        parentToChildren.set(record.parent_account_id, new Set())
      }
      parentToChildren.get(record.parent_account_id)!.add(record.account_id)

      const childNode = nodes.get(record.account_id)
      if (childNode && !childNode.parentIds.includes(record.parent_account_id)) {
        childNode.parentIds.push(record.parent_account_id)
      }
    }
  }

  for (const [parentId, children] of parentToChildren) {
    const parentNode = nodes.get(parentId)
    if (parentNode) {
      parentNode.childIds = [...children]
    }
  }

  const roots: string[] = []
  const generations = new Map<number, string[]>()
  let maxGeneration = 0

  for (const [id, node] of nodes) {
    if (node.parentIds.length === 0 || node.parentIds.every(pid => !nodes.has(pid))) {
      roots.push(id)
    }

    const gen = node.generation
    if (!generations.has(gen)) {
      generations.set(gen, [])
    }
    generations.get(gen)!.push(id)
    if (gen > maxGeneration) maxGeneration = gen
  }

  return { nodes, roots, generations, maxGeneration }
}

export function getLineagePath(tree: FamilyTree, accountId: string): LineageNode[] {
  const path: LineageNode[] = []
  const visited = new Set<string>()

  function walkUp(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const node = tree.nodes.get(id)
    if (!node) return

    for (const parentId of node.parentIds) {
      walkUp(parentId)
    }
    path.push(node)
  }

  walkUp(accountId)
  return path
}

export function getDescendants(tree: FamilyTree, accountId: string): LineageNode[] {
  const descendants: LineageNode[] = []
  const visited = new Set<string>()

  function walkDown(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const node = tree.nodes.get(id)
    if (!node) return

    for (const childId of node.childIds) {
      const child = tree.nodes.get(childId)
      if (child) {
        descendants.push(child)
        walkDown(childId)
      }
    }
  }

  walkDown(accountId)
  return descendants
}

export async function setLineageName(accountId: string, name: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_training_accounts')
    .update({ lineage_name: name, updated_at: new Date().toISOString() })
    .eq('id', accountId)

  return !error
}
