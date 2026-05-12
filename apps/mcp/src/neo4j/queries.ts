import { runRead, runWrite } from './driver.js';
import { BRIDGE_TIERS } from '../constants/index.js';
import type { BridgeTier } from '../types/index.js';

// --- Utility ---

export function computeBridgeTier(projectCount: number, betweenness: number): BridgeTier {
  if (projectCount >= BRIDGE_TIERS.GOLD.minProjects) return 'Gold';
  if (projectCount >= BRIDGE_TIERS.SILVER.minProjects) return 'Silver';
  if (projectCount >= BRIDGE_TIERS.BRONZE.minProjects && betweenness > BRIDGE_TIERS.BRONZE.minBetweenness) return 'Bronze';
  return null;
}

// --- Search ---

export async function fulltextSearch(query: string, limit: number = 20) {
  return runRead(
    `CALL db.index.fulltext.queryNodes("entity_fulltext", $query) YIELD node, score
     RETURN node.name AS name, node.category AS category, node.definition AS definition,
            node.projectCount AS projectCount, node.pageRank AS pageRank, score
     ORDER BY score DESC LIMIT $limit`,
    { query, limit }
  );
}

export async function semanticSearch(vector: number[], k: number = 10) {
  return runRead(
    `CALL db.index.vector.queryNodes("entityEmbedding", $k, $vector) YIELD node, score
     RETURN node.name AS name, node.category AS category, node.definition AS definition,
            node.projectCount AS projectCount, score
     ORDER BY score DESC`,
    { k, vector }
  );
}

// --- Entity ---

export async function getEntity(name: string) {
  const entity = await runRead(
    `MATCH (e:Entity {name: $name})
     OPTIONAL MATCH (e)-[m:MENTIONED_IN]->(p:Project)
     WITH e, collect({ project: p.name, uniqueId: p.uniqueId, role: m.role }) AS projects
     OPTIONAL MATCH (e)-[r:RELATES_TO]-(other:Entity)
     WITH e, projects, collect(DISTINCT {
       entity: other.name, relType: r.relType, causalClassification: r.causalClassification,
       description: r.description, direction: CASE WHEN startNode(r) = e THEN 'outgoing' ELSE 'incoming' END
     }) AS relationships
     OPTIONAL MATCH (e)-[cl:CHAIN_LINK]-(linked:Entity)
     WITH e, projects, relationships, collect(DISTINCT {
       chainId: cl.chainId, orderIndex: cl.orderIndex, entity: linked.name, explanation: cl.explanation
     }) AS chainLinks
     OPTIONAL MATCH (e)-[s:SIMILAR_TO]-(sim:Entity)
     WITH e, projects, relationships, chainLinks,
          collect(DISTINCT { name: sim.name, category: sim.category, similarity: s.similarity }) AS similar
     RETURN e { .*, projectCount: e.projectCount, pageRank: e.pageRank, betweenness: e.betweenness, degree: e.degree } AS entity,
            projects, relationships, chainLinks, similar`,
    { name }
  );
  return entity[0] ?? null;
}

// --- Project ---

export async function getProject(uniqueId: string) {
  const project = await runRead(
    `MATCH (p:Project {uniqueId: $uniqueId})
     OPTIONAL MATCH (e:Entity)-[m:MENTIONED_IN]->(p)
     WITH p, collect({ name: e.name, category: e.category, definition: e.definition, role: m.role }) AS entities
     OPTIONAL MATCH (e1:Entity)-[r:RELATES_TO]->(e2:Entity)
     WHERE (e1)-[:MENTIONED_IN]->(p) AND (e2)-[:MENTIONED_IN]->(p)
     WITH p, entities, collect({
       source: e1.name, target: e2.name, relType: r.relType,
       causalClassification: r.causalClassification, description: r.description
     }) AS relationships
     OPTIONAL MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p)
     WITH p, entities, relationships, collect({ chainId: cc.chainId, name: cc.name, description: cc.description }) AS chains
     OPTIONAL MATCH (te:TemporalEvent)-[:BELONGS_TO_PROJECT]->(p)
     WITH p, entities, relationships, chains,
          collect({ phaseIndex: te.phaseIndex, label: te.label, period: te.period }) AS temporalPhases
     OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Collection)
     WITH p, entities, relationships, chains, temporalPhases, collect(c.name) AS collections
     RETURN p { .* } AS project, entities, relationships, chains, temporalPhases, collections`,
    { uniqueId }
  );
  return project[0] ?? null;
}

