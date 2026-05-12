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
        background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(250,250,248,0.96) 100%)',
        borderRight: '1px solid var(--border)',
        boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.45)',
      }}
    >
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CollectionHeader />
        <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.92)', boxShadow: '0 10px 24px rgba(15,23,42,0.04)' }}>
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
