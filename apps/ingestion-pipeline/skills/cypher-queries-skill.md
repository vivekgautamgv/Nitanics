# Cypher Query Patterns

**Purpose:** Common query patterns for the MemoryTonic knowledge graph. Reference for MCP tools (Component 4) and Graph Studio (Component 2).

---

## Navigation Queries

### Browse by Directory

```cypher
-- List all directories with project counts
MATCH (d:DirectoryCategory)
OPTIONAL MATCH (p:Project)-[:IN_DIRECTORY]->(d)
RETURN d.name, d.description, count(p) AS projectCount
```

### Browse by Collection

```cypher
-- List all collections with project counts
MATCH (c:Collection)
OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
RETURN c.name, c.collectionId, count(p) AS projectCount

-- All projects in a collection
MATCH (p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
RETURN p.name, p.uniqueId, p.domain, p.subdomain, p.baseTags
ORDER BY p.name
```

### Browse by Tags (3-level hierarchy)

```cypher
-- All unique domains
MATCH (p:Project) RETURN DISTINCT p.domain ORDER BY p.domain

-- Projects in a domain
MATCH (p:Project {domain: $domain})
RETURN p.name, p.uniqueId, p.subdomain, p.baseTags

-- Projects sharing a specific base tag
MATCH (p:Project) WHERE $tag IN p.baseTags
RETURN p.name, p.uniqueId, p.domain
```

---

## Project Queries

### Get Project Details

```cypher
MATCH (p:Project {uniqueId: $uid})
RETURN p.name, p.uniqueId, p.summary, p.narrativeFlow,
       p.domain, p.subdomain, p.baseTags, p.htmlPath, p.directory
```

### Get Project Entities

```cypher
MATCH (e:Entity)-[m:MENTIONED_IN]->(p:Project {uniqueId: $uid})
RETURN e.name, e.category, e.definition, m.role,
       e.projectCount, e.pageRank, e.betweenness
ORDER BY e.pageRank DESC
```

### Get Project Relationships

```cypher
MATCH (a:Entity)-[r:RELATES_TO]->(b:Entity),
      (a)-[:MENTIONED_IN]->(p:Project {uniqueId: $uid}),
      (b)-[:MENTIONED_IN]->(p)
RETURN a.name, r.relType, r.causalClassification, b.name,
       r.description, r.evidence, r.evidenceStrength, r.magnitude, r.year
```

### Get Project Causal Chains

```cypher
MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p:Project {uniqueId: $uid})
WITH cc ORDER BY cc.name
MATCH (a:Entity)-[r:CHAIN_LINK {chainId: cc.chainId}]->(b:Entity)
RETURN cc.name, cc.description, a.name, b.name, r.explanation, r.orderIndex
ORDER BY cc.name, r.orderIndex
```

### Get Project Timeline

```cypher
MATCH (te:TemporalEvent)-[:BELONGS_TO_PROJECT]->(p:Project {uniqueId: $uid})
OPTIONAL MATCH (e:Entity)-[:FIRST_APPEARS_IN]->(te)
RETURN te.phaseIndex, te.label, te.period, collect(e.name) AS entities
ORDER BY te.phaseIndex
```

---

## Entity Queries

### Get Entity Details

```cypher
MATCH (e:Entity {name: $name})
RETURN e.name, e.aliases, e.category, e.definition,
       e.projectCount, e.pageRank, e.betweenness, e.degree
```

### Entity Roles Across Projects

```cypher
MATCH (e:Entity {name: $name})-[m:MENTIONED_IN]->(p:Project)
RETURN p.name, p.uniqueId, m.role
```

### Entity Relationships

```cypher
-- Outgoing
MATCH (e:Entity {name: $name})-[r:RELATES_TO]->(t:Entity)
RETURN t.name, r.relType, r.causalClassification, r.description

-- Incoming
MATCH (s:Entity)-[r:RELATES_TO]->(e:Entity {name: $name})
RETURN s.name, r.relType, r.causalClassification, r.description

-- Both directions
MATCH (e:Entity {name: $name})-[r:RELATES_TO]-(other:Entity)
RETURN other.name, type(r), r.relType, r.description
```

### Entity N-Hop Neighborhood

```cypher
-- 2-hop neighborhood
MATCH path = (e:Entity {name: $name})-[:RELATES_TO*1..2]-(other:Entity)
RETURN DISTINCT other.name, other.category, length(path) AS hops
ORDER BY hops, other.name
```

---

## Bridge Entity Queries

### All Bridge Entities (Tiered)

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

### Bridge Entity — Which Projects It Connects

```cypher
MATCH (e:Entity {name: $name})-[:MENTIONED_IN]->(p:Project)
RETURN p.name, p.uniqueId, p.domain
ORDER BY p.name
```

### Collection Bridges

```cypher
MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)-[:BELONGS_TO]->(c:Collection {name: $collectionName})
WITH e, collect(DISTINCT p.name) AS projects
WHERE size(projects) > 1
RETURN e.name, e.projectCount, projects, e.pageRank
ORDER BY e.projectCount DESC
```

