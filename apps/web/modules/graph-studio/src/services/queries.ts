/**
 * Neo4j Queries — All Cypher queries as named async functions
 *
 * Source of truth: DESIGN-SPEC.md Section 15 (Q1–Q8)
 * TRAP T1: Database is 'memorytonic' (handled by neo4j.ts getSession)
 * TRAP T6: All Neo4j Integer → .toNumber()
 * TRAP T8: NEVER return entity.embedding
 */

import type { Record as Neo4jRecord } from 'neo4j-driver'
import { getSession } from './neo4j'
import type { ProjectSummary, BridgeEntity, EntityDetail, SearchResult, PathResult, CausalChain, CollectionInfo } from '../types/graph'

// ── Helpers ───────────────────────────────────────────────────

/** Safely convert Neo4j Integer to JS number */
function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return val
  if (typeof val === 'object' && val !== null && 'toNumber' in val) {
    return (val as { toNumber: () => number }).toNumber()
  }
  return Number(val) || 0
}

function toStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val)
}

function toStrArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String)
  return []
}

// ── Q1: Load Collection Graph (startup) ───────────────────────

export interface Q1Row {
  entity: {
    entityId: string
    name: string
    category: string
    definition: string
    aliases: string[]
    pageRank: number
    betweenness: number
    degree: number
    projectCount: number
  }
  rel: {
    relType: string
    causalClassification: string
    description: string
    evidence: string
    evidenceStrength: string
    magnitude: string
    year: number | null
    projectId: string
  } | null
  targetId: string | null
}

export async function fetchCollectionGraph(collectionName: string): Promise<Q1Row[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
       MATCH (e:Entity)-[:MENTIONED_IN]->(p)
       WITH collect(DISTINCT e) AS entities, collect(DISTINCT p.uniqueId) AS projectIds
       UNWIND entities AS e1
       OPTIONAL MATCH (e1)-[r:RELATES_TO]->(e2)
       WHERE e2 IN entities AND (r.projectId IS NULL OR r.projectId IN projectIds)
       RETURN e1 {
         .entityId, .name, .category, .definition, .aliases,
         .pageRank, .betweenness, .degree, .projectCount
       } AS entity,
       r {
         .relType, .causalClassification, .description,
         .evidence, .evidenceStrength, .magnitude, .year, .projectId
       } AS rel,
       e2.entityId AS targetId`,
      { collectionName }
    )

    return result.records.map((rec: Neo4jRecord) => {
      const entity = rec.get('entity')
      const rel = rec.get('rel')
      return {
        entity: {
          entityId: toStr(entity.entityId),
          name: toStr(entity.name),
          category: toStr(entity.category),
          definition: toStr(entity.definition),
          aliases: toStrArray(entity.aliases),
          pageRank: toNum(entity.pageRank),
          betweenness: toNum(entity.betweenness),
          degree: toNum(entity.degree),
          projectCount: toNum(entity.projectCount),
        },
        rel: rel ? {
          relType: toStr(rel.relType),
          causalClassification: toStr(rel.causalClassification),
          description: toStr(rel.description),
          evidence: toStr(rel.evidence),
          evidenceStrength: toStr(rel.evidenceStrength),
          magnitude: toStr(rel.magnitude),
          year: rel.year != null ? toNum(rel.year) : null,
          projectId: toStr(rel.projectId),
        } : null,
        targetId: rec.get('targetId') ? toStr(rec.get('targetId')) : null,
      }
    })
  } finally {
    await session.close()
  }
}

// ── Q1b: Load MENTIONED_IN edges (entity → project membership) ──

export interface MentionedInRow {
  entityId: string
  projectUniqueId: string
  role: string
}

export async function fetchMentionedInEdges(collectionName: string): Promise<MentionedInRow[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (e:Entity)-[m:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
       RETURN e.entityId AS entityId, p.uniqueId AS projectUniqueId, m.role AS role`,
      { collectionName }
    )

    return result.records.map((rec: Neo4jRecord) => ({
      entityId: toStr(rec.get('entityId')),
      projectUniqueId: toStr(rec.get('projectUniqueId')),
      role: toStr(rec.get('role')),
    }))
  } finally {
    await session.close()
  }
}

// ── Q2: Load Projects (startup, alongside Q1) ────────────────

