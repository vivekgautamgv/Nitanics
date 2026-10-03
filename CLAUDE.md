# Nitanics Agent Guide

Nitanics is an open-source local web workspace for knowledge graphs. The web UI supports document uploads with an extraction API key. Users can also clone this repository, attach complete documents to a local coding agent's chat, and ask that agent to generate graphs with its own model and local NLP tools. Both routes feed the same Neo4j database and Graph Studio.

## Product scope

Keep development focused on `apps/web/frontend`, `apps/web/modules/graph-studio`, `apps/ingestion-pipeline`, `apps/api`, and the optional `apps/mcp` server. Do not reintroduce Electron packaging. Hosted SaaS infrastructure, billing, and multi-tenant authentication are outside the current scope.

## Local setup

```bash
bun install
bun run nlp:setup
bun run neo4j:ensure
bun run dev
```

Open the web UI URL printed by the development server (`http://127.0.0.1:5174` by default); use the actual configured host and port. Docker runs Neo4j. The agent route requires local file access, command execution, and access to the configured database; a remote chat needs connected tools. No separate extraction API key is required when the agent uses its own model.

## Document ingestion

Read these before working on graph artifacts:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/INGESTION_FOR_AGENTS.md`
- `apps/ingestion-pipeline/skills/extraction-agent.md`
- `apps/ingestion-pipeline/skills/extraction-skill.md`

Read every attached or local document completely. If an attachment is inaccessible, use a saved local file; report unreadable/scanned documents that need OCR. Create one new unique project per document under `graphs/<collection>/<unique-project>/`. Keep a complete `source.md` and all six artifacts in that folder. Preserve all earlier collections, projects, legacy `data/` artifacts, and reproducible samples.

Use actual local NLP output and actual model embeddings. Extract only source-supported facts and exact relationship evidence. Graph size follows the document; relationships, phases, narrative flow, and causal chains may be empty. Do not invent entities or claims to meet a density quota.

From `apps/ingestion-pipeline`, validate and upload:

```bash
uv run python neo4j/bootstrap.py --status
uv run python neo4j/bootstrap.py
uv run python neo4j/validate_project.py --human ../../graphs/<collection>/<unique-project>
uv run python neo4j/upload.py ../../graphs/<collection>/<unique-project> --create-only
```

After successful batch uploads, run `uv run python neo4j/gds.py` to refresh metrics and similarity links. Report metric failures separately from completed uploads.

Never use `bootstrap.py --clean` for ingestion. If an upload fails, report the failed stage and inspect partial state before retrying. Preserve canonical artifacts in `graphs/`; the source HTML path is served from there. After a successful upload, refresh the UI or return to it, then inspect the target collection's Documents, Graph, and Bridges.

## Development and verification

Keep the public web app cloneable, setup instructions current, and MCP optional. Prefer focused changes and preserve user work.

```bash
bun run build
bun run build:mcp
```

For ingestion code changes, run the relevant Python unit tests from `apps/ingestion-pipeline`:

```bash
uv run python -m unittest discover -s tests
```
