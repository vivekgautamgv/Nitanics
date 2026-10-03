/**
 * Selection Store — Node selection, lock/unlock, multi-card exploration
 *
 * Source of truth: DESIGN-SPEC.md Section 14 (selection-store), Section 6 (RSB), Section 7 (Interactions)
 *
 * Lock system:
 *   - Unlocked: clicking a node replaces the card
 *   - Locked: clicking a node adds an exploration card to the stack
 *   - Exploration cards are scoped to the locked entity
 */

import { create } from 'zustand'
import type { GraphNode, EntityDetail, ExplorationCardData, RelationshipToLocked } from '../types/graph'
import { fetchEntityDetail } from '../services/queries'
import { useGraphStore } from './graph-store'

let detailRequestId = 0
let explorationEpoch = 0
const pendingExplorations = new Set<string>()

interface SelectionStore {
  // Selection state
  selectedNode: GraphNode | null
  hoveredNode: GraphNode | null
  lockedNode: GraphNode | null
  hopRadius: number
  showCollectionCard: boolean

  // Multi-card state
  explorationStack: ExplorationCardData[]
  entityDetails: Map<string, EntityDetail>

  // Loading
  isLoadingDetail: boolean
  detailError: string | null

  // Actions
  selectNode: (node: GraphNode) => void
  hoverNode: (node: GraphNode | null) => void
  lockNode: () => void
  unlockNode: () => void
  addExplorationCard: (node: GraphNode) => void
  removeExplorationCard: (entityName: string) => void
  toggleExplorationExpanded: (entityName: string) => void
  setHopRadius: (hops: number) => void
  clearAll: () => void
  navigateTo: (entityName: string) => void
  selectProject: (node: GraphNode) => void
  openCollectionCard: () => void
  retryDetail: () => void
}

/** Fetch detail with cache */
async function getOrFetchDetail(
  cache: Map<string, EntityDetail>,
  name: string,
  collectionName: string,
): Promise<EntityDetail> {
  const cached = cache.get(name)
  if (cached) return cached
  const detail = await fetchEntityDetail(name, collectionName)
  return detail
}

function loadNodeDetail(node: GraphNode): void {
  const requestId = ++detailRequestId
  const collection = useGraphStore.getState().collection
  const selection = useSelectionStore.getState()
  useSelectionStore.setState({ isLoadingDetail: true, detailError: null })
  getOrFetchDetail(selection.entityDetails, node.name, collection).then(detail => {
    if (requestId !== detailRequestId || useGraphStore.getState().collection !== collection) return
    useSelectionStore.setState(state => ({
      entityDetails: new Map(state.entityDetails).set(node.name, detail),
      isLoadingDetail: pendingExplorations.size > 0,
      detailError: null,
    }))
  }).catch(error => {
    if (requestId !== detailRequestId || useGraphStore.getState().collection !== collection) return
    useSelectionStore.setState({
      isLoadingDetail: false,
      detailError: `Could not load ${node.name}: ${error instanceof Error ? error.message : String(error)}`,
    })
  })
}

function cancelDetailRequests(): void {
  detailRequestId++
  explorationEpoch++
  pendingExplorations.clear()
}

/** Find the relationship between two entities from their detail data */
function findRelationship(
  entityDetail: EntityDetail,
  lockedName: string,
): RelationshipToLocked {
  // Check outgoing from entity to locked
  const outgoing = entityDetail.relationships.find(r => r.entityName === lockedName)
  if (outgoing) {
    return {
      relType: outgoing.relType,
      causalClassification: outgoing.causalClassification,
      description: outgoing.description,
      direction: 'outgoing',
    }
  }
  // Default: indirect connection
  return {
    relType: 'RELATED',
    causalClassification: 'INFLUENCES',
    description: 'Connected in the knowledge graph',
    direction: 'outgoing',
  }
}

