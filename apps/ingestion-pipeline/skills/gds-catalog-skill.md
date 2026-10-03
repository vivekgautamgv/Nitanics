# GDS Algorithm Catalog for MemoryTonic

**Purpose:** Comprehensive reference for ALL Neo4j GDS algorithm categories. Identifies which algorithms are useful for MemoryTonic, which might be useful later, and which are not relevant.

**GDS Version:** 2026.03.0
**Our graph:** 245 Entity nodes, 184 RELATES_TO edges, 384d BERT embeddings, 366 SIMILAR_TO edges

---

## Algorithm Decision Matrix

### Currently Active (in gds.py)

| Algorithm | Category | Property Written | MCP Tool | Why We Use It |
|-----------|----------|-----------------|----------|---------------|
| PageRank | Centrality | `entity.pageRank` | `memorytonic_importance` | Entity importance — node sizing, ranking |
| Betweenness | Centrality | `entity.betweenness` | `memorytonic_collection_bridges` | Structural bridge detection |
| Degree | Centrality | `entity.degree` | `memorytonic_gaps` | Connection count — gap detection |
| Node Similarity | Similarity | `SIMILAR_TO` relationship | `memorytonic_similar` | Recommendation — "entities like this" |

### Tier 2: Implement Next (High Value)

| Algorithm | Category | Property | Value for MemoryTonic |
|-----------|----------|----------|-----------------------|
| **Articulation Points** | Centrality | `entity.isArticulationPoint` | **Gap detection**: nodes whose removal disconnects the graph. Knowledge single-points-of-failure. |
| **Weakly Connected Components** | Community | `entity.componentId` | **Gap detection**: find disconnected knowledge islands. If WCC > 1, there are isolated clusters. |
| **Triangle Count** | Community | `entity.triangleCount` | **Evidence corroboration**: entities in triangles have multiple evidence paths confirming connections. |
| **Local Clustering Coefficient** | Community | `entity.clusteringCoefficient` | **Knowledge completeness**: high = well-documented area, low = sparse/gap area needing more research. |
| **K-Core Decomposition** | Community | `entity.coreness` | **Knowledge density**: high coreness = dense core of graph, low = periphery. |
| **KNN (on embeddings)** | Similarity | rewrites `SIMILAR_TO` | **Better similarity**: uses 384d BERT embeddings + cosine, not just topology. Should supplement/replace Node Similarity. |
| **Closeness Centrality** | Centrality | `entity.closeness` | **Accessibility**: most reachable entities — good starting points for exploration. |

### Tier 3: Implement When Needed

| Algorithm | Category | Value | When |
|-----------|----------|-------|------|
| **Leiden** | Community | Superior to Louvain but same family (user caution) | If Label Propagation doesn't cluster well enough |
| **Label Propagation** | Community | Fast parameter-free clustering | When graph > 500 entities |
| **HDBSCAN** | Community | Density clustering on embeddings with auto-k + outlier detection | When embedding-based clustering needed |
| **SLLPA (Speaker-Listener LPA)** | Community | Overlapping communities — entities in multiple topics | When multi-topic features ship |
| **Influence Maximization (CELF)** | Centrality | "Start here" seed entities for AI exploration | Component 4 (MCP agent exploration) |
| **FastRP** | Node Embedding | Structural embeddings (graph position, not text meaning) | If structural similarity complements BERT |
| **Article Rank** | Centrality | PageRank variant less biased by hubs | If IMF-like entities skew results too much |
| **Adamic Adar / Resource Allocation** | Link Prediction | Predict missing relationships | When "Suggested Connections" feature ships |
| **Yen's K-Shortest Paths** | Path Finding | Multiple explanation paths between entities | When "Explain Connection" needs alternatives |
| **Random Walk** | Path Finding | "Surprise Me" serendipitous discovery | When discovery features ship |

### Not Relevant

