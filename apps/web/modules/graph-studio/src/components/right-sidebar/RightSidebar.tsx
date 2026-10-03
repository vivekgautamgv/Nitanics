import { useSelectionStore } from '../../stores/selection-store'
import { useGraphStore } from '../../stores/graph-store'
import PrimaryCard from './PrimaryCard'
import ProjectCard from './ProjectCard'
import CollectionCard from './CollectionCard'
import ExplorationCard from './ExplorationCard'

export default function RightSidebar({ overlay = false, onClose }: { overlay?: boolean; onClose?: () => void }) {
  const selectedNode = useSelectionStore(s => s.selectedNode)
  const lockedNode = useSelectionStore(s => s.lockedNode)
  const entityDetails = useSelectionStore(s => s.entityDetails)
  const explorationStack = useSelectionStore(s => s.explorationStack)
  const isLoadingDetail = useSelectionStore(s => s.isLoadingDetail)
  const detailError = useSelectionStore(s => s.detailError)
  const retryDetail = useSelectionStore(s => s.retryDetail)
  const showCollectionCard = useSelectionStore(s => s.showCollectionCard)
  const removeExplorationCard = useSelectionStore(s => s.removeExplorationCard)
  const toggleExplorationExpanded = useSelectionStore(s => s.toggleExplorationExpanded)
  const navigateTo = useSelectionStore(s => s.navigateTo)
  const clearAll = useSelectionStore(s => s.clearAll)

  const projects = useGraphStore(s => s.projects)

  if (!selectedNode && !showCollectionCard) return null

  const primaryNode = lockedNode || selectedNode
  const detail = primaryNode ? entityDetails.get(primaryNode.name) : null

  return (
    <aside
      id="nitanics-graph-inspector"
      aria-label="Graph inspector"
      className={`nitanics-studio-sidebar nitanics-studio-inspector ${overlay ? 'nitanics-studio-sidebar-overlay' : ''}`}
      style={{
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>
        <div style={{
          borderRadius: 18,
          border: '1px solid var(--border)',
          background: 'var(--surface-raised)',
          boxShadow: '0 1px 3px rgba(24, 24, 27, 0.08)',
          overflow: 'hidden',
          flex: 1,
        }}>
          <div className="flex items-center justify-between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700, marginBottom: 4 }}>
                Inspector
              </div>
              <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>
                Graph Detail
              </div>
            </div>
            <button
              onClick={onClose ?? clearAll}
              aria-label="Close graph inspector"
              style={{
                color: 'var(--text-muted)',
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
              title="Close panel"
            >
              Close
            </button>
          </div>

          {showCollectionCard && (
            <div className="p-3">
              <CollectionCard />
            </div>
          )}

          {!showCollectionCard && isLoadingDetail && !detail && (
            <div className="p-4">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading selection...</p>
            </div>
          )}

          {!showCollectionCard && detailError && (
            <div className="p-4" role="alert">
              <p className="text-xs" style={{ color: 'var(--error)' }}>{detailError}</p>
              <button onClick={retryDetail} className="mt-3 rounded-full border px-3 py-1.5 text-xs" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>Retry details</button>
            </div>
          )}

          {primaryNode && primaryNode.__type === 'project' && (
            <div className="p-3">
              <ProjectCard
                project={projects.find(p => p.uniqueId === primaryNode.id) || {
                  name: primaryNode.name,
                  uniqueId: primaryNode.id,
                  summary: '',
                  domain: '',
                  subdomain: '',
                  baseTags: [],
                  htmlPath: '',
                }}
              />
            </div>
          )}
          {lockedNode && selectedNode && selectedNode.__type === 'project' && (
            <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <ProjectCard
                project={projects.find(p => p.uniqueId === selectedNode.id) || {
                  name: selectedNode.name,
                  uniqueId: selectedNode.id,
                  summary: '',
                  domain: '',
                  subdomain: '',
                  baseTags: [],
                  htmlPath: '',
                }}
              />
            </div>
          )}

          {primaryNode && primaryNode.__type === 'entity' && detail && (
            <div className="p-3">
              <PrimaryCard node={primaryNode} detail={detail} />
            </div>
          )}

          {explorationStack.length > 0 && lockedNode && (
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {explorationStack.map(card => (
                <ExplorationCard
                  key={card.entity.name}
                  card={card}
                  lockedName={lockedNode.name}
                  onClose={() => removeExplorationCard(card.entity.name)}
                  onToggle={() => toggleExplorationExpanded(card.entity.name)}
                  onNavigate={navigateTo}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
