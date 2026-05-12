/**
 * PrimaryCard — Full entity profile card
 *
 * Source of truth: DESIGN-SPEC.md Section 6 (Primary Card Anatomy)
 * Lock/unlock toggle, category badge, metrics, definition, roles, connections, chains, similar
 */

import { useState } from 'react'
import { useSelectionStore } from '../../stores/selection-store'
import { useGraphStore } from '../../stores/graph-store'
import { useUIStore } from '../../stores/ui-store'
import { CATEGORY_COLORS, BRIDGE_COLORS } from '../../constants/colors'
import type { EntityDetail, GraphNode } from '../../types/graph'
import MetricBar from './MetricBar'
import { resolveSourceUrl } from '../../utils/paths'
import ConnectionList from './ConnectionList'
import HopControl from './HopControl'

interface Props {
  node: GraphNode
  detail: EntityDetail
}

export default function PrimaryCard({ node, detail }: Props) {
  const lockedNode = useSelectionStore(s => s.lockedNode)
  const lockNode = useSelectionStore(s => s.lockNode)
  const unlockNode = useSelectionStore(s => s.unlockNode)
  const hopRadius = useSelectionStore(s => s.hopRadius)
  const setHopRadius = useSelectionStore(s => s.setHopRadius)
  const navigateTo = useSelectionStore(s => s.navigateTo)
  const selectNode = useSelectionStore(s => s.selectNode)

  const allNodes = useGraphStore(s => s.allNodes)
  const projects = useGraphStore(s => s.projects)

  const isLocked = lockedNode?.name === node.name

  // Collect all metric values for percentile computation
  const entities = allNodes.filter(n => n.__type === 'entity')
  const allPageRanks = entities.map(n => n.pageRank)
  const allBetweenness = entities.map(n => n.betweenness)

  // Sections collapsed by default
  const [rolesOpen, setRolesOpen] = useState(false)
  const [connectionsOpen, setConnectionsOpen] = useState(false)
  const [chainsOpen, setChainsOpen] = useState(false)
  const [similarOpen, setSimilarOpen] = useState(false)

  // Roles: all collapsed by default
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set()
  )

  const toggleProject = (uid: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  // Handle connection click
  const handleConnectionClick = (entityName: string) => {
    const targetNode = allNodes.find(n => n.name === entityName)
    if (!targetNode) return
    if (isLocked) {
      selectNode(targetNode) // adds exploration card
    } else {
      navigateTo(entityName)
    }
  }

  const categoryColor = CATEGORY_COLORS[detail.category] || '#6B7280'
  const bridgeColor = BRIDGE_COLORS[node.__bridgeTier] || 'transparent'

  // Chain links grouped by chain
  const chainGroups = new Map<string, typeof detail.chainLinks>()
  for (const cl of detail.chainLinks) {
    const list = chainGroups.get(cl.chainName) || []
    list.push(cl)
    chainGroups.set(cl.chainName, list)
  }

  return (
    <div className="space-y-3">
      {/* Header: Lock + Name + Category */}
      <div className="flex items-start gap-2">
        <button
          onClick={() => isLocked ? unlockNode() : lockNode()}
          className="mt-0.5 text-sm"
          title={isLocked ? 'Unlock' : 'Lock'}
          style={{ color: isLocked ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          {isLocked ? '🔒' : '🔓'}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: categoryColor + '20', color: categoryColor }}
            >
              {detail.category}
            </span>
            {node.__bridgeTier !== 'none' && (
              <span
                className="px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: bridgeColor + '20', color: bridgeColor }}
              >
                {node.__bridgeTier.toUpperCase()}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
            {detail.name}
          </h3>
          {detail.aliases.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Also: {detail.aliases.join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-1.5" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <MetricBar
          label="Influence"
          value={detail.pageRank}
          allValues={allPageRanks}
          tooltip="How central this entity is across all connections"
        />
        <MetricBar
          label="Bridge Score"
          value={detail.betweenness}
          allValues={allBetweenness}
          tooltip="How often this entity sits on shortest paths between others"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs w-24 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Connections</span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{detail.degree}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs w-24 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Cross-Document</span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {detail.projectCount} project{detail.projectCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Definition */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {detail.definition}
        </p>
      </div>

      {/* Hop Control */}
      <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <HopControl hops={hopRadius} onChange={setHopRadius} />
      </div>

      {/* Roles by Project — collapsed by default */}
      {detail.projects.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <button
            onClick={() => setRolesOpen(!rolesOpen)}
            className="w-full flex items-center gap-1 text-left"
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {rolesOpen ? '▼' : '▶'}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Roles by Project ({detail.projects.length})
            </span>
          </button>
          {rolesOpen && (
            <div className="space-y-1 mt-2">
              {detail.projects.map(proj => {
                const isExpanded = expandedProjects.has(proj.uniqueId)
                const projSummary = projects.find(p => p.uniqueId === proj.uniqueId)
                return (
                  <div key={proj.uniqueId}>
                    <div className="flex items-center gap-1 py-0.5">
                      <button
                        onClick={() => toggleProject(proj.uniqueId)}
                        className="flex items-center gap-1 text-left flex-1 min-w-0"
                      >
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                        <span className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                          {proj.name}
                        </span>
                      </button>
                      {projSummary?.htmlPath && (
                        <a
                          href={resolveSourceUrl(projSummary.htmlPath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-xs px-1 rounded hover:brightness-125"
                          style={{ color: 'var(--accent)' }}
                          title="Open source document"
                          onClick={e => e.stopPropagation()}
                        >
                          ↗
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const projectNode = allNodes.find(n => n.__type === 'project' && n.id === proj.uniqueId)
                          if (projectNode) {
                            selectNode(projectNode)
                            const zoomToNode = useUIStore.getState().zoomToNode
                            zoomToNode?.(projectNode.id)
                          }
                        }}
                        className="flex-shrink-0 text-xs px-1 rounded hover:brightness-125"
                        style={{ color: 'var(--text-secondary)' }}
                        title="Navigate to project on graph"
                      >
                        ⊕
                      </button>
                    </div>
                    {isExpanded && proj.role && (
                      <div className="ml-4 mt-0.5 mb-1">
                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}
                        >
                          "{proj.role}"
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Connections — collapsed by default */}
      {detail.relationships.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <button
            onClick={() => setConnectionsOpen(!connectionsOpen)}
            className="w-full flex items-center gap-1 text-left"
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {connectionsOpen ? '▼' : '▶'}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Connections ({detail.relationships.length})
            </span>
          </button>
          {connectionsOpen && (
            <div className="max-h-48 overflow-y-auto mt-2">
              <ConnectionList
                connections={detail.relationships}
                onConnectionClick={handleConnectionClick}
              />
            </div>
          )}
        </div>
      )}

      {/* Causal Chains — collapsed by default */}
      {chainGroups.size > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <button
            onClick={() => setChainsOpen(!chainsOpen)}
            className="w-full flex items-center gap-1 text-left"
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {chainsOpen ? '▼' : '▶'}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Causal Chains ({chainGroups.size})
            </span>
          </button>
          {chainsOpen && (
            <div className="mt-1">
              <CausalChainsList chains={chainGroups} />
            </div>
          )}
        </div>
      )}

      {/* Similar Entities — collapsed by default */}
      {detail.similarEntities.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <button
            onClick={() => setSimilarOpen(!similarOpen)}
            className="w-full flex items-center gap-1 text-left"
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {similarOpen ? '▼' : '▶'}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Similar Entities ({detail.similarEntities.length})
            </span>
          </button>
          {similarOpen && (
            <div className="space-y-0.5 mt-1">
              {detail.similarEntities.slice(0, 5).map(sim => (
                <button
                  key={sim.name}
                  onClick={() => handleConnectionClick(sim.name)}
                  className="w-full flex items-center justify-between py-0.5 text-left"
                >
                  <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {sim.name}
                  </span>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {(sim.similarity * 100).toFixed(0)}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Causal chain items — already inside a collapsible section */
function CausalChainsList({ chains }: { chains: Map<string, Array<{ chainName: string; linkedEntity: string; orderIndex: number; explanation: string }>> }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const setHighlightedChain = useGraphStore(s => s.setHighlightedChain)
  const clearChain = useGraphStore(s => s.clearChain)

  const handleToggle = (name: string, links: Array<{ chainName: string; linkedEntity: string; orderIndex: number; explanation: string }>) => {
    if (expanded === name) {
      setExpanded(null)
      clearChain()
    } else {
      setExpanded(name)
      const chainEntities = new Set<string>()
      for (const link of links) {
        chainEntities.add(link.linkedEntity)
      }
      setHighlightedChain([...chainEntities])
    }
  }

  return (
    <div>
      {Array.from(chains.entries()).map(([name, links]) => (
        <div key={name}>
          <button
            onClick={() => handleToggle(name, links)}
            className="w-full flex items-center gap-1 py-0.5 text-left"
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {expanded === name ? '▼' : '▶'}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {name} ({links.length} links)
            </span>
          </button>
          {expanded === name && (
            <div className="ml-4 space-y-1 mb-1">
              {links.sort((a, b) => a.orderIndex - b.orderIndex).map((link, i) => (
                <div key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  → {link.linkedEntity}: {link.explanation}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
