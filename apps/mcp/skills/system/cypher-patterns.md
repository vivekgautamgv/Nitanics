# Cypher Patterns

**Common Neo4j query patterns used across MemoryTonic. Reference for building MCP tool queries.**

C04 reads Neo4j via bolt driver (neo4j-driver npm). C01 writes via HTTP API (db.py). Same database.

---

## Core Patterns

### Collection-Scoped Entity Lookup

Most queries are scoped to a collection. The pattern is always:
```cypher
MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
```

### Entity with Relationships (Collection-Scoped)

```cypher
MATCH (p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
MATCH (e:Entity)-[:MENTIONED_IN]->(p)
WITH collect(DISTINCT e) AS entities
UNWIND entities AS e1
OPTIONAL MATCH (e1)-[r:RELATES_TO]->(e2)
WHERE e2 IN entities
RETURN e1 { .entityId, .name, .category, .definition, .aliases,
             .pageRank, .betweenness, .degree, .projectCount } AS entity,
       r { .relType, .causalClassification, .description,
           .evidence, .evidenceStrength, .magnitude, .year, .projectId } AS rel,
       e2.entityId AS targetId
```

This is C02's Q1 (fetchCollectionGraph) — the main graph load query.

### Entity→Project Membership

```cypher
MATCH (e:Entity)-[m:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
RETURN e.entityId AS entityId, p.uniqueId AS projectUniqueId, m.role AS role
```

C02's Q1b — links entities to their projects with per-project roles.

---

## Entity Queries

### Full Entity Detail

```cypher
MATCH (e:Entity {name: $entityName})
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
RETURN e { .name, .category, .definition, .aliases,
           .pageRank, .betweenness, .degree, .projectCount } AS entity,
       projects, relationships, chainLinks,
       collect(DISTINCT {name: sim.name, category: sim.category, similarity: s.similarity}) AS similar
```

C02's Q3 (fetchEntityDetail) — everything about one entity within a collection context.

### Fulltext Search

```cypher
CALL db.index.fulltext.queryNodes('entity_fulltext', $searchTerm)
YIELD node, score
MATCH (node)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
RETURN DISTINCT node.name AS name, node.category AS category,
  node.definition AS definition, score
ORDER BY score DESC LIMIT 20
```

C02's Q4 — searches entity name, definition, aliases_text. Note: append `*` to searchTerm for prefix matching.

### Vector Similarity Search

```cypher
CALL db.index.vector.queryNodes('entityEmbedding', 10, $queryVector)
YIELD node, score
MATCH (node)-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
RETURN node.name AS name, node.category AS category,
  node.definition AS definition, score
ORDER BY score DESC
```

For semantic search using 384d BERT embeddings.

---

## Path Queries

### Shortest Path Between Entities

```cypher
MATCH (a:Entity {name: $entityA})-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
WITH DISTINCT a
MATCH (b:Entity {name: $entityB})-[:MENTIONED_IN]->(:Project)-[:BELONGS_TO]->(:Collection {name: $collectionName})
WITH a, b LIMIT 1
MATCH path = shortestPath((a)-[:RELATES_TO|MENTIONED_IN*..8]-(b))
RETURN [n IN nodes(path) | n.name] AS entities,
  [r IN relationships(path) | type(r)] AS relTypes
```

C02's Q5 — finds shortest path up to 8 hops, traversing both RELATES_TO and MENTIONED_IN.

### N-Hop Neighborhood

```cypher
MATCH (e:Entity {name: $entityName})
MATCH path = (e)-[:RELATES_TO*1..${depth}]-(neighbor:Entity)
RETURN DISTINCT neighbor.name AS name, neighbor.category AS category,
  length(path) AS distance
ORDER BY distance, neighbor.pageRank DESC
```

For `memorytonic_explore` — explore entity neighborhoods at variable depth.

---

## Bridge & Importance Queries

### Bridge Entities (Collection-Scoped)

```cypher
MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
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
ORDER BY projectsInCollection DESC, e.pageRank DESC
```

C02's Q7 — bridge entities with tier computation.

### Top Entities by Importance

```cypher
MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
WITH e, count(DISTINCT p) AS mentions
RETURN e.name AS name, e.category AS category,
  e.pageRank AS pageRank, e.betweenness AS betweenness,
  e.degree AS degree, mentions
ORDER BY e.pageRank DESC
LIMIT $limit
```

### Gap Detection (Isolated Entities)

```cypher
MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
WHERE e.degree = 0 OR e.degree IS NULL
RETURN e.name AS name, e.category AS category, e.definition AS definition
```

Entities with no RELATES_TO edges — potential extraction gaps.

---

## Project Queries

### Project Detail

