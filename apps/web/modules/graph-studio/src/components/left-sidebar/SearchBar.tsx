import { useState, useEffect, useRef } from 'react'
import { useGraphStore } from '../../stores/graph-store'
import { useSelectionStore } from '../../stores/selection-store'
import { useUIStore } from '../../stores/ui-store'
import { fulltextSearch } from '../../services/queries'
import { CATEGORY_COLORS } from '../../constants/colors'
import type { SearchResult } from '../../types/graph'

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setSearchHighlights = useGraphStore(s => s.setSearchHighlights)
  const allNodes = useGraphStore(s => s.allNodes)
  const collection = useGraphStore(s => s.collection)
  const selectNode = useSelectionStore(s => s.selectNode)
  const getZoomToNode = () => useUIStore.getState().zoomToNode

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.length < 2) {
      setResults([])
      setSearchHighlights(new Set())
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fulltextSearch(query, collection)
        setResults(res)
        setSearchHighlights(new Set(res.map(r => r.name)))
      } catch (err) {
        console.error('Search failed:', err)
        const lowerQ = query.toLowerCase()
        const matches = allNodes
          .filter(n => n.__type === 'entity' && n.name.toLowerCase().includes(lowerQ))
          .slice(0, 20)
          .map(n => ({
            name: n.name,
            category: n.category,
            definition: n.definition || '',
            score: 1,
          }))
        setResults(matches)
        setSearchHighlights(new Set(matches.map(m => m.name)))
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, allNodes, collection, setSearchHighlights])

  const handleClear = () => {
    setQuery('')
    setResults([])
    setSearchHighlights(new Set())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClear()
  }

  const handleResultClick = (entityName: string) => {
    const node = allNodes.find(n => n.name === entityName)
    if (!node) return
    selectNode(node)
    getZoomToNode()?.(node.id)
  }

  return (
    <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '10px', fontWeight: 700, marginBottom: 8 }}>
          Search
        </div>
        <div style={{ position: 'relative' }}>
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          >
            <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search entities"
            className="w-full outline-none"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '11px 34px 11px 32px',
              fontSize: 13,
            }}
          />
          {query && (
            <button
              onClick={handleClear}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              �
            </button>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isSearching && <p className="text-xs py-1" style={{ color: 'var(--text-muted)' }}>Searching...</p>}
          {results.map(result => {
            const catColor = CATEGORY_COLORS[result.category] || '#6B7280'
            return (
              <button
                key={result.name}
                onClick={() => handleResultClick(result.name)}
                className="w-full text-left"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 12,
                  background: 'var(--surface-hover)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: catColor }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                    {result.name}
                  </div>
                  {result.definition && (
                    <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)', maxWidth: '100%' }}>
                      {result.definition.slice(0, 90)}
                      {result.definition.length > 90 ? '...' : ''}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && !isSearching && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No results</p>
      )}
    </div>
  )
}
