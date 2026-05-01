import { useState, useMemo } from 'react'
import { TrainingAccount } from '@/lib/trainingAccountService'
import {
  FamilyTree,
  LineageNode,
  LineageRecord,
  buildFamilyTree,
  getLineagePath,
  getDescendants,
  setLineageName,
} from '@/lib/lineageService'
import {
  GitBranch, ArrowUpCircle, Shield, Zap, ChevronDown, ChevronRight,
  Award, Eye, Clock, TrendingUp, X
} from 'lucide-react'

interface LineageTreeProps {
  accounts: TrainingAccount[]
  lineageRecords: LineageRecord[]
  onRefresh: () => void
}

export default function LineageTree({ accounts, lineageRecords, onRefresh }: LineageTreeProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [expandedGens, setExpandedGens] = useState<Set<number>>(new Set([0, 1, 2, 3]))
  const [namingId, setNamingId] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')

  const tree = useMemo(
    () => buildFamilyTree(accounts, lineageRecords),
    [accounts, lineageRecords]
  )

  const selectedDetail = selectedNode ? tree.nodes.get(selectedNode) : null
  const selectedAncestry = selectedNode ? getLineagePath(tree, selectedNode) : []
  const selectedDescendants = selectedNode ? getDescendants(tree, selectedNode) : []

  const toggleGen = (gen: number) => {
    const next = new Set(expandedGens)
    if (next.has(gen)) next.delete(gen)
    else next.add(gen)
    setExpandedGens(next)
  }

  const handleNameSave = async () => {
    if (!namingId || !nameInput.trim()) return
    await setLineageName(namingId, nameInput.trim())
    setNamingId(null)
    setNameInput('')
    onRefresh()
  }

  const genKeys = Array.from(tree.generations.keys()).sort((a, b) => a - b)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 text-xs text-slate-400">
          <span className="flex items-center space-x-1">
            <Shield className="h-3 w-3 text-blue-400" />
            <span>User Created</span>
          </span>
          <span className="flex items-center space-x-1">
            <Zap className="h-3 w-3 text-amber-400" />
            <span>Master Spawned</span>
          </span>
          <span className="flex items-center space-x-1">
            <ArrowUpCircle className="h-3 w-3 text-cyan-400" />
            <span>Promoted</span>
          </span>
          <span className="flex items-center space-x-1">
            <GitBranch className="h-3 w-3 text-green-400" />
            <span>Has Children</span>
          </span>
        </div>
        <span className="text-xs text-slate-500">{accounts.length} accounts | {tree.maxGeneration + 1} generations</span>
      </div>

      {genKeys.map(gen => {
        const nodeIds = tree.generations.get(gen) || []
        const nodes = nodeIds.map(id => tree.nodes.get(id)).filter((n): n is LineageNode => !!n)
        const isExpanded = expandedGens.has(gen)

        return (
          <div key={gen} className="bg-slate-800/50 rounded-lg border border-slate-700/50">
            <button
              onClick={() => toggleGen(gen)}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-700/30 transition-colors rounded-lg"
            >
              <div className="flex items-center space-x-2">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                <span className="text-sm font-medium text-white">
                  {gen === 0 ? 'Generation 0 -- Origin Fleet' : `Generation ${gen}`}
                </span>
                <span className="text-xs text-slate-500">({nodes.length} accounts)</span>
              </div>
              <GenStats nodes={nodes} />
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 space-y-1.5">
                {nodes.map(node => (
                  <NodeCard
                    key={node.accountId}
                    node={node}
                    tree={tree}
                    isSelected={selectedNode === node.accountId}
                    onSelect={() => setSelectedNode(selectedNode === node.accountId ? null : node.accountId)}
                    onNameClick={() => { setNamingId(node.accountId); setNameInput(node.lineageName || '') }}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {namingId && (
        <div className="bg-slate-800 rounded-lg border border-amber-700/30 p-4">
          <h4 className="text-sm font-medium text-amber-300 mb-2">Name This Account's Lineage</h4>
          <p className="text-xs text-slate-400 mb-3">
            This account has earned its own identity through performance. Give it a name that represents its evolution.
          </p>
          <div className="flex space-x-2">
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="e.g. Phoenix, Sentinel, Vanguard..."
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleNameSave}
              disabled={!nameInput.trim()}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setNamingId(null)}
              className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedDetail && (
        <AccountDetail
          node={selectedDetail}
          ancestry={selectedAncestry}
          descendants={selectedDescendants}
          tree={tree}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  )
}

function GenStats({ nodes }: { nodes: LineageNode[] }) {
  const active = nodes.filter(n => n.status !== 'stopped')
  const avgWR = active.length > 0
    ? active.reduce((s, n) => s + n.winRate, 0) / active.length : 0
  const totalPL = active.reduce((s, n) => s + n.totalPL, 0)

  return (
    <div className="flex items-center space-x-3 text-xs">
      <span className="text-slate-400">{active.length} active</span>
      <span className={avgWR >= 55 ? 'text-green-400' : avgWR >= 45 ? 'text-yellow-400' : 'text-red-400'}>
        {avgWR.toFixed(1)}% avg WR
      </span>
      <span className={totalPL >= 0 ? 'text-green-400' : 'text-red-400'}>
        ${totalPL.toFixed(0)} total P&L
      </span>
    </div>
  )
}

function NodeCard({ node, tree, isSelected, onSelect, onNameClick }: {
  node: LineageNode
  tree: FamilyTree
  isSelected: boolean
  onSelect: () => void
  onNameClick: () => void
}) {
  const originIcon = node.originType === 'master_spawned'
    ? <Zap className="h-3.5 w-3.5 text-amber-400" />
    : node.originType === 'promoted'
    ? <ArrowUpCircle className="h-3.5 w-3.5 text-cyan-400" />
    : <Shield className="h-3.5 w-3.5 text-blue-400" />

  const hasChildren = node.childIds.length > 0
  const parentNames = node.parentIds
    .map(pid => tree.nodes.get(pid)?.accountName || 'unknown')

  return (
    <div
      className={`rounded-lg p-3 border transition-all cursor-pointer ${
        isSelected
          ? 'bg-slate-700/60 border-amber-600/50'
          : node.status === 'stopped'
          ? 'bg-slate-900/30 border-slate-700/30 opacity-60'
          : 'bg-slate-900/50 border-slate-700/30 hover:border-slate-600'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          {originIcon}
          <span className="text-sm font-medium text-white">{node.accountName}</span>
          {node.lineageName && (
            <button
              onClick={e => { e.stopPropagation(); onNameClick() }}
              className="flex items-center space-x-1 bg-amber-900/30 text-amber-300 px-1.5 py-0.5 rounded text-xs hover:bg-amber-900/50 transition-colors"
            >
              <Award className="h-3 w-3" />
              <span>{node.lineageName}</span>
            </button>
          )}
          {!node.lineageName && node.totalTrades >= 50 && (
            <button
              onClick={e => { e.stopPropagation(); onNameClick() }}
              className="text-xs text-slate-500 hover:text-amber-400 transition-colors"
            >
              + name
            </button>
          )}
          {node.status === 'stopped' && (
            <span className="text-xs bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">retired</span>
          )}
          {node.isPromoted && (
            <span className="text-xs bg-cyan-900/30 text-cyan-300 px-1.5 py-0.5 rounded">promoted</span>
          )}
        </div>
        <div className="flex items-center space-x-2 text-xs">
          {hasChildren && (
            <span className="flex items-center space-x-1 text-green-400">
              <GitBranch className="h-3 w-3" />
              <span>{node.childIds.length}</span>
            </span>
          )}
          <span className="text-slate-500">{node.mode} / {node.strategyId}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex space-x-3 text-slate-400">
          <span className={node.winRate >= 55 ? 'text-green-400' : node.winRate >= 45 ? 'text-yellow-400' : 'text-red-400'}>
            {node.winRate.toFixed(1)}% WR
          </span>
          <span className={node.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}>
            ${node.totalPL.toFixed(0)}
          </span>
          <span>PF {node.profitFactor.toFixed(2)}</span>
          <span>{node.totalTrades} trades</span>
        </div>
        {parentNames.length > 0 && (
          <span className="text-slate-500 truncate max-w-[200px]">
            from: {parentNames.join(' + ')}
          </span>
        )}
      </div>
    </div>
  )
}

function AccountDetail({ node, ancestry, descendants, tree, onClose }: {
  node: LineageNode
  ancestry: LineageNode[]
  descendants: LineageNode[]
  tree: FamilyTree
  onClose: () => void
}) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Eye className="h-5 w-5 text-amber-400" />
          <h3 className="text-lg font-semibold text-white">
            {node.lineageName || node.accountName}
          </h3>
          {node.lineageName && (
            <span className="text-sm text-slate-400">({node.accountName})</span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-5">
        <StatBox label="Generation" value={`Gen ${node.generation}`} />
        <StatBox label="Win Rate" value={`${node.winRate.toFixed(1)}%`} color={node.winRate >= 55 ? 'green' : node.winRate >= 45 ? 'yellow' : 'red'} />
        <StatBox label="P&L" value={`$${node.totalPL.toFixed(0)}`} color={node.totalPL >= 0 ? 'green' : 'red'} />
        <StatBox label="Profit Factor" value={node.profitFactor.toFixed(2)} />
        <StatBox label="Trades" value={node.totalTrades.toString()} />
        <StatBox label="Max DD" value={`${node.maxDrawdown.toFixed(1)}%`} />
      </div>

      {ancestry.length > 1 && (
        <div className="mb-5">
          <h4 className="text-sm font-medium text-white mb-2 flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <span>Ancestry Path</span>
          </h4>
          <div className="flex items-center flex-wrap gap-1">
            {ancestry.map((ancestor, i) => (
              <div key={ancestor.accountId} className="flex items-center">
                <span className={`text-xs px-2 py-1 rounded ${
                  ancestor.accountId === node.accountId
                    ? 'bg-amber-900/40 text-amber-300 font-medium'
                    : 'bg-slate-900/50 text-slate-300'
                }`}>
                  {ancestor.lineageName || ancestor.accountName}
                  <span className="text-slate-500 ml-1">Gen {ancestor.generation}</span>
                </span>
                {i < ancestry.length - 1 && (
                  <span className="text-slate-600 mx-1">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {descendants.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-medium text-white mb-2 flex items-center space-x-2">
            <GitBranch className="h-4 w-4 text-green-400" />
            <span>Descendants ({descendants.length})</span>
          </h4>
          <div className="space-y-1">
            {descendants.map(d => (
              <div key={d.accountId} className="flex items-center justify-between text-xs bg-slate-900/50 rounded p-2">
                <div className="flex items-center space-x-2">
                  <span className="text-white">{d.lineageName || d.accountName}</span>
                  <span className="text-slate-500">Gen {d.generation}</span>
                  {d.status === 'stopped' && (
                    <span className="text-red-400/60">retired</span>
                  )}
                </div>
                <div className="flex space-x-3 text-slate-400">
                  <span className={d.winRate >= 55 ? 'text-green-400' : 'text-slate-400'}>
                    {d.winRate.toFixed(1)}% WR
                  </span>
                  <span className={d.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}>
                    ${d.totalPL.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {node.events.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-white mb-2 flex items-center space-x-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>Lineage Events</span>
          </h4>
          <div className="space-y-1">
            {node.events.map(event => {
              const parentNode = event.parent_account_id ? tree.nodes.get(event.parent_account_id) : null
              return (
                <div key={event.id} className="flex items-center justify-between text-xs bg-slate-900/50 rounded p-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${
                      event.event_type === 'spawn' ? 'bg-green-900/30 text-green-300' :
                      event.event_type === 'promote' ? 'bg-cyan-900/30 text-cyan-300' :
                      event.event_type === 'evolve' ? 'bg-teal-900/30 text-teal-300' :
                      'bg-blue-900/30 text-blue-300'
                    }`}>
                      {event.event_type}
                    </span>
                    <span className="text-slate-300">{event.notes}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {parentNode && (
                      <span className="text-slate-500">from {parentNode.lineageName || parentNode.accountName}</span>
                    )}
                    <span className="text-slate-600">{new Date(event.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorClass = color === 'green' ? 'text-green-400'
    : color === 'red' ? 'text-red-400'
    : color === 'yellow' ? 'text-yellow-400'
    : 'text-white'

  return (
    <div className="bg-slate-900/60 rounded-lg p-2.5 text-center">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}
