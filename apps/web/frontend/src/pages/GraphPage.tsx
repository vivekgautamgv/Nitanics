import { useState, useEffect } from 'react'
import GraphStudioAdapter from '@/adapters/graph-studio'
import { useNavigationStore } from '@/stores/navigation-store'
import { useDirectoryStore } from '@/stores/directory-store'

type GraphMode = 'collection' | 'project' | 'bridge'

const MODE_CONFIG: Record<GraphMode, { label: string; shortLabel: string; dotColor: string }> = {
  collection: {
    label: 'Collection Graph',
    shortLabel: 'Collection',
    dotColor: 'var(--accent)',
  },
  project: {
    label: 'Project Graph',
    shortLabel: 'Project',
    dotColor: '#7460b8',
  },
  bridge: {
    label: 'Bridge View',
    shortLabel: 'Bridge',
    dotColor: '#9a6b3f',
  },
}

export default function GraphPage({ collectionName }: { collectionName: string }) {
  const navigate = useNavigationStore(s => s.navigate)
  const allCollections = useDirectoryStore(s => s.allCollections)
  const loadAllCollections = useDirectoryStore(s => s.loadAllCollections)

  const [mode, setMode] = useState<GraphMode>('collection')
  const [activeCollection, setActiveCollection] = useState(collectionName)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined)
  const [projects, setProjects] = useState<Array<{ name: string; uniqueId: string }>>([])

  const collectionData = allCollections.find(c => c.name === activeCollection)
  const projectCount = collectionData?.projectCount ?? 0
  const modeInfo = MODE_CONFIG[mode]

  useEffect(() => {
    if (allCollections.length === 0) loadAllCollections()
  }, [allCollections.length, loadAllCollections])

  useEffect(() => {
    if (mode !== 'project') return
    import('@graph/services/queries').then(q => {
      q.fetchCollectionProjects(activeCollection).then(ps => {
        setProjects(ps.map(p => ({ name: p.name, uniqueId: p.uniqueId })))
        if (!selectedProjectId && ps.length > 0) setSelectedProjectId(ps[0].uniqueId)
      }).catch(() => {})
    })
  }, [mode, activeCollection, selectedProjectId])

  const handleCollectionChange = (name: string) => {
    setActiveCollection(name)
    setMode('collection')
    setSelectedProjectId(undefined)
    setProjects([])
    navigate({ page: 'graph', collectionName: name })
  }

  const handleModeChange = (newMode: GraphMode) => {
    setMode(newMode)
    if (newMode !== 'project') setSelectedProjectId(undefined)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 72px)',
      minHeight: 0,
      overflow: 'hidden',
      padding: '10px 12px 12px',
      gap: 10,
      fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 18,
        background: 'var(--surface-raised)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 180 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
              Graph Workspace
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.05 }}>
              {activeCollection}
            </div>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: 4, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            {(Object.entries(MODE_CONFIG) as [GraphMode, typeof MODE_CONFIG[GraphMode]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => handleModeChange(key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: 'none',
                  background: mode === key ? 'var(--surface-hover)' : 'transparent',
                  boxShadow: mode === key ? '0 2px 8px rgba(0, 0, 0, 0.4)' : 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dotColor, opacity: mode === key ? 1 : 0.75 }} />
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <MetricChip label="Projects" value={projectCount} />
          <MetricChip label="Mode" value={modeInfo.shortLabel} accent={modeInfo.dotColor} />

          <select value={activeCollection} onChange={e => handleCollectionChange(e.target.value)} style={selectStyle}>
            {allCollections.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>

          {mode === 'project' && projects.length > 0 && (
            <select value={selectedProjectId ?? ''} onChange={e => setSelectedProjectId(e.target.value)} style={selectStyle}>
              {projects.map(p => (
                <option key={p.uniqueId} value={p.uniqueId}>{p.name}</option>
              ))}
            </select>
          )}

          <button className="btn btn-secondary" style={{ borderRadius: 999, padding: '10px 14px', fontFamily: 'inherit' }} onClick={() => navigate({ page: 'collection', name: activeCollection })}>
            Back
          </button>
        </div>
      </div>

      <div style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        borderRadius: 22,
        overflow: 'hidden',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.4)',
      }}>
        <GraphStudioAdapter
          collectionName={activeCollection}
          graphMode={mode}
          selectedProjectId={selectedProjectId}
        />
      </div>
    </div>
  )
}

function MetricChip({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 16,
      background: 'var(--surface)',
      border: '1px solid var(--border-subtle)',
      minWidth: 88,
      fontFamily: 'inherit',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.1, fontWeight: 700, color: accent || 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '10px 14px',
  fontSize: 13,
  color: 'var(--text-primary)',
  cursor: 'pointer',
  minWidth: 220,
  fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
}
