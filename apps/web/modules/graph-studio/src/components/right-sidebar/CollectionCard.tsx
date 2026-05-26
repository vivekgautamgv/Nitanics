import { useGraphStore } from '../../stores/graph-store'
import { useSelectionStore } from '../../stores/selection-store'
import { CATEGORY_COLORS, BRIDGE_COLORS } from '../../constants/colors'

export default function CollectionCard() {
  const collection = useGraphStore(s => s.collection)
  const allNodes = useGraphStore(s => s.allNodes)
  const allLinks = useGraphStore(s => s.allLinks)
  const projects = useGraphStore(s => s.projects)
  const navigateTo = useSelectionStore(s => s.navigateTo)

  const entities = allNodes.filter(n => n.__type === 'entity')
  const bridges = entities.filter(n => n.__bridgeTier !== 'none')
  const goldBridges = entities.filter(n => n.__bridgeTier === 'gold')
  const silverBridges = entities.filter(n => n.__bridgeTier === 'silver')

  const topEntities = [...entities].sort((a, b) => b.pageRank - a.pageRank).slice(0, 10)

  const categoryMap = new Map<string, number>()
  for (const e of entities) {
    categoryMap.set(e.category, (categoryMap.get(e.category) || 0) + 1)
  }
  const categories = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 6 }}>
          {collection}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Collection overview and high-signal entities.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="Entities" value={entities.length} />
        <StatCard label="Edges" value={allLinks.length} />
        <StatCard label="Bridges" value={bridges.length} />
      </div>

      {bridges.length > 0 && (
        <Panel title={`Bridge Entities (${bridges.length})`}>
          {goldBridges.length > 0 && (
            <BridgeGroup title={`Gold (${goldBridges.length})`} color={BRIDGE_COLORS.gold || '#F5C542'} items={goldBridges.slice(0, 5).map(b => b.name)} onClick={navigateTo} />
          )}
          {silverBridges.length > 0 && (
            <BridgeGroup title={`Silver (${silverBridges.length})`} color={BRIDGE_COLORS.silver || '#A8B0BD'} items={silverBridges.slice(0, 5).map(b => b.name)} onClick={navigateTo} />
          )}
        </Panel>
      )}

      <Panel title="Top Entities by Influence">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {topEntities.map((entity, i) => {
            const catColor = CATEGORY_COLORS[entity.category] || '#6B7280'
            return (
              <button
                key={entity.name}
                onClick={() => navigateTo(entity.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px 0',
                  textAlign: 'left',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: 11, width: 16, textAlign: 'right' }}>{i + 1}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: catColor, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entity.name}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{entity.pageRank.toFixed(1)}</span>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel title="Categories">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {categories.map(([cat, count]) => {
            const color = CATEGORY_COLORS[cat] || '#6B7280'
            const pct = entities.length > 0 ? ((count / entities.length) * 100).toFixed(0) : '0'
            return (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)', fontSize: 12, flex: 1 }}>{cat}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{count} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ borderRadius: 16, padding: '12px 12px 11px', background: 'var(--surface-hover)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)', marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 18, padding: 14, background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function BridgeGroup({ title, color, items, onClick }: { title: string; color: string; items: string[]; onClick: (name: string) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(name => (
          <button key={name} onClick={() => onClick(name)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', fontSize: 13, padding: 0 }}>
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
