/**
 * EntityInfoCard — RSB full research panel for entity inspection.
 *
 * Option C: Filter toggle, not layout split.
 * One flat view of ALL data. Toggle at top: "All | [Collection]"
 * filters inline. No duplication, no confusion.
 *
 * Fetches data via fetchEntityInfoCard() which runs 6-pass query.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  fetchEntityInfoCard,
  type EntityInfoCardData,
  type RSBRelationship,
  type RSBChain,
  type RSBProjectMention,
} from '../../services/frontend-queries'
import { useNavigationStore } from '../../stores/navigation-store'
import { useRSBStore, type RSBScope } from '../../stores/rsb-store'
import CollapsibleSection from '../CollapsibleSection'
import ExpandableText from '../ExpandableText'
import CategoryBadge from '../shared/CategoryBadge'
import BridgeBadge from '../shared/BridgeBadge'
import InfoTag from '../InfoTag'
import { EVIDENCE_COLORS, MAGNITUDE_LABELS } from '../../constants/colors'

// ── Sub-components ──────────────────────────────────────

/** Single relationship card with evidence toggle */
function RelationshipCard({
  r,
  entityName,
  scope,
}: {
  r: RSBRelationship
  entityName: string
  scope: RSBScope
}) {
  const [showEvidence, setShowEvidence] = useState(false)
  const openEntityCard = useRSBStore(s => s.openEntityCard)

  return (
    <div style={{
      padding: '8px 10px',
      background: 'var(--surface-hover)',
      borderRadius: '6px',
      borderLeft: '3px solid rgba(99,102,241,0.4)',
    }}>
      {/* Header: entity → relType → target */}
      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {entityName}
        </span>
        <span style={{
          color: 'var(--accent)', fontSize: '10px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          padding: '1px 5px', background: 'rgba(99,102,241,0.15)', borderRadius: '3px',
        }}>
          {r.relType}
        </span>
        <span
          className="data-link"
          style={{ fontSize: '12px' }}
          onClick={() => openEntityCard(r.entity, scope)}
        >
          {r.entity}
        </span>
        <InfoTag type="entity" name={r.entity} scope={scope} />
      </div>

      {/* Metadata row */}
      <div className="flex items-center gap-2" style={{ marginBottom: '4px', fontSize: '10px', flexWrap: 'wrap' }}>
        <span style={{
          color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600,
          letterSpacing: '0.03em',
        }}>
          {r.causalClassification}
        </span>
        <span style={{ color: 'var(--border-subtle)' }}>/</span>
        <span style={{
          color: EVIDENCE_COLORS[r.evidenceStrength] || 'var(--text-muted)',
          textTransform: 'capitalize',
        }}>
          {r.evidenceStrength}
        </span>
        <span style={{ color: 'var(--border-subtle)' }}>/</span>
        <span style={{ color: 'var(--text-muted)' }}>
          {MAGNITUDE_LABELS[r.magnitude] || r.magnitude}
        </span>
      </div>

      {/* Description — always visible */}
      {r.description && (
        <div style={{ marginBottom: '4px' }}>
          <ExpandableText text={r.description} maxLength={200} fontSize="11px" color="var(--text-secondary)" />
        </div>
      )}

      {/* Evidence — collapsible toggle */}
      {r.evidence && (
        <div>
          <span
            className="data-link"
            style={{ fontSize: '10px' }}
            onClick={(e) => { e.stopPropagation(); setShowEvidence(!showEvidence) }}
          >
            {showEvidence ? 'Hide evidence' : 'Show evidence'}
          </span>
          {showEvidence && (
            <div style={{
              marginTop: '4px', padding: '6px 10px',
              background: 'rgba(99,102,241,0.06)', borderRadius: '4px',
              borderLeft: '2px solid rgba(99,102,241,0.3)',
              fontStyle: 'italic', fontSize: '11px', color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}>
              "{r.evidence}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Relationship list grouped by causalClassification */
function RelationshipGroup({
  relationships,
  entityName,
  scope,
  defaultExpanded,
}: {
  relationships: RSBRelationship[]
  entityName: string
  scope: RSBScope
  defaultExpanded: boolean
}) {
  if (relationships.length === 0) {
    return <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No relationships found.</div>
  }

  // Group by causalClassification
  const grouped = new Map<string, RSBRelationship[]>()
  for (const r of relationships) {
    const key = r.causalClassification || 'OTHER'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(r)
  }

  // Few relationships or one group — show flat
  if (grouped.size <= 1 || relationships.length <= 4) {
    return (
      <div className="flex flex-col gap-2">
        {relationships.map((r, i) => (
          <RelationshipCard key={`${r.entity}-${r.relType}-${i}`} r={r} entityName={entityName} scope={scope} />
        ))}
      </div>
    )
  }

  // Multiple groups — grouped with sub-headers
  return (
    <div className="flex flex-col gap-3">
      {Array.from(grouped.entries()).map(([classification, rels]) => (
        <CollapsibleSection
          key={classification}
          title={classification}
          count={rels.length}
          defaultExpanded={defaultExpanded}
        >
          <div className="flex flex-col gap-2">
            {rels.map((r, i) => (
              <RelationshipCard key={`${r.entity}-${r.relType}-${i}`} r={r} entityName={entityName} scope={scope} />
            ))}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  )
}

/** Single causal chain card with full link expansion */
function ChainCard({
  chain,
  entityName,
  scope,
}: {
  chain: RSBChain
  entityName: string
  scope: RSBScope
}) {
  const [expanded, setExpanded] = useState(false)
  const openEntityCard = useRSBStore(s => s.openEntityCard)

  return (
    <div style={{
      padding: '8px 10px',
      background: 'var(--surface-hover)',
      borderRadius: '6px',
    }}>
      {/* Chain header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
            {chain.chainName}
          </div>
          <div className="flex items-center gap-2" style={{ marginTop: '2px', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>{chain.projectName}</span>
            <span style={{ color: 'var(--border-subtle)' }}>/</span>
            <span>{chain.links.length} links</span>
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
          {expanded ? 'v' : '>'}
        </span>
      </div>

      {/* Expanded: Full link chain */}
      {expanded && (
        <div className="flex flex-col gap-2" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
          {chain.links.map((link, i) => (
            <div key={i} style={{ fontSize: '11px' }}>
              <div className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '9px', fontWeight: 600, minWidth: '18px' }}>
                  {i + 1}.
                </span>
                <span
                  className={link.source === entityName ? '' : 'data-link'}
                  style={link.source === entityName
                    ? { color: 'var(--accent)', fontWeight: 600, fontSize: '11px' }
                    : { fontSize: '11px' }
                  }
                  onClick={() => link.source !== entityName && openEntityCard(link.source, scope)}
                >
                  {link.source}
                </span>
                {link.source !== entityName && (
                  <InfoTag type="entity" name={link.source} scope={scope} />
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>→</span>
                <span
                  className={link.target === entityName ? '' : 'data-link'}
                  style={link.target === entityName
                    ? { color: 'var(--accent)', fontWeight: 600, fontSize: '11px' }
                    : { fontSize: '11px' }
                  }
                  onClick={() => link.target !== entityName && openEntityCard(link.target, scope)}
                >
                  {link.target}
                </span>
                {link.target !== entityName && (
                  <InfoTag type="entity" name={link.target} scope={scope} />
                )}
              </div>
              {link.explanation && (
                <div style={{
                  marginLeft: '22px', marginTop: '2px',
                  color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.5,
                }}>
                  <ExpandableText text={link.explanation} maxLength={120} fontSize="10px" color="var(--text-muted)" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Project mention with expandable role */
function ProjectMention({
  p,
  scope,
  showCollection,
}: {
  p: RSBProjectMention
  scope: RSBScope
  showCollection?: boolean
}) {
  const navigate = useNavigationStore(s => s.navigate)
  const close = useRSBStore(s => s.close)

  return (
    <div>
      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
        <span
          className="data-link"
          style={{ fontSize: '12px' }}
          onClick={() => {
            close()
            navigate({ page: 'project', uniqueId: p.uniqueId, fromCollection: scope.collection })
          }}
        >
          {p.name}
        </span>
        <InfoTag type="project" name={p.name} scope={{ projectUniqueId: p.uniqueId, projectName: p.name }} />
        {showCollection && p.collection && (
          <span style={{
            fontSize: '10px', color: 'var(--text-muted)',
            padding: '0px 6px', background: 'var(--surface-hover)',
            border: '1px solid var(--border-subtle)', borderRadius: '3px',
          }}>
            {p.collection}
          </span>
        )}
      </div>
      {p.role && (
        <div style={{ marginTop: '3px', marginLeft: '2px' }}>
          <ExpandableText text={p.role} maxLength={150} fontSize="11px" color="var(--text-muted)" />
        </div>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────

export default function EntityInfoCard({ name, scope }: { name: string; scope: RSBScope }) {
  const [data, setData] = useState<EntityInfoCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterScope, setFilterScope] = useState<'all' | 'collection'>(scope.collection ? 'collection' : 'all')
  const navigate = useNavigationStore(s => s.navigate)
  const openEntityCard = useRSBStore(s => s.openEntityCard)
  const close = useRSBStore(s => s.close)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchEntityInfoCard(name, scope.collection)
      .then(result => {
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(String(err))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [name, scope.collection])

  // Compute filtered data based on toggle
  const filtered = useMemo(() => {
    if (!data) return null
    const { scoped, global: g } = data
    if (filterScope === 'collection' && scoped) {
      return {
        projects: scoped.projects,
        relationships: scoped.relationships,
        chains: scoped.chains,
      }
    }
    // "All" — use global data
    return {
      projects: g.projects,
      relationships: g.relationships,
      chains: g.chains,
    }
  }, [data, filterScope])

  if (loading) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px' }}>Loading entity...</div>
  }
  if (error || !data || !filtered) {
    return <div style={{ padding: '24px', color: 'var(--error)', textAlign: 'center', fontSize: '12px' }}>Entity not found.</div>
  }

  const { global: g } = data
  const hasCollectionScope = !!scope.collection && !!data.scoped

  return (
    <>
      {/* ── Identity ──────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
          <CategoryBadge category={data.category} />
          {data.bridgeTier !== 'none' && <BridgeBadge tier={data.bridgeTier} />}
        </div>

        {data.definition && (
          <div style={{ marginBottom: '8px' }}>
            <ExpandableText text={data.definition} maxLength={250} fontSize="12px" />
          </div>
        )}

        {data.aliases.length > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Also known as: {data.aliases.join(', ')}
          </div>
        )}

        {/* Compact metrics */}
        <div className="flex items-center gap-4" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>PR: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{data.pageRank.toFixed(2)}</span></span>
          <span>BC: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{data.betweenness.toFixed(1)}</span></span>
          <span>Deg: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{data.degree}</span></span>
        </div>
      </div>

      <div className="rsb-divider" />

      {/* ── Filter Toggle ─────────────────────────────── */}
      {hasCollectionScope && (
        <div className="flex items-center gap-1" style={{ marginBottom: '12px' }}>
          <button
            style={{
              padding: '3px 10px', fontSize: '11px', fontWeight: 500,
              borderRadius: '4px', border: '1px solid',
              cursor: 'pointer', transition: 'all 0.15s',
              background: filterScope === 'all' ? 'rgba(99,102,241,0.15)' : 'transparent',
              borderColor: filterScope === 'all' ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)',
              color: filterScope === 'all' ? 'var(--accent)' : 'var(--text-muted)',
            }}
            onClick={() => setFilterScope('all')}
          >
            All
          </button>
          <button
            style={{
              padding: '3px 10px', fontSize: '11px', fontWeight: 500,
              borderRadius: '4px', border: '1px solid',
              cursor: 'pointer', transition: 'all 0.15s',
              background: filterScope === 'collection' ? 'rgba(99,102,241,0.15)' : 'transparent',
              borderColor: filterScope === 'collection' ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)',
              color: filterScope === 'collection' ? 'var(--accent)' : 'var(--text-muted)',
            }}
            onClick={() => setFilterScope('collection')}
          >
            {scope.collection}
          </button>
        </div>
      )}

      {/* ── Collections ───────────────────────────────── */}
      {g.collections.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div className="flex flex-wrap gap-1">
            {g.collections.map(c => (
              <span
                key={c}
                className="data-link"
                style={{
                  fontSize: '11px', padding: '2px 8px',
                  background: scope.collection === c ? 'rgba(99,102,241,0.15)' : 'var(--surface-hover)',
                  border: `1px solid ${scope.collection === c ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
                  borderRadius: '3px',
                  color: scope.collection === c ? 'var(--accent)' : undefined,
                }}
                onClick={() => { close(); navigate({ page: 'collection', name: c }) }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Projects ──────────────────────────────────── */}
      <CollapsibleSection title="Projects" count={filtered.projects.length} defaultExpanded={true}>
        {filtered.projects.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not mentioned in any projects.</div>
        ) : (
          <ProjectsGrouped
            projects={filtered.projects}
            scope={scope}
            showCollectionHeaders={filterScope === 'all'}
          />
        )}
      </CollapsibleSection>

      {/* ── Relationships ─────────────────────────────── */}
      <CollapsibleSection
        title="Relationships"
        count={filtered.relationships.length}
        defaultExpanded={filtered.relationships.length <= 8}
      >
        <RelationshipGroup
          relationships={filtered.relationships}
          entityName={name}
          scope={scope}
          defaultExpanded={filtered.relationships.length <= 6}
        />
      </CollapsibleSection>

      {/* ── Causal Chains ─────────────────────────────── */}
      <CollapsibleSection title="Causal Chains" count={filtered.chains.length} defaultExpanded={filtered.chains.length > 0 && filtered.chains.length <= 4}>
        {filtered.chains.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not part of any causal chains.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.chains.map(chain => (
              <ChainCard key={chain.chainId} chain={chain} entityName={name} scope={scope} />
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* ── Similar Entities (always all) ─────────────── */}
      <CollapsibleSection title="Similar Entities" count={g.similarEntities.length} defaultExpanded={false}>
        {g.similarEntities.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No similar entities found.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {g.similarEntities.map(se => (
              <div key={se.name} className="flex items-center justify-between" style={{ fontSize: '12px' }}>
                <div className="flex items-center gap-2">
                  <span
                    className="data-link"
                    onClick={() => openEntityCard(se.name, scope)}
                  >
                    {se.name}
                  </span>
                  <InfoTag type="entity" name={se.name} scope={scope} />
                  <CategoryBadge category={se.category} size="sm" />
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {Math.round(se.similarity * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Open full page button */}
      <button
        className="rsb-action-btn"
        onClick={() => { close(); navigate({ page: 'entity', name: data.name }) }}
      >
        Open Entity Page →
      </button>
    </>
  )
}

// ── Projects grouped by collection ──────────────────────

function ProjectsGrouped({
  projects,
  scope,
  showCollectionHeaders,
}: {
  projects: RSBProjectMention[]
  scope: RSBScope
  showCollectionHeaders: boolean
}) {
  // If not grouping or only one collection, render flat
  if (!showCollectionHeaders) {
    return (
      <div className="flex flex-col gap-3">
        {projects.map(p => (
          <ProjectMention key={p.uniqueId} p={p} scope={scope} />
        ))}
      </div>
    )
  }

  // Group by collection
  const byCollection = new Map<string, RSBProjectMention[]>()
  for (const p of projects) {
    const key = p.collection || 'Uncategorized'
    if (!byCollection.has(key)) byCollection.set(key, [])
    byCollection.get(key)!.push(p)
  }

  if (byCollection.size <= 1) {
    return (
      <div className="flex flex-col gap-3">
        {projects.map(p => (
          <ProjectMention key={p.uniqueId} p={p} scope={scope} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {Array.from(byCollection.entries()).map(([collectionName, cProjects]) => (
        <div key={collectionName}>
          <div style={{
            fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: 'var(--accent)',
            marginBottom: '6px', paddingBottom: '3px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            {collectionName}
          </div>
          <div className="flex flex-col gap-3">
            {cProjects.map(p => (
              <ProjectMention key={p.uniqueId} p={p} scope={scope} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
