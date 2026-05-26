import { useGraphStore } from '../../stores/graph-store'
import { CAUSAL_COLORS, MENTIONED_IN_COLOR } from '../../constants/colors'
import CollapsibleSection from '../shared/CollapsibleSection'

export default function EdgeTypeFilter() {
  const edgeTypeFilter = useGraphStore(s => s.edgeTypeFilter)
  const toggleEdgeType = useGraphStore(s => s.toggleEdgeType)
  const selectAll = useGraphStore(s => s.selectAllEdgeTypes)
  const deselectAll = useGraphStore(s => s.deselectAllEdgeTypes)
  const allLinks = useGraphStore(s => s.allLinks)

  const typeCounts = new Map<string, number>()
  for (const link of allLinks) {
    if (link.causalClassification) {
      typeCounts.set(link.causalClassification, (typeCounts.get(link.causalClassification) || 0) + 1)
    }
  }

  const types = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])
  const allSelected = types.length > 0 && types.every(([type]) => edgeTypeFilter.has(type))

  return (
    <CollapsibleSection title="Edge Types" count={types.length} defaultOpen={false} id="lsb-edge-types">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
        <span>Relations</span>
        <button
          onClick={allSelected ? deselectAll : selectAll}
          className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          {allSelected ? 'Hide All' : 'Show All'}
        </button>
      </div>

      <div className="space-y-2">
        {types.map(([type, count]) => {
          const active = edgeTypeFilter.has(type)
          const color = CAUSAL_COLORS[type] || (type === 'MENTIONED_IN' ? MENTIONED_IN_COLOR : '#6B7280')
          return (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
              style={{
                borderColor: active ? 'rgba(56, 189, 248, 0.25)' : 'var(--border-subtle)',
                background: active ? 'var(--surface-hover)' : 'var(--surface-raised)',
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggleEdgeType(type)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="h-[2px] w-4 flex-shrink-0 rounded-full" style={{ backgroundColor: active ? color : 'var(--text-muted)' }} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {type}
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
