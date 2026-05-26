/**
 * Frontend Type Definitions
 * Source of truth: DESIGN-SPEC.md Section 17
 */

// ── Route Types ──────────────────────────────────────────

export type Route =
  | { page: 'home' }
  | { page: 'directory'; name: string }
  | { page: 'collection'; name: string }
  | { page: 'project'; uniqueId: string; fromCollection?: string }
  | { page: 'entity'; name: string }
  | { page: 'graph'; collectionName: string }
  | { page: 'source'; htmlPath: string }
  | { page: 'settings' }
  | { page: 'ingest' }

export interface BreadcrumbSegment {
  label: string
  route: Route | null  // null = current page (not clickable)
}

// ── Home Screen ──────────────────────────────────────────

export interface DirectorySummary {
  name: string
  description: string | null
  projectCount: number
  collectionCount: number
  entityCount: number
}

export interface CollectionListItem {
  name: string
  projectCount: number
  directory?: string
}

// ── Directory View ───────────────────────────────────────

export interface DirectoryCollection {
  name: string
  projectCount: number
  entityCount: number
  allTags: string[]
  topEntities: Array<{ name: string; pageRank: number }>
}

export interface DirectoryProject {
  name: string
  uniqueId: string
  tags: string[]
  htmlPath: string
  domain: string
  subdomain: string
  collections: string[]
  entityCount: number
  createdDate: string | null
}

export interface DirectoryEntity {
  name: string
  category: string
  pageRank: number
  betweenness: number
  projectCount: number
  bridgeTier: 'gold' | 'silver' | 'none'
  dirProjectCount: number
  collectionNames: string[]
}

// ── Collection View ──────────────────────────────────────

export interface CollectionProject {
  name: string
  uniqueId: string
  tags: string[]
  htmlPath: string
  domain: string
  subdomain: string
  entityCount: number
  createdDate: string | null
}

export interface BridgeEntityItem {
  name: string
  category: string
  pageRank: number
  betweenness: number
  projectCount: number
  tier: 'gold' | 'silver'
  projectNames: string[]
  connectedEntities: string[]
}

export interface TopEntityItem {
  name: string
  category: string
  pageRank: number
}

export interface CategoryCount {
  category: string
  count: number
}

export interface CausalChainItem {
  chainName: string
  chainDescription: string
  chainId?: string
  projectName: string
  projectId?: string
  links: Array<{
    source: string
    target: string
    orderIndex: number
    explanation: string
  }>
}

export interface ProjectRecommendation {
  name: string
  uniqueId: string
  domain: string
  subdomain: string
  sharedEntityNames: string[]
  sharedCount: number
}

// ── Project View ─────────────────────────────────────────

export interface ProjectEntity {
  name: string
  category: string
  pageRank: number
  projectCount: number
  role: string
  bridgeTier: 'gold' | 'silver' | 'none'
}

export interface ProjectRelationship {
  source: string
  target: string
  relType: string
  causalClassification: string
  description: string
  evidence: string
  evidenceStrength: string
  magnitude: string
  year: string | null
}

export interface TimelineEvent {
  phaseIndex: number
  label: string
  period: string | null
  entities: string[]
}

export interface RelatedProject {
  name: string
  uniqueId: string
  domain: string
  sharedNames: string[]
  sharedCount: number
}

// ── Entity View ──────────────────────────────────────────

export interface EntityProjectMention {
  project: string
  uniqueId: string
  role: string
  htmlPath: string
  directory: string
  domain: string
  collections: string[]
}

export interface EntityRelationship {
  entity: string
  relType: string
  causalClassification: string
  description: string
  evidence: string
  magnitude: string
  evidenceStrength: string
  year: string | null
}

export interface EntityChainLink {
  chainId: string
  chainName: string
  entity: string
  orderIndex: number
  explanation: string
}

export interface SimilarEntity {
  name: string
  category: string
  similarity: number
}
