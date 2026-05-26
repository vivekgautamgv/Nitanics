import { useGraphStore } from '../../stores/graph-store'
import { useSelectionStore } from '../../stores/selection-store'

export default function CollectionHeader() {
  const collection = useGraphStore(s => s.collection)
  const allCount = useGraphStore(s => s.allNodes.filter(n => n.__type === 'entity').length)
  const filteredCount = useGraphStore(s => s.filteredNodes.filter(n => n.__type === 'entity').length)
  const linkCount = useGraphStore(s => s.filteredLinks.length)
  const projectCount = useGraphStore(s => s.projects.length)
  const openCollectionCard = useSelectionStore(s => s.openCollectionCard)

  return (
    <button
      type="button"
      className="w-full text-left"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 18,
        background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-raised) 100%)',
        padding: '16px 16px 14px',
        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.3)',
        cursor: 'pointer',
      }}
      onClick={openCollectionCard}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={{ color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700, marginBottom: 4 }}>
            Collection
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            {collection}
          </div>
        </div>
        <div style={{
          minWidth: 42,
          height: 42,
          borderRadius: 14,
          background: 'var(--surface-hover)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 700,
        }}>
          {projectCount}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <HeaderMetric label="Entities" value={filteredCount === allCount ? allCount : `${filteredCount}/${allCount}`} />
        <HeaderMetric label="Edges" value={linkCount} />
        <HeaderMetric label="Projects" value={projectCount} />
      </div>
    </button>
  )
}

function HeaderMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      borderRadius: 14,
      padding: '10px 10px 9px',
      background: 'var(--surface-hover)',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
        {label}
      </div>
    </div>
  )
}