/** Compute scoped card data between an entity and the locked entity */
function computeScopedCard(
  node: GraphNode,
  entityDetail: EntityDetail,
  lockedDetail: EntityDetail,
): ExplorationCardData {
  const relationship = findRelationship(entityDetail, lockedDetail.name)

  // Shared connections = intersection of neighbor names
  const entityNeighbors = new Set(entityDetail.relationships.map(r => r.entityName))
  const lockedNeighbors = new Set(lockedDetail.relationships.map(r => r.entityName))
  const sharedConnections = [...entityNeighbors].filter(n => lockedNeighbors.has(n))
  const ownConnections = [...entityNeighbors].filter(n => !lockedNeighbors.has(n))

  // Scoped role = role in first shared project
  const sharedProjects = entityDetail.projects.filter(
    p => lockedDetail.projects.some(lp => lp.uniqueId === p.uniqueId)
  )
  const scopedRole = sharedProjects[0]?.role || null

  return {
    entity: node,
    entityDetail,
    relationship,
    sharedConnections,
    ownConnections,
    scopedRole,
    expanded: false,
  }
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selectedNode: null,
  hoveredNode: null,
  lockedNode: null,
  hopRadius: 2,
  showCollectionCard: false,
  explorationStack: [],
  entityDetails: new Map(),
  isLoadingDetail: false,
  detailError: null,

  selectNode: (node: GraphNode) => {
    const state = get()

    // If locked on an entity...
    if (state.lockedNode) {
      if (node.__type === 'entity') {
        // Don't add the locked node itself or duplicates
        if (node.name === state.lockedNode.name) return
        if (state.explorationStack.some(c => c.entity.name === node.name)) return
        get().addExplorationCard(node)
        return
      }
      if (node.__type === 'project') {
        // Show project card alongside locked entity — don't destroy lock
        set({ selectedNode: node })
        return
      }
    }

    // Unlocked: replace selection
    if (node.__type === 'project') {
      get().selectProject(node)
      return
    }

    set({ selectedNode: node, showCollectionCard: false })
    loadNodeDetail(node)
  },

  selectProject: (node: GraphNode) => {
    cancelDetailRequests()
    // Projects are standalone cards, not lockable
    set({
      selectedNode: node,
      lockedNode: null,
      explorationStack: [],
      isLoadingDetail: false,
      detailError: null,
      showCollectionCard: false,
    })
  },

  hoverNode: (node) => set({ hoveredNode: node }),

  lockNode: () => {
    const state = get()
    if (state.selectedNode?.__type === 'entity') {
      set({ lockedNode: state.selectedNode })
    }
  },

  unlockNode: () => {
    explorationEpoch++
    pendingExplorations.clear()
    const primary = get().lockedNode ?? get().selectedNode
    set({ lockedNode: null, selectedNode: primary, explorationStack: [], detailError: null })
    if (primary?.__type === 'entity' && !get().entityDetails.has(primary.name)) loadNodeDetail(primary)
    else set({ isLoadingDetail: false })
  },

  addExplorationCard: (node: GraphNode) => {
    const state = get()
    if (!state.lockedNode) return
    if (pendingExplorations.has(node.name) || state.explorationStack.some(card => card.entity.name === node.name)) return

    const epoch = explorationEpoch
    pendingExplorations.add(node.name)
    set({ selectedNode: node, isLoadingDetail: true, detailError: null })

    const lockedName = state.lockedNode.name

    const collection = useGraphStore.getState().collection
    Promise.all([
      getOrFetchDetail(state.entityDetails, node.name, collection),
      getOrFetchDetail(state.entityDetails, lockedName, collection),
    ]).then(([entityDetail, lockedDetail]) => {
      if (epoch !== explorationEpoch || !pendingExplorations.has(node.name) || get().lockedNode?.name !== lockedName || useGraphStore.getState().collection !== collection) return
      pendingExplorations.delete(node.name)
      const card = computeScopedCard(node, entityDetail, lockedDetail)
      set(s => ({
        explorationStack: [...s.explorationStack, card],
        entityDetails: new Map(s.entityDetails)
          .set(node.name, entityDetail)
          .set(lockedName, lockedDetail),
        isLoadingDetail: pendingExplorations.size > 0,
        detailError: null,
      }))
    }).catch(err => {
      if (epoch !== explorationEpoch || !pendingExplorations.has(node.name) || useGraphStore.getState().collection !== collection) return
      pendingExplorations.delete(node.name)
      set({ isLoadingDetail: pendingExplorations.size > 0, detailError: `Could not load ${node.name}: ${err instanceof Error ? err.message : String(err)}` })
    })
  },

  removeExplorationCard: (entityName: string) => {
    pendingExplorations.delete(entityName)
    set(s => ({
      explorationStack: s.explorationStack.filter(c => c.entity.name !== entityName),
    }))
  },

  toggleExplorationExpanded: (entityName: string) => {
    set(s => ({
      explorationStack: s.explorationStack.map(c =>
        c.entity.name === entityName ? { ...c, expanded: !c.expanded } : c
      ),
    }))
  },

  setHopRadius: (hops: number) => {
    set({ hopRadius: Math.max(1, Math.min(3, hops)) })
  },

  clearAll: () => {
    cancelDetailRequests()
    set({
      selectedNode: null,
      lockedNode: null,
      explorationStack: [],
      isLoadingDetail: false,
      showCollectionCard: false,
      hoveredNode: null,
      detailError: null,
    })
  },

  openCollectionCard: () => {
    cancelDetailRequests()
    set({
      selectedNode: null,
      lockedNode: null,
      explorationStack: [],
      isLoadingDetail: false,
      showCollectionCard: true,
      detailError: null,
    })
  },

  navigateTo: (entityName: string) => {
    // Find the node in allNodes
    const allNodes = useGraphStore.getState().allNodes
    const node = allNodes.find(n => n.name === entityName)
    if (!node) return

    cancelDetailRequests()
    set({ lockedNode: null, explorationStack: [] })
    get().selectNode(node)
  },

  retryDetail: () => {
    const state = get()
    if (state.lockedNode && state.selectedNode?.__type === 'entity' && state.selectedNode.id !== state.lockedNode.id) {
      get().addExplorationCard(state.selectedNode)
      return
    }
    const node = state.lockedNode ?? state.selectedNode
    if (node?.__type === 'entity') loadNodeDetail(node)
  },
}))

// Cached details and pending selections belong to a single loaded scope.
useGraphStore.subscribe((state, previous) => {
  if (state.collection !== previous.collection || state.graphMode !== previous.graphMode ||
      state.selectedProjectId !== previous.selectedProjectId || (state.isLoading && !previous.isLoading)) {
    useSelectionStore.getState().clearAll()
    useSelectionStore.setState({ entityDetails: new Map() })
  }
})