// --- Lists ---

export async function listProjects(opts: { directory?: string; collection?: string; limit?: number }) {
  const { directory, collection, limit = 50 } = opts;
  let cypher = 'MATCH (p:Project)';
  const params: Record<string, unknown> = { limit };

  if (directory) {
    cypher += '-[:IN_DIRECTORY]->(:DirectoryCategory {name: $directory})';
    params.directory = directory;
  }
  if (collection) {
    cypher += (directory ? ' WITH p' : '') + ' MATCH (p)-[:BELONGS_TO]->(:Collection {name: $collection})';
    params.collection = collection;
  }

  cypher += ` RETURN p.name AS name, p.uniqueId AS uniqueId, p.domain AS domain,
              p.subdomain AS subdomain, p.directory AS directory, p.createdAt AS createdAt
              ORDER BY p.createdAt DESC LIMIT $limit`;

  return runRead(cypher, params);
}

export async function listCollections() {
  return runRead(
    `MATCH (c:Collection)
     OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
     RETURN c.name AS name, c.collectionId AS collectionId, c.createdAt AS createdAt,
            count(p) AS projectCount
     ORDER BY c.name`
  );
}

export async function listDirectories() {
  return runRead(
    `MATCH (d:DirectoryCategory)
     OPTIONAL MATCH (p:Project)-[:IN_DIRECTORY]->(d)
     RETURN d.name AS name, d.description AS description, count(p) AS projectCount
     ORDER BY d.name`
  );
}

// --- GraphRAG Recall ---

export async function graphRAGRecall(question: string, depth: number = 2, limit: number = 10) {
  // Step 1: Fulltext to find seed entities
  const seeds = await fulltextSearch(question, 5);
  if (seeds.length === 0) return { entities: [], connections: [], causalChains: [], projects: [], context: 'No matching entities found.' };

  const seedNames = seeds.map(s => s.name as string);

  // Step 2: Expand N hops from seeds
  const expanded = await runRead(
    `UNWIND $seedNames AS seedName
     MATCH (start:Entity {name: seedName})
     CALL (start) {
       MATCH path = (start)-[:RELATES_TO*1..${depth}]-(neighbor:Entity)
       RETURN DISTINCT neighbor
       LIMIT $limit
     }
     WITH collect(DISTINCT neighbor) + collect(DISTINCT start) AS allEntities
     UNWIND allEntities AS e
     RETURN DISTINCT e.name AS name, e.category AS category, e.definition AS definition,
            e.projectCount AS projectCount, e.pageRank AS pageRank`,
    { seedNames, limit }
  );

  // Step 3: Get connections between expanded entities
  const entityNames = expanded.map(e => e.name as string);
  const connections = await runRead(
    `MATCH (e1:Entity)-[r:RELATES_TO]->(e2:Entity)
     WHERE e1.name IN $names AND e2.name IN $names
     RETURN e1.name AS source, e2.name AS target, r.relType AS relType,
            r.causalClassification AS causalClassification, r.description AS description
     LIMIT 50`,
    { names: entityNames }
  );

  // Step 4: Get causal chains involving these entities
  const chains = await runRead(
    `MATCH (e:Entity)-[cl:CHAIN_LINK]->(e2:Entity)
     WHERE e.name IN $names
     MATCH (cc:CausalChain {chainId: cl.chainId})
     RETURN DISTINCT cc.chainId AS chainId, cc.name AS name, cc.description AS description
     LIMIT 10`,
    { names: entityNames }
  );

  // Step 5: Get projects mentioning seed entities
  const projects = await runRead(
    `MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)
     WHERE e.name IN $seedNames
     RETURN DISTINCT p.name AS name, p.uniqueId AS uniqueId, p.summary AS summary
     LIMIT 5`,
    { seedNames }
  );

  return { entities: expanded, connections, causalChains: chains, projects, context: `Found ${expanded.length} entities across ${depth} hops from ${seedNames.join(', ')}` };
}

