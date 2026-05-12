/**
 * Graph Store — Data + Filters + Computed
 *
 * Source of truth: DESIGN-SPEC.md Section 14 (graph-store interface), Section 8 (Filter Pipeline)
 *
 * Filter pipeline (AND-chained):
 *   1. Project Filter → entity must be MENTIONED_IN at least one checked project
 *   2. Importance Bandwidth → compositeImportance within slider range
 *   3. Category Filter → category in active set
 *   4. Bridge Filter → bridge tier in active set
 *   5. Edge Type Filter → applied to links, not nodes
 *   Project nodes always pass steps 1-3.
 */

import { create } from 'zustand'
import type { GraphNode, GraphLink, ProjectSummary } from '../types/graph'
import {
  fetchCollectionGraph, fetchCollectionProjects, fetchBridgeEntities, fetchMentionedInEdges,
  fetchProjectGraph, fetchBridgeGraph,
} from '../services/queries'
import { toGraphData } from '../services/transforms'

export type GraphMode = 'collection' | 'project' | 'bridge'

interface GraphStore {
  // DATA
  collection: string
  graphMode: GraphMode
  selectedProjectId: string | null  // used in Project mode
  allNodes: GraphNode[]
  allLinks: GraphLink[]
  projects: ProjectSummary[]
  isLoading: boolean
  error: string | null

  // FILTERS
  projectFilter: Set<string>
  bandwidthRange: [number, number]
  categoryFilter: Set<string>
  bridgeFilter: Set<string>
  edgeTypeFilter: Set<string>

  // COMPUTED
  filteredNodes: GraphNode[]
  filteredLinks: GraphLink[]

  // OVERLAYS
  searchHighlights: Set<string>
  highlightedPath: string[]
  highlightedChain: string[]

  // LSB NAVIGATION
  lsbScrollTarget: string | null

  // ACTIONS
  loadCollection: (name: string) => Promise<void>
  loadProjectGraph: (projectUniqueId: string, collectionName: string) => Promise<void>
  loadBridgeGraph: (collectionName: string) => Promise<void>
  setGraphMode: (mode: GraphMode) => void
  toggleProject: (uniqueId: string) => void
  setBandwidthRange: (range: [number, number]) => void
  toggleCategory: (category: string) => void
  toggleBridgeTier: (tier: string) => void
  toggleEdgeType: (classification: string) => void
  resetAllFilters: () => void
  setBridgeFilter: (filter: Set<string>) => void
  selectAllProjects: () => void
  deselectAllProjects: () => void
  selectAllCategories: () => void
  deselectAllCategories: () => void
  selectAllBridgeTiers: () => void
  deselectAllBridgeTiers: () => void
  selectAllEdgeTypes: () => void
  deselectAllEdgeTypes: () => void
  setSearchHighlights: (names: Set<string>) => void
  setHighlightedPath: (names: string[]) => void
  clearPath: () => void
  setHighlightedChain: (names: string[]) => void
  clearChain: () => void
  scrollToLsbSection: (sectionId: string) => void
  clearLsbScrollTarget: () => void
}

// ── Filter pipeline (called after any filter change) ──────────

function computeFiltered(state: {
  allNodes: GraphNode[]
  allLinks: GraphLink[]
  projectFilter: Set<string>
  bandwidthRange: [number, number]
  categoryFilter: Set<string>
  bridgeFilter: Set<string>
  edgeTypeFilter: Set<string>
}): { filteredNodes: GraphNode[]; filteredLinks: GraphLink[] } {
  const {
    allNodes, allLinks,
    projectFilter, bandwidthRange, categoryFilter, bridgeFilter, edgeTypeFilter,
  } = state

  // Step 1-4: Filter nodes
  const filteredNodes = allNodes.filter(node => {
    // Project nodes always pass
    if (node.__type === 'project') return true

    // Step 1: Project filter — entity must be in at least one checked project
    if (projectFilter.size > 0) {
      const inAnyProject = node.__projects.some(pid => projectFilter.has(pid))
      if (!inAnyProject && node.__projects.length > 0) return false
    }

    // Step 2: Importance bandwidth
    if (node.__compositeImportance < bandwidthRange[0] ||
        node.__compositeImportance > bandwidthRange[1]) return false

    // Step 3: Category filter
    if (!categoryFilter.has(node.category)) return false

    // Step 4: Bridge filter
    if (!bridgeFilter.has(node.__bridgeTier)) return false

    return true
  })

  // Build set of visible node IDs for link filtering
  const visibleNodeIds = new Set(filteredNodes.map(n => n.id))

  // Step 5: Filter links — both endpoints visible + edge type checked
  const filteredLinks = allLinks.filter(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id
    const targetId = typeof link.target === 'string' ? link.target : link.target.id
    if (!visibleNodeIds.has(sourceId) || !visibleNodeIds.has(targetId)) return false
    if (link.causalClassification && !edgeTypeFilter.has(link.causalClassification)) return false
    return true
  })

  return { filteredNodes, filteredLinks }
}

