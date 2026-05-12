/**
 * Frontend Neo4j Queries — Q-F1 through Q-F29
 * Source of truth: DESIGN-SPEC.md Section 15
 *
 * TRAP T1: Database is 'memorytonic' (handled by neo4j.ts driver).
 * TRAP T13: .toNumber() on EVERY Neo4j integer.
 * TRAP T14: Session MUST close in finally block.
 */
import { getSession } from '../adapters/neo4j-service'
import type {
  DirectorySummary, CollectionListItem,
  DirectoryCollection, DirectoryProject, DirectoryEntity,
  CollectionProject, BridgeEntityItem, TopEntityItem, CategoryCount,
  CausalChainItem, ProjectRecommendation,
  ProjectEntity, ProjectRelationship, TimelineEvent, RelatedProject,
  EntityProjectMention, EntityRelationship, EntityChainLink, SimilarEntity,
} from '../types/frontend'
import { resolveSourceUrl } from '../adapters/source-paths'

// ── Helper: safe number extraction ───────────────────────
function toNum(val: unknown): number {
  if (val == null) return 0
  if (typeof val === 'number') return val
  if (typeof val === 'object' && 'toNumber' in (val as Record<string, unknown>)) {
    return (val as { toNumber: () => number }).toNumber()
  }
  return Number(val) || 0
}

function toStr(val: unknown): string {
  if (val == null) return ''
  return String(val)
}

function toStrOrNull(val: unknown): string | null {
  if (val == null) return null
  return String(val)
}

function toStrArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  return val.map(v => String(v))
}

// ══════════════════════════════════════════════════════════
// HOME SCREEN QUERIES
// ══════════════════════════════════════════════════════════

/** Q-F1: Load All Directories */
export async function fetchAllDirectories(): Promise<DirectorySummary[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (d:DirectoryCategory)
      OPTIONAL MATCH (p:Project)-[:IN_DIRECTORY]->(d)
      OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Collection)
      OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      RETURN d.name AS name,
        d.description AS description,
        count(DISTINCT p) AS projectCount,
        count(DISTINCT c) AS collectionCount,
        count(DISTINCT e) AS entityCount
      ORDER BY d.name
    `)
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      description: toStrOrNull(r.get('description')),
      projectCount: toNum(r.get('projectCount')),
      collectionCount: toNum(r.get('collectionCount')),
      entityCount: toNum(r.get('entityCount')),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F29: Fetch All Collections (Graph Studio quick-launch) */
export async function fetchAllCollections(): Promise<CollectionListItem[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (c:Collection)
      OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
      OPTIONAL MATCH (p)-[:IN_DIRECTORY]->(d:DirectoryCategory)
      WITH c, count(DISTINCT p) AS projectCount, collect(DISTINCT d.name)[0] AS directory
      RETURN c.name AS name, projectCount, directory
      ORDER BY c.name
    `)
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      projectCount: toNum(r.get('projectCount')),
      directory: toStrOrNull(r.get('directory')) || undefined,
    }))
  } finally {
    await session.close()
  }
}

/** Q-F19: Create Directory */
export async function createDirectory(name: string, description: string): Promise<void> {
  const session = getSession()
  try {
    await session.executeWrite(tx =>
      tx.run(
        'CREATE (d:DirectoryCategory {name: $name, description: $description})',
        { name, description }
      )
    )
  } finally {
    await session.close()
  }
}

/** Q-F20: Update Directory */
export async function updateDirectory(
  oldName: string, newName: string, description: string
): Promise<void> {
  const session = getSession()
  try {
    await session.executeWrite(tx =>
      tx.run(
        'MATCH (d:DirectoryCategory {name: $oldName}) SET d.name = $newName, d.description = $description',
        { oldName, newName, description }
      )
    )
  } finally {
    await session.close()
  }
}

/** Q-F21: Delete Directory (only if empty) */
export async function deleteDirectory(name: string): Promise<boolean> {
  const session = getSession()
  try {
    const result = await session.executeWrite(tx =>
      tx.run(
        `MATCH (d:DirectoryCategory {name: $name})
         WHERE NOT EXISTS { MATCH (:Project)-[:IN_DIRECTORY]->(d) }
         DELETE d
         RETURN count(d) AS deleted`,
        { name }
      )
    )
    return toNum(result.records[0]?.get('deleted')) > 0
  } finally {
    await session.close()
  }
}

// ══════════════════════════════════════════════════════════
// DIRECTORY VIEW QUERIES
// ══════════════════════════════════════════════════════════

/** Q-F2: Load Directory Collections */
export async function fetchDirectoryCollections(dirName: string): Promise<DirectoryCollection[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (d:DirectoryCategory {name: $dirName})
      MATCH (p:Project)-[:IN_DIRECTORY]->(d)
      MATCH (p)-[:BELONGS_TO]->(c:Collection)
      OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      WITH c, collect(DISTINCT p) AS projects, collect(DISTINCT e) AS entities
      RETURN c.name AS name,
        size(projects) AS projectCount,
        size(entities) AS entityCount,
        reduce(tags = [], p IN projects | tags + p.baseTags) AS allTags,
        [e IN entities | {name: e.name, pageRank: e.pageRank}][..5] AS topEntities
      ORDER BY c.name
    `, { dirName })
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      projectCount: toNum(r.get('projectCount')),
      entityCount: toNum(r.get('entityCount')),
      allTags: [...new Set(toStrArray(r.get('allTags')))],
      topEntities: (r.get('topEntities') as Array<{ name: string; pageRank: unknown }> || []).map(e => ({
        name: toStr(e.name),
        pageRank: toNum(e.pageRank),
      })),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F3: Load Directory Projects */
export async function fetchDirectoryProjects(dirName: string): Promise<DirectoryProject[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (d:DirectoryCategory {name: $dirName})
      MATCH (p:Project)-[:IN_DIRECTORY]->(d)
      OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Collection)
      OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      OPTIONAL MATCH (p)-[:CREATED_ON]->(dt:DateTime {type: 'date'})
      RETURN p.name AS name, p.uniqueId AS uniqueId,
        p.baseTags AS tags, p.htmlPath AS htmlPath,
        p.domain AS domain, p.subdomain AS subdomain,
        collect(DISTINCT c.name) AS collections,
        count(DISTINCT e) AS entityCount,
        dt.date AS createdDate
      ORDER BY p.name
    `, { dirName })
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      uniqueId: toStr(r.get('uniqueId')),
      tags: toStrArray(r.get('tags')),
      htmlPath: toStr(r.get('htmlPath')),
      domain: toStr(r.get('domain')),
      subdomain: toStr(r.get('subdomain')),
      collections: toStrArray(r.get('collections')).filter(Boolean),
      entityCount: toNum(r.get('entityCount')),
      createdDate: toStrOrNull(r.get('createdDate')),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F4: Load Directory Entities */
