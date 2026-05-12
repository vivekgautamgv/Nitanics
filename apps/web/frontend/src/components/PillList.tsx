/**
 * PillList — shows N items inline + "+M more" overflow.
 * Source of truth: DESIGN-SPEC.md Section 14
 */
import { useState, useRef, useEffect } from 'react'

interface Props {
  items: string[]
  maxVisible?: number
  variant: 'tag' | 'entity' | 'category' | 'collection'
  onItemClick?: (item: string) => void
}

export default function PillList({ items, maxVisible = 4, variant, onItemClick }: Props) {
  const [showPopover, setShowPopover] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const visible = items.slice(0, maxVisible)
  const overflow = items.length - maxVisible

  useEffect(() => {
    if (!showPopover) return
    const handle = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showPopover])

  const pillClass = variant === 'entity' ? 'pill pill-entity'
    : variant === 'tag' ? 'pill pill-tag'
    : 'pill pill-tag'

  return (
    <div className="flex items-center flex-wrap gap-1" style={{ position: 'relative' }}>
      {visible.map((item, i) => (
        <span
          key={i}
          className={pillClass}
          onClick={(e) => {
            e.stopPropagation()
            onItemClick?.(item)
          }}
          style={onItemClick ? { cursor: 'pointer' } : undefined}
        >
          {item}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="pill pill-overflow"
          onClick={(e) => {
            e.stopPropagation()
            setShowPopover(!showPopover)
          }}
        >
          +{overflow} more
        </span>
      )}

      {/* Popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            zIndex: 50,
            minWidth: '150px',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                padding: '3px 0',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: onItemClick ? 'pointer' : 'default',
              }}
              onClick={() => {
                onItemClick?.(item)
                setShowPopover(false)
              }}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
