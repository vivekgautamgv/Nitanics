/**
 * ProjectPage — Full project detail view.
 * Sections: Summary, Entities, Relationships, Causal Chains, Timeline, Related Projects
 * Source of truth: DESIGN-SPEC.md Section 8
 */
import { useEffect, useState } from 'react'
import { useProjectStore } from '../stores/project-store'
import { useNavigationStore } from '../stores/navigation-store'
import StatsGrid from '../components/StatsGrid'
import CollapsibleSection from '../components/CollapsibleSection'
import PillList from '../components/PillList'
import CategoryBadge from '../components/shared/CategoryBadge'
import BridgeBadge from '../components/shared/BridgeBadge'
import ExpandableText from '../components/ExpandableText'
import InfoTag from '../components/InfoTag'
import { EVIDENCE_COLORS, MAGNITUDE_LABELS } from '../constants/colors'
import type { CausalChainItem, ProjectRelationship } from '../types/frontend'

export default function ProjectPage({ uniqueId, fromCollection }: { uniqueId: string; fromCollection?: string }) {
  const {
    detail, entities, relationships, relatedProjects, chains, timeline,
    isLoading, error, loadProject,
  } = useProjectStore()
  const navigate = useNavigationStore(s => s.navigate)

  useEffect(() => {
    loadProject(uniqueId)
  }, [uniqueId, loadProject])

  if (isLoading && !detail) {
    return <div className="loading-state">Loading project...</div>
  }
  if (error) {
    return (
      <div className="error-state">
        Error: {error}
        <button className="btn btn-secondary" style={{ marginLeft: '12px' }}
          onClick={() => loadProject(uniqueId)}>
          Retry
        </button>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="empty-state">
        Project not found.
        <button className="btn btn-secondary" style={{ marginLeft: '12px' }}
          onClick={() => navigate({ page: 'home' })}>
          Back to Home
        </button>
      </div>
    )
  }

  const stats = [
    { label: 'Entities', value: entities.length },
    { label: 'Relationships', value: relationships.length },
    { label: 'Causal Chains', value: chains.length },
    { label: 'Timeline Events', value: timeline.length },
  ]

  const bridgeEntities = entities.filter(e => e.bridgeTier !== 'none')

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: '8px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600 }}>
          {detail.name}
        </h1>
        <div className="flex items-center gap-3" style={{ marginTop: '4px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {detail.domain}
            {detail.subdomain && <span style={{ color: 'var(--text-muted)' }}> / {detail.subdomain}</span>}
          </span>
          {detail.directory && (
            <span
              className="data-link"
              style={{ fontSize: '12px' }}
              onClick={() => navigate({ page: 'directory', name: detail.directory })}
            >
              {detail.directory}
            </span>
          )}
          {detail.createdDate && (
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              {detail.createdDate}
            </span>
          )}
        </div>
      </div>

      {/* Collection context banner */}
      {fromCollection && (
        <div className="flex items-center gap-2" style={{
          marginBottom: '12px', padding: '6px 12px',
          background: 'var(--surface-hover)', borderRadius: '6px',
          borderLeft: '3px solid var(--accent)',
          fontSize: '12px',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Viewing in context of</span>
          <span
            className="data-link"
            style={{ fontWeight: 500 }}
            onClick={() => navigate({ page: 'collection', name: fromCollection })}
          >
            {fromCollection}
          </span>
        </div>
      )}

      {/* Collections + Tags row */}
      <div className="flex items-center gap-4" style={{ marginBottom: '16px' }}>
        {detail.collections.length > 0 && (
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Collections:</span>
            <PillList
              items={detail.collections}
              maxVisible={4}
              variant="collection"
              onItemClick={(c) => navigate({ page: 'collection', name: c })}
            />
          </div>
        )}
        {detail.baseTags.length > 0 && (
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Tags:</span>
            <PillList items={detail.baseTags} maxVisible={5} variant="tag" />
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ marginBottom: '20px' }}>
        <StatsGrid stats={stats} />
      </div>

      {/* Source link */}
      {detail.htmlPath && (
        <div style={{ marginBottom: '16px' }}>
          <span
            className="data-link"
            onClick={() => navigate({ page: 'source', htmlPath: detail.htmlPath })}
          >
            View Source Document
          </span>
        </div>
      )}

      {/* Summary Section */}
      <CollapsibleSection title="Summary">
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7 }}>
          {detail.summary}
        </div>
        {detail.narrativeFlow.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Narrative Flow
            </span>
            <ol style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.8 }}>
              {detail.narrativeFlow.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </div>
        )}
      </CollapsibleSection>

      {/* Entities Section */}
      <CollapsibleSection title="Entities" count={entities.length}>
        {entities.length === 0 ? (
          <div className="empty-state">No entities extracted.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Entity</th>
                <th>Category</th>
                <th>Role in This Project</th>
                <th>Bridge</th>
                <th>Global</th>
              </tr>
            </thead>
            <tbody>
              {entities.map(e => (
                <tr key={e.name}>
                  <td>
                    <span className="data-link" onClick={() => navigate({ page: 'entity', name: e.name })}>
                      {e.name}
                    </span>
                    <InfoTag type="entity" name={e.name} scope={{ collection: fromCollection }} />
                  </td>
                  <td><CategoryBadge category={e.category} /></td>
                  <td style={{ maxWidth: '400px' }}>
                    <ExpandableText text={e.role} maxLength={150} />
                  </td>
                  <td><BridgeBadge tier={e.bridgeTier} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {e.projectCount} proj
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsibleSection>

      {/* Bridge Entities Highlight */}
      {bridgeEntities.length > 0 && (
        <CollapsibleSection title="Bridge Entities" count={bridgeEntities.length} defaultExpanded={false}>
          <div className="flex flex-wrap gap-3">
            {bridgeEntities.map(e => (
              <div
                key={e.name}
                className="card"
                style={{ padding: '10px 14px', minWidth: '180px' }}
              >
                <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                  <CategoryBadge category={e.category} />
                  <BridgeBadge tier={e.bridgeTier} />
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className="data-link"
                    style={{ fontSize: '13px', fontWeight: 500 }}
                    onClick={() => navigate({ page: 'entity', name: e.name })}
                  >
                    {e.name}
                  </span>
                  <InfoTag type="entity" name={e.name} scope={{ collection: fromCollection }} />
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                  {e.projectCount} projects
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Relationships Section — rich cards grouped by causal family */}
      <CollapsibleSection title="Relationships" count={relationships.length} defaultExpanded={false}>
        {relationships.length === 0 ? (
          <div className="empty-state">No relationships extracted.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {groupRelationships(relationships).map(group => (
              <div key={group.classification}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  {group.classification} ({group.rels.length})
                </div>
                <div className="flex flex-col gap-2">
                  {group.rels.map((r, i) => (
                    <RelationshipCard key={i} rel={r} onNavigate={navigate} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Causal Chains Section — collapsible cards */}
      <CollapsibleSection title="Causal Chains" count={chains.length} defaultExpanded={false}>
        {chains.length === 0 ? (
          <div className="empty-state">No causal chains extracted.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {chains.map((chain, idx) => (
              <ProjectCausalChainCard key={idx} chain={chain} onNavigate={navigate} />
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Timeline Section */}
      <CollapsibleSection title="Timeline" count={timeline.length} defaultExpanded={false}>
        {timeline.length === 0 ? (
          <div className="empty-state">No timeline events.</div>
        ) : (
          <div className="flex flex-col gap-0">
            {timeline.map((event, i) => (
              <div
                key={i}
                className="flex gap-4"
                style={{
                  padding: '10px 0',
                  borderBottom: i < timeline.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{ width: '50px', flexShrink: 0, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '28px',
                    height: '28px',
                    lineHeight: '28px',
                    borderRadius: '50%',
                    background: 'var(--surface-hover)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}>
                    {event.phaseIndex}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>
                    {event.label}
                  </div>
                  {event.period && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {event.period}
                    </span>
                  )}
                  {event.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1" style={{ marginTop: '4px' }}>
                      {event.entities.map(eName => (
                        <span
                          key={eName}
                          className="pill pill-entity"
                          style={{ cursor: 'pointer', fontSize: '11px' }}
                          onClick={() => navigate({ page: 'entity', name: eName })}
                        >
                          {eName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Related Projects Section */}
      <CollapsibleSection title="Related Projects" count={relatedProjects.length} defaultExpanded={false}>
        {relatedProjects.length === 0 ? (
          <div className="empty-state">No related projects found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Domain</th>
                <th>Shared Entities</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {relatedProjects.map(rp => (
                <tr key={rp.uniqueId}>
                  <td>
                    <span className="data-link" onClick={() => navigate({ page: 'project', uniqueId: rp.uniqueId })}>
                      {rp.name}
                    </span>
                    <InfoTag type="project" name={rp.name} scope={{ collection: fromCollection, projectUniqueId: rp.uniqueId, projectName: rp.name }} />
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{rp.domain}</td>
                  <td>
                    <PillList
                      items={rp.sharedNames}
                      maxVisible={3}
                      variant="entity"
                      onItemClick={(e) => navigate({ page: 'entity', name: e })}
                    />
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{rp.sharedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CollapsibleSection>
    </div>
  )
}

// ── Collapsible Causal Chain Card ──────────────────────────

function ProjectCausalChainCard({ chain, onNavigate }: {
  chain: CausalChainItem
  onNavigate: (route: import('../types/frontend').Route) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      {/* Header — always visible */}
      <div
        className="flex items-center justify-between"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-muted)', fontSize: '12px', transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'none' }}>
            {'>'}
          </span>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
            {chain.chainName}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            ({chain.links.length} links)
          </span>
        </div>
      </div>

      {/* Expanded — full description + links with full explanations */}
      {expanded && (
        <div style={{ marginTop: '10px' }}>
          {chain.chainDescription && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px', lineHeight: 1.7 }}>
              {chain.chainDescription}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {chain.links.map((link, i) => (
              <div key={i} style={{ fontSize: '12px' }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-muted)', width: '16px', textAlign: 'right', flexShrink: 0 }}>
                    {i + 1}.
                  </span>
                  <span className="data-link" onClick={() => onNavigate({ page: 'entity', name: link.source })}>
                    {link.source}
                  </span>
                  <InfoTag type="entity" name={link.source} scope={{}} />
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <span className="data-link" onClick={() => onNavigate({ page: 'entity', name: link.target })}>
                    {link.target}
                  </span>
                  <InfoTag type="entity" name={link.target} scope={{}} />
                </div>
                {link.explanation && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', marginLeft: '24px', lineHeight: 1.6, marginTop: '2px' }}>
                    {link.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Relationship Cards (grouped by causal family) ────────

function groupRelationships(rels: ProjectRelationship[]): Array<{
  classification: string
  rels: ProjectRelationship[]
}> {
  const map = new Map<string, ProjectRelationship[]>()
  for (const r of rels) {
    const key = r.causalClassification || 'Other'
    const existing = map.get(key)
    if (existing) existing.push(r)
    else map.set(key, [r])
  }
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([classification, rels]) => ({ classification, rels }))
}

function RelationshipCard({ rel, onNavigate }: {
  rel: ProjectRelationship
  onNavigate: (route: import('../types/frontend').Route) => void
}) {
  const [showEvidence, setShowEvidence] = useState(false)

  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      {/* Header: source → relType → target */}
      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: '6px' }}>
        <span className="data-link" onClick={() => onNavigate({ page: 'entity', name: rel.source })}>
          {rel.source}
        </span>
        <InfoTag type="entity" name={rel.source} scope={{}} />
        <span style={{
          color: 'var(--accent)', fontSize: '11px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          padding: '1px 6px', background: 'rgba(99,102,241,0.1)', borderRadius: '3px',
        }}>
          {rel.relType}
        </span>
        <span className="data-link" onClick={() => onNavigate({ page: 'entity', name: rel.target })}>
          {rel.target}
        </span>
        <InfoTag type="entity" name={rel.target} scope={{}} />
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-3" style={{ marginBottom: '8px', fontSize: '11px' }}>
        <span style={{
          color: EVIDENCE_COLORS[rel.evidenceStrength] || 'var(--text-muted)',
          textTransform: 'capitalize',
        }}>
          {rel.evidenceStrength}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {MAGNITUDE_LABELS[rel.magnitude] || rel.magnitude}
        </span>
        {rel.year && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: 'var(--text-muted)' }}>{rel.year}</span>
          </>
        )}
      </div>

      {/* Description — always visible */}
      {rel.description && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.7 }}>
          {rel.description}
        </div>
      )}

      {/* Evidence — collapsible */}
      {rel.evidence && (
        <div style={{ marginTop: '8px' }}>
          <span
            className="data-link"
            style={{ fontSize: '11px' }}
            onClick={() => setShowEvidence(!showEvidence)}
          >
            {showEvidence ? 'Hide evidence' : 'Show evidence'}
          </span>
          {showEvidence && (
            <div style={{
              marginTop: '6px', padding: '8px 12px',
              background: 'var(--surface-hover)', borderRadius: '4px',
              borderLeft: '2px solid var(--accent)',
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', lineHeight: 1.7 }}>
                "{rel.evidence}"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