export async function fetchDirectoryEntities(dirName: string): Promise<DirectoryEntity[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (d:DirectoryCategory {name: $dirName})
      MATCH (p:Project)-[:IN_DIRECTORY]->(d)
      MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Collection)
      WITH e, collect(DISTINCT p.name) AS projectNames,
        collect(DISTINCT c.name) AS collectionNames
      RETURN e.name AS name, e.category AS category,
        e.pageRank AS pageRank, e.betweenness AS betweenness,
        e.projectCount AS projectCount,
        CASE
          WHEN e.projectCount >= 3 THEN 'gold'
          WHEN e.projectCount = 2 THEN 'silver'
          ELSE 'none'
        END AS bridgeTier,
        size(projectNames) AS dirProjectCount,
        collectionNames
      ORDER BY e.pageRank DESC
    `, { dirName })
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      category: toStr(r.get('category')),
      pageRank: toNum(r.get('pageRank')),
      betweenness: toNum(r.get('betweenness')),
      projectCount: toNum(r.get('projectCount')),
      bridgeTier: toStr(r.get('bridgeTier')) as 'gold' | 'silver' | 'none',
      dirProjectCount: toNum(r.get('dirProjectCount')),
      collectionNames: toStrArray(r.get('collectionNames')).filter(Boolean),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F5: Cross-Entity Search — Collections by Project Name */
export async function searchCollectionsByProject(
  dirName: string, searchTerm: string
): Promise<Array<{ collectionName: string; matchedProjects: string[] }>> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (d:DirectoryCategory {name: $dirName})
      MATCH (p:Project)-[:IN_DIRECTORY]->(d)
      WHERE toLower(p.name) CONTAINS toLower($searchTerm)
      MATCH (p)-[:BELONGS_TO]->(c:Collection)
      RETURN DISTINCT c.name AS collectionName,
        collect(DISTINCT p.name) AS matchedProjects
    `, { dirName, searchTerm })
    return result.records.map(r => ({
      collectionName: toStr(r.get('collectionName')),
      matchedProjects: toStrArray(r.get('matchedProjects')),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F6: Cross-Entity Search — Collections by Entity Name */
export async function searchCollectionsByEntity(
  dirName: string, searchTerm: string
): Promise<Array<{ collectionName: string; matchedEntities: string[] }>> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (d:DirectoryCategory {name: $dirName})
      MATCH (p:Project)-[:IN_DIRECTORY]->(d)
      MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      WHERE toLower(e.name) CONTAINS toLower($searchTerm)
      MATCH (p)-[:BELONGS_TO]->(c:Collection)
      RETURN DISTINCT c.name AS collectionName,
        collect(DISTINCT e.name) AS matchedEntities
    `, { dirName, searchTerm })
    return result.records.map(r => ({
      collectionName: toStr(r.get('collectionName')),
      matchedEntities: toStrArray(r.get('matchedEntities')),
    }))
  } finally {
    await session.close()
  }
}

// ══════════════════════════════════════════════════════════
// COLLECTION VIEW QUERIES
// ══════════════════════════════════════════════════════════

/** Q-F7: Load Collection Summary */
export async function fetchCollectionSummary(collectionName: string) {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (c:Collection {name: $collectionName})
      OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
      OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      OPTIONAL MATCH (e)-[r:RELATES_TO]->(e2:Entity)-[:MENTIONED_IN]->(p2:Project)-[:BELONGS_TO]->(c)
      OPTIONAL MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p)
      WITH c, collect(DISTINCT p) AS projects,
        collect(DISTINCT e) AS entities,
        count(DISTINCT r) AS relCount,
        count(DISTINCT cc) AS chainCount
      RETURN c.name AS name,
        c.description AS description,
        size(projects) AS projectCount,
        size(entities) AS entityCount,
        relCount AS relationshipCount,
        chainCount AS causalChainCount
    `, { collectionName })
    const r = result.records[0]
    if (!r) return null
    return {
      name: toStr(r.get('name')),
      description: toStrOrNull(r.get('description')),
      projectCount: toNum(r.get('projectCount')),
      entityCount: toNum(r.get('entityCount')),
      relationshipCount: toNum(r.get('relationshipCount')),
      causalChainCount: toNum(r.get('causalChainCount')),
    }
  } finally {
    await session.close()
  }
}

/** Q-F8: Load Collection Projects */
export async function fetchCollectionProjects(collectionName: string): Promise<CollectionProject[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (c:Collection {name: $collectionName})<-[:BELONGS_TO]-(p:Project)
      OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      OPTIONAL MATCH (p)-[:CREATED_ON]->(dt:DateTime {type: 'date'})
      RETURN p.name AS name, p.uniqueId AS uniqueId,
        p.baseTags AS tags, p.htmlPath AS htmlPath,
        p.domain AS domain, p.subdomain AS subdomain,
        count(DISTINCT e) AS entityCount,
        dt.date AS createdDate
      ORDER BY p.name
    `, { collectionName })
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      uniqueId: toStr(r.get('uniqueId')),
      tags: toStrArray(r.get('tags')),
      htmlPath: toStr(r.get('htmlPath')),
      domain: toStr(r.get('domain')),
      subdomain: toStr(r.get('subdomain')),
      entityCount: toNum(r.get('entityCount')),
      createdDate: toStrOrNull(r.get('createdDate')),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F9: Load Collection Bridge Entities (enriched with project names + connected entities) */
export async function fetchCollectionBridges(collectionName: string): Promise<BridgeEntityItem[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (c:Collection {name: $collectionName})<-[:BELONGS_TO]-(p:Project)
      MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      WITH e, collect(DISTINCT p) AS projects, count(DISTINCT p) AS inCollectionCount
      WHERE inCollectionCount >= 2
      WITH e, projects, inCollectionCount
      OPTIONAL MATCH (e)-[:RELATES_TO]-(other:Entity)
      WHERE any(proj IN projects WHERE (other)-[:MENTIONED_IN]->(proj))
      WITH e, projects, inCollectionCount,
        collect(DISTINCT other.name) AS connectedEntities
      RETURN e.name AS name, e.category AS category,
        e.pageRank AS pageRank, e.betweenness AS betweenness,
        inCollectionCount AS projectCount,
        CASE
          WHEN inCollectionCount >= 3 THEN 'gold'
          WHEN inCollectionCount = 2 THEN 'silver'
        END AS tier,
        [proj IN projects | proj.name] AS projectNames,
        connectedEntities
      ORDER BY inCollectionCount DESC, e.pageRank DESC
    `, { collectionName })
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      category: toStr(r.get('category')),
      pageRank: toNum(r.get('pageRank')),
      betweenness: toNum(r.get('betweenness')),
      projectCount: toNum(r.get('projectCount')),
      tier: toStr(r.get('tier')) as 'gold' | 'silver',
      projectNames: toStrArray(r.get('projectNames')),
      connectedEntities: toStrArray(r.get('connectedEntities')),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F10: Recommend Projects for Collection */
