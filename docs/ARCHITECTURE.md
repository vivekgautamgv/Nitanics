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

## Two Ingestion Routes

The browser's **Add documents → Upload with API** route accepts complete Markdown, text, and text-based PDF documents. The local API runs provider-assisted extraction, NLP, embeddings, validation, and Neo4j upload, with progress reported to the browser.

The **Use AI agent** route provides a prompt for an agent running against the cloned repository. Documents can be attached in that agent's chat or referenced by local path. The agent must be able to read the complete files, write artifacts, execute the pipeline tools, and connect to the configured Neo4j database. Its own model performs semantic extraction; local tools produce NLP candidates and embeddings. This route does not require a separate extraction provider API key.

Both routes preserve new source text and artifacts under `graphs/<collection>/<unique-project>/`, validate before upload, and feed the same database. The web UI reads that database directly, so agent uploads are visible after refresh or when the user returns to the app. A remote chat needs a connected tool environment to write to a local workspace; attaching a document to an unconnected chat does not perform an upload.

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

Local backend for document uploads, extraction jobs, progress status, and portable collection exports. It validates upload limits and filenames, preserves job identity for reconnecting clients, and runs the ingestion pipeline. The API binds to loopback; the web app and Neo4j remain local.

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
graphs/<collection>/<project>/           New source text and extraction artifacts
apps/ingestion-pipeline/data/projects/    Raw project source text
apps/ingestion-pipeline/data/sources/     HTML source documents served in the UI
apps/ingestion-pipeline/data/extracted/   Permanent extraction artifacts
apps/ingestion-pipeline/data/temp/        Working extraction area
apps/exports/                             Portable collection exports
```
