import { useGraphStore } from '../../stores/graph-store'
import { BRIDGE_COLORS } from '../../constants/colors'
import CollapsibleSection from '../shared/CollapsibleSection'

const TIERS = [
  { key: 'gold', label: 'Gold (3+ projects)', symbol: 'G' },
  { key: 'silver', label: 'Silver (2 projects)', symbol: 'S' },
  { key: 'bronze', label: 'Bronze (high bridge)', symbol: 'B' },
  { key: 'none', label: 'No bridge', symbol: '�' },
] as const

export default function BridgeFilter() {
  const bridgeFilter = useGraphStore(s => s.bridgeFilter)
  const toggleBridgeTier = useGraphStore(s => s.toggleBridgeTier)
  const selectAll = useGraphStore(s => s.selectAllBridgeTiers)
  const deselectAll = useGraphStore(s => s.deselectAllBridgeTiers)
  const allNodes = useGraphStore(s => s.allNodes)

  const tierCounts = new Map<string, number>()
  for (const node of allNodes) {
    if (node.__type === 'entity') {
      tierCounts.set(node.__bridgeTier, (tierCounts.get(node.__bridgeTier) || 0) + 1)
    }
  }

  const allSelected = bridgeFilter.size === TIERS.length

  return (
    <CollapsibleSection title="Bridges" id="lsb-bridges">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
        <span>Bridge tiers</span>
        <button
          onClick={allSelected ? deselectAll : selectAll}
          className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
        >
          {allSelected ? 'Hide All' : 'Show All'}
        </button>
      </div>

      <div className="space-y-2">
        {TIERS.map(({ key, label, symbol }) => {
          const active = bridgeFilter.has(key)
          const color = BRIDGE_COLORS[key] || 'var(--text-muted)'
          const count = tierCounts.get(key) || 0
          return (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
              style={{
                borderColor: active ? 'rgba(56, 189, 248, 0.25)' : 'var(--border-subtle)',
                background: active ? 'var(--surface-hover)' : 'var(--surface-raised)',
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggleBridgeTier(key)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="w-4 text-center text-[14px]" style={{ color: key === 'none' ? 'var(--text-muted)' : color }}>
                {symbol}
              </span>
              <span className="flex-1 text-[13px] font-medium" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {label}
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