export async function fetchProjectRecommendations(collectionName: string): Promise<ProjectRecommendation[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (c:Collection {name: $collectionName})<-[:BELONGS_TO]-(cp:Project)
      MATCH (e:Entity)-[:MENTIONED_IN]->(cp)
      WITH c, collect(DISTINCT e) AS collectionEntities
      MATCH (candidate:Project)
      WHERE NOT (candidate)-[:BELONGS_TO]->(c)
      MATCH (ce:Entity)-[:MENTIONED_IN]->(candidate)
      WHERE ce IN collectionEntities
      WITH candidate, collect(DISTINCT ce.name) AS sharedEntityNames,
        count(DISTINCT ce) AS sharedCount
      WHERE sharedCount > 0
      RETURN candidate.name AS name, candidate.uniqueId AS uniqueId,
        candidate.domain AS domain, candidate.subdomain AS subdomain,
        sharedEntityNames, sharedCount
      ORDER BY sharedCount DESC
      LIMIT 10
    `, { collectionName })
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      uniqueId: toStr(r.get('uniqueId')),
      domain: toStr(r.get('domain')),
      subdomain: toStr(r.get('subdomain')),
      sharedEntityNames: toStrArray(r.get('sharedEntityNames')),
      sharedCount: toNum(r.get('sharedCount')),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F16: Add Project to Collection */
export async function addProjectToCollection(uniqueId: string, collectionName: string): Promise<void> {
  const session = getSession()
  try {
    await session.executeWrite(tx =>
      tx.run(
        'MATCH (p:Project {uniqueId: $uid}), (c:Collection {name: $collectionName}) CREATE (p)-[:BELONGS_TO]->(c)',
        { uid: uniqueId, collectionName }
      )
    )
  } finally {
    await session.close()
  }
}

/** Q-F17: Remove Project from Collection */
export async function removeProjectFromCollection(uniqueId: string, collectionName: string): Promise<void> {
  const session = getSession()
  try {
    await session.executeWrite(tx =>
      tx.run(
        'MATCH (p:Project {uniqueId: $uid})-[r:BELONGS_TO]->(c:Collection {name: $collectionName}) DELETE r',
        { uid: uniqueId, collectionName }
      )
    )
  } finally {
    await session.close()
  }
}

/** Q-F18: Check Project Collection Count (before remove) */
export async function getProjectCollectionCount(uniqueId: string): Promise<number> {
  const session = getSession()
  try {
    const result = await session.run(
      'MATCH (p:Project {uniqueId: $uid})-[:BELONGS_TO]->(c:Collection) RETURN count(c) AS collectionCount',
      { uid: uniqueId }
    )
    return toNum(result.records[0]?.get('collectionCount'))
  } finally {
    await session.close()
  }
}

/** Q-F22: Update Collection Description */
export async function updateCollectionDescription(collectionName: string, description: string): Promise<void> {
  const session = getSession()
  try {
    await session.executeWrite(tx =>
      tx.run(
        'MATCH (c:Collection {name: $collectionName}) SET c.description = $description',
        { collectionName, description }
      )
    )
  } finally {
    await session.close()
  }
}

/** Q-F23: Create Collection (MERGE to prevent duplicates) */
export async function createCollection(name: string, description: string): Promise<void> {
  const session = getSession()
  try {
    await session.executeWrite(tx =>
      tx.run(
        `MERGE (c:Collection {name: $name})
         ON CREATE SET c.collectionId = randomUUID(),
           c.description = $description,
           c.createdAt = datetime()`,
        { name, description }
      )
    )
  } finally {
    await session.close()
  }
}

/** Q-F24: Load Collection Top Entities */
export async function fetchCollectionTopEntities(collectionName: string): Promise<TopEntityItem[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (c:Collection {name: $collectionName})<-[:BELONGS_TO]-(p:Project)
      MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      WITH DISTINCT e
      RETURN e.name AS name, e.category AS category, e.pageRank AS pageRank
      ORDER BY e.pageRank DESC
      LIMIT 10
    `, { collectionName })
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      category: toStr(r.get('category')),
      pageRank: toNum(r.get('pageRank')),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F25: Load Collection Category Breakdown */
export async function fetchCollectionCategories(collectionName: string): Promise<CategoryCount[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (c:Collection {name: $collectionName})<-[:BELONGS_TO]-(p:Project)
      MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      WITH DISTINCT e
      RETURN e.category AS category, count(e) AS count
      ORDER BY count DESC
    `, { collectionName })
    return result.records.map(r => ({
      category: toStr(r.get('category')),
      count: toNum(r.get('count')),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F26: Load Collection Causal Chains */
export async function fetchCollectionChains(collectionName: string): Promise<CausalChainItem[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (c:Collection {name: $collectionName})<-[:BELONGS_TO]-(p:Project)
      MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p)
      MATCH (a:Entity)-[cl:CHAIN_LINK {chainId: cc.chainId}]->(b:Entity)
      RETURN cc.name AS chainName, cc.description AS chainDescription,
        cc.chainId AS chainId, p.name AS projectName, p.uniqueId AS projectId,
        collect({
          source: a.name, target: b.name,
          orderIndex: cl.orderIndex, explanation: cl.explanation
        }) AS links
      ORDER BY cc.name
    `, { collectionName })
    return result.records.map(r => ({
      chainName: toStr(r.get('chainName')),
      chainDescription: toStr(r.get('chainDescription')),
      chainId: toStr(r.get('chainId')),
      projectName: toStr(r.get('projectName')),
      projectId: toStr(r.get('projectId')),
      links: (r.get('links') as Array<Record<string, unknown>> || [])
        .map(l => ({
          source: toStr(l.source),
          target: toStr(l.target),
          orderIndex: toNum(l.orderIndex),
          explanation: toStr(l.explanation),
        }))
        .sort((a, b) => a.orderIndex - b.orderIndex),
    }))
  } finally {
    await session.close()
  }
}

// ══════════════════════════════════════════════════════════
// PROJECT VIEW QUERIES
// ══════════════════════════════════════════════════════════

/** Q-F11: Load Project Full Detail */
export async function fetchProjectDetail(uniqueId: string) {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (p:Project {uniqueId: $uid})
      OPTIONAL MATCH (p)-[:IN_DIRECTORY]->(d:DirectoryCategory)
      OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Collection)
      OPTIONAL MATCH (p)-[:CREATED_ON]->(dt:DateTime {type: 'date'})
      RETURN p {
        .name, .uniqueId, .summary, .narrativeFlow, .domain, .subdomain,
        .baseTags, .htmlPath
      } AS project,
        d.name AS directory,
        collect(DISTINCT c.name) AS collections,
        dt.date AS createdDate
    `, { uid: uniqueId })
    const r = result.records[0]
    if (!r) return null
    const p = r.get('project') as Record<string, unknown>
    return {
      name: toStr(p.name),
      uniqueId: toStr(p.uniqueId),
      summary: toStr(p.summary),
      narrativeFlow: toStrArray(p.narrativeFlow),
      domain: toStr(p.domain),
      subdomain: toStr(p.subdomain),
      baseTags: toStrArray(p.baseTags),
      htmlPath: toStr(p.htmlPath),
      directory: toStr(r.get('directory')),
      collections: toStrArray(r.get('collections')).filter(Boolean),
      createdDate: toStrOrNull(r.get('createdDate')),
    }
  } finally {
    await session.close()
  }
}

/** Q-F12: Load Project Entities */
export async function fetchProjectEntities(uniqueId: string): Promise<ProjectEntity[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (p:Project {uniqueId: $uid})
      MATCH (e:Entity)-[m:MENTIONED_IN]->(p)
      RETURN e.name AS name, e.category AS category,
        e.pageRank AS pageRank, e.projectCount AS projectCount,
        m.role AS role,
        CASE
          WHEN e.projectCount >= 3 THEN 'gold'
          WHEN e.projectCount = 2 THEN 'silver'
          ELSE 'none'
        END AS bridgeTier
      ORDER BY e.pageRank DESC
    `, { uid: uniqueId })
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      category: toStr(r.get('category')),
      pageRank: toNum(r.get('pageRank')),
      projectCount: toNum(r.get('projectCount')),
      role: toStr(r.get('role')),
      bridgeTier: toStr(r.get('bridgeTier')) as 'gold' | 'silver' | 'none',
    }))
  } finally {
    await session.close()
  }
}

