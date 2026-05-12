/**
 * ProjectCard — Rich project detail card
 *
 * Source of truth: DESIGN-SPEC.md Section 6 (Project Card)
 * Lock/unlock, collapsible summary, entity list, causal chains,
 * cross-project bridges, HTML source link.
 */

import { useState, useEffect, useMemo } from 'react'
import { useSelectionStore } from '../../stores/selection-store'
import { useGraphStore } from '../../stores/graph-store'
import { fetchCausalChains } from '../../services/queries'
import { CATEGORY_COLORS } from '../../constants/colors'
import type { ProjectSummary, CausalChain, GraphNode } from '../../types/graph'
import { resolveSourceUrl } from '../../utils/paths'

interface Props {
  project: ProjectSummary
}

export default function ProjectCard({ project }: Props) {
  const allNodes = useGraphStore(s => s.allNodes)
  const allLinks = useGraphStore(s => s.allLinks)
  const projects = useGraphStore(s => s.projects)

  const lockedNode = useSelectionStore(s => s.lockedNode)
  const lockNode = useSelectionStore(s => s.lockNode)
  const unlockNode = useSelectionStore(s => s.unlockNode)
  const navigateTo = useSelectionStore(s => s.navigateTo)

  const isLocked = lockedNode?.id === project.uniqueId

  // Section toggles — all collapsed by default
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [entitiesOpen, setEntitiesOpen] = useState(false)
  const [chainsOpen, setChainsOpen] = useState(false)
  const [bridgesOpen, setBridgesOpen] = useState(false)

  // Causal chains (fetched on demand)
  const [chains, setChains] = useState<CausalChain[]>([])
  const [chainsLoaded, setChainsLoaded] = useState(false)
  const [expandedChain, setExpandedChain] = useState<string | null>(null)
  const setHighlightedChain = useGraphStore(s => s.setHighlightedChain)
  const clearChain = useGraphStore(s => s.clearChain)

  useEffect(() => {
    if (chainsOpen && !chainsLoaded) {
      fetchCausalChains(project.uniqueId)
        .then(setChains)
        .catch(err => console.error('Failed to fetch chains:', err))
        .finally(() => setChainsLoaded(true))
    }
  }, [chainsOpen, chainsLoaded, project.uniqueId])

  // Entities in this project (sorted by importance)
  const projectEntities = useMemo(() =>
    allNodes
      .filter(n => n.__type === 'entity' && n.__projects.includes(project.uniqueId))
      .sort((a, b) => b.__compositeImportance - a.__compositeImportance),
    [allNodes, project.uniqueId]
  )

  // Edges in this project: RELATES_TO edges where BOTH endpoints are entities in this project
  const edgeCount = useMemo(() => {
    const entityIds = new Set(projectEntities.map(n => n.id))
    return allLinks.filter(l => {
      if (l.causalClassification === 'MENTIONED_IN') return false
      const srcId = typeof l.source === 'string' ? l.source : (l.source as { id?: string })?.id
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as { id?: string })?.id
      return entityIds.has(srcId || '') && entityIds.has(tgtId || '')
    }).length
  }, [allLinks, projectEntities])

  // Bridge entities: entities in THIS project that also appear in OTHER projects
  const bridgeData = useMemo(() => {
    const bridges: Array<{
      entity: GraphNode
      otherProjects: ProjectSummary[]
    }> = []

    for (const entity of projectEntities) {
      if (entity.__projects.length > 1) {
        const others = entity.__projects
          .filter(pid => pid !== project.uniqueId)
          .map(pid => projects.find(p => p.uniqueId === pid))
          .filter((p): p is ProjectSummary => p != null)
        if (others.length > 0) {
          bridges.push({ entity, otherProjects: others })
        }
      }
    }
    return bridges.sort((a, b) => b.otherProjects.length - a.otherProjects.length)
  }, [projectEntities, project.uniqueId, projects])

  // Connected projects (unique, via bridges)
  const connectedProjects = useMemo(() => {
    const seen = new Set<string>()
    const result: ProjectSummary[] = []
    for (const b of bridgeData) {
      for (const p of b.otherProjects) {
        if (!seen.has(p.uniqueId)) {
          seen.add(p.uniqueId)
          result.push(p)
        }
      }
    }
    return result
  }, [bridgeData])

  const handleEntityClick = (entityName: string) => {
    navigateTo(entityName)
  }

  return (
    <div className="space-y-3">
      {/* Header: Lock + Name */}
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
          <div className="flex items-center gap-1.5">
            <span
              className="px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: '#a1a1aa20', color: '#a1a1aa' }}
            >
              Project
            </span>
          </div>
          <h3 className="text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
            {project.htmlPath ? (
              <a
                href={resolveSourceUrl(project.htmlPath)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: 'var(--text-primary)' }}
              >
                {project.name} <span style={{ color: 'var(--accent)', fontSize: '0.75rem' }}>↗</span>
              </a>
            ) : (
              project.name
            )}
          </h3>
          {(project.domain || project.subdomain) && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {[project.domain, project.subdomain].filter(Boolean).join(' > ')}
            </p>
          )}
        </div>
      </div>

      {/* Tags */}
      {project.baseTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {project.baseTags.map(tag => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats bar */}
      <div
        className="flex gap-4"
        style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}
      >
        <div className="text-center">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{projectEntities.length}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Entities</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{edgeCount}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Edges</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{bridgeData.length}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Bridges</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{connectedProjects.length}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Linked</div>
        </div>
      </div>

      {/* Summary — collapsible */}
      {project.summary && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <button
            onClick={() => setSummaryOpen(!summaryOpen)}
            className="w-full flex items-center gap-1 text-left"
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {summaryOpen ? '▼' : '▶'}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Summary
            </span>
          </button>
          {summaryOpen && (
            <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--text-secondary)' }}>
              {project.summary}
            </p>
          )}
        </div>
      )}

      {/* Entities — collapsible, top 20 by importance */}
      {projectEntities.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <button
            onClick={() => setEntitiesOpen(!entitiesOpen)}
            className="w-full flex items-center gap-1 text-left"
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {entitiesOpen ? '▼' : '▶'}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Entities ({projectEntities.length})
            </span>
          </button>
          {entitiesOpen && (
            <div className="max-h-48 overflow-y-auto mt-1 space-y-0.5">
              {projectEntities.slice(0, 30).map(entity => {
                const catColor = CATEGORY_COLORS[entity.category] || '#6B7280'
                return (
                  <button
                    key={entity.id}
                    onClick={() => handleEntityClick(entity.name)}
                    className="w-full flex items-center gap-1.5 py-0.5 text-left"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: catColor }}
                    />
                    <span className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>
                      {entity.name}
                    </span>
                    {entity.__bridgeTier !== 'none' && (
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {entity.__bridgeTier === 'gold' ? '◉' : entity.__bridgeTier === 'silver' ? '◎' : '○'}
                      </span>
                    )}
                  </button>
                )
              })}
              {projectEntities.length > 30 && (
                <div className="text-xs py-0.5" style={{ color: 'var(--text-muted)' }}>
                  +{projectEntities.length - 30} more
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Causal Chains — collapsible, fetched on demand */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <button
          onClick={() => setChainsOpen(!chainsOpen)}
          className="w-full flex items-center gap-1 text-left"
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {chainsOpen ? '▼' : '▶'}
          </span>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Causal Chains {chainsLoaded ? `(${chains.length})` : ''}
          </span>
        </button>
        {chainsOpen && (
          <div className="mt-1">
            {!chainsLoaded && (
              <div className="text-xs py-1" style={{ color: 'var(--text-muted)' }}>Loading...</div>
            )}
            {chainsLoaded && chains.length === 0 && (
              <div className="text-xs py-1" style={{ color: 'var(--text-muted)' }}>No causal chains</div>
            )}
            {chains.map(chain => (
              <div key={chain.chainId}>
                <button
                  onClick={() => {
                    if (expandedChain === chain.chainId) {
                      setExpandedChain(null)
                      clearChain()
                    } else {
                      setExpandedChain(chain.chainId)
                      const chainEntities = new Set<string>()
                      for (const link of chain.links) {
                        chainEntities.add(link.fromEntity)
                        chainEntities.add(link.toEntity)
                      }
                      setHighlightedChain([...chainEntities])
                    }
                  }}
                  className="w-full flex items-center gap-1 py-0.5 text-left"
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {expandedChain === chain.chainId ? '▼' : '▶'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {chain.name} ({chain.links.length} links)
                  </span>
                </button>
                {expandedChain === chain.chainId && (
                  <div className="ml-4 space-y-1 mb-1">
                    {chain.description && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {chain.description}
                      </p>
                    )}
                    {chain.links.map((link, i) => (
                      <div key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        <button
                          onClick={() => handleEntityClick(link.fromEntity)}
                          className="hover:underline"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {link.fromEntity}
                        </button>
                        {' → '}
                        <button
                          onClick={() => handleEntityClick(link.toEntity)}
                          className="hover:underline"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {link.toEntity}
                        </button>
                        {link.explanation && (
                          <span style={{ color: 'var(--text-muted)' }}> — {link.explanation}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bridge Entities → Connected Projects — collapsible */}
      {bridgeData.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <button
            onClick={() => setBridgesOpen(!bridgesOpen)}
            className="w-full flex items-center gap-1 text-left"
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {bridgesOpen ? '▼' : '▶'}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Cross-Project Bridges ({bridgeData.length})
            </span>
          </button>
          {bridgesOpen && (
            <div className="mt-1 space-y-1 max-h-48 overflow-y-auto">
              {bridgeData.slice(0, 20).map(({ entity, otherProjects }) => {
                const catColor = CATEGORY_COLORS[entity.category] || '#6B7280'
                return (
                  <div key={entity.id} className="flex items-start gap-1.5 py-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
                      style={{ backgroundColor: catColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => handleEntityClick(entity.name)}
                        className="text-xs hover:underline truncate block"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {entity.name}
                      </button>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        → {otherProjects.map(p => p.name).join(', ')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
