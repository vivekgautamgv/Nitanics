/**
 * CollectionPicker — Entry screen to select a collection
 *
 * Source of truth: User request — Graph Studio should ask to select collection first.
 * Fetches all collections from Neo4j, shows alphabetically with search.
 */

import { useState, useEffect, useMemo } from 'react'
import { fetchCollections } from '../services/queries'
import type { CollectionInfo } from '../types/graph'

interface Props {
  onSelect: (collectionName: string) => void
}

export default function CollectionPicker({ onSelect }: Props) {
  const [collections, setCollections] = useState<CollectionInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchCollections()
      .then(setCollections)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return collections
    const lower = search.toLowerCase()
    return collections.filter(c => c.name.toLowerCase().includes(lower))
  }, [collections, search])

  return (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-md mx-4"
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Graph Studio
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Select a collection to explore
          </p>
        </div>

        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search collections..."
            autoFocus
            className="w-full text-sm rounded px-3 py-2 outline-none"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Connecting to Neo4j...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--error)' }}>
              {error}
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              Check Neo4j is running (bolt://localhost:7687, database: memorytonic)
            </p>
          </div>
        )}

        {/* Collection list */}
        {!isLoading && !error && (
          <div
            className="rounded-lg overflow-hidden"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              maxHeight: '50vh',
              overflowY: 'auto',
            }}
          >
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {search ? 'No collections match your search' : 'No collections found'}
                </p>
              </div>
            )}

            {filtered.map((col, i) => (
              <button
                key={col.name}
                onClick={() => onSelect(col.name)}
                className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                style={{
                  borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {col.name}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {col.projectCount} project{col.projectCount !== 1 ? 's' : ''}
                    {col.entityCount > 0 && ` \u00B7 ${col.entityCount} entities`}
                  </div>
                </div>
                <span
                  className="text-xs flex-shrink-0 ml-3"
                  style={{ color: 'var(--accent)' }}
                >
                  Open
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        {!isLoading && !error && collections.length > 0 && (
          <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
            {collections.length} collection{collections.length !== 1 ? 's' : ''} available
          </p>
        )}
      </div>
    </div>
  )
}
