# Nitanics Agent Guide

Use this file as the starting context when working with AI coding agents.

## Current Product Scope

Nitanics is an open-source local web workspace for knowledge graphs.

Active scope:

- `apps/web/frontend`
- `apps/web/modules/graph-studio`
- `apps/ingestion-pipeline`
- `apps/api`
- `apps/mcp` as an optional integration

Out of scope for this repository phase:

- Electron desktop packaging
- hosted SaaS infrastructure
- billing
- multi-tenant authentication

## Core Principle

Do not replace existing graph data when adding new projects. New documents should create additional projects, entities, relationships, and bridge links while preserving previous collections.

## Local Run Flow

```bash
bun install
bun run neo4j:ensure
bun run dev
```

Open `http://127.0.0.1:5174`.

## Ingestion Flow

Read these files before creating or modifying graph artifacts:

- `docs/ARCHITECTURE.md`
- `docs/INGESTION_FOR_AGENTS.md`
- `apps/ingestion-pipeline/skills/extraction-agent.md`
- `apps/ingestion-pipeline/skills/extraction-skill.md`

The pipeline produces:

```text
01_html.html
02_placement.json
03_nlp_entities.json
04_all_entities.json
05_embeddings.json
06_extraction.json
```

Validate before upload:

```bash
cd apps/ingestion-pipeline
python neo4j/validate_project.py data/extracted/<project-slug>
python neo4j/upload.py data/extracted/<project-slug>
```

## Development Rules

- Keep the public web app cloneable and easy to run.
- Keep docs current with the open-source web scope.
- Do not reintroduce Electron scripts or desktop-only UI.
- Treat MCP as optional, not required for the web app.
- Prefer small focused changes over broad rewrites.
- Preserve sample graph data unless explicitly asked to remove it.

## Verification

For web changes:

```bash
bun run build
```

For optional MCP changes:

```bash
bun run build:mcp
```

For ingestion changes:

```bash
cd apps/ingestion-pipeline
python neo4j/bootstrap.py --status
```
