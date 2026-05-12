/**
 * MetricBar — Horizontal bar with human-readable label
 *
 * Source of truth: DESIGN-SPEC.md Section 6 (Metric Bar Normalization)
 * GDS values → percentile → 0-10 bar → text label (Low/Medium/High/Very High)
 */

interface Props {
  label: string
  value: number       // Raw metric value
  allValues: number[] // All values in collection for percentile
  tooltip?: string
}

function percentileRank(value: number, all: number[]): number {
  if (all.length === 0) return 0
  const below = all.filter(v => v < value).length
  return (below / all.length) * 100
}

function barLabel(barValue: number): string {
  if (barValue <= 2) return 'Low'
  if (barValue <= 4) return 'Medium-Low'
  if (barValue <= 6) return 'Medium'
  if (barValue <= 8) return 'High'
  return 'Very High'
}

export default function MetricBar({ label, value, allValues, tooltip }: Props) {
  const pctile = percentileRank(value, allValues)
  const barValue = Math.round(pctile / 10)
  const textLabel = barLabel(barValue)

  return (
    <div className="flex items-center gap-2" title={tooltip}>
      <span className="text-xs w-24 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${barValue * 10}%`,
            background: barValue >= 7 ? 'var(--accent)' : 'var(--text-muted)',
          }}
        />
      </div>
      <span className="text-xs w-20 text-right flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
        {textLabel}
      </span>
    </div>
  )
}
