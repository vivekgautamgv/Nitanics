# Agent Instructions

Nitanics is currently a local web knowledge graph workspace. Keep the repository focused on the web app, Graph Studio, ingestion pipeline, and optional MCP server.

Read these first:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/INGESTION_FOR_AGENTS.md`
- `CLAUDE.md`

Do not reintroduce Electron desktop     packaging in this public version.

When adding graph data:

- preserve existing collections
- add new projects rather than replacing old ones
- validate extraction artifacts before upload
- keep sample data reproducible

Verification:

```bash
bun run build
bun run build:mcp
```
