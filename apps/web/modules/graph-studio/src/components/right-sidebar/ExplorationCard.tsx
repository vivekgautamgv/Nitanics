/**
 * ExplorationCard — Scoped card showing relationship to locked entity
 *
 * Source of truth: DESIGN-SPEC.md Section 6 (Exploration Card Anatomy)
 * Collapsed: "Name (via Locked) — REL_TYPE"
 * Level 1: relationship + role + definition
 * Level 2: shared connections, own connections, metrics, projects
 */

import { useState } from 'react'
import { CAUSAL_COLORS, CATEGORY_COLORS } from '../../constants/colors'
import type { ExplorationCardData } from '../../types/graph'

interface Props {
  card: ExplorationCardData
  lockedName: string
  onClose: () => void
  onToggle: () => void
  onNavigate: (entityName: string) => void
}

export default function ExplorationCard({ card, lockedName, onClose, onToggle, onNavigate }: Props) {
  const [showMore, setShowMore] = useState(false)
  const relColor = CAUSAL_COLORS[card.relationship.causalClassification] || '#6B7280'
  const catColor = CATEGORY_COLORS[card.entityDetail.category] || '#6B7280'

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {/* Header — always visible */}
      <div className="flex items-center gap-1.5 py-2 px-3">
        <button
          onClick={onClose}
          className="text-xs flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
          title="Remove card"
        >
          ✕
        </button>
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-1.5 text-left min-w-0"
        >
          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {card.entity.name}
          </span>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            (via {lockedName})
          </span>
          <span className="text-xs flex-shrink-0" style={{ color: relColor }}>
            — {card.relationship.causalClassification}
          </span>
        </button>
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {card.expanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Expanded content */}
      {card.expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Level 1: Always visible when expanded */}
          {/* Relationship to locked */}
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Relationship to {lockedName}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: relColor }}>{card.relationship.relType}</span>
              {' — '}
              {card.relationship.description}
            </p>
          </div>

          {/* Scoped role */}
          {card.scopedRole && (
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Role</div>
              <p
                className="text-xs mt-0.5 leading-relaxed"
                style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}
              >
                "{card.scopedRole}"
              </p>
            </div>
          )}

          {/* Definition */}
          <div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Definition</div>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {card.entityDetail.definition}
            </p>
          </div>

          {/* Level 2: More details */}
          <button
            onClick={() => setShowMore(!showMore)}
            className="text-xs"
            style={{ color: 'var(--accent)' }}
          >
            {showMore ? '▾ Less details' : '▸ More details'}
          </button>

          {showMore && (
            <div className="space-y-2 ml-1">
              {/* Category + metrics */}
              <div className="flex items-center gap-2">
                <span
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{ backgroundColor: catColor + '20', color: catColor }}
                >
                  {card.entityDetail.category}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {card.entityDetail.projectCount} project{card.entityDetail.projectCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Shared connections */}
              {card.sharedConnections.length > 0 && (
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Shared with {lockedName} ({card.sharedConnections.length})
                  </div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {card.sharedConnections.slice(0, 8).map(name => (
                      <button
                        key={name}
                        onClick={() => onNavigate(name)}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}
                      >
                        {name}
                      </button>
                    ))}
                    {card.sharedConnections.length > 8 && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        +{card.sharedConnections.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Own connections */}
              {card.ownConnections.length > 0 && (
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {card.entity.name}-only ({card.ownConnections.length})
                  </div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {card.ownConnections.slice(0, 8).map(name => (
                      <button
                        key={name}
                        onClick={() => onNavigate(name)}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
                      >
                        {name}
                      </button>
                    ))}
                    {card.ownConnections.length > 8 && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        +{card.ownConnections.length - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
