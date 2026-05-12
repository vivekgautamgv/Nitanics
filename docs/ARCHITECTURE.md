# Architecture

Nitanics converts document-heavy knowledge into a Neo4j graph that can be explored by humans and reused by AI systems.

## Layers

```text
Documents
  -> ingestion pipeline
  -> NLP candidate extraction
  -> LLM-assisted semantic extraction
  -> validation gate
  -> Neo4j graph
  -> web frontend and graph studio
```

## Main Apps

`apps/web/frontend`

The primary browser UI. It lists directories and collections, opens project/entity pages, and embeds the graph workspace.

`apps/web/modules/graph-studio`

The graph visualization module. It supports collection graph, project graph, and bridge view.

`apps/ingestion-pipeline`

The Python pipeline. It owns source documents, extraction artifacts, validation, embeddings, upload, import, and export.

`apps/mcp`

Optional MCP server. It is kept as an integration path for AI clients, but the web app does not depend on it.

`apps/api`

Lightweight backend gateway placeholder for future hosted or service-backed deployments.

## Graph Model

Nitanics stores knowledge around these concepts:

- Directory: top-level workspace grouping
- Collection: thematic graph space
- Project: one source document, report, video, paper, or imported unit
- Entity: person, company, concept, place, technology, metric, event, or resource
- Relationship: semantic connection between entities
- Causal chain: ordered cause/effect reasoning path
- Bridge entity: entity shared across multiple projects

## Graph Views

Collection Graph

Shows all projects and connected entities in a collection.

Project Graph

Isolates one source project and its connected entities.

Bridge View

Highlights cross-project entities that connect sources together.

## Why NLP And LLM Both Exist

The NLP layer is deterministic grounding. It creates candidates through NER, keywords, and co-occurrence.

The LLM layer is semantic reasoning. It turns candidates and raw source text into entities, definitions, relationships, causal chains, and project summaries.

The validation layer is the quality gate. It keeps generated artifacts aligned with the graph schema before upload.

## Data Locations

```text
apps/ingestion-pipeline/data/projects/    Raw project source text
apps/ingestion-pipeline/data/sources/     HTML source documents served in the UI
apps/ingestion-pipeline/data/extracted/   Permanent extraction artifacts
apps/ingestion-pipeline/data/temp/        Working extraction area
apps/exports/                             Portable collection exports
```
