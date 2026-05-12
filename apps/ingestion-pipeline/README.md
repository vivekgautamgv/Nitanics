# Component 01: Ingestion

Extraction pipeline + Neo4j storage + BERT embeddings.

Takes raw text, extracts entities/relationships/causal chains, stores everything in a Neo4j knowledge graph with 384d vector embeddings for semantic search.

---

## Quick Start

### 1. Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Python | 3.10+ | `python --version` |
| Neo4j Desktop | 2026.x | Download from [neo4j.com](https://neo4j.com/download/) |
| spaCy model | `en_core_web_sm` | Installed via `nlp/setup-nlp.py` |
| sentence-transformers | latest | `pip install sentence-transformers` |

### 2. Neo4j Setup

```bash
# 1. Open Neo4j Desktop
# 2. Create a DBMS named "memorytonic"
# 3. Set password (store in neo4j/.env)
# 4. Start the DBMS
# 5. Create a database named "memorytonic"
```

### 3. Configure Credentials

Create `neo4j/.env` (gitignored — never commit):

```env
NEO4J_HTTP=http://localhost:7474
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password-here
NEO4J_DATABASE=memorytonic
```

All scripts read from `neo4j/config.py` which loads these env vars. No hardcoded credentials anywhere.

### 4. Install NLP Dependencies

```bash
python nlp/setup-nlp.py           # Downloads spaCy model
pip install -r nlp/requirements.txt  # sentence-transformers, scikit-learn, etc.
```

### 5. Bootstrap Schema (one-time)

```bash
python neo4j/bootstrap.py          # Create schema
python neo4j/bootstrap.py --status  # Verify
```

This creates:

| What | Count | Purpose |
|------|-------|---------|
| Constraints | 7 | Unique IDs on all node types |
| Property indexes | 5 | Fast lookup by name, category |
| Fulltext index | 1 | Text search across entity name, definition, aliases |
| Vector indexes | 2 | 384d cosine similarity (Entity + Project embeddings) |
| Default directories | 3 | Research, Business, Personal |

### 6. Run Extraction Pipeline

See [Extraction Pipeline](#extraction-pipeline) below for the full 7-step process.

---

## Directory Structure

```
01-ingestion/
├── README.md                  ← This file
├── STATUS.md                  ← OPEN | CLOSED
│
├── neo4j/                     ← Database layer
│   ├── config.py              ← Shared config (reads .env, exports constants)
│   ├── db.py                  ← Shared HTTP client (run_cypher, run_batch, check_connection)
│   ├── .env                   ← Credentials (gitignored)
│   ├── schema.cypher          ← Schema reference (human-readable)
│   ├── bootstrap.py           ← Create schema (constraints, indexes, directories)
│   ├── upload.py              ← Upload extraction artifacts to Neo4j
│   ├── validate_project.py    ← Lifecycle validation gate (30+ rules)
│   ├── gds.py                 ← Graph algorithms (PageRank, Betweenness, Degree, Similarity)
│   ├── delete_project.py      ← Cascade deletion (Neo4j + filesystem)
│   ├── export_collection.py   ← Portable collection export (ZIP + graph.json)
│   └── import_collection.py   ← Collection import (ZIP → artifacts → Neo4j)
│
├── nlp/                       ← Python NLP tools
│   ├── preprocess.py          ← spaCy NER + TF-IDF keywords + co-occurrences
│   ├── embed.py               ← BERT embeddings (all-MiniLM-L6-v2, 384d)
│   ├── setup-nlp.py           ← One-time spaCy model download
│   └── requirements.txt       ← Python dependencies
│
├── skills/                    ← Pipeline protocols + operations (become MCP tools)
│   ├── extraction-agent.md    ← Full pipeline orchestration guide
│   ├── extraction-skill.md    ← Quality bar, examples, format specs
│   ├── checklist-template.md  ← Live tracker (copy per project)
│   ├── extraction-checklist.md ← Quick reference: common mistakes
│   ├── nlp-setup-skill.md     ← NLP environment setup guide
│   ├── neo4j-operations-skill.md ← CRUD, search, explore, gaps, bridges, paths
│   ├── cypher-queries-skill.md   ← 30+ Cypher query patterns
│   ├── gds-skill.md           ← GDS operations guide (4 active algorithms)
│   ├── gds-catalog-skill.md   ← Full GDS catalog (30+ algorithms rated)
│   ├── maintenance-skill.md   ← Post-upload/deletion maintenance
│   └── import-pipeline-skill.md ← Collection import agent guide
│
├── contracts/                 ← Interface contracts for downstream components
│   ├── graph-studio-contract.md  ← What Component 2 (Graph Studio) expects
│   └── mcp-contract.md          ← What Component 4 (MCP) expects
│
└── data/                      ← All project data
    ├── projects/              ← Raw source text (script.md originals)
    │   └── <project-name>/
    │       └── script.md
    ├── sources/               ← Formatted HTML (served to frontend)
    │   └── YYYY-MM-DD/
    │       └── <project-name>/
    │           └── 01_html.html
    ├── extracted/             ← Full extraction artifacts (permanent archive)
    │   └── <project-name>/
    │       ├── 01_html.html
    │       ├── 02_placement.json
    │       ├── 03_nlp_entities.json
    │       ├── 04_all_entities.json
    │       ├── 05_embeddings.json
    │       └── 06_extraction.json
    ├── ../exports/            ← Generated collection exports (gitignored)
    └── temp/                  ← Working directory during extraction (cleaned after success)
```

### Storage Paths Explained

| Path | Purpose | Lifecycle |
|------|---------|-----------|
| `data/temp/<project>/` | Working directory during extraction | Deleted after successful upload |
| `data/extracted/<project>/` | Permanent archive of all 6 artifacts | Never deleted |
| `data/sources/YYYY-MM-DD/<project>/01_html.html` | HTML served to frontend | Path stored in Neo4j `Project.htmlPath` |
| `data/projects/<project>/script.md` | Original source text | Reference copy |

The `htmlPath` property on each Neo4j Project node points to `data/sources/YYYY-MM-DD/<project>/01_html.html`. The frontend resolves this path to render the formatted document.

---

## Extraction Pipeline

```
STEP 00 → STEP 01 → STEP 02 → STEP 03 → STEP 04 → STEP 05 → VALIDATE → STEP 06
(once)   HTML+Place  NLP       Entities   Extraction  Embeddings  Gate      Upload
```

### Step 00: Schema Bootstrap (one-time)

```bash
python neo4j/bootstrap.py
```

Creates constraints, indexes (property + fulltext + vector), and default directories.
Only needed once per fresh database. Idempotent (safe to re-run).

### Step 01: HTML + Placement

| | |
|-|-|
| **In** | Raw text (script.md) |
| **Out** | `01_html.html` + `02_placement.json` |

Convert source text to semantic HTML. Determine placement: directory, project name (kebab-case), collection.

```json
// 02_placement.json
{
  "directory": "Research",
  "project_name": "kebab-case-slug",
  "unique_id": "kebab-case-slug",
  "collection": "Collection Name",
  "collection_is_new": false
}
```

**5 fields required.** `collection` not `collection_name`. `project_name` not `name`. `unique_id` = `project_name`.

### Step 02: NLP Preprocessing

| | |
|-|-|
| **In** | Raw text |
| **Out** | `03_nlp_entities.json` |
| **Tool** | `python nlp/preprocess.py` (pipe JSON to stdin) |

```bash
echo '{"text": "<full text>", "title": "<title>"}' | python nlp/preprocess.py > 03_nlp_entities.json
```

Extracts entity candidates via spaCy NER, TF-IDF keywords, and co-occurrence pairs.

### Step 03: Entity Discovery

| | |
|-|-|
| **In** | Raw text + `03_nlp_entities.json` |
| **Out** | `04_all_entities.json` |

Claude reviews NLP candidates, adds missed entities (concepts, systems, processes), writes definitions (100+ chars) and roles (stance + mechanics + reasoning).

**NLP reconciliation is mandatory:** every real NLP entity goes into the final list. LLM adds, never drops.

```json
// 04_all_entities.json
{
  "temporal_phases": [
    { "index": 1, "label": "Phase Label", "period": "1944-1971" }
  ],
  "entities": [
    {
      "name": "Entity Name",
      "aliases": ["Alias 1"],
      "category": "Organization",
      "definition": "100+ chars...",
      "role": "Stance + mechanics + reasoning...",
      "first_appearance_index": 1
    }
  ]
}
```

**14 valid categories:** Person, Organization, Place, Event, Concept, System, Process, Technology, Law, Agreement, Metric, Document, Resource, Other.

### Step 04: Full Extraction

| | |
|-|-|
| **In** | Raw text + `04_all_entities.json` |
| **Out** | `06_extraction.json` |

Builds project summary, narrative flow, tags, relationships (15+), and causal chains (2+).

```json
// 06_extraction.json
{
  "project": {
    "name": "Human-Readable Display Title",
    "unique_id": "kebab-case-slug",
    "summary": "200+ words...",
    "narrative_flow": ["Key moment 1", "Key moment 2"],
    "tags": { "domain": "...", "subdomain": "...", "base_tags": ["..."] }
  },
  "relationships": [
    {
      "source": "Entity A", "target": "Entity B",
      "relType": "SPECIFIC_VERB", "causalClassification": "ENABLES",
      "description": "80+ chars...", "evidence": "exact quote",
      "evidenceStrength": "established", "magnitude": "foundational",
      "year": "1974"
    }
  ],
  "causal_chains": [
    {
      "name": "Chain Name", "description": "...",
      "links": [{ "source": "A", "target": "B", "explanation": "HOW and WHY" }]
    }
  ]
}
```

**Critical:** `project` wrapper is mandatory. `narrative_flow` is strings, not objects. Use `source`/`target`, not `source_entity`/`target_entity`. Use `year` (not `period`). For ongoing/structural relationships: `"year": "ongoing"`.

**15 causal classifications:** CAUSES, ENABLES, BLOCKS, INFLUENCES, DEPENDS_ON, CONTRADICTS, SUPPORTS, PRECEDES, COMPETES_WITH, COOPERATES_WITH, REGULATES, TRANSFORMS, PRODUCES, CONSUMES, IMPLEMENTS.

### Step 05: Embeddings

| | |
|-|-|
| **In** | `04_all_entities.json` + `06_extraction.json` |
| **Out** | `05_embeddings.json` |
| **Tool** | `python nlp/embed.py` (pipe JSON to stdin) |

```bash
# Build input: {"texts": ["definition+role", ...], "names": ["Name", ...]}
# Last entry = project summary + unique_id
python -c "..." | python nlp/embed.py > 05_embeddings.json
```

```json
// 05_embeddings.json
{
  "model": "all-MiniLM-L6-v2",
  "dimensions": 384,
  "embeddings": [
    { "name": "Entity Name", "embedding": [0.023, -0.041, ...], "dimensions": 384 }
  ]
}
```

Single `embeddings` array. Last entry is the project embedding (name = unique_id). All others are entity embeddings.

### Step 05.5: Validation Gate (MANDATORY)

| | |
|-|-|
| **In** | All artifacts in project directory |
| **Out** | Pass/fail report (JSON or human-readable) |
| **Tool** | `python neo4j/validate_project.py` |

```bash
python neo4j/validate_project.py --human <project-dir>   # Human-readable
python neo4j/validate_project.py <project-dir>            # JSON output
python neo4j/validate_project.py --all data/extracted     # Validate all projects
```

Runs 30+ validation rules:
- File presence (all 6 artifacts)
- Placement fields (names, types, ID consistency)
- Entity fields (categories, definition length, duplicates)
- Extraction structure (project wrapper, relationship fields, entity name cross-references)
- Embeddings (correct format, dimensions, count = entities + 1)
- Cross-file consistency (unique_id matches, entity names align)

**Do NOT proceed to upload without passing validation.** Max 2 fix-and-revalidate cycles.

### Step 06: Store + Upload

| | |
|-|-|
| **In** | All validated artifacts |
| **Tool** | `python neo4j/upload.py <project-dir>` |

```bash
python neo4j/upload.py data/extracted/<project-name>
```

Creates in Neo4j:
1. DateTime nodes (date + time)
2. Collection node (or finds existing)
3. Project node (with `htmlPath` pointing to `data/sources/...`)
4. Entity nodes (merged if alias match found across projects)
5. TemporalEvent nodes
6. RELATES_TO relationships
7. FIRST_APPEARS_IN links
8. CausalChain nodes + CHAIN_LINK relationships
9. Embeddings stored as node properties

After upload:
- Copy artifacts to `data/extracted/<project>/` (permanent archive)
- Copy HTML to `data/sources/YYYY-MM-DD/<project>/01_html.html` (matches Neo4j path)
- Copy source script to `data/projects/<project>/`
- Clean temp directory only after verification

---

## Neo4j Schema

### Node Types

| Node | Key Properties | Constraints |
|------|---------------|-------------|
| **Project** | projectId, name, uniqueId, summary, narrativeFlow, htmlPath, domain, subdomain, baseTags | Unique projectId |
| **Entity** | entityId, name, aliases, category, definition, role, firstAppearanceIndex, projectCount, embedding (384d) | Unique entityId |
| **Collection** | collectionId, name | Unique collectionId |
| **DirectoryCategory** | name, description | Unique name |
| **DateTime** | datetimeId, date, type (date/time) | Unique datetimeId |
| **TemporalEvent** | eventId, projectId, phaseIndex, label, period | Unique eventId |
| **CausalChain** | chainId, name, description, linkCount, projectId | Unique chainId |

### Relationship Types

| Relationship | From | To | Properties |
|-------------|------|-----|-----------|
| `IN_DIRECTORY` | Project | DirectoryCategory | — |
| `CREATED_ON` | Project | DateTime (date) | — |
| `CREATED_AT` | Project | DateTime (time) | — |
| `ON_DATE` | DateTime (time) | DateTime (date) | — |
| `BELONGS_TO` | Project | Collection | — |
| `MENTIONED_IN` | Entity | Project | role |
| `RELATES_TO` | Entity | Entity | relType, causalClassification, description, evidence, evidenceStrength, magnitude, year |
| `FIRST_APPEARS_IN` | Entity | TemporalEvent | — |
| `BELONGS_TO_PROJECT` | TemporalEvent | Project | — |
| `BELONGS_TO_PROJECT` | CausalChain | Project | — |
| `CHAIN_LINK` | Entity | Entity | chainId, orderIndex, explanation |

### Indexes

| Index | Type | On |
|-------|------|----|
| entity_name | RANGE | Entity.name |
| entity_category | RANGE | Entity.category |
| project_name | RANGE | Project.name |
| collection_name | RANGE | Collection.name |
| temporal_event_project | RANGE | TemporalEvent.projectId |
| entity_fulltext | FULLTEXT | Entity.name, definition, aliases_text |
| entityEmbedding | VECTOR (384d, cosine) | Entity.embedding |
| projectEmbedding | VECTOR (384d, cosine) | Project.embedding |

---

## Configuration

All Neo4j scripts use `neo4j/config.py` which reads from environment variables (with `.env` file support via python-dotenv):

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEO4J_HTTP` | `http://localhost:7474` | Neo4j HTTP API endpoint |
| `NEO4J_USER` | `neo4j` | Database username |
| `NEO4J_PASSWORD` | `neo4j` | Database password |
| `NEO4J_DATABASE` | `memorytonic` | Database name |

Place credentials in `neo4j/.env` (gitignored at project root). Never hardcode credentials in scripts.

---

## Bridge Entities

Entities that appear across multiple projects are "bridge entities" — the primary cross-document research insight.

| Tier | Criteria | Meaning |
|------|----------|---------|
| Gold | 3+ projects | Major cross-cutting concept |
| Silver | 2 projects | Shared connection |
| Bronze | 1 project, high betweenness | Structurally important within project |

Bridge detection is automatic: `upload.py` increments `projectCount` when an entity name or alias matches an existing entity. Query with:

```cypher
MATCH (e:Entity) WHERE e.projectCount > 1
RETURN e.name, e.projectCount ORDER BY e.projectCount DESC
```

---

## Useful Cypher Queries

```cypher
-- Database overview
MATCH (n) RETURN labels(n), count(n) ORDER BY count(n) DESC

-- All projects
MATCH (p:Project) RETURN p.name, p.uniqueId, p.htmlPath

-- Entities for a project
MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project {uniqueId: "petrodollar-system"})
RETURN e.name, e.category, e.definition

-- Bridge entities
MATCH (e:Entity) WHERE e.projectCount > 1
RETURN e.name, e.projectCount ORDER BY e.projectCount DESC

-- Relationships for a project
MATCH (a:Entity)-[r:RELATES_TO]->(b:Entity),
      (a)-[:MENTIONED_IN]->(p:Project {uniqueId: "petrodollar-system"})
RETURN a.name, r.relType, b.name, r.description

-- Causal chains
MATCH (a)-[r:CHAIN_LINK]->(b) WHERE r.chainId = "chain-xxx"
RETURN a.name, b.name, r.explanation ORDER BY r.orderIndex

-- Semantic search (vector similarity)
MATCH (e:Entity)
WHERE e.embedding IS NOT NULL
WITH e, vector.similarity.cosine(e.embedding, $queryVector) AS score
WHERE score > 0.7
RETURN e.name, score ORDER BY score DESC

-- Fulltext search
CALL db.index.fulltext.queryNodes("entity_fulltext", "monetary policy")
YIELD node, score
RETURN node.name, score ORDER BY score DESC

-- Verify embeddings coverage
MATCH (e:Entity) RETURN count(e) AS total,
  sum(CASE WHEN e.embedding IS NOT NULL THEN 1 ELSE 0 END) AS withEmbedding
```

---

## Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `neo4j/db.py` | Shared HTTP client (`run_cypher`, `run_batch`, `check_connection`) | Imported by all neo4j scripts |
| `neo4j/config.py` | Connection config (reads `.env` / env vars) | Imported by db.py |
| `neo4j/bootstrap.py` | Create schema (constraints, indexes, directories) | `python neo4j/bootstrap.py` |
| `neo4j/bootstrap.py --status` | Show database statistics | `python neo4j/bootstrap.py --status` |
| `neo4j/bootstrap.py --clean` | Wipe database + recreate schema | `python neo4j/bootstrap.py --clean` |
| `neo4j/upload.py` | Upload extraction artifacts to Neo4j | `python neo4j/upload.py <project-dir>` |
| `neo4j/validate_project.py` | Validate artifacts before upload | `python neo4j/validate_project.py --human <dir>` |
| `neo4j/gds.py` | Graph algorithms (PageRank, Betweenness, Degree, Similarity) | `python neo4j/gds.py` |
| `neo4j/gds.py --status` | Show current GDS metrics | `python neo4j/gds.py --status` |
| `neo4j/delete_project.py` | Cascade deletion (Neo4j + filesystem) | `python neo4j/delete_project.py <uid>` |
| `neo4j/export_collection.py` | Portable collection export | `python neo4j/export_collection.py "Name"` |
| `neo4j/export_collection.py --list` | List all collections | `python neo4j/export_collection.py --list` |
| `neo4j/export_collection.py --json-only` | Export graph.json only (no ZIP) | `python neo4j/export_collection.py "Name" --json-only` |
| `neo4j/import_collection.py` | Import collection from ZIP | `python neo4j/import_collection.py <zip>` |
| `neo4j/import_collection.py --dry-run` | Validate import without uploading | `python neo4j/import_collection.py <zip> --dry-run` |
| `nlp/preprocess.py` | NLP entity extraction | `echo '{"text":"..."}' \| python nlp/preprocess.py` |
| `nlp/embed.py` | BERT embeddings (384d) | `echo '{"texts":[],"names":[]}' \| python nlp/embed.py` |
| `nlp/setup-nlp.py` | Download spaCy model | `python nlp/setup-nlp.py` |

---

## Skills (Pipeline Protocols + Operations)

| File | Future MCP Tool | Purpose |
|------|-----------------|---------|
| `skills/extraction-agent.md` | `memorytonic_extract` | Full pipeline orchestration |
| `skills/extraction-skill.md` | `memorytonic_extraction_guide` | Quality bar, format specs, examples |
| `skills/checklist-template.md` | — | Live tracker per project |
| `skills/extraction-checklist.md` | — | Quick reference: common mistakes |
| `skills/nlp-setup-skill.md` | `memorytonic_health` | NLP environment setup |
| `skills/neo4j-operations-skill.md` | Multiple tools | CRUD, search, explore, gaps, bridges, paths |
| `skills/cypher-queries-skill.md` | `memorytonic_query` | 30+ Cypher query patterns |
| `skills/gds-skill.md` | `memorytonic_recompute` | GDS: PageRank, Betweenness, Degree, Similarity |
| `skills/maintenance-skill.md` | --- | Post-upload/deletion maintenance |
| `skills/html-template-skill.md` | --- | Dark theme HTML template for source documents |
| `skills/import-pipeline-skill.md` | `memorytonic_import` | Collection import: ZIP to Neo4j agent guide |

These files become MCP tool instructions in Component 4.

---

## Contracts (Downstream)

| File | Consumer | What it defines |
|------|----------|----------------|
| `contracts/graph-studio-contract.md` | Component 2 (Graph Studio) | Node properties, relationship types, query patterns |
| `contracts/mcp-contract.md` | Component 4 (MCP) | Tool surface, query capabilities |