// --- Explore ---

export async function exploreNeighborhood(entityName: string, hops: number = 2, limit: number = 30) {
  const result = await runRead(
    `MATCH (start:Entity {name: $entityName})
     CALL (start) {
       MATCH path = (start)-[:RELATES_TO*1..${Math.min(hops, 3)}]-(neighbor:Entity)
       RETURN neighbor, relationships(path) AS rels
       LIMIT $limit
     }
     WITH start, neighbor, rels
     UNWIND rels AS r
     WITH start, neighbor,
          collect(DISTINCT {
            source: startNode(r).name, target: endNode(r).name,
            relType: r.relType, causalClassification: r.causalClassification
          }) AS edges
     RETURN start { .name, .category, .definition } AS startEntity,
            neighbor { .name, .category, .definition, .projectCount } AS neighbor,
            edges`,
    { entityName, limit }
  );
  return result;
}

// --- Paths ---

export async function findPaths(from: string, to: string, maxHops: number = 6) {
  return runRead(
    `MATCH (start:Entity {name: $from}), (end:Entity {name: $to})
     MATCH path = shortestPath((start)-[:RELATES_TO*1..${Math.min(maxHops, 6)}]-(end))
     WITH path, [n IN nodes(path) | n.name] AS nodeNames,
          [r IN relationships(path) | { relType: r.relType, causalClassification: r.causalClassification, description: r.description }] AS edgeDetails
     RETURN nodeNames, edgeDetails, length(path) AS pathLength
     LIMIT 5`,
    { from, to }
  );
}

// --- Explain Connection ---

export async function explainConnection(entity1: string, entity2: string) {
  // Direct edges
  const direct = await runRead(
    `MATCH (e1:Entity {name: $e1})-[r:RELATES_TO]-(e2:Entity {name: $e2})
     RETURN e1.name AS source, e2.name AS target, r.relType AS relType,
            r.causalClassification AS causalClassification, r.description AS description,
            r.evidence AS evidence, CASE WHEN startNode(r) = e1 THEN 'outgoing' ELSE 'incoming' END AS direction`,
    { e1: entity1, e2: entity2 }
  );

  // Shared projects
  const sharedProjects = await runRead(
    `MATCH (e1:Entity {name: $e1})-[:MENTIONED_IN]->(p:Project)<-[:MENTIONED_IN]-(e2:Entity {name: $e2})
     RETURN p.name AS name, p.uniqueId AS uniqueId`,
    { e1: entity1, e2: entity2 }
  );

  // Indirect paths (up to 3 hops)
  const paths = direct.length === 0
    ? await findPaths(entity1, entity2, 3)
    : [];

  return {
    directEdges: direct,
    sharedProjects,
    indirectPaths: paths,
    connected: direct.length > 0 || sharedProjects.length > 0 || paths.length > 0,
  };
}

// --- Collections ---

