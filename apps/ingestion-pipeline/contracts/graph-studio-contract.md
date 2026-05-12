# Interface Contract: Ingestion → Graph Studio

**Component 01 provides to Component 02:**

## Neo4j Schema (Graph Studio reads from Neo4j)

### Nodes Available
- `(:Entity)` — entityId, name, category, definition, role, aliases[], aliases_text, firstAppearanceIndex, projectCount, embedding[384]
- `(:Project)` — projectId, name, uniqueId, summary, narrativeFlow[], domain, subdomain, baseTags[], htmlPath, directory, embedding[384]
- `(:Collection)` — collectionId, name
- `(:DirectoryCategory)` — name, description
- `(:DateTime)` — datetimeId, date, time, year, month, day, type (date|time)
- `(:TemporalEvent)` — eventId, projectId, phaseIndex, label, period
- `(:CausalChain)` — chainId, name, description, linkCount, projectId

### Relationships Available
- `(:Entity)-[:MENTIONED_IN {role}]->(:Project)`
- `(:Entity)-[:RELATES_TO {relType, causalClassification, description, evidence, evidenceStrength, magnitude, year}]->(:Entity)`
- `(:Entity)-[:FIRST_APPEARS_IN]->(:TemporalEvent)`
- `(:Entity)-[:CHAIN_LINK {chainId, orderIndex, explanation}]->(:Entity)`
- `(:Project)-[:BELONGS_TO]->(:Collection)`
- `(:Project)-[:IN_DIRECTORY]->(:DirectoryCategory)`
- `(:Project)-[:CREATED_ON]->(:DateTime {type: 'date'})`
- `(:Project)-[:CREATED_AT]->(:DateTime {type: 'time'})`
- `(:DateTime {type: 'time'})-[:ON_DATE]->(:DateTime {type: 'date'})`
- `(:TemporalEvent)-[:BELONGS_TO_PROJECT]->(:Project)`
- `(:CausalChain)-[:BELONGS_TO_PROJECT]->(:Project)`

### Computed Properties (Post-GDS)
- `entity.pageRank` — importance score (GDS PageRank)
- `entity.betweenness` — structural importance / bridge detection (GDS Betweenness)
- `entity.degree` — connection count (GDS Degree)
- `entity.projectCount` — number of projects mentioning this entity (upload.py)

### Computed Relationships (Post-GDS)
- `(:Entity)-[:SIMILAR_TO {similarity: float}]->(:Entity)` — structurally similar entities (GDS Node Similarity, cutoff 0.3, top 5 per entity)

### Queries Graph Studio Needs
- `getCollectionGraph(collectionId)` → all nodes + edges for visualization
- `getEntityDetails(entityId)` → definition, role per project, relationships, causal chains
- `getProjectEntities(projectId)` → all entities in a project
- `getProjectCausalChains(projectId)` → causal chains with ordered links
- `findPaths(entityA, entityB, maxDepth)` → paths between entities
- `getBridgeEntities(collectionId)` → tiered bridge entities (projectCount >= 2)

## Export/Import Capability

Component 01 provides portable collection export/import:

- **Export** (`neo4j/export_collection.py`): Exports a collection as a self-contained ZIP containing `graph.json` (flat knowledge graph with all entities, relationships, chains, bridges, similar pairs), per-project HTML source documents, extraction JSONs, and optionally embeddings.
- **Import** (`neo4j/import_collection.py`): Imports a collection ZIP via 6-phase pipeline (preflight, conflicts, reconstruct artifacts, validate+upload, GDS recomputation, verification). Handles cross-project entity resolution and alias matching.

Graph Studio may want to expose:
- **Export UI**: Allow users to export a collection from the graph view (triggers `export_collection.py` or `memorytonic_export` MCP tool)
- **Import UI**: Allow users to import a collection ZIP (triggers `import_collection.py` or `memorytonic_import` MCP tool)
- **graph.json viewer**: The flat graph.json is agent-readable and could power an offline/static graph view

## Contract Rules
- Do NOT modify this contract without updating Component 01.
- If Graph Studio needs a query that doesn't exist, request it here first.
