/**
 * Transform Pipeline — Neo4j records → typed graph data
 *
 * Source of truth: DESIGN-SPEC.md Section 9 (Composite Importance), Section 10 (Parallel Edges)
 *
 * Pipeline:
 *   1. Deduplicate entities (same entity appears in multiple Q1 rows)
 *   2. Create project nodes (__type: 'project', __radius: 12)
 *   3. Track which projects each entity belongs to
 *   4. Normalize metrics → composite importance → percentile → size level
 *   5. Assign bridge tiers (from Q7 data)
 *   6. Build neighbor sets
 *   7. Detect parallel edges → assign curvature
 *   8. Return typed { nodes, links }
 *
 * TRAP T5: Multiple RELATES_TO between same entity pair
 * TRAP T6: Neo4j Integer conversion (handled upstream in queries.ts)
 */

import type { GraphNode, GraphLink, GraphData, ProjectSummary, BridgeEntity } from '../types/graph'
import type { Q1Row, MentionedInRow } from './queries'
import { IMPORTANCE_WEIGHTS, SIZE_THRESHOLDS, SIZE_LEVELS, PROJECT_NODE_RADIUS, PARALLEL_EDGE_CURVATURE, MENTIONED_IN_CLASSIFICATION } from '../constants/config'

// ── Main transform function ───────────────────────────────────

