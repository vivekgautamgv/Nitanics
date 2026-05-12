interface Props {
  label: string
  value: number  // 0-10 scale
  color?: string
}

function valueLabel(val: number): string {
  if (val >= 8) return 'Very High'
  if (val >= 5) return 'High'
  if (val >= 3) return 'Medium'
  return 'Low'
}

export default function MetricBar({ label, value, color = 'var(--accent)' }: Props) {
  const pct = Math.min(Math.max(value / 10, 0), 1) * 100

  return (
    <div className="flex items-center gap-3" style={{ fontSize: '12px' }}>
      <span style={{ color: 'var(--text-muted)', width: '80px', flexShrink: 0 }}>{label}</span>
      <div style={{
        flex: 1,
        height: '6px',
        background: 'var(--surface-hover)',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: '3px',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ color: 'var(--text-secondary)', width: '60px', textAlign: 'right', flexShrink: 0 }}>
        {valueLabel(value)}
      </span>
    </div>
  )
}