```cypher
MATCH (p:Project {uniqueId: $uniqueId})
OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Collection)
OPTIONAL MATCH (p)-[:IN_DIRECTORY]->(d:DirectoryCategory)
RETURN p { .projectId, .name, .uniqueId, .summary, .narrativeFlow,
           .domain, .subdomain, .baseTags, .htmlPath, .createdAt } AS project,
  collect(DISTINCT c.name) AS collections,
  d.name AS directory
```

### Project Entities

```cypher
MATCH (e:Entity)-[m:MENTIONED_IN]->(p:Project {uniqueId: $uniqueId})
RETURN e.name AS name, e.category AS category, e.definition AS definition,
  m.role AS role, e.pageRank AS pageRank, e.projectCount AS projectCount
ORDER BY e.pageRank DESC
```

### Project Relationships

```cypher
MATCH (e1:Entity)-[r:RELATES_TO {projectId: $projectId}]->(e2:Entity)
RETURN e1.name AS source, e2.name AS target,
  r { .relType, .causalClassification, .description, .evidence,
      .evidenceStrength, .magnitude, .year } AS rel
```

Note: Uses `projectId` property on RELATES_TO edge to filter to one project's relationships.

### Project Causal Chains

```cypher
MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p:Project {uniqueId: $projectUniqueId})
OPTIONAL MATCH (e1:Entity)-[cl:CHAIN_LINK {chainId: cc.chainId}]->(e2:Entity)
WITH cc, collect({
  fromEntity: e1.name, toEntity: e2.name,
  orderIndex: cl.orderIndex, explanation: cl.explanation
}) AS links
RETURN cc.chainId AS chainId, cc.name AS name,
  cc.description AS description, links
ORDER BY cc.name
```

C02's Q6 — chains are linked to projects via BELONGS_TO_PROJECT (NOT "IN_PROJECT").

### Project Timeline

```cypher
MATCH (te:TemporalEvent)-[:BELONGS_TO_PROJECT]->(p:Project {uniqueId: $uniqueId})
RETURN te.eventId AS eventId, te.phaseIndex AS phaseIndex,
  te.label AS label, te.period AS period
ORDER BY te.phaseIndex
```

---

## Collection Queries

### Collection List with Counts

```cypher
MATCH (c:Collection)
OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
WITH c, collect(DISTINCT p) AS projects
OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p2:Project)-[:BELONGS_TO]->(c)
RETURN c.name AS name,
  size(projects) AS projectCount,
  count(DISTINCT e) AS entityCount
ORDER BY c.name
```

C02's Q9.

### Collection Projects

```cypher
MATCH (p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
RETURN p.name AS name, p.uniqueId AS uniqueId, p.summary AS summary,
  p.domain AS domain, p.subdomain AS subdomain,
  p.baseTags AS baseTags, p.htmlPath AS htmlPath
```

C02's Q2.

---

## Directory Queries

### All Directories with Stats

```cypher
MATCH (d:DirectoryCategory)
OPTIONAL MATCH (p:Project)-[:IN_DIRECTORY]->(d)
OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Collection)
OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
RETURN d.name AS name, d.description AS description,
  count(DISTINCT p) AS projectCount,
  count(DISTINCT c) AS collectionCount,
  count(DISTINCT e) AS entityCount
ORDER BY d.name
```

C03's Q-F1.

---

## CRUD Patterns

### Create Collection

```cypher
MERGE (c:Collection {name: $name})
ON CREATE SET c.collectionId = $collectionId, c.createdAt = datetime()
SET c.description = $description
```

### Add Project to Collection

```cypher
MATCH (p:Project {uniqueId: $uniqueId})
MATCH (c:Collection {name: $collectionName})
MERGE (p)-[:BELONGS_TO]->(c)
```

### Delete Project (Cascade)

See `delete_project.py` — 13-step cascade. Do NOT attempt manual deletion via raw Cypher. Use the script.

---

## Traps

1. **BELONGS_TO_PROJECT, not IN_PROJECT** — CausalChain and TemporalEvent use BELONGS_TO_PROJECT
2. **Neo4j integers need .toNumber()** — Always convert with helper function
3. **Session MUST close in finally block** — Leaked sessions cause connection pool exhaustion
4. **entity_fulltext index** covers name, definition, aliases_text — NOT tags (yet)
5. **Vector index** is 'entityEmbedding' for entities, 'projectEmbedding' for projects
6. **RELATES_TO direction matters for display** but GDS projection is UNDIRECTED
7. **NEVER return entity.embedding** in display queries — 384 floats per entity kills performance
8. **Collection scoping** — almost all queries filter through Collection. Un-scoped queries return ALL data.
