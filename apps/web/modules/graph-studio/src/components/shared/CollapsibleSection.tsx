import { useState, useRef, useEffect, type ReactNode } from 'react'
import { useGraphStore } from '../../stores/graph-store'

interface Props {
  title: string
  defaultOpen?: boolean
  count?: number
  id?: string
  children: ReactNode
}

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  count,
  id,
  children,
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const sectionRef = useRef<HTMLDivElement>(null)
  const lsbScrollTarget = useGraphStore(s => s.lsbScrollTarget)
  const clearLsbScrollTarget = useGraphStore(s => s.clearLsbScrollTarget)

  useEffect(() => {
    if (lsbScrollTarget && lsbScrollTarget === id) {
      setIsOpen(true)
      requestAnimationFrame(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      clearLsbScrollTarget()
    }
  }, [lsbScrollTarget, id, clearLsbScrollTarget])

  return (
    <div ref={sectionRef} id={id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between"
        style={{
          padding: '12px 14px',
          color: 'var(--text-primary)',
          background: isOpen ? 'var(--surface-hover)' : 'transparent',
          cursor: 'pointer',
          border: 'none',
        }}
      >
        <span className="flex items-center gap-3" style={{ fontSize: 13, fontWeight: 600 }}>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--surface-hover)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-muted)',
              fontSize: 10,
              transition: 'transform 0.15s ease',
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            }}
          >
            {'>'}
          </span>
          <span>{title}</span>
        </span>
        {count !== undefined && (
          <span style={{
            color: 'var(--text-secondary)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border-subtle)',
            fontSize: 10,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 999,
            lineHeight: 1,
          }}>
            {count}
          </span>
        )}
      </button>
      {isOpen && <div style={{ padding: '0 14px 14px' }}>{children}</div>}
    </div>
  )
}