| Algorithm | Category | Why Not |
|-----------|----------|---------|
| Louvain | Community | User had bad experience. **PERMANENTLY EXCLUDED.** |
| A* | Path Finding | Needs geographic/heuristic coordinates |
| Spanning Tree | Path Finding | Network optimization, not knowledge graphs |
| Bellman-Ford | Path Finding | Needs negative weights |
| GraphSAGE | Node Embedding | Requires training data |
| HashGNN | Node Embedding | Complex input requirements, FastRP simpler |
| K-1 Coloring | Community | Visualization partitioning, not semantically meaningful |
| Max Flow / Min Cost | Path Finding | Network capacity, not relevant |
| Pregel | Framework | Low-level custom algorithm API, no direct use case |

---

## Category Deep Dives

### 1. CENTRALITY — "Who matters?"

Centrality algorithms rank nodes by importance. Different algorithms measure different kinds of importance.

#### PageRank (ACTIVE)
- **What:** Importance based on incoming links from other important nodes
- **Stored:** `entity.pageRank` (float, higher = more important)
- **Product use:** Node sizing in Graph Studio, importance ranking, collection summaries
- **Run:** `python neo4j/gds.py --pagerank`
- **Current results:** IMF (5.22), United States (3.90), Petrodollar System (3.73)

```cypher
-- GDS call (inside gds.py)
CALL gds.pageRank.write('memorytonic-graph', {
  writeProperty: 'pageRank',
  maxIterations: 20,
  dampingFactor: 0.85
})
```

#### Betweenness Centrality (ACTIVE)
- **What:** How often a node sits on shortest paths between other nodes
- **Stored:** `entity.betweenness` (float, higher = more bridging)
- **Product use:** Bridge detection, "holds the graph together" indicator
- **Run:** `python neo4j/gds.py --betweenness`
- **Current results:** IMF (3987), Quota System (3173), China (2456)

```cypher
CALL gds.betweenness.write('memorytonic-graph', {
  writeProperty: 'betweenness'
})
```

#### Degree Centrality (ACTIVE)
- **What:** Total connection count (in + out)
- **Stored:** `entity.degree` (float)
- **Product use:** Gap detection (degree 0-1 = isolated), connectivity filter
- **Run:** `python neo4j/gds.py --degree`

```cypher
CALL gds.degree.write('memorytonic-graph', {
  writeProperty: 'degree'
})
```

#### Closeness Centrality (RECOMMENDED)
- **What:** Average distance to all other nodes. High closeness = can reach everything quickly.
- **Would store:** `entity.closeness` (float 0-1)
- **Product use:** "Most accessible" entities — good starting points for exploration
- **When to add:** When exploration features launch (Component 2 or 4)
- **Complexity:** O(n*m) — same as Betweenness, safe up to ~10,000 nodes

```cypher
-- Would add to gds.py
CALL gds.closeness.write('memorytonic-graph', {
  writeProperty: 'closeness'
})
```

#### Article Rank (RECOMMENDED)
- **What:** PageRank variant that reduces bias from hub nodes
- **Would store:** `entity.articleRank` (float)
- **Product use:** Alternative to PageRank when a few entities (IMF, US) dominate too much
- **When to add:** When graph grows and dominant entities skew rankings
- **Note:** Uses same projection as PageRank

```cypher
CALL gds.articleRank.write('memorytonic-graph', {
  writeProperty: 'articleRank'
})
```

#### Influence Maximization / CELF (RECOMMENDED)
- **What:** Find the minimal set of "seed" nodes that maximally influence the graph
- **Product use:** AI agent exploration — "start from these 5 entities to understand 80% of the graph"
- **When to add:** Component 4 (MCP agent exploration)
- **Note:** Computationally expensive. Run on-demand, not on every upload.

```cypher
CALL gds.influenceMaximization.celf.stream('memorytonic-graph', {
  seedSetSize: 5
})
YIELD nodeId, spread
RETURN gds.util.asNode(nodeId).name AS entity, spread
ORDER BY spread DESC
```

#### Articulation Points (TIER 2 — GAP DETECTION)
- **What:** Nodes whose removal would disconnect the graph into separate components
- **Would store:** `entity.isArticulationPoint` (integer, 0 or 1)
- **Product use:** **Critical for gap detection.** If an entity is an articulation point, it's a single point of failure. Removing it (or if it was poorly documented) leaves two knowledge clusters disconnected. These entities NEED better documentation and cross-references.
- **When to add:** Next GDS update — essential for `memorytonic_gaps`