export function toGraphData(
  rows: Q1Row[],
  projects: ProjectSummary[],
  bridges: BridgeEntity[],
  mentionedIn: MentionedInRow[] = []
): GraphData {
  // Step 1: Deduplicate entities
  const entityMap = new Map<string, GraphNode>()
  const entityProjects = new Map<string, Set<string>>() // entityId → Set<projectId>

  for (const row of rows) {
    const e = row.entity
    if (!entityMap.has(e.entityId)) {
      entityMap.set(e.entityId, {
        id: e.entityId,
        name: e.name,
        category: e.category,
        definition: e.definition,
        aliases: e.aliases,
        pageRank: e.pageRank,
        betweenness: e.betweenness,
        degree: e.degree,
        projectCount: e.projectCount,
        __type: 'entity',
        __compositeImportance: 0,  // computed below
        __sizeLevel: 'm',          // computed below
        __radius: 8,               // computed below
        __bridgeTier: 'none',      // enriched below
        __projects: [],            // computed below
        __neighborIds: new Set(),  // computed below
      })
    }
  }

  // Step 2: Build links (deduplicate by source+target+relType+projectId)
  const linkKey = (sourceId: string, targetId: string, relType: string, projectId: string) =>
    `${sourceId}|${targetId}|${relType}|${projectId}`
  const seenLinks = new Set<string>()
  const links: GraphLink[] = []

  for (const row of rows) {
    if (!row.rel || !row.targetId) continue
    const sourceId = row.entity.entityId
    const key = linkKey(sourceId, row.targetId, row.rel.relType, row.rel.projectId)
    if (seenLinks.has(key)) continue
    seenLinks.add(key)

    // Only include if both endpoints exist
    if (!entityMap.has(sourceId) || !entityMap.has(row.targetId)) continue

    links.push({
      source: sourceId,
      target: row.targetId,
      relType: row.rel.relType,
      causalClassification: row.rel.causalClassification,
      description: row.rel.description,
      evidence: row.rel.evidence || undefined,
      evidenceStrength: row.rel.evidenceStrength,
      magnitude: row.rel.magnitude,
      year: row.rel.year ?? undefined,
      projectId: row.rel.projectId,
      __curvature: 0, // computed below
    })

    // Track entity → project membership via edge projectId
    if (row.rel.projectId) {
      if (!entityProjects.has(sourceId)) entityProjects.set(sourceId, new Set())
      entityProjects.get(sourceId)!.add(row.rel.projectId)
      if (!entityProjects.has(row.targetId)) entityProjects.set(row.targetId, new Set())
      entityProjects.get(row.targetId)!.add(row.rel.projectId)
    }
  }

  // Step 3: Create project nodes
  const projectNodeMap = new Map<string, GraphNode>()
  for (const p of projects) {
    const node: GraphNode = {
      id: p.uniqueId,
      name: p.name,
      category: 'project',
      definition: p.summary,
      aliases: [],
      pageRank: 0,
      betweenness: 0,
      degree: 0,
      projectCount: 0,
      __type: 'project' as const,
      __compositeImportance: 0,
      __sizeLevel: 'l' as const,
      __radius: PROJECT_NODE_RADIUS,
      __bridgeTier: 'none' as const,
      __projects: [p.uniqueId],
      __neighborIds: new Set<string>(),
    }
    projectNodeMap.set(p.uniqueId, node)
  }
  const projectNodes = Array.from(projectNodeMap.values())

  // Step 4: Build entity→project mapping from MENTIONED_IN data (authoritative)
  // and create MENTIONED_IN graph edges connecting entities to project nodes
  const entityProjectsFromMI = new Map<string, Set<string>>()

  for (const mi of mentionedIn) {
    if (!entityMap.has(mi.entityId) || !projectNodeMap.has(mi.projectUniqueId)) continue

    // Track entity→project membership
    if (!entityProjectsFromMI.has(mi.entityId)) entityProjectsFromMI.set(mi.entityId, new Set())
    entityProjectsFromMI.get(mi.entityId)!.add(mi.projectUniqueId)

    // Create MENTIONED_IN graph edge
    const linkId = `${mi.entityId}|${mi.projectUniqueId}|MENTIONED_IN`
    if (!seenLinks.has(linkId)) {
      seenLinks.add(linkId)
      links.push({
        source: mi.entityId,
        target: mi.projectUniqueId,
        relType: 'MENTIONED_IN',
        causalClassification: MENTIONED_IN_CLASSIFICATION,
        description: mi.role || 'Member of project',
        evidenceStrength: 'established',
        magnitude: 'marginal',
        projectId: mi.projectUniqueId,
        __curvature: 0,
      })
    }
  }

  // Set __projects on each entity (prefer MENTIONED_IN data, fall back to edge-based)
  for (const [entityId, node] of entityMap) {
    const miProjects = entityProjectsFromMI.get(entityId)
    const edgeProjects = entityProjects.get(entityId)
    if (miProjects && miProjects.size > 0) {
      node.__projects = Array.from(miProjects)
    } else if (edgeProjects && edgeProjects.size > 0) {
      node.__projects = Array.from(edgeProjects)
    }
  }

  // Step 5: Compute composite importance + size levels (entities only)
  const entities = Array.from(entityMap.values())
  computeImportanceAndSize(entities)

  // Step 6: Assign bridge tiers from Q7 data + compute bronze
  const bridgeMap = new Map(bridges.map(b => [b.name, b.tier]))
  for (const node of entities) {
    const tier = bridgeMap.get(node.name)
    if (tier) {
      node.__bridgeTier = tier
    }
  }

  // Step 6b: Compute bronze tier for single-project entities with high betweenness
  // Bronze = projectCount 1 + top 10% betweenness among single-project entities
  const singleProjectEntities = entities.filter(e => e.projectCount <= 1 && e.__bridgeTier === 'none')
  if (singleProjectEntities.length > 0) {
    const sortedBW = singleProjectEntities
      .map(e => e.betweenness)
      .sort((a, b) => a - b)
    const threshold = sortedBW[Math.floor(sortedBW.length * 0.9)] ?? Infinity
    for (const node of singleProjectEntities) {
      if (node.betweenness >= threshold && node.betweenness > 0) {
        node.__bridgeTier = 'bronze'
      }
    }
  }

  // Step 7: Build neighbor sets (across both entity and project nodes)
  const allNodeMap = new Map<string, GraphNode>([...entityMap, ...projectNodeMap])
  for (const link of links) {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id
    const targetId = typeof link.target === 'string' ? link.target : link.target.id
    allNodeMap.get(sourceId)?.__neighborIds.add(targetId)
    allNodeMap.get(targetId)?.__neighborIds.add(sourceId)
  }

  // Step 8: Detect parallel edges → assign curvature
  assignParallelCurvature(links)

  // Combine entity nodes + project nodes
  const allNodes = [...entities, ...projectNodes]

  return { nodes: allNodes, links }
}

