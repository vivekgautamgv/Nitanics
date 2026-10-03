# Neo4j Operations Guide

**Purpose:** Complete reference for operating the MemoryTonic knowledge graph. Covers all CRUD operations, search patterns, exploration queries, gap analysis, bridge detection, and graph navigation.

**Audience:** Claude agents (extraction, MCP tools), human developers.

---

## Connection

All operations use the HTTP API via `neo4j/db.py`:

```python
from db import run_cypher, run_batch, check_connection

check_connection()  # Verifies Neo4j is reachable, exits(1) if not

result = run_cypher("MATCH (n) RETURN count(n)", {"param": "value"})
# Returns: {"ok": bool, "data": [results], "errors": []}

result = run_batch([
    ("MATCH (n:Entity) RETURN count(n)", None),
    ("MATCH (n:Project) RETURN count(n)", None),
])
# Returns: {"ok": bool, "data": [result_per_statement], "errors": []}
```

---

## 1. Navigation (Browse the Graph)

### By Directory

```cypher
-- List directories with project counts
MATCH (d:DirectoryCategory)
OPTIONAL MATCH (p:Project)-[:IN_DIRECTORY]->(d)
RETURN d.name, d.description, count(p) AS projectCount

-- Projects in a directory
MATCH (p:Project)-[:IN_DIRECTORY]->(d:DirectoryCategory {name: $dirName})
RETURN p.name, p.uniqueId, p.domain, p.subdomain
ORDER BY p.name
```

### By Collection

```cypher
-- List collections with project counts
MATCH (c:Collection)
OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
RETURN c.name, c.collectionId, count(p) AS projectCount

-- Projects in a collection
MATCH (p:Project)-[:BELONGS_TO]->(c:Collection {name: $collName})
RETURN p.name, p.uniqueId, p.domain, p.subdomain, p.baseTags
ORDER BY p.name
```

### By Tags (3-Level Hierarchy)

```cypher
-- All domains
MATCH (p:Project) RETURN DISTINCT p.domain ORDER BY p.domain

-- Subdomains in a domain
MATCH (p:Project {domain: $domain})
RETURN DISTINCT p.subdomain ORDER BY p.subdomain

-- Projects sharing a base tag
MATCH (p:Project) WHERE $tag IN p.baseTags
RETURN p.name, p.uniqueId, p.domain
```

### By Date

```cypher
-- Projects by creation date
MATCH (p:Project)-[:CREATED_ON]->(d:DateTime {type: 'date'})
RETURN p.name, p.uniqueId, d.date
ORDER BY d.date DESC

-- Projects created on a specific date
MATCH (p:Project)-[:CREATED_ON]->(d:DateTime {date: $date})
RETURN p.name, p.uniqueId
```

---

## 2. Project Operations

### Read Project

```cypher
-- Full project details
MATCH (p:Project {uniqueId: $uid})
RETURN p.name, p.uniqueId, p.summary, p.narrativeFlow,
       p.domain, p.subdomain, p.baseTags, p.htmlPath, p.directory

-- Project with entity count
MATCH (p:Project {uniqueId: $uid})
OPTIONAL MATCH (e:Entity)-[:MENTIONED_IN]->(p)
RETURN p.name, p.summary, count(e) AS entityCount
```

### Project Entities

```cypher
-- All entities in a project (sorted by importance)
MATCH (e:Entity)-[m:MENTIONED_IN]->(p:Project {uniqueId: $uid})
RETURN e.name, e.category, e.definition, m.role,
       e.projectCount, e.pageRank, e.betweenness
ORDER BY e.pageRank DESC
```

### Project Relationships

```cypher
-- All relationships within a project
MATCH (a:Entity)-[r:RELATES_TO]->(b:Entity),
      (a)-[:MENTIONED_IN]->(p:Project {uniqueId: $uid}),
      (b)-[:MENTIONED_IN]->(p)
RETURN a.name, r.relType, r.causalClassification, b.name,
       r.description, r.evidenceStrength, r.magnitude, r.year
```

