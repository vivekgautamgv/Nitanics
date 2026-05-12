/**
 * ProjectInfoCard — RSB content for project inspection.
 *
 * Two sections:
 *   SCOPED (top): Filtered to the current collection context.
 *   GLOBAL (below): All collections, related projects, top entities.
 *
 * Fetches data on mount via fetchProjectInfoCard().
 */
import { useEffect, useState } from 'react'
import { fetchProjectInfoCard, type ProjectInfoCardData } from '../../services/frontend-queries'
import { useNavigationStore } from '../../stores/navigation-store'
import { useRSBStore, type RSBScope } from '../../stores/rsb-store'
import CollapsibleSection from '../CollapsibleSection'
import ExpandableText from '../ExpandableText'
import CategoryBadge from '../shared/CategoryBadge'
import InfoTag from '../InfoTag'

export default function ProjectInfoCard({ name, scope }: { name: string; scope: RSBScope }) {
  const [data, setData] = useState<ProjectInfoCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigationStore(s => s.navigate)
  const openEntityCard = useRSBStore(s => s.openEntityCard)
  const close = useRSBStore(s => s.close)

  // Resolve uniqueId: scope may carry it, or we need to search by name
  const uniqueId = scope.projectUniqueId || ''

  useEffect(() => {
    if (!uniqueId) {
      // If no uniqueId, we can't fetch — need name-based lookup
      setError('No project ID available')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchProjectInfoCard(uniqueId, scope.collection)
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
  }, [uniqueId, scope.collection])

  if (loading) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px' }}>Loading project...</div>
  }
  if (error || !data) {
    return <div style={{ padding: '24px', color: 'var(--error)', textAlign: 'center', fontSize: '12px' }}>Project not found.</div>
  }

  const { scoped, global: g } = data

  return (
    <>
      {/* Identity */}
      <div>
        <div className="flex items-center gap-2" style={{ marginBottom: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>{data.domain}</span>
          {data.subdomain && (
            <>
              <span style={{ color: 'var(--border-subtle)' }}>/</span>
              <span>{data.subdomain}</span>
            </>
          )}
        </div>

        {data.summary && (
          <div style={{ marginBottom: '8px' }}>
            <ExpandableText text={data.summary} maxLength={200} fontSize="12px" />
          </div>
        )}

        {data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1" style={{ marginBottom: '8px' }}>
            {data.tags.map(t => (
              <span key={t} style={{
                fontSize: '10px', padding: '1px 6px',
                background: 'var(--surface-hover)', border: '1px solid var(--border-subtle)',
                borderRadius: '3px', color: 'var(--text-muted)',
              }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Compact stats */}
        <div className="flex items-center gap-4" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>Entities: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{data.entityCount}</span></span>
          <span>Rels: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{data.relationshipCount}</span></span>
          <span>Chains: <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{data.chainCount}</span></span>
        </div>
      </div>

      {/* Scoped Section */}
      {scoped && scope.collection && (
        <>
          <div className="rsb-divider" />
          <div className="rsb-section-label">In {scope.collection}</div>

          {/* Shared Bridge Entities */}
          {scoped.sharedBridges.length > 0 && (
            <CollapsibleSection title="Bridge Entities" count={scoped.sharedBridges.length} defaultExpanded={true}>
              <div className="flex flex-col gap-2">
                {scoped.sharedBridges.map(b => (
                  <div key={b.name} className="flex items-center justify-between" style={{ fontSize: '12px' }}>
                    <div className="flex items-center gap-2">
                      <span
                        className="data-link"
                        onClick={() => openEntityCard(b.name, scope)}
                      >
                        {b.name}
                      </span>
                      <InfoTag type="entity" name={b.name} scope={scope} />
                      <CategoryBadge category={b.category} size="sm" />
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {b.projectCount} projects
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Scoped Top Entities with roles */}
          <CollapsibleSection title="Key Entities" count={scoped.topEntities.length} defaultExpanded={scoped.topEntities.length <= 5}>
            {scoped.topEntities.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No entities shared with this collection.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {scoped.topEntities.map(e => (
                  <div key={e.name}>
                    <div className="flex items-center gap-2">
                      <span
                        className="data-link"
                        style={{ fontSize: '12px' }}
                        onClick={() => openEntityCard(e.name, scope)}
                      >
                        {e.name}
                      </span>
                      <InfoTag type="entity" name={e.name} scope={scope} />
                      <CategoryBadge category={e.category} size="sm" />
                    </div>
                    {e.role && (
                      <div style={{ marginTop: '2px' }}>
                        <ExpandableText text={e.role} maxLength={120} fontSize="11px" color="var(--text-muted)" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>
        </>
      )}

      {/* Global Section */}
      <div className="rsb-divider" />
      <div className="rsb-section-label">Global</div>

      <div>
        <div className="rsb-stat-row">
          <span className="rsb-stat-label">Directory</span>
          <span
            className="rsb-stat-value data-link"
            onClick={() => { close(); navigate({ page: 'directory', name: data.directory }) }}
          >
            {data.directory}
          </span>
        </div>
        {g.collections.length > 0 && (
          <div className="rsb-stat-row">
            <span className="rsb-stat-label">Collections</span>
            <span className="rsb-stat-value">
              {g.collections.map((c, i) => (
                <span key={c}>
                  {i > 0 && ', '}
                  <span
                    className="data-link"
                    onClick={() => { close(); navigate({ page: 'collection', name: c }) }}
                  >
                    {c}
                  </span>
                </span>
              ))}
            </span>
          </div>
        )}
      </div>

      {/* Related Projects */}
      {g.relatedProjects.length > 0 && (
        <CollapsibleSection title="Related Projects" count={g.relatedProjects.length} defaultExpanded={false}>
          <div className="flex flex-col gap-2">
            {g.relatedProjects.map(rp => (
              <div key={rp.uniqueId} className="flex items-center justify-between" style={{ fontSize: '12px' }}>
                <div className="flex items-center gap-1">
                  <span
                    className="data-link"
                    onClick={() => { close(); navigate({ page: 'project', uniqueId: rp.uniqueId }) }}
                  >
                    {rp.name}
                  </span>
                  <InfoTag type="project" name={rp.name} scope={{ projectUniqueId: rp.uniqueId, projectName: rp.name }} />
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {rp.sharedCount} shared
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Global Top Entities */}
      <CollapsibleSection title="Top Entities" count={g.topEntities.length} defaultExpanded={false}>
        <div className="flex flex-col gap-2">
          {g.topEntities.map(e => (
            <div key={e.name} className="flex items-center justify-between" style={{ fontSize: '12px' }}>
              <div className="flex items-center gap-2">
                <span
                  className="data-link"
                  onClick={() => openEntityCard(e.name, scope)}
                >
                  {e.name}
                </span>
                <CategoryBadge category={e.category} size="sm" />
                <InfoTag type="entity" name={e.name} scope={scope} />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                PR: {e.pageRank.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Open full page button */}
      <button
        className="rsb-action-btn"
        onClick={() => {
          close()
          navigate({
            page: 'project',
            uniqueId: data.uniqueId,
            fromCollection: scope.collection,
          })
        }}
      >
        Open Project Page →
      </button>

      {/* Source link */}
      {data.htmlPath && (
        <button
          className="rsb-action-btn"
          style={{ marginTop: '4px', background: 'none', border: '1px solid var(--border-subtle)' }}
          onClick={() => { close(); navigate({ page: 'source', htmlPath: data.htmlPath! }) }}
        >
          View Source Document
        </button>
      )}
    </>
  )
}