export async function fetchCollectionProjects(collectionName: string): Promise<ProjectSummary[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
       RETURN p.name AS name, p.uniqueId AS uniqueId, p.summary AS summary,
              p.domain AS domain, p.subdomain AS subdomain,
              p.baseTags AS baseTags, p.htmlPath AS htmlPath`,
      { collectionName }
    )

    return result.records.map((rec: Neo4jRecord) => ({
      name: toStr(rec.get('name')),
      uniqueId: toStr(rec.get('uniqueId')),
      summary: toStr(rec.get('summary')),
      domain: toStr(rec.get('domain')),
      subdomain: toStr(rec.get('subdomain')),
      baseTags: toStrArray(rec.get('baseTags')),
      htmlPath: toStr(rec.get('htmlPath')),
    }))
  } finally {
    await session.close()
  }
}

// ── Q7: Bridge Entities (startup, alongside Q1) ──────────────

export async function fetchBridgeEntities(collectionName: string): Promise<BridgeEntity[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
       WITH e, count(DISTINCT p) AS projectsInCollection
       WHERE projectsInCollection > 1
       RETURN e.name AS name, e.category AS category,
              projectsInCollection AS projectCount,
              e.pageRank AS pageRank, e.betweenness AS betweenness,
              CASE
                WHEN projectsInCollection >= 3 THEN 'gold'
                WHEN projectsInCollection = 2 THEN 'silver'
                ELSE 'bronze'
              END AS tier
       ORDER BY projectsInCollection DESC, e.pageRank DESC`,
      { collectionName }
    )

    return result.records.map((rec: Neo4jRecord) => ({
      name: toStr(rec.get('name')),
      category: toStr(rec.get('category')),
      projectCount: toNum(rec.get('projectCount')),
      pageRank: toNum(rec.get('pageRank')),
      betweenness: toNum(rec.get('betweenness')),
      tier: toStr(rec.get('tier')) as 'gold' | 'silver' | 'bronze',
    }))
  } finally {
    await session.close()
  }
}

// ── Q1c: Project Graph — entities scoped to exactly one project ──

/**
 * Returns graph rows (same shape as Q1) but strictly limited to
 * one project. Only RELATES_TO edges where r.projectId = projectUniqueId
 * are returned, so no cross-project bleed.
 */
export async function fetchProjectGraph(projectUniqueId: string): Promise<Q1Row[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (p:Project {uniqueId: $projectUniqueId})
       MATCH (e:Entity)-[:MENTIONED_IN]->(p)
       WITH collect(DISTINCT e) AS entities
       UNWIND entities AS e1
       OPTIONAL MATCH (e1)-[r:RELATES_TO]->(e2)
       WHERE e2 IN entities AND r.projectId = $projectUniqueId
       RETURN e1 {
         .entityId, .name, .category, .definition, .aliases,
         .pageRank, .betweenness, .degree, .projectCount
       } AS entity,
       r {
         .relType, .causalClassification, .description,
         .evidence, .evidenceStrength, .magnitude, .year, .projectId
       } AS rel,
       e2.entityId AS targetId`,
      { projectUniqueId }
    )

    return result.records.map((rec: Neo4jRecord) => {
      const entity = rec.get('entity')
      const rel = rec.get('rel')
      return {
        entity: {
          entityId: toStr(entity.entityId),
          name: toStr(entity.name),
          category: toStr(entity.category),
          definition: toStr(entity.definition),
          aliases: toStrArray(entity.aliases),
          pageRank: toNum(entity.pageRank),
          betweenness: toNum(entity.betweenness),
          degree: toNum(entity.degree),
          projectCount: toNum(entity.projectCount),
        },
        rel: rel ? {
          relType: toStr(rel.relType),
          causalClassification: toStr(rel.causalClassification),
          description: toStr(rel.description),
          evidence: toStr(rel.evidence),
          evidenceStrength: toStr(rel.evidenceStrength),
          magnitude: toStr(rel.magnitude),
          year: rel.year != null ? toNum(rel.year) : null,
          projectId: toStr(rel.projectId),
        } : null,
        targetId: rec.get('targetId') ? toStr(rec.get('targetId')) : null,
      }
    })
  } finally {
    await session.close()
  }
}

// ── Q1d: Bridge Graph — only entities shared across 2+ projects ──

/**
 * Returns graph rows (same shape as Q1) but limited to bridge entities
 * (those MENTIONED_IN 2+ projects in the collection).
 * Relationships are only shown between bridge entities.
 * This gives a true cross-project connection view — no single-project noise.
 */
export async function fetchBridgeGraph(collectionName: string): Promise<Q1Row[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
       WITH e, count(DISTINCT p) AS projectsInCollection, collect(DISTINCT p.uniqueId) AS projectIds
       WHERE projectsInCollection > 1
       // e is a bridge entity — collect them all
       WITH collect(e) AS bridgeEntities, collect(DISTINCT projectIds) AS allPIds
       UNWIND bridgeEntities AS e1
       OPTIONAL MATCH (e1)-[r:RELATES_TO]->(e2)
       WHERE e2 IN bridgeEntities
       RETURN e1 {
         .entityId, .name, .category, .definition, .aliases,
         .pageRank, .betweenness, .degree, .projectCount
       } AS entity,
       r {
         .relType, .causalClassification, .description,
         .evidence, .evidenceStrength, .magnitude, .year, .projectId
       } AS rel,
       e2.entityId AS targetId`,
      { collectionName }
    )

    return result.records.map((rec: Neo4jRecord) => {
      const entity = rec.get('entity')
      const rel = rec.get('rel')
      return {
        entity: {
          entityId: toStr(entity.entityId),
          name: toStr(entity.name),
          category: toStr(entity.category),
          definition: toStr(entity.definition),
          aliases: toStrArray(entity.aliases),
          pageRank: toNum(entity.pageRank),
          betweenness: toNum(entity.betweenness),
          degree: toNum(entity.degree),
          projectCount: toNum(entity.projectCount),
        },
        rel: rel ? {
          relType: toStr(rel.relType),
          causalClassification: toStr(rel.causalClassification),
          description: toStr(rel.description),
          evidence: toStr(rel.evidence),
          evidenceStrength: toStr(rel.evidenceStrength),
          magnitude: toStr(rel.magnitude),
          year: rel.year != null ? toNum(rel.year) : null,
          projectId: toStr(rel.projectId),
        } : null,
        targetId: rec.get('targetId') ? toStr(rec.get('targetId')) : null,
      }
    })
  } finally {
    await session.close()
  }
}