### Project Causal Chains

```cypher
-- Causal chains with ordered links
MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p:Project {uniqueId: $uid})
WITH cc ORDER BY cc.name
MATCH (a:Entity)-[r:CHAIN_LINK {chainId: cc.chainId}]->(b:Entity)
RETURN cc.name, cc.description, a.name, b.name, r.explanation, r.orderIndex
ORDER BY cc.name, r.orderIndex
```

### Project Timeline

```cypher
-- Temporal flow with entity first appearances
MATCH (te:TemporalEvent)-[:BELONGS_TO_PROJECT]->(p:Project {uniqueId: $uid})
OPTIONAL MATCH (e:Entity)-[:FIRST_APPEARS_IN]->(te)
RETURN te.phaseIndex, te.label, te.period, collect(e.name) AS entities
ORDER BY te.phaseIndex
```

### Delete Project

```bash
python neo4j/delete_project.py <unique-id>              # Full cascade delete
python neo4j/delete_project.py <unique-id> --dry-run    # Preview only
python neo4j/delete_project.py <unique-id> --keep-files # Neo4j only
```

**Always run `python neo4j/gds.py` after deletion to recompute metrics.**

---

## 3. Entity Operations

### Read Entity

```cypher
-- Entity details
MATCH (e:Entity {name: $name})
RETURN e.name, e.aliases, e.category, e.definition,
       e.projectCount, e.pageRank, e.betweenness, e.degree

-- Entity roles across all projects
MATCH (e:Entity {name: $name})-[m:MENTIONED_IN]->(p:Project)
RETURN p.name, p.uniqueId, m.role
```

### Entity Relationships

```cypher
-- Outgoing relationships
MATCH (e:Entity {name: $name})-[r:RELATES_TO]->(t:Entity)
RETURN t.name, r.relType, r.causalClassification, r.description, r.evidenceStrength

-- Incoming relationships
MATCH (s:Entity)-[r:RELATES_TO]->(e:Entity {name: $name})
RETURN s.name, r.relType, r.causalClassification, r.description

-- All relationships (both directions)
MATCH (e:Entity {name: $name})-[r:RELATES_TO]-(other:Entity)
RETURN other.name, r.relType, r.description,
       startNode(r).name AS source, endNode(r).name AS target
```

### Entity Neighborhood (N-Hop)

```cypher
-- 1-hop neighbors
MATCH (e:Entity {name: $name})-[:RELATES_TO]-(n:Entity)
RETURN n.name, n.category, n.pageRank
ORDER BY n.pageRank DESC

-- 2-hop neighborhood (entities reachable in 2 steps)
MATCH path = (e:Entity {name: $name})-[:RELATES_TO*1..2]-(other:Entity)
RETURN DISTINCT other.name, other.category, length(path) AS hops
ORDER BY hops, other.name

-- 3-hop with path details
MATCH path = (e:Entity {name: $name})-[:RELATES_TO*1..3]-(other:Entity)
WHERE other <> e
RETURN DISTINCT other.name, other.category,
       length(path) AS hops, other.pageRank
ORDER BY hops, other.pageRank DESC
LIMIT 50
```

### Entity Similar Entities (GDS)

```cypher
-- Structurally similar entities (from Node Similarity)
MATCH (e:Entity {name: $name})-[r:SIMILAR_TO]-(other:Entity)
RETURN other.name, other.category, round(r.similarity, 3) AS similarity
ORDER BY r.similarity DESC
```

---

## 4. Collection Operations

### Create Collection

```cypher
CREATE (c:Collection {
  collectionId: $id,
  name: $name,
  createdAt: datetime()
})
RETURN c.collectionId, c.name
```

### Add Project to Collection

```cypher
MATCH (p:Project {uniqueId: $uid}), (c:Collection {name: $collName})
MERGE (p)-[:BELONGS_TO]->(c)
```

