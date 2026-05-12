# Interface Contract: Ingestion → MCP

**Component 01 provides to Component 04:**

## Skills That Become MCP Tools

| Skill File | MCP Tool Name | Purpose |
|------------|---------------|---------|
| `skills/extraction-skill.md` | `memorytonic_extraction_guide` | Returns extraction protocol (quality bar, format) |
| `skills/extraction-agent.md` | `memorytonic_extract` | Orchestrates 4-stage extraction pipeline |

## Neo4j Queries That MCP Tools Will Use

All queries from `neo4j/queries.ts` are available to MCP tools.
MCP tools wrap queries with input validation + response formatting.

## Pipeline Functions That MCP Tools Will Call

- `ingestExtraction(payload)` — full pipeline, atomic
- `nlpPreprocess(text)` — Stage 1 only
- `generateEmbeddings(entities, projects)` — BERT 384d
- `recomputeGDS()` — PageRank + Betweenness + Degree + Node Similarity
- `deleteProject(uniqueId)` — cascade deletion (Neo4j + filesystem)
- `exportCollection(collectionName)` — portable ZIP with graph.json + HTMLs + embeddings
- `importCollection(zipPath)` — 6-phase pipeline: preflight, conflicts, reconstruct, upload, GDS, verify

## Shared Database Client

All scripts import from `neo4j/db.py` (not duplicated):
- `run_cypher(statement, params)` — single Cypher statement
- `run_batch([(stmt, params), ...])` — N statements in one HTTP call
- `check_connection()` — verify Neo4j reachable, exit(1) if not

## Scripts Available

| Script | MCP Tool | Purpose |
|--------|----------|---------|
| `neo4j/upload.py` | `memorytonic_extract` | Upload extraction artifacts |
| `neo4j/gds.py` | `memorytonic_recompute` | Run all GDS algorithms |
| `neo4j/delete_project.py` | `memorytonic_delete_project` (future) | Cascade delete |
| `neo4j/validate_project.py` | pre-upload gate | Validate before upload |
| `neo4j/bootstrap.py` | `memorytonic_bootstrap` | Schema setup |
| `neo4j/export_collection.py` | `memorytonic_export` | Export collection as portable ZIP |
| `neo4j/import_collection.py` | `memorytonic_import` | Import collection from ZIP |
| `nlp/preprocess.py` | `memorytonic_nlp_preprocess` | NLP entity extraction |
| `nlp/embed.py` | embedding step | BERT 384d vectors |

## Contract Rules
- MCP tool input schemas must match the extraction format defined in extraction-skill.md.
- If MCP needs additional queries, request them here.
