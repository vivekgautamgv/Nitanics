# GDS Operations Guide

**Purpose:** How to use Graph Data Science algorithms on the MemoryTonic knowledge graph.
**Tool:** `python neo4j/gds.py`
**Prerequisite:** Neo4j GDS plugin installed (Neo4j Desktop → DBMS → Plugins)

---

## Available Algorithms

### PageRank

**What it measures:** Entity importance based on relationship structure. An entity with high PageRank is pointed to by many other important entities.

**Stored as:** `entity.pageRank` (float)

**Use in product:**
- Node sizing in Graph Studio (bigger = more important)
- `memorytonic_importance` MCP tool ranking
- Collection-level "key entities" summary

```bash
python neo4j/gds.py --pagerank
```

```cypher
-- Top entities by PageRank
MATCH (e:Entity) WHERE e.pageRank IS NOT NULL
RETURN e.name, round(e.pageRank, 4) ORDER BY e.pageRank DESC LIMIT 20
```

### Betweenness Centrality

**What it measures:** How often an entity sits on the shortest path between other entities. High betweenness = structural bridge connecting different clusters.

**Stored as:** `entity.betweenness` (float)

**Use in product:**
- Bridge entity detection (complements projectCount)
- Node glow intensity in Graph Studio
- Identifying entities that "hold the graph together"

```bash
python neo4j/gds.py --betweenness
```

```cypher
-- Top structural bridges
MATCH (e:Entity) WHERE e.betweenness IS NOT NULL
RETURN e.name, round(e.betweenness, 2) ORDER BY e.betweenness DESC LIMIT 20
```

### Degree Centrality

**What it measures:** Total connection count (incoming + outgoing RELATES_TO edges). Simple but effective measure of connectivity.

**Stored as:** `entity.degree` (float)

**Use in product:**
- Graph Studio node sizing fallback (when PageRank unavailable)
- Quick filter: "show only highly connected entities"

```bash
python neo4j/gds.py --degree
```

```cypher
-- Most connected entities
MATCH (e:Entity) WHERE e.degree IS NOT NULL
RETURN e.name, e.degree ORDER BY e.degree DESC LIMIT 20
```

### Node Similarity

**What it measures:** Which entities have similar relationship patterns (share many of the same neighbors). Two entities are similar if they connect to the same other entities.

**Stored as:** `SIMILAR_TO` relationship with `similarity` property (float 0-1)

**Use in product:**
- "Similar entities" recommendation panel
- `memorytonic_similar` MCP tool
- Entity clustering without community detection

**Cutoff:** Only creates SIMILAR_TO for similarity >= 0.3, max 5 neighbors per entity.

```bash
python neo4j/gds.py --similarity
```

```cypher
-- Most similar entity pairs
MATCH (a:Entity)-[r:SIMILAR_TO]->(b:Entity)
RETURN a.name, b.name, round(r.similarity, 3)
ORDER BY r.similarity DESC LIMIT 20
```

---

## How It Works

### Graph Projection

GDS algorithms don't run directly on the database. They first create an **in-memory projection** — a lightweight copy of the relevant subgraph.

Our projection:
- **Nodes:** All Entity nodes
- **Relationships:** RELATES_TO (undirected for centrality algorithms)
- **Name:** `memorytonic-graph` (created and dropped each run)

### Execution Flow

```
1. Create projection (Entity + RELATES_TO)
2. Run PageRank → write entity.pageRank
3. Run Betweenness → write entity.betweenness
4. Run Degree → write entity.degree
5. Run Node Similarity → write SIMILAR_TO relationships
6. Drop projection (free memory)
7. Show status report
```

### When to Run

| Event | Action |
|-------|--------|
| After `upload.py` | Run full: `python neo4j/gds.py` |
| After `delete_project.py` | Run full: `python neo4j/gds.py` |
| After bulk operations | Run full once at the end |
| Checking current metrics | `python neo4j/gds.py --status` |

### RAM Considerations

At current scale (245 entities, 184 relationships), all algorithms run in seconds with negligible RAM usage. Tested 2026-04-05: PageRank converged in 20 iterations, 366 SIMILAR_TO relationships created, top entity IMF (PageRank 5.22, Betweenness 3987, Degree 15).

**Scaling guidelines:**
- PageRank: safe up to ~50,000 nodes
- Betweenness: safe up to ~10,000 nodes (O(n*m) complexity)
- Node Similarity: safe up to ~20,000 nodes
- If graph exceeds these, use sampling or filtered projections

---

## Algorithms NOT Used

| Algorithm | Why Not |
|-----------|---------|
| **Louvain** (Community Detection) | Unreliable results in previous testing. Use tag-based grouping instead. |
| **Weakly Connected Components** | Graph is already one connected component. Not useful. |
| **Shortest Path** | Available natively in Cypher (`shortestPath`). No GDS needed. |
| **KNN** | Already have vector embeddings for semantic similarity. Redundant. |

---

## MCP Integration

| MCP Tool | GDS Dependency |
|----------|---------------|
| `memorytonic_recompute` | Calls `gds.py` (all algorithms) |
| `memorytonic_importance` | Reads `entity.pageRank` |
| `memorytonic_similar` | Reads `SIMILAR_TO` relationships |
| `memorytonic_collection_bridges` | Reads `entity.betweenness` + `entity.projectCount` |
| `memorytonic_gaps` | Reads `entity.degree` (degree 0-1 = isolated) |

---

## CLI Reference

```bash
python neo4j/gds.py                  # Run ALL algorithms
python neo4j/gds.py --pagerank       # PageRank only
python neo4j/gds.py --betweenness    # Betweenness only
python neo4j/gds.py --degree         # Degree only
python neo4j/gds.py --similarity     # Node Similarity only
python neo4j/gds.py --status         # Show current metrics (no computation)
```