```cypher
CALL gds.articulationPoints.write('memorytonic-graph', {
  writeProperty: 'isArticulationPoint'
})
```

#### Bridges (TIER 2 — RELATIONSHIP GAP DETECTION)
- **What:** Relationships whose removal would disconnect the graph
- **Product use:** Fragile connections — if that one evidence link breaks, two clusters become isolated. Surfaces "weak links" that need reinforcement.
- **When to add:** Next GDS update, pair with Articulation Points
- **Note:** Stream-only (returns relationship pairs, not node properties)

```cypher
CALL gds.bridges.stream('memorytonic-graph')
YIELD from, to
RETURN gds.util.asNode(from).name AS entity1,
       gds.util.asNode(to).name AS entity2
```

#### Eigenvector Centrality
- **Status:** NOT RECOMMENDED — PageRank is the dampened, more stable version. Redundant.

#### Harmonic Centrality
- **What:** Like Closeness but handles disconnected graphs better (infinite distances become 0)
- **Status:** Use instead of Closeness if WCC > 1 component

---

### 2. COMMUNITY DETECTION — "Who groups together?"

Community detection finds clusters of tightly connected nodes.

#### Label Propagation (RECOMMENDED)
- **What:** Fast, parameter-free community detection. Each node adopts the most common label of its neighbors.
- **Would store:** `entity.community` (integer, community ID)
- **Product use:** Entity clustering without manual tagging, "automatic collections"
- **When to add:** When graph exceeds 500 entities and manual grouping breaks down
- **Why over Louvain:** Much simpler, no resolution parameter to tune, deterministic with seeding
- **Complexity:** O(n*m) but very fast in practice

```cypher
CALL gds.labelPropagation.write('memorytonic-graph', {
  writeProperty: 'community'
})
```

#### Weakly Connected Components (TIER 2)
- **What:** Finds groups of nodes that can reach each other (ignoring edge direction)
- **Would store:** `entity.componentId` (integer)
- **Product use:** **Fundamental gap detection.** If WCC > 1 component, there are isolated knowledge islands with NO cross-references. Essential.
- **Complexity:** Nearly O(n) — cheapest community algorithm
- **When to add:** Next GDS update

```cypher
CALL gds.wcc.write('memorytonic-graph', {
  writeProperty: 'componentId'
})
-- If componentCount > 1, graph has disconnected islands
```

#### Triangle Count (TIER 2 — EVIDENCE CORROBORATION)
- **What:** Counts triangles each node participates in (A-B, B-C, A-C all connected)
- **Would store:** `entity.triangleCount` (integer)
- **Product use:** Entities in many triangles have **corroborated connections** — multiple evidence paths confirm their importance. Zero triangles = only "chain" connections (no shortcuts). Measures evidence density.
- **When to add:** Next GDS update

```cypher
CALL gds.triangleCount.write('memorytonic-graph', {
  writeProperty: 'triangleCount'
})
YIELD globalTriangleCount
```

#### Local Clustering Coefficient (TIER 2 — KNOWLEDGE COMPLETENESS)
- **What:** Ratio of actual connections between neighbors vs. possible connections (0-1)
- **Would store:** `entity.clusteringCoefficient` (float 0-1)
- **Product use:** High coefficient = well-documented neighborhood (all neighbors connected). Low = sparse, likely missing connections. **Direct gap detection signal.** An entity with 10 neighbors but clustering 0.1 means only 10% of possible neighbor-neighbor links exist.
- **When to add:** Next GDS update, pairs with Triangle Count

```cypher
CALL gds.localClusteringCoefficient.write('memorytonic-graph', {
  writeProperty: 'clusteringCoefficient'
})
YIELD averageClusteringCoefficient
```

#### K-Core Decomposition (TIER 2 — KNOWLEDGE DENSITY)
- **What:** Assigns "coreness" value — a node with coreness k belongs to the maximal subgraph where every node has degree >= k. Higher = denser core.
- **Would store:** `entity.coreness` (integer)
- **Product use:** High coreness = dense, well-explored knowledge core. Low coreness (1-2) = periphery, under-explored. Perfect for identifying which areas are well-documented vs. sparse.
- **Complexity:** Fast, lightweight

