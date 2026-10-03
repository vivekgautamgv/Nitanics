import { useState, useEffect } from 'react'
import GraphStudioAdapter, { useRefreshOnFocus } from '@/adapters/graph-studio'
import { useDirectoryStore } from '../../stores/directory-store'
import { fetchCollectionProjects } from '@graph/services/queries'

type GraphMode = 'collection' | 'project' | 'bridge'

const MODE_CONFIG: Record<GraphMode, { label: string }> = {
  collection: { label: 'Collection' },
  project: { label: 'Document' },
  bridge: { label: 'Bridges' },
}

interface CollectionGraphPanelProps {
  collectionName: string
  embedded?: boolean
}

export default function CollectionGraphPanel({ collectionName, embedded = true }: CollectionGraphPanelProps) {
  const allCollections = useDirectoryStore(s => s.allCollections)
  const loadAllCollections = useDirectoryStore(s => s.loadAllCollections)

  const [mode, setMode] = useState<GraphMode>('collection')
  const [selection, setSelection] = useState<{ collection: string; projectId?: string }>({ collection: collectionName })
  const [projectScope, setProjectScope] = useState<{
    collection: string
    projects: Array<{ name: string; uniqueId: string }>
    status: 'loading' | 'ready' | 'error'
    error?: string
  }>({ collection: collectionName, projects: [], status: 'loading' })
  const [projectReload, setProjectReload] = useState(0)
  const projects = projectScope.collection === collectionName ? projectScope.projects : []
  const selectedProjectId = selection.collection === collectionName ? selection.projectId : undefined
  const projectsReady = projectScope.collection === collectionName && projectScope.status === 'ready'
  useRefreshOnFocus(() => {
    void loadAllCollections()
    if (mode === 'project') setProjectReload(value => value + 1)
  })
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const collectionData = allCollections.find(c => c.name === collectionName)
  const projectCount = collectionData?.projectCount ?? 0

  useEffect(() => {
    if (allCollections.length === 0) loadAllCollections()
  }, [allCollections.length, loadAllCollections])

  useEffect(() => {
    if (mode !== 'project') return
    let cancelled = false
    setProjectScope({ collection: collectionName, projects: [], status: 'loading' })
    fetchCollectionProjects(collectionName).then(ps => {
      if (cancelled) return
      setProjectScope({ collection: collectionName, projects: ps, status: 'ready' })
      setSelection(current => ({
        collection: collectionName,
        projectId: current.collection === collectionName && ps.some(p => p.uniqueId === current.projectId)
          ? current.projectId
          : ps[0]?.uniqueId,
      }))
    }).catch(error => {
      if (cancelled) return
      setProjectScope({ collection: collectionName, projects: [], status: 'error', error: error instanceof Error ? error.message : String(error) })
    })
    return () => { cancelled = true }
  }, [mode, collectionName, projectReload])

  return (
    <div className={`graph-panel ${embedded ? 'graph-panel-embedded' : ''} ${fullscreen ? 'graph-panel-fullscreen' : ''}`}>
      <div className="graph-toolbar graph-toolbar-premium">
        <div className="graph-toolbar-left">
          <div>
            <div className="eyebrow">Interactive graph</div>
            <div className="graph-toolbar-title">{collectionName}</div>
          </div>
          <div className="segmented-control">
            {(Object.entries(MODE_CONFIG) as [GraphMode, { label: string }][]).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                className={`segmented-item ${mode === key ? 'segmented-item-active' : ''}`}
                onClick={() => {
                  setMode(key)
                }}
              >
                {cfg.label}
              </button>
            ))}
          </div>
          {mode === 'project' && projects.length > 0 && (
            <select
              className="input input-inline"
              aria-label="Select document graph"
              value={selectedProjectId ?? ''}
              onChange={e => setSelection({ collection: collectionName, projectId: e.target.value })}
            >
              {projects.map(p => (
                <option key={p.uniqueId} value={p.uniqueId}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="graph-toolbar-right">
          <span className="graph-meta">{projectCount} documents</span>
          <span className="graph-meta">Click nodes for full details</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm graph-fullscreen-btn"
            title={fullscreen ? 'Exit full screen (Esc)' : 'Open full screen'}
            onClick={() => setFullscreen(f => !f)}
          >
            {fullscreen ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Exit
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Full screen
              </>
            )}
          </button>
        </div>
      </div>
      <div className="graph-canvas-wrap graph-studio-premium">
        {mode === 'project' && (!projectsReady || !selectedProjectId) ? (
          <div className="empty-state" role="status" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {projectScope.collection === collectionName && projectScope.status === 'error' ? (
              <>
                <span>Could not load documents: {projectScope.error}</span>
                <button type="button" className="btn btn-secondary" onClick={() => setProjectReload(value => value + 1)}>Retry</button>
              </>
            ) : projectsReady ? 'Add a document to this collection to explore its graph.' : 'Loading documents...'}
          </div>
        ) : (
          <GraphStudioAdapter
            collectionName={collectionName}
            graphMode={mode}
            selectedProjectId={selectedProjectId}
          />
        )}
      </div>
    </div>
  )
}
