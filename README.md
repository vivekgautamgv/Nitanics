# Nitanics

Open-source local knowledge graph workspace. Bring your documents, use your AI agent to extract structured graph data, explore it in an interactive graph UI backed by Neo4j.

## What It Does

- Organizes knowledge into collections, projects, entities, relationships, and causal chains
- Lets you explore your graph in collection, project, and bridge views
- Stores durable graph memory in Neo4j instead of repeatedly re-reading raw documents
- Works with any AI coding agent — Claude, Codex, Cursor, Antigravity, Windsurf, or any MCP-compatible tool

## Features at a Glance

- **Interactive Graph Studio:** Explore your documents as force-directed node graphs.
- **Path Finder:** Find direct and hidden connections between different entities across your graph.
- **Bridge View:** Automatically discover bridge entities that span across multiple separate documents or projects.
- **Entity Inspector:** Click on any node to get rich information at your fingertips, including definitions, relationships, and causal chains.
- **AI Agent Integration:** Use your favorite LLM or AI coding agent to easily expand your graph database. The ingestion pipeline does the heavy lifting.
- **Portable Exports:** Graph data can be exported as portable JSON collections. Use these exports to share your knowledge bases with others or easily seed a new Neo4j database on another machine. 
- **MCP Server Support:** Native Model Context Protocol support allows AI agents to directly query your graph data for context.
- **Local-first with Docker:** Runs entirely on your machine via Docker; no cloud dependencies, no data leaves your laptop. 

## View

![Main Screen](docs/assets/Main%20Screen.png)

![Main Info Dashboard](docs/assets/Main%20Info%20dashboard.png)

![Dashboard View - Graph](docs/assets/Dashboard%20View%20-%20Graph.png)

![Graph View - Side bar details](docs/assets/Graph%20View%20-%20Side%20bar%20details.png)

## How It Works

```
You add a document → AI agent extracts the graph → Neo4j stores it → Web app visualizes it
```

1. Drop your source document into `graphs/<collection>/<project>/source.md`
2. Ask your AI agent to run the extraction (see `docs/INGESTION_FOR_AGENTS.md`)
3. The agent generates 6 structured JSON artifacts and uploads them to Neo4j
4. Open the web app — your graph is live in Graph Studio

## Repository Structure

```
nitanics/
├── graphs/                         ← YOUR GRAPH WORKSPACE (start here)
│   └── <collection>/
│       └── <project>/
│           ├── source.md           ← your document (you add this)
│           ├── 01_html.html        ← agent generates
│           ├── 02_placement.json   ← agent generates
│           ├── 03_nlp_entities.json
│           ├── 04_all_entities.json
│           ├── 05_embeddings.json
│           └── 06_extraction.json  ← uploaded to Neo4j
│
├── apps/
│   ├── web/
│   │   ├── frontend/               ← Main React web app
│   │   └── modules/graph-studio/   ← Force-directed graph visualization
│   ├── ingestion-pipeline/         ← Upload + validation scripts (Python)
│   ├── mcp/                        ← Optional MCP server for AI clients
│   └── exports/                    ← Portable sample collection exports
│
├── docs/
│   ├── OPEN_SOURCE_GUIDE.md        ← Full setup guide (start here)
│   ├── ARCHITECTURE.md             ← System architecture and graph model
│   └── INGESTION_FOR_AGENTS.md     ← How AI agents should create graphs
│
└── scripts/
    ├── ensure-neo4j.mjs            ← Neo4j Docker bootstrap
    └── import-collection-export.mjs ← Import a portable export
```

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Bun | 1.3+ | Package manager and task runner |
| Node.js | 20+ | Runtime |
| Python | 3.10+ | Ingestion pipeline |
| uv | latest | Python dependency manager |
| Docker Desktop | latest | Runs Neo4j locally |

## Quick Start

```bash
git clone https://github.com/vivekgautamgv/nitanics.git
cd nitanics
bun install
bun run neo4j:ensure   # starts Neo4j via Docker
bun run dev            # starts the web app
```

Open `http://127.0.0.1:5174`

**Seed sample data** (so you have something to explore immediately):

```bash
node scripts/import-collection-export.mjs apps/exports/global-finance-systems-export
```

## Creating Your Own Knowledge Graph

1. Create a folder: `graphs/<your-collection>/<your-project>/`
2. Add your source document as `source.md` inside it
3. Open this repo in your AI agent and run:

```
Read docs/INGESTION_FOR_AGENTS.md.
Process: graphs/<your-collection>/<your-project>/source.md
Generate all artifacts in the same folder. Upload to Neo4j.
```

4. Refresh the app — your graph is live.

See `graphs/README.md` for the full folder convention and `docs/INGESTION_FOR_AGENTS.md` for the agent prompt.



## Core Commands

```bash
bun run dev              # Start frontend + graph studio
bun run build            # Production build
bun run neo4j:ensure     # Start or verify local Neo4j
bun run dev:mcp          # Start optional MCP server for AI clients
bun run build:mcp        # Build MCP bundle
```

## Documentation

| File | Purpose |
|------|---------|
| `docs/OPEN_SOURCE_GUIDE.md` | Full setup: clone, install, Neo4j, seed, run |
| `docs/ARCHITECTURE.md` | System architecture and graph model |
| `docs/INGESTION_FOR_AGENTS.md` | How AI agents create graph projects |
| `graphs/README.md` | Graph workspace folder convention |
| `apps/ingestion-pipeline/README.md` | Pipeline internals |

## What Is Out Of Scope

- Electron desktop packaging
- Hosted multi-tenant SaaS
- Managed cloud ingestion
- Production authentication and billing

## Team Members
- [Vivek Gautam](https://www.linkedin.com/in/vivek-gautam-670017225/)
- [Ajay Pawar](https://www.linkedin.com/in/ajay-pawar-data-detective/)
- [Vipin Bhati](https://www.linkedin.com/in/vipin-bhati-6a18781b7/)

## License

MIT — see `LICENSE`.
