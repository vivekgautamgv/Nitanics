/**
 * useGraphData — Memoized graph data for react-force-graph-2d
 *
 * Source of truth: DESIGN-SPEC.md Section 4
 * TRAP T11: Must return NEW object reference when data changes,
 *           otherwise react-force-graph-2d won't re-render.
 */

import { useMemo } from 'react'
import { useGraphStore } from '../stores/graph-store'
import type { GraphData } from '../types/graph'

export function useGraphData(): GraphData {
  const filteredNodes = useGraphStore(s => s.filteredNodes)
  const filteredLinks = useGraphStore(s => s.filteredLinks)

  return useMemo(() => ({
    nodes: filteredNodes,
    links: filteredLinks,
  }), [filteredNodes, filteredLinks])
}