// ── Q3: Fetch Entity Detail (on entity click) ────────────────

export async function fetchEntityDetail(entityName: string, collectionName: string): Promise<EntityDetail> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (e:Entity {name: $entityName})
       OPTIONAL MATCH (e)-[m:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
       WITH e, collect(DISTINCT {name: p.name, uniqueId: p.uniqueId, role: m.role}) AS projects
       OPTIONAL MATCH (e)-[r:RELATES_TO]-(other:Entity)
       WHERE (other)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
       WITH e, projects, collect(DISTINCT {
         entityName: other.name, relType: r.relType,
         causalClassification: r.causalClassification,
         description: r.description, magnitude: r.magnitude, year: r.year
       }) AS relationships
       OPTIONAL MATCH (e)-[cl:CHAIN_LINK]-(linked:Entity)
       WHERE (linked)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
       OPTIONAL MATCH (cc:CausalChain {chainId: cl.chainId})
       WITH e, projects, relationships, collect(DISTINCT {
         chainId: cl.chainId, chainName: cc.name,
         linkedEntity: linked.name, orderIndex: cl.orderIndex, explanation: cl.explanation
       }) AS chainLinks
       OPTIONAL MATCH (e)-[s:SIMILAR_TO]-(sim:Entity)
       WHERE (sim)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
       RETURN e {
         .name, .category, .definition, .aliases,
         .pageRank, .betweenness, .degree, .projectCount
       } AS entity,
       projects,
       relationships,
       chainLinks,
       collect(DISTINCT {name: sim.name, category: sim.category, similarity: s.similarity}) AS similar`,
      { entityName, collectionName }
    )

    const rec = result.records[0]
    if (!rec) {
      console.error('[fetchEntityDetail] No record returned for entity:', entityName, 'in collection:', collectionName)
      throw new Error(`Entity not found: ${entityName}`)
    }

    const entity = rec.get('entity')
    const projects = rec.get('projects') as Array<Record<string, unknown>>
    const relationships = rec.get('relationships') as Array<Record<string, unknown>>
    const chainLinks = rec.get('chainLinks') as Array<Record<string, unknown>>
    const similar = rec.get('similar') as Array<Record<string, unknown>>

    return {
      name: toStr(entity.name),
      category: toStr(entity.category),
      definition: toStr(entity.definition),
      aliases: toStrArray(entity.aliases),
      pageRank: toNum(entity.pageRank),
      betweenness: toNum(entity.betweenness),
      degree: toNum(entity.degree),
      projectCount: toNum(entity.projectCount),
      projects: projects
        .filter(p => p.name != null)
        .map(p => ({
          name: toStr(p.name),
          uniqueId: toStr(p.uniqueId),
          role: toStr(p.role),
        })),
      relationships: relationships
        .filter(r => r.entityName != null)
        .map(r => ({
          entityName: toStr(r.entityName),
          relType: toStr(r.relType),
          causalClassification: toStr(r.causalClassification),
          description: toStr(r.description),
          magnitude: toStr(r.magnitude),
          year: r.year != null ? toNum(r.year) : undefined,
        })),
      chainLinks: chainLinks
        .filter(c => c.chainId != null)
        .map(c => ({
          chainId: toStr(c.chainId),
          chainName: toStr(c.chainName),
          linkedEntity: toStr(c.linkedEntity),
          orderIndex: toNum(c.orderIndex),
          explanation: toStr(c.explanation),
        })),
      similarEntities: similar
        .filter(s => s.name != null)
        .map(s => ({
          name: toStr(s.name),
          category: toStr(s.category),
          similarity: toNum(s.similarity),
        })),
    }
  } finally {
    await session.close()
  }
}

// ── Q4: Fulltext Search (on search input) ────────────────────

export async function fulltextSearch(query: string, collectionName: string): Promise<SearchResult[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `CALL db.index.fulltext.queryNodes('entity_fulltext', $searchTerm)
       YIELD node, score
       MATCH (node)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
       RETURN DISTINCT node.name AS name, node.category AS category,
         node.definition AS definition, score
       ORDER BY score DESC LIMIT 20`,
      { searchTerm: query + '*', collectionName }
    )

    return result.records.map((rec: Neo4jRecord) => ({
      name: toStr(rec.get('name')),
      category: toStr(rec.get('category')),
      definition: toStr(rec.get('definition')),
      score: toNum(rec.get('score')),
    }))
  } finally {
    await session.close()
  }
}

// ── Q5: Find Shortest Path (on path finder submit) ──────────

export async function findShortestPath(entityA: string, entityB: string, collectionName: string): Promise<PathResult | null> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (a:Entity {name: $entityA})-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
       WITH DISTINCT a
       MATCH (b:Entity {name: $entityB})-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
       WITH a, b LIMIT 1
       MATCH path = shortestPath((a)-[:RELATES_TO|MENTIONED_IN*..8]-(b))
       RETURN [n IN nodes(path) | n.name] AS entities,
         [r IN relationships(path) | type(r)] AS relTypes`,
      { entityA, entityB, collectionName }
    )

    if (result.records.length === 0) return null

    const rec = result.records[0]
    if (!rec) return null
    const entities = toStrArray(rec.get('entities'))
    const relTypes = toStrArray(rec.get('relTypes'))

    return {
      from: entityA,
      to: entityB,
      entities,
      relTypes,
      hops: entities.length - 1,
    }
  } finally {
    await session.close()
  }
}

