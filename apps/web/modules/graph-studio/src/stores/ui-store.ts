/**
 * UI Store — Sidebar state, search, path mode, zoom
 *
 * Source of truth: DESIGN-SPEC.md Section 14 (ui-store)
 * Phase 5: RSB open/close. Phase 6: search + path mode.
 */

import { create } from 'zustand'
import type { SearchResult, PathResult } from '../types/graph'

interface UIStore {
  // Search (Phase 6)
  searchQuery: string
  searchResults: SearchResult[]

  // Path mode (Phase 6)
  pathMode: boolean
  pathEntities: string[]
  pathResults: PathResult[]
  isComputingPaths: boolean

  // Zoom
  currentZoom: number

  // Zoom-to-node callback (registered by GraphCanvas)
  zoomToNode: ((nodeId: string) => void) | null

  // Canvas control callbacks (registered by GraphCanvas)
  unpinAllNodes: (() => void) | null
  reheatSimulation: (() => void) | null

  // Actions
  setSearchQuery: (query: string) => void
  setSearchResults: (results: SearchResult[]) => void
  exitPathMode: () => void
  addPathEntity: (name: string) => void
  removePathEntity: (name: string) => void
  setPathResults: (results: PathResult[]) => void
  setIsComputingPaths: (v: boolean) => void
  setCurrentZoom: (zoom: number) => void
  registerZoomToNode: (fn: (nodeId: string) => void) => void
  registerUnpinAll: (fn: () => void) => void
  registerReheat: (fn: () => void) => void
}

export const useUIStore = create<UIStore>((set) => ({
  searchQuery: '',
  searchResults: [],
  pathMode: false,
  pathEntities: [],
  pathResults: [],
  isComputingPaths: false,
  currentZoom: 1,
  zoomToNode: null,
  unpinAllNodes: null,
  reheatSimulation: null,

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  exitPathMode: () => set({ pathMode: false, pathEntities: [], pathResults: [] }),
  addPathEntity: (name) => set(s => ({
    pathEntities: s.pathEntities.length >= 5
      ? s.pathEntities
      : s.pathEntities.includes(name) ? s.pathEntities : [...s.pathEntities, name],
  })),
  removePathEntity: (name) => set(s => ({
    pathEntities: s.pathEntities.filter(n => n !== name),
  })),
  setPathResults: (results) => set({ pathResults: results }),
  setIsComputingPaths: (v) => set({ isComputingPaths: v }),
  setCurrentZoom: (zoom) => set({ currentZoom: zoom }),
  registerZoomToNode: (fn) => set({ zoomToNode: fn }),
  registerUnpinAll: (fn) => set({ unpinAllNodes: fn }),
  registerReheat: (fn) => set({ reheatSimulation: fn }),
}))
