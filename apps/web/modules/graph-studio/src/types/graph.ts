/**
 * Graph Studio — Type Definitions
 *
 * Source of truth: DESIGN-SPEC.md Section 14 (Type Definitions)
 * This file is the contract everything is built against.
 */

// ── Node Types ────────────────────────────────────────────────

export interface GraphNode {
  id: string                                    // entityId or project uniqueId
  name: string
  category: string                              // 14 categories or 'project'
  definition?: string
  aliases?: string[]

  // GDS metrics (from Neo4j)
  pageRank: number
  betweenness: number
  degree: number
  projectCount: number

  // Computed by transforms.ts
  __type: 'entity' | 'project'
  __compositeImportance: number                 // 0-100 percentile
  __sizeLevel: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'
  __radius: number                              // 4 | 6 | 8 | 12 | 16 | 20
  __bridgeTier: 'gold' | 'silver' | 'bronze' | 'none'
  __projects: string[]                          // Project uniqueIds this entity is in
  __neighborIds: Set<string>                    // Pre-computed neighbor set

  // d3-force managed (DO NOT SET manually)
  x?: number
  y?: number
  fx?: number
  fy?: number
}

// ── Link Types ────────────────────────────────────────────────

export interface GraphLink {
  source: string | GraphNode                    // MUTATED by d3-force (Trap T2)
  target: string | GraphNode
  relType: string
  causalClassification: string
  description: string
  evidence?: string
  evidenceStrength: string
  magnitude: string
  year?: number
  projectId: string

  // Computed by transforms.ts
  __curvature: number                           // 0 for unique pairs, offset for parallel
}

// ── Entity Detail (fetched on click, Q3) ──────────────────────

export interface EntityDetail {
  name: string
  category: string
  definition: string
  aliases: string[]
  pageRank: number
  betweenness: number
  degree: number
  projectCount: number
  projects: Array<{
    name: string
    uniqueId: string
    role: string                                // Per-project role from MENTIONED_IN
  }>
  relationships: Array<{
    entityName: string
    relType: string
    causalClassification: string
    description: string
    magnitude: string
    year?: number
  }>
  chainLinks: Array<{
    chainId: string
    chainName: string
    linkedEntity: string
    orderIndex: number
    explanation: string
  }>
  similarEntities: Array<{
    name: string
    category: string
    similarity: number
  }>
}

// ── Search & Path ─────────────────────────────────────────────

export interface SearchResult {
  name: string
  category: string
  definition: string
  score: number
}

export interface PathResult {
  from: string
  to: string
  entities: string[]                            // Ordered nodes in path
  relTypes: string[]                            // Edge types along path
  hops: number
}

// ── Project Summary (from Q2) ─────────────────────────────────

export interface ProjectSummary {
  name: string
  uniqueId: string
  summary: string
  domain: string
  subdomain: string
  baseTags: string[]
  htmlPath: string
}

// ── Exploration Card (RSB, Phase 5) ───────────────────────────

export interface ExplorationCardData {
  entity: GraphNode
  entityDetail: EntityDetail
  relationship: RelationshipToLocked
  sharedConnections: string[]
  ownConnections: string[]
  scopedRole: string | null
  expanded: boolean
}

export interface RelationshipToLocked {
  relType: string
  causalClassification: string
  description: string
  direction: 'outgoing' | 'incoming'
}

// ── Bridge Entity (from Q7) ───────────────────────────────────

export interface BridgeEntity {
  name: string
  category: string
  projectCount: number
  pageRank: number
  betweenness: number
  tier: 'gold' | 'silver' | 'bronze'
}

// ── Causal Chain (from Q6) ─────────────────────────────────────

export interface CausalChain {
  chainId: string
  name: string
  description: string
  links: Array<{
    fromEntity: string
    toEntity: string
    orderIndex: number
    explanation: string
  }>
}

// ── Collection Stats (from Q8) ────────────────────────────────

export interface CollectionStats {
  projectCount: number
  entityCount: number
  edgeCount: number
  bridgeCount: number
  topEntities: Array<{
    name: string
    category: string
    pageRank: number
  }>
  categoryBreakdown: Array<{
    category: string
    count: number
  }>
}

// ── Collection Info (for collection picker) ─────────────────

export interface CollectionInfo {
  name: string
  projectCount: number
  entityCount: number
}

// ── Graph Data bundle (passed to react-force-graph-2d) ────────

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}
