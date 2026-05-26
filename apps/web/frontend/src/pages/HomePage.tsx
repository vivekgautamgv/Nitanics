import { useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { createCollection } from '../services/frontend-queries'
import { useDirectoryStore } from '../stores/directory-store'
import { useNavigationStore } from '../stores/navigation-store'

export default function HomePage() {
  const {
    directories, allCollections, isLoading, error,
    loadDirectories, loadAllCollections,
    createDirectory, deleteDirectory,
  } = useDirectoryStore()
  const navigate = useNavigationStore(s => s.navigate)

  const [selectedCollection, setSelectedCollection] = useState('')
  const [showCreateDir, setShowCreateDir] = useState(false)
  const [newDirName, setNewDirName] = useState('')
  const [showCreateCol, setShowCreateCol] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColDir, setNewColDir] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [viewportWidth, setViewportWidth] = useState<number>(() => (
    typeof window === 'undefined' ? 1440 : window.innerWidth
  ))

  useEffect(() => {
    loadDirectories()
    loadAllCollections()
  }, [loadDirectories, loadAllCollections])

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const totals = useMemo(() => {
    const collectionCount = allCollections.length
    const projectCount = allCollections.reduce((sum, c) => sum + c.projectCount, 0)
    const entityCount = directories.reduce((sum, d) => sum + d.entityCount, 0)
    return { collectionCount, projectCount, entityCount }
  }, [allCollections, directories])

  const featuredCollections = useMemo(() => allCollections.slice(0, 3), [allCollections])

  const isCompact = viewportWidth < 980
  const isDense = viewportWidth < 640

  const handleCreateDir = async () => {
    if (!newDirName.trim()) return
    await createDirectory(newDirName.trim(), '')
    setNewDirName('')
    setShowCreateDir(false)
  }

  const handleCreateCol = async () => {
    if (!newColName.trim()) return
    await createCollection(newColName.trim(), newColDir || '')
    setNewColName('')
    setShowCreateCol(false)
    await loadAllCollections()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const deleted = await deleteDirectory(deleteTarget)
    if (!deleted) setDeleteError(`Cannot delete "${deleteTarget}" because it still contains active projects.`)
    setDeleteTarget(null)
  }

  if (isLoading && directories.length === 0) {
    return <LoadingState />
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: 'var(--error)' }}>
        Error connecting to database: {error}
        <button className="btn btn-secondary" style={{ marginLeft: 16 }} onClick={() => { loadDirectories(); loadAllCollections() }}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ padding: isDense ? '18px 16px 16px' : '28px 28px 20px' }}>
        <section style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 30,
          border: '1px solid var(--border)',
          background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-raised) 100%)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.37)',
          padding: isDense ? '20px' : '30px',
          marginBottom: 18,
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at top right, rgba(56,189,248,0.08), transparent 34%), radial-gradient(circle at bottom left, rgba(124,58,237,0.08), transparent 28%)',
            pointerEvents: 'none',
          }} />

          <div style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'minmax(0, 1.25fr) minmax(320px, 420px)',
            gap: isCompact ? 18 : 26,
            alignItems: 'stretch',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 18,
              }}>
                Persistent Knowledge Workspace
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: isDense ? '1fr' : 'minmax(0, 1fr) minmax(220px, 280px)',
                gap: 20,
                alignItems: 'start',
              }}>
                <div>
                  <h1 style={{
                    fontSize: isDense ? 34 : 54,
                    lineHeight: 0.96,
                    letterSpacing: '-0.06em',
                    color: 'var(--text-primary)',
                    maxWidth: 640,
                    marginBottom: 14,
                  }}>
                    Give every collection a cleaner, more institutional front door.
                  </h1>
                  <p style={{
                    fontSize: isDense ? 15 : 17,
                    lineHeight: 1.75,
                    color: 'var(--text-secondary)',
                    maxWidth: 640,
                    marginBottom: 22,
                  }}>
                    Launch graph workspaces, review active research sets, and move from document collections to reusable knowledge graphs without the interface feeling internal, noisy, or improvised.
                  </p>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => selectedCollection && navigate({ page: 'graph', collectionName: selectedCollection })}
                      disabled={!selectedCollection}
                      style={{ borderRadius: 999, padding: '12px 18px' }}
                    >
                      Open active workspace
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowCreateCol(true)}
                      style={{ borderRadius: 999, padding: '12px 18px' }}
                    >
                      Create collection
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <FeaturePill label="Deterministic NLP scaffold" />
                    <FeaturePill label="Bridge-aware graph memory" />
                    <FeaturePill label="Project and collection views" />
                  </div>
                </div>

                <GraphPreviewCard compact={isDense} />
              </div>
            </div>

            <aside style={{
              borderRadius: 26,
              border: '1px solid var(--border)',
              background: 'var(--surface-raised)',
              boxShadow: '0 18px 44px rgba(0,0,0,0.25)',
              padding: isDense ? '18px' : '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Quick Launch
                </div>
                <div style={{ fontSize: 28, lineHeight: 1.02, letterSpacing: '-0.05em', color: 'var(--text-primary)', marginBottom: 10 }}>
                  Open the right graph in one move.
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-secondary)' }}>
                  Pick a collection, jump straight into Graph Studio, and keep the rest of your research memory intact.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <label htmlFor="collection-launch-select" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Active Collection
                </label>
                <select
                  id="collection-launch-select"
                  value={selectedCollection}
                  onChange={e => setSelectedCollection(e.target.value)}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: '14px 16px',
                    fontSize: 14,
                    color: selectedCollection ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    minHeight: 52,
                  }}
                >
                  <option value="">Select a collection</option>
                  {allCollections.map(c => (
                    <option key={c.name} value={c.name}>
                      {c.name} - {c.projectCount} project{c.projectCount !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isDense ? '1fr' : '1fr 1fr', gap: 10 }}>
                <button
                  id="launch-graph-studio-btn"
                  className="btn btn-primary"
                  disabled={!selectedCollection}
                  onClick={() => navigate({ page: 'graph', collectionName: selectedCollection })}
                  style={{ justifyContent: 'center', borderRadius: 16, minHeight: 50 }}
                >
                  Open graph
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCreateDir(true)}
                  style={{ justifyContent: 'center', borderRadius: 16, minHeight: 50 }}
                >
                  New directory
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: isDense ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                gap: 10,
              }}>
                <MetricPanel label="Collections" value={totals.collectionCount} />
                <MetricPanel label="Projects" value={totals.projectCount} />
                <MetricPanel label="Entities" value={totals.entityCount} />
              </div>
            </aside>
          </div>
        </section>

        <section style={{
          display: 'grid',
          gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 1.2fr) minmax(280px, 0.8fr)',
          gap: 18,
          marginBottom: 24,
        }}>
          <div style={{
            borderRadius: 24,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: '0 14px 36px rgba(0,0,0,0.2)',
            padding: isDense ? '18px' : '22px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
              Workspace Overview
            </div>
            <div style={{ fontSize: 28, lineHeight: 1.04, letterSpacing: '-0.05em', color: 'var(--text-primary)', marginBottom: 10 }}>
              Structured memory across active collections.
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-secondary)', marginBottom: 18, maxWidth: 760 }}>
              The homepage is now treated like a portfolio surface, not a control panel. Collections stay visible, actions remain immediate, and the graph product feels closer to the public Nitanics experience.
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}>
              <InsightCard
                title="Persistent graph memory"
                body="Each collection remains intact as new projects are added, so the graph compounds instead of resetting."
              />
              <InsightCard
                title="Scoped exploration"
                body="Collection, project, and bridge views let the same graph answer different research questions cleanly."
              />
              <InsightCard
                title="Investor-grade presentation"
                body="Cleaner hierarchy, quieter surfaces, and stronger spacing make the product feel more deliberate."
              />
            </div>
          </div>

          <div style={{
            borderRadius: 24,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: '0 14px 36px rgba(0,0,0,0.2)',
            padding: isDense ? '18px' : '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                Featured Collections
              </div>
              <div style={{ fontSize: 22, lineHeight: 1.06, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
                Fast access to active graph work.
              </div>
            </div>

            {featuredCollections.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No collections available yet.</div>
            ) : (
              featuredCollections.map(collection => (
                <button
                  key={collection.name}
                  onClick={() => navigate({ page: 'graph', collectionName: collection.name })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    width: '100%',
                    textAlign: 'left',
                    borderRadius: 18,
                    border: '1px solid var(--border)',
                    background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-raised) 100%)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {collection.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {collection.projectCount} {collection.projectCount === 1 ? 'project' : 'projects'}
                    </div>
                  </div>
                  <span className="pill pill-tag">Open</span>
                </button>
              ))
            )}
          </div>
        </section>

        {deleteError && (
          <div style={{
            marginBottom: 18,
            padding: '12px 16px',
            background: 'rgba(244,63,94,0.05)',
            border: '1px solid rgba(244,63,94,0.16)',
            borderRadius: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 14,
            maxWidth: 620,
          }}>
            <span style={{ fontSize: 13, color: 'var(--error)' }}>{deleteError}</span>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }} onClick={() => setDeleteError(null)}>x</button>
          </div>
        )}

        {showCreateDir && (
          <FormCard title="Create Directory" subtitle="Add a new portfolio container for collections.">
            <input className="input" placeholder="Directory name" value={newDirName} onChange={e => setNewDirName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateDir()} autoFocus style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateDir(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateDir} disabled={!newDirName.trim()}>Create</button>
            </div>
          </FormCard>
        )}

        {showCreateCol && (
          <FormCard title="Create Collection" subtitle="Launch a new knowledge graph workspace.">
            <input className="input" placeholder="Collection name" value={newColName} onChange={e => setNewColName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateCol()} autoFocus style={{ marginBottom: 10 }} />
            <select className="input" value={newColDir} onChange={e => setNewColDir(e.target.value)} style={{ marginBottom: 12, background: 'var(--surface)', border: '1px solid var(--border)', color: '#fff' }}>
              <option value="">No directory</option>
              {directories.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateCol(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateCol} disabled={!newColName.trim()}>Create</button>
            </div>
          </FormCard>
        )}

        {directories.length === 0 && allCollections.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 20 }}>
            {directories.map(dir => (
              <DirectorySection
                key={dir.name}
                dir={dir}
                collections={allCollections.filter(c => c.directory === dir.name)}
                onLaunch={name => navigate({ page: 'graph', collectionName: name })}
                onViewCollection={name => navigate({ page: 'collection', name })}
                onDeleteDir={() => setDeleteTarget(dir.name)}
                compact={isDense}
              />
            ))}

            {allCollections.filter(c => !c.directory).length > 0 && (
              <DirectorySection
                key="uncategorized"
                dir={{ name: 'Independent Collections', collectionCount: allCollections.filter(c => !c.directory).length, projectCount: 0, entityCount: 0 }}
                collections={allCollections.filter(c => !c.directory)}
                onLaunch={name => navigate({ page: 'graph', collectionName: name })}
                onViewCollection={name => navigate({ page: 'collection', name })}
                onDeleteDir={() => {}}
                hideStats
                compact={isDense}
              />
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Directory"
        message={`Delete "${deleteTarget}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function DirectorySection({
  dir,
  collections,
  onLaunch,
  onViewCollection,
  onDeleteDir,
  hideStats,
  compact,
}: {
  dir: { name: string; description?: string | null; collectionCount: number; projectCount: number; entityCount: number }
  collections: Array<{ name: string; projectCount: number; directory?: string }>
  onLaunch: (name: string) => void
  onViewCollection: (name: string) => void
  onDeleteDir: () => void
  hideStats?: boolean
  compact?: boolean
}) {
  return (
    <section style={{
      borderRadius: 26,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      boxShadow: '0 14px 36px rgba(0,0,0,0.2)',
      padding: compact ? '18px' : '22px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 18,
        marginBottom: 18,
        flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Directory
          </div>
          <h2 style={{ fontSize: compact ? 24 : 30, lineHeight: 1, letterSpacing: '-0.05em', color: 'var(--text-primary)', marginBottom: 8 }}>
            {dir.name}
          </h2>
          {!hideStats && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>{dir.collectionCount} collection{dir.collectionCount !== 1 ? 's' : ''}</span>
              <span style={{ color: 'var(--border)' }}>•</span>
              <span>{dir.projectCount} project{dir.projectCount !== 1 ? 's' : ''}</span>
              <span style={{ color: 'var(--border)' }}>•</span>
              <span>{dir.entityCount} entities</span>
            </div>
          )}
        </div>

        {!hideStats && (
          <button
            className="btn btn-danger"
            style={{ padding: '9px 12px', fontSize: 12, borderRadius: 999 }}
            disabled={dir.projectCount > 0}
            title={dir.projectCount > 0 ? 'Cannot delete while projects exist' : 'Delete directory'}
            onClick={onDeleteDir}
          >
            Delete Directory
          </button>
        )}
      </div>

      {collections.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0 2px' }}>No collections in this directory yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {collections.map(col => (
            <CollectionCard key={col.name} name={col.name} projectCount={col.projectCount} onLaunch={onLaunch} onViewCollection={onViewCollection} />
          ))}
        </div>
      )}
    </section>
  )
}

function CollectionCard({
  name,
  projectCount,
  onLaunch,
  onViewCollection,
}: {
  name: string
  projectCount: number
  onLaunch: (name: string) => void
  onViewCollection: (name: string) => void
}) {
  return (
    <div style={{
      borderRadius: 22,
      padding: '18px',
      background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-raised) 100%)',
      border: '1px solid var(--border)',
      boxShadow: '0 10px 26px rgba(0,0,0,0.15)',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Collection
          </div>
          <div className="data-link" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', textDecoration: 'none', lineHeight: 1.05 }} onClick={() => onViewCollection(name)}>
            {name}
          </div>
        </div>
        <div style={{
          minWidth: 68,
          height: 68,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          fontWeight: 700,
          fontSize: 20,
        }}>
          {projectCount}
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75 }}>
        Ready for graph exploration, bridge review, and project-level analysis without re-reading every source from scratch.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="pill pill-tag">{projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
        <span className="pill pill-tag">Knowledge graph</span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', borderRadius: 16, minHeight: 46 }} onClick={() => onLaunch(name)}>
          Open Graph Studio
        </button>
        <button className="btn btn-secondary" style={{ borderRadius: 16, minHeight: 46 }} onClick={() => onViewCollection(name)}>
          Browse
        </button>
      </div>
    </div>
  )
}

function GraphPreviewCard({ compact }: { compact?: boolean }) {
  return (
    <div style={{
      borderRadius: 24,
      border: '1px solid rgba(31,41,55,0.08)',
      background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-raised) 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      padding: compact ? '16px' : '18px',
      minHeight: compact ? 240 : 280,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
        Graph Surface
      </div>
      <div style={{
        position: 'relative',
        height: compact ? 160 : 188,
        borderRadius: 20,
        border: '1px solid var(--border-subtle)',
        background: 'radial-gradient(circle at top, rgba(56,189,248,0.06), rgba(15,17,26,0.74) 48%, rgba(15,17,26,0.96) 100%)',
      }}>
        <GraphNode left="12%" top="56%" size={18} tone="#7f87a7" />
        <GraphNode left="28%" top="30%" size={16} tone="#6c7592" />
        <GraphNode left="31%" top="68%" size={14} tone="#8b77c0" />
        <GraphNode left="52%" top="42%" size={28} tone="#151b2a" strong />
        <GraphNode left="64%" top="24%" size={15} tone="#b08b55" />
        <GraphNode left="73%" top="58%" size={17} tone="#7b83a5" />
        <GraphNode left="84%" top="38%" size={13} tone="#c09a68" />

        <GraphEdge from={{ x: 18, y: 62 }} to={{ x: 52, y: 44 }} />
        <GraphEdge from={{ x: 28, y: 32 }} to={{ x: 52, y: 44 }} />
        <GraphEdge from={{ x: 31, y: 70 }} to={{ x: 52, y: 44 }} />
        <GraphEdge from={{ x: 52, y: 44 }} to={{ x: 64, y: 26 }} />
        <GraphEdge from={{ x: 52, y: 44 }} to={{ x: 73, y: 60 }} />
        <GraphEdge from={{ x: 73, y: 60 }} to={{ x: 84, y: 40 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <span className="pill pill-tag">Collection</span>
        <span className="pill pill-tag">Project</span>
        <span className="pill pill-tag">Bridge</span>
      </div>
    </div>
  )
}

function GraphNode({
  left,
  top,
  size,
  tone,
  strong,
}: {
  left: string
  top: string
  size: number
  tone: string
  strong?: boolean
}) {
  return (
    <div style={{
      position: 'absolute',
      left,
      top,
      width: size,
      height: size,
      borderRadius: '50%',
      background: tone,
      transform: 'translate(-50%, -50%)',
      boxShadow: strong ? '0 0 0 10px rgba(21,27,42,0.04)' : '0 0 0 6px rgba(17,24,39,0.03)',
    }} />
  )
}

function GraphEdge({
  from,
  to,
}: {
  from: { x: number; y: number }
  to: { x: number; y: number }
}) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const width = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * 180 / Math.PI
  return (
    <div style={{
      position: 'absolute',
      left: `${from.x}%`,
      top: `${from.y}%`,
      width: `${width}%`,
      height: 1,
      borderTop: '1px dashed rgba(102,112,133,0.26)',
      transformOrigin: '0 0',
      transform: `rotate(${angle}deg)`,
    }} />
  )
}

function MetricPanel({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: '14px 14px 16px',
      borderRadius: 18,
      border: '1px solid var(--border-subtle)',
      background: 'var(--surface-hover)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 700, letterSpacing: '-0.05em', color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

function FeaturePill({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 999,
      background: 'var(--surface-raised)',
      border: '1px solid var(--border)',
      color: 'var(--text-secondary)',
      fontSize: 12,
      fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
      {label}
    </span>
  )
}

function InsightCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={{
      borderRadius: 18,
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--accent)',
      background: 'var(--surface-raised)',
      padding: '16px 16px 18px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
    }}>
      <div style={{ fontSize: 17, lineHeight: 1.15, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 8, fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-secondary)' }}>
        {body}
      </div>
    </div>
  )
}

function FormCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{
      maxWidth: 460,
      marginBottom: 18,
      borderRadius: 22,
      padding: 20,
      background: 'var(--surface-raised)',
      backdropFilter: 'blur(16px)',
      border: '1px solid var(--border)',
      boxShadow: '0 14px 36px rgba(0, 0, 0, 0.3)',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{subtitle}</div>
      {children}
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14 }}>
      <div style={{ width: 34, height: 34, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Connecting to graph database...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      borderRadius: 24,
      background: 'var(--surface)',
      border: '1px dashed var(--border)',
      boxShadow: '0 14px 36px rgba(0, 0, 0, 0.25)',
      textAlign: 'center',
      padding: '60px 24px',
      color: 'var(--text-muted)',
    }}>
      <div style={{
        width: 54,
        height: 54,
        borderRadius: '50%',
        background: 'var(--accent-dim)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        color: 'var(--accent)',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No directories yet</div>
      <div style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>Create a directory or collection to start building a more presentable graph workspace.</div>
    </div>
  )
}