### Remove Project from Collection

```cypher
MATCH (p:Project {uniqueId: $uid})-[r:BELONGS_TO]->(c:Collection {name: $collName})
DELETE r
```

### Collection Graph (Full Visualization Data)

```cypher
-- All entities and relationships for a collection
MATCH (p:Project)-[:BELONGS_TO]->(c:Collection {name: $collName})
WITH collect(p) AS projects
UNWIND projects AS p
MATCH (e:Entity)-[m:MENTIONED_IN]->(p)
WITH collect(DISTINCT e) AS entities, projects
UNWIND entities AS e
OPTIONAL MATCH (e)-[r:RELATES_TO]->(other:Entity)
WHERE other IN entities
RETURN e.name, e.category, e.pageRank, e.betweenness, e.projectCount,
       other.name AS target, r.relType, r.causalClassification
```

---

## 5. Search Operations

### Fulltext Search (Name + Definition + Aliases)

```cypher
CALL db.index.fulltext.queryNodes("entity_fulltext", $query)
YIELD node, score
RETURN node.name, node.category, node.definition, score
ORDER BY score DESC LIMIT 20
```

### Vector Similarity Search (Semantic)

```cypher
-- Find entities semantically similar to a query embedding
MATCH (e:Entity)
WHERE e.embedding IS NOT NULL
WITH e, vector.similarity.cosine(e.embedding, $queryVector) AS score
WHERE score > 0.7
RETURN e.name, e.category, e.definition, score
ORDER BY score DESC LIMIT 10
```

### Similar Projects (by Embedding)

```cypher
MATCH (p:Project)
WHERE p.embedding IS NOT NULL
WITH p, vector.similarity.cosine(p.embedding, $queryVector) AS score
WHERE score > 0.5
RETURN p.name, p.uniqueId, p.domain, score
ORDER BY score DESC LIMIT 10
```

### Hybrid Search (Text + Vector + Graph Expansion)

```cypher
-- Step 1: Fulltext matches
CALL db.index.fulltext.queryNodes("entity_fulltext", $query)
YIELD node, score
WITH node AS e, score WHERE score > 0.5

-- Step 2: 1-hop expansion
OPTIONAL MATCH (e)-[:RELATES_TO]-(neighbor:Entity)

-- Step 3: Deduplicate and rank
WITH collect(DISTINCT e) + collect(DISTINCT neighbor) AS allNodes
UNWIND allNodes AS n
RETURN DISTINCT n.name, n.category, n.definition, n.pageRank
ORDER BY n.pageRank DESC
```

---

## 6. Bridge Entity Detection

Bridge entities appear in 2+ projects — they ARE the cross-document connections that make the graph valuable.

### All Bridges (Tiered)

```cypher
MATCH (e:Entity) WHERE e.projectCount > 1
RETURN e.name, e.projectCount, e.category,
       e.pageRank, e.betweenness,
       CASE
         WHEN e.projectCount >= 3 THEN 'gold'
         WHEN e.projectCount >= 2 THEN 'silver'
         ELSE 'bronze'
       END AS tier
ORDER BY e.projectCount DESC, e.pageRank DESC
```

### Bridge Projects (Which Projects Does a Bridge Connect?)

```cypher
MATCH (e:Entity {name: $name})-[:MENTIONED_IN]->(p:Project)
RETURN p.name, p.uniqueId, p.domain
ORDER BY p.name
```

### Collection Bridges (Bridges Within a Collection)

```cypher
MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collName})
WITH e, collect(DISTINCT p.name) AS projects
WHERE size(projects) > 1
RETURN e.name, e.projectCount, projects, e.pageRank, e.betweenness
ORDER BY e.projectCount DESC
```

### Bridge Analysis (How Two Projects Connect)

