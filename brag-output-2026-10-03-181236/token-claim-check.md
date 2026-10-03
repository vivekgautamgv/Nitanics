# Token reuse claim — checked against this repository

The supported wording is: **After ingestion, retrieving relevant graph context can reduce repeated document reading and input-token use. Initial extraction still uses tokens; savings depend on the workload.**

The README makes the same conditional claim. Source text and artifacts are preserved, while Neo4j stores extracted entities, relationships, document roles, and project summaries. The MCP entity and query tools let an AI client reuse that stored knowledge. Reading only a relevant subset can use less input context than sending entire source documents again for every question.

Checked code:

- `apps/mcp/src/neo4j/queries.ts`: `getEntity` reads an entity profile; `graphRAGRecall` is designed to retrieve related entities, connections, chains, and project summaries.
- `apps/mcp/src/tools/entity-project.ts`: `memorytonic_get_entity` exposes the entity profile as a read-only tool.
- `apps/mcp/src/tools/query.ts`: `memorytonic_query` supports read-only Cypher projections, and recall/search expose retrieval controls.
- `docs/ARCHITECTURE.md` and `docs/INGESTION_FOR_AGENTS.md`: both ingestion routes persist extracted knowledge to the same database.

Live checks, without database writes:

- The Federal Reserve entity lookup passed and returned the entity, project roles, relationships, chain links, and similar entities.
- A focused read-only query returned the Federal Reserve's roles in three Global Finance Systems source documents, with entity/category/source/role fields and no complete raw sources. Results are saved under `work/verified-focused-context.json`.
- The broader `graphRAGRecall` call failed: Neo4j rejected the JavaScript numeric `LIMIT` parameter as a floating-point value (`5.0`). Source code was preserved. That path needs a separate integer-parameter fix; this video does not represent it as a successful live recall demo.

Limits of the claim:

- This is workflow-level reuse, not automatic prompt compression or a guaranteed token budget.
- Initial semantic extraction reads the sources and uses model tokens. Later AI answers still consume input and output tokens.
- Local PDF/text parsing itself is not an LLM-token expense. The saving opportunity is avoiding repeated transmission/reading of full documents by the model.
- Large entity profiles and broad queries can return substantial context, including embeddings or descriptions. Use focused projections and appropriate retrieval scope.
- Graph retrieval does not replace source verification. Open original documents when the question requires details absent from the graph.
- No comparative token benchmark, percentage saving, cost estimate, or provider billing result was measured. The video contains no numerical savings claim.

No source code, credentials, graph data, or running services were changed by these checks.