/** Q-F13: Load Project Relationships */
export async function fetchProjectRelationships(uniqueId: string): Promise<ProjectRelationship[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (p:Project {uniqueId: $uid})
      MATCH (e1:Entity)-[:MENTIONED_IN]->(p)
      MATCH (e2:Entity)-[:MENTIONED_IN]->(p)
      MATCH (e1)-[r:RELATES_TO]->(e2)
      RETURN e1.name AS source, e2.name AS target,
        r.relType AS relType, r.causalClassification AS causalClassification,
        r.description AS description, r.evidence AS evidence,
        r.evidenceStrength AS evidenceStrength, r.magnitude AS magnitude,
        r.year AS year
      ORDER BY CASE r.magnitude
        WHEN 'foundational' THEN 0
        WHEN 'significant' THEN 1
        WHEN 'marginal' THEN 2
        ELSE 3
      END
    `, { uid: uniqueId })
    return result.records.map(r => ({
      source: toStr(r.get('source')),
      target: toStr(r.get('target')),
      relType: toStr(r.get('relType')),
      causalClassification: toStr(r.get('causalClassification')),
      description: toStr(r.get('description')),
      evidence: toStr(r.get('evidence')),
      evidenceStrength: toStr(r.get('evidenceStrength')),
      magnitude: toStr(r.get('magnitude')),
      year: toStrOrNull(r.get('year')),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F14: Related Projects by Shared Entities */
export async function fetchRelatedProjects(uniqueId: string): Promise<RelatedProject[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (p:Project {uniqueId: $uid})
      MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      WITH p, collect(DISTINCT e) AS myEntities
      MATCH (other:Project)
      WHERE other <> p
      MATCH (e2:Entity)-[:MENTIONED_IN]->(other)
      WHERE e2 IN myEntities
      WITH other, collect(DISTINCT e2.name) AS sharedNames,
        count(DISTINCT e2) AS sharedCount
      RETURN other.name AS name, other.uniqueId AS uniqueId,
        other.domain AS domain, sharedNames, sharedCount
      ORDER BY sharedCount DESC
      LIMIT 10
    `, { uid: uniqueId })
    return result.records.map(r => ({
      name: toStr(r.get('name')),
      uniqueId: toStr(r.get('uniqueId')),
      domain: toStr(r.get('domain')),
      sharedNames: toStrArray(r.get('sharedNames')),
      sharedCount: toNum(r.get('sharedCount')),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F27: Load Project Causal Chains */
export async function fetchProjectChains(uniqueId: string): Promise<CausalChainItem[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (p:Project {uniqueId: $uid})
      MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p)
      MATCH (a:Entity)-[cl:CHAIN_LINK {chainId: cc.chainId}]->(b:Entity)
      RETURN cc.name AS chainName, cc.description AS chainDescription,
        p.name AS projectName,
        collect({
          source: a.name, target: b.name,
          orderIndex: cl.orderIndex, explanation: cl.explanation
        }) AS links
      ORDER BY cc.name
    `, { uid: uniqueId })
    return result.records.map(r => ({
      chainName: toStr(r.get('chainName')),
      chainDescription: toStr(r.get('chainDescription')),
      projectName: toStr(r.get('projectName')),
      links: (r.get('links') as Array<Record<string, unknown>> || [])
        .map(l => ({
          source: toStr(l.source),
          target: toStr(l.target),
          orderIndex: toNum(l.orderIndex),
          explanation: toStr(l.explanation),
        }))
        .sort((a, b) => a.orderIndex - b.orderIndex),
    }))
  } finally {
    await session.close()
  }
}

/** Q-F28: Load Project Timeline */
export async function fetchProjectTimeline(uniqueId: string): Promise<TimelineEvent[]> {
  const session = getSession()
  try {
    const result = await session.run(`
      MATCH (p:Project {uniqueId: $uid})
      MATCH (te:TemporalEvent)-[:BELONGS_TO_PROJECT]->(p)
      OPTIONAL MATCH (e:Entity)-[:FIRST_APPEARS_IN]->(te)
      RETURN te.phaseIndex AS phaseIndex, te.label AS label, te.period AS period,
        collect(DISTINCT e.name) AS entities
      ORDER BY te.phaseIndex
    `, { uid: uniqueId })
    return result.records.map(r => ({
      phaseIndex: toNum(r.get('phaseIndex')),
      label: toStr(r.get('label')),
      period: toStrOrNull(r.get('period')),
      entities: toStrArray(r.get('entities')).filter(Boolean),
    }))
  } finally {
    await session.close()
  }
}

// ══════════════════════════════════════════════════════════
// ENTITY VIEW QUERIES
// ══════════════════════════════════════════════════════════

/** Q-F15: Load Entity Full Profile */
export async function fetchEntityProfile(entityName: string) {
  const session = getSession()
  try {
    // Two-pass query: first get entity + projects with per-project collections,
    // then get relationships/chains/similar separately to avoid cartesian explosion
    const result = await session.run(`
      MATCH (e:Entity {name: $entityName})
      OPTIONAL MATCH (e)-[m:MENTIONED_IN]->(p:Project)
      OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Collection)
      OPTIONAL MATCH (p)-[:IN_DIRECTORY]->(d:DirectoryCategory)
      WITH e, p, m, d, collect(DISTINCT c.name) AS projectCollections
      WITH e, collect(DISTINCT {
        project: p.name, uniqueId: p.uniqueId,
        role: m.role, htmlPath: p.htmlPath,
        directory: d.name, domain: p.domain,
        collections: projectCollections
      }) AS projects
      OPTIONAL MATCH (e)-[r:RELATES_TO]-(other:Entity)
      WITH e, projects, collect(DISTINCT {
        entity: other.name, relType: r.relType,
        causalClassification: r.causalClassification,
        description: r.description, evidence: r.evidence,
        magnitude: r.magnitude,
        evidenceStrength: r.evidenceStrength, year: r.year
      }) AS relationships
      OPTIONAL MATCH (e)-[cl:CHAIN_LINK]-(linked:Entity)
      OPTIONAL MATCH (cc:CausalChain {chainId: cl.chainId})
      WITH e, projects, relationships, collect(DISTINCT {
        chainId: cl.chainId, chainName: cc.name,
        entity: linked.name, orderIndex: cl.orderIndex,
        explanation: cl.explanation
      }) AS chainLinks
      OPTIONAL MATCH (e)-[s:SIMILAR_TO]-(sim:Entity)
      RETURN e {
        .name, .category, .definition, .aliases,
        .pageRank, .betweenness, .degree, .projectCount
      } AS entity,
        projects,
        relationships,
        chainLinks,
        collect(DISTINCT {
          name: sim.name, category: sim.category, similarity: s.similarity
        }) AS similar
    `, { entityName })
    const r = result.records[0]
    if (!r) return null
    const e = r.get('entity') as Record<string, unknown>
    const projectCount = toNum(e.projectCount)

    const projects: EntityProjectMention[] = (r.get('projects') as Array<Record<string, unknown>> || [])
      .filter(p => p.project)
      .map(p => ({
        project: toStr(p.project),
        uniqueId: toStr(p.uniqueId),
        role: toStr(p.role),
        htmlPath: toStr(p.htmlPath),
        directory: toStr(p.directory),
        domain: toStr(p.domain),
        collections: toStrArray(p.collections as unknown[]).filter(Boolean),
      }))

    const relationships: EntityRelationship[] = (r.get('relationships') as Array<Record<string, unknown>> || [])
      .filter(rel => rel.entity)
      .map(rel => ({
        entity: toStr(rel.entity),
        relType: toStr(rel.relType),
        causalClassification: toStr(rel.causalClassification),
        description: toStr(rel.description),
        evidence: toStr(rel.evidence),
        magnitude: toStr(rel.magnitude),
        evidenceStrength: toStr(rel.evidenceStrength),
        year: toStrOrNull(rel.year),
      }))

    const chainLinks: EntityChainLink[] = (r.get('chainLinks') as Array<Record<string, unknown>> || [])
      .filter(cl => cl.chainId)
      .map(cl => ({
        chainId: toStr(cl.chainId),
        chainName: toStr(cl.chainName),
        entity: toStr(cl.entity),
        orderIndex: toNum(cl.orderIndex),
        explanation: toStr(cl.explanation),
      }))

    let similar: SimilarEntity[] = (r.get('similar') as Array<Record<string, unknown>> || [])
      .filter(s => s.name)
      .map(s => ({
        name: toStr(s.name),
        category: toStr(s.category),
        similarity: toNum(s.similarity),
      }))
      .sort((a, b) => b.similarity - a.similarity)

    // Fallback: if no SIMILAR_TO edges, use embedding vector similarity
    if (similar.length === 0) {
      const vecResult = await session.run(`
        MATCH (e:Entity {name: $entityName})
        WHERE e.embedding IS NOT NULL
        CALL db.index.vector.queryNodes('entityEmbedding', 11, e.embedding)
        YIELD node, score
        WHERE node.name <> $entityName
        RETURN node.name AS name, node.category AS category, score AS similarity
        ORDER BY score DESC
        LIMIT 10
      `, { entityName })
      similar = vecResult.records.map(vr => ({
        name: toStr(vr.get('name')),
        category: toStr(vr.get('category')),
        similarity: toNum(vr.get('similarity')),
      }))
    }

    // Derive flat collections list from per-project collections
    const collections = [...new Set(projects.flatMap(p => p.collections))].filter(Boolean)

    return {
      name: toStr(e.name),
      category: toStr(e.category),
      definition: toStr(e.definition),
      aliases: toStrArray(e.aliases),
      pageRank: toNum(e.pageRank),
      betweenness: toNum(e.betweenness),
      degree: toNum(e.degree),
      projectCount,
      bridgeTier: (projectCount >= 3 ? 'gold' : projectCount === 2 ? 'silver' : 'none') as 'gold' | 'silver' | 'bronze' | 'none',
      projects,
      collections,
      relationships,
      chainLinks,
      similarEntities: similar,
    }
  } finally {
    await session.close()
  }
}

// ══════════════════════════════════════════════════════════
// COLLECTION EXPORT
// ══════════════════════════════════════════════════════════

/** Export full collection as ZIP (graph.json + source HTMLs + manifest + README) */
export async function exportCollectionZIP(collectionName: string): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate')
  const session = getSession()
  try {
    // 1. Collection metadata
    const metaResult = await session.run(`
      MATCH (c:Collection {name: $collectionName})
      OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
      OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      RETURN c.name AS name, c.description AS description,
        count(DISTINCT p) AS projectCount, count(DISTINCT e) AS entityCount
    `, { collectionName })
    const meta = metaResult.records[0]

    // 2. Projects with full data
    const projectResult = await session.run(`
      MATCH (p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
      OPTIONAL MATCH (p)-[:IN_DIRECTORY]->(d:DirectoryCategory)
      RETURN p { .name, .uniqueId, .summary, .domain, .subdomain, .tags, .htmlPath, .createdDate } AS project,
        d.name AS directory
      ORDER BY p.name
    `, { collectionName })

    const projects: Array<{
      name: string
      uniqueId: string
      summary: string
      domain: string
      subdomain: string
      tags: string[]
      htmlPath: string
      createdDate: string | null
      directory: string
    }> = projectResult.records.map(r => {
      const p = r.get('project') as Record<string, unknown>
      return {
        name: toStr(p.name),
        uniqueId: toStr(p.uniqueId),
        summary: toStr(p.summary),
        domain: toStr(p.domain),
        subdomain: toStr(p.subdomain),
        tags: toStrArray(p.tags),
        htmlPath: toStr(p.htmlPath),
        createdDate: toStrOrNull(p.createdDate),
        directory: toStr(r.get('directory')),
      }
    })

    // 3. Entities with definitions and roles per project
    const entityResult = await session.run(`
      MATCH (e:Entity)-[m:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
      RETURN e.name AS name, e.category AS category, e.definition AS definition,
        e.aliases AS aliases, e.pageRank AS pageRank, e.betweenness AS betweenness,
        e.projectCount AS projectCount,
        collect({ project: p.name, role: m.role }) AS projectRoles
      ORDER BY e.pageRank DESC
    `, { collectionName })

    const entities = entityResult.records.map(r => ({
      name: toStr(r.get('name')),
      category: toStr(r.get('category')),
      definition: toStr(r.get('definition')),
      aliases: toStrArray(r.get('aliases')),
      pageRank: toNum(r.get('pageRank')),
      betweenness: toNum(r.get('betweenness')),
      projectCount: toNum(r.get('projectCount')),
      projectRoles: r.get('projectRoles') as Array<{ project: string; role: string }>,
    }))

    // 4. Relationships
    const relResult = await session.run(`
      MATCH (e1:Entity)-[r:RELATES_TO]->(e2:Entity)
      WHERE EXISTS { MATCH (e1)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName}) }
      AND EXISTS { MATCH (e2)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName}) }
      RETURN e1.name AS source, e2.name AS target,
        r.relType AS relType, r.causalClassification AS causalClassification,
        r.description AS description, r.evidence AS evidence,
        r.evidenceStrength AS evidenceStrength, r.magnitude AS magnitude
      ORDER BY e1.name, e2.name
    `, { collectionName })

    const relationships = relResult.records.map(r => ({
      source: toStr(r.get('source')),
      target: toStr(r.get('target')),
      relType: toStr(r.get('relType')),
      causalClassification: toStr(r.get('causalClassification')),
      description: toStr(r.get('description')),
      evidence: toStr(r.get('evidence')),
      evidenceStrength: toStr(r.get('evidenceStrength')),
      magnitude: toStr(r.get('magnitude')),
    }))

    // 5. Causal chains with links
    const chainResult = await session.run(`
      MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
      WITH cc, p
      OPTIONAL MATCH (src:Entity)-[cl:CHAIN_LINK]->(tgt:Entity)
      WHERE cl.chainId = cc.chainId
      RETURN cc.name AS chainName, cc.chainId AS chainId, cc.description AS chainDescription,
        p.name AS projectName,
        src.name AS source, tgt.name AS target, cl.explanation AS explanation, cl.orderIndex AS orderIndex
      ORDER BY cc.name, cl.orderIndex
    `, { collectionName })

    const chainMap = new Map<string, { chainName: string; chainId: string; description: string; projectName: string; links: Array<{ source: string; target: string; explanation: string; orderIndex: number }> }>()
    for (const r of chainResult.records) {
      const cid = toStr(r.get('chainId'))
      if (!chainMap.has(cid)) {
        chainMap.set(cid, {
          chainName: toStr(r.get('chainName')),
          chainId: cid,
          description: toStr(r.get('chainDescription')),
          projectName: toStr(r.get('projectName')),
          links: [],
        })
      }
      const src = toStr(r.get('source'))
      if (src) {
        chainMap.get(cid)!.links.push({
          source: src,
          target: toStr(r.get('target')),
          explanation: toStr(r.get('explanation')),
          orderIndex: toNum(r.get('orderIndex')),
        })
      }
    }
    const chains = Array.from(chainMap.values())

    // Build bridge tier list
    const bridges = entities
      .filter(e => e.projectCount >= 2)
      .map(e => ({
        name: e.name,
        category: e.category,
        tier: e.projectCount >= 3 ? 'gold' : 'silver',
        projects: e.projectCount,
        pageRank: e.pageRank,
        betweenness: e.betweenness,
      }))
      .sort((a, b) => b.projects - a.projects || b.betweenness - a.betweenness)

    // Build graph.json
    const graphJson = {
      meta: {
        collection: toStr(meta?.get('name')),
        exported_at: new Date().toISOString(),
        schema_version: '1.0',
        generator: 'Nitanics v4 Frontend Export',
        stats: {
          projects: projects.length,
          entities: entities.length,
          relationships: relationships.length,
          causal_chains: chains.length,
          bridges: bridges.length,
        },
      },
      projects: projects.map(p => ({
        name: p.name, domain: p.domain, subdomain: p.subdomain,
        summary: p.summary, tags: p.tags, directory: p.directory,
        html_file: p.htmlPath ? `projects/${slugify(toStr(p.name))}/source.html` : null,
      })),
      entities: entities.map(e => ({
        name: e.name, category: e.category, definition: e.definition,
        aliases: e.aliases, projectRoles: e.projectRoles,
        metrics: { pageRank: e.pageRank, betweenness: e.betweenness },
        bridge_tier: e.projectCount >= 3 ? 'gold' : e.projectCount >= 2 ? 'silver' : null,
      })),
      relationships,
      causal_chains: chains,
      bridges,
    }

    // Build README.md
    const readme = [
      `# ${graphJson.meta.collection}`,
      '',
      `Exported from Nitanics on ${graphJson.meta.exported_at.slice(0, 10)}`,
      '',
      `## Stats`,
      `- **${graphJson.meta.stats.projects}** projects`,
      `- **${graphJson.meta.stats.entities}** entities`,
      `- **${graphJson.meta.stats.relationships}** relationships`,
      `- **${graphJson.meta.stats.causal_chains}** causal chains`,
      `- **${graphJson.meta.stats.bridges}** bridge entities`,
      '',
      '## Projects',
      ...projects.map(p => `- **${p.name}** (${p.domain}${p.subdomain ? ' / ' + p.subdomain : ''})`),
      '',
      '## Bridge Entities',
      '| Entity | Category | Projects | Tier |',
      '|--------|----------|----------|------|',
      ...bridges.slice(0, 15).map(b => `| ${b.name} | ${b.category} | ${b.projects} | ${b.tier} |`),
      '',
      '## Files',
      '- `graph.json` — Complete knowledge graph (agent-readable)',
      '- `manifest.json` — Export metadata',
      '- `projects/<name>/source.html` — Styled source documents',
    ].join('\n')

    // Fetch HTML source files via HTTP
    const zipFiles: Record<string, Uint8Array> = {}
    zipFiles['graph.json'] = strToU8(JSON.stringify(graphJson, null, 2))
    zipFiles['README.md'] = strToU8(readme)

    // Fetch each project's HTML source
    for (const p of projects) {
      const htmlPath = toStr(p.htmlPath)
      if (!htmlPath) continue
      const slug = slugify(toStr(p.name))
      try {
        const url = resolveSourceUrl(htmlPath)
        const resp = await fetch(url)
        if (resp.ok) {
          const html = await resp.text()
          zipFiles[`projects/${slug}/source.html`] = strToU8(html)
        }
      } catch {
        // HTML not available — skip silently
      }
    }

    // Manifest
    const manifest = {
      format: 'memorytonic-collection-export',
      schema_version: '1.0',
      exported_at: graphJson.meta.exported_at,
      collection: graphJson.meta.collection,
      files: Object.keys(zipFiles).concat(['manifest.json']),
    }
    zipFiles['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))

    // Create ZIP
    const zipped = zipSync(zipFiles, { level: 6 })
    return new Blob([zipped], { type: 'application/zip' })
  } finally {
    await session.close()
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-_ ]/g, '').replace(/\s+/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '')
}

