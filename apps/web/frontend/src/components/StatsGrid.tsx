/**
 * StatsGrid — horizontal bar of stat boxes.
 */

interface StatItem {
  label: string
  value: number | string
}

interface Props {
  stats: StatItem[]
}

export default function StatsGrid({ stats }: Props) {
  return (
    <div className="flex flex-wrap gap-0" style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {stats.map((stat, i) => (
        <div
          key={i}
          style={{
            flex: '1 1 0',
            minWidth: '120px',
            padding: '16px 20px',
            borderRight: i < stats.length - 1 ? '1px solid var(--border-subtle)' : undefined,
            textAlign: 'center',
          }}
        >
          <div className="stat-number">{stat.value}</div>
          <div className="stat-label">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