```cypher
-- Shared entities between two projects
MATCH (e:Entity)-[:MENTIONED_IN]->(p1:Project {uniqueId: $uid1}),
      (e)-[:MENTIONED_IN]->(p2:Project {uniqueId: $uid2})
RETURN e.name, e.category, e.definition, e.projectCount
ORDER BY e.projectCount DESC
```

---

## 7. Path Finding

### Shortest Path Between Entities

```cypher
MATCH path = shortestPath(
  (a:Entity {name: $entityA})-[:RELATES_TO*..6]-(b:Entity {name: $entityB})
)
RETURN [n IN nodes(path) | n.name] AS entities,
       [r IN relationships(path) | r.relType] AS relationships,
       length(path) AS hops
```

### All Paths (Up to N Hops)

```cypher
MATCH path = (a:Entity {name: $entityA})-[:RELATES_TO*1..4]-(b:Entity {name: $entityB})
RETURN [n IN nodes(path) | n.name] AS entities,
       [r IN relationships(path) | r.relType] AS relTypes,
       length(path) AS hops
ORDER BY hops LIMIT 10
```

### Cross-Project Paths (Through Bridges)

```cypher
-- Find how two entities in DIFFERENT projects connect
MATCH path = shortestPath(
  (a:Entity {name: $entityA})-[:RELATES_TO*..8]-(b:Entity {name: $entityB})
)
WITH path, [n IN nodes(path) | n.name] AS names, length(path) AS hops
UNWIND nodes(path) AS node
OPTIONAL MATCH (node)-[:MENTIONED_IN]->(p:Project)
RETURN names, hops, collect(DISTINCT p.name) AS projectsCrossed
```

---

## 8. Gap Detection

Gaps are where the graph reveals what's MISSING — the research tool's killer feature.

### Isolated Entities (Low Connectivity)

```cypher
-- Entities with 0-1 connections (potential gaps)
MATCH (e:Entity)
WHERE e.degree IS NOT NULL AND e.degree <= 1
RETURN e.name, e.category, e.projectCount, e.degree
ORDER BY e.degree, e.name
```

### Category Gaps (What's Under-Represented?)

```cypher
-- Entity categories with counts
MATCH (e:Entity)
RETURN e.category, count(e) AS count
ORDER BY count DESC

-- Categories with few entities (potential knowledge gaps)
MATCH (e:Entity)
WITH e.category AS cat, count(e) AS cnt
WHERE cnt < 5
RETURN cat, cnt
ORDER BY cnt
```

### Relationship Gaps (Entities That Should Be Connected But Aren't)

```cypher
-- Entities in the same project with no RELATES_TO between them
-- (potential missed relationships)
MATCH (a:Entity)-[:MENTIONED_IN]->(p:Project {uniqueId: $uid}),
      (b:Entity)-[:MENTIONED_IN]->(p)
WHERE a <> b
  AND NOT (a)-[:RELATES_TO]-(b)
  AND a.pageRank > 1.0 AND b.pageRank > 1.0
RETURN a.name, b.name, a.category, b.category
ORDER BY a.pageRank + b.pageRank DESC
LIMIT 20
```

### Relationship Type Distribution (What Kinds of Connections Dominate?)

```cypher
MATCH ()-[r:RELATES_TO]->()
RETURN r.causalClassification, count(r) AS count
ORDER BY count DESC
```

### Evidence Strength Distribution (How Confident Is the Graph?)

```cypher
MATCH ()-[r:RELATES_TO]->()
RETURN r.evidenceStrength, count(r) AS count
ORDER BY count DESC
```

### Dead-End Entities (Only Incoming OR Only Outgoing)

```cypher
-- Entities with only incoming RELATES_TO (sinks)
MATCH (e:Entity)
WHERE EXISTS { MATCH ()-[:RELATES_TO]->(e) }
  AND NOT EXISTS { MATCH (e)-[:RELATES_TO]->() }
RETURN e.name, e.category, 'sink' AS type

UNION

-- Entities with only outgoing RELATES_TO (sources)
MATCH (e:Entity)
WHERE EXISTS { MATCH (e)-[:RELATES_TO]->() }
  AND NOT EXISTS { MATCH ()-[:RELATES_TO]->(e) }
RETURN e.name, e.category, 'source' AS type
```

