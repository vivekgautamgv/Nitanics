/**
 * CollapsibleSection - expandable content section with title + count.
 */
import { useState } from 'react'

interface Props {
  title: string
  count?: number
  defaultExpanded?: boolean
  children: React.ReactNode
}

export default function CollapsibleSection({ title, count, defaultExpanded = true, children }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div style={{ marginBottom: '16px' }}>
      <div
        className="flex items-center gap-2 cursor-pointer select-none"
        style={{
          padding: '8px 0',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: expanded ? '12px' : 0,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: '12px', width: '16px' }}>
          {expanded ? 'v' : '>'}
        </span>
        <span className="section-header" style={{ marginBottom: 0 }}>{title}</span>
        {count !== undefined && (
          <span
            style={{
              background: 'var(--surface-hover)',
              color: 'var(--text-muted)',
              padding: '1px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
            }}
          >
            {count}
          </span>
        )}
      </div>
      {expanded && children}
    </div>
  )
}