// ── Q6: Fetch Causal Chains (for a project) ─────────────────

export async function fetchCausalChains(projectUniqueId: string): Promise<CausalChain[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p:Project {uniqueId: $projectUniqueId})
       OPTIONAL MATCH (e1:Entity)-[cl:CHAIN_LINK {chainId: cc.chainId}]->(e2:Entity)
       WITH cc, collect({
         fromEntity: e1.name, toEntity: e2.name,
         orderIndex: cl.orderIndex, explanation: cl.explanation
       }) AS links
       RETURN cc.chainId AS chainId, cc.name AS name,
         cc.description AS description, links
       ORDER BY cc.name`,
      { projectUniqueId }
    )

    return result.records.map((rec: Neo4jRecord) => {
      const links = rec.get('links') as Array<Record<string, unknown>>
      return {
        chainId: toStr(rec.get('chainId')),
        name: toStr(rec.get('name')),
        description: toStr(rec.get('description')),
        links: links
          .filter(l => l.fromEntity != null)
          .sort((a, b) => toNum(a.orderIndex) - toNum(b.orderIndex))
          .map(l => ({
            fromEntity: toStr(l.fromEntity),
            toEntity: toStr(l.toEntity),
            orderIndex: toNum(l.orderIndex),
            explanation: toStr(l.explanation),
          })),
      }
    })
  } finally {
    await session.close()
  }
}

// ── Q9: Fetch All Collections (for collection picker) ────────

export async function fetchCollections(): Promise<CollectionInfo[]> {
  const session = getSession()
  try {
    const result = await session.run(
      `MATCH (c:Collection)
       OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
       WITH c, collect(DISTINCT p) AS projects
       OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p2:Project)-[:BELONGS_TO]->(c)
       RETURN c.name AS name,
         size(projects) AS projectCount,
         count(DISTINCT e) AS entityCount
       ORDER BY c.name`
    )

    return result.records.map((rec: Neo4jRecord) => ({
      name: toStr(rec.get('name')),
      projectCount: toNum(rec.get('projectCount')),
      entityCount: toNum(rec.get('entityCount')),
    }))
  } finally {
    await session.close()
  }
}
