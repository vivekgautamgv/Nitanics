# Component 04: MCP Server — Top-Level Plan

**Status:** PLANNING
**Date:** 2026-04-08

---

## What C04 Is

The AI interface to MemoryTonic. When Claude Desktop connects, Claude gains:
- **36 Tools** — execute operations (locked code, not editable)
- **~30 Resources** — read instruction files on demand (open, editable .md files)
- **6 Prompts** — assembled workflows that combine resources into complete instructions
- **1 agent.md** — user's single customization file

Claude Desktop is the center. The MCP server is how Claude talks to the knowledge graph.

---

## 6 Flows (What Users Can Do)

```
FLOW 1: EXTRACT -----> "Put this in MemoryTonic"
FLOW 2: QUERY -------> "What do I know about X?" / "How is A connected to B?"
FLOW 3: RESEARCH ----> "Analyze this collection" / "What am I missing?"
FLOW 4: MANAGE ------> "Create a collection" / "Delete this project"
FLOW 5: EXPORT ------> "Export this collection" / "Back up my research"
FLOW 6: IMPORT ------> "Import from ZIP" / "Load this collection"
```

### Flow 1: EXTRACT (most complex — master-worker pattern)

```
USER: "Put this in MemoryTonic" + text
  |
  v
MAIN AGENT (orchestrator, does NOT do pipeline work)
  |
  |-- Phase A: Quick text scan (domain, tags, key entities)
  |
  |-- Phase B: Skill Discovery (adaptive intelligence layer)
  |   |-- Check skills/custom/ for domain-matching skill
  |   |-- Check skills/domains/ for shipped domain skill
  |   |-- IF MATCH: load it, tell user ("Using molecular-biology skill")
  |   |-- IF NO MATCH + SPECIALIZED DOMAIN:
  |   |   |-- Read kg-theory.md (ontological reasoning foundation)
  |   |   |-- Read domain-skill-template.md (6-section template)
  |   |   |-- Generate domain skill using KG theory + template
  |   |   |-- Save to skills/custom/{domain}.md
  |   |   |-- Tell user: "Created extraction skill for [domain]. You can edit it."
  |   |-- IF NO MATCH + GENERAL DOMAIN:
  |   |   |-- Proceed without domain skill (KG theory + quality bar sufficient)
  |   |   |-- After extraction, evaluate if skill should be generated retroactively
  |
  |-- Phase C: Smart placement
  |   |-- Ask: which directory? (list existing, suggest best match)
  |   |-- Ask: which collection? (filter by tag overlap, suggest ranked)
  |   |-- If new collection: ask description ("What's it about?")
  |   |-- If missing description on existing: ask and fill it in
  |   |-- Suggest project name (kebab-case), check uniqueness
  |   |-- Confirm all decisions with user
  |
  |-- Phase D: Spawn extraction worker
  |   Worker gets: text + placement + pipeline instructions + domain skill
  |               + kg-theory + quality bar + agent.md
  |
  v
EXTRACTION WORKER (does all pipeline work)
  |
  |-- Step 01: HTML generation (dark theme, voice blocks)
  |   Writes: data/temp/<slug>/01_html.html + 02_placement.json
  |
  |-- Step 02: NLP preprocessing (spaCy NER, 5-10 sec)
  |   Calls: memorytonic_nlp_preprocess → Python preprocess.py
  |   Writes: 03_nlp_entities.json
  |
  |-- Step 03: Entity discovery (Claude reasoning, domain-informed)
  |   Reads: entity-discovery skill + kg-theory + domain skill + quality bar
  |   Uses domain skill to know: what to look for, how to categorize
  |   Uses kg-theory to reason: continuant/occurrent/abstraction, coreference
  |   Reviews NLP candidates, adds missed entities
  |   Writes definitions (100+ chars), roles (stance+mechanics+reasoning)
  |   Assigns categories (14 fixed), aliases, temporal phases
  |   Writes: 04_all_entities.json
  |
  |-- Step 04: Full extraction (Claude reasoning, domain-informed)
  |   Reads: relationship-building skill + causal-chains skill + domain skill
  |   Uses domain skill for: relationship patterns, domain verbs → causal families
  |   Builds: relationships (15+), causal chains (2+), summary (200+ words)
  |   Writes: 06_extraction.json
  |
  |-- Step 05: Embeddings (BERT, 60-90 sec)
  |   Calls: Python embed.py → 384d vectors
  |   Writes: 05_embeddings.json
  |
  |-- Step 06: Validate (30+ rules, mandatory)
  |   Calls: Python validate_project.py
  |   If fail: fix + retry (max 2). If still fail: escalate.
  |
  |-- Step 07: Upload to Neo4j
  |   Calls: memorytonic_extract(full_payload)
  |   Python upload.py: 9 steps, 13 HTTP calls
  |   Entity merge (name + aliases), MENTIONED_IN, RELATES_TO, CHAIN_LINK
  |
  |-- Step 08: GDS recomputation
  |   Calls: Python gds.py
  |   PageRank, Betweenness, Degree, Node Similarity (SIMILAR_TO edges)
  |
  |-- Step 09: File organization
  |   Move: temp/ → extracted/ (all artifacts)
  |   Move: temp/ → sources/YYYY-MM-DD/<slug>/01_html.html
  |   Clean temp
  |
  v
MAIN AGENT reports results to user
  |-- If domain skill was generated: remind user they can review/edit it
  |-- If extraction revealed domain skill weakness: update the skill
```

### Flow 2: QUERY (direct tool calls, no worker needed)

```
USER: "What do I know about the IMF?"
  |
  v
MAIN AGENT calls tools directly:
  memorytonic_search({ query: "IMF" })           → find entities
  memorytonic_get_entity({ name: "IMF" })         → full profile, roles per project
  memorytonic_explore({ entityName: "IMF" })      → neighborhood (2 hops)
  memorytonic_recall({ question: "How does IMF influence developing nations?" })
    → GraphRAG: entities + connections + chains + projects
  memorytonic_find_paths({ from: "IMF", to: "Saudi Arabia" })
    → shortest path(s)
  memorytonic_explain({ entity1: "IMF", entity2: "World Bank" })
    → direct edges + indirect paths + shared projects
  memorytonic_similar({ entityName: "IMF" })
    → structurally similar entities (SIMILAR_TO edges)
  memorytonic_query({ cypher: "MATCH..." })
    → raw read-only Cypher
```

### Flow 3: RESEARCH (the intelligence layer)

```
USER: "Analyze my Global Finance collection" / "What should I research next?"
  |
  v
MAIN AGENT reads: analysis skills (bridge-detection, gap-analysis, collection-analysis)
  |
  |-- Step 1: Collection overview
  |   Calls: memorytonic_get_collection → projects, bridges, stats
  |   Calls: memorytonic_stats → total graph context
  |
  |-- Step 2: Structural analysis
  |   Calls: memorytonic_importance → top by PageRank + Betweenness
  |   Calls: memorytonic_collection_bridges → Gold/Silver/Bronze
  |   Calls: memorytonic_detect_overlaps → shared entities
  |
  |-- Step 3: Gap detection
  |   Calls: memorytonic_gaps → isolated, underconnected, potential missing links
  |
  |-- Step 4: Causal chain analysis
  |   For each project: memorytonic_temporal → timeline
  |   Finds: chains that could continue across projects, temporal gaps
  |
  |-- Step 5: Cross-project reasoning
  |   For bridge entities: memorytonic_get_entity → roles across projects
  |   Finds: conflicting categorization, role evolution, hidden connections
  |
  |-- Step 6: Research suggestions
  |   Synthesizes: structural gaps + underexplored bridges + temporal gaps
  |   Produces: "Here's what you should research next and why"
  |
  |-- Step 7: Ontology consistency check
  |   Finds: same entity categorized differently across projects
  |   Suggests: consistent categorization
```

### Flow 4: MANAGE (direct tool calls)

```
COLLECTIONS:
  memorytonic_create_collection({ name, description })
  memorytonic_update_collection({ name, description })
  memorytonic_delete_collection({ name })
  memorytonic_add_to_collection({ projectUniqueId, collectionName })
  memorytonic_remove_from_collection({ projectUniqueId, collectionName })

DIRECTORIES:
  memorytonic_create_directory({ name, description })
  memorytonic_update_directory({ name, description })
  memorytonic_list_directories

PROJECTS:
  memorytonic_delete_project({ uniqueId })  → cascade delete + file cleanup
  memorytonic_recompute                      → rerun all GDS algorithms

DESCRIPTIONS:
  Main agent enforces: every directory and collection MUST have a description.
  If missing → ask user → update immediately.
```

### Flow 5: EXPORT

```
USER: "Export my Global Finance collection"
  |
  v
MAIN AGENT:
  |-- Confirms: "Export 'Global Finance Systems' (8 projects, 142 entities)?"
  |-- Calls: memorytonic_export({ collectionName: "Global Finance Systems" })
  |
  v
MCP INTERNALLY:
  Python export_collection.py:
    1. Query all projects in collection
    2. Query all entities (with cross-project metadata)
    3. Query all RELATES_TO relationships
    4. Query all causal chains + CHAIN_LINK edges
    5. Query all temporal events
    6. Query all SIMILAR_TO pairs
    7. Query all embeddings (optional, --no-embeddings to skip)
    8. Build graph.json (agent-readable complete graph)
    9. Build embeddings.json (raw 384d vectors)
    10. Copy project HTMLs
    11. Write README.md + manifest.json
    12. ZIP everything → data/exports/<collection-name>.zip
  |
  v
MAIN AGENT reports: "Exported to data/exports/global-finance-systems.zip
  8 projects, 142 entities, 87 relationships, 12 chains, 384d embeddings included."

ZIP STRUCTURE:
  global-finance-systems.zip
  ├── graph.json              ← Complete graph (agent-readable)
  ├── embeddings.json         ← All entity + project embeddings
  ├── README.md               ← Human-readable collection overview
  ├── manifest.json           ← Metadata: export date, counts, version
  └── projects/
      ├── petrodollar-system/
      │   ├── source.html     ← 01_html.html
      │   └── extraction.json ← 06_extraction.json
      ├── bretton-woods/
      │   ├── source.html
      │   └── extraction.json
      └── ...
```

### Flow 6: IMPORT

