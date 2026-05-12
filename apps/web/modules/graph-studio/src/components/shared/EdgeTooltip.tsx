import { CAUSAL_COLORS, EVIDENCE_COLORS } from '../../constants/colors'

export interface EdgeTooltipData {
  x: number
  y: number
  relType: string
  causalClassification: string
  description: string
  evidenceStrength: string
  magnitude: string
  sourceName: string
  targetName: string
}

interface Props {
  data: EdgeTooltipData
}

const EVIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  established: { label: 'Established', color: EVIDENCE_COLORS.established || '#16A34A' },
  claimed: { label: 'Claimed', color: EVIDENCE_COLORS.claimed || '#2563EB' },
  disputed: { label: 'Disputed', color: EVIDENCE_COLORS.disputed || '#DC2626' },
  speculative: { label: 'Speculative', color: EVIDENCE_COLORS.speculative || '#D97706' },
}

export default function EdgeTooltip({ data }: Props) {
  const causalColor = CAUSAL_COLORS[data.causalClassification] || '#6B7280'
  const evidence = EVIDENCE_LABELS[data.evidenceStrength] || { label: data.evidenceStrength, color: '#6B7280' }

  const tooltipWidth = 320
  const margin = 16
  const preferredLeft = data.x + 18
  const preferredTop = data.y - 132

  const left = Math.max(margin, Math.min(preferredLeft, window.innerWidth - tooltipWidth - margin))
  const top = preferredTop < margin ? Math.min(data.y + 18, window.innerHeight - 148) : preferredTop
  const showArrowOnTop = preferredTop < margin

  return (
    <div
      className="pointer-events-none fixed z-[90] rounded-3xl px-4 py-3"
      style={{
        left,
        top,
        width: tooltipWidth,
        background: 'rgba(255,255,255,0.97)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        boxShadow: '0 18px 46px rgba(15, 23, 42, 0.14)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 24,
          width: 14,
          height: 14,
          background: 'rgba(255,255,255,0.97)',
          borderLeft: '1px solid rgba(15, 23, 42, 0.08)',
          borderTop: '1px solid rgba(15, 23, 42, 0.08)',
          transform: 'rotate(45deg)',
          top: showArrowOnTop ? -7 : undefined,
          bottom: showArrowOnTop ? undefined : -7,
        }}
      />

      <div className="mb-2 flex items-start justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
            Edge Insight
          </div>
          <div className="text-[13px] font-semibold leading-5" style={{ color: 'var(--text-primary)' }}>
            <span>{data.sourceName}</span>
            <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>?</span>
            <span>{data.targetName}</span>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{
            color: causalColor,
            background: `${causalColor}14`,
            border: `1px solid ${causalColor}26`,
          }}
        >
          {data.causalClassification}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ background: 'rgba(17,24,39,0.05)', color: 'var(--text-secondary)' }}>
          {data.relType}
        </span>
        {data.magnitude && (
          <span className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
            {data.magnitude}
          </span>
        )}
      </div>

      {data.description && (
        <p className="mb-3 text-[12px] leading-5" style={{ color: 'var(--text-secondary)' }}>
          {data.description}
        </p>
      )}

      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{
            color: evidence.color,
            background: `${evidence.color}14`,
            border: `1px solid ${evidence.color}24`,
          }}
        >
          {evidence.label}
        </span>
      </div>
    </div>
  )
}
