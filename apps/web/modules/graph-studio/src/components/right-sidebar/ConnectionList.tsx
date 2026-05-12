/**
 * ConnectionList — Clickable list of entity relationships
 *
 * Source of truth: DESIGN-SPEC.md Section 6 (Connections in Primary Card)
 * Each row: entity name + relType badge + causalClassification color
 * Click → adds exploration card (locked) or navigates (unlocked)
 */

import { useState } from 'react'
import { CAUSAL_COLORS } from '../../constants/colors'

interface Connection {
  entityName: string
  relType: string
  causalClassification: string
  description: string
  magnitude: string
}

interface Props {
  connections: Connection[]
  onConnectionClick: (entityName: string) => void
}

export default function ConnectionList({ connections, onConnectionClick }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  if (connections.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No connections</p>
  }

  return (
    <div className="space-y-0.5">
      {connections.map((conn, i) => {
        const color = CAUSAL_COLORS[conn.causalClassification] || '#6B7280'
        const isExpanded = expandedIdx === i
        return (
          <div key={`${conn.entityName}-${conn.relType}-${i}`}>
            <div
              className="w-full flex items-center gap-1.5 py-1 px-1 rounded text-left"
              style={{ background: isExpanded ? 'var(--surface-hover)' : 'transparent' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 cursor-pointer"
                style={{ backgroundColor: color }}
                onClick={() => onConnectionClick(conn.entityName)}
              />
              <span
                className="text-xs flex-1 truncate cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
                onClick={() => onConnectionClick(conn.entityName)}
              >
                {conn.entityName}
              </span>
              <span
                className="text-xs px-1 rounded flex-shrink-0"
                style={{ color, fontSize: '10px' }}
              >
                {conn.causalClassification}
              </span>
              <span
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="text-xs px-1 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                {isExpanded ? '▾' : '▸'}
              </span>
            </div>
            {isExpanded && conn.description && (
              <div className="ml-4 px-2 py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {conn.relType}:
                </span>{' '}
                {conn.description}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
