/**
 * EntityPage — Cross-document entity profile.
 * Sections: Identity, Project Mentions, Relationships, Causal Chains, Similar Entities
 * Source of truth: DESIGN-SPEC.md Section 9
 */
import { useEffect, useMemo, useState } from 'react'
import { useEntityStore } from '../stores/entity-store'
import { useNavigationStore } from '../stores/navigation-store'
import StatsGrid from '../components/StatsGrid'
import CollapsibleSection from '../components/CollapsibleSection'
import PillList from '../components/PillList'
import MetricBar from '../components/MetricBar'
import ExpandableText from '../components/ExpandableText'
import CategoryBadge from '../components/shared/CategoryBadge'
import BridgeBadge from '../components/shared/BridgeBadge'
import InfoTag from '../components/InfoTag'
import { EVIDENCE_COLORS, MAGNITUDE_LABELS } from '../constants/colors'
import type { EntityChainLink, EntityRelationship } from '../types/frontend'

export default function EntityPage({ name }: { name: string }) {
  const { profile, isLoading, error, loadEntity } = useEntityStore()
  const navigate = useNavigationStore(s => s.navigate)

  useEffect(() => {
    loadEntity(name)
  }, [name, loadEntity])

  // Must be before early returns — React hooks must always run in the same order
  const projectsByCollection = useMemo(() => {
    if (!profile) return []
    const map = new Map<string, typeof profile.projects>()
    for (const p of profile.projects) {
      const cols = p.collections.length > 0 ? p.collections : ['Uncategorized']
      for (const col of cols) {
        const existing = map.get(col)
        if (existing) {
          if (!existing.some(ep => ep.uniqueId === p.uniqueId)) {
            existing.push(p)
          }
        } else {
          map.set(col, [p])
        }
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (a === 'Uncategorized') return 1
        if (b === 'Uncategorized') return -1
        return a.localeCompare(b)
      })
      .map(([collection, projects]) => ({ collection, projects }))
  }, [profile])

  if (isLoading && !profile) {
    return <div className="loading-state">Loading entity...</div>
  }
  if (error) {
    return (
      <div className="error-state">
        Error: {error}
        <button className="btn btn-secondary" style={{ marginLeft: '12px' }}
          onClick={() => loadEntity(name)}>
          Retry
        </button>
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="empty-state">
        Entity "{name}" not found.
        <button className="btn btn-secondary" style={{ marginLeft: '12px' }}
          onClick={() => navigate({ page: 'home' })}>
          Back to Home
        </button>
      </div>
    )
  }

  const stats = [
    { label: 'Projects', value: profile.projectCount },
    { label: 'Relationships', value: profile.relationships.length },
    { label: 'Chain Links', value: profile.chainLinks.length },
    { label: 'Similar', value: profile.similarEntities.length },
  ]

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: '4px' }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600 }}>
            {profile.name}
          </h1>
          <CategoryBadge category={profile.category} size="md" />
          <BridgeBadge tier={profile.bridgeTier} />
        </div>
        {profile.aliases.length > 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Also known as: {profile.aliases.join(', ')}
          </div>
        )}
      </div>

      {/* Collections row */}
      {profile.collections.length > 0 && (
        <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Collections:</span>
          <PillList
            items={profile.collections}
            maxVisible={5}
            variant="collection"
            onItemClick={(c) => navigate({ page: 'collection', name: c })}
          />
        </div>
      )}

      {/* Stats */}
      <div style={{ marginBottom: '20px' }}>
        <StatsGrid stats={stats} />
      </div>

      {/* Graph Metrics */}
      <CollapsibleSection title="Graph Metrics">
        <div className="flex flex-col gap-3" style={{ maxWidth: '400px' }}>
          <MetricBar label="PageRank" value={profile.pageRank} color="var(--accent)" />
          <MetricBar label="Betweenness" value={profile.betweenness} color="var(--warning)" />
          <MetricBar label="Degree" value={profile.degree} color="var(--info)" />
        </div>
      </CollapsibleSection>

      {/* Definition Section */}
      <CollapsibleSection title="Definition">
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, maxWidth: '700px' }}>
          {profile.definition || 'No definition available.'}
        </div>
      </CollapsibleSection>

      {/* Project Mentions — grouped by collection */}
      <CollapsibleSection title="Project Mentions" count={profile.projects.length}>
        {profile.projects.length === 0 ? (
          <div className="empty-state">No project mentions found.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {projectsByCollection.map(group => (
              <div key={group.collection}>
                {/* Collection header */}
                <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
                  <span
                    className={group.collection !== 'Uncategorized' ? 'data-link' : ''}
                    style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}
                    onClick={() => group.collection !== 'Uncategorized' && navigate({ page: 'collection', name: group.collection })}
                  >
                    {group.collection}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    ({group.projects.length} project{group.projects.length > 1 ? 's' : ''})
                  </span>
                </div>
                {/* Projects within this collection */}
                <div className="flex flex-col gap-2" style={{ marginLeft: '12px' }}>
                  {group.projects.map(p => (
                    <div key={p.uniqueId} className="card" style={{ padding: '10px 14px' }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                        <span
                          className="data-link"
                          style={{ fontSize: '13px', fontWeight: 500 }}
                          onClick={() => navigate({ page: 'project', uniqueId: p.uniqueId })}
                        >
                          {p.project}
                        </span>
                        <InfoTag type="project" name={p.project} scope={{ collection: group.collection !== 'Uncategorized' ? group.collection : undefined, projectUniqueId: p.uniqueId, projectName: p.project }} />
                        <div className="flex items-center gap-3">
                          <span style={{ fontSize: '11px' }}>
                            <span
                              className="data-link"
                              onClick={() => navigate({ page: 'directory', name: p.directory })}
                            >
                              {p.directory}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}> / {p.domain}</span>
                          </span>
                          {p.htmlPath && (
                            <span
                              className="data-link"
                              style={{ fontSize: '11px' }}
                              onClick={() => navigate({ page: 'source', htmlPath: p.htmlPath })}
                            >
                              Source
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <ExpandableText text={p.role} maxLength={200} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Relationships Section — rich cards grouped by causal family */}
      <CollapsibleSection title="Relationships" count={profile.relationships.length} defaultExpanded={false}>
        {profile.relationships.length === 0 ? (
          <div className="empty-state">No relationships found.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {groupEntityRelationships(profile.relationships).map(group => (
              <div key={group.classification}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  {group.classification} ({group.rels.length})
                </div>
                <div className="flex flex-col gap-2">
                  {group.rels.map((r, i) => (
                    <EntityRelationshipCard key={i} rel={r} entityName={name} onNavigate={navigate} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Causal Chain Links Section */}
      <CollapsibleSection title="Causal Chain Involvement" count={profile.chainLinks.length} defaultExpanded={false}>
        {profile.chainLinks.length === 0 ? (
          <div className="empty-state">Not part of any causal chains.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Group by chain */}
            {groupChainLinks(profile.chainLinks).map(group => (
              <div key={group.chainId} className="card" style={{ padding: '10px 14px' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                  {group.chainName}
                </div>
                <div className="flex flex-col gap-1">
                  {group.links.map((link, i) => (
                    <div key={i} className="flex items-center gap-2" style={{ fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)', width: '16px', textAlign: 'right', flexShrink: 0 }}>
                        {link.orderIndex}.
                      </span>
                      <span
                        className={link.entity === name ? '' : 'data-link'}
                        style={link.entity === name ? { color: 'var(--accent)', fontWeight: 600 } : undefined}
                        onClick={() => link.entity !== name && navigate({ page: 'entity', name: link.entity })}
                      >
                        {link.entity}
                      </span>
                      {link.entity !== name && <InfoTag type="entity" name={link.entity} />}
                      {link.explanation && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
                          — <ExpandableText text={link.explanation} maxLength={80} fontSize="11px" color="var(--text-muted)" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Similar Entities Section */}
      <CollapsibleSection title="Similar Entities" count={profile.similarEntities.length} defaultExpanded={false}>
        {profile.similarEntities.length === 0 ? (
          <div className="empty-state">No similar entities found. This entity may not have embeddings computed yet — re-run the embedding step during ingestion.</div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {profile.similarEntities.map(s => (
              <div
                key={s.name}
                className="card"
                style={{ padding: '8px 14px', cursor: 'pointer', minWidth: '160px' }}
                onClick={() => navigate({ page: 'entity', name: s.name })}
              >
                <div className="flex items-center gap-2" style={{ marginBottom: '2px' }}>
                  <CategoryBadge category={s.category} size="sm" />
                </div>
                <div className="flex items-center gap-1" style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                  {s.name}
                  <InfoTag type="entity" name={s.name} />
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {(s.similarity * 100).toFixed(0)}% similar
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}

// ── Helper: group chain links by chain ID ───────────────

function groupChainLinks(links: EntityChainLink[]): Array<{
  chainId: string
  chainName: string
  links: EntityChainLink[]
}> {
  const map = new Map<string, { chainId: string; chainName: string; links: EntityChainLink[] }>()
  for (const link of links) {
    const existing = map.get(link.chainId)
    if (existing) {
      existing.links.push(link)
    } else {
      map.set(link.chainId, { chainId: link.chainId, chainName: link.chainName, links: [link] })
    }
  }
  for (const group of map.values()) {
    group.links.sort((a, b) => a.orderIndex - b.orderIndex)
  }
  return Array.from(map.values())
}

// ── Relationship Cards (grouped by causal family) ────────

function groupEntityRelationships(rels: EntityRelationship[]): Array<{
  classification: string
  rels: EntityRelationship[]
}> {
  const map = new Map<string, EntityRelationship[]>()
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

function EntityRelationshipCard({ rel, entityName, onNavigate }: {
  rel: EntityRelationship
  entityName: string
  onNavigate: (route: import('../types/frontend').Route) => void
}) {
  const [showEvidence, setShowEvidence] = useState(false)

  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      {/* Header: this entity → relType → connected entity */}
      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: '6px' }}>
        <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: 600 }}>
          {entityName}
        </span>
        <span style={{
          color: 'var(--accent)', fontSize: '11px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          padding: '1px 6px', background: 'rgba(99,102,241,0.1)', borderRadius: '3px',
        }}>
          {rel.relType}
        </span>
        <span className="data-link" onClick={() => onNavigate({ page: 'entity', name: rel.entity })}>
          {rel.entity}
        </span>
        <InfoTag type="entity" name={rel.entity} />
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

      {/* Description — always visible, full text */}
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