```
USER: "Import this collection" + ZIP path
  |
  v
MAIN AGENT (same smart placement flow as extraction):
  |
  |-- Phase A: Preflight
  |   Reads ZIP manifest → shows user what's inside
  |   "This ZIP contains 'Global Finance Systems': 8 projects, 142 entities"
  |
  |-- Phase B: Smart placement (same pattern as extraction)
  |   Ask: which directory? (suggest based on collection domain)
  |   Ask: use original collection name or rename?
  |   If new collection name: ask description
  |   If collection already exists: warn about potential conflicts
  |
  |-- Phase C: Spawn import worker
  |   Worker gets: ZIP path + placement decisions + import instructions
  |
  v
IMPORT WORKER:
  Calls: memorytonic_import({ zipPath, directory, collectionName })
  |
  MCP INTERNALLY (Python import_collection.py, 6 phases):
  |
  |-- Phase 1: Preflight
  |   Extract ZIP → validate structure → check graph.json schema
  |
  |-- Phase 2: Conflict detection
  |   Check: do any entities already exist? (by name + aliases)
  |   Check: do any projects already exist? (by unique_id)
  |   Report: "3 entities already exist (will merge), 0 project conflicts"
  |
  |-- Phase 3: Artifact reconstruction
  |   From graph.json → rebuild per-project artifact folders:
  |     02_placement.json, 04_all_entities.json, 06_extraction.json
  |   From embeddings.json → rebuild 05_embeddings.json per project
  |   From projects/*/source.html → rebuild 01_html.html
  |
  |-- Phase 4: Validate + Upload (per project)
  |   For each project:
  |     validate_project.py → must pass
  |     upload.py → Neo4j (entity merge, relationships, chains)
  |
  |-- Phase 5: GDS recomputation
  |   gds.py → recompute all metrics across full graph
  |
  |-- Phase 6: Verification
  |   Query Neo4j → confirm all projects exist, entity counts match
  |
  v
MAIN AGENT reports: "Imported 8 projects into 'Global Finance Systems' / Research.
  142 entities (3 merged with existing), 87 relationships, 12 chains.
  Graph metrics recomputed."
```

---

## Folder Organization

```
components/04-mcp/
│
├── PLAN.md                     ← THIS FILE (top-level plan)
├── DESIGN-SPEC.md              ← Detailed technical spec (schemas, edge cases, data layer)
├── STATUS.md                   ← OPEN | CLOSED
├── README.md                   ← Setup guide for developers
│
├── package.json                ← @modelcontextprotocol/sdk, neo4j-driver, zod
├── tsconfig.json
├── .env                        ← NEO4J_URI, NEO4J_PASSWORD, MEMORYTONIC_DATA_DIR
│
├── src/                        ← TYPESCRIPT MCP SERVER (locked process layer)
│   │
│   ├── index.ts                ← Entry: stdio transport, startup health check
│   ├── server.ts               ← McpServer: register all tools + resources + prompts
│   │
│   ├── tools/                  ← 36 TOOL IMPLEMENTATIONS (8 modules)
│   │   ├── system.ts           ← memorytonic_health, _bootstrap, _stats (3)
│   │   ├── extraction.ts       ← memorytonic_extract, _nlp_preprocess, _extraction_guide (3)
│   │   ├── query.ts            ← _search, _recall, _explore, _find_paths, _similar, _query, _explain (7)
│   │   ├── entity-project.ts   ← _get_entity, _get_project, _list_projects, _list_collections (4)
│   │   ├── collections.ts      ← _get, _create, _update, _delete, _add_to, _remove_from, _bridges (7)
│   │   ├── directories.ts      ← _list, _create, _update (3)
│   │   ├── analysis.ts         ← _importance, _gaps, _temporal, _detect_overlaps, _collection_suggestions (5)
│   │   └── admin.ts            ← _recompute, _export, _import, _delete_project (4)
│   │
│   ├── neo4j/                  ← DATABASE LAYER
│   │   ├── driver.ts           ← Singleton bolt connection, runRead, runWrite, toPlain, healthCheck
│   │   └── queries.ts          ← All Cypher query functions (organized by tool group)
│   │
│   ├── python/                 ← PYTHON BRIDGE
│   │   ├── spawn.ts            ← Generic spawn-and-exit (findPython, timeouts, stdin/stdout)
│   │   └── scripts.ts          ← Typed wrappers: runUpload, runGds, runValidate, runPreprocess, etc.
│   │
│   ├── resources/              ← RESOURCE SERVER
│   │   └── server.ts           ← List + read .md files from skills/ directory
│   │
│   ├── prompts/                ← PROMPT ASSEMBLER
│   │   └── assembler.ts        ← Combine resources into workflow prompts
│   │
│   ├── types/                  ← TYPESCRIPT INTERFACES
│   │   └── index.ts            ← All interfaces (GraphNode, GraphLink, Extraction, etc.)
│   │
│   ├── helpers/                ← UTILITIES
│   │   ├── ok-err.ts           ← ok() and err() MCP response formatters
│   │   └── validators.ts       ← Input validation (sanitize Cypher, check names, etc.)
│   │
│   └── constants/              ← ENUMS & FIXED DATA
│       └── index.ts            ← 14 categories, 15 causal types, bridge tier rules
│
├── skills/                     ← OPEN INSTRUCTION LAYER (editable .md files)
│   │
│   ├── maps/                   ← NAVIGATION (Claude reads these first)
│   │   ├── system-map.md       ← Full system architecture: components, data flow, where things live
│   │   ├── pipeline-map.md     ← 6-step extraction pipeline: step order, worker instructions,
│   │   │                          validation criteria per step, skill references, failure handling
│   │   └── skill-index.md      ← Index of ALL skills with one-line descriptions and URIs
│   │
│   ├── pipeline/               ← STEP-BY-STEP PROCESS INSTRUCTIONS
│   │   ├── step-00-bootstrap.md       ← Schema setup: when needed, what it creates
│   │   ├── step-01-html-placement.md  ← HTML template rules + placement decision flow
│   │   ├── step-02-nlp.md             ← NLP preprocessing: what to expect, interpret results
│   │   ├── step-03-entities.md        ← Entity discovery: NLP reconciliation, definitions, roles
│   │   ├── step-04-extraction.md      ← Full extraction: relationships, chains, summary, tags
│   │   ├── step-05-embeddings.md      ← Embedding generation: what gets embedded, fallback
│   │   ├── step-06-upload.md          ← Upload + GDS: what happens, verify success
│   │   ├── validation-rules.md        ← All 30+ rules from validate_project.py, explained
│   │   └── retry-guide.md             ← What to do when steps fail: strategies, escalation
│   │
│   ├── extraction/             ← EXTRACTION INTELLIGENCE (what makes extractions good)
│   │   ├── kg-theory.md               ← **KG FOUNDATION**: ontological thinking, triple structure,
│   │   │                                 coreference, context, taxonomy, quality principles
│   │   ├── domain-skill-template.md   ← **TEMPLATE**: 6-section template for creating domain skills
│   │   ├── entity-discovery.md        ← How to find entities, write definitions, assign categories
│   │   ├── relationship-building.md   ← How to identify relationships, evidence rules, edge quality
│   │   ├── causal-chains.md           ← How to construct chains: system mechanics, ordering
│   │   ├── html-template.md           ← Dark theme HTML with NARRATOR/GATORSQUARE voices
│   │   └── quality-bar.md             ← Quality requirements with BAD/GOOD examples
│   │
│   ├── analysis/               ← RESEARCH INTELLIGENCE
│   │   ├── bridge-detection.md        ← How bridges work, tiers, research value
│   │   ├── gap-analysis.md            ← Detecting gaps: isolated, underconnected, missing links
│   │   ├── collection-analysis.md     ← Analyzing collections: key entities, themes, patterns
│   │   └── entity-comparison.md       ← Comparing entities across projects: roles, evolution
│   │
│   ├── system/                 ← REFERENCE MATERIAL
│   │   ├── schema-guide.md            ← Full Neo4j schema: 7 nodes, 10 relationships, all properties
│   │   ├── gds-guide.md               ← GDS algorithms: PageRank, Betweenness, Degree, Similarity
│   │   ├── cypher-patterns.md         ← 30+ common Cypher patterns for MemoryTonic
│   │   ├── maintenance-guide.md       ← Post-upload checklists, periodic maintenance
│   │   └── export-import-guide.md     ← Export/import: ZIP format, graph.json, 6-phase import
│   │
│   ├── domains/                ← DOMAIN-SPECIFIC EXTRACTION GUIDANCE
│   │   ├── geopolitics.md             ← Sanctions, treaties, institutional mechanics, power dynamics
│   │   ├── finance.md                 ← Instruments, flows, regulatory bodies, systemic risk
│   │   └── technology.md             ← Systems, protocols, dependencies, adoption patterns
│   │
│   ├── custom/                 ← AI-GENERATED + USER-CREATED DOMAIN SKILLS
│   │   ├── .gitkeep            ← Empty by default
│   │   └── (AI generates here) ← molecular-biology.md, software-architecture.md, etc.
│   │                              Created when AI encounters new domains
│   │                              User can also hand-write skills here
│   │
│   └── agent.md                ← THE ONE FILE USERS EDIT
│                                  Extraction style, defaults, domain prefs, quality overrides
│
├── tests/                      ← TEST SUITE
│   ├── tools/                  ← Tool tests (mock Neo4j + Python)
│   ├── neo4j/                  ← Query tests (real Neo4j)
│   ├── resources/              ← Resource serving tests
│   └── prompts/                ← Prompt assembly tests
│
└── contracts/                  ← INTERFACE FOR C05
    └── electron-contract.md    ← What Electron needs from MCP: startup, config, health
```

---

## 6 Prompts (Workflow Assemblers)

| # | Prompt | Triggered By | Assembles |
|---|--------|-------------|-----------|
| 1 | `memorytonic-introduction` | Claude connects to MCP | System map, routing guide, orchestration pattern, all skill locations, tool groups |
| 2 | `extract-document` | User wants to extract | pipeline-map + agent.md + quality-bar + domain skill (if applicable) |
| 3 | `analyze-collection` | User wants research analysis | collection-analysis + bridge-detection + gap-analysis + agent.md |
| 4 | `explore-entity` | User wants entity deep-dive | entity-comparison + schema-guide (entity section) + agent.md |
| 5 | `export-collection` | User wants to export | export-import-guide + system-map (storage section) |
| 6 | `import-collection` | User wants to import | export-import-guide + pipeline-map (validation section) + agent.md |

---

## Agent Map (Who Does What)

Four agents operate the system. Each has a clear identity, bounded tools, specific skills, and explicit boundaries. The MCP server doesn't spawn agents — Claude does. MCP provides the tools, resources, and prompts that agents consume.

### Agent 1: Main Agent (The Orchestrator)

**Identity:** The user's Claude — always running, never spawned. This is the agent the user talks to. It understands the full system, routes requests to the right flow, and manages all user interaction.

**Lifetime:** Entire session. Lives as long as the user's conversation.

**On First Connect:**
1. Claude Desktop calls `memorytonic-introduction` prompt
2. Main Agent reads: system-map (full architecture), skill-index (everything available), agent.md (user prefs)
3. Main Agent now knows: what tools exist, what skills teach what, what the user prefers
4. Ready to route any request

**What It Reads:**
```
memorytonic://skills/maps/system-map         ← Full system architecture
memorytonic://skills/maps/skill-index        ← Where to find any skill
memorytonic://skills/maps/pipeline-map       ← How extraction works (overview, not step details)
memorytonic://skills/agent.md                ← User customization
```