// ── Helper: toggle a value in a Set ───────────────────────────

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

// ── Store ─────────────────────────────────────────────────────

export const useGraphStore = create<GraphStore>((set, get) => ({
  // Initial state
  collection: '',
  graphMode: 'collection',
  selectedProjectId: null,
  allNodes: [],
  allLinks: [],
  projects: [],
  isLoading: false,
  error: null,

  // Filters — all ON by default
  projectFilter: new Set<string>(),
  bandwidthRange: [0, 100] as [number, number],
  categoryFilter: new Set<string>(),
  bridgeFilter: new Set(['gold', 'silver', 'bronze', 'none']),
  edgeTypeFilter: new Set<string>(),

  // Computed
  filteredNodes: [],
  filteredLinks: [],

  // Overlays
  searchHighlights: new Set<string>(),
  highlightedPath: [],
  highlightedChain: [],

  // LSB navigation
  lsbScrollTarget: null,

  // ── Load ────────────────────────────────────────────────

  loadCollection: async (name: string) => {
    const state = get()
    if (state.isLoading) return
    set({ isLoading: true, error: null })

    try {
      const [rows, projects, bridges, mentionedIn] = await Promise.all([
        fetchCollectionGraph(name),
        fetchCollectionProjects(name),
        fetchBridgeEntities(name),
        fetchMentionedInEdges(name),
      ])

      const { nodes, links } = toGraphData(rows, projects, bridges, mentionedIn)

      const allCategories = new Set(nodes.map(n => n.category))
      const allProjectIds = new Set(projects.map(p => p.uniqueId))
      const allEdgeTypes = new Set(links.map(l => l.causalClassification).filter(Boolean))

      set({
        collection: name,
        allNodes: nodes,
        allLinks: links,
        projects,
        isLoading: false,
        error: null,
        filteredNodes: nodes,
        filteredLinks: links,
        projectFilter: allProjectIds,
        categoryFilter: allCategories,
        edgeTypeFilter: allEdgeTypes,
      })

      if (import.meta.env.DEV) console.log(`Graph loaded: ${nodes.length} nodes, ${links.length} links`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ isLoading: false, error: msg })
      console.error('Failed to load collection:', msg)
    }
  },

  // ── Load Project Graph (Project mode) ─────────────────────

  loadProjectGraph: async (projectUniqueId: string, collectionName: string) => {
    if (get().isLoading) return
    set({ isLoading: true, error: null, graphMode: 'project', selectedProjectId: projectUniqueId })
    try {
      const [rows, projects, mentionedIn] = await Promise.all([
        fetchProjectGraph(projectUniqueId),
        fetchCollectionProjects(collectionName),   // still need all projects for the picker UI
        fetchMentionedInEdges(collectionName),
      ])
      // Bridge data is empty in project mode — no cross-project bridges shown
      const { nodes, links } = toGraphData(rows, projects, [], mentionedIn)
      const allCategories = new Set(nodes.map(n => n.category))
      const allEdgeTypes = new Set(links.map(l => l.causalClassification).filter(Boolean))
      set({
        collection: collectionName,
        allNodes: nodes,
        allLinks: links,
        projects,
        isLoading: false,
        error: null,
        filteredNodes: nodes,
        filteredLinks: links,
        projectFilter: new Set([projectUniqueId]),  // locked to this project
        categoryFilter: allCategories,
        edgeTypeFilter: allEdgeTypes,
      })
      if (import.meta.env.DEV) console.log(`[Project Graph] ${nodes.length} nodes, ${links.length} links for project: ${projectUniqueId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ isLoading: false, error: msg })
      console.error('Failed to load project graph:', msg)
    }
  },

  // ── Load Bridge Graph (Bridge mode) ──────────────────────────

  loadBridgeGraph: async (collectionName: string) => {
    if (get().isLoading) return
    set({ isLoading: true, error: null, graphMode: 'bridge', selectedProjectId: null })
    try {
      const [rows, projects, bridges, mentionedIn] = await Promise.all([
        fetchBridgeGraph(collectionName),
        fetchCollectionProjects(collectionName),
        fetchBridgeEntities(collectionName),
        fetchMentionedInEdges(collectionName),
      ])
      const { nodes, links } = toGraphData(rows, projects, bridges, mentionedIn)
      // In bridge mode, only show bridge tiers — hide 'none' tier by default
      const allCategories = new Set(nodes.map(n => n.category))
      const allEdgeTypes = new Set(links.map(l => l.causalClassification).filter(Boolean))
      set({
        collection: collectionName,
        allNodes: nodes,
        allLinks: links,
        projects,
        isLoading: false,
        error: null,
        filteredNodes: nodes,
        filteredLinks: links,
        projectFilter: new Set(projects.map(p => p.uniqueId)),
        categoryFilter: allCategories,
        bridgeFilter: new Set(['gold', 'silver', 'bronze']),  // hide 'none' in bridge mode
        edgeTypeFilter: allEdgeTypes,
      })
      if (import.meta.env.DEV) console.log(`[Bridge Graph] ${nodes.length} bridge nodes, ${links.length} links for: ${collectionName}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ isLoading: false, error: msg })
      console.error('Failed to load bridge graph:', msg)
    }
  },

  setGraphMode: (mode: GraphMode) => set({ graphMode: mode }),

  // ── Filter actions (each recomputes filtered data) ──────

  toggleProject: (uniqueId: string) => {
    const s = get()
    const projectFilter = toggleInSet(s.projectFilter, uniqueId)
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, projectFilter })
    set({ projectFilter, filteredNodes, filteredLinks })
  },

  setBandwidthRange: (range: [number, number]) => {
    const s = get()
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, bandwidthRange: range })
    set({ bandwidthRange: range, filteredNodes, filteredLinks })
  },

  toggleCategory: (category: string) => {
    const s = get()
    const categoryFilter = toggleInSet(s.categoryFilter, category)
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, categoryFilter })
    set({ categoryFilter, filteredNodes, filteredLinks })
  },

  toggleBridgeTier: (tier: string) => {
    const s = get()
    const bridgeFilter = toggleInSet(s.bridgeFilter, tier)
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, bridgeFilter })
    set({ bridgeFilter, filteredNodes, filteredLinks })
  },

  toggleEdgeType: (classification: string) => {
    const s = get()
    const edgeTypeFilter = toggleInSet(s.edgeTypeFilter, classification)
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, edgeTypeFilter })
    set({ edgeTypeFilter, filteredNodes, filteredLinks })
  },

  // ── Bulk filter actions (for presets) ────────────────────

  resetAllFilters: () => {
    const s = get()
    const allCategories = new Set(s.allNodes.map(n => n.category))
    const allProjectIds = new Set(s.projects.map(p => p.uniqueId))
    const allEdgeTypes = new Set(s.allLinks.map(l => l.causalClassification).filter(Boolean))
    set({
      projectFilter: allProjectIds,
      categoryFilter: allCategories,
      bridgeFilter: new Set(['gold', 'silver', 'bronze', 'none']),
      edgeTypeFilter: allEdgeTypes,
      bandwidthRange: [0, 100] as [number, number],
      filteredNodes: s.allNodes,
      filteredLinks: s.allLinks,
    })
  },

  setBridgeFilter: (filter: Set<string>) => {
    const s = get()
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, bridgeFilter: filter })
    set({ bridgeFilter: filter, filteredNodes, filteredLinks })
  },

  // ── Per-section select all / deselect all ──────────────

  selectAllProjects: () => {
    const s = get()
    const projectFilter = new Set(s.projects.map(p => p.uniqueId))
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, projectFilter })
    set({ projectFilter, filteredNodes, filteredLinks })
  },
  deselectAllProjects: () => {
    const s = get()
    const projectFilter = new Set<string>()
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, projectFilter })
    set({ projectFilter, filteredNodes, filteredLinks })
  },

  selectAllCategories: () => {
    const s = get()
    const categoryFilter = new Set(s.allNodes.map(n => n.category))
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, categoryFilter })
    set({ categoryFilter, filteredNodes, filteredLinks })
  },
  deselectAllCategories: () => {
    const s = get()
    const categoryFilter = new Set<string>()
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, categoryFilter })
    set({ categoryFilter, filteredNodes, filteredLinks })
  },

  selectAllBridgeTiers: () => {
    const s = get()
    const bridgeFilter = new Set(['gold', 'silver', 'bronze', 'none'])
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, bridgeFilter })
    set({ bridgeFilter, filteredNodes, filteredLinks })
  },
  deselectAllBridgeTiers: () => {
    const s = get()
    const bridgeFilter = new Set<string>()
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, bridgeFilter })
    set({ bridgeFilter, filteredNodes, filteredLinks })
  },

  selectAllEdgeTypes: () => {
    const s = get()
    const edgeTypeFilter = new Set(s.allLinks.map(l => l.causalClassification).filter(Boolean))
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, edgeTypeFilter })
    set({ edgeTypeFilter, filteredNodes, filteredLinks })
  },
  deselectAllEdgeTypes: () => {
    const s = get()
    const edgeTypeFilter = new Set<string>()
    const { filteredNodes, filteredLinks } = computeFiltered({ ...s, edgeTypeFilter })
    set({ edgeTypeFilter, filteredNodes, filteredLinks })
  },

  // ── Overlays ────────────────────────────────────────────

  setSearchHighlights: (names) => set({ searchHighlights: names }),
  setHighlightedPath: (names) => set({ highlightedPath: names }),
  clearPath: () => set({ highlightedPath: [] }),
  setHighlightedChain: (names) => set({ highlightedChain: names }),
  clearChain: () => set({ highlightedChain: [] }),
  scrollToLsbSection: (sectionId) => set({ lsbScrollTarget: sectionId }),
  clearLsbScrollTarget: () => set({ lsbScrollTarget: null }),
}))
