import { useGraphStore } from '../../stores/graph-store'
import { CATEGORY_COLORS } from '../../constants/colors'
import CollapsibleSection from '../shared/CollapsibleSection'

export default function CategoryFilter() {
  const categoryFilter = useGraphStore(s => s.categoryFilter)
  const toggleCategory = useGraphStore(s => s.toggleCategory)
  const selectAll = useGraphStore(s => s.selectAllCategories)
  const deselectAll = useGraphStore(s => s.deselectAllCategories)
  const allNodes = useGraphStore(s => s.allNodes)

  const categoryCounts = new Map<string, number>()
  for (const node of allNodes) {
    if (node.__type === 'entity') {
      categoryCounts.set(node.category, (categoryCounts.get(node.category) || 0) + 1)
    }
  }

  const categories = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])
  const allSelected = categories.length > 0 && categories.every(([cat]) => categoryFilter.has(cat))

  return (
    <CollapsibleSection title="Categories" count={categories.length} id="lsb-categories">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
        <span>Visibility</span>
        <button
          onClick={allSelected ? deselectAll : selectAll}
          className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'rgba(255,255,255,0.88)' }}
        >
          {allSelected ? 'Hide All' : 'Show All'}
        </button>
      </div>

      <div className="space-y-2">
        {categories.map(([cat, count]) => {
          const active = categoryFilter.has(cat)
          const color = CATEGORY_COLORS[cat] || '#6B7280'
          return (
            <label
              key={cat}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
              style={{
                borderColor: active ? 'rgba(17, 24, 39, 0.14)' : 'var(--border)',
                background: active ? 'rgba(255,255,255,0.92)' : 'rgba(248,250,252,0.78)',
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggleCategory(cat)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: active ? color : 'var(--text-muted)' }} />
              <span
                className="min-w-0 flex-1 truncate text-[13px] font-medium"
                style={{
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  textDecoration: active ? 'none' : 'line-through',
                }}
              >
                {cat}
              </span>
              <span className="rounded-full px-2 py-1 text-[11px] font-medium" style={{ color: 'var(--text-secondary)', background: 'var(--surface-hover)' }}>
                {count}
              </span>
            </label>
          )
        })}
      </div>
    </CollapsibleSection>
  )
}
