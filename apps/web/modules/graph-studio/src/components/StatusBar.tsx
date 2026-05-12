import { useGraphStore } from '../stores/graph-store'
import { useUIStore } from '../stores/ui-store'

export default function StatusBar() {
  const filteredNodes = useGraphStore(s => s.filteredNodes)
  const filteredLinks = useGraphStore(s => s.filteredLinks)
  const allNodes = useGraphStore(s => s.allNodes)
  const allLinks = useGraphStore(s => s.allLinks)
  const highlightedPath = useGraphStore(s => s.highlightedPath)
  const searchHighlights = useGraphStore(s => s.searchHighlights)
  const currentZoom = useUIStore(s => s.currentZoom)
  const unpinAllNodes = useUIStore(s => s.unpinAllNodes)
  const reheatSimulation = useUIStore(s => s.reheatSimulation)

  const entityCount = filteredNodes.filter(n => n.__type === 'entity').length
  const projectCount = filteredNodes.filter(n => n.__type === 'project').length
  const isFiltered = filteredNodes.length !== allNodes.length || filteredLinks.length !== allLinks.length

  return (
    <div
      className="absolute bottom-3 left-3 right-3 flex items-center justify-between"
      style={{
        background: 'rgba(255,255,255,0.90)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        color: 'var(--text-secondary)',
        zIndex: 10,
        backdropFilter: 'blur(10px)',
        padding: '8px 10px',
        boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
      }}
    >
      <div className="flex items-center gap-3" style={{ pointerEvents: 'none', fontSize: 12 }}>
        <span>{entityCount} entities</span>
        <span>{projectCount} projects</span>
        <span>{filteredLinks.length} edges</span>
        {isFiltered && <span style={{ color: 'var(--text-muted)' }}>filtered from {allNodes.length}/{allLinks.length}</span>}
      </div>

      <div className="flex items-center gap-2" style={{ fontSize: 12 }}>
        {searchHighlights.size > 0 && <span style={{ color: 'var(--warning)', pointerEvents: 'none' }}>{searchHighlights.size} matches</span>}
        {highlightedPath.length > 0 && <span style={{ color: 'var(--text-primary)', pointerEvents: 'none' }}>Path {highlightedPath.length}</span>}
        <span style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}>{currentZoom.toFixed(1)}x</span>
        <div className="flex gap-1 ml-1" style={{ pointerEvents: 'auto' }}>
          <button
            onClick={() => unpinAllNodes?.()}
            style={{
              background: 'rgba(17,24,39,0.04)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 12,
            }}
            title="Unpin all dragged nodes and reheat layout"
          >
            Unpin
          </button>
          <button
            onClick={() => reheatSimulation?.()}
            style={{
              background: 'rgba(17,24,39,0.04)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 12,
            }}
            title="Reheat force simulation"
          >
            Reheat
          </button>
        </div>
      </div>
    </div>
  )
}
