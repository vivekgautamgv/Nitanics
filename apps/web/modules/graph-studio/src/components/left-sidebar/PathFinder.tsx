import { useState, useRef, useEffect, useCallback } from 'react'
import { useGraphStore } from '../../stores/graph-store'
import { useUIStore } from '../../stores/ui-store'
import { useSelectionStore } from '../../stores/selection-store'
import { findShortestPath } from '../../services/queries'
import { CATEGORY_COLORS, CAUSAL_COLORS } from '../../constants/colors'
import CollapsibleSection from '../shared/CollapsibleSection'
import type { PathResult } from '../../types/graph'

export default function PathFinder() {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ name: string; category: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const allNodes = useGraphStore(s => s.allNodes)
  const collection = useGraphStore(s => s.collection)
  const setHighlightedPath = useGraphStore(s => s.setHighlightedPath)
  const clearPath = useGraphStore(s => s.clearPath)

  const pathEntities = useUIStore(s => s.pathEntities)
  const pathResults = useUIStore(s => s.pathResults)
  const isComputingPaths = useUIStore(s => s.isComputingPaths)
  const addPathEntity = useUIStore(s => s.addPathEntity)
  const removePathEntity = useUIStore(s => s.removePathEntity)
  const setPathResults = useUIStore(s => s.setPathResults)
  const setIsComputingPaths = useUIStore(s => s.setIsComputingPaths)
  const exitPathMode = useUIStore(s => s.exitPathMode)
  const zoomToNode = useUIStore(s => s.zoomToNode)

  useEffect(() => {
    if (inputValue.length < 1) {
      setSuggestions([])
      return
    }
    const lower = inputValue.toLowerCase()
    const matches = allNodes
      .filter(n => n.name.toLowerCase().includes(lower) && !pathEntities.includes(n.name))
      .slice(0, 8)
      .map(n => ({ name: n.name, category: n.category }))
    setSuggestions(matches)
  }, [inputValue, allNodes, pathEntities])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleAddEntity = useCallback((name: string) => {
    addPathEntity(name)
    setInputValue('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }, [addPathEntity])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const firstSuggestion = suggestions[0]
    if (e.key === 'Enter' && firstSuggestion) {
      handleAddEntity(firstSuggestion.name)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setInputValue('')
    }
  }

  const computePaths = useCallback(async () => {
    if (pathEntities.length < 2) return

    setIsComputingPaths(true)
    setPathResults([])
    clearPath()

    const pairs: [string, string][] = []
    for (let i = 0; i < pathEntities.length; i++) {
      for (let j = i + 1; j < pathEntities.length; j++) {
        const from = pathEntities[i]
        const to = pathEntities[j]
        if (from && to) pairs.push([from, to])
      }
    }

    try {
      const results = await Promise.all(pairs.map(([a, b]) => findShortestPath(a, b, collection)))
      const validResults = results.filter((r): r is PathResult => r !== null)
      setPathResults(validResults)

      const allPathEntities = new Set<string>()
      for (const path of validResults) {
        for (const entity of path.entities) {
          allPathEntities.add(entity)
        }
      }
      setHighlightedPath([...allPathEntities])
    } catch (err) {
      console.error('Path computation failed:', err)
    } finally {
      setIsComputingPaths(false)
    }
  }, [pathEntities, collection, setIsComputingPaths, setPathResults, clearPath, setHighlightedPath])

  const handleClearAll = useCallback(() => {
    exitPathMode()
    clearPath()
  }, [exitPathMode, clearPath])

  const selectNode = useSelectionStore(s => s.selectNode)

  const handlePathClick = useCallback((path: PathResult) => {
    setHighlightedPath(path.entities)
    const node = allNodes.find(n => n.name === path.entities[0])
    if (node) zoomToNode?.(node.id)
  }, [setHighlightedPath, allNodes, zoomToNode])

  const handleEntityInPathClick = useCallback((entityName: string) => {
    const node = allNodes.find(n => n.name === entityName)
    if (!node) return
    selectNode(node)
    zoomToNode?.(node.id)
  }, [allNodes, selectNode, zoomToNode])

  return (
    <CollapsibleSection title="Path Finder" defaultOpen={false} id="lsb-pathfinder">
      <div className="relative mb-3">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => inputValue.length >= 1 && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={pathEntities.length >= 5 ? 'Max 5 entities' : 'Add entity or project'}
          disabled={pathEntities.length >= 5}
          className="w-full rounded-2xl px-3 py-2.5 text-[13px] outline-none"
          style={{
            background: 'rgba(255,255,255,0.92)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            opacity: pathEntities.length >= 5 ? 0.5 : 1,
          }}
        />

        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 18px 42px rgba(15,23,42,0.12)',
            }}
          >
            {suggestions.map(s => {
              const isProject = s.category === 'project'
              const color = isProject ? '#9ca3af' : (CATEGORY_COLORS[s.category] || '#6B7280')
              return (
                <button
                  key={s.name}
                  onClick={() => handleAddEntity(s.name)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px]"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className={`h-2 w-2 flex-shrink-0 ${isProject ? 'rounded-sm' : 'rounded-full'}`} style={{ backgroundColor: color }} />
                  <span className="truncate">{s.name}</span>
                  {isProject && <span className="ml-auto text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>Project</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {pathEntities.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pathEntities.map(name => {
            const node = allNodes.find(n => n.name === name)
            const color = node ? CATEGORY_COLORS[node.category] || '#6B7280' : '#6B7280'
            return (
              <span
                key={name}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px]"
                style={{
                  background: `${color}18`,
                  border: `1px solid ${color}33`,
                  color: 'var(--text-primary)',
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="max-w-[120px] truncate">{name}</span>
                <button onClick={() => removePathEntity(name)} style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <button
          onClick={computePaths}
          disabled={pathEntities.length < 2 || isComputingPaths}
          className="flex-1 rounded-full px-3 py-2 text-[12px] font-semibold"
          style={{
            background: pathEntities.length >= 2 ? 'var(--accent)' : 'var(--surface-hover)',
            color: pathEntities.length >= 2 ? '#fff' : 'var(--text-muted)',
            opacity: isComputingPaths ? 0.6 : 1,
            cursor: pathEntities.length < 2 || isComputingPaths ? 'not-allowed' : 'pointer',
          }}
        >
          {isComputingPaths ? 'Computing...' : 'Find Paths'}
        </button>
        {(pathEntities.length > 0 || pathResults.length > 0) && (
          <button
            onClick={handleClearAll}
            className="rounded-full px-3 py-2 text-[12px] font-medium"
            style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}
          >
            Clear
          </button>
        )}
      </div>

      {pathResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            {pathResults.length} path{pathResults.length !== 1 ? 's' : ''} found
          </p>
          {pathResults.map((path, i) => (
            <div key={`${path.from}-${path.to}-${i}`} className="overflow-hidden rounded-2xl" style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border)' }}>
              <button
                onClick={() => handlePathClick(path)}
                className="flex w-full items-center justify-between px-3 py-3 text-left"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {path.from} <span style={{ color: 'var(--text-muted)' }}>?</span> {path.to}
                </span>
                <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(17,24,39,0.06)', color: 'var(--text-secondary)' }}>
                  {path.hops} hop{path.hops !== 1 ? 's' : ''}
                </span>
              </button>

              <div className="space-y-1 px-3 py-2">
                {path.entities.map((entity, j) => {
                  const node = allNodes.find(n => n.name === entity)
                  const isProject = node?.__type === 'project'
                  const catColor = isProject ? '#71717a' : (node ? CATEGORY_COLORS[node.category] || '#6B7280' : '#6B7280')
                  const relType = j < path.relTypes.length ? path.relTypes[j] : null
                  const relColor = relType ? (CAUSAL_COLORS[relType] || 'var(--text-muted)') : undefined

                  return (
                    <div key={entity}>
                      <button onClick={e => { e.stopPropagation(); handleEntityInPathClick(entity) }} className="flex w-full items-center gap-2 rounded px-1 py-1 text-left">
                        <span className={`h-2 w-2 flex-shrink-0 ${isProject ? 'rounded-sm' : 'rounded-full'}`} style={{ backgroundColor: catColor }} />
                        <span className="truncate text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{entity}</span>
                        {isProject && <span className="ml-auto text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>Project</span>}
                      </button>

                      {relType && j < path.entities.length - 1 && (
                        <div className="flex items-center gap-2 pl-3 py-1">
                          <span style={{ color: relColor, fontSize: 11 }}>¦</span>
                          <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={{ color: relColor, background: `${relColor}15` }}>
                            {relType}
                          </span>
                          <span style={{ color: relColor, fontSize: 11 }}>?</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {pathEntities.length >= 2 && pathResults.length === 0 && !isComputingPaths && pathEntities.length > 0 && (
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Click Find Paths to surface the strongest connections.
        </p>
      )}
    </CollapsibleSection>
  )
}