// ══════════════════════════════════════════════════════════
// RSB INFO CARD QUERIES
// ══════════════════════════════════════════════════════════

export interface RSBRelationship {
  entity: string
  relType: string
  description: string
  evidence: string
  evidenceStrength: string
  magnitude: string
  causalClassification: string
}

export interface RSBChain {
  chainName: string
  chainId: string
  projectName: string
  links: Array<{ source: string; target: string; explanation: string }>
}

export interface RSBProjectMention {
  name: string
  uniqueId: string
  role: string
  collection: string
}

export interface EntityInfoCardData {
  // Identity (always)
  name: string
  category: string
  definition: string
  aliases: string[]
  pageRank: number
  betweenness: number
  degree: number
  bridgeTier: 'gold' | 'silver' | 'bronze' | 'none'
  // Scoped (when collection provided)
  scoped: {
    projects: RSBProjectMention[]
    relationships: RSBRelationship[]
    chains: RSBChain[]
  } | null
  // Global (always — full data, not summaries)
  global: {
    collections: string[]
    projects: RSBProjectMention[]
    relationships: RSBRelationship[]
    chains: RSBChain[]
    similarEntities: Array<{ name: string; category: string; similarity: number }>
  }
}

// ── Project Info Card (RSB) ─────────────────────────────

