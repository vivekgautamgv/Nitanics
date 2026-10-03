# Agent Instructions

Nitanics is currently a local web knowledge graph workspace. Keep the repository focused on the web app, Graph Studio, ingestion pipeline, local API, and optional MCP server.

Read these first:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/INGESTION_FOR_AGENTS.md`
- `CLAUDE.md`

Do not reintroduce Electron desktop packaging in this public version.

When adding graph data:

- Read complete chat attachments or local source files; report sources you cannot access.
- Save each complete source and its six artifacts in a new unique project under `graphs/`.
- Preserve existing collections, projects, legacy artifacts, and reproducible sample data.
- Use source-supported facts, actual local NLP output, and actual model embeddings; never invent density quotas.
- Validate artifacts before uploading with `uv run python neo4j/upload.py <project-dir> --create-only` from `apps/ingestion-pipeline`.
- Never use destructive schema cleanup for ingestion; report upload failures and inspect partial state before retrying.

See `docs/INGESTION_FOR_AGENTS.md` for the full clone-and-chat workflow and exact commands.

Verification:

```bash
bun run build
bun run build:mcp
```

For ingestion code changes, run the relevant Python unit tests with `uv run python -m unittest discover -s tests` from `apps/ingestion-pipeline`.
