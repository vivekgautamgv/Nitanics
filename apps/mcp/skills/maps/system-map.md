# MemoryTonic System Map

**Read this FIRST on every session. This is your orientation.**

---

## What MemoryTonic Is

A research tool that discovers connections between documents that no single document contains. Knowledge graph for humans AND AI agents. Store research, extract entities/relationships/causal chains into Neo4j, reveal cross-document intelligence through bridge entities and causal mechanics.

**Business:** $5 one-time, Electron desktop, everything local except auth. User's Claude does extraction (zero API cost for us).

**Core Value:** You don't just extract entities from text. You INVESTIGATE SYSTEMS. Every document describes a system — a sanctions regime, a financial architecture, a geopolitical power structure, a biological process, a software architecture. Your job is to investigate that system: identify its components, trace how they connect, understand WHY they behave the way they do, find where the system breaks or could break.

---

## The 5 Components

```
C01: INGESTION       Python scripts + Neo4j schema               CLOSED
C02: GRAPH STUDIO    react-force-graph-2d visualization           CLOSED
C03: FRONTEND        React app shell + all pages + RSB            CLOSED
C04: MCP SERVER      This. TypeScript MCP + Python bridge         CURRENT
C05: ELECTRON        Desktop packaging + auth                     NOT STARTED
```

---

## How Components Connect

```
                         +-----------------+
                         |   USER (Human)  |
                         +--------+--------+
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
          +------------------+        +------------------+
          |   C03: FRONTEND  |        |  CLAUDE DESKTOP  |
          |   (Browser UI)   |        |  (AI Interface)  |
          +--------+---------+        +--------+---------+
                   |                           |
                   |                           v
                   |                  +------------------+
                   |                  |  C04: MCP SERVER |
                   |                  |  (You are here)  |
                   |                  +--------+---------+
                   |                      |         |
                   |            +---------+    +----+-----+
                   |            |              |          |
                   |            v              v          v
                   |    +-------------+  +---------+  +--------+
                   |    | C01 SCRIPTS |  | FILE    |  | SKILLS |
                   |    | (Python)    |  | SYSTEM  |  | (.md)  |
                   |    +------+------+  +---------+  +--------+
                   |           |
                   v           v
          +----------------------------+
          |       NEO4J DATABASE       |
          |    (Single Source of Truth) |
          +----------------------------+
```

**C04 writes via C01 Python scripts → Neo4j ← C02/C03 read directly**

---

## What C04 (You) Does

### Two Layers

1. **Locked Process Layer** — Code that executes operations. Cannot be edited by users. Ensures correctness.
   - validate_project.py — 30+ validation rules, hard quality gate
   - upload.py — entity merging, relationship creation, chain links (9 internal steps)
   - embed.py — BERT all-MiniLM-L6-v2, 384d vectors (stdin/stdout, spawn-and-exit)
   - gds.py — PageRank, Betweenness, Degree, Node Similarity
   - export_collection.py — portable ZIP with graph.json + embeddings + HTMLs
   - import_collection.py — 6-phase import pipeline (preflight → conflicts → reconstruct → upload → GDS → verify)
   - bootstrap.py — schema constraints + indexes + default directories
   - delete_project.py — 13-step cascade deletion + filesystem cleanup
   - preprocess.py — spaCy NER + TF-IDF + co-occurrence + BERT dedup (stdin/stdout)

2. **Open Instruction Layer** — Editable .md files that guide YOUR intelligence. Users can extend and customize.
   - maps/ — Navigation for you (this file, pipeline-map, skill-index)
   - extraction/ — How to discover entities, build relationships, write chains
   - analysis/ — How to analyze collections, detect bridges, find gaps
   - system/ — Neo4j schema reference, GDS guide, Cypher patterns
   - domains/ — Domain-specific extraction guidance
   - custom/ — User/AI-created domain skills
   - agent.md — User's single customization file

### Three MCP Primitives

- **Tools** (18) — Execute operations. Call Python scripts. Query Neo4j. The locked layer. (Consolidated from 39 via rich parameters.)
- **Resources** (~25) — Serve instruction files. You read these to know HOW to think. The open layer.
- **Prompts** (4) — Workflow starters. Return structured messages that guide you through complete workflows.

### Connection Methods