export interface ProjectInfoCardData {
  name: string
  uniqueId: string
  domain: string
  subdomain: string
  summary: string
  tags: string[]
  directory: string
  htmlPath: string | null
  createdDate: string | null
  entityCount: number
  relationshipCount: number
  chainCount: number
  // Scoped to collection (if opened from collection context)
  scoped: {
    topEntities: Array<{ name: string; category: string; role: string }>
    sharedBridges: Array<{ name: string; category: string; projectCount: number }>
  } | null
  // Global (always)
  global: {
    collections: string[]
    relatedProjects: Array<{ name: string; uniqueId: string; sharedCount: number }>
    topEntities: Array<{ name: string; category: string; pageRank: number }>
  }
}

/** Q-RSB2: Project Info Card — scoped + global */
export async function fetchProjectInfoCard(
  projectUniqueId: string,
  collectionName?: string,
): Promise<ProjectInfoCardData | null> {
  const session = getSession()
  try {
    // Pass 1: Identity + counts
    const identityResult = await session.run(`
      MATCH (p:Project {uniqueId: $projectUniqueId})
      OPTIONAL MATCH (p)-[:IN_DIRECTORY]->(d:DirectoryCategory)
      OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
      WITH p, d, count(DISTINCT e) AS entityCount
      OPTIONAL MATCH (e2:Entity)-[:MENTIONED_IN]->(p)
      OPTIONAL MATCH (e2)-[r:RELATES_TO]-(other:Entity)-[:MENTIONED_IN]->(p)
      WITH p, d, entityCount, count(DISTINCT r) AS relationshipCount
      OPTIONAL MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p)
      WITH p, d, entityCount, relationshipCount, count(DISTINCT cc) AS chainCount
      OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Collection)
      RETURN p {
        .name, .uniqueId, .domain, .subdomain, .summary,
        .tags, .htmlPath, .createdDate
      } AS project,
        d.name AS directory,
        entityCount, relationshipCount, chainCount,
        collect(DISTINCT c.name) AS collections
    `, { projectUniqueId })

    const ir = identityResult.records[0]
    if (!ir) return null
    const p = ir.get('project') as Record<string, unknown>

    // Pass 2: Global — related projects (by shared entities)
    const relatedResult = await session.run(`
      MATCH (p:Project {uniqueId: $projectUniqueId})<-[:MENTIONED_IN]-(e:Entity)-[:MENTIONED_IN]->(other:Project)
      WHERE other.uniqueId <> $projectUniqueId
      WITH other, count(DISTINCT e) AS sharedCount
      RETURN other.name AS name, other.uniqueId AS uniqueId, sharedCount
      ORDER BY sharedCount DESC
      LIMIT 5
    `, { projectUniqueId })

    const relatedProjects = relatedResult.records.map(r => ({
      name: toStr(r.get('name')),
      uniqueId: toStr(r.get('uniqueId')),
      sharedCount: toNum(r.get('sharedCount')),
    }))

    // Pass 3: Global — top entities by PageRank
    const topEntResult = await session.run(`
      MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project {uniqueId: $projectUniqueId})
      RETURN e.name AS name, e.category AS category, e.pageRank AS pageRank
      ORDER BY e.pageRank DESC
      LIMIT 6
    `, { projectUniqueId })

    const globalTopEntities = topEntResult.records.map(r => ({
      name: toStr(r.get('name')),
      category: toStr(r.get('category')),
      pageRank: toNum(r.get('pageRank')),
    }))

    // Pass 4: Scoped data (if collection provided)
    let scoped: ProjectInfoCardData['scoped'] = null
    if (collectionName) {
      // 4a: Entities in this project with roles, filtered to collection context
      const scopedEntResult = await session.run(`
        MATCH (e:Entity)-[m:MENTIONED_IN]->(p:Project {uniqueId: $projectUniqueId})
        WHERE EXISTS {
          MATCH (e)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
        }
        RETURN e.name AS name, e.category AS category, m.role AS role
        ORDER BY e.pageRank DESC
        LIMIT 8
      `, { projectUniqueId, collectionName })

      const topEntities = scopedEntResult.records.map(r => ({
        name: toStr(r.get('name')),
        category: toStr(r.get('category')),
        role: toStr(r.get('role')),
      }))

      // 4b: Bridge entities shared across this project and collection
      const bridgeResult = await session.run(`
        MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project {uniqueId: $projectUniqueId})
        WHERE e.projectCount > 1
        AND EXISTS {
          MATCH (e)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
        }
        RETURN e.name AS name, e.category AS category, e.projectCount AS projectCount
        ORDER BY e.projectCount DESC
        LIMIT 6
      `, { projectUniqueId, collectionName })

      const sharedBridges = bridgeResult.records.map(r => ({
        name: toStr(r.get('name')),
        category: toStr(r.get('category')),
        projectCount: toNum(r.get('projectCount')),
      }))

      scoped = { topEntities, sharedBridges }
    }

    const collections = toStrArray(ir.get('collections')).filter(Boolean)

    return {
      name: toStr(p.name),
      uniqueId: toStr(p.uniqueId),
      domain: toStr(p.domain),
      subdomain: toStr(p.subdomain),
      summary: toStr(p.summary),
      tags: toStrArray(p.tags),
      directory: toStr(ir.get('directory')),
      htmlPath: toStrOrNull(p.htmlPath),
      createdDate: toStrOrNull(p.createdDate),
      entityCount: toNum(ir.get('entityCount')),
      relationshipCount: toNum(ir.get('relationshipCount')),
      chainCount: toNum(ir.get('chainCount')),
      scoped,
      global: {
        collections,
        relatedProjects,
        topEntities: globalTopEntities,
      },
    }
  } finally {
    await session.close()
  }
}

