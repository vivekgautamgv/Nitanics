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

export default function LeftSidebar() {
  return (
    <aside
      className="h-full overflow-y-auto flex-shrink-0"
      style={{
        width: 292,
        background: 'rgba(15, 17, 26, 0.85)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CollectionHeader />
        <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 10px 24px rgba(0, 0, 0, 0.3)' }}>
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