**What Tools It Calls Directly:**
```
QUERY tools (all 7):     search, recall, explore, find_paths, similar, query, explain
ENTITY/PROJECT tools (4): get_entity, get_project, list_projects, list_collections
COLLECTION tools (7):     get, create, update, delete, add_to, remove_from, bridges
DIRECTORY tools (3):      list, create, update
ANALYSIS tools (5):       importance, gaps, temporal, detect_overlaps, collection_suggestions
SYSTEM tools (3):         health, bootstrap, stats
```

**What It Does:**
- Routes user requests to the correct flow (Extract/Query/Research/Manage/Export/Import)
- Smart placement: quick text scan → tag extraction → collection matching → description enforcement
- Confirms all decisions with user before proceeding
- Spawns workers for pipeline tasks (extraction, import)
- Validates worker outputs between steps
- Reports results back to user
- Enforces descriptions on directories and collections (asks if missing)
- Handles all error escalation ("Step 3 failed. Here's what went wrong...")

**What It Does NOT Do:**
- Pipeline work (HTML generation, entity discovery, relationship building)
- Direct Neo4j writes (only reads — writes go through tools which call Python)
- Skip user confirmation for destructive operations (delete, overwrite)
- Load all skills at once (reads on demand based on flow)
- Touch the user's files outside data/ directory