```cypher
CALL gds.kcore.write('memorytonic-graph', {
  writeProperty: 'coreness'
})
YIELD degeneracy
```

#### HDBSCAN (TIER 3 — EMBEDDING CLUSTERING)
- **What:** Hierarchical density-based clustering on embeddings. Auto-determines cluster count. Labels outliers as -1.
- **Would store:** `entity.embeddingCluster` (integer, -1 = outlier)
- **Product use:** Cluster entities by BERT embedding similarity. Outliers (-1) are either unique/novel entities or poorly-documented ones — both valuable for gap detection.
- **Requires:** Node property `embedding` (we have it — 384d BERT)

```cypher
CALL gds.hdbscan.write('memorytonic-graph', {
  nodeProperty: 'embedding',
  minClusterSize: 3,
  writeProperty: 'embeddingCluster'
})
YIELD numberOfClusters, numberOfNoisePoints
```

#### SLLPA — Speaker-Listener LPA (TIER 3 — OVERLAPPING COMMUNITIES)
- **What:** Overlapping community detection — entities can belong to MULTIPLE communities
- **Would store:** `entity.overlappingCommunities` (list of integers)
- **Product use:** "Iran" belongs to both "Middle East geopolitics" AND "economic sanctions" AND "nuclear". Captures multi-topic membership.

```cypher
CALL gds.sllpa.write('memorytonic-graph', {
  maxIterations: 100,
  minAssociationStrength: 0.1,
  writeProperty: 'overlappingCommunities'
})
```

#### Louvain — NOT USED
- **Why:** User had bad experience with unreliable results. Excluded permanently.
- **Alternative:** Label Propagation for community detection.

#### Leiden — NOT USED
- **Why:** Same family as Louvain, similar issues with resolution sensitivity.

---

### 3. SIMILARITY — "Who is like whom?"

Similarity algorithms find nodes with similar properties or structural positions.

#### Node Similarity (ACTIVE)
- **What:** Jaccard similarity based on shared neighbors (relationship overlap)
- **Stored:** `SIMILAR_TO` relationship with `similarity` property (float 0-1)
- **Product use:** "Similar entities" panel, recommendations
- **Run:** `python neo4j/gds.py --similarity`
- **Current results:** 366 relationships, 191 nodes compared, cutoff 0.3, topK 5

```cypher
CALL gds.nodeSimilarity.write('memorytonic-graph', {
  writeRelationshipType: 'SIMILAR_TO',
  writeProperty: 'similarity',
  similarityCutoff: 0.3,
  topK: 5
})
```

#### KNN on Embeddings (TIER 2 — BETTER SIMILARITY)
- **What:** Finds K most similar nodes based on node properties — specifically our 384d BERT embeddings + cosine similarity
- **Key insight:** Node Similarity (current) measures **structural** similarity (shared neighbors). KNN measures **semantic** similarity (embedding distance). These capture DIFFERENT signals. An entity could be semantically similar but structurally different.
- **Recommendation:** Supplement or replace current Node Similarity with KNN for SIMILAR_TO generation
- **Would write:** `SIMILAR_TO` relationships (same as now, but better quality)

```cypher
CALL gds.knn.write('memorytonic-graph', {
  topK: 5,
  nodeProperties: {embedding: 'COSINE'},
  similarityCutoff: 0.7,
  sampleRate: 0.8,
  randomSeed: 42,
  writeRelationshipType: 'SIMILAR_TO',
  writeProperty: 'similarity'
})
YIELD nodesCompared, relationshipsWritten
```

#### Filtered Node Similarity / Filtered KNN (TIER 3)
- **What:** Same algorithms but restricted to node subsets
- **When useful:** Similarity within a category ("similar Organizations") or within a collection

---

### 3B. LINK PREDICTION — "What connections are missing?"

Link prediction functions estimate the likelihood of missing edges. No graph projection needed — callable directly in Cypher.

#### Adamic Adar (TIER 3)
- **What:** Scores missing links by shared neighbors, weighting rare shared neighbors higher
- **Product use:** "Suggested Connections" — for any two unconnected entities, Adamic Adar scores how likely they SHOULD be connected

