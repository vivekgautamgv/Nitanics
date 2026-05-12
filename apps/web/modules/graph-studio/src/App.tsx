/**
 * Graph Studio — Application Shell
 *
 * graphMode drives which data loader is called:
 *   'collection' → loadCollection (all entities in collection)
 *   'project'    → loadProjectGraph (one project, scoped entities only)
 *   'bridge'     → loadBridgeGraph (only cross-project bridge entities)
 *
 * Per docs/GRAPH_SCOPE_CONTRACT.md — each mode fetches isolated data.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGraphStore } from './stores/graph-store'
import { useSelectionStore } from './stores/selection-store'
import GraphCanvas from './components/GraphCanvas'
import LeftSidebar from './components/left-sidebar/LeftSidebar'
import RightSidebar from './components/right-sidebar/RightSidebar'
import Legend from './components/Legend'
import StatusBar from './components/StatusBar'
import CollectionPicker from './components/CollectionPicker'

interface AppProps {
  initialCollection?: string
  graphMode?: 'collection' | 'project' | 'bridge'
  selectedProjectId?: string   // used when graphMode='project'
}

export default function App({
  initialCollection,
  graphMode = 'collection',
  selectedProjectId,
}: AppProps = {}) {
  const loadCollection = useGraphStore(s => s.loadCollection)
  const loadProjectGraph = useGraphStore(s => s.loadProjectGraph)
  const loadBridgeGraph = useGraphStore(s => s.loadBridgeGraph)
  const isLoading = useGraphStore(s => s.isLoading)
  const error = useGraphStore(s => s.error)
  const nodeCount = useGraphStore(s => s.allNodes.length)
  const storeCollection = useGraphStore(s => s.collection)
  const storeMode = useGraphStore(s => s.graphMode)

  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    initialCollection ?? null
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const clearAll = useSelectionStore(s => s.clearAll)
  const selectedNode = useSelectionStore(s => s.selectedNode)
  const showCollectionCard = useSelectionStore(s => s.showCollectionCard)
  const openCollectionCard = useSelectionStore(s => s.openCollectionCard)
  const lastAutoOpenedScopeRef = useRef<string | null>(null)

  const handleCollectionSelect = useCallback((collectionName: string) => {
    setSelectedCollection(collectionName)
    loadCollection(collectionName)
  }, [loadCollection])

  // ── React to graphMode + selectedProjectId changes ──────────
  useEffect(() => {
    const coll = selectedCollection ?? initialCollection
    if (!coll) return

    // If collection changed externally, always reload collection scope first
    if (coll !== storeCollection) {
      loadCollection(coll)
      return
    }

    // Same collection — switch scope based on mode
    if (graphMode === 'collection') {
      // Only reload if we were in a different mode
      if (storeMode !== 'collection') {
        loadCollection(coll)
      } else if (nodeCount === 0 && !isLoading) {
        loadCollection(coll)
      }
    } else if (graphMode === 'project') {
      const pid = selectedProjectId
      if (pid) {
        // Always reload when project ID changes or we're switching into project mode
        if (storeMode !== 'project' || nodeCount === 0) {
          loadProjectGraph(pid, coll)
        }
      }
      // If no project selected yet, don't load — let user pick in LeftSidebar
    } else if (graphMode === 'bridge') {
      if (storeMode !== 'bridge' || nodeCount === 0) {
        loadBridgeGraph(coll)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphMode, selectedProjectId, selectedCollection, initialCollection])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if (e.key === 'Escape') clearAll()
      if (e.key === '/') {
        e.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Search entities..."]')
        searchInput?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearAll])

  // Track canvas container dimensions
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateSize = () => setDimensions({ width: el.clientWidth, height: el.clientHeight })
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isLoading])

  // Project mode: prompt to pick a project if none selected
  const showProjectPrompt = graphMode === 'project' && !selectedProjectId && !isLoading

  const showGraph = !isLoading && !error && nodeCount > 0
  const showRSB = selectedNode || showCollectionCard
  const scopeKey = `${selectedCollection ?? initialCollection ?? ''}::${graphMode}::${selectedProjectId ?? ''}`

  useEffect(() => {
    if (!showGraph) return
    if (lastAutoOpenedScopeRef.current === scopeKey) return
    if (selectedNode || showCollectionCard) {
      lastAutoOpenedScopeRef.current = scopeKey
      return
    }

    openCollectionCard()
    lastAutoOpenedScopeRef.current = scopeKey
  }, [showGraph, scopeKey, selectedNode, showCollectionCard, openCollectionCard])

  // Collection picker gate
  if (!selectedCollection) {
    return <CollectionPicker onSelect={handleCollectionSelect} />
  }

  return (
    <div className="h-full w-full flex" style={{ background: 'var(--bg)' }}>
      {/* Left Sidebar — 280px fixed */}
      {showGraph && <LeftSidebar />}

      {/* Canvas area */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <div ref={containerRef} className="flex-1 min-w-0 min-h-0 relative overflow-hidden">

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p style={{ color: 'var(--text-muted)' }}>Loading graph...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p style={{ color: 'var(--error)' }}>Failed to load: {error}</p>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Check Neo4j is running (bolt://localhost:7687, database: memorytonic)
                </p>
              </div>
            </div>
          )}

          {showProjectPrompt && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Project Graph mode
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Click a project node in Collection mode, then switch to Project Graph to isolate it.
                </div>
              </div>
            </div>
          )}

          {showGraph && dimensions.width > 0 && dimensions.height > 0 && (
            <GraphCanvas width={dimensions.width} height={dimensions.height} />
          )}

          {showGraph && <StatusBar />}
        </div>

        {showGraph && <Legend />}
      </div>

      {/* Right Sidebar */}
      {showGraph && showRSB && <RightSidebar />}
    </div>
  )
}
