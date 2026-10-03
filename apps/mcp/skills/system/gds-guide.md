# GDS Guide (Graph Data Science)

**How graph algorithms compute entity importance, detect bridges, and find similarities.**

---

## When GDS Runs

GDS runs on the FULL graph after every:
- Project upload (Step 08)
- Project deletion
- Collection import

Script: `gds.py` — spawned as subprocess, communicates via exit codes.

---

## Graph Projection

Before running algorithms, GDS creates an in-memory projection:

```
Projection name: "memorytonic-graph"
Node type: Entity
Relationship type: RELATES_TO
Orientation: UNDIRECTED
```

**UNDIRECTED means:** Edge direction is ignored for algorithm computation. An edge A→B and an edge B→A are both treated as a single undirected connection. This affects all centrality scores.

The projection is dropped and recreated each time GDS runs.

---

## The 4 Algorithms

### 1. PageRank → Entity.pageRank

**What it measures:** How important is this entity based on incoming connections? Entities connected to other important entities get higher scores.

**Parameters:**
- maxIterations: 20
- dampingFactor: 0.85

**How it works:** Simulates a "random walker" traversing the graph. Entities visited more frequently (especially via other high-PageRank entities) score higher. The damping factor means 15% of the time the walker jumps to a random node.

**What it means for research:**
- High PageRank = entity is well-connected to other well-connected entities
- Low PageRank = peripheral entity, few important connections
- Useful for: "What are the most important entities in this collection?"

**Written to:** `entity.pageRank` (float)

**RAM guard:** < 50,000 nodes

---

### 2. Betweenness Centrality → Entity.betweenness

**What it measures:** How many shortest paths between other entities pass through this entity? High betweenness = structural bridge.

**How it works:** For every pair of entities, compute the shortest path. Count how many of those paths go through entity X. The more paths, the higher X's betweenness.

**What it means for research:**
- High betweenness = structural bridge (sits between clusters, connects different topics)
- Low betweenness = within a single cluster, not bridging anything
- Useful for: "Which entities connect different research topics?"

**Written to:** `entity.betweenness` (float)

**RAM guard:** < 10,000 nodes (more expensive than PageRank)

**Bridge detection:** Betweenness is one input to bridge tier computation:
- Bronze tier: projectCount = 1 AND betweenness > 1000

---

### 3. Degree Centrality → Entity.degree

**What it measures:** How many connections does this entity have? Simple count.

**How it works:** Count RELATES_TO edges touching this entity (both directions, since projection is undirected).

**What it means for research:**
- High degree = highly connected, involved in many relationships
- Low degree = few connections, potentially isolated or highly specialized
- Useful for: "Which entities are most connected?"

**Written to:** `entity.degree` (integer)

---

### 4. Node Similarity → SIMILAR_TO edges

**What it measures:** Which entities connect to similar neighbors? (Jaccard similarity on neighborhoods)

**Parameters:**
- similarityCutoff: 0.3 (only create edges above this threshold)
- topK: 5 (max 5 similar entities per node)

**How it works:**
1. For each entity, look at its neighborhood (entities it connects to via RELATES_TO)
2. Compare neighborhoods between entity pairs using Jaccard similarity
3. If similarity > 0.3, create a SIMILAR_TO edge with the similarity score

**Critical behavior:** Before computing, ALL existing SIMILAR_TO edges are DELETED. Then new ones are created. This happens every GDS run.

**What it means for research:**
- SIMILAR_TO entities operate in similar contexts even if not directly connected
- Useful for: "What entities play similar roles?" and semantic clustering

**Written to:** SIMILAR_TO edges with `similarity` property (float, 0.0-1.0)

---

## Bridge Tiers

Computed from projectCount + betweenness after GDS runs:

| Tier | Criteria | C02 Visual | Research Meaning |
|------|----------|------------|-----------------|
| **Gold** | projectCount >= 3 | Double ring, prominent glow | Entity appears across 3+ projects — major cross-topic connector |
| **Silver** | projectCount = 2 | Single ring | Entity appears in 2 projects — emerging bridge |
| **Bronze** | projectCount = 1 AND betweenness > 1000 | Subtle indicator | Single project but structurally critical — sits between clusters |

**Bridge computation happens in export_collection.py** (for exports) and is computed on-the-fly by C02/C03 queries using projectCount and betweenness values stored on Entity nodes.

---

## Node Size Computation (C02 Graph Studio)

Node visual size on the force graph is computed from GDS metrics:

```
size = normalize(
  pageRank * 0.35 +
  betweenness * 0.25 +
  degree * 0.20 +
  projectCount * 0.20
)
```

This means extraction quality directly affects visual quality:
- Missing relationships → lower degree → smaller nodes
- Missing aliases → lower projectCount → smaller bridge nodes → missed gold/silver tiers

---

## GDS Status Check

```
Tool: memorytonic_stats
Script: gds.py --status
```

Returns:
- Whether GDS has been computed
- Entity count, relationship count
- Latest PageRank, betweenness, degree stats
- SIMILAR_TO edge count

---

## RAM Considerations

| Algorithm | Safe Under | Warning Above |
|-----------|-----------|---------------|
| PageRank | 50,000 nodes | May slow down, still works |
| Betweenness | 10,000 nodes | Can use significant RAM |
| Degree | No practical limit | Always fast |
| Node Similarity | 50,000 nodes | Jaccard computation can be expensive |

For a typical MemoryTonic installation (< 1000 entities), all algorithms complete in 1-10 seconds.

---

## GDS and the Research Agent

The Research Agent uses GDS metrics for analysis:

| Analysis | GDS Metrics Used |
|----------|-----------------|
| "What are the most important entities?" | PageRank ranking |
| "What connects different topics?" | Betweenness + bridge tiers |
| "What entities play similar roles?" | SIMILAR_TO edges |
| "What entities are isolated?" | Degree = 0 or very low |
| "Is this entity a structural bridge?" | projectCount + betweenness |
| "What would happen if this entity was removed?" | Betweenness (high = cascading impact) |
