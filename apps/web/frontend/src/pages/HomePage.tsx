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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '320px 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        
        {/* Left Explorer Side Panel */}
        <div style={{
          background: 'var(--surface-raised)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}>
          <div style={{ padding: '20px 18px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
              Workspace
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Explorer</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button title="Create Directory" className="btn btn-secondary" onClick={() => setShowCreateDir(true)} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 8, minHeight: 0 }}>
                  +Dir
                </button>
                <button title="Create Collection" className="btn btn-primary" onClick={() => setShowCreateCol(true)} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 8, minHeight: 0 }}>
                  +Coll
                </button>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px' }}>
            {directories.length === 0 && allCollections.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
                No directories found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {directories.map(dir => {
                  const colList = allCollections.filter(c => c.directory === dir.name)
                  return (
                    <div key={dir.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          📁 {dir.name}
                        </span>
                        {dir.projectCount === 0 && (
                          <button
                            onClick={() => setDeleteTarget(dir.name)}
                            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 10, opacity: 0.6 }}
                            title="Delete Directory"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 10 }}>
                        {colList.length === 0 ? (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 8px' }}>
                            Empty directory
                          </div>
                        ) : (
                          colList.map(col => {
                            const isActive = selectedCollection === col.name
                            return (
                              <button
                                key={col.name}
                                onClick={() => setSelectedCollection(col.name)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                                  background: isActive ? 'var(--surface-hover)' : 'transparent',
                                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%',
                                }}
                              >
                                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  🕸️ {col.name}
                                </span>
                                <span className="pill pill-tag" style={{ fontSize: 9, padding: '2px 5px' }}>
                                  {col.projectCount}
                                </span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Independent Collections */}
                {allCollections.filter(c => !c.directory).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ padding: '4px 8px' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        🔗 Independent
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 10 }}>
                      {allCollections.filter(c => !c.directory).map(col => {
                        const isActive = selectedCollection === col.name
                        return (
                          <button
                            key={col.name}
                            onClick={() => setSelectedCollection(col.name)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                              background: isActive ? 'var(--surface-hover)' : 'transparent',
                              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🕸️ {col.name}
                            </span>
                            <span className="pill pill-tag" style={{ fontSize: 9, padding: '2px 5px' }}>
                              {col.projectCount}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Dashboard Workspace Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: isDense ? '16px' : '28px', minWidth: 0 }}>
          
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

          {selectedCollection ? (
            // Workspace Card View for selected collection
            (() => {
              const colObj = allCollections.find(c => c.name === selectedCollection)
              const pCount = colObj?.projectCount || 0
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Collection Header Panel */}
                  <div style={{
                    padding: 24,
                    borderRadius: 24,
                    border: '1px solid var(--border)',
                    background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-raised) 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
                  }}>
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(circle at top right, rgba(251,191,36,0.08), transparent 38%)',
                      pointerEvents: 'none',
                    }} />

                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                      Active Workspace Node
                    </span>
                    
                    <h1 style={{ fontSize: isDense ? 28 : 42, lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.05em', color: 'var(--text-primary)', marginBottom: 12 }}>
                      🕸️ {selectedCollection}
                    </h1>

                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620, marginBottom: 20 }}>
                      This knowledge collection forms a structured cognitive layer. It preserves entity linkages, bridge anchors, and cause-effect chains compiled from all parsed sources.
                    </p>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => navigate({ page: 'graph', collectionName: selectedCollection })}
                        style={{ borderRadius: 999, padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="3" cy="8" r="2" />
                          <circle cx="13" cy="3" r="2" />
                          <circle cx="13" cy="13" r="2" />
                          <line x1="5" y1="7" x2="11" y2="4" />
                          <line x1="5" y1="9" x2="11" y2="12" />
                        </svg>
                        Open Graph Studio
                      </button>
                      
                      <button
                        className="btn btn-secondary"
                        onClick={() => navigate({ page: 'collection', name: selectedCollection })}
                        style={{ borderRadius: 999, padding: '12px 24px' }}
                      >
                        Browse Document Details
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => navigate({ page: 'ingest' })}
                        style={{ borderRadius: 999, padding: '12px 18px', borderStyle: 'dashed' }}
                      >
                        + Ingest to this collection
                      </button>
                    </div>
                  </div>

                  {/* dynamic graphics & settings grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1fr 1.2fr', gap: 18 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      <div style={{
                        padding: 20,
                        borderRadius: 18,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                          Collection Metadata
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Workspace Type</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Nexari Labs Graph Space</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Project Sources</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pCount} active document{pCount !== 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 2 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Cross-Project Bridges</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Auto-extracted</span>
                        </div>
                      </div>

                      <div style={{
                        padding: 20,
                        borderRadius: 18,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
                          Engine Features
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                            Durable retrieval (Saves up to 70% token overhead)
                          </span>
                          <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                            Holographic force-directed visualization
                          </span>
                          <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                            Bridge links showing common entities across files
                          </span>
                        </div>
                      </div>
                    </div>

                    <GraphPreviewCard compact={isDense} />
                  </div>
                </div>
              )
            })()
          ) : (
            // Default Welcome Dashboard view
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <section style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 30,
                border: '1px solid var(--border)',
                background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-raised) 100%)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.37)',
                padding: isDense ? '20px' : '30px',
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at top right, rgba(251,191,36,0.08), transparent 34%), radial-gradient(circle at bottom left, rgba(16,185,129,0.04), transparent 28%)',
                  pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative' }}>
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
                    Nexari Labs Workspace Portal
                  </div>

                  <h1 style={{
                    fontSize: isDense ? 30 : 48,
                    lineHeight: 0.98,
                    letterSpacing: '-0.05em',
                    color: 'var(--text-primary)',
                    maxWidth: 680,
                    marginBottom: 14,
                  }}>
                    High-fidelity intelligence network for compound knowledge.
                  </h1>
                  
                  <p style={{
                    fontSize: isDense ? 14 : 16,
                    lineHeight: 1.75,
                    color: 'var(--text-secondary)',
                    maxWidth: 640,
                    marginBottom: 22,
                  }}>
                    Store massive research histories in an integrated knowledge graph. Query across collections without high context token bills. Select a workspace collection from the Explorer on the left to start.
                  </p>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <FeaturePill label="Deterministic NLP scaffold" />
                    <FeaturePill label="Bridge-aware graph memory" />
                    <FeaturePill label="Carbon-Gold Obsidian Aesthetics" />
                  </div>
                </div>
              </section>

              <section style={{
                display: 'grid',
                gridTemplateColumns: isCompact ? '1fr' : '1.4fr 1fr',
                gap: 18,
              }}>
                <div style={{
                  borderRadius: 24,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  boxShadow: '0 14px 36px rgba(0,0,0,0.2)',
                  padding: isDense ? '18px' : '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                      Platform Overview
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
                      Graph metrics across active nodes.
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <MetricPanel label="Collections" value={totals.collectionCount} />
                    <MetricPanel label="Projects" value={totals.projectCount} />
                    <MetricPanel label="Entities" value={totals.entityCount} />
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                    marginTop: 8,
                  }}>
                    <InsightCard
                      title="Durable Memory"
                      body="Preserves all entities and relations when uploading new reports to a collection."
                    />
                    <InsightCard
                      title="Cross-Links"
                      body="Bridge view highlights items linking multiple files automatically."
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
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
                      Quick access.
                    </div>
                  </div>

                  {featuredCollections.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No collections available.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {featuredCollections.map(collection => (
                        <button
                          key={collection.name}
                          onClick={() => setSelectedCollection(collection.name)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            borderRadius: 14,
                            border: '1px solid var(--border)',
                            background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-raised) 100%)',
                            padding: '12px 14px',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                              {collection.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {collection.projectCount} project{collection.projectCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <span className="pill pill-tag">Select</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
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

function DirectorySection() {
  return null
}

function CollectionCard() {
  return null
}

function GraphPreviewCard({ compact }: { compact?: boolean }) {
  return (
    <div style={{
      borderRadius: 24,
      border: '1px solid var(--border)',
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
        background: 'radial-gradient(circle at top, rgba(251,191,36,0.08), rgba(18,20,31,0.74) 48%, rgba(18,20,31,0.96) 100%)',
      }}>
        <GraphNode left="12%" top="56%" size={18} tone="#758195" />
        <GraphNode left="28%" top="30%" size={16} tone="#b08b55" />
        <GraphNode left="31%" top="68%" size={14} tone="#9ba3b0" />
        <GraphNode left="52%" top="42%" size={28} tone="var(--accent)" strong />
        <GraphNode left="64%" top="24%" size={15} tone="#a17252" />
        <GraphNode left="73%" top="58%" size={17} tone="#aeb4bd" />
        <GraphNode left="84%" top="38%" size={13} tone="#b39352" />

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
      boxShadow: strong ? '0 0 16px var(--accent)' : '0 0 0 6px rgba(251,191,36,0.02)',
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