---

## 9. Importance & Ranking

### Composite Importance Score

```cypher
MATCH (e:Entity)
WHERE e.pageRank IS NOT NULL
RETURN e.name, e.category, e.projectCount,
       round(e.pageRank, 4) AS pageRank,
       round(e.betweenness, 2) AS betweenness,
       e.degree
ORDER BY e.pageRank DESC LIMIT 30
```

### Most Important Per Category

```cypher
MATCH (e:Entity)
WHERE e.pageRank IS NOT NULL
WITH e.category AS category, e
ORDER BY e.pageRank DESC
WITH category, collect(e)[0..3] AS top3
UNWIND top3 AS e
RETURN category, e.name, round(e.pageRank, 4) AS pageRank
ORDER BY category, pageRank DESC
```

### Structural Bridges (High Betweenness, Not Necessarily High PageRank)

```cypher
-- Entities that hold the graph together (structural importance)
MATCH (e:Entity)
WHERE e.betweenness IS NOT NULL AND e.betweenness > 100
RETURN e.name, e.category,
       round(e.betweenness, 2) AS betweenness,
       round(e.pageRank, 4) AS pageRank,
       e.projectCount
ORDER BY e.betweenness DESC LIMIT 20
```

---

## 10. System Queries

### Database Overview

```cypher
MATCH (n) RETURN labels(n) AS type, count(n) AS count ORDER BY count DESC
```

### Relationship Overview

```cypher
MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC
```

### Embedding Coverage

```cypher
MATCH (e:Entity)
RETURN count(e) AS total,
  sum(CASE WHEN e.embedding IS NOT NULL THEN 1 ELSE 0 END) AS withEmbedding,
  sum(CASE WHEN e.pageRank IS NOT NULL THEN 1 ELSE 0 END) AS withPageRank,
  sum(CASE WHEN e.betweenness IS NOT NULL THEN 1 ELSE 0 END) AS withBetweenness
```

### Index Status

```cypher
SHOW INDEXES YIELD name, type, state RETURN name, type, state
```

---

## MCP Tool Mapping

| MCP Tool | Primary Operations |
|----------|-------------------|
| `memorytonic_list_projects` | Navigation: directory, collection, tags |
| `memorytonic_get_project` | Project read + entities + relationships |
| `memorytonic_get_entity` | Entity read + roles + relationships + similar |
| `memorytonic_search` | Fulltext search |
| `memorytonic_recall` | Hybrid search (text + vector + graph expansion) |
| `memorytonic_similar` | Node Similarity (GDS SIMILAR_TO) + Vector similarity |
| `memorytonic_find_paths` | Shortest path + all paths |
| `memorytonic_collection_bridges` | Bridge detection within collection |
| `memorytonic_importance` | Composite importance ranking |
| `memorytonic_gaps` | Gap detection (isolated, under-connected) |
| `memorytonic_temporal` | Project timeline |
| `memorytonic_explore` | N-hop neighborhood exploration |
| `memorytonic_stats` | Database overview + embedding coverage |
| `memorytonic_query` | Any read-only Cypher |
| `memorytonic_explain` | Entity explanation with cross-project context |

---

## Scripts Reference

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `neo4j/bootstrap.py` | Create schema | Once per database |
| `neo4j/upload.py <dir>` | Upload extraction artifacts | After each extraction |
| `neo4j/validate_project.py <dir>` | Validate before upload | Before each upload |
| `neo4j/gds.py` | Compute graph algorithms | After upload or deletion |
| `neo4j/delete_project.py <uid>` | Cascade delete project | When removing a project |
| `neo4j/db.py` | Shared HTTP client | Imported by other scripts |
| `neo4j/config.py` | Connection configuration | Reads from .env |
