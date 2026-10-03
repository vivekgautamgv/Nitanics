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
import { useUIStore } from './stores/ui-store'
import GraphCanvas from './components/GraphCanvas'
import LeftSidebar from './components/left-sidebar/LeftSidebar'
import RightSidebar from './components/right-sidebar/RightSidebar'
import Legend from './components/Legend'
import StatusBar from './components/StatusBar'
import CollectionPicker from './components/CollectionPicker'
import './styles/layout.css'
import { useRefreshOnFocus } from './hooks/useRefreshOnFocus'

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
  const filteredNodeCount = useGraphStore(s => s.filteredNodes.length)
  const resetAllFilters = useGraphStore(s => s.resetAllFilters)
  const storeCollection = useGraphStore(s => s.collection)
  const storeMode = useGraphStore(s => s.graphMode)
  const storeProjectId = useGraphStore(s => s.selectedProjectId)
  const lsbScrollTarget = useGraphStore(s => s.lsbScrollTarget)
  const [pickedCollection, setPickedCollection] = useState<string | null>(null)
  const selectedCollection = initialCollection ?? pickedCollection

  const studioRef = useRef<HTMLDivElement>(null)
  const filtersToggleRef = useRef<HTMLButtonElement>(null)
  const detailsToggleRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [studioWidth, setStudioWidth] = useState(0)
  const [filtersPreference, setFiltersPreference] = useState<boolean | null>(null)
  const isCompact = studioWidth < 1100
  const filtersOpen = filtersPreference ?? !isCompact

  const clearAll = useSelectionStore(s => s.clearAll)
  const selectedNode = useSelectionStore(s => s.selectedNode)
  const showCollectionCard = useSelectionStore(s => s.showCollectionCard)
  const openCollectionCard = useSelectionStore(s => s.openCollectionCard)
  const isLoadingDetail = useSelectionStore(s => s.isLoadingDetail)
  const lastAutoOpenedScopeRef = useRef<string | null>(null)
  const closeFilters = useCallback(() => {
    setFiltersPreference(false)
    requestAnimationFrame(() => filtersToggleRef.current?.focus())
  }, [])
  const closeInspector = useCallback(() => {
    clearAll()
    requestAnimationFrame(() => detailsToggleRef.current?.focus())
  }, [clearAll])

  const handleCollectionSelect = useCallback((collectionName: string) => {
    setPickedCollection(collectionName)
  }, [])

  const loadScope = useCallback(() => {
    if (!selectedCollection) return
    if (graphMode === 'project') {
      if (selectedProjectId) void loadProjectGraph(selectedProjectId, selectedCollection)
    } else if (graphMode === 'bridge') {
      void loadBridgeGraph(selectedCollection)
    } else {
      void loadCollection(selectedCollection)
    }
  }, [selectedCollection, graphMode, selectedProjectId, loadCollection, loadProjectGraph, loadBridgeGraph])

  useEffect(() => {
    clearAll()
    useUIStore.getState().exitPathMode()
    loadScope()
  }, [loadScope, clearAll])
  useRefreshOnFocus(loadScope)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      if (e.key === 'Escape') {
        clearAll()
        if (isCompact) setFiltersPreference(false)
      }
      if (e.key === '/') {
        e.preventDefault()
        setFiltersPreference(true)
        requestAnimationFrame(() => studioRef.current?.querySelector<HTMLInputElement>('input[data-graph-search]')?.focus())
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearAll, isCompact])

  useEffect(() => {
    const el = studioRef.current
    if (!el) return
    const updateWidth = () => setStudioWidth(el.clientWidth)
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(el)
    return () => observer.disconnect()
  }, [selectedCollection])

  // Node inspection takes the foreground when filters use a compact overlay.
  useEffect(() => {
    if (isCompact && selectedNode) setFiltersPreference(false)
  }, [selectedNode, isCompact])
  useEffect(() => {
    if (isCompact && selectedNode && isLoadingDetail) setFiltersPreference(false)
  }, [selectedNode, isCompact, isLoadingDetail])
  useEffect(() => {
    if (lsbScrollTarget) setFiltersPreference(true)
  }, [lsbScrollTarget])

  // Track canvas container dimensions
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateSize = () => setDimensions({ width: el.clientWidth, height: el.clientHeight })
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [selectedCollection])

  // Project mode: prompt to pick a project if none selected
  const showProjectPrompt = graphMode === 'project' && !selectedProjectId && !isLoading
  const scopeMatches = storeCollection === selectedCollection && storeMode === graphMode &&
    (graphMode !== 'project' || storeProjectId === selectedProjectId)
  const loadingScope = !showProjectPrompt && (isLoading || !scopeMatches)
  const showGraph = !loadingScope && !error && nodeCount > 0 && !showProjectPrompt
  const showEmpty = !loadingScope && !error && nodeCount === 0 && !showProjectPrompt
  const showRSB = Boolean(selectedNode || showCollectionCard) && !(isCompact && filtersOpen)
  const scopeKey = `${selectedCollection ?? ''}::${graphMode}::${selectedProjectId ?? ''}`

  useEffect(() => {
    if (!showGraph || studioWidth === 0) return
    if (lastAutoOpenedScopeRef.current === scopeKey) return
    if (selectedNode || showCollectionCard) {
      lastAutoOpenedScopeRef.current = scopeKey
      return
    }

    if (!isCompact) openCollectionCard()
    lastAutoOpenedScopeRef.current = scopeKey
  }, [showGraph, scopeKey, selectedNode, showCollectionCard, openCollectionCard, studioWidth, isCompact])

  // Collection picker gate
  if (!selectedCollection) {
    return <CollectionPicker onSelect={handleCollectionSelect} />
  }

  return (
    <div ref={studioRef} className={`nitanics-studio ${isCompact ? 'nitanics-studio-compact' : ''} ${studioWidth < 560 ? 'nitanics-studio-mobile' : ''}`}>
      {showGraph && (
        <div className="nitanics-studio-controls" role="group" aria-label="Graph panels">
          <button ref={filtersToggleRef} type="button" className="nitanics-studio-panel-toggle" aria-expanded={filtersOpen} aria-controls="nitanics-graph-filters" onClick={() => setFiltersPreference(!filtersOpen)}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M4 17h16M8 4v6M16 14v6" strokeLinecap="round" /></svg>
            Filters
          </button>
          <button ref={detailsToggleRef} type="button" className="nitanics-studio-panel-toggle" aria-expanded={showCollectionCard && showRSB} aria-controls="nitanics-graph-inspector" onClick={() => {
            if (showCollectionCard && showRSB) clearAll()
            else {
              if (isCompact) setFiltersPreference(false)
              openCollectionCard()
            }
          }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" strokeLinecap="round" /></svg>
            Collection details
          </button>
          <button type="button" className="nitanics-studio-panel-toggle" onClick={loadScope} aria-label="Refresh graph from Neo4j">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Refresh graph
          </button>
          <span className="nitanics-studio-panel-hint">Select a node to inspect its connections</span>
        </div>
      )}
      <div className="nitanics-studio-workspace">
      {showGraph && isCompact && (filtersOpen || showRSB) && (
        <button type="button" className="nitanics-studio-backdrop" aria-label={filtersOpen ? 'Close graph filters' : 'Close graph inspector'} onClick={() => filtersOpen ? closeFilters() : closeInspector()} />
      )}
      {showGraph && <LeftSidebar hidden={!filtersOpen} overlay={isCompact} onClose={closeFilters} />}

      {/* Canvas area */}
      <div className="nitanics-studio-canvas-column">
        <div ref={containerRef} className="flex-1 min-w-0 min-h-0 relative overflow-hidden">

          {loadingScope && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p style={{ color: 'var(--text-muted)' }}>Loading graph...</p>
            </div>
          )}

          {error && scopeMatches && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p style={{ color: 'var(--error)' }}>Failed to load: {error}</p>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Check your Neo4j connection in Settings, then try again.</p>
                <button onClick={loadScope} className="mt-4 rounded-full px-4 py-2 text-sm" style={{ background: 'var(--accent)', color: '#fff' }}>Retry loading graph</button>
              </div>
            </div>
          )}

          {showEmpty && (
            <div className="absolute inset-0 flex items-center justify-center" role="status">
              <div style={{ textAlign: 'center', padding: 40, maxWidth: 420 }}>
                <p style={{ color: 'var(--text-primary)', fontSize: 16, fontWeight: 600 }}>
                  {graphMode === 'bridge' ? 'No shared entities yet' : 'No graph data yet'}
                </p>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {graphMode === 'bridge'
                    ? 'Bridge view connects entities mentioned in two or more projects. Add another source to this collection to discover connections.'
                    : 'Add a source document to this collection, then refresh to explore its entities and relationships.'}
                </p>
                <button onClick={loadScope} className="mt-4 rounded-full border px-4 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Refresh graph</button>
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

          {showGraph && filteredNodeCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center" role="status">
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                <p>No nodes match the current filters.</p>
                <button onClick={resetAllFilters} className="mt-4 rounded-full px-4 py-2 text-sm" style={{ background: 'var(--accent)', color: '#fff' }}>Reset filters</button>
              </div>
            </div>
          )}

          {showGraph && <StatusBar />}
        </div>

        {showGraph && <Legend />}
      </div>

      {/* Right Sidebar */}
      {showGraph && showRSB && <RightSidebar overlay={isCompact} onClose={closeInspector} />}
      </div>
    </div>
  )
}