```cypher
-- Score all unconnected pairs in same project
MATCH (a:Entity)-[:MENTIONED_IN]->(p:Project {uniqueId: $uid}),
      (b:Entity)-[:MENTIONED_IN]->(p)
WHERE a <> b AND NOT (a)-[:RELATES_TO]-(b) AND id(a) < id(b)
RETURN a.name, b.name,
       gds.alpha.linkprediction.adamicAdar(a, b) AS score
ORDER BY score DESC LIMIT 20
```

#### Resource Allocation (TIER 3)
- **What:** Like Adamic Adar but stronger penalty for high-degree intermediaries
- **Product use:** Same — "Suggested Connections" with different weighting

#### Similarity Functions (available now, no GDS projection needed)

```cypher
-- Compare two entities' embeddings directly
MATCH (a:Entity {name: $nameA}), (b:Entity {name: $nameB})
RETURN gds.similarity.cosine(a.embedding, b.embedding) AS cosineSimilarity
```

---

### 4. PATH FINDING — "How do things connect?"

Path finding algorithms find routes between nodes.

#### Shortest Path — NOT NEEDED (use native Cypher)

```cypher
-- Native Cypher is sufficient:
MATCH path = shortestPath(
  (a:Entity {name: $entityA})-[:RELATES_TO*..6]-(b:Entity {name: $entityB})
)
RETURN [n IN nodes(path) | n.name] AS entities
```

