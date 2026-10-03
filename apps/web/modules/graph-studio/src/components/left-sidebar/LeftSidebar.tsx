import CollectionHeader from './CollectionHeader'
import SearchBar from './SearchBar'
import ImportanceSlider from './ImportanceSlider'
import ProjectFilter from './ProjectFilter'
import CategoryFilter from './CategoryFilter'
import BridgeFilter from './BridgeFilter'
import EdgeTypeFilter from './EdgeTypeFilter'
import PathFinder from './PathFinder'
import SavedViews from './SavedViews'
import ExportButton from './ExportButton'

export default function LeftSidebar({ overlay = false, hidden = false, onClose }: { overlay?: boolean; hidden?: boolean; onClose?: () => void }) {
  return (
    <aside
      id="nitanics-graph-filters"
      hidden={hidden}
      aria-label="Graph filters and search"
      className={`nitanics-studio-sidebar nitanics-studio-filters ${overlay ? 'nitanics-studio-sidebar-overlay' : ''}`}
      style={{
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="nitanics-studio-panel-heading">
          <span>Filters and search</span>
          {onClose && <button type="button" className="nitanics-studio-panel-close" onClick={onClose} aria-label="Close graph filters">Close</button>}
        </div>
        <CollectionHeader />
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 1px 3px rgba(24, 24, 27, 0.08)' }}>
          <SearchBar />
          <ImportanceSlider />
          <ProjectFilter />
          <CategoryFilter />
          <BridgeFilter />
          <EdgeTypeFilter />
          <PathFinder />
          <SavedViews />
          <ExportButton />
        </div>
      </div>
    </aside>
  )
}
