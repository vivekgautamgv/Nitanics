import { useGraphStore } from '../stores/graph-store'
import { CATEGORY_COLORS, BRIDGE_COLORS } from '../constants/colors'

const BRIDGE_TIERS = [
  { key: 'gold', label: 'Gold', symbol: 'G' },
  { key: 'silver', label: 'Silver', symbol: 'S' },
  { key: 'bronze', label: 'Bronze', symbol: 'B' },
] as const

export default function Legend() {
  const categoryFilter = useGraphStore(s => s.categoryFilter)
  const toggleCategory = useGraphStore(s => s.toggleCategory)
  const allNodes = useGraphStore(s => s.allNodes)

  const activeCategories = new Map<string, number>()
  for (const node of allNodes) {
    if (node.__type === 'entity') {
      activeCategories.set(node.category, (activeCategories.get(node.category) || 0) + 1)
    }
  }

  const categories = Array.from(activeCategories.entries()).sort((a, b) => b[1] - a[1])

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 flex-shrink-0 overflow-x-auto"
      style={{
        background: 'rgba(255,255,255,0.88)',
        borderTop: '1px solid var(--border)',
        scrollbarWidth: 'none',
      }}
    >
      {categories.map(([cat]) => {
        const active = categoryFilter.has(cat)
        const color = CATEGORY_COLORS[cat] || '#6B7280'
        return (
          <button
            key={cat}
            onClick={() => toggleCategory(cat)}
            title={active ? `Hide ${cat}` : `Show ${cat}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid var(--border-subtle)',
              background: active ? 'rgba(17,24,39,0.04)' : 'transparent',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: active ? color : 'var(--text-muted)', opacity: active ? 1 : 0.45 }} />
            <span style={{ color: active ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: 11, textDecoration: active ? 'none' : 'line-through' }}>
              {cat}
            </span>
          </button>
        )
      })}

      <div className="w-px h-5 flex-shrink-0" style={{ background: 'var(--border)' }} />

      {BRIDGE_TIERS.map(({ key, label, symbol }) => (
        <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          <span style={{ color: BRIDGE_COLORS[key], fontSize: 13 }}>{symbol}</span>
          <span>{label}</span>
        </span>
      ))}
    </div>
  )
}