GDS shortest path algorithms (Dijkstra, A*, Yen's K-Shortest) add value only when edges have weights (cost, distance). Our RELATES_TO edges don't have numeric weights, so native Cypher is the right tool.

#### All Shortest Paths — NOT NEEDED
- Same reasoning. Use native Cypher `allShortestPaths()`.

#### Spanning Tree — NOT RELEVANT
- For geographic/network optimization. Not applicable to knowledge graphs.

---

### 5. NODE EMBEDDING — "Represent structure as vectors"

Node embedding algorithms create vector representations of graph structure (different from our BERT text embeddings).

#### FastRP (Fast Random Projection) (MAYBE)
- **What:** Creates embedding vectors based on graph structure (who connects to whom)
- **Would store:** `entity.graphEmbedding` (float array, configurable dimensions)
- **Difference from BERT:** BERT embeddings capture text semantics. FastRP captures structural position in the graph. An entity could be semantically different but structurally similar.
- **Product use:** Combine with BERT embeddings for hybrid recommendations
- **When to add:** If Node Similarity doesn't capture enough structural nuance
- **Complexity:** Very fast, O(n*k*d) where k=iterations, d=dimensions

```cypher
CALL gds.fastRP.write('memorytonic-graph', {
  writeProperty: 'graphEmbedding',
  embeddingDimension: 64,
  iterationWeights: [0.0, 1.0, 1.0]
})
```

#### Node2Vec (MAYBE)
- **What:** Creates embeddings via biased random walks (similar to Word2Vec but for graphs)
- **Better than FastRP:** Captures both local structure and global position
- **Slower than FastRP:** Random walks are expensive
- **When to add:** Only if FastRP is insufficient

#### GraphSAGE — NOT NEEDED
- **Why:** Requires training data (supervised). We don't have labeled entity classifications beyond our fixed categories.

#### HashGNN — NOT NEEDED
- **Why:** Designed for Graph Neural Network feature extraction. Overkill for our use case.

---

### 6. TOPOLOGICAL OPERATIONS

#### Topological Sort — NOT RELEVANT
- For DAGs (directed acyclic graphs). Our graph has cycles.

---

## Implementation Priority

### Tier 1: Active Now (in gds.py)
1. PageRank → `entity.pageRank`
2. Betweenness → `entity.betweenness`
3. Degree → `entity.degree`
4. Node Similarity → `SIMILAR_TO` relationships

### Tier 2: Implement Next (High Value — Gap Detection + Better Similarity)
5. Articulation Points → `entity.isArticulationPoint` (knowledge single-points-of-failure)
6. WCC → `entity.componentId` (disconnected knowledge islands)
7. Triangle Count → `entity.triangleCount` (evidence corroboration density)
8. Local Clustering Coefficient → `entity.clusteringCoefficient` (knowledge completeness)
9. K-Core → `entity.coreness` (knowledge density vs. periphery)
10. KNN on embeddings → rewrites `SIMILAR_TO` (semantic similarity, better than topology)
11. Closeness Centrality → `entity.closeness` (most accessible entities for exploration)

### Tier 3: Future Consideration
12. Leiden → community detection (same family as Louvain — user caution)
13. Label Propagation → `entity.community` (when graph > 500 entities)
14. HDBSCAN → `entity.embeddingCluster` (density clustering on embeddings)
15. SLLPA → `entity.overlappingCommunities` (multi-topic membership)
16. Influence Maximization → on-demand seed selection for AI agent exploration
17. FastRP → `entity.graphEmbedding` (structural similarity to complement BERT)
18. Article Rank → `entity.articleRank` (PageRank variant, less hub bias)
19. Adamic Adar / Resource Allocation → link prediction (suggested connections)
20. Yen's K-Shortest Paths → multiple explanation paths between entities

### Permanently Excluded
- Louvain (community detection — user bad experience. NEVER USE.)
- GDS shortest path (native Cypher `shortestPath()` sufficient)
- GraphSAGE, HashGNN (require training data we don't have)
- A*, Spanning Tree, Bellman-Ford, Max Flow (network/geographic, not knowledge graphs)
- K-1 Coloring (visualization partitioning, not semantically meaningful)

---

## Adding New Algorithms to gds.py

To add a new algorithm:

1. Add a function in `gds.py` following the existing pattern:

```python
def run_closeness():
    """Run Closeness Centrality."""
    print("\n[CLOSENESS CENTRALITY]")
    result = run_cypher(
        "CALL gds.closeness.write($name, {writeProperty: 'closeness'})",
        {"name": PROJECTION}
    )
    if not result["ok"]:
        print(f"  ERROR: {result['errors']}")
        return False
    # ... print stats
    return True
```

2. Add CLI flag in `main()`:
```python
if run_all or "--closeness" in args:
    run_closeness()
```

3. Add to `show_status()` query
4. Update this skill file and gds-skill.md
5. Update contracts (graph-studio-contract.md, mcp-contract.md)

---

## Performance Budget

### Tier 1 (Active)

| Algorithm | 245 nodes | 1,000 nodes | 10,000 nodes | 50,000 nodes |
|-----------|-----------|-------------|--------------|--------------|
| PageRank | <1s | ~1s | ~5s | ~30s |
| Betweenness | <1s | ~2s | ~60s | AVOID |
| Degree | <1s | <1s | <1s | ~2s |
| Node Similarity | <1s | ~2s | ~10s | ~60s |

### Tier 2 (Implement Next)

| Algorithm | 245 nodes | 1,000 nodes | 10,000 nodes | 50,000 nodes |
|-----------|-----------|-------------|--------------|--------------|
| Articulation Points | <1s | <1s | ~2s | ~10s |
| WCC | <1s | <1s | <1s | <1s |
| Triangle Count | <1s | <1s | ~5s | ~30s |
| Local Clustering Coeff. | <1s | <1s | ~5s | ~30s |
| K-Core | <1s | <1s | ~2s | ~10s |
| KNN (on embeddings) | <1s | ~2s | ~15s | ~90s |
| Closeness | <1s | ~2s | ~60s | AVOID |

### Tier 3 (Future)

| Algorithm | 245 nodes | 1,000 nodes | 10,000 nodes | 50,000 nodes |
|-----------|-----------|-------------|--------------|--------------|
| Label Propagation | <1s | <1s | ~3s | ~15s |
| FastRP | <1s | <1s | ~2s | ~10s |
| HDBSCAN | <1s | ~2s | ~10s | ~60s |

**Critical thresholds:**
- At 10,000+ nodes: Betweenness, Closeness, and KNN become expensive. Consider sampling.
- At 50,000+ nodes: Only PageRank, Degree, WCC, K-Core, and FastRP are safe to run on every upload.
- Triangle Count and Local Clustering Coefficient scale together (same underlying computation).