**Decision Authority:**
| Decision | Main Agent Decides | User Decides |
|----------|-------------------|--------------|
| Which flow to use | ✓ (from user's intent) | — |
| Directory suggestion | suggests | confirms |
| Collection suggestion | suggests (ranked by tag overlap) | confirms |
| Project name | suggests (kebab-case, checks uniqueness) | confirms |
| When to spawn worker | ✓ (after all placement confirmed) | — |
| When to retry failed step | ✓ (first retry automatic) | second retry |
| When to abort pipeline | — | ✓ (always user's call) |

---

### Agent 2: Extraction Worker (The Builder)

**Identity:** A bounded worker spawned by the Main Agent to execute the 6-step extraction pipeline. It receives exactly what it needs, does the work, and reports back. One worker per extraction.

**Lifetime:** Single extraction. Spawned after placement confirmed, terminated after upload + GDS complete.

**How It's Spawned:**
```
MAIN AGENT spawns with:
  raw_text:           the document to extract
  placement:          { directory, collection, projectName, description }
  pipeline_map:       memorytonic://skills/maps/pipeline-map (full step details)
  quality_bar:        memorytonic://skills/extraction/quality-bar
  domain_skill:       memorytonic://skills/domains/{detected_domain} (if applicable)
  agent_prefs:        extraction section from agent.md
  html_template:      memorytonic://skills/extraction/html-template
```

**What Tools It Calls:**
```
memorytonic_nlp_preprocess   ← Step 02: spawn preprocess.py
memorytonic_extract          ← Step 07: spawn upload.py (creates nodes, edges, chains)
memorytonic_recompute        ← Step 08: spawn gds.py (PageRank, Betweenness, etc.)
```

**What It Reads (loaded into its context at spawn):**
```
Pipeline steps:
  skills/pipeline/step-01-html-placement    ← HTML generation rules
  skills/pipeline/step-02-nlp               ← NLP interpretation
  skills/pipeline/step-03-entities          ← Entity discovery protocol
  skills/pipeline/step-04-extraction        ← Relationship + chain building
  skills/pipeline/step-05-embeddings        ← What to embed, how
  skills/pipeline/step-06-upload            ← Upload + GDS + file org
  skills/pipeline/validation-rules          ← All 30+ rules
  skills/pipeline/retry-guide              ← What to do when steps fail

Extraction intelligence:
  skills/extraction/entity-discovery        ← Finding entities, writing definitions
  skills/extraction/relationship-building   ← Building edges, evidence rules
  skills/extraction/causal-chains           ← Constructing causal chains
  skills/extraction/quality-bar             ← BAD/GOOD examples, minimums
  skills/extraction/html-template           ← Dark theme HTML template
```

**Step-by-Step Execution:**
```
Step 01: HTML + Placement
  Input:  raw text + html-template skill + placement decisions
  Output: 01_html.html, 02_placement.json
  Gate:   HTML file exists, placement JSON has all required fields

Step 02: NLP Preprocessing
  Input:  raw text → memorytonic_nlp_preprocess tool
  Output: 03_nlp_entities.json (spaCy NER + TF-IDF keywords)
  Gate:   JSON valid, entities array present, confidence scores present
  Time:   5-10 seconds

Step 03: Entity Discovery [CLAUDE REASONING — no tool calls]
  Input:  raw text + 03_nlp_entities.json + entity-discovery skill + domain skill
  Output: 04_all_entities.json
  Gate:   ≥10 entities, all definitions 100+ chars, all categories from 14 fixed set,
          aliases present, temporal_phases with 2+ phases, no all-"Other" categories
  This is where extraction quality is WON or LOST.

Step 04: Full Extraction [CLAUDE REASONING — no tool calls]
  Input:  raw text + 04_all_entities.json + relationship-building + causal-chains skills
  Output: 06_extraction.json (summary, narrative_flow, tags, relationships, causal_chains)
  Gate:   ≥15 relationships, ≥2 chains, all descriptions 80+ chars, evidence quotes present,
          summary 200+ words, tags have domain + subdomain + base_tags

Step 05: Embeddings
  Input:  04_all_entities.json + 06_extraction.json → Python embed.py
  Output: 05_embeddings.json (384d vectors for entity definitions + roles + project summary)
  Gate:   All entities have 384d vectors, project summary has vector
  Time:   60-90 seconds

Step 06: Validate → Upload → GDS → File Organization
  Input:  All artifacts (01-06)
  Actions:
    6a. validate_project.py → must pass all 30+ rules (inside memorytonic_extract)
    6b. upload.py → entity merge, MENTIONED_IN, RELATES_TO, CHAIN_LINK, temporal (inside memorytonic_extract)
    6c. gds.py → PageRank, Betweenness, Degree, Node Similarity (memorytonic_recompute)
    6d. Move artifacts: temp/ → extracted/ and sources/
  Gate:   Project queryable in Neo4j, entity counts match, GDS properties populated
```

**What It Does NOT Do:**
- Talk to the user (all communication through Main Agent)
- Make placement decisions (those are already decided)
- Access query tools (search, explore, find_paths — not needed)
- Access collection/directory management tools
- Modify other projects' data
- Skip validation between steps

**Failure Behavior:**
| Failure | Response |
|---------|----------|
| Step fails validation | Retry that step once with specific feedback about what failed |
| Step fails twice | Report failure details to Main Agent. Main Agent escalates to user. |
| Python script crashes | Report error (stderr output). Main Agent suggests: check Python env, Neo4j, disk. |
| NLP returns empty | Proceed without NLP (entity discovery relies on Claude reasoning as fallback) |

**Report Format (returned to Main Agent):**
```json
{
  "success": true,
  "project": {
    "uniqueId": "us-china-trade-2024-abc123",
    "name": "US-China Trade Relations",
    "directory": "Research",
    "collection": "Global Finance Systems",
    "entityCount": 24,
    "relationshipCount": 37,
    "chainCount": 4,
    "temporalPhases": 6
  },
  "artifacts": {
    "html": "sources/2026-04-08/us-china-trade/01_html.html",
    "extraction": "extracted/us-china-trade/06_extraction.json"
  },
  "gds": {
    "pageRankComputed": true,
    "betweennessComputed": true,
    "similarityEdges": 12
  },
  "warnings": []
}
```

---

### Agent 3: Research Agent (The Analyst)

**Identity:** An analytical agent that studies collections to find patterns, gaps, bridges, and research suggestions. Pure read-only — it never modifies data. This is the intelligence layer that makes MemoryTonic a research tool, not just a memory store.

**Lifetime:** Single analysis session. Spawned when user asks for collection analysis, terminated after report delivered.

**When Spawned:**
- "Analyze my collection"
- "What am I missing?"
- "What should I research next?"
- "How do these projects connect?"
- "What are the gaps in my research?"

**How It's Spawned:**
```
MAIN AGENT spawns with:
  collection_name:     target collection to analyze
  analysis_skills:     bridge-detection, gap-analysis, collection-analysis, entity-comparison
  agent_prefs:         research section from agent.md
  system_context:      memorytonic_stats output (total graph size for context)
```

**What Tools It Calls:**
```
READ-ONLY (all analysis, never writes):
  memorytonic_get_collection        ← Collection overview: projects, entity count, bridges
  memorytonic_stats                 ← Graph-wide context (total projects, entities, edges)
  memorytonic_importance            ← Top entities by PageRank + Betweenness
  memorytonic_collection_bridges    ← Gold/Silver/Bronze bridge entities
  memorytonic_detect_overlaps       ← Shared entities between project pairs
  memorytonic_gaps                  ← Isolated entities, underconnected, potential missing links
  memorytonic_temporal              ← Per-project timelines
  memorytonic_get_entity            ← Entity deep dive (roles across projects, connections)
  memorytonic_explore               ← Entity neighborhood (2 hops)
  memorytonic_find_paths            ← Paths between entities
  memorytonic_explain               ← Direct + indirect connections between entity pairs
  memorytonic_similar               ← Structurally similar entities (SIMILAR_TO edges)
  memorytonic_communities           ← Louvain community detection
  memorytonic_community             ← Single community detail
```

**7-Phase Analysis Protocol:**
```
Phase 1: Collection Overview
  What: Total size, project list, bridge count, entity distribution by category
  Tools: memorytonic_get_collection + memorytonic_stats
  Output: "Your 'Global Finance Systems' has 8 projects, 142 entities, 23 bridges"

Phase 2: Structural Analysis
  What: Most important entities (PageRank), structural connectors (Betweenness), bridge tiers
  Tools: memorytonic_importance + memorytonic_collection_bridges
  Output: "Top 5 by importance: [list]. Gold bridges: [list]. These connect the most projects."

Phase 3: Gap Detection
  What: Isolated entities, underconnected clusters, potential missing links
  Tools: memorytonic_gaps + memorytonic_detect_overlaps
  Output: "3 entities appear in only 1 project but are referenced by 5+ others.
           Project 'Bretton Woods' has 0 overlap with 'BRICS Alliance' despite both
           mentioning IMF — potential missing relationship."

Phase 4: Causal Chain Analysis
  What: Chains that span projects, temporal gaps between chain ends
  Tools: memorytonic_temporal (per project) + memorytonic_find_paths
  Output: "The chain 'Oil embargo → Dollar recycling → Petrodollar' ends at 1975.
           'BRICS de-dollarization' begins at 2009. There's a 34-year gap in your
           research about how the petrodollar system evolved into the system BRICS
           challenges. Suggested research: 1975-2009 dollar hegemony mechanics."

Phase 5: Cross-Project Reasoning
  What: Entities that play different roles across projects, role evolution, contradictions
  Tools: memorytonic_get_entity (for bridge entities) + memorytonic_explain
  Output: "IMF is categorized as 'Organization' in all projects (✓ consistent).
           BUT its role changes: in 'Bretton Woods' it's a stabilizer, in 'Asian
           Financial Crisis' it's a disruptor. This evolution IS the research insight."

Phase 6: Research Suggestions
  What: What to research next, ranked by potential impact on graph connectivity
  Synthesizes: gaps (Phase 3) + chain gaps (Phase 4) + role evolution (Phase 5)
  Output: "Research priorities:
    1. [HIGH] Dollar hegemony 1975-2009 — would connect 3 currently isolated project clusters
    2. [MEDIUM] Asian Financial Crisis aftermath — would explain IMF role evolution
    3. [LOW] European monetary integration — 2 entities reference it but no dedicated project"

Phase 7: Ontology Consistency
  What: Same entity categorized differently across projects, naming inconsistencies
  Tools: memorytonic_get_entity (across projects)
  Output: "'World Bank' is 'Organization' in 5 projects but 'System' in 1.
           Recommend: standardize to 'Organization'. Also: 'WTO' and 'World Trade
           Organization' exist as separate entities — merge via aliases?"
```

**What It Does NOT Do:**
- Modify any data (no writes, no deletes, no entity edits)
- Create or manage collections/directories
- Run extraction pipeline
- Make tool calls that change state
- Talk to the user directly (reports through Main Agent)

**Report Format (returned to Main Agent):**
```json
{
  "collection": "Global Finance Systems",
  "projectCount": 8,
  "entityCount": 142,
  "analysis": {
    "topEntities": [...],
    "bridges": { "gold": [...], "silver": [...], "bronze": [...] },
    "gaps": [...],
    "chainGaps": [...],
    "roleEvolutions": [...],
    "ontologyIssues": [...]
  },
  "suggestions": [
    {
      "priority": "HIGH",
      "topic": "Dollar hegemony mechanics 1975-2009",
      "reason": "Would connect 3 isolated project clusters (Petrodollar, BRICS, Asian Crisis)",
      "expectedImpact": "12+ new bridge entities, 3 clusters become 1 connected graph"
    }
  ]
}
```

---

### Agent 4: Import Worker (The Reconstructor)

**Identity:** A bounded worker that takes an exported ZIP and reconstructs it into the graph. Similar to Extraction Worker but works from pre-built artifacts instead of raw text.

**Lifetime:** Single import. Spawned after placement confirmed, terminated after verification.

**How It's Spawned:**
```
MAIN AGENT spawns with:
  zip_path:           path to the exported ZIP
  placement:          { directory, collection (original or renamed), description }
  import_guide:       memorytonic://skills/system/export-import-guide
  validation_rules:   memorytonic://skills/pipeline/validation-rules
```

**What Tools It Calls:**
```
memorytonic_import    ← Single tool that orchestrates the 6-phase Python import
memorytonic_recompute ← GDS recomputation after import
```

**6-Phase Execution:**
```
Phase 1: Preflight     — Extract ZIP, validate structure, check graph.json schema
Phase 2: Conflicts     — Check existing entities (name + aliases), existing projects (unique_id)
Phase 3: Reconstruct   — From graph.json → rebuild per-project artifact folders
Phase 4: Upload        — For each project: validate_project.py → upload.py
Phase 5: GDS           — Recompute PageRank, Betweenness, Degree, Similarity
Phase 6: Verify        — Query Neo4j, confirm counts match manifest
```

**What It Does NOT Do:**
- Make placement decisions (already decided by Main Agent)
- Talk to the user
- Resolve conflicts automatically (reports to Main, Main asks user)
- Skip validation for any project

**Failure Behavior:**
| Failure | Response |
|---------|----------|
| Invalid ZIP structure | Report: "ZIP missing graph.json" or "Unknown format" |
| Schema mismatch (v3 export) | Report: "Export from v3 detected, v3→v4 migration needed" |
| Entity conflicts | Report: "3 entities already exist, will merge. 0 project conflicts." Proceed. |
| Project unique_id exists | STOP. Report to Main: "Project 'xxx' already exists. Overwrite or skip?" |
| Upload fails mid-import | Report which projects succeeded, which failed. Partial state is valid. |

---

### Agent Interaction Diagram

```
USER ←→ MAIN AGENT (always alive, all user interaction)
              |
              |-- [Extract flow] ---→ EXTRACTION WORKER (spawned, bounded, reports back)
              |                              |
              |                              +-- calls: nlp_preprocess, extract, recompute
              |                              +-- reads: pipeline skills, extraction skills
              |                              +-- writes: artifacts to temp/, then permanent
              |
              |-- [Research flow] --→ RESEARCH AGENT (spawned, read-only, reports back)
              |                              |
              |                              +-- calls: ALL read tools (get, search, explore, gaps...)
              |                              +-- reads: analysis skills
              |                              +-- writes: NOTHING
              |
              |-- [Import flow] ---→ IMPORT WORKER (spawned, bounded, reports back)
              |                              |
              |                              +-- calls: import, recompute
              |                              +-- reads: import guide, validation rules
              |                              +-- writes: reconstructed artifacts + Neo4j nodes
              |
              |-- [Query flow] ---→ (Main Agent handles directly, no worker needed)
              |-- [Manage flow] --→ (Main Agent handles directly, no worker needed)
              |-- [Export flow] --→ (Main Agent handles directly, single tool call)
```

---

## System Lifecycle (How It Evolves Over Time)

The agents don't exist in a vacuum. They operate across a lifecycle that spans from first connection to mature research. Understanding this lifecycle is what makes the architecture work long-term.

### Stage 1: First Connection (Day 1)

```
User connects Claude Desktop to MCP for the first time.
  |
  +-- memorytonic-introduction prompt fires
  +-- Main Agent reads system-map: "I have 36 tools, ~30 skills, no data yet"
  +-- Main Agent reads agent.md: default preferences
  +-- memorytonic_health: "Neo4j running, 0 projects, 0 entities"
  +-- memorytonic_bootstrap: Creates schema (constraints, indexes, 3 default directories)
  |
  SYSTEM STATE: Empty graph, schema ready, 3 directories (Research, Business, Personal)
```

**What Main Agent tells user:** "MemoryTonic is ready. You have Research, Business, and Personal directories. Give me a document and I'll extract it into your knowledge graph."

### Stage 2: First Extraction (Day 1-2)

```
User: "Put this article about the petrodollar system in MemoryTonic"
  |
  +-- Main Agent: Quick text scan → domain: geopolitics, tags: [petrodollar, oil, USD]
  +-- Main Agent: memorytonic_list_collections → [] (empty, no collections yet)
  +-- Main Agent asks: "Which directory?" → suggests Research (domain match)
  +-- Main Agent asks: "No collections exist yet. Create one? What should it be called?"
  +-- User: "Global Finance Systems"
  +-- Main Agent asks: "Describe this collection — what kind of research goes here?"
  +-- User: "International monetary systems, trade flows, institutional finance"
  +-- Main Agent: memorytonic_create_collection
  +-- Main Agent spawns EXTRACTION WORKER
  +-- Worker executes 6-step pipeline → 24 entities, 37 relationships, 4 chains
  +-- Main Agent reports results
  |
  SYSTEM STATE: 1 project, 1 collection, 24 entities, 37 relationships
  All entities have 0 bridges (only 1 project exists)
```

### Stage 3: Growing the Graph (Week 1-2)

```
User adds more projects (3-5 total).
  |
  +-- Smart placement becomes USEFUL: tag overlap finds existing collections
  +-- memorytonic_collection_suggestions: "This text about BRICS matches 'Global Finance
      Systems' (tag overlap: USD, trade, institutional)" → ranked suggestions
  +-- Entities start MERGING across projects: "IMF" appears in project 2 → projectCount: 2
  +-- GDS metrics become MEANINGFUL: PageRank shows which entities matter most
  +-- Bridge entities emerge: Silver bridges (2 projects) start appearing
  +-- SIMILAR_TO edges get created: structurally similar entities found
  |
  SYSTEM STATE: 5 projects, 120+ entities, first Silver bridges, GDS metrics populated
  UNLOCKED: Research Agent analysis becomes valuable
```

### Stage 4: Research Intelligence (Week 2+)

```
User: "Analyze my Global Finance collection"
  |
  +-- Main Agent spawns RESEARCH AGENT
  +-- Research Agent runs 7-phase analysis
  +-- Finds: "3 entities isolated, 2 chain gaps, 1 ontology inconsistency"
  +-- Suggests: "Research dollar hegemony 1975-2009 to connect 3 clusters"
  |
  User: "Good idea. Here's an article about the dollar hegemony period"
  +-- EXTRACTION → new project fills the gap
  +-- GDS recompute: 3 Silver bridges become Gold bridges
  +-- Previously isolated entities now connected
  |
  FEEDBACK LOOP:
    Research Agent finds gaps → User extracts documents to fill them →
    Graph becomes more connected → Research Agent finds deeper patterns →
    User's research IMPROVES based on structural intelligence
  |
  This is the MOAT. No other tool does this.
```

### Stage 5: Multi-Collection Maturity (Month 1+)

```
User has 3-5 collections across different domains.
  |
  +-- Cross-collection bridges emerge: entity in "Global Finance" also in "Tech Policy"
  +-- Research Agent can analyze ACROSS collections (if user asks)
  +-- Domain skills accumulate in agent.md: user has refined extraction preferences
  +-- Custom skills may exist in skills/custom/
  +-- Export/Import flows used: sharing collections, backing up research
  |
  SYSTEM STATE: 20+ projects, 500+ entities, multiple Gold bridges,
  rich causal chains spanning 3+ projects, GDS algorithms revealing structure
  human researchers couldn't see by reading documents individually
```

### Stage 6: Maintenance & Evolution (Ongoing)

```
Periodic needs:
  +-- GDS recomputation after batch uploads (memorytonic_recompute)
  +-- Collection reorganization (move projects between collections)
  +-- Entity cleanup (merge duplicates found by ontology check)
  +-- Export for backup or sharing
  +-- Import from colleague's export
  +-- agent.md refinement based on experience
  |
  Main Agent handles all of this through direct tool calls (Flow 4: Manage).
  No workers needed for maintenance — it's all CRUD.
```

### The Feedback Loop (Why This Architecture Matters)

```
                    ┌──────────────────────────┐
                    │     USER EXTRACTS DOC     │
                    └──────────┬───────────────┘
                               │
                               v
                    ┌──────────────────────────┐
                    │   GRAPH GROWS + GDS RUNS  │
                    └──────────┬───────────────┘
                               │
                               v
                    ┌──────────────────────────┐
                    │  BRIDGES + PATTERNS EMERGE │
                    └──────────┬───────────────┘
                               │
                               v
                    ┌──────────────────────────┐
                    │  RESEARCH AGENT ANALYZES   │
                    │  → finds gaps, suggests    │
                    │    next research topics     │
                    └──────────┬───────────────┘
                               │
                               v
                    ┌──────────────────────────┐
                    │  USER EXTRACTS NEW DOC     │◄── the loop continues
                    │  (filling identified gap)  │
                    └──────────────────────────┘
```

This feedback loop is the core value proposition. The graph gets smarter with every document. The Research Agent surfaces what the graph NEEDS. The user fills those needs. The graph becomes a research partner, not a passive store.

---

## Adaptive Extraction Architecture (The Four Layers)

Extraction has four layers. Each constrains the one above it. Together they create a system where the AI extracts knowledge from ANY domain — and gets better at it over time.

```
LAYER 1: KG THEORY FOUNDATION (universal, never changes)
  Ontology, taxonomy, semantic structure, context handling
  → Teaches AI HOW TO THINK about knowledge structures
  → Principles: continuant/occurrent/abstraction, triple-with-metadata,
    domain/range constraints, coreference resolution, quality > quantity
  → Lives in: skills/extraction/kg-theory.md

LAYER 2: LOCKED FORMAT (universal, enforced by code)
  14 entity categories, 15 causal families, JSON schema, validation rules
  → The CONTAINER that holds all extractions
  → Same format whether biology, code, or geopolitics
  → Enforced by: validate_project.py (30+ rules), upload.py (merge logic)

LAYER 3: DOMAIN SKILLS (adaptive, self-generating, user-editable)
  Shipped: geopolitics.md, finance.md, technology.md
  AI-generated: molecular-biology.md, software-architecture.md, ...
  User-created: anything they want
  → Teaches AI WHAT TO LOOK FOR in specific domains
  → Entity mapping, relationship patterns, extraction focus, common traps
  → Lives in: skills/domains/ (shipped) + skills/custom/ (generated + user)

LAYER 4: USER PREFERENCES (personal, always editable)
  Extraction style, default domain, quality overrides
  → Personal taste on top of everything else
  → Lives in: skills/agent.md
```

### Layer 1: KG Theory Foundation

A foundational skill file that teaches the AI principled reasoning about knowledge structures. Not a domain skill — a META-skill about HOW to think about knowledge extraction.

**File:** `skills/extraction/kg-theory.md`

**What It Teaches:**

```
1. ONTOLOGICAL THINKING
   What EXISTS in a domain. Not just names — what kind of thing IS this?
   Three fundamental kinds:
     Continuants — things that endure (Person, Organization, Place, Technology, Resource)
     Occurrents — things that unfold (Event, Process, Agreement, Law)
     Abstractions — things that are conceptual (Concept, System, Metric, Document)
   Our 14 categories ARE this trichotomy. This grouping helps the AI reason:
     "Is this thing a DOER (continuant), a HAPPENING (occurrent), or an IDEA (abstraction)?"

2. TAXONOMIC REASONING
   IS-A hierarchies. "Central Bank" IS-A Organization. "Federal Reserve" IS-A Central Bank.
   The AI should recognize class vs instance:
     Class: "Central Bank" (the concept)
     Instance: "Federal Reserve" (a specific one)
   Both are valid entities. The AI shouldn't collapse them.

3. SEMANTIC STRUCTURE (TRIPLE THINKING)
   Every relationship is a triple: (subject, predicate, object)
   "Federal Reserve" → REGULATES → "US Banking System"
   The predicate (relType) must be:
     Directional: A FUNDS B ≠ B FUNDS A
     Specific: FUNDS, not "is related to"
     Typed: maps to one of 15 causal families
   Domain/range awareness: LEADS should connect Person → Organization.
   If extraction produces Technology LEADS Concept, something is wrong.

4. CONTEXT SENSITIVITY
   The SAME entity means different things in different documents.
   "IMF" in a Bretton Woods paper: stabilizer, architect of monetary order
   "IMF" in an Asian Financial Crisis paper: disruptor, austerity enforcer
   BOTH are correct. Entity definitions are universal, but ROLES are per-project.
   This is why we have entity.definition (universal) + MENTIONED_IN.role (per-project).

5. COREFERENCE RESOLUTION
   "The president" + "he" + "Biden" + "the commander-in-chief" = ONE entity
   Before extracting relationships, the AI must resolve all references to the
   same real-world entity. This is the #1 source of duplicate entities.
   Aliases capture this: ["Joe Biden", "President Biden", "Biden", "POTUS"]
   Reduces node duplication by 45% (LINK-KG 2025 finding).

6. PROPERTY INHERITANCE
   If "Federal Reserve" is categorized as Organization, it inherits expectations:
     Organizations have: leaders, founding dates, mandates, relationships with other orgs
   The AI should CHECK these expectations against the text:
     "The text mentions the Fed but never says who leads it — should I look harder?"
   Not mandatory — but principled extraction means checking what SHOULD be there.

7. QUALITY OVER QUANTITY
   Missing an entity is recoverable (next extraction catches it).
   Hallucinating an entity corrupts the graph permanently.
   95%+ precision target. When in doubt, DON'T extract.
   Evidence quotes are the quality gate: no quote = don't extract.
```

**Why This Matters:**

Without KG theory, the AI pattern-matches: "I see a name, I'll make it an entity."
With KG theory, the AI REASONS: "This is a continuant (it endures), it's an instance of a class I've seen before, it has domain-expected properties I should check for, and its role in THIS document differs from its role in the previous one."

The difference is extraction that UNDERSTANDS vs extraction that COPIES.

### Layer 2: Locked Format (unchanged from CLAUDE.md)

The 14 categories, 15 causal families, JSON schema, and validation rules are LOCKED. They ARE the universal container. Every domain skill maps INTO this format — never changes it.

```
CATEGORIES (our taxonomy, mapped to ontological kinds):
  Continuants:   Person, Organization, Place, Technology, Resource
  Occurrents:    Event, Process, Agreement, Law
  Abstractions:  Concept, System, Metric, Document, Other

CAUSAL FAMILIES (relationship coloring):
  CAUSES, ENABLES, BLOCKS, INFLUENCES, DEPENDS_ON,
  CONTRADICTS, SUPPORTS, PRECEDES, COMPETES_WITH,
  COOPERATES_WITH, REGULATES, TRANSFORMS, PRODUCES,
  CONSUMES, IMPLEMENTS

VALIDATION (30+ rules, non-negotiable):
  Entity definitions: 100+ chars
  Entity roles: stance + mechanics + reasoning
  Edge descriptions: 80+ chars
  Evidence: exact quotes from source
  Causal chains: system mechanics, not narrative
```

### Layer 3: Domain Skills (The Adaptive Layer)

This is where the system becomes intelligent across domains. Domain skills teach the AI WHAT to look for, but they NEVER change the format.

**Three sources of domain skills:**

```
SHIPPED (we write these, included in MCP):
  skills/domains/geopolitics.md    ← Nations, treaties, sanctions, power dynamics
  skills/domains/finance.md        ← Instruments, flows, regulatory bodies, risk
  skills/domains/technology.md     ← Systems, protocols, dependencies, adoption

AI-GENERATED (created when AI encounters new domains):
  skills/custom/molecular-biology.md     ← Created when first biology paper extracted
  skills/custom/software-architecture.md ← Created when first codebase analyzed
  skills/custom/constitutional-law.md    ← Created when first legal doc extracted

USER-CREATED (hand-written by user):
  skills/custom/my-research-style.md     ← User's personal extraction approach
  skills/custom/climate-science.md       ← User's specific domain needs
```

**What a domain skill contains (standardized template):**

```markdown
# Domain: [Name]

## Entity Mapping
What domain concepts map to which of the 14 MT categories, and WHY.
| Domain Concept | MT Category | Reasoning |
|---------------|-------------|-----------|
| Gene (BRCA1)  | Resource    | Genes are informational resources encoding proteins |
| Pathway       | Process     | Pathways are sequences of biochemical reactions |
| Cell type     | System      | Cells are autonomous systems with inputs/outputs |

## Relationship Patterns
What domain verbs map to which relType + causalClassification.
| Domain Verb   | relType      | causalClassification | Notes |
|--------------|-------------|---------------------|-------|
| activates    | ACTIVATES    | ENABLES              | Enzymatic activation |
| inhibits     | INHIBITS     | BLOCKS               | Competitive/non-competitive |
| encodes      | ENCODES      | PRODUCES             | Gene → protein |

## Extraction Focus
Where the AI should spend its reasoning effort in this domain.
- Trace causal chains through metabolic/signaling pathways
- Gene-protein relationships are FOUNDATIONAL (always extract)
- Entity definitions must include molecular function + cellular role

## Quality Emphasis
What "good" looks like specifically for this domain.
- Pathway chains > entity count (mechanisms matter more than names)
- Evidence from experimental methods matters (in vitro vs in vivo)
- Temporal: experimental timeline, not historical

## Common Traps
What NOT to extract, false patterns, domain-specific gotchas.
- Don't create separate entities for "p53" and "TP53" (same gene, different naming)
- Chemical formulas (H2O, NaCl) are NOT entities unless they play a role
- "Model organism" references (E. coli, mouse) only entities if the study IS about them

## Example (mini-extraction showing the skill applied)
Given text: "BRCA1 encodes a tumor suppressor protein that repairs DNA..."
Expected entities: BRCA1 (Resource), tumor suppressor protein (Resource), DNA (Resource)
Expected relationship: BRCA1 → ENCODES → tumor suppressor protein (PRODUCES)
Expected chain: BRCA1 → encodes protein → repairs DNA → prevents mutation → suppresses tumors
```

### Domain Skill Self-Generation Protocol

When the AI encounters a domain it hasn't seen before, it CREATES a domain skill rather than extracting blind. This is the self-evolving behavior.

```
EXTRACTION REQUEST ARRIVES
  |
  v
MAIN AGENT: Phase A — Quick Text Scan
  |  Detect domain, tags, key entities (same as before)
  |  Detected domain: "molecular biology"
  |
  v
MAIN AGENT: Phase B — Skill Discovery (NEW PHASE)
  |
  |-- 1. Check skills/custom/ for matching skill
  |      → Look for files with matching domain in name or content
  |      → molecular-biology.md? software-architecture.md?
  |
  |-- 2. Check skills/domains/ for matching shipped skill
  |      → geopolitics.md? finance.md? technology.md?
  |
  |-- 3. IF MATCH FOUND:
  |      → Load it
  |      → Tell user: "Using molecular-biology extraction skill"
  |      → Proceed to Phase C (placement)
  |
  |-- 4. IF NO MATCH AND DOMAIN IS SPECIALIZED:
  |      |
  |      +-- Read skills/extraction/kg-theory.md (ontological reasoning)
  |      +-- Read skills/extraction/domain-skill-template.md (template to follow)
  |      +-- GENERATE domain skill using KG theory + template
  |      |   The AI reasons:
  |      |     "Molecular biology deals with continuants (genes, proteins, cells),
  |      |      occurrents (pathways, reactions), and abstractions (theories, models).
  |      |      Relationships are mechanistic (encodes, activates, inhibits).
  |      |      Causal chains follow biochemical pathways."
  |      |
  |      +-- Save to skills/custom/{domain}.md
  |      +-- Tell user: "I created an extraction skill for molecular biology.
  |           You can review/edit it at skills/custom/molecular-biology.md"
  |      +-- Proceed to Phase C (placement)
  |
  |-- 5. IF NO MATCH AND DOMAIN IS GENERAL:
  |      → Proceed without domain skill (KG theory + quality bar sufficient)
  |      → After extraction, EVALUATE: "Was a domain skill needed?"
  |      → If yes: generate retroactively, save for next time
```

**What triggers skill generation vs proceeding without:**

| Signal | Action |
|--------|--------|
| Domain clearly specialized (biology, law, medicine, engineering) | Generate skill before extraction |
| Domain is general (current events, opinion piece, biography) | Proceed without, the 14 categories + quality bar handle it |
| First extraction in a domain | Generate skill |
| Second extraction in same domain but first skill was weak | Regenerate, replacing the old one |
| User says "that extraction missed X" | AI updates the domain skill to address the miss |

### How Domain Skills Flow Into Workers

```
MAIN AGENT (has the domain skill loaded)
  |
  spawns EXTRACTION WORKER with:
  |
  |-- LOCKED: format rules, validation requirements, JSON schema
  |-- FOUNDATION: kg-theory.md (ontological reasoning principles)
  |-- DOMAIN: {domain}.md (entity mapping, relationship patterns, focus areas)
  |-- PERSONAL: agent.md extraction prefs
  |-- TEXT: the raw document
  |
  v
EXTRACTION WORKER uses domain skill at:
  |
  |-- Step 03 (Entity Discovery):
  |   "Domain skill says genes are Resources, pathways are Processes.
  |    Looking for: gene names, protein names, pathway names, cell types.
  |    Checking: are there IS-A relationships? class vs instance?"
  |
  |-- Step 04 (Full Extraction):
  |   "Domain skill says 'activates' maps to ENABLES, 'inhibits' to BLOCKS.
  |    Building chains through biochemical pathways.
  |    Focusing on mechanism descriptions over entity counting."
  |
  |-- Everything else (HTML, NLP, embeddings, upload) unchanged
```

### Concrete Examples: Same Document, Different Domains

**Example 1: Code (software-architecture.md skill)**

```
SOURCE: "The React component calls useEffect to fetch data from the API endpoint.
         The response is stored in Zustand state, which triggers a re-render."

ENTITY MAPPING (from domain skill):
  React              → Technology (framework)
  useEffect          → Process (lifecycle hook)
  API endpoint       → Technology (service interface)
  Zustand            → Technology (state management)
  Component re-render → Event (UI lifecycle event)

RELATIONSHIPS:
  React component → CALLS → useEffect (DEPENDS_ON)
  useEffect → FETCHES_FROM → API endpoint (CONSUMES)
  API endpoint → RETURNS_TO → Zustand state (PRODUCES)
  Zustand state → TRIGGERS → re-render (CAUSES)

CHAIN:
  Component mount → useEffect fires → API call → response → state update → re-render
  (This is a data flow chain, not a historical chain)
```

**Example 2: Biology (molecular-biology.md skill)**

```
SOURCE: "BRCA1 encodes a tumor suppressor protein that repairs double-strand
         DNA breaks through homologous recombination."

ENTITY MAPPING:
  BRCA1                    → Resource (gene)
  Tumor suppressor protein → Resource (protein)
  DNA                      → Resource (molecule)
  Homologous recombination → Process (repair mechanism)
  Double-strand break      → Event (molecular damage event)

RELATIONSHIPS:
  BRCA1 → ENCODES → tumor suppressor protein (PRODUCES)
  tumor suppressor protein → REPAIRS → DNA (TRANSFORMS)
  Homologous recombination → ENABLES → DNA repair (ENABLES)
  Double-strand break → TRIGGERS → repair pathway (CAUSES)

CHAIN:
  DNA damage → double-strand break → BRCA1 activated → protein produced →
  homologous recombination initiated → DNA repaired → cell survives
```

**Example 3: Geopolitics (geopolitics.md skill — shipped)**

```
SOURCE: "The IMF imposed structural adjustment programs on Thailand following
         the 1997 currency crisis, requiring privatization of state enterprises."

ENTITY MAPPING:
  IMF                          → Organization
  Thailand                     → Place
  Structural adjustment program → Process
  1997 currency crisis          → Event
  State enterprises             → Organization
  Privatization                → Process

RELATIONSHIPS:
  IMF → IMPOSED → structural adjustment (REGULATES)
  1997 crisis → TRIGGERED → IMF intervention (CAUSES)
  Structural adjustment → REQUIRES → privatization (DEPENDS_ON)
  Privatization → AFFECTS → state enterprises (TRANSFORMS)

CHAIN:
  Currency speculation → Thai baht collapses → IMF loan conditional →
  structural adjustment imposed → privatization required → state assets sold →
  foreign ownership increases → sovereignty debate
```

**In all three cases:** Same 14 categories. Same 15 causal families. Same JSON format. Same validation rules. Different domain skills guiding WHAT to look for and HOW to map domain concepts to the universal format.

### KG Theory Research Findings (Informing the Foundation)

Research completed on 10 topics. Key findings adopted:

| Finding | Adopted How |
|---------|------------|
| **Continuant/occurrent/abstraction trichotomy** (BFO) | Groups our 14 categories into 3 ontological kinds. Helps AI reason about entity nature. |
| **Coreference resolution reduces duplicates by 45%** (LINK-KG 2025) | Made explicit in kg-theory.md. AI must resolve "the president" + "Biden" before extracting relationships. |
| **Domain/range constraints** (OWL concepts) | LEADS should connect Person → Organization. Post-extraction validation checks this. |
| **Three-pass extraction** (CORE-KG) | Our pipeline already does this: Step 03 (entities) → Step 04 (relationships) → Step 06 (validation). Validated. |
| **ConceptNet causal vocabulary** | Enriches our chain thinking: HAS_PREREQUISITE, HAS_SUBEVENT, MOTIVATED_BY. Feeds into kg-theory.md. |
| **Qualified statements** (Wikidata pattern) | Our edge metadata already does this: evidence, evidenceStrength, magnitude, year/period. Validated. |
| **95%+ precision target** (YAGO) | Missing is recoverable, hallucinating corrupts. Baked into quality bar. |
| **BERT validated at our scale** | KGE (TransE, ComplEx) only useful at 1000+ entities. Our BERT approach is correct. |
| **Sequential type-aware extraction** (CORE-KG) | Extract by type: Person first, then Org, then Place. Reduces type confusion from 27% to 17%. |

**Findings NOT adopted (and why):**

| Finding | Why Not |
|---------|---------|
| Full formal ontology (BFO/DOLCE/SUMO) | Person-years of engineering. We have a personal tool, not a semantic web system. |
| OWL syntax / reasoning engines | Wrong stack. We use Neo4j/Cypher, not RDF/SPARQL. Concepts adopted, syntax not. |
| KGE at current scale | Need 10x more entities. Revisit when cross-project graph exceeds 1000+ entities. |
| Deep type hierarchies | Two levels max. 14 categories grouped into 3 kinds is sufficient. |
| Full provenance ontology (PROV-O) | Our relationship properties (evidence, source, confidence) handle this simpler. |

---

## Resource Origin Map (C01 skills → C04 resources)

Every resource is either REORGANIZED from C01's existing 14 skill files or NEW.

### From C01 (reorganized)

| C01 Skill File (137KB total) | Becomes | Notes |
|------------------------------|---------|-------|
| `extraction-pipeline-skill.md` (20KB) | `maps/pipeline-map.md` + `pipeline/step-01` through `step-06` | Split: map goes to maps/, steps go to pipeline/ |
| `extraction-skill.md` (9KB) | `extraction/entity-discovery.md` + `extraction/quality-bar.md` | Split: entity rules vs quality examples |
| `extraction-agent.md` (12KB) | `pipeline/step-03-entities.md` + `pipeline/step-04-extraction.md` | Split into step files |
| `checklist-template.md` (13KB) | `pipeline/validation-rules.md` | Gate criteria become validation rules doc |
| `extraction-checklist.md` (2KB) | Merged into `pipeline/retry-guide.md` | Common mistakes → retry guide |
| `neo4j-operations-skill.md` (16KB) | `system/schema-guide.md` + `system/cypher-patterns.md` | Split: schema ref vs query patterns |
| `cypher-queries-skill.md` (8KB) | `system/cypher-patterns.md` (merged) | Merged with neo4j-operations queries |
| `gds-skill.md` (5KB) | `system/gds-guide.md` | Direct transfer |
| `gds-catalog-skill.md` (23KB) | `system/gds-guide.md` (merged, condensed) | Full catalog condensed to what MT uses |
| `html-template-skill.md` (8KB) | `extraction/html-template.md` | Direct transfer |
| `nlp-setup-skill.md` (5KB) | `pipeline/step-02-nlp.md` | Becomes step file |
| `maintenance-skill.md` (5KB) | `system/maintenance-guide.md` | Direct transfer |
| `import-pipeline-skill.md` (9KB) | `system/export-import-guide.md` | Direct transfer |

### New Content (to be written)

| Resource | Purpose | Source |
|----------|---------|--------|
| `maps/system-map.md` | Full architecture overview | Written from C01-C05 knowledge |
| `maps/skill-index.md` | Index of all skills | Generated from skills/ directory |
| `extraction/relationship-building.md` | How to build relationships | Extracted from extraction-skill.md + new content |
| `extraction/causal-chains.md` | How to construct chains | Extracted from extraction-skill.md + new content |
| `analysis/bridge-detection.md` | Bridge entity mechanics | Written from GDS + bridge tier logic |
| `analysis/gap-analysis.md` | Gap detection guide | Written from C03 gap queries + new research agent design |
| `analysis/collection-analysis.md` | Collection analysis guide | New |
| `analysis/entity-comparison.md` | Cross-project entity comparison | New |
| `extraction/kg-theory.md` | **KG theory foundation** — ontological reasoning, triple thinking, coreference, context, quality principles | New (from KG theory research) |
| `extraction/domain-skill-template.md` | **Template for creating domain skills** — 6 sections: entity mapping, relationships, focus, quality, traps, example | New |
| `domains/geopolitics.md` | Geopolitics extraction guidance (shipped domain skill) | New |
| `domains/finance.md` | Finance extraction guidance (shipped domain skill) | New |
| `domains/technology.md` | Technology extraction guidance (shipped domain skill) | New |
| `pipeline/step-00-bootstrap.md` | Bootstrap instructions | Extracted from extraction-agent.md |
| `pipeline/step-05-embeddings.md` | Embedding instructions | Extracted from extraction-agent.md |
| `pipeline/step-06-upload.md` | Upload instructions | Extracted from extraction-agent.md |
| `pipeline/retry-guide.md` | Failure recovery | New (from error patterns) |
| `agent.md` | Default user config | New |

---

## Integration Points

### C04 ← C01 (Ingestion)

MCP server CALLS C01 Python scripts:
```
C01 Script                 MCP Tool                    How Called
neo4j/upload.py         → memorytonic_extract       → spawn-and-exit, args: [projectDir]
neo4j/validate_project.py → (inside _extract)       → spawn-and-exit, args: [projectDir]
neo4j/gds.py            → memorytonic_recompute     → spawn-and-exit, args: [flags]
neo4j/delete_project.py → memorytonic_delete_project → spawn-and-exit, args: [uniqueId]
neo4j/export_collection.py → memorytonic_export     → spawn-and-exit, args: [collectionName]
neo4j/import_collection.py → memorytonic_import     → spawn-and-exit, args: [zipPath, flags]
neo4j/bootstrap.py      → memorytonic_bootstrap     → spawn-and-exit
nlp/preprocess.py       → memorytonic_nlp_preprocess → spawn-and-exit, stdin: JSON
nlp/embed.py            → (inside _extract)          → spawn-and-exit, stdin: JSON
```

MCP server READS C01 data directories:
```
data/temp/          ← pipeline working directory
data/extracted/     ← permanent artifact storage
data/sources/       ← HTML files (referenced by Neo4j Project.htmlPath)
data/exports/       ← exported collection ZIPs
data/projects/      ← raw source text copies
```

### C04 → C02 (Graph Studio) + C03 (Frontend)

No direct connection. All three read/write the same Neo4j database independently.

BUT MCP must produce data that C02 + C03 can consume:
```
C02 NEEDS:                           C04 MUST PRODUCE:
  entity.pageRank                      → gds.py writes this
  entity.betweenness                   → gds.py writes this
  entity.degree                        → gds.py writes this
  entity.projectCount                  → upload.py increments this
  entity.embedding (384d)              → embed.py writes this
  SIMILAR_TO edges (similarity score)  → gds.py creates these
  MENTIONED_IN.role                    → upload.py writes this
  RELATES_TO full metadata             → upload.py writes this
  CHAIN_LINK with orderIndex           → upload.py writes this
  BELONGS_TO_PROJECT on chains + events → upload.py writes this
  Collection.name, .collectionId       → upload.py creates this
  Project.htmlPath                     → upload.py writes this
  Fulltext index on entity name/def    → bootstrap.py creates this
  Vector indexes (384d cosine)         → bootstrap.py creates this
```

C03 expects 29 specific queries to work. All query the schema that C01 creates.
C02 expects 8 specific queries. All collection-scoped.

### C04 → C05 (Electron)

```
Electron contract (what C05 needs from C04):
  - MCP server is a Node.js process started with: node dist/index.js
  - Environment variables: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD,
    NEO4J_DATABASE, MEMORYTONIC_DATA_DIR
  - Health check: memorytonic_health tool returns system status
  - Claude Desktop config: JSON block to write to claude_desktop_config.json
  - Process lifecycle: start on app launch, stop on app close
  - Logs: stderr (MCP protocol uses stdout)
```

---

## C01 Schema Advancements (Additive — No Breaking Changes)

C01 is CLOSED. These additions do NOT break existing data or queries. Neo4j is property-flexible — new fields are simply ignored by components that don't read them.

### New Fields on Entities

```
EXISTING (unchanged):
  name, category, definition, aliases[], role (per-project via MENTIONED_IN)
  pageRank, betweenness, degree, projectCount
  embedding (384d vector)

NEW (additive):
  tags: string[]          ← 3-8 conceptual tags per entity
                             Kebab-case, lowercase
                             Types: thematic (monetary-policy), functional (regulator),
                             domain (geopolitics), temporal (post-2008)
                             Purpose: LLM search, vector enrichment, collection matching
```

### New Fields on Relationships (RELATES_TO edges)

```
EXISTING (unchanged):
  relType, causalClassification, description, evidence,
  evidenceStrength, magnitude, year/period, projectId

NEW (additive):
  tags: string[]          ← 1-4 thematic tags per relationship
                             E.g., "power-dynamics", "financial-flow", "institutional-control"
                             Purpose: edge filtering, thematic search, pattern detection
```

### New Fields on Projects

```
EXISTING (unchanged):
  name, uniqueId, summary, narrative_flow, tags (domain/subdomain/baseTags),
  htmlPath, htmlContent

NEW (additive):
  thesis: string          ← Primary argument of the document (1-2 sentences)
                             "This document argues that IMF structural adjustment
                              programs deepened the 1997 Asian financial crisis"
  keyQuestion: string     ← Research question the document answers
                             "How did IMF conditionality affect recovery timelines?"
  geographicFocus: string[] ← Places central to the document
                             ["Thailand", "South Korea", "Indonesia"]
  historicalPeriod: string  ← Time range covered
                             "1997-2002" or "Cold War era"
```

### C01 Script Updates Required

| Script | Change | Impact |
|--------|--------|--------|
| `neo4j/bootstrap.py` | Add `tags` to fulltext index on Entity nodes | New entities with tags become searchable |
| `neo4j/upload.py` | Write entity.tags[], edge.tags[], project.thesis/keyQuestion/geo/period | New properties stored in Neo4j |
| `neo4j/validate_project.py` | Add validation: entity tags 3-8 items, kebab-case, edge tags 1-4 | Quality gate for tags |
| `nlp/embed.py` | Concatenate tags into embedding text: definition + role + tags.join(' ') | Richer vectors, better SIMILAR_TO |
| `neo4j/export_collection.py` | Include new fields in graph.json export | Exports carry full data |
| `neo4j/import_collection.py` | Read new fields from graph.json during import | Imports restore full data |

### C02/C03 Impact

| Component | Impact | Required Action |
|-----------|--------|----------------|
| C02 Graph Studio | None breaking. Tags ignored by current code. | Optional: add tags to fulltext index (1 line in Q4) |
| C03 Frontend | None breaking. EntityCard already renders unknown properties. ProjectCard already has thesis/keyQuestion UI. | Optional: render entity.tags as pills, show project.thesis prominently |

---

## Instruction Architecture (Final Design)

Two layers of instructions. Primary is always read. Secondary is additive and domain-specific.

```
skills/
│
├── extraction/             ← PRIMARY INSTRUCTIONS (always read, ships with MCP)
│   ├── kg-theory.md               ← KG foundation: ontological thinking, triple structure,
│   │                                 coreference, context, taxonomy, quality principles
│   ├── display-awareness.md       ← How extracted data feeds the UI: definitions on cards,
│   │                                 roles in RSB, evidence in blockquotes, aliases → bridges,
│   │                                 connections → node size, chain explanations in chain view
│   ├── tag-awareness.md           ← Tag extraction: 3-8 per entity, 1-4 per edge,
│   │                                 kebab-case, conceptual not descriptive, domain-spanning,
│   │                                 feeds fulltext search + vector embeddings + collection matching
│   ├── domain-skill-template.md   ← Template for creating domain skills (6 sections)
│   ├── entity-discovery.md        ← How to find entities, write definitions, assign categories
│   ├── relationship-building.md   ← How to build relationships, evidence rules, edge quality
│   ├── causal-chains.md           ← Chain construction: system mechanics, ordering
│   ├── html-template.md           ← Dark theme HTML with NARRATOR/GATORSQUARE voices
│   └── quality-bar.md             ← Quality requirements with BAD/GOOD examples
│
├── instructions/           ← SECONDARY INSTRUCTIONS (domain-specific, user-editable)
│   ├── geopolitics.md             ← Shipped: sanctions, treaties, power dynamics
│   ├── finance.md                 ← Shipped: instruments, flows, risk
│   ├── technology.md              ← Shipped: systems, protocols, adoption
│   └── (AI-generated / user-created domain skills appear here)
│
└── agent.md                ← USER PREFERENCES (personal, always editable)
                               Extraction style, default domain, quality overrides
```

### How Layers Interact

```
PRIMARY (always read by extraction worker):
  kg-theory.md           → HOW to think about knowledge structures
  display-awareness.md   → HOW extracted data will be displayed (cards, graph, RSB)
  tag-awareness.md       → HOW to create useful tags for search/discovery
  quality-bar.md         → WHAT minimums must be met
  entity-discovery.md    → WHAT to look for
  relationship-building.md → HOW to build edges
  causal-chains.md       → HOW to build chains

SECONDARY (loaded based on domain detection):
  instructions/{domain}.md → WHAT is specific to this domain
                              Entity mapping, relationship patterns, focus areas
                              ADDS guidance, CANNOT override primary format/validation

PERSONAL (always read):
  agent.md               → User style preferences, default domain, custom rules
                            ADDS preferences, CANNOT override primary

RULE: Secondary + Personal are ADDITIVE.
  They tell the agent "in biology, genes are Resources" — they don't say
  "change the JSON schema" or "skip validation."
  validate_project.py enforces the SAME rules regardless of domain skill.
```

### New MCP Tools for Instruction Management

```
memorytonic_list_skills()
  Returns: { primary: [...], instructions: [...], agent: true/false }
  Purpose: Agent knows what domain skills are available before extraction

memorytonic_save_skill({ name, content, version? })
  Writes: skills/instructions/{name}.md
  If version=true and file exists: renames old file to {name}.v{N}.md
  Purpose: Claude creates/updates domain skills. User edits directly on disk.

memorytonic_read_skill({ name })
  Returns: file content of skills/instructions/{name}.md
  Purpose: Agent reads a specific skill (also available via MCP resources)
```

Total tool count: 36 → **39 tools** (3 new instruction management tools)

---

## Build Phases (Comprehensive Implementation Plan)

### Phase 0: C01 Advancements (Pre-MCP)

Advance C01's extraction output. Additive changes only. Test with existing projects.

```
0.1  SCHEMA: Add entity.tags validation to validate_project.py
       Rule: tags must be array, 3-8 items, all kebab-case lowercase
       Rule: no generic tags ("important", "entity", "relevant")
0.2  SCHEMA: Add edge.tags validation to validate_project.py
       Rule: tags must be array, 1-4 items, kebab-case lowercase
0.3  SCHEMA: Add project.thesis, keyQuestion, geographicFocus, historicalPeriod validation
       Rule: thesis string (optional but encouraged), keyQuestion string (optional),
       geographicFocus string[] (optional), historicalPeriod string (optional)
0.4  UPLOAD: Update upload.py to write new entity/edge/project properties
       Entity nodes: SET e.tags = $tags
       RELATES_TO edges: SET r.tags = $tags
       Project nodes: SET p.thesis = $thesis, etc.
0.5  BOOTSTRAP: Update bootstrap.py fulltext index to include entity.tags
       DROP + recreate entity_fulltext index: name, definition, tags
0.6  EMBEDDINGS: Update embed.py to include tags in embedding text
       New embedding text: definition + " " + role + " " + tags.join(" ")
0.7  EXPORT: Update export_collection.py to include new fields in graph.json
0.8  IMPORT: Update import_collection.py to read new fields from graph.json
0.9  TEST: Re-validate existing extracted projects (should pass — new fields optional)
0.10 TEST: Extract 1 new project WITH tags + thesis/keyQuestion
       Use: gatorsquare-studio test project
       Verify: tags appear in Neo4j, fulltext search finds by tag, embeddings enriched
```

**Milestone: C01 produces richer extraction data. Existing projects unaffected.**

### Phase 1: C04 Code Layer (39 Tools + Data Layer)

Build the locked process. All 39 tools working.

```
1.1  Project scaffold: package.json, tsconfig, .env
1.2  neo4j/driver.ts: singleton, runRead, runWrite, toPlain, healthCheck
1.3  python/spawn.ts: generic spawn-and-exit with timeouts
1.4  python/scripts.ts: typed wrappers for all C01 scripts
1.5  helpers/ok-err.ts + constants/index.ts + types/index.ts
1.6  server.ts + index.ts: McpServer with stdio transport
1.7  tools/system.ts: health, bootstrap, stats (3 tools)
1.8  tools/query.ts: search, recall, explore, paths, similar, query, explain (7 tools)
1.9  tools/entity-project.ts: get_entity, get_project, list_projects, list_collections (4 tools)
1.10 tools/collections.ts: all 7 collection tools
1.11 tools/directories.ts: all 3 directory tools
1.12 tools/analysis.ts: importance, gaps, temporal, overlaps, suggestions (5 tools)
1.13 tools/admin.ts: recompute, export, import, delete_project (4 tools)
1.14 tools/extraction.ts: extract, nlp_preprocess, extraction_guide (3 tools)
1.15 tools/skills.ts: list_skills, save_skill, read_skill (3 NEW tools)
1.16 TEST: all 39 tools against real Neo4j
```

**Milestone: Claude Desktop can call all 39 tools.**

### Phase 2: Instruction Layer (Resources)

Build the open instruction layer. Write all primary + secondary skill files.

```
PRIMARY INSTRUCTIONS (new files to write):
2.1  extraction/kg-theory.md: ontological reasoning, triple thinking, coreference,
     context sensitivity, property inheritance, quality > quantity
     Source: KG research findings (10 topics) + synthesis
2.2  extraction/display-awareness.md: how definitions appear on cards, roles in RSB,
     evidence in blockquotes, aliases drive bridges, connections drive node size,
     chain explanations in CausalChainView
     Source: C02/C03 data consumption study
2.3  extraction/tag-awareness.md: 3-8 per entity, 1-4 per edge, kebab-case,
     conceptual not descriptive, feeds fulltext + vectors + collection matching,
     tag types (thematic/functional/domain/temporal), BAD/GOOD examples
     Source: tag design from this session
2.4  extraction/domain-skill-template.md: 6-section template
     (entity mapping, relationships, focus, quality, traps, example)

PRIMARY INSTRUCTIONS (reorganized from C01):
2.5  Split extraction-pipeline-skill.md → maps/pipeline-map.md + pipeline/step-01 through step-06
2.6  Split extraction-skill.md → extraction/entity-discovery.md + extraction/quality-bar.md
2.7  Split extraction-agent.md → pipeline/step-03-entities.md + pipeline/step-04-extraction.md
2.8  Merge checklist-template.md → pipeline/validation-rules.md
2.9  Split neo4j-operations-skill.md → system/schema-guide.md + system/cypher-patterns.md
2.10 Transfer gds-skill.md → system/gds-guide.md (condensed with gds-catalog)
2.11 Transfer html-template-skill.md → extraction/html-template.md
2.12 Transfer nlp-setup-skill.md → pipeline/step-02-nlp.md
2.13 Transfer maintenance-skill.md → system/maintenance-guide.md
2.14 Transfer import-pipeline-skill.md → system/export-import-guide.md
2.15 Write extraction/relationship-building.md (new, from extraction-skill + research)
2.16 Write extraction/causal-chains.md (new, from extraction-skill + research)

NAVIGATION:
2.17 Write maps/system-map.md: full architecture (C01-C05, data flow, where things live)
2.18 Write maps/pipeline-map.md: 6-step flow with validation per step
2.19 Write maps/skill-index.md: index of ALL skills with URIs

ANALYSIS SKILLS (new):
2.20 Write analysis/bridge-detection.md
2.21 Write analysis/gap-analysis.md
2.22 Write analysis/collection-analysis.md
2.23 Write analysis/entity-comparison.md

SECONDARY INSTRUCTIONS (shipped domain skills):
2.24 Write instructions/geopolitics.md (using domain-skill-template)
2.25 Write instructions/finance.md
2.26 Write instructions/technology.md

USER CONFIG:
2.27 Write agent.md (default user configuration)

RETRY/RECOVERY:
2.28 Write pipeline/step-00-bootstrap.md
2.29 Write pipeline/step-05-embeddings.md
2.30 Write pipeline/step-06-upload.md
2.31 Write pipeline/retry-guide.md

CODE:
2.32 resources/server.ts: list + read .md files from skills/ directory
2.33 Register all resources in server.ts
2.34 TEST: all resources readable via MCP resources/list and resources/read
```

**Milestone: Claude can read any skill file on demand. All primary + secondary instructions exist.**

### Phase 3: Workflow Layer (Prompts)

Build the 6 prompts that assemble resources into workflows.

```
3.1  prompts/assembler.ts: prompt assembly logic
       Each prompt reads resource files from disk and combines them
       Dynamic: includes agent.md content, detects domain skill

3.2  memorytonic-introduction prompt
       Assembles: system-map + skill-index + agent.md + routing guide
       Tells Claude: what tools exist, what skills teach what, how to route requests

3.3  extract-document prompt
       Assembles: pipeline-map + quality-bar + display-awareness + tag-awareness
                  + kg-theory (summary) + domain skill (if applicable) + agent.md
       Tells Claude: full extraction workflow with all awareness layers

3.4  analyze-collection prompt
       Assembles: collection-analysis + bridge-detection + gap-analysis + agent.md
       Tells Claude: 7-phase research analysis protocol

3.5  explore-entity prompt
       Assembles: entity-comparison + schema-guide (entity section) + agent.md
       Tells Claude: how to deep-dive an entity across projects

3.6  export-collection + import-collection prompts
       Assembles: export-import-guide + system-map (storage section) + agent.md

3.7  Register all prompts in server.ts
3.8  TEST: each prompt returns correct assembled content
```

**Milestone: Claude gets complete workflow instructions from a single prompt call.**

### Phase 4: Integration Testing

Full end-to-end testing with Claude Desktop.

```
EXTRACTION (the critical path):
4.1  Full extraction flow with new fields:
       introduction → domain detection → skill discovery → placement →
       worker → extract with tags + thesis + evidence → upload → verify
4.2  Verify: entity tags in Neo4j, fulltext search finds by tag
4.3  Verify: project thesis/keyQuestion in Neo4j
4.4  Verify: relationship tags in Neo4j
4.5  Verify: embeddings include tags (check vector quality)

RESEARCH:
4.6  Research agent flow: analyze collection → gaps → suggestions
4.7  Tag-based analysis: "which themes are underrepresented?"

QUERY:
4.8  Search by tag: memorytonic_search("monetary-policy")
4.9  Vector search with tag-enriched embeddings
4.10 Entity deep-dive: get_entity returns tags + richer data

SKILL MANAGEMENT:
4.11 List skills → see shipped + custom domain skills
4.12 AI generates new domain skill for unfamiliar domain
4.13 Save skill → verify file written, versioning works
4.14 Next extraction uses auto-generated skill

EXPORT/IMPORT:
4.15 Export with new fields → verify graph.json contains tags, thesis, etc.
4.16 Import → verify new fields restored in Neo4j

EDGE CASES (from DESIGN-SPEC.md E1-E12 + new):
4.17 Entity with no tags (should fail validation)
4.18 Entity with generic tags ("important") (should fail validation)
4.19 Project without thesis (should pass — optional but encouraged)
4.20 Domain skill conflicts (custom/ vs shipped — custom/ wins)
4.21 AI-generated skill versioning (regenerate keeps old version)

POLISH:
4.22 Error messages: all user-friendly, no raw stack traces
4.23 Tool descriptions: Claude understands every tool's purpose
4.24 Write contracts/electron-contract.md
4.25 Update STATUS.md → CLOSED
```

**Milestone: All 6 flows work end-to-end. Tags, thesis, display-awareness verified.**

---

## Dependencies

```
npm packages:
  @modelcontextprotocol/sdk     ← MCP protocol
  neo4j-driver                   ← Bolt connection to Neo4j
  zod                            ← Input validation for tool schemas

C01 Python scripts (ADVANCED in Phase 0):
  neo4j/db.py, config.py, bootstrap.py, upload.py,
  validate_project.py, gds.py, delete_project.py,
  export_collection.py, import_collection.py,
  nlp/preprocess.py, nlp/embed.py

Runtime requirements:
  Neo4j Desktop (running, memorytonic database)
  Python 3.10+ (with spaCy + sentence-transformers in nlp/.venv)
  Node.js 18+ (for MCP server)
  Claude Desktop (MCP client)
```

---

## What This Plan Does NOT Cover (deferred to C05)

- Neo4j installation/management (C05: Electron manages this)
- Python environment setup (C05: Electron creates .venv)
- Claude Desktop configuration UI (C05: Electron auto-configures)
- Authentication / $5 purchase flow (C05)
- Auto-start MCP on app launch (C05)
- System tray / status monitoring (C05)
- Browser-based UI hosting (C05: localhost server)

---

## Summary: What Gets Built (in order)

```
PHASE 0: C01 Advancements
  10 tasks: schema additions + script updates + test
  Outcome: extraction produces tags, thesis, keyQuestion, geographicFocus, historicalPeriod

PHASE 1: C04 Code Layer
  16 tasks: scaffold + 39 tools + data layer + tests
  Outcome: Claude can call all tools

PHASE 2: C04 Instruction Layer
  34 tasks: write ~35 skill files + resource server + tests
  Outcome: Claude can read any instruction on demand

PHASE 3: C04 Workflow Layer
  8 tasks: 6 prompts + assembly logic + tests
  Outcome: Claude gets complete workflow from single prompt

PHASE 4: Integration Testing
  25 tasks: end-to-end flows + edge cases + polish
  Outcome: everything works together in Claude Desktop

TOTAL: ~93 tasks across 5 phases
```
