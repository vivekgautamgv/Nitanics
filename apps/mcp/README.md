# Optional MCP server

The server exposes 30 tools over **stdio** for local MCP-capable clients. It can query the graph, upload structured document extractions, capture conversations, manage collections, and run graph maintenance. The web app works without MCP.

From the repository root:

```bash
bun run build:mcp
bun run start:mcp
```

`bun run dev:mcp` compiles and runs the server. `bun run --cwd apps/mcp watch` only watches TypeScript changes. Start Neo4j separately with `bun run neo4j:ensure` if it is not running.

A local AI client should launch the compiled entry point directly:

```json
{
  "mcpServers": {
    "nitanics": {
      "command": "node",
      "args": ["D:/nitanics/apps/mcp/dist/index.js"],
      "env": {
        "NEO4J_URI": "neo4j://127.0.0.1:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "YOUR_LOCAL_NEO4J_PASSWORD",
        "NEO4J_DATABASE": "memorytonic"
      }
    }
  }
}
```

Replace the absolute path and credentials with your local setup. Default pipeline and skill paths are resolved from the MCP package, independently of the client's working directory. `C01_DIR` and `SKILLS_DIR` can override them with absolute paths. Configuration priority is environment variables, `~/.memorytonic/config.json`, then defaults.

Query tools include `memorytonic_search`, `memorytonic_recall`, `memorytonic_explore`, `memorytonic_find_paths`, `memorytonic_explain`, `memorytonic_get_entity`, `memorytonic_get_project`, and read-only `memorytonic_query`. Use `memorytonic_health` and `memorytonic_stats` to inspect the connection first. Collection, extraction, and admin tools include write operations; use new project IDs and preserve existing collections.

`memorytonic_extract` accepts **already extracted structured data**, HTML, and optional `source_text`. The chat client's model reads the document and constructs entities, relationships, causal chains, summary, and placement. Passing the original text enables exact evidence quote validation. Unsupported relationships, chains, and temporal phases should be empty arrays. Definitions and summaries have no word or character quotas. Embeddings are generated locally and must succeed before upload. Existing project IDs are rejected with `--create-only`.

This legacy MCP pipeline stores staging files under `apps/ingestion-pipeline/data/temp/<slug>` and permanent artifacts under `data/sources/<date>/<slug>`. It validates with `--import-mode`, which permits omission of `03_nlp_entities.json`; the separate `memorytonic_nlp_preprocess` tool returns candidates to the client. `source_text`, when supplied, is also saved as `source.md`. Call `memorytonic_recompute({})` after a successful upload, then refresh the web app or return focus to it.

For reproducible repository ingestion with all six artifacts under `graphs/<collection>/<project>/`, follow [Ingestion for AI Agents](../../docs/INGESTION_FOR_AGENTS.md). A coding agent with workspace access can save a chat attachment as `source.md` and run that workflow directly, without MCP or a second provider API key.

There is no binary attachment upload tool or HTTP MCP transport. The client must provide readable document text, including text extracted from PDFs. A hosted chat client needs a separately configured reachable MCP bridge or transport; running this local stdio process alone does not expose it remotely.

Run the extraction safety tests with `bun test apps/mcp/src/tools/extraction.test.mjs` from the repository root. These use temporary fixtures and mocked tools; they do not upload graph data.
