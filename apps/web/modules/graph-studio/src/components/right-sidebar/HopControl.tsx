/**
 * HopControl — [-] N [+] for hop radius
 *
 * Source of truth: DESIGN-SPEC.md Section 6 (Hops), Section 7 (Hop Highlighting)
 * Range: 1 to 3. Default: 2.
 */

interface Props {
  hops: number
  onChange: (hops: number) => void
}

export default function HopControl({ hops, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Hops</span>
      <button
        onClick={() => onChange(hops - 1)}
        disabled={hops <= 1}
        className="w-5 h-5 flex items-center justify-center rounded text-xs"
        style={{
          background: 'var(--border)',
          color: hops <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
          cursor: hops <= 1 ? 'not-allowed' : 'pointer',
        }}
      >
        −
      </button>
      <span className="text-xs font-mono w-4 text-center" style={{ color: 'var(--text-primary)' }}>
        {hops}
      </span>
      <button
        onClick={() => onChange(hops + 1)}
        disabled={hops >= 3}
        className="w-5 h-5 flex items-center justify-center rounded text-xs"
        style={{
          background: 'var(--border)',
          color: hops >= 3 ? 'var(--text-muted)' : 'var(--text-primary)',
          cursor: hops >= 3 ? 'not-allowed' : 'pointer',
        }}
      >
        +
      </button>
    </div>
  )
}