// ── Composite Importance Computation ──────────────────────────

function computeImportanceAndSize(entities: GraphNode[]): void {
  if (entities.length === 0) return

  // Find min/max for normalization
  let minPR = Infinity, maxPR = -Infinity
  let minBW = Infinity, maxBW = -Infinity
  let minDeg = Infinity, maxDeg = -Infinity
  let maxPC = 1

  for (const e of entities) {
    if (e.pageRank < minPR) minPR = e.pageRank
    if (e.pageRank > maxPR) maxPR = e.pageRank
    if (e.betweenness < minBW) minBW = e.betweenness
    if (e.betweenness > maxBW) maxBW = e.betweenness
    if (e.degree < minDeg) minDeg = e.degree
    if (e.degree > maxDeg) maxDeg = e.degree
    if (e.projectCount > maxPC) maxPC = e.projectCount
  }

  // Compute raw scores
  const rawScores: number[] = []

  for (const e of entities) {
    const rangePR = maxPR - minPR || 1
    const rangeBW = maxBW - minBW || 1
    const rangeDeg = maxDeg - minDeg || 1
    const rangePC = maxPC - 1 || 1

    const normalizedPR = (e.pageRank - minPR) / rangePR
    const normalizedBW = (e.betweenness - minBW) / rangeBW
    const normalizedDeg = (e.degree - minDeg) / rangeDeg
    const normalizedPC = (e.projectCount - 1) / rangePC

    const raw =
      IMPORTANCE_WEIGHTS.pageRank * normalizedPR +
      IMPORTANCE_WEIGHTS.betweenness * normalizedBW +
      IMPORTANCE_WEIGHTS.degree * normalizedDeg +
      IMPORTANCE_WEIGHTS.projectCount * normalizedPC

    rawScores.push(raw)
  }

  // Compute percentile ranks
  const sorted = [...rawScores].sort((a, b) => a - b)

  for (let i = 0; i < entities.length; i++) {
    const raw = rawScores[i]!
    // Percentile: % of scores that are <= this score
    const rank = sorted.filter(s => s <= raw).length
    const percentile = Math.round((rank / entities.length) * 100)

    entities[i]!.__compositeImportance = percentile

    // Map percentile to size level
    const thresholds = SIZE_THRESHOLDS
    if (percentile < thresholds[0]) {
      entities[i]!.__sizeLevel = 'xs'
      entities[i]!.__radius = SIZE_LEVELS.xs
    } else if (percentile < thresholds[1]) {
      entities[i]!.__sizeLevel = 's'
      entities[i]!.__radius = SIZE_LEVELS.s
    } else if (percentile < thresholds[2]) {
      entities[i]!.__sizeLevel = 'm'
      entities[i]!.__radius = SIZE_LEVELS.m
    } else if (percentile < thresholds[3]) {
      entities[i]!.__sizeLevel = 'l'
      entities[i]!.__radius = SIZE_LEVELS.l
    } else if (percentile < thresholds[4]) {
      entities[i]!.__sizeLevel = 'xl'
      entities[i]!.__radius = SIZE_LEVELS.xl
    } else {
      entities[i]!.__sizeLevel = 'xxl'
      entities[i]!.__radius = SIZE_LEVELS.xxl
    }
  }
}

// ── Parallel Edge Detection ───────────────────────────────────

function assignParallelCurvature(links: GraphLink[]): void {
  // Group by undirected pair
  const pairMap = new Map<string, GraphLink[]>()

  for (const link of links) {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id
    const targetId = typeof link.target === 'string' ? link.target : link.target.id
    const pair = sourceId < targetId ? `${sourceId}|${targetId}` : `${targetId}|${sourceId}`

    if (!pairMap.has(pair)) pairMap.set(pair, [])
    pairMap.get(pair)!.push(link)
  }

  // Assign curvature to parallel edges
  for (const group of pairMap.values()) {
    if (group.length <= 1) continue

    const step = PARALLEL_EDGE_CURVATURE
    const half = (group.length - 1) / 2

    for (let i = 0; i < group.length; i++) {
      group[i]!.__curvature = (i - half) * step
    }
  }
}