- **C01 Python scripts:** Spawned via `child_process.spawn()`, communicate via stdin/stdout JSON, no persistent service
- **Neo4j reads:** TypeScript bolt driver (neo4j-driver npm), direct Cypher queries, ~1-5ms per query
- **Neo4j writes:** Via C01 Python scripts only (upload.py uses HTTP API through db.py)
- **Skills directory:** File system reads (skills/*.md), served as MCP resources

---

## How Claude Uses This Server

Claude IS the orchestrator. The MCP server provides stateless tools.

| Role | What Happens | Tools Used |
|------|-------------|------------|
| **Orchestrator** | Claude follows workflows from prompts, reads resources for guidance | All 18 tools |
| **Extraction** | Claude reasons over text, calls tools for NLP/upload | nlp_preprocess, extract, admin |
| **Research** | Claude analyzes collections via read-only tools | search, recall, explore, analyze, collection |
| **Import** | Claude triggers import workflow | admin (import action) |

---

## What C02 Graph Studio Displays

Interactive force-directed graph visualization. Dark industrial theme. 41 source files.

**What it reads from Neo4j:**
- Entity: entityId, name, category, definition, aliases, pageRank, betweenness, degree, projectCount, embedding
- RELATES_TO: relType, causalClassification, description, evidence, evidenceStrength, magnitude, year, projectId
- MENTIONED_IN: role
- Project: name, uniqueId, summary, domain, subdomain, baseTags, htmlPath
- Collection: name + computed counts
- CausalChain: chainId, name, description + CHAIN_LINK (orderIndex, explanation)
- SIMILAR_TO: similarity
- TemporalEvent: phaseIndex, label, period

**Visual features:** Nodes colored by 14 categories, sized by pageRank. Bridge glow (Gold/Silver/Bronze). Labels at zoom > 1.5. 6 filters (category, bridge, project, importance, edge type, search). Path finding. Causal chain visualization. Edge tooltips.

---

## What C03 Frontend Displays

Full app shell. 8 routes. ~7,200 LOC across 40 files. Dark theme.

**Pages:**
- Home — Directory grid, CRUD, Graph Studio launcher
- Directory — 3-tab console (Collections, Projects, Entities), cross-entity search
- Collection — Projects, bridges, categories, top entities, chains, recommendations, ZIP export
- Project — Summary, entities, relationship cards, chain cards, timeline, related projects
- Entity — Definition, graph metrics, project mentions, relationships, chain links, similar entities
- Graph — C02 embedded via adapter
- Source — HTML iframe with dark theme injection
- Settings — Neo4j connection test

**Key UI elements:**
- RSB (Right Sidebar) — Entity InfoCard (606 LOC), Project InfoCard (278 LOC). Filter toggle [All | Collection].
- InfoTag — Green "info" pill on EVERY entity/project name (84 total). Opens RSB.
- TopNav — Breadcrumbs, Graph Studio dropdown, settings

**C03 reads 30+ Neo4j queries.** Every property listed in schema-guide.md Section "Downstream Contract" MUST exist after upload.

---

## Data Flow: Extraction

```
User text → C04 receives → C01 preprocess.py (5-10s)
  → Claude entity discovery (~30s) → Claude extraction (~30s)
  → C01 embed.py (60-90s) → C01 validate_project.py (<1s)
  → C01 upload.py (2-5s) → C01 gds.py (1-10s)
  → Ready for C02/C03/C04 queries

Total: ~2-3 minutes per document
Bottleneck: embed.py (BERT model loading + inference)
```

---

## Critical Constraints

1. **C01, C02, C03 are CLOSED.** Do NOT propose new Neo4j properties. They will be invisible to C02/C03.
2. **stdout is MCP protocol pipe.** ALL logging MUST go to stderr.
3. **Entity merge by name + aliases is case-sensitive.** "IMF" and "imf" are different entities.
4. **upload.py uses CREATE for RELATES_TO, not MERGE.** Multiple edges between same entity pair are allowed (from different projects).
5. **GDS graph projection uses UNDIRECTED orientation.**
6. **C01 uses HTTP API (db.py) for Neo4j writes. C04 uses bolt driver for reads.**

---

## File System Layout

```
MT v4/
├── components/
│   ├── 01-ingestion/           C01: Python scripts, NLP, data storage
│   │   ├── neo4j/              9 Python scripts (bootstrap, upload, validate, gds, export, import, delete, db, config)
│   │   ├── nlp/                preprocess.py, embed.py (+ .venv with models)
│   │   ├── data/
│   │   │   ├── projects/       Raw text inputs (script.md)
│   │   │   ├── sources/        Stored HTML (YYYY-MM-DD/slug/01_html.html)
│   │   │   ├── extracted/      JSON artifacts (slug/02-06 files)
│   │   │   ├── temp/           Pipeline working directory
│   │   │   └── ../exports/     ZIP exports
│   │   └── skills/             12 C01-era skill files (reference)
│   ├── 02-graph-studio/        C02: React visualization (41 files)
│   ├── 03-frontend/            C03: React app shell (40 files, ~7200 LOC)
│   ├── 04-mcp/                 C04: THIS COMPONENT
│   │   ├── skills/             Intelligence layer (you read these)
│   │   │   ├── maps/           system-map, pipeline-map, skill-index
│   │   │   ├── extraction/     kg-theory, quality-bar, entity-discovery, etc.
│   │   │   ├── analysis/       bridge-detection, gap-analysis, etc.
│   │   │   ├── system/         schema-guide, gds-guide, cypher-patterns
│   │   │   ├── domains/        geopolitics, finance, technology
│   │   │   ├── custom/         User/AI-created domain skills
│   │   │   └── agent.md        User customization
│   │   ├── src/                MCP server code (TypeScript)
│   │   ├── PLAN.md             Full C04 planning document
│   │   └── DESIGN-SPEC.md      Architecture specification
│   └── 05-electron/            C05: NOT STARTED
├── memory/                     Session handovers, decisions
├── logs/                       Failures, tasks
├── discussions/                10 design discussions + 5 wiring blueprints
└── skills/                     Project-level skill index
```

---

## Where to Find Things

| Need | Read |
|------|------|
| Schema (all properties) | `system/schema-guide.md` |
| Extraction pipeline steps | `maps/pipeline-map.md` |
| What skills exist | `maps/skill-index.md` |
| KG theory + investigation mindset | `extraction/kg-theory.md` |
| Quality requirements | `extraction/quality-bar.md` |
| How data gets displayed | `extraction/display-awareness.md` |
| Tag creation rules | `extraction/tag-awareness.md` |
| GDS algorithms | `system/gds-guide.md` |
| User preferences | `agent.md` |
| Domain-specific guidance | `domains/<domain>.md` or `custom/<domain>.md` |
