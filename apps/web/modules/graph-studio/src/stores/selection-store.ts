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
  cache.set(name, detail)
  return detail
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

    set({ selectedNode: node, isLoadingDetail: true, showCollectionCard: false })

    // Fetch detail
    getOrFetchDetail(get().entityDetails, node.name, useGraphStore.getState().collection)
      .then(detail => {
        set(s => ({
          entityDetails: new Map(s.entityDetails).set(node.name, detail),
          isLoadingDetail: false,
        }))
      })
      .catch(err => {
        console.error('Failed to fetch entity detail:', err)
        set({ isLoadingDetail: false })
      })
  },

  selectProject: (node: GraphNode) => {
    // Projects are standalone cards, not lockable
    set({
      selectedNode: node,
      lockedNode: null,
      explorationStack: [],
      isLoadingDetail: false,
    })
  },

  hoverNode: (node) => set({ hoveredNode: node }),

  lockNode: () => {
    const state = get()
    if (state.selectedNode) {
      set({ lockedNode: state.selectedNode })
    }
  },

  unlockNode: () => {
    set({ lockedNode: null, explorationStack: [] })
  },

  addExplorationCard: (node: GraphNode) => {
    const state = get()
    if (!state.lockedNode) return

    set({ selectedNode: node, isLoadingDetail: true })

    const lockedName = state.lockedNode.name

    const collection = useGraphStore.getState().collection
    Promise.all([
      getOrFetchDetail(state.entityDetails, node.name, collection),
      getOrFetchDetail(state.entityDetails, lockedName, collection),
    ]).then(([entityDetail, lockedDetail]) => {
      const card = computeScopedCard(node, entityDetail, lockedDetail)
      set(s => ({
        explorationStack: [...s.explorationStack, card],
        entityDetails: new Map(s.entityDetails)
          .set(node.name, entityDetail)
          .set(lockedName, lockedDetail),
        isLoadingDetail: false,
      }))
    }).catch(err => {
      console.error('Failed to fetch exploration detail:', err)
      set({ isLoadingDetail: false })
    })
  },

  removeExplorationCard: (entityName: string) => {
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
    set({
      selectedNode: null,
      lockedNode: null,
      explorationStack: [],
      isLoadingDetail: false,
      showCollectionCard: false,
    })
  },

  openCollectionCard: () => {
    set({
      selectedNode: null,
      lockedNode: null,
      explorationStack: [],
      isLoadingDetail: false,
      showCollectionCard: true,
    })
  },

  navigateTo: (entityName: string) => {
    // Find the node in allNodes
    const allNodes = useGraphStore.getState().allNodes
    const node = allNodes.find(n => n.name === entityName)
    if (!node) return

    // Unlock, clear stack, select new node as primary
    set({
      lockedNode: null,
      explorationStack: [],
      selectedNode: node,
      isLoadingDetail: true,
    })

    getOrFetchDetail(get().entityDetails, entityName, useGraphStore.getState().collection)
      .then(detail => {
        set(s => ({
          entityDetails: new Map(s.entityDetails).set(entityName, detail),
          isLoadingDetail: false,
        }))
      })
      .catch(err => {
        console.error('Failed to navigate to entity:', err)
        set({ isLoadingDetail: false })
      })
  },
}))
