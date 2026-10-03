# Component 04: MCP Server — Design Specification

**Status:** PLANNING (v2 — evolved architecture)
**Author:** Builder
**Date:** 2026-04-08
**Depends on:** Component 01 (CLOSED), Component 02 (CLOSED — read-only), Component 03 (CLOSED — read-only)

---

## Table of Contents

1. [What This Document Is](#1-what-this-document-is)
2. [Architecture: Two Layers](#2-two-layers)
3. [The Three MCP Primitives](#3-mcp-primitives)
4. [Master-Worker Orchestration](#4-master-worker)
5. [agent.md — User Customization](#5-agent-md)
6. [v3 MCP Audit](#6-v3-audit)
7. [v3 → v4 Schema Differences](#7-schema-diff)
8. [Architecture Decisions](#8-architecture-decisions)
9. [Tool Inventory (36 tools)](#9-tool-inventory)
10. [Resource Inventory (open instruction layer)](#10-resource-inventory)
11. [Prompt Inventory (workflow combinators)](#11-prompt-inventory)
12. [The Extraction Flow (Master-Worker)](#12-extraction-flow)
13. [Edge Cases, Traps, and Constraints](#13-edge-cases)
14. [Data Access Layer Design](#14-data-access-layer)
15. [Directory Structure](#15-directory-structure)
16. [Implementation Plan](#16-implementation-plan)
17. [Assumptions](#17-assumptions)
18. [Open Questions](#18-open-questions)

---

## 1. What This Document Is

Component 04 is the **MCP server** — the AI interface to MemoryTonic. But it's not just a tool wrapper. It's a **two-layer system**:

- **Locked Process Layer** — Code that executes operations (validate, upload, embed, GDS, export/import). Cannot be edited by users. Ensures correctness.
- **Open Instruction Layer** — Editable `.md` skill files that guide Claude's intelligence (extraction style, analysis approach, domain knowledge, quality bars). Users can extend and customize.

MCP tools execute. MCP resources teach. MCP prompts orchestrate.

```
HUMAN PATH:                    AI PATH:
  Browser                       Claude Desktop / Claude Code
    |                              |
    v                              v
  C03 Frontend ---+           C04 MCP Server
  C02 Graph Studio--+              |
                    |              +-- Tools (locked process)
                    |              +-- Resources (open instructions)
                    |              +-- Prompts (workflow combinators)
                    v              v
              +------------------------+
              |    NEO4J DATABASE      |
              |   (single source)      |
              +------------------------+
                        ^
                        |
                  C01 Ingestion
                  (Python scripts)
```

---

## 2. Architecture: Two Layers {#2-two-layers}

### Layer 1: Locked Process (Code)

These are MCP **tools** — TypeScript functions that call Python scripts or Neo4j directly. Users cannot modify them. They enforce correctness.

```
LOCKED (code, not editable):
  validate_project.py  — 30+ validation rules, hard quality gate
  upload.py            — entity merging, relationship creation, chain links
  embed.py             — BERT all-MiniLM-L6-v2, 384d vectors
  gds.py               — PageRank, Betweenness, Degree, Node Similarity
  export_collection.py — portable ZIP with graph.json
  import_collection.py — 6-phase import pipeline
  bootstrap.py         — schema constraints + indexes + default dirs
  delete_project.py    — cascade delete
  preprocess.py        — spaCy NER + TF-IDF + co-occurrence
```

When Claude calls `memorytonic_extract`, it triggers this locked pipeline. The code runs exactly the same regardless of who calls it or what instructions Claude received.

### Layer 2: Open Instructions (Editable .md files)

These are MCP **resources** — `.md` files that Claude reads on demand. Users CAN edit them. They guide Claude's intelligence.

```
OPEN (editable .md files):
  maps/              — Navigation for Claude (system-map, pipeline-map, skill-index)
  pipeline/          — Step-by-step instructions for each pipeline stage
  extraction/        — How to discover entities, build relationships, write chains
  analysis/          — How to analyze collections, detect bridges, find gaps
  system/            — Neo4j schema reference, GDS guide, Cypher patterns
  domains/           — Domain-specific extraction guidance (geopolitics, finance, etc.)
  custom/            — User-created skills (empty by default)
  agent.md           — The ONE file users primarily edit
```

### Why Two Layers?

The extraction pipeline has TWO kinds of intelligence:

1. **Mechanical intelligence** — merging entities by alias, computing PageRank, validating JSON structure. This MUST be correct. It's code.

2. **Analytical intelligence** — deciding what counts as an entity, writing relationship descriptions, constructing causal chains. This is Claude's judgment, guided by instructions.

Locking the mechanics prevents users from breaking the pipeline. Opening the instructions lets users evolve their extraction quality.

### Maps: Claude's Navigation System

Maps tell Claude where everything is and how things connect. Master Claude reads maps FIRST before doing anything.

| Map | Purpose | When Read |
|-----|---------|-----------|
| `system-map.md` | Overall architecture — what components exist, what connects to what, where data lives | Session start, when Claude needs orientation |
| `pipeline-map.md` | The 6-step extraction pipeline — step order, what each step does, which skills it needs, validation criteria | Before any extraction, before spawning workers |
| `skill-index.md` | Index of ALL available skills with one-line descriptions | When Claude needs to find a relevant skill |

---

## 3. The Three MCP Primitives {#3-mcp-primitives}

### Tools — Execute Operations

36 tools (see [Section 9](#9-tool-inventory)). Grouped by function:

| Group | Count | Purpose |
|-------|-------|---------|
| System | 3 | Health, bootstrap, stats |
| Extraction | 3 | Guide, NLP preprocess, extract (fat pipeline) |
| Query & Search | 7 | Search, recall, explore, paths, similar, query, explain |
| Entity & Project | 4 | Get entity/project, list projects/collections |
| Collections | 7 | CRUD + bridges + suggestions |
| Directories | 3 | List, create, update |
| Analysis | 5 | Importance, gaps, temporal, overlaps, suggestions |
| Admin | 4 | Recompute, export, import, delete |

Tools are the locked layer. They DO things.

### Resources — Serve Instructions

~25 resource files organized into 7 categories (see [Section 10](#10-resource-inventory)).

Resources are the open layer. They TEACH Claude.

When Claude calls `resources/read` with a URI like `memorytonic://skills/extraction/entity-discovery`, the MCP server reads the corresponding `.md` file and returns its content.

Claude reads resources:
- **Before extraction** — to know the quality bar, format rules, domain-specific guidance
- **Before analysis** — to know how to interpret GDS metrics, detect bridges, find gaps
- **When lost** — maps tell Claude where to find what it needs
- **On demand** — worker agents request specific skills they need for their step

### Prompts — Assemble Workflows

4-6 prompts that combine resources + context into ready-to-use instructions (see [Section 11](#11-prompt-inventory)).

When Claude calls `prompts/get` with `extract-document`, the MCP server:
1. Reads `pipeline-map.md` (the flow)
2. Reads `agent.md` (user customization)
3. Reads relevant extraction skills
4. Assembles them into a single orchestration prompt

Prompts are workflow combinators. They assemble the right instructions for the right task.

---

## 4. Master-Worker Orchestration {#4-master-worker}

### The Problem

The extraction pipeline has 6 steps. Each step requires different skills and produces different artifacts. A single Claude context doing all 6 steps risks:
- Context pollution (step 1 artifacts confusing step 4 reasoning)
- Instruction overload (all skills loaded at once)
- Order violations (skipping steps, mixing concerns)
- Hard failure recovery (if step 4 fails, re-running from scratch)

### The Solution: Master-Worker Pattern

**Master Claude** reads the pipeline-map, understands the full flow, and spawns **Worker agents** for individual steps. Each worker gets exactly the instructions and context it needs, executes, returns results. Master validates between steps.

```
USER: "Extract this document about US-China trade relations"
  |
  v
MASTER CLAUDE
  | 1. Reads: agent.md (user preferences)
  | 2. Reads: pipeline-map (the 6-step flow)
  | 3. Reads: system-map (orientation)
  |
  +---> WORKER 1: HTML + Placement
  |     receives: step-01 instructions + html-template skill + raw text
  |     tools:    memorytonic_collection_suggestions
  |     produces: 01_html.html + 02_placement.json
  |     MASTER VALIDATES: HTML exists, placement has directory + collection + name
  |
  +---> WORKER 2: NLP Preprocessing
  |     receives: step-02 instructions + nlp-setup skill
  |     tools:    memorytonic_nlp_preprocess
  |     produces: 03_nlp_entities.json
  |     MASTER VALIDATES: JSON valid, entities array present
  |
  +---> WORKER 3: Entity Discovery  [CLAUDE REASONING]
  |     receives: step-03 instructions + entity-discovery skill + raw text + NLP output
  |               + domain skill (if configured in agent.md) + agent.md extraction prefs
  |     tools:    none (pure Claude intelligence)
  |     produces: 04_all_entities.json
  |     MASTER VALIDATES: min 10 entities, all definitions 100+ chars,
  |                       all categories from 14 fixed set, aliases present
  |
  +---> WORKER 4: Full Extraction  [CLAUDE REASONING]
  |     receives: step-04 instructions + relationship-building skill + causal-chains skill
  |               + entities output + raw text + agent.md extraction prefs
  |     tools:    none (pure Claude intelligence)
  |     produces: 06_extraction.json
  |     MASTER VALIDATES: min 15 relationships, 2+ chains, 80+ char descriptions,
  |                       evidence quotes present, quality bar met
  |
  +---> WORKER 5: Embeddings
  |     receives: step-05 instructions
  |     tools:    memorytonic_embed (or handled inside memorytonic_extract)
  |     produces: 05_embeddings.json
  |     MASTER VALIDATES: all entities have 384d vectors
  |
  +---> WORKER 6: Upload + GDS
        receives: step-06 instructions + all 6 artifacts
        tools:    memorytonic_extract (fat pipeline tool)
        produces: success/failure + stats
        MASTER VALIDATES: queries Neo4j to confirm project exists
```

### What Each Worker Receives

Each worker gets a **bounded context**:

```
WORKER CONTEXT = {
  step_instructions:  the pipeline step's .md file
  relevant_skills:    1-3 skill files referenced in the step instructions
  input_artifacts:    outputs from previous steps (only what this step needs)
  agent_prefs:        relevant section from agent.md (if any)
  tool_access:        only the MCP tools this step needs
}
```

Workers do NOT receive:
- Full pipeline-map (only master needs this)
- Other steps' instructions
- Artifacts from unrelated steps
- System-level maps

### Validation Checkpoints

Master validates between every step. The pipeline-map defines validation criteria per step:

```markdown
## Step 03: Entity Discovery
...
validation:
  - entities array has 10+ items
  - every entity has: name, aliases[], category (from 14 fixed), definition (100+ chars), role, first_appearance_index
  - no duplicate entity names
  - temporal_phases present with 2+ phases
  - category distribution: not all "Other"
on_failure:
  - retry once with feedback: "These entities failed validation: [list]. Fix: [specific issues]"
  - if retry fails: escalate to user with specific errors
```

### Environment Adaptation

This pattern works in BOTH environments:

| Environment | How Master-Worker Executes |
|-------------|---------------------------|
| **Claude Code** | Master uses `Agent` tool to spawn literal worker subagents. Each worker runs in isolated context. True parallelism possible for independent steps. |
| **Claude Desktop** | Single Claude follows pipeline-map sequentially. Each "step" is mentally isolated — Claude reads step instructions, executes, validates, then moves to next step. Same instructions, sequential execution. |

The MCP server doesn't know or care which environment. It provides the same tools, resources, and prompts. The client decides how to execute.

### Failure Recovery

| Failure Type | Master's Response |
|-------------|-------------------|
| Worker returns invalid output | Retry worker once with specific feedback |
| Worker fails twice | Escalate to user: "Step 3 failed. Entity discovery produced [issue]. Want me to retry with different approach?" |
| Tool call fails (Python crash) | Report error, suggest: check Python env, Neo4j running, disk space |
| Validation fails at step 6 | Report specific validation errors. User can fix and re-submit. |
| Partial pipeline (user wants to stop) | Artifacts saved to temp. User can resume later. |

---

## 5. agent.md — User Customization {#5-agent-md}

### The One File

Users primarily edit ONE file: `agent.md`. This is their customization layer.

```markdown
# My MemoryTonic Agent

## Extraction Style
- Focus on institutional mechanics over individual narratives
- Always trace money flows as explicit entities
- Minimum 3 causal chains for political documents
- Use "established" evidence strength only when source provides citations

## Defaults
- Default directory: Research
- Default collection behavior: suggest existing, confirm before creating new
- NLP preprocessing: always run (don't skip)

## Domain Knowledge
- Load domain: geopolitics (for international relations documents)
- Load domain: finance (for economic analysis documents)
- Auto-detect domain from content when not specified

## Quality Overrides
- Entity definitions: 150+ chars (stricter than default 100)
- Relationships: always include year/period when available
- Causal chains: must include at least one foundational-magnitude link

## Custom Instructions
- For sanctions-related content: extract enforcement mechanism as separate entity
- For trade agreements: always extract both signatories AND implementation bodies
- When entity appears as both Organization and System, prefer Organization
```

### How agent.md Flows Into Workers

```
MASTER reads agent.md FIRST
  |
  +-- "Extraction Style" section --> passed to Workers 3 & 4 (entity discovery + extraction)
  +-- "Defaults" section ----------> passed to Worker 1 (placement)
  +-- "Domain Knowledge" section --> triggers loading domain skills for Workers 3 & 4
  +-- "Quality Overrides" section -> adjusts validation criteria for Master's checkpoint
  +-- "Custom Instructions" section -> passed to relevant workers based on content match
```

### What Users Do NOT Edit

Users do NOT need to touch:
- Pipeline step files (step-01 through step-06) — these define the PROCESS
- System skills (schema-guide, gds-guide) — these are reference material
- Maps (system-map, pipeline-map) — these are navigation
- Validation rules — these are enforced by code (validate_project.py)

Users CAN optionally:
- Add domain files in `domains/` (e.g., `domains/climate-science.md`)
- Add custom skills in `custom/` (e.g., `custom/my-extraction-rules.md`)
- Edit existing domain files to refine domain-specific guidance

But 90% of users only touch `agent.md`.

---

## 6. v3 MCP Audit: What Worked, What Didn't {#6-v3-audit}

### What v3 Got Right (CARRY FORWARD)

| Pattern | Why It Works | v4 Action |
|---------|-------------|-----------|
| **Fat pipeline tool** (`memorytonic_extract`) | One MCP call does entire pipeline. Claude doesn't manage intermediate state. Atomic with cleanup on failure. | Keep. Same pattern. |
| **Spawn-and-exit NLP** | No persistent Python service, no port, no health checks. Each call loads model, processes, exits. | Keep. Exact same scripts. |
| **`ok()` / `err()` response helpers** | Every tool returns consistent `{ content: [{ type: 'text', text: JSON.stringify(data) }] }` format. | Keep. |
| **`console.error()` for logging** | stdout is MCP protocol pipe. All diagnostic output to stderr. | Keep. Critical. |
| **Health check before startup** | Verify Neo4j reachable before accepting tool calls. | Keep. |
| **Query safety** | `memorytonic_query` blocks CREATE/MERGE/DELETE/REMOVE/DROP and all GDS/APOC/DBMS procedures. | Keep. Essential security. |
| **Entity merge by name + aliases** | Same entity across projects = one node. `projectCount` tracks cardinality. | Keep. Already in upload.py. |
| **`collection_suggestions` tool** | Smart placement recommendations based on shared entities + tags. | Keep. Very useful for extraction flow. |
| **3-mode unified search** | Fulltext + semantic + graph walk. Multi-mode bonus scoring. | Keep. Most powerful discovery tool. |
| **`memorytonic_recall` (GraphRAG)** | Question -> entities + connections + chains + projects. Agent can reason over rich context. | Keep. This IS the research value. |
| **Tool grouping** | System / Extraction / Query / Entity-Project / Collections / Analysis / Admin. Clear mental model. | Keep grouping, adjust tools. |

### What v3 Got Wrong (FIX IN v4)

| Issue | Problem | v4 Fix |
|-------|---------|--------|
| **Causal chains as edge properties** | Chains stored on RELATES_TO edges. No chain-level metadata. Can't query "all chains in project" without scanning all edges. | v4 has `CausalChain` nodes + `CHAIN_LINK` edges. Already fixed in C01. |
| **19 causal types** | Too many. Researchers can't distinguish FOLLOWS_FROM from PRECEDES. Cognitive overload. | v4 reduced to 15. Dropped FOLLOWS_FROM, REPLACES, MEASURES, EXTENDS. |
| **Confidence scores on entities** | Adds noise. "0.85" next to a well-written definition is meaningless. | v4 dropped confidence entirely (D4). Quality is in the text. |
| **No validation gate** | Upload could succeed with bad data. Shallow definitions, missing evidence, wrong field names. | v4 has `validate_project.py` with 30+ rules. Mandatory before upload. |
| **Source storage at ~/.memorytonic/** | Hidden directory. Users can't find their HTML. Not portable. | v4 uses `data/sources/YYYY-MM-DD/<slug>/`. Visible, organized. |
| **No export/import** | Collections trapped in one Neo4j instance. Can't share, can't backup. | v4 has full export/import pipeline. |
| **Single-file tools.ts (1556 lines)** | Unmaintainable. All 35 tools in one file. | v4 splits into modules by group. |
| **No temporal event isolation** | Temporal events used FOLLOWS chain (shared across projects). Deleting could break other projects. | v4 uses `BELONGS_TO_PROJECT` per event. Clean isolation. |
| **No instruction layer** | Claude had to figure out extraction quality on its own. No skill files, no guidance. | v4 has full open instruction layer with skills, maps, agent.md. |
| **No workflow orchestration** | Single Claude context did everything — orientation, NLP, entities, extraction, upload. Context got messy. | v4 has master-worker pattern with isolated steps. |

### What v3 Had That v4 Drops or Defers

| v3 Tool | v4 Decision | Reason |
|---------|-------------|--------|
| `memorytonic_extract_conversation` | **DEFER** | Focus on full extraction first. Add later. |
| `memorytonic_store_insight` | **DEFER** | Quick single-entity add without pipeline. Later. |
| `memorytonic_create_project` | **DROP** | Projects should always come through extraction. |
| `memorytonic_get_skills` | **DROP** | Use `memorytonic_search` with category filter. |
| `memorytonic_communities` | **DROP** | Redundant with `memorytonic_get_collection`. |

---

## 7. v3 -> v4 Schema Differences {#7-schema-diff}

### Node Changes

| Aspect | v3 | v4 | Impact on MCP |
|--------|----|----|---------------|
| **CausalChain** | Not a node. Chains stored as edge properties. | Dedicated `CausalChain` node with `BELONGS_TO_PROJECT` edge + `CHAIN_LINK` edges between entities. | New queries needed for chain operations. |
| **DateTime** | Single node with `id`, `timestamp`, `date`, `time`, `sessionId`. `NEXT` chain. `COMMITTED_AT` from Project. | Split into date-type and time-type nodes. `datetimeId`, `date`, `time`, `year`, `month`, `day`, `type`. `ON_DATE` links time->date. `CREATED_ON` + `CREATED_AT` from Project. | Different query patterns for date navigation. |
| **Entity.confidence** | Present (0-1 float) | Dropped (D4) | Simpler entity schema. |
| **Entity.status** | 'active' / 'historical' / 'theoretical' | Not present | Not needed. |
| **Entity.searchTerms** | Array of search terms | Not present (use fulltext index on name + definition + aliases_text) | Fulltext index handles this. |
| **Entity.bridgeTier** | Stored as property | Computed at query time from projectCount + betweenness | No stored property to maintain. |
| **Collection.summary** | Present, with summaryVersion | Not present (just `description` added by C03) | Simpler collection metadata. |
| **Collection.tags** | Array of tags | Not present | Collections identified by projects, not own tags. |

### Relationship Changes

| Aspect | v3 | v4 | Impact on MCP |
|--------|----|----|---------------|
| **Project -> Directory** | `CATEGORIZED_IN` | `IN_DIRECTORY` | Different relationship name in Cypher. |
| **Project -> DateTime** | `COMMITTED_AT` (one edge) | `CREATED_ON` (->date) + `CREATED_AT` (->time) | Two edges instead of one. |
| **Temporal chaining** | `FOLLOWS` between TemporalEvents | `BELONGS_TO_PROJECT` (each event -> project) + `FIRST_APPEARS_IN` (entity -> event) | Different query structure. |
| **Entity -> TemporalEvent** | `OCCURRED_AT` | `FIRST_APPEARS_IN` | Different semantics. |
| **Chain links** | Properties on `RELATES_TO` | `CHAIN_LINK` relationship type with `chainId`, `orderIndex`, `explanation` | Separate relationship type. |
| **Collection membership** | Both `INCLUDES` and `BELONGS_TO` | Only `BELONGS_TO` (Project -> Collection) | Single direction. |

### Causal Classification Changes

| v3 (19 types) | v4 (15 types) | Notes |
|---------------|---------------|-------|
| CAUSES | CAUSES | Same |
| PRODUCES | PRODUCES | Same |
| ENABLES | ENABLES | Same |
| SUPPORTS | SUPPORTS | Same |
| BLOCKS | BLOCKS | Same |
| CONTRADICTS | CONTRADICTS | Same |
| INFLUENCES | INFLUENCES | Same |
| DEPENDS_ON | DEPENDS_ON | Same |
| PRECEDES | PRECEDES | Same |
| FOLLOWS_FROM | -- | **DROPPED.** Redundant with PRECEDES (inverse). |
| COMPETES_WITH | COMPETES_WITH | Same |
| COOPERATES_WITH | COOPERATES_WITH | Same |
| REGULATES | REGULATES | Same |
| TRANSFORMS | TRANSFORMS | Same |
| REPLACES | -- | **DROPPED.** Rare. Use TRANSFORMS. |
| MEASURES | -- | **DROPPED.** Niche. Use INFLUENCES. |
| IMPLEMENTS | IMPLEMENTS | Same |
| EXTENDS | -- | **DROPPED.** Rare. Use ENABLES. |
| CONSUMES | CONSUMES | Same |

---

## 8. Architecture Decisions {#8-architecture-decisions}

### AD1: TypeScript MCP Server + neo4j-driver (bolt) + Python subprocess

```
MCP Server (TypeScript)
+-- neo4j-driver (bolt://localhost:7687)
|   +-- ALL reads (queries, search, browse, stats)
|   +-- Simple writes (create collection, update description, add to collection)
|
+-- Python subprocess (spawn-and-exit)
|   +-- Complex pipelines: upload.py, delete_project.py, export_collection.py, import_collection.py
|   +-- GDS: gds.py
|   +-- NLP: preprocess.py, embed.py
|
+-- @modelcontextprotocol/sdk (stdio transport)
```

**Why hybrid:** MCP SDK is TypeScript. Reads are 90%+ of calls — bolt driver is fast (~1-5ms). Complex writes (upload.py = 300+ lines of entity merging, validation, GDS) stay in Python. NLP must stay Python (spaCy, sentence-transformers). Simple writes (MERGE a collection, SET a description) are 1-2 Cypher statements — no need for Python.

### AD2: Module-Per-Group File Structure

v3's single 1556-line `tools.ts` is unmaintainable. v4 splits into modules by group:

```
src/tools/
  system.ts          -- health, bootstrap, stats
  extraction.ts      -- extract, nlp_preprocess, extraction_guide
  query.ts           -- search, recall, explore, find_paths, similar, query, explain
  entity-project.ts  -- get_entity, get_project, list_projects, list_collections
  collections.ts     -- CRUD + bridges + suggestions
  directories.ts     -- list, create, update
  analysis.ts        -- importance, gaps, temporal, overlaps
  admin.ts           -- recompute, export, import, delete_project
```

### AD3: Bridge Tier Computed at Query Time

v3 stored `bridgeTier` on entity nodes. v4 computes it:
```
Gold:   projectCount >= 3
Silver: projectCount == 2
Bronze: projectCount == 1 AND betweenness > median(betweenness)
```

Stored tiers go stale when projects change. Computing at query time is always accurate.

### AD4: Validation Before Upload (Mandatory)

Every `memorytonic_extract` call runs `validate_project.py` first. If validation fails, the tool returns errors without attempting upload. HARD gate.

### AD5: Resources Served from File System

MCP resources are `.md` files in a `skills/` directory. The server reads them from disk on each `resources/read` call. No caching — files can be edited live.

URI scheme: `memorytonic://skills/{category}/{name}`

Example: `memorytonic://skills/extraction/entity-discovery` reads `skills/extraction/entity-discovery.md`

### AD6: Prompts Assemble Resources

MCP prompts don't contain hardcoded instructions. They read relevant resource files and assemble them dynamically. When `agent.md` changes, prompts automatically reflect the changes.

### AD7: No Embedded Vector Search Default

Vector search requires spawning Python to embed query (~200ms). Fulltext index handles most cases. SIMILAR_TO edges handle "find similar entities." Vector search available as opt-in mode in `memorytonic_search`.

### AD8: Skills from C01 Become Resources

C01's 14 skill files in `components/01-ingestion/skills/` are the foundation for the resource layer. They get reorganized into the `skills/` directory structure:

| C01 Skill | v4 Resource Location |
|-----------|---------------------|
| `extraction-skill.md` | `skills/extraction/entity-discovery.md` + `skills/extraction/relationship-building.md` + `skills/extraction/quality-bar.md` |
| `extraction-agent.md` | `skills/pipeline/step-03-entities.md` + `skills/pipeline/step-04-extraction.md` |
| `extraction-pipeline-skill.md` | `skills/maps/pipeline-map.md` |
| `html-template-skill.md` | `skills/extraction/html-template.md` |
| `cypher-queries-skill.md` | `skills/system/cypher-patterns.md` |
| `gds-skill.md` + `gds-catalog-skill.md` | `skills/system/gds-guide.md` |
| `neo4j-operations-skill.md` | `skills/system/schema-guide.md` |
| `maintenance-skill.md` | `skills/system/maintenance-guide.md` |
| `nlp-setup-skill.md` | `skills/pipeline/step-02-nlp.md` |
| `import-pipeline-skill.md` | `skills/system/export-import-guide.md` |
| `checklist-template.md` | `skills/pipeline/validation-rules.md` |
| `extraction-checklist.md` | `skills/extraction/quality-bar.md` (merged) |

---

## 9. Tool Inventory (36 tools) {#9-tool-inventory}

### Group 1: System (3 tools)

| # | Tool | Input | Returns | Calls |
|---|------|-------|---------|-------|
| 1 | `memorytonic_health` | `{}` | `{ neo4j, nlpInstalled, gdsAvailable, entityCount, projectCount, skillsAvailable }` | Neo4j + Python + GDS + skills dir check |
| 2 | `memorytonic_bootstrap` | `{}` | `{ success, constraints, indexes, directories }` | Python: `bootstrap.py` |
| 3 | `memorytonic_stats` | `{}` | `{ projects, entities, collections, directories, relationships, chains, bridges, embeddings, similarPairs }` | Neo4j: count queries |

### Group 2: Extraction (3 tools)

| # | Tool | Input | Returns | Calls |
|---|------|-------|---------|-------|
| 4 | `memorytonic_extraction_guide` | `{ contentType? }` | `{ protocol, qualityBar, categories, causalTypes, fieldNames, traps }` | Reads extraction skill files |
| 5 | `memorytonic_nlp_preprocess` | `{ text, title? }` | `{ entityCandidates[], coOccurrences[], keywords[], dedupGroups[] }` | Python: `preprocess.py` |
| 6 | `memorytonic_extract` | See [Extraction Payload](#extraction-payload) below | `{ projectId, stats, bridges[], embeddingCount, durationMs }` | Python: validate -> upload -> embed -> gds |

#### Extraction Payload {#extraction-payload}

```typescript
{
  // Step 01: Placement
  placement: {
    directory: string,          // "Research" | "Business" | "Personal" | custom
    project_name: string,       // kebab-case slug
    unique_id: string,          // MUST match project_name
    collection: string,         // collection name (existing or new)
    collection_is_new: boolean  // true if creating new collection
  },

  // Step 01: HTML content
  html_content: string,         // Full styled HTML (dark theme template)

  // Step 03: Entities
  entities: {
    temporal_phases: Array<{
      index: number,
      label: string,
      period: string             // "1944-1971" or "Phase 1"
    }>,
    entities: Array<{
      name: string,
      aliases: string[],         // 2-3 known alternative names
      category: string,          // one of 14 fixed categories
      definition: string,        // 100+ chars, system mechanics
      role: string,              // stance + mechanics + reasoning
      first_appearance_index: number
    }>
  },

  // Step 04: Extraction
  extraction: {
    project: {
      name: string,              // human-readable title
      unique_id: string,         // MUST match placement.unique_id
      summary: string,           // 200+ words, system mechanics
      narrative_flow: string[],  // 4+ ordered key moments
      tags: {
        domain: string,
        subdomain: string,
        base_tags: string[]      // 3+ tags
      }
    },
    relationships: Array<{
      source: string,            // entity name
      target: string,            // entity name
      relType: string,           // specific verb
      causalClassification: string, // one of 15 families
      description: string,       // 80+ chars, HOW it works
      evidence: string,          // exact quote from source
      evidenceStrength: string,  // established | claimed | disputed | speculative
      magnitude: string,         // foundational | significant | marginal
      year: string               // when (flexible format)
    }>,
    causal_chains: Array<{
      name: string,
      description: string,
      links: Array<{
        source: string,
        target: string,
        explanation: string      // HOW and WHY, system mechanics
      }>
    }>
  }
}
```

**What happens inside `memorytonic_extract`:**

```
1. Receive full payload from Claude
2. Write artifacts to temp directory:
   - 01_html.html       <- from payload.html_content
   - 02_placement.json  <- from payload.placement
   - 04_all_entities.json <- from payload.entities
   - 06_extraction.json <- from payload.extraction
3. Spawn: python validate_project.py <temp-dir>
   - If FAIL -> return errors, abort, cleanup temp
4. Spawn: python nlp/embed.py
   - Input: entity definitions + roles + project summary
   - Output: 05_embeddings.json -> written to temp-dir
5. Spawn: python neo4j/upload.py <temp-dir>
   - Creates project, entities, relationships, chains, temporal events
   - Moves artifacts to permanent storage
6. Spawn: python neo4j/gds.py
   - Recomputes PageRank, Betweenness, Degree, Node Similarity
7. Return success with stats
```

### Group 3: Query & Search (7 tools)

| # | Tool | Input | Returns | Notes |
|---|------|-------|---------|-------|
| 7 | `memorytonic_search` | `{ query, limit?, mode?: 'fulltext'\|'semantic'\|'hybrid' }` | `{ results[], count }` | Default: fulltext. Semantic requires Python embed spawn. |
| 8 | `memorytonic_recall` | `{ question, depth?, limit? }` | `{ entities[], connections[], causalChains[], projects[], context }` | The GraphRAG tool. Rich context for AI reasoning. |
| 9 | `memorytonic_explore` | `{ entityName, hops?: 1-3, limit? }` | `{ startEntity, neighbors[], edges[], count }` | N-hop neighborhood. Default 2 hops. Cap 3. |
| 10 | `memorytonic_find_paths` | `{ from, to, maxHops?: 6 }` | `{ paths[] \| null }` | Shortest path(s) between two entities. |
| 11 | `memorytonic_similar` | `{ entityName, limit? }` | `{ similar[] }` | Pre-computed SIMILAR_TO edges + embedding fallback. |
| 12 | `memorytonic_query` | `{ cypher, params? }` | `{ results[], count }` | Raw read-only Cypher. Blocks writes. Max 4096 chars. |
| 13 | `memorytonic_explain` | `{ entity1, entity2 }` | `{ directEdges[], paths[], sharedProjects[], connected }` | How two entities connect (direct + indirect). |

### Group 4: Entity & Project (4 tools)

| # | Tool | Input | Returns | Notes |
|---|------|-------|---------|-------|
| 14 | `memorytonic_get_entity` | `{ name }` | `{ entity, projects[], relationships[], chains[], similar[], metrics }` | Full entity profile. Role per project. |
| 15 | `memorytonic_get_project` | `{ uniqueId }` | `{ project, entities[], relationships[], chains[], temporalPhases[], relatedProjects[] }` | Full project view. |
| 16 | `memorytonic_list_projects` | `{ directory?, collection?, limit? }` | `{ projects[], total }` | Browse by scope. |
| 17 | `memorytonic_list_collections` | `{}` | `{ collections[], total }` | All collections with stats. |

### Group 5: Collections (7 tools)

| # | Tool | Input | Returns | Notes |
|---|------|-------|---------|-------|
| 18 | `memorytonic_get_collection` | `{ name }` | `{ collection, projects[], bridges[], topEntities[], stats }` | Full collection view. |
| 19 | `memorytonic_create_collection` | `{ name, description? }` | `{ collection }` | Create empty collection. |
| 20 | `memorytonic_update_collection` | `{ name, description }` | `{ updated }` | Set/update description. |
| 21 | `memorytonic_delete_collection` | `{ name }` | `{ deleted }` | Removes collection + BELONGS_TO. Does NOT delete projects. |
| 22 | `memorytonic_add_to_collection` | `{ projectUniqueId, collectionName }` | `{ added }` | Add project to collection. |
| 23 | `memorytonic_remove_from_collection` | `{ projectUniqueId, collectionName }` | `{ removed, orphaned }` | Warns if last collection. |
| 24 | `memorytonic_collection_bridges` | `{ name }` | `{ bridges[] }` | Bridge entities within collection. |

### Group 6: Directories (3 tools)

| # | Tool | Input | Returns | Notes |
|---|------|-------|---------|-------|
| 25 | `memorytonic_list_directories` | `{}` | `{ directories[] }` | All directories with stats. |
| 26 | `memorytonic_create_directory` | `{ name, description }` | `{ created }` | Create custom directory. |
| 27 | `memorytonic_update_directory` | `{ name, description }` | `{ updated }` | Update description. |

### Group 7: Analysis (5 tools)

| # | Tool | Input | Returns | Notes |
|---|------|-------|---------|-------|
| 28 | `memorytonic_importance` | `{ metric?, collection?, limit? }` | `{ entities[] }` | Top entities by GDS metric. |
| 29 | `memorytonic_gaps` | `{ collection? }` | `{ isolated[], underConnected[], potentialLinks[] }` | Research gap detection. |
| 30 | `memorytonic_temporal` | `{ projectUniqueId }` | `{ phases[] }` | Project timeline with entity appearances. |
| 31 | `memorytonic_detect_overlaps` | `{ minProjects?, limit? }` | `{ overlaps[] }` | Cross-project entity overlaps. |
| 32 | `memorytonic_collection_suggestions` | `{ projectName, summary, entityNames[], tags[] }` | `{ directory, collections[], isNew }` | Smart placement for extraction. |

### Group 8: Admin (4 tools)

| # | Tool | Input | Returns | Notes |
|---|------|-------|---------|-------|
| 33 | `memorytonic_recompute` | `{}` | `{ pageRank, betweenness, degree, similarity, duration }` | Rerun all GDS algorithms. |
| 34 | `memorytonic_export` | `{ collectionName }` | `{ zipPath, stats }` | Export collection as portable ZIP. |
| 35 | `memorytonic_import` | `{ zipPath, directory?, collectionName? }` | `{ imported, skipped, failed, duration }` | Import collection from ZIP. |
| 36 | `memorytonic_delete_project` | `{ uniqueId }` | `{ deleted, cascadeStats }` | Cascade delete + cleanup. |

---

## 10. Resource Inventory (Open Instruction Layer) {#10-resource-inventory}

Resources are `.md` files served via MCP `resources/read`. URI scheme: `memorytonic://skills/{path}`

### Maps (Navigation)

| Resource URI | File | Purpose |
|-------------|------|---------|
| `memorytonic://skills/maps/system-map` | `skills/maps/system-map.md` | Full system architecture — components, data flow, where things live |
| `memorytonic://skills/maps/pipeline-map` | `skills/maps/pipeline-map.md` | The 6-step pipeline: step order, inputs/outputs, skill references, validation criteria, failure handling |
| `memorytonic://skills/maps/skill-index` | `skills/maps/skill-index.md` | Index of ALL skills with one-line descriptions and URIs |

**pipeline-map.md** is the master's playbook. Structure per step:

```markdown
## Step 03: Entity Discovery
- purpose: Review NLP candidates against full text. Add missed entities. Write definitions and roles.
- worker-instructions: memorytonic://skills/pipeline/step-03-entities
- skills-needed:
  - memorytonic://skills/extraction/entity-discovery
  - memorytonic://skills/extraction/quality-bar
  - [agent.md domain skill if configured]
- tools-available: none (pure Claude reasoning)
- inputs: raw text, 03_nlp_entities.json
- outputs: 04_all_entities.json
- validation:
  - entities array has 10+ items
  - every entity has: name, aliases[], category, definition (100+ chars), role, first_appearance_index
  - no duplicate entity names
  - category distribution: not all "Other"
  - temporal_phases present with 2+ phases
- on-failure: retry once with specific feedback, then escalate
```

### Pipeline Instructions (Step-by-Step Process)

| Resource URI | File | Purpose |
|-------------|------|---------|
| `memorytonic://skills/pipeline/step-00-bootstrap` | `skills/pipeline/step-00-bootstrap.md` | Schema setup — when needed, what it creates |
| `memorytonic://skills/pipeline/step-01-html-placement` | `skills/pipeline/step-01-html-placement.md` | HTML conversion rules + directory/collection assignment flow |
| `memorytonic://skills/pipeline/step-02-nlp` | `skills/pipeline/step-02-nlp.md` | NLP preprocessing — what to expect, how to interpret results |
| `memorytonic://skills/pipeline/step-03-entities` | `skills/pipeline/step-03-entities.md` | Entity discovery — review NLP, add missed, write definitions |
| `memorytonic://skills/pipeline/step-04-extraction` | `skills/pipeline/step-04-extraction.md` | Full extraction — relationships, chains, summary, tags |
| `memorytonic://skills/pipeline/step-05-embeddings` | `skills/pipeline/step-05-embeddings.md` | Embedding generation — what gets embedded, fallback behavior |
| `memorytonic://skills/pipeline/step-06-upload` | `skills/pipeline/step-06-upload.md` | Upload + GDS — what happens, how to verify success |
| `memorytonic://skills/pipeline/validation-rules` | `skills/pipeline/validation-rules.md` | All 30+ validation rules from validate_project.py, explained |
| `memorytonic://skills/pipeline/retry-guide` | `skills/pipeline/retry-guide.md` | What to do when steps fail — retry strategies, escalation |

### Extraction Skills (Claude's Intelligence)

| Resource URI | File | Purpose |
|-------------|------|---------|
| `memorytonic://skills/extraction/entity-discovery` | `skills/extraction/entity-discovery.md` | How to find entities, write definitions (100+ chars), write roles (stance + mechanics + reasoning), assign categories |
| `memorytonic://skills/extraction/relationship-building` | `skills/extraction/relationship-building.md` | How to identify relationships, write descriptions (80+ chars), choose relType + causalClassification, evidence rules |
| `memorytonic://skills/extraction/causal-chains` | `skills/extraction/causal-chains.md` | How to construct causal chains — system mechanics, link ordering, explanation depth |
| `memorytonic://skills/extraction/html-template` | `skills/extraction/html-template.md` | Dark theme HTML template with NARRATOR/GATORSQUARE voice blocks |
| `memorytonic://skills/extraction/quality-bar` | `skills/extraction/quality-bar.md` | Quality requirements with passing/failing examples |

### Analysis Skills

| Resource URI | File | Purpose |
|-------------|------|---------|
| `memorytonic://skills/analysis/bridge-detection` | `skills/analysis/bridge-detection.md` | How bridge entities work, tiers (Gold/Silver/Bronze), research value |
| `memorytonic://skills/analysis/gap-analysis` | `skills/analysis/gap-analysis.md` | How to detect research gaps, potential missing relationships |
| `memorytonic://skills/analysis/collection-analysis` | `skills/analysis/collection-analysis.md` | How to analyze a collection — key entities, themes, cross-project patterns |
| `memorytonic://skills/analysis/entity-comparison` | `skills/analysis/entity-comparison.md` | How to compare entities across projects — shared connections, different roles |

### System Skills (Reference Material)

| Resource URI | File | Purpose |
|-------------|------|---------|
| `memorytonic://skills/system/schema-guide` | `skills/system/schema-guide.md` | Full Neo4j schema — all node types, relationships, properties, constraints, indexes |
| `memorytonic://skills/system/gds-guide` | `skills/system/gds-guide.md` | GDS algorithms available — PageRank, Betweenness, Degree, Node Similarity. When to use each. |
| `memorytonic://skills/system/cypher-patterns` | `skills/system/cypher-patterns.md` | Common Cypher query patterns for MemoryTonic's schema |
| `memorytonic://skills/system/maintenance-guide` | `skills/system/maintenance-guide.md` | Database maintenance — cleanup, recomputation, health checks |
| `memorytonic://skills/system/export-import-guide` | `skills/system/export-import-guide.md` | Export/import operations — ZIP format, graph.json structure, import pipeline |

### Domain Skills (Domain-Specific Extraction Guidance)

| Resource URI | File | Purpose |
|-------------|------|---------|
| `memorytonic://skills/domains/geopolitics` | `skills/domains/geopolitics.md` | Geopolitics extraction — sanctions, treaties, institutional mechanics, power dynamics |
| `memorytonic://skills/domains/finance` | `skills/domains/finance.md` | Finance extraction — instruments, flows, regulatory bodies, systemic risk |
| `memorytonic://skills/domains/technology` | `skills/domains/technology.md` | Technology extraction — systems, protocols, dependencies, adoption patterns |

Domain skills are loaded when `agent.md` specifies a domain or when Claude auto-detects from content.

### Custom Skills (User-Created)

`skills/custom/` is empty by default. Users can add their own `.md` files:

```
skills/custom/
  my-extraction-rules.md    -- user's additional extraction guidance
  academic-papers.md        -- how to handle academic paper format
  legal-analysis.md         -- legal document extraction patterns
```

Custom skills show up in `memorytonic://skills/maps/skill-index` automatically (MCP server scans the directory).

### agent.md (User Configuration)

`memorytonic://skills/agent` serves the user's `agent.md` file. This is the primary customization file (see [Section 5](#5-agent-md)).

### Resource List Summary

| Category | Count | Editable by User |
|----------|-------|-----------------|
| Maps | 3 | No (generated/maintained by system) |
| Pipeline | 9 | No (defines the locked process) |
| Extraction | 5 | Yes (refine extraction guidance) |
| Analysis | 4 | Yes (refine analysis approach) |
| System | 5 | No (reference material) |
| Domains | 3+ | Yes (add/edit domain expertise) |
| Custom | 0+ | Yes (user-created) |
| agent.md | 1 | Yes (primary user file) |
| **Total** | **~30** | |

---

## 11. Prompt Inventory (Workflow Combinators) {#11-prompt-inventory}

Prompts assemble resources + context into ready-to-use instructions. Claude calls `prompts/get` and receives a fully assembled prompt.

### extract-document

**Purpose:** Full extraction pipeline orchestration.

**Assembles:**
1. `pipeline-map.md` — the 6-step flow
2. `agent.md` — user customization
3. `extraction/quality-bar.md` — quality requirements
4. Relevant domain skill (if agent.md specifies one)

**Returns:** A complete instruction set that tells master Claude:
- The exact pipeline steps and order
- What skills each worker needs
- Validation criteria between steps
- User's custom preferences
- Quality bar to enforce

**Usage:**
```
Claude: prompts/get("extract-document", { contentType: "geopolitics" })
MCP returns: assembled orchestration instructions
Claude reads instructions, begins master-worker flow
```

### analyze-collection

**Purpose:** Deep collection analysis.

**Assembles:**
1. `analysis/collection-analysis.md`
2. `analysis/bridge-detection.md`
3. `analysis/gap-analysis.md`
4. `agent.md` (relevant sections)

**Returns:** Instructions for analyzing a collection — what to look for, how to interpret GDS metrics, how to identify research gaps and cross-project patterns.

### explore-entity

**Purpose:** Entity deep-dive investigation.

**Assembles:**
1. `analysis/entity-comparison.md`
2. `system/schema-guide.md` (entity-relevant sections)
3. `agent.md` (relevant sections)

**Returns:** Instructions for investigating an entity across projects — what roles it plays, how connections differ, what's potentially missing.

### research-gaps

**Purpose:** Find what's missing in the knowledge graph.

**Assembles:**
1. `analysis/gap-analysis.md`
2. `analysis/bridge-detection.md`
3. `agent.md` (relevant sections)

**Returns:** Instructions for systematic gap detection — isolated entities, underconnected nodes, potential missing relationships, suggested follow-up research.

### maintenance-check

**Purpose:** Database health and maintenance.

**Assembles:**
1. `system/maintenance-guide.md`
2. `system/schema-guide.md`

**Returns:** Instructions for running maintenance — GDS recomputation, orphan cleanup, integrity checks.

---

## 12. The Extraction Flow (Master-Worker) {#12-extraction-flow}

### Full Flow

```
USER: "Here's a document about [topic]. Extract it into MemoryTonic."

MASTER:
  1. Calls: prompts/get("extract-document") --> gets assembled orchestration instructions
  2. Reads: agent.md preferences (via resource)
  3. Reads the raw text from user

--- WORKER 1: HTML + Placement ---
  Instructions: step-01-html-placement + html-template skill
  Actions:
    - Convert raw text to formatted HTML (dark theme, NARRATOR/GATORSQUARE voices)
    - Call memorytonic_collection_suggestions({ projectName, summary, entityNames, tags })
    - Present to user: "Suggested directory: Research, Collection: Global Finance (8 shared entities)"
    - User confirms or modifies
  Outputs: 01_html.html + 02_placement.json

MASTER VALIDATES: HTML exists, placement has directory + collection + project_name + unique_id

--- WORKER 2: NLP Preprocessing ---
  Instructions: step-02-nlp + nlp-setup skill
  Actions:
    - Call memorytonic_nlp_preprocess({ text, title })
  Outputs: 03_nlp_entities.json

MASTER VALIDATES: JSON valid, entityCandidates array non-empty

--- WORKER 3: Entity Discovery [CLAUDE REASONING] ---
  Instructions: step-03-entities + entity-discovery skill + quality-bar skill
    + domain skill (if configured) + agent.md extraction prefs
  Context: raw text + 03_nlp_entities.json
  Actions:
    - Review NLP candidates against full text
    - Keep valid candidates, drop noise (e.g., "the", "however")
    - Add missed entities with full definitions (100+ chars) + roles
    - Assign categories from 14 fixed set
    - Identify temporal phases, map entity first appearances
    - Write aliases for cross-project merge potential
  Outputs: 04_all_entities.json

MASTER VALIDATES:
  - 10+ entities
  - All definitions 100+ chars
  - All categories from fixed set
  - No duplicate names
  - 2+ temporal phases
  - Aliases present on entities with common abbreviations

--- WORKER 4: Full Extraction [CLAUDE REASONING] ---
  Instructions: step-04-extraction + relationship-building skill + causal-chains skill
    + agent.md extraction prefs
  Context: raw text + 04_all_entities.json
  Actions:
    - Write project summary (200+ words, system mechanics, adaptive to content type)
    - Write narrative flow (4+ key moments)
    - Assign tags (domain, subdomain, base_tags)
    - Build relationships (15+, each with 80+ char description + evidence quote)
      KEY: Create DIRECT edges where source text describes direct relationships
    - Construct causal chains (2+, system mechanics, entity-driven)
  Outputs: 06_extraction.json

MASTER VALIDATES:
  - 15+ relationships
  - All descriptions 80+ chars
  - Evidence quotes present (not paraphrased)
  - 2+ causal chains
  - All causalClassification values from 15 fixed set
  - Summary 200+ words
  - 4+ narrative flow items
  - 3+ base tags

--- WORKER 5 + 6: Upload (Combined) ---
  Instructions: step-05-embeddings + step-06-upload
  Actions:
    - Call memorytonic_extract(full_payload)
      Internally: validate -> embed -> upload -> GDS recompute
  Outputs: { projectId, stats, bridges, durationMs }

MASTER VALIDATES:
  - Tool returned success
  - Optionally: call memorytonic_get_project to verify in Neo4j

MASTER REPORTS:
  "Extracted: 45 entities, 28 relationships, 3 causal chains.
   Bridge entities: IMF (Gold, 4 projects), Saudi Arabia (Silver, 2 projects).
   Graph metrics recomputed. Duration: 12.4s."
```

### Minimal Flow (Experienced Users)

For users who don't need the full conversation:

```
Claude reads extraction guide + agent.md
Claude calls: memorytonic_nlp_preprocess (parallel ok)
Claude does all entity + extraction work in one pass
Claude calls: memorytonic_extract(full_payload)
Done. 2-3 tool calls.
```

### Key Design Principles

1. **Claude does the hard work.** MCP tools are infrastructure. Entity discovery, relationship writing, causal chain construction — that's Claude's intelligence.

2. **NLP is a starting point.** NLP candidates are suggestions. Claude verifies, enriches, and adds missing entities.

3. **Placement is collaborative.** `collection_suggestions` recommends, user confirms.

4. **Upload is atomic.** One tool call. All-or-nothing. If validation fails, nothing touches Neo4j.

5. **Quality bar is enforced.** Extraction skills teach Claude the rules. Validation gate enforces them.

6. **Workers are isolated.** Each worker gets exactly what it needs. No context pollution.

7. **Master validates between steps.** No step proceeds without validation.

---

## 13. Edge Cases, Traps, and Constraints {#13-edge-cases}

### E1: Multiple RELATES_TO Edges Between Same Entity Pair

**Behavior:** `upload.py` uses `CREATE` (not `MERGE`) for relationships. Two entities CAN have multiple edges.

**When correct:** Different relType, different evidence, different time period. Example:
- A -> B via CAUSES (Project X evidence)
- A -> B via ENABLES (Project Y evidence)
- A -> B via BLOCKS (Project Z evidence, different period)

**When a bug:** Same relType, same description, same evidence = extraction error.

**MCP Implication:** Query tools return ALL edges between entities. Extraction skills must prevent duplicates.

### E2: Indirect Connections (The "Trump" Problem)

Entity A and B appear in same document. Connected through intermediaries (A->C->D->B) but no direct edge.

**Not always a bug.** If source text doesn't describe a direct relationship, there should be no direct edge. Graph reflects the SOURCE, not inference.

**IS a bug** if source text DOES describe a direct relationship and Claude didn't create one.

Extraction skills must emphasize: "If the source text describes a direct relationship between two entities — even if they seem distantly connected — you MUST create a direct RELATES_TO edge."

`memorytonic_gaps` should flag entity pairs that share a project but have no direct edge with a path of length 2-3.

### E3: Entity Name Collisions Across Projects

"Turkey" (country) vs "Turkey" (animal). Entity merge is by name + aliases. If names match, they merge.

**Mitigation:** Definitions disambiguate. Role is per-project. In practice, MemoryTonic's research content is domain-specific enough that collisions are rare.

### E4: Collection Name Uniqueness

Collections matched by name (case-insensitive in export/import). `memorytonic_create_collection` should check for similar names (fuzzy match) and warn.

### E5: Directory Name Uniqueness

`DirectoryCategory.name` has UNIQUE constraint. `memorytonic_create_directory` checks existence first.

### E6: Project unique_id Must Match project_name

`validate_project.py` enforces this. Extraction skills make this explicit.

### E7: Minimum Content Thresholds

| Field | Minimum | On Failure |
|-------|---------|------------|
| Entity definitions | 100 chars | Validation FAILS |
| Relationship descriptions | 80 chars | Validation FAILS |
| Project summary | 200 words | Validation FAILS |
| Narrative flow | 4 items | Validation FAILS |
| Base tags | 3 items | Validation FAILS |
| Entities | 10 total | Validation FAILS |
| Relationships | 15 total | Validation FAILS |
| Causal chains | 2 total | Validation FAILS |
| Temporal phases | 2 total | Validation FAILS |

### E8: Embedding Failures Are Non-Fatal

If Python/BERT unavailable, extraction completes without embeddings. Semantic search won't find them. `memorytonic_extract` returns `embeddingsGenerated: false` as warning.

### E9: GDS Plugin Optional

If GDS not installed, `gds.py` fails silently. No PageRank, no betweenness, no SIMILAR_TO. `memorytonic_health` reports `gdsAvailable: false`.

### E10: HTML Path Dependency

`upload.py` stores HTML at `data/sources/YYYY-MM-DD/<slug>/01_html.html` and writes path to `Project.htmlPath`. MCP server must know C01 data directory. Configured via `MEMORYTONIC_DATA_DIR`.

### E11: CHAIN_LINK vs RELATES_TO

Entity pair can have BOTH a RELATES_TO edge AND a CHAIN_LINK edge. This is correct. RELATES_TO = relationship exists. CHAIN_LINK = part of a causal narrative in specific order. Query tools include BOTH edge types.

### E12: Neo4j Integer Conversion

Neo4j returns 64-bit Integer objects. Must convert with `integer.toNumber()` recursively. The `toPlain()` helper is mandatory for every query result.

---

## 14. Data Access Layer Design {#14-data-access-layer}

### TypeScript Neo4j Driver (Reads + Simple Writes)

```typescript
// neo4j/driver.ts — Singleton connection manager
import neo4j, { type Driver, Integer } from 'neo4j-driver';

const config = {
  uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
  user: process.env.NEO4J_USER ?? 'neo4j',
  password: process.env.NEO4J_PASSWORD, // Supply credentials through the local environment.
  database: process.env.NEO4J_DATABASE ?? 'memorytonic',
};

let _driver: Driver | null = null;

function getDriver(): Driver { ... }
function getSession() { return getDriver().session({ database: config.database }); }

async function runRead<T>(cypher: string, params = {}): Promise<T[]> {
  const session = getSession();
  try {
    const result = await session.executeRead((tx) => tx.run(cypher, params));
    return result.records.map((r) => toPlain(r.toObject()) as T);
  } finally {
    await session.close();  // ALWAYS in finally (Trap T14)
  }
}

async function runWrite<T>(cypher: string, params = {}): Promise<T[]> { ... }

// CRITICAL: Recursive Neo4j Integer -> JS number conversion
function toPlain(obj: unknown): unknown {
  if (Integer.isInteger(obj)) return (obj as Integer).toNumber();
  if (Array.isArray(obj)) return obj.map(toPlain);
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, toPlain(v)])
    );
  }
  return obj;
}

async function healthCheck(): Promise<{ connected: boolean; error?: string }> { ... }
async function closeDriver(): Promise<void> { ... }
```

### Python Subprocess Bridge

```typescript
// python/spawn.ts — Generic spawn-and-exit
import { spawn } from 'child_process';

const SCRIPT_TIMEOUT = 120_000;  // 2 min for normal scripts
const GDS_TIMEOUT = 300_000;     // 5 min for GDS
const SETUP_TIMEOUT = 600_000;   // 10 min for NLP setup

interface SpawnResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  stderr?: string;
  exitCode?: number;
}

async function spawnPython<T>(
  scriptPath: string,
  args: string[] = [],
  stdin?: string,
  timeout = SCRIPT_TIMEOUT
): Promise<SpawnResult<T>> {
  return new Promise((resolve) => {
    const python = findPython();  // Check .venv first, then system
    if (!python) {
      resolve({ ok: false, error: 'Python not available' });
      return;
    }

    const proc = spawn(python, [scriptPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: INGESTION_DIR,  // Run from C01 directory
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ ok: false, error: `Timeout after ${timeout}ms` });
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        try {
          resolve({ ok: true, data: JSON.parse(stdout) as T });
        } catch {
          resolve({ ok: false, error: 'Failed to parse output', stderr });
        }
      } else {
        resolve({ ok: false, exitCode: code ?? undefined, stderr });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });

    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }
  });
}
```

### Script Wrappers

```typescript
// python/scripts.ts — Typed wrappers for each C01 script

async function runValidate(projectDir: string): Promise<ValidationResult> {
  return spawnPython('neo4j/validate_project.py', [projectDir]);
}

async function runUpload(projectDir: string): Promise<UploadResult> {
  return spawnPython('neo4j/upload.py', [projectDir]);
}

async function runGds(flags?: string[]): Promise<GdsResult> {
  return spawnPython('neo4j/gds.py', flags ?? [], undefined, GDS_TIMEOUT);
}

async function runDeleteProject(uniqueId: string): Promise<DeleteResult> {
  return spawnPython('neo4j/delete_project.py', [uniqueId]);
}

async function runExport(collectionName: string): Promise<ExportResult> {
  return spawnPython('neo4j/export_collection.py', [collectionName]);
}

async function runImport(zipPath: string, flags?: string[]): Promise<ImportResult> {
  return spawnPython('neo4j/import_collection.py', [zipPath, ...(flags ?? [])], undefined, GDS_TIMEOUT);
}

async function runPreprocess(text: string, title?: string): Promise<NlpResult> {
  return spawnPython('nlp/preprocess.py', [], JSON.stringify({ text, title: title ?? '' }));
}

async function runEmbed(texts: string[], names: string[]): Promise<EmbedResult> {
  return spawnPython('nlp/embed.py', [], JSON.stringify({ texts, names }));
}
```

### Resource Server

```typescript
// resources/server.ts — Serve .md files as MCP resources

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

// List all available resources
async function listResources(): Promise<Resource[]> {
  const files = await globMarkdown(SKILLS_DIR);
  return files.map((f) => ({
    uri: `memorytonic://skills/${relativePath(f)}`,
    name: basename(f, '.md'),
    description: readFirstLine(f),  // First line of .md = description
    mimeType: 'text/markdown',
  }));
}

// Read a specific resource
async function readResource(uri: string): Promise<string> {
  const relPath = uri.replace('memorytonic://skills/', '');
  const filePath = path.join(SKILLS_DIR, `${relPath}.md`);
  if (!existsSync(filePath)) throw new Error(`Resource not found: ${uri}`);
  return readFileSync(filePath, 'utf-8');
}
```

### Prompt Assembler

```typescript
// prompts/assembler.ts — Combine resources into workflow prompts

async function assemblePrompt(name: string, args?: Record<string, string>): Promise<string> {
  switch (name) {
    case 'extract-document': {
      const pipelineMap = await readResource('memorytonic://skills/maps/pipeline-map');
      const agentMd = await readResource('memorytonic://skills/agent');
      const qualityBar = await readResource('memorytonic://skills/extraction/quality-bar');

      let domainSkill = '';
      if (args?.contentType) {
        try {
          domainSkill = await readResource(`memorytonic://skills/domains/${args.contentType}`);
        } catch { /* domain not found, skip */ }
      }

      return [
        '# Extraction Pipeline Instructions\n',
        '## Pipeline Flow\n', pipelineMap,
        '\n## Quality Requirements\n', qualityBar,
        '\n## User Preferences\n', agentMd,
        domainSkill ? `\n## Domain: ${args!.contentType}\n${domainSkill}` : '',
      ].join('\n');
    }

    case 'analyze-collection': { ... }
    case 'explore-entity': { ... }
    case 'research-gaps': { ... }
    case 'maintenance-check': { ... }
  }
}
```

---

## 15. Directory Structure {#15-directory-structure}

```
components/04-mcp/
+-- DESIGN-SPEC.md              <-- This file
+-- STATUS.md                   <-- OPEN | CLOSED
+-- README.md                   <-- Setup + architecture
+-- package.json
+-- tsconfig.json
+-- .env                        <-- NEO4J_URI, NEO4J_PASSWORD, MEMORYTONIC_DATA_DIR
+-- src/
|   +-- index.ts                <-- Entry point, stdio transport
|   +-- server.ts               <-- McpServer: tools + resources + prompts registration
|   +-- tools/
|   |   +-- system.ts           <-- health, bootstrap, stats
|   |   +-- extraction.ts       <-- extract, nlp_preprocess, extraction_guide
|   |   +-- query.ts            <-- search, recall, explore, find_paths, similar, query, explain
|   |   +-- entity-project.ts   <-- get_entity, get_project, list_projects, list_collections
|   |   +-- collections.ts      <-- CRUD + bridges + suggestions
|   |   +-- directories.ts      <-- list, create, update
|   |   +-- analysis.ts         <-- importance, gaps, temporal, overlaps
|   |   +-- admin.ts            <-- recompute, export, import, delete_project
|   +-- neo4j/
|   |   +-- driver.ts           <-- Singleton driver + runRead/runWrite + toPlain
|   |   +-- queries.ts          <-- All Cypher query functions
|   +-- python/
|   |   +-- spawn.ts            <-- Generic spawn-and-exit helper
|   |   +-- scripts.ts          <-- Typed wrappers for C01 scripts
|   +-- resources/
|   |   +-- server.ts           <-- Resource listing + reading
|   +-- prompts/
|   |   +-- assembler.ts        <-- Prompt assembly logic
|   +-- types/
|   |   +-- index.ts            <-- All TypeScript interfaces
|   +-- helpers/
|   |   +-- ok-err.ts           <-- ok() and err() response helpers
|   |   +-- validators.ts       <-- Input validation helpers
|   +-- constants/
|       +-- index.ts            <-- Categories, causal types, enums
+-- skills/                     <-- THE OPEN INSTRUCTION LAYER
|   +-- maps/
|   |   +-- system-map.md
|   |   +-- pipeline-map.md
|   |   +-- skill-index.md
|   +-- pipeline/
|   |   +-- step-00-bootstrap.md
|   |   +-- step-01-html-placement.md
|   |   +-- step-02-nlp.md
|   |   +-- step-03-entities.md
|   |   +-- step-04-extraction.md
|   |   +-- step-05-embeddings.md
|   |   +-- step-06-upload.md
|   |   +-- validation-rules.md
|   |   +-- retry-guide.md
|   +-- extraction/
|   |   +-- entity-discovery.md
|   |   +-- relationship-building.md
|   |   +-- causal-chains.md
|   |   +-- html-template.md
|   |   +-- quality-bar.md
|   +-- analysis/
|   |   +-- bridge-detection.md
|   |   +-- gap-analysis.md
|   |   +-- collection-analysis.md
|   |   +-- entity-comparison.md
|   +-- system/
|   |   +-- schema-guide.md
|   |   +-- gds-guide.md
|   |   +-- cypher-patterns.md
|   |   +-- maintenance-guide.md
|   |   +-- export-import-guide.md
|   +-- domains/
|   |   +-- geopolitics.md
|   |   +-- finance.md
|   |   +-- technology.md
|   +-- custom/                 <-- Empty by default. User-created skills.
|   +-- agent.md                <-- THE ONE FILE users edit
+-- tests/
|   +-- tools/
|   +-- neo4j/
|   +-- resources/
|   +-- prompts/
+-- contracts/
    +-- electron-contract.md    <-- What C05 needs from C04
```

---

## 16. Implementation Plan {#16-implementation-plan}

### Phase 1: Foundation (Code Layer)

**Goal:** MCP server runs, connects to Neo4j, serves tools. No instruction layer yet.

| Step | Task | Output |
|------|------|--------|
| 1.1 | Initialize npm project, install deps | `package.json`, `tsconfig.json` |
| 1.2 | Write `neo4j/driver.ts` — singleton, runRead, runWrite, toPlain | Neo4j connected |
| 1.3 | Write `python/spawn.ts` + `python/scripts.ts` | Python bridge working |
| 1.4 | Write `helpers/ok-err.ts` + `constants/index.ts` + `types/index.ts` | Infrastructure |
| 1.5 | Write `server.ts` + `index.ts` — McpServer with stdio | Server starts |
| 1.6 | Write `tools/system.ts` — health, bootstrap, stats | 3 tools |
| 1.7 | Write `tools/query.ts` — search, recall, explore, find_paths, similar, query, explain | 7 tools |
| 1.8 | Write `tools/entity-project.ts` — get_entity, get_project, list_projects, list_collections | 4 tools |
| 1.9 | Write `tools/collections.ts` — all 7 collection tools | 7 tools |
| 1.10 | Write `tools/directories.ts` — all 3 directory tools | 3 tools |
| 1.11 | Write `tools/analysis.ts` — all 5 analysis tools | 5 tools |
| 1.12 | Write `tools/admin.ts` — recompute, export, import, delete | 4 tools |
| 1.13 | Write `tools/extraction.ts` — extraction_guide, nlp_preprocess, extract | 3 tools (fat pipeline) |
| 1.14 | Test all 36 tools against real Neo4j | All tools verified |

**Verification:** Connect to Claude Desktop. Run `memorytonic_search({ query: "IMF" })`. Extract a test document. Full pipeline works.

### Phase 2: Intelligence Layer (Resources + Prompts)

**Goal:** The open instruction layer is live. Claude reads skills on demand.

| Step | Task | Output |
|------|------|--------|
| 2.1 | Create `skills/` directory structure | Folders created |
| 2.2 | Write maps: system-map, pipeline-map, skill-index | 3 files |
| 2.3 | Write pipeline instructions: step-00 through step-06, validation-rules, retry-guide | 9 files |
| 2.4 | Write extraction skills: entity-discovery, relationship-building, causal-chains, html-template, quality-bar | 5 files |
| 2.5 | Write analysis skills: bridge-detection, gap-analysis, collection-analysis, entity-comparison | 4 files |
| 2.6 | Write system skills: schema-guide, gds-guide, cypher-patterns, maintenance-guide, export-import-guide | 5 files |
| 2.7 | Write domain skills: geopolitics, finance, technology | 3 files |
| 2.8 | Write default `agent.md` | 1 file |
| 2.9 | Write `resources/server.ts` — resource listing + reading | Resources serve from disk |
| 2.10 | Register resources in `server.ts` | `resources/list` and `resources/read` work |
| 2.11 | Write `prompts/assembler.ts` — prompt assembly logic | 5 prompts |
| 2.12 | Register prompts in `server.ts` | `prompts/list` and `prompts/get` work |

**Verification:** Claude reads pipeline-map via resource. Claude gets assembled extraction prompt. Skills load on demand.

### Phase 3: Integration + Polish

**Goal:** Everything works together. Claude Desktop full workflow.

| Step | Task | Output |
|------|------|--------|
| 3.1 | Full extraction test: prompt -> resources -> workers -> tools -> verify | End-to-end pipeline |
| 3.2 | Full analysis test: collection analysis using analysis skills | Analysis workflow works |
| 3.3 | Export/import test | Collections portable |
| 3.4 | Edge case testing (E1-E12) | All edge cases handled |
| 3.5 | Error messages review — all user-friendly | No raw stack traces |
| 3.6 | Tool descriptions review — all clear | Claude understands every tool |
| 3.7 | Write `contracts/electron-contract.md` | C05 interface defined |
| 3.8 | Write component README.md | Setup + architecture |
| 3.9 | STATUS.md -> CLOSED | Component sealed |

---

## 17. Assumptions {#17-assumptions}

### A1: Neo4j Running Locally
MCP server assumes Neo4j at `bolt://localhost:7687` with database `memorytonic`. User starts Neo4j Desktop before using MCP.

### A2: Component 01 Data Directory Accessible
MCP needs C01's directory for Python scripts and data directories. Configured via `MEMORYTONIC_INGESTION_DIR`.

### A3: Python Available
Python 3.10+ with spaCy and sentence-transformers. If unavailable:
- Extraction works (no NLP, no embeddings)
- Quality lower
- `memorytonic_health` reports `nlpInstalled: false`

### A4: Claude Desktop as Primary Client
stdio transport. Also works with any MCP client that supports stdio.

### A5: No Authentication
Local server. Neo4j auth handled by driver config.

### A6: No Concurrent Writes
Single user. Neo4j handles transaction-level isolation.

### A7: GDS Plugin Optional
If missing: no importance metrics, no SIMILAR_TO edges. Everything else works.

### A8: C02 and C03 Run Independently
MCP doesn't depend on them. All three consume the same Neo4j database.

### A9: Skills Directory Writable
Users can add/edit files in `skills/custom/` and `skills/domains/` and `skills/agent.md`. The server reads from disk on each request (no caching).

---

## 18. Open Questions {#18-open-questions}

### Q1: Resolved — Extract Tool Accepts Full Payload
Claude sends full payload (placement + HTML + entities + extraction). MCP writes artifacts, runs pipeline. Fat tool. Claude doesn't manage file paths.

### Q2: Deferred — Extract Conversation
Lightweight extraction from conversations. Post-launch.

### Q3: Resolved — Vector Search Opt-In
Include in `memorytonic_search({ mode: 'semantic' })`. Default is fulltext.

### Q4: Resolved — Query Tool Read-Only
Writes through dedicated tools only. Safety first.

### Q5: Resolved — Collection Description via MCP
Add `memorytonic_update_collection` tool. Claude can generate description from collection contents, but not auto-generate on creation.

### Q6: Resolved — Import Non-Interactive
Pass directory and collection name as tool arguments. Return conflicts in response for Claude to handle.

### Q7: Should `pipeline-map.md` Define Worker Context Exactly?

The pipeline-map tells master Claude which skills each worker needs. But should it define the EXACT context (which artifacts, which sections of agent.md) or let master Claude figure it out?

**Recommendation:** Define it exactly. Reduces master Claude's judgment calls and ensures consistency.

### Q8: Should Resources Be Cached?

Currently: read from disk on every request (simple, always fresh). Alternative: cache in memory, invalidate on file change (faster, more complex).

**Recommendation:** No cache for v1. Disk reads are fast enough (<5ms for .md files). Add caching if performance proves an issue.

### Q9: How Should Custom Skills Be Discovered?

User adds `skills/custom/my-rules.md`. How does Claude know it exists?

**Options:**
- A: Scan directory and include in skill-index automatically
- B: User references it in agent.md
- C: Both

**Recommendation:** C. Auto-scan puts it in skill-index, but agent.md tells Claude when to use it.

### Q10: Should Prompts Accept Dynamic Parameters?

Example: `extract-document` prompt could accept `contentType` to auto-load relevant domain skill.

**Recommendation:** Yes. Prompts should accept optional arguments that affect which resources are assembled.
