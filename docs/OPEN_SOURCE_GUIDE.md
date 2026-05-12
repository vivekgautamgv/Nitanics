# Open Source Guide

Complete setup instructions for running Nitanics locally from a fresh clone.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 20+ | Runtime for frontend and scripts |
| **Bun** | 1.3+ | Package manager and monorepo task runner |
| **Python** | 3.10+ | Ingestion pipeline |
| **uv** | latest | Python dependency manager ([install](https://docs.astral.sh/uv/getting-started/installation/)) |
| **Docker Desktop** | latest | Runs Neo4j database locally |

> **No Docker?** You can connect to any existing Neo4j 5.x instance instead - see [Manual Neo4j Setup](#manual-neo4j-setup).

---

## Step 1 - Clone and Install

```bash
git clone https://github.com/vivekgautamgv/nitanics.git
cd nitanics
bun install
```

`bun install` handles all JavaScript dependencies across the monorepo. The `postinstall` script also runs `uv sync` inside `apps/ingestion-pipeline` to set up the Python environment.

If `uv` is not installed yet:

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

---

## Step 2 - Start Neo4j

### Option A - Docker (Recommended)

Make sure Docker Desktop is running, then:

```bash
bun run neo4j:ensure
```

This script will:
1. Pull the `neo4j:5.26.0-community` image (first time only)
2. Create a container named `nitanics-neo4j`
3. Configure it with the default credentials
4. Write `.env` files for all apps automatically

Default credentials:

```
URI:      neo4j://127.0.0.1:7687
HTTP:     http://127.0.0.1:7474
User:     neo4j
Password: 12345678
Database: memorytonic
```

### Option B - Manual Neo4j Setup

If you have Neo4j Desktop, Aura, or a remote server:

1. Copy `.env.example` to `.env` in each app directory:

```bash
# Required
cp .env.example apps/web/frontend/.env
cp .env.example apps/web/modules/graph-studio/.env
cp .env.example apps/mcp/.env

# Optional (only if using the API gateway)
cp .env.example apps/api/.env
```

2. Edit each `.env` file with your Neo4j credentials:

```
VITE_NEO4J_URI=bolt://your-server:7687
VITE_NEO4J_USER=neo4j
VITE_NEO4J_PASSWORD=your-password
VITE_NEO4J_DATABASE=memorytonic
```

---

## Step 3 - Seed Sample Data

A fresh Neo4j database is empty. The repo includes portable collection exports you can import:

```bash
node scripts/import-collection-export.mjs apps/exports/global-finance-systems-export
```

This imports a complete collection with entities, relationships, bridge entities, and causal chains so you have real material to explore immediately.

---

## Step 4 - Run the App

```bash
bun run dev
```

This starts both the frontend and graph studio dev servers:

| App | URL |
|-----|-----|
| **Frontend** (main app) | http://127.0.0.1:5174 |
| **Graph Studio** (standalone) | http://127.0.0.1:5173 |

The frontend embeds Graph Studio, so most users only need `http://127.0.0.1:5174`.

### Individual services

```bash
bun run dev:frontend     # Frontend only
bun run dev:graph        # Graph Studio only
bun run dev:mcp          # MCP server (optional, for AI clients)
```

---

## Step 5 - Create Your Own Knowledge Graph

This is the core workflow. You bring a document, your AI agent extracts the graph, and it appears live in Graph Studio.

### 5a. Create your project folder

All graph data lives in the `graphs/` folder at the root of the repo. Create a folder for your new project:

```
graphs/
└── <your-collection>/          ← group name (e.g. "ai-research", "market-reports")
    └── <your-project>/         ← one folder per document (e.g. "openai-2025-report")
        └── source.md           ← paste your document here
```

Create the folder and add your source document as `source.md`. This can be any text — a research paper, article, report, transcript, or notes.

### 5b. Run the extraction with your AI agent

Open this repo in your preferred AI coding tool (Claude, Codex, Cursor, Antigravity, Windsurf, or any MCP-compatible client) and give it this prompt:

```
Read docs/INGESTION_FOR_AGENTS.md.

Source document: graphs/<your-collection>/<your-project>/source.md
Collection: <your-collection>
Project slug: <your-project>

Generate all 6 extraction artifacts in the same folder.
Validate before upload.
Upload to Neo4j without deleting or replacing existing collections.
```

The agent will generate these files inside your project folder:

| File | What it contains |
|------|-----------------|
| `01_html.html` | Formatted HTML of your document |
| `02_placement.json` | Collection + directory metadata |
| `03_nlp_entities.json` | NLP candidate extraction |
| `04_all_entities.json` | Full entity list with definitions |
| `05_embeddings.json` | Entity embedding vectors |
| `06_extraction.json` | Final graph: entities, relationships, causal chains |

### 5c. View your graph

Refresh `http://127.0.0.1:5174` and open your collection in Graph Studio. Your entities, relationships, bridge connections, and causal chains are now live in the interactive force-directed graph.

> See `graphs/README.md` for the full folder convention and examples.

---

## Step 6 - Connect AI Clients (Optional)

The MCP server lets AI assistants query your knowledge graph directly.

### Start the MCP server

```bash
bun run dev:mcp
```

### Configure your AI client

Add this to your AI client's MCP configuration:

```json
{
  "mcpServers": {
    "nitanics": {
      "command": "node",
      "args": ["apps/mcp/bundle/index.mjs"],
      "cwd": "/path/to/nitanics",
      "env": {
        "NEO4J_URI": "neo4j://127.0.0.1:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "12345678",
        "NEO4J_DATABASE": "memorytonic"
      }
    }
  }
}
```

Build the MCP bundle first:

```bash
bun run build:mcp
```

---

## Environment Files Reference

`bun run neo4j:ensure` writes these automatically. For manual setup, create them from `.env.example`:

| App | Env file | Key variables |
|-----|----------|---------------|
| `apps/web/frontend` | `.env` | `VITE_NEO4J_URI`, `VITE_NEO4J_USER`, `VITE_NEO4J_PASSWORD`, `VITE_NEO4J_DATABASE` |
| `apps/web/modules/graph-studio` | `.env` | Same as frontend |
| `apps/mcp` | `.env` | `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` |
| `apps/api` | `.env` | `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` |

---

## Common Commands

```bash
bun run dev              # Start frontend + graph studio
bun run build            # Production build
bun run neo4j:ensure     # Start or verify local Neo4j
bun run dev:mcp          # Start MCP server
bun run build:mcp        # Build MCP bundle
```

## Troubleshooting

### `bun install` fails on Python setup
Make sure `uv` is installed. The `postinstall` script runs `uv sync` in the ingestion pipeline directory. If it fails, run manually:
```bash
cd apps/ingestion-pipeline
uv sync
```

### Neo4j connection refused
- Verify Docker Desktop is running
- Check the container: `docker ps | grep nitanics-neo4j`
- Restart it: `docker start nitanics-neo4j`
- Verify credentials in your `.env` files match what Neo4j expects

### Frontend shows "No collections found"
Your Neo4j database is empty. Import the sample data:
```bash
node scripts/import-collection-export.mjs apps/exports/global-finance-systems-export
```

### Graph Studio shows blank canvas
- Check browser console for Neo4j connection errors
- Verify `.env` files exist in both `apps/web/frontend/` and `apps/web/modules/graph-studio/`
- Confirm Neo4j is running: visit `http://127.0.0.1:7474` in your browser

---

## Project Structure

```
nitanics/
├── apps/
│   ├── web/
│   │   ├── frontend/                 Main React web application
│   │   └── modules/graph-studio/     Force-directed graph visualization
│   ├── ingestion-pipeline/           Python NLP + LLM extraction pipeline
│   │   ├── data/projects/            Source documents
│   │   ├── data/extracted/           Generated extraction artifacts
│   │   ├── data/sources/             HTML source documents for the UI
│   │   ├── skills/                   Agent instruction files
│   │   └── neo4j/                    Upload and validation scripts
│   ├── mcp/                          MCP server for AI client integration
│   ├── api/                          Backend gateway (placeholder)
│   └── exports/                      Portable collection exports
├── packages/
│   └── shared/                       Shared TypeScript contracts
├── scripts/
│   ├── ensure-neo4j.mjs              Neo4j Docker bootstrap
│   └── import-collection-export.mjs  Collection import tool
├── docs/
│   ├── ARCHITECTURE.md               System architecture and graph model
│   ├── INGESTION_FOR_AGENTS.md       AI agent extraction guide
│   └── OPEN_SOURCE_GUIDE.md          This file
└── README.md
```