/** Q-RSB1: Entity Info Card — full research panel data */
export async function fetchEntityInfoCard(
  entityName: string,
  collectionName?: string,
): Promise<EntityInfoCardData | null> {
  const session = getSession()
  try {
    // Pass 1: Identity + collections list
    const identityResult = await session.run(`
      MATCH (e:Entity {name: $entityName})
      OPTIONAL MATCH (e)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection)
      WITH e, collect(DISTINCT c.name) AS collections
      RETURN e {
        .name, .category, .definition, .aliases,
        .pageRank, .betweenness, .degree, .projectCount
      } AS entity,
        [c IN collections WHERE c IS NOT NULL] AS collections
    `, { entityName })

    const ir = identityResult.records[0]
    if (!ir) return null
    const e = ir.get('entity') as Record<string, unknown>
    const projectCount = toNum(e.projectCount)

    // Pass 2: Similar entities (embedding fallback)
    const simResult = await session.run(`
      MATCH (e:Entity {name: $entityName})-[s:SIMILAR_TO]-(sim:Entity)
      RETURN sim.name AS name, sim.category AS category, s.similarity AS similarity
      ORDER BY s.similarity DESC LIMIT 8
    `, { entityName })

    let similarEntities = simResult.records.map(r => ({
      name: toStr(r.get('name')),
      category: toStr(r.get('category')),
      similarity: toNum(r.get('similarity')),
    }))

    if (similarEntities.length === 0) {
      const vecResult = await session.run(`
        MATCH (e:Entity {name: $entityName})
        WHERE e.embedding IS NOT NULL
        CALL db.index.vector.queryNodes('entityEmbedding', 9, e.embedding)
        YIELD node, score
        WHERE node.name <> $entityName
        RETURN node.name AS name, node.category AS category, score AS similarity
        ORDER BY score DESC LIMIT 8
      `, { entityName })
      similarEntities = vecResult.records.map(r => ({
        name: toStr(r.get('name')),
        category: toStr(r.get('category')),
        similarity: toNum(r.get('similarity')),
      }))
    }

    // Pass 3: Global — ALL projects with roles, grouped by collection
    const globalProjResult = await session.run(`
      MATCH (e:Entity {name: $entityName})-[m:MENTIONED_IN]->(p:Project)
      OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Collection)
      RETURN p.name AS name, p.uniqueId AS uniqueId, m.role AS role,
        coalesce(c.name, 'Uncategorized') AS collection
      ORDER BY c.name, p.name
    `, { entityName })

    const globalProjects: RSBProjectMention[] = globalProjResult.records.map(r => ({
      name: toStr(r.get('name')),
      uniqueId: toStr(r.get('uniqueId')),
      role: toStr(r.get('role')),
      collection: toStr(r.get('collection')),
    }))

    // Pass 4: Global — ALL relationships with full details (no limit)
    const globalRelResult = await session.run(`
      MATCH (e:Entity {name: $entityName})-[r:RELATES_TO]-(other:Entity)
      RETURN other.name AS entity, r.relType AS relType,
        r.description AS description, r.evidence AS evidence,
        r.evidenceStrength AS evidenceStrength, r.magnitude AS magnitude,
        r.causalClassification AS causalClassification
      ORDER BY CASE r.magnitude
        WHEN 'foundational' THEN 0 WHEN 'significant' THEN 1 ELSE 2
      END
    `, { entityName })

    const globalRelationships: RSBRelationship[] = globalRelResult.records.map(r => ({
      entity: toStr(r.get('entity')),
      relType: toStr(r.get('relType')),
      description: toStr(r.get('description')),
      evidence: toStr(r.get('evidence')),
      evidenceStrength: toStr(r.get('evidenceStrength')),
      magnitude: toStr(r.get('magnitude')),
      causalClassification: toStr(r.get('causalClassification')),
    }))

    // Pass 5: Global — ALL causal chains with FULL link details
    const globalChainResult = await session.run(`
      MATCH (e:Entity {name: $entityName})-[cl:CHAIN_LINK]-()
      WITH DISTINCT cl.chainId AS chainId
      MATCH (cc:CausalChain {chainId: chainId})
      OPTIONAL MATCH (cc)-[:BELONGS_TO_PROJECT]->(p:Project)
      WITH cc, chainId, p.name AS projectName
      MATCH (src:Entity)-[cl2:CHAIN_LINK]->(tgt:Entity)
      WHERE cl2.chainId = chainId
      RETURN cc.name AS chainName, chainId, projectName,
        src.name AS source, tgt.name AS target,
        cl2.explanation AS explanation, cl2.orderIndex AS orderIndex
      ORDER BY cc.name, cl2.orderIndex
    `, { entityName })

    // Group chain links by chainId
    const globalChainMap = new Map<string, RSBChain>()
    for (const r of globalChainResult.records) {
      const cid = toStr(r.get('chainId'))
      if (!globalChainMap.has(cid)) {
        globalChainMap.set(cid, {
          chainName: toStr(r.get('chainName')),
          chainId: cid,
          projectName: toStr(r.get('projectName')),
          links: [],
        })
      }
      globalChainMap.get(cid)!.links.push({
        source: toStr(r.get('source')),
        target: toStr(r.get('target')),
        explanation: toStr(r.get('explanation')),
      })
    }
    const globalChains = Array.from(globalChainMap.values())

    // Pass 6: Scoped data (if collection provided)
    let scoped: EntityInfoCardData['scoped'] = null
    if (collectionName) {
      // 6a: Projects in this collection with roles
      const scopedProjResult = await session.run(`
        MATCH (e:Entity {name: $entityName})-[m:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
        RETURN p.name AS name, p.uniqueId AS uniqueId, m.role AS role
        ORDER BY p.name
      `, { entityName, collectionName })

      const scopedProjects: RSBProjectMention[] = scopedProjResult.records.map(r => ({
        name: toStr(r.get('name')),
        uniqueId: toStr(r.get('uniqueId')),
        role: toStr(r.get('role')),
        collection: collectionName,
      }))

      // 6b: ALL relationships scoped to collection — full details
      const scopedRelResult = await session.run(`
        MATCH (e:Entity {name: $entityName})-[r:RELATES_TO]-(other:Entity)
        WHERE EXISTS {
          MATCH (other)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
        }
        RETURN other.name AS entity, r.relType AS relType,
          r.description AS description, r.evidence AS evidence,
          r.evidenceStrength AS evidenceStrength, r.magnitude AS magnitude,
          r.causalClassification AS causalClassification
        ORDER BY CASE r.magnitude
          WHEN 'foundational' THEN 0 WHEN 'significant' THEN 1 ELSE 2
        END
      `, { entityName, collectionName })

      const scopedRelationships: RSBRelationship[] = scopedRelResult.records.map(r => ({
        entity: toStr(r.get('entity')),
        relType: toStr(r.get('relType')),
        description: toStr(r.get('description')),
        evidence: toStr(r.get('evidence')),
        evidenceStrength: toStr(r.get('evidenceStrength')),
        magnitude: toStr(r.get('magnitude')),
        causalClassification: toStr(r.get('causalClassification')),
      }))

      // 6c: Causal chains scoped to collection — with FULL link details
      const scopedChainResult = await session.run(`
        MATCH (e:Entity {name: $entityName})-[cl:CHAIN_LINK]-()
        WITH DISTINCT cl.chainId AS chainId
        MATCH (cc:CausalChain {chainId: chainId})-[:BELONGS_TO_PROJECT]->(p:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
        WITH cc, chainId, p.name AS projectName
        MATCH (src:Entity)-[cl2:CHAIN_LINK]->(tgt:Entity)
        WHERE cl2.chainId = chainId
        RETURN cc.name AS chainName, chainId, projectName,
          src.name AS source, tgt.name AS target,
          cl2.explanation AS explanation, cl2.orderIndex AS orderIndex
        ORDER BY cc.name, cl2.orderIndex
      `, { entityName, collectionName })

      const scopedChainMap = new Map<string, RSBChain>()
      for (const r of scopedChainResult.records) {
        const cid = toStr(r.get('chainId'))
        if (!scopedChainMap.has(cid)) {
          scopedChainMap.set(cid, {
            chainName: toStr(r.get('chainName')),
            chainId: cid,
            projectName: toStr(r.get('projectName')),
            links: [],
          })
        }
        scopedChainMap.get(cid)!.links.push({
          source: toStr(r.get('source')),
          target: toStr(r.get('target')),
          explanation: toStr(r.get('explanation')),
        })
      }
      const scopedChains = Array.from(scopedChainMap.values())

      scoped = { projects: scopedProjects, relationships: scopedRelationships, chains: scopedChains }
    }

    return {
      name: toStr(e.name),
      category: toStr(e.category),
      definition: toStr(e.definition),
      aliases: toStrArray(e.aliases),
      pageRank: toNum(e.pageRank),
      betweenness: toNum(e.betweenness),
      degree: toNum(e.degree),
      bridgeTier: (projectCount >= 3 ? 'gold' : projectCount === 2 ? 'silver' : 'none') as EntityInfoCardData['bridgeTier'],
      scoped,
      global: {
        collections: toStrArray(ir.get('collections')).filter(Boolean),
        projects: globalProjects,
        relationships: globalRelationships,
        chains: globalChains,
        similarEntities,
      },
    }
  } finally {
    await session.close()
  }
}