---

## Search Queries

### Fulltext Search

```cypher
CALL db.index.fulltext.queryNodes("entity_fulltext", $query)
YIELD node, score
RETURN node.name, node.category, node.definition, score
ORDER BY score DESC LIMIT 20
```

### Vector Similarity Search

```cypher
-- Find entities semantically similar to a query vector
MATCH (e:Entity)
WHERE e.embedding IS NOT NULL
WITH e, vector.similarity.cosine(e.embedding, $queryVector) AS score
WHERE score > 0.7
RETURN e.name, e.category, score
ORDER BY score DESC LIMIT 10
```

### Similar Projects (by embedding)

```cypher
MATCH (p:Project)
WHERE p.embedding IS NOT NULL
WITH p, vector.similarity.cosine(p.embedding, $queryVector) AS score
WHERE score > 0.5
RETURN p.name, p.uniqueId, p.domain, score
ORDER BY score DESC LIMIT 10
```

### Hybrid Search (text + vector + graph expansion)

```cypher
-- Step 1: Fulltext matches
CALL db.index.fulltext.queryNodes("entity_fulltext", $query)
YIELD node, score
WITH node AS e, score WHERE score > 0.5

-- Step 2: 1-hop expansion
OPTIONAL MATCH (e)-[:RELATES_TO]-(neighbor:Entity)

-- Step 3: Collect with dedup
WITH collect(DISTINCT e) + collect(DISTINCT neighbor) AS allNodes
UNWIND allNodes AS n
RETURN DISTINCT n.name, n.category, n.definition, n.pageRank
ORDER BY n.pageRank DESC
```

---

## Graph Traversal Queries

### Shortest Path Between Entities

```cypher
MATCH path = shortestPath(
  (a:Entity {name: $entityA})-[:RELATES_TO*..6]-(b:Entity {name: $entityB})
)
RETURN [n IN nodes(path) | n.name] AS entities,
       [r IN relationships(path) | r.relType] AS relationships,
       length(path) AS hops
```

### All Paths (up to maxDepth)

```cypher
MATCH path = (a:Entity {name: $entityA})-[:RELATES_TO*1..4]-(b:Entity {name: $entityB})
RETURN [n IN nodes(path) | n.name] AS entities,
       length(path) AS hops
ORDER BY hops LIMIT 10
```

---

## Analytics Queries

### Gap Detection (Isolated Entities)

```cypher
MATCH (e:Entity)
WHERE e.degree IS NOT NULL AND e.degree <= 1
RETURN e.name, e.category, e.projectCount, e.degree
ORDER BY e.degree, e.name
```

### Importance Ranking (Composite Score)

```cypher
MATCH (e:Entity)
WHERE e.pageRank IS NOT NULL
RETURN e.name, e.category, e.projectCount,
       round(e.pageRank, 4) AS pageRank,
       round(e.betweenness, 2) AS betweenness,
       e.degree
ORDER BY e.pageRank DESC LIMIT 30
```

### Causal Classification Distribution

```cypher
MATCH ()-[r:RELATES_TO]->()
RETURN r.causalClassification, count(r) AS count
ORDER BY count DESC
```

### Entity Category Distribution

```cypher
MATCH (e:Entity)
RETURN e.category, count(e) AS count
ORDER BY count DESC
```

---

## System Queries

### Database Overview

```cypher
MATCH (n) RETURN labels(n) AS type, count(n) AS count ORDER BY count DESC
```

### Relationship Overview

```cypher
MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC
```

### Index Status

```cypher
SHOW INDEXES YIELD name, type, state RETURN name, type, state
```

### Embedding Coverage

```cypher
MATCH (e:Entity)
RETURN count(e) AS total,
  sum(CASE WHEN e.embedding IS NOT NULL THEN 1 ELSE 0 END) AS withEmbedding,
  sum(CASE WHEN e.pageRank IS NOT NULL THEN 1 ELSE 0 END) AS withPageRank,
  sum(CASE WHEN e.betweenness IS NOT NULL THEN 1 ELSE 0 END) AS withBetweenness
```

---

## MCP Tool Mapping

| MCP Tool | Primary Query Pattern |
|----------|----------------------|
| `memorytonic_list_projects` | Browse by Directory / Collection |
| `memorytonic_get_project` | Get Project Details |
| `memorytonic_get_entity` | Get Entity Details + Roles + Relationships |
| `memorytonic_search` | Fulltext Search |
| `memorytonic_recall` | Hybrid Search |
| `memorytonic_similar` | Node Similarity (GDS SIMILAR_TO) + Vector similarity |
| `memorytonic_find_paths` | Shortest Path |
| `memorytonic_collection_bridges` | Collection Bridges |
| `memorytonic_importance` | Importance Ranking |
| `memorytonic_gaps` | Gap Detection |
| `memorytonic_temporal` | Project Timeline |
| `memorytonic_stats` | Database Overview |
| `memorytonic_query` | Any read-only Cypher |