export async function createCollection(name: string, description?: string) {
  const id = `col-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return runWrite(
    `MERGE (c:Collection {name: $name})
     ON CREATE SET c.collectionId = $id, c.createdAt = datetime(), c.description = $description
     RETURN c { .* } AS collection`,
    { name, id, description: description ?? '' }
  );
}

export async function deleteCollection(name: string) {
  // Check for projects first
  const projects = await runRead<{ count: number }>(
    `MATCH (p:Project)-[:BELONGS_TO]->(c:Collection {name: $name}) RETURN count(p) AS count`,
    { name }
  );
  const projectCount = projects[0]?.count ?? 0;

  // Delete collection and BELONGS_TO edges (projects stay)
  await runWrite(
    `MATCH (c:Collection {name: $name})
     OPTIONAL MATCH (p:Project)-[b:BELONGS_TO]->(c)
     DELETE b, c`,
    { name }
  );

  return { deleted: true, projectsOrphaned: projectCount };
}

export async function addToCollection(projectUniqueId: string, collectionName: string) {
  return runWrite(
    `MATCH (p:Project {uniqueId: $uid}), (c:Collection {name: $name})
     MERGE (p)-[:BELONGS_TO]->(c)
     RETURN p.name AS project, c.name AS collection`,
    { uid: projectUniqueId, name: collectionName }
  );
}

export async function removeFromCollection(projectUniqueId: string, collectionName: string) {
  // Check if this is the last collection
  const colCount = await runRead<{ count: number }>(
    `MATCH (p:Project {uniqueId: $uid})-[:BELONGS_TO]->(c:Collection)
     RETURN count(c) AS count`,
    { uid: projectUniqueId }
  );
  const isLastCollection = (colCount[0]?.count ?? 0) <= 1;

  await runWrite(
    `MATCH (p:Project {uniqueId: $uid})-[b:BELONGS_TO]->(c:Collection {name: $name})
     DELETE b`,
    { uid: projectUniqueId, name: collectionName }
  );

  return { removed: true, orphaned: isLastCollection };
}

export async function getCollection(name: string) {
  const result = await runRead(
    `MATCH (c:Collection {name: $name})
     OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
     WITH c, collect(p { .name, .uniqueId, .domain, .subdomain }) AS projects
     RETURN c { .* } AS collection, projects, size(projects) AS projectCount`,
    { name }
  );
  return result[0] ?? null;
}

export async function collectionBridges(name: string) {
  return runRead(
    `MATCH (p:Project)-[:BELONGS_TO]->(:Collection {name: $name})
     MATCH (e:Entity)-[:MENTIONED_IN]->(p)
     WITH e, count(DISTINCT p) AS projectsInCollection
     WHERE projectsInCollection >= 2
     RETURN e.name AS name, e.category AS category, e.definition AS definition,
            e.projectCount AS projectCount, e.betweenness AS betweenness,
            e.pageRank AS pageRank, projectsInCollection
     ORDER BY projectsInCollection DESC, e.pageRank DESC
     LIMIT 50`,
    { name }
  );
}

export async function collectionSuggestions(entityNames: string[], tags?: string[]) {
  return runRead(
    `MATCH (c:Collection)<-[:BELONGS_TO]-(p:Project)<-[:MENTIONED_IN]-(e:Entity)
     WHERE e.name IN $entityNames
     WITH c, count(DISTINCT e) AS sharedEntities, collect(DISTINCT p.name) AS projects
     RETURN c.name AS collection, sharedEntities, projects
     ORDER BY sharedEntities DESC
     LIMIT 5`,
    { entityNames }
  );
}

// --- Directories ---

export async function createDirectory(name: string, description: string) {
  return runWrite(
    `MERGE (d:DirectoryCategory {name: $name})
     ON CREATE SET d.description = $description
     RETURN d { .* } AS directory`,
    { name, description }
  );
}

// --- Similar Entities ---

export async function findSimilar(entityName: string, limit: number = 10) {
  return runRead(
    `MATCH (e:Entity {name: $entityName})-[s:SIMILAR_TO]-(other:Entity)
     RETURN other.name AS name, other.category AS category, other.definition AS definition,
            other.projectCount AS projectCount, s.similarity AS similarity
     ORDER BY s.similarity DESC LIMIT $limit`,
    { entityName, limit }
  );
}

// --- Overlap Detection ---

export async function detectOverlaps(collection?: string) {
  // Find entities with very high similarity that might be duplicates
  let cypher = '';
  const params: Record<string, unknown> = {};

  if (collection) {
    cypher = `MATCH (e1:Entity)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collection})
              MATCH (e2:Entity)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collection})
              MATCH (e1)-[s:SIMILAR_TO]-(e2)
              WHERE id(e1) < id(e2) AND s.similarity > 0.85`;
    params.collection = collection;
  } else {
    cypher = `MATCH (e1:Entity)-[s:SIMILAR_TO]-(e2:Entity)
              WHERE id(e1) < id(e2) AND s.similarity > 0.85`;
  }

  cypher += ` RETURN e1.name AS entity1, e1.category AS category1, e1.aliases AS aliases1,
              e2.name AS entity2, e2.category AS category2, e2.aliases AS aliases2,
              s.similarity AS similarity
              ORDER BY s.similarity DESC LIMIT 30`;

  return runRead(cypher, params);
}

// --- Communities ---

export async function getCommunities(collection?: string) {
  const params: Record<string, unknown> = {};
  let cypher = '';

  if (collection) {
    cypher = `MATCH (e:Entity)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collection})
              WHERE e.community IS NOT NULL
              WITH e.community AS communityId, collect(e { .name, .category, .pageRank }) AS members
              RETURN communityId, size(members) AS memberCount, members
              ORDER BY size(members) DESC`;
    params.collection = collection;
  } else {
    cypher = `MATCH (e:Entity)
              WHERE e.community IS NOT NULL
              WITH e.community AS communityId, collect(e { .name, .category, .pageRank }) AS members
              RETURN communityId, size(members) AS memberCount, members
              ORDER BY size(members) DESC`;
  }

  return runRead(cypher, params);
}

export async function getCommunityDetail(communityId: number) {
  const members = await runRead(
    `MATCH (e:Entity {community: $communityId})
     RETURN e.name AS name, e.category AS category, e.definition AS definition,
            e.pageRank AS pageRank, e.projectCount AS projectCount
     ORDER BY e.pageRank DESC`,
    { communityId }
  );

  const internalEdges = await runRead(
    `MATCH (e1:Entity {community: $communityId})-[r:RELATES_TO]->(e2:Entity {community: $communityId})
     RETURN e1.name AS source, e2.name AS target, r.relType AS relType,
            r.causalClassification AS causalClassification
     LIMIT 50`,
    { communityId }
  );

  return { communityId, members, internalEdges, memberCount: members.length };
}

// --- Analysis ---

export async function importanceRanking(opts: { collection?: string; metric?: string; limit?: number }) {
  const { collection, metric = 'pageRank', limit = 20 } = opts;
  const validMetrics = ['pageRank', 'betweenness', 'degree', 'projectCount'];
  const safeMetric = validMetrics.includes(metric) ? metric : 'pageRank';

  let cypher = '';
  const params: Record<string, unknown> = { limit };

  if (collection) {
    cypher = `MATCH (e:Entity)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collection})
              WITH DISTINCT e`;
    params.collection = collection;
  } else {
    cypher = 'MATCH (e:Entity) WITH e';
  }

  cypher += ` RETURN e.name AS name, e.category AS category, e.definition AS definition,
              e.${safeMetric} AS score, e.projectCount AS projectCount,
              e.pageRank AS pageRank, e.betweenness AS betweenness
              ORDER BY e.${safeMetric} DESC LIMIT $limit`;

  return runRead(cypher, params);
}

export async function findGaps(collection?: string) {
  const params: Record<string, unknown> = {};
  let scopeClause = '';

  if (collection) {
    scopeClause = '-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collection})';
    params.collection = collection;
  }

  // Isolated entities (no RELATES_TO edges)
  const isolated = await runRead(
    `MATCH (e:Entity)${scopeClause}
     WHERE NOT (e)-[:RELATES_TO]-()
     RETURN e.name AS name, e.category AS category, e.definition AS definition
     LIMIT 20`,
    params
  );

  // Underconnected entities (<3 relationships)
  const underconnected = await runRead(
    `MATCH (e:Entity)${scopeClause}
     WITH e, size((e)-[:RELATES_TO]-()) AS relCount
     WHERE relCount > 0 AND relCount < 3
     RETURN e.name AS name, e.category AS category, relCount
     ORDER BY relCount ASC LIMIT 20`,
    params
  );

  return { isolated, underconnected, totalGaps: isolated.length + underconnected.length };
}

export async function temporalTimeline(projectUniqueId: string) {
  const phases = await runRead(
    `MATCH (te:TemporalEvent)-[:BELONGS_TO_PROJECT]->(p:Project {uniqueId: $uid})
     OPTIONAL MATCH (e:Entity)-[:FIRST_APPEARS_IN]->(te)
     WITH te, collect(e.name) AS entities
     RETURN te.phaseIndex AS phaseIndex, te.label AS label, te.period AS period, entities
     ORDER BY te.phaseIndex`,
    { uid: projectUniqueId }
  );
  return phases;
}
