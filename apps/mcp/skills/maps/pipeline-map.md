# Extraction Pipeline Map

**The complete flow from raw text to knowledge graph. Every step, every tool, every gate.**

This map describes the legacy agent-driven workflow. The current `memorytonic_extract` tool accepts the completed HTML, placement, entities, extraction, and optional exact `source_text`. It writes review artifacts under `apps/ingestion-pipeline/data/temp/<slug>`, generates real embeddings, validates with `--import-mode` (no `03_nlp_entities.json` is produced by this tool), moves artifacts to `data/sources/YYYY-MM-DD/<slug>`, and uploads with `--create-only`. Failures preserve artifacts; existing folders and project IDs are protected. Supply `source_text` to check relationship evidence against the original text. For the repository's full six-artifact `graphs/` workflow, follow `docs/INGESTION_FOR_AGENTS.md` instead.

---

## Pipeline Overview

```
User text → Phase A (scan) → Phase B (skills) → Phase C (placement)
  → Phase D (spawn worker) → Steps 01-09 → Phase E (report)

Total: ~2.5-4 minutes per document
Bottleneck: embed.py (BERT model loading + inference, 60-90s)
```

### Who Does What

| Actor | Steps | Does |
|-------|-------|------|
| **Main Agent** | Phases A-D, E | Scans text, finds skills, gets placement, spawns worker, reports results |
| **Extraction Worker** | Steps 01-09 | Bounded subagent. Receives instructions + text. Executes pipeline. |
| **Python Scripts** | Steps 02, 05, 06, 07, 08 | NLP, embeddings, validation, upload, GDS |
| **User** | Phase C, Phase E | Confirms placement. Accepts or re-extracts. |

---

## Phase A: Text Scan (Main Agent, ~2s)

Main Agent does a quick scan of the raw text to determine:

```json
{
  "domain": "geopolitics",
  "keyEntities": ["Federal Reserve", "Saudi Arabia", "IMF"],
  "tags": ["petrodollar", "sanctions", "energy-markets"],
  "contentType": "research"
}
```

This drives skill selection (Phase B) and placement suggestions (Phase C).

---

## Phase B: Skill Discovery (Main Agent)

Check `instructions/` for a domain-specific extraction skill:

| Scenario | Action |
|----------|--------|
| **Domain skill exists** | Load it. Tell user: "Using geopolitics extraction skill" |
| **Specialized domain, no skill** | Read kg-theory.md + domain-skill-template.md → generate skill → save to instructions/ → tell user |
| **General domain** | Proceed without domain skill. KG theory + quality bar are sufficient. |

---

## Phase C: Smart Placement (Main Agent + User)

Three decisions, all requiring user confirmation:

**1. Directory** — Suggest based on content type (Research, Business, Personal, or custom)

**2. Collection** — Rank existing collections by tag overlap. Show top matches. Option to create new.
- Tool: `memorytonic_collection_suggestions`
- If new collection: ask for description
- If existing has no description: ask user to fill it

**3. Project Name** — Generate kebab-case slug from title. Check uniqueness.

Output: `{ directory, collection, projectName, collectionIsNew, description }`

---

## Phase D: Spawn Extraction Worker

Main Agent spawns a bounded subagent with exactly this context:

```
WORKER RECEIVES:
├── raw_text (the document)
├── placement (directory, collection, name)
├── pipeline_map (this file — maps/pipeline-map.md)
├── quality_bar (extraction/quality-bar.md)
├── kg_theory (extraction/kg-theory.md)
├── domain_skill (if any, from Phase B)
├── display_awareness (extraction/display-awareness.md)
├── tag_awareness (extraction/tag-awareness.md)
├── agent_prefs (extraction section of agent.md)
└── html_template (extraction/html-template.md)
```

In Claude Code: literal subagent (Agent tool). In Claude Desktop: sequential execution.

---

## Step 01: HTML Generation + Placement JSON

| | |
|---|---|
| **Agent** | Extraction Worker |
| **Tools** | None (pure Claude output) |
| **Reads** | html-template.md, placement decisions |
| **Writes** | `data/temp/<slug>/01_html.html`, `data/temp/<slug>/02_placement.json` |

**Actions:**
1. Convert raw text to dark-theme HTML with proper formatting
2. Write placement JSON with directory, collection, project_name, unique_id

**Gate:** HTML file exists. Placement has all required fields. unique_id matches project_name slug.

---

## Step 02: NLP Preprocessing

| | |
|---|---|
| **Agent** | Extraction Worker |
| **Tool** | `memorytonic_nlp_preprocess` |
| **Script** | `preprocess.py` (stdin/stdout JSON) |
| **Time** | 5-10 seconds |
| **Writes** | `data/temp/<slug>/03_nlp_entities.json` |

**Pipeline inside preprocess.py:**
1. Auto-chunk text by double-newline
2. spaCy NER (en_core_web_lg): PERSON→Person, ORG/NORP→Organization, GPE/LOC/FAC→Place, etc.
3. TF-IDF keyword extraction (sklearn): top 20 global, top 10 per section
4. Co-occurrence matrix between entities
5. BERT dedup (similarity > 0.85 → alias candidates)

**NLP is OPTIONAL.** If it crashes or returns empty, proceed to Step 03 without hints. Claude reasoning is the primary engine.

---

## Step 03: Entity Discovery (QUALITY CRITICAL)

| | |
|---|---|
| **Agent** | Extraction Worker (Claude reasoning) |
| **Tools** | None |
| **Reads** | entity-discovery.md, kg-theory.md, display-awareness.md, tag-awareness.md, quality-bar.md, domain skill |
| **Input** | Raw text + 03_nlp_entities.json |
| **Writes** | `data/temp/<slug>/04_all_entities.json` |

**Claude's 11-step reasoning process:**
1. Review NLP candidates against full text
2. Apply KG theory: continuant/occurrent/abstraction ontology
3. Apply domain skill: what entities matter in this domain
4. Apply display awareness: definitions must STAND ALONE on cards
5. Apply tag awareness: 3-8 tags per entity, kebab-case
6. Coreference resolution: same entity, different names → aliases
7. Write nonempty, source-proportionate definitions
8. Write roles (stance + mechanics + reasoning — WHY it matters)
9. Assign categories (from 14 fixed set — ontological, not domain-specific)
10. Include only supported aliases; an empty array is valid
11. Map temporal phases + first_appearance_index

**Gate (ALL must pass):**
- At least one source-supported entity
- All definitions are nonempty and source-proportionate
- All categories from 14 fixed set
- All entities have aliases[]
- All entities have tags[] (3-8, kebab-case)
- temporal_phases may be empty; unsupported first_appearance_index is null
- No duplicate entity names
- Category distribution: not all "Other"
- No generic tags ("important", "relevant")

Gate fail → retry once with specific feedback → escalate to Main Agent if still fails.

---

## Step 04: Full Extraction (QUALITY CRITICAL)

| | |
|---|---|
| **Agent** | Extraction Worker (Claude reasoning) |
| **Tools** | None |
| **Reads** | relationship-building.md, causal-chains.md, display-awareness.md, quality-bar.md, domain skill |
| **Input** | Raw text + 04_all_entities.json |
| **Writes** | `data/temp/<slug>/06_extraction.json` |

**Claude builds three things:**

### Relationships (only those supported by the source; empty allowed)
```
relType:               specific verb (FUNDS, SANCTIONS, ENABLES...)
causalClassification:  1 of 15 families (for filtering/coloring)
description:           nonempty explanation of the source-supported connection
evidence:              exact quote from source text (no paraphrasing)
evidenceStrength:      established | claimed | disputed | speculative
magnitude:             foundational | significant | marginal
tags[]:                1-4 thematic tags (kebab-case)
year/period:           when this relationship was active (if temporal)
```

### Causal Chains (optional)
- Ordered entity → entity links
- Each link: HOW and WHY (system mechanics, not narrative summary)
- Temporal ordering when content supports it

### Project Metadata
```
summary:            nonempty and proportionate to the document
narrative_flow:     supported ordered moments, or an empty array
tags:               { domain, subdomain, base_tags[] }
thesis:             primary argument (1-2 sentences)
keyQuestion:        research question this document answers
geographicFocus[]:  central locations
historicalPeriod:   time range covered
```

**Gate (ALL must pass):**
- Relationships may be empty; every included relationship needs exact evidence
- Causal chains may be empty; every included link must match an evidence-bearing relationship
- All edge descriptions are nonempty and source-supported
- All edges have evidence quotes
- All edges have tags[] (1-4, kebab-case)
- Summary is nonempty and source-proportionate
- narrative_flow may be empty
- tags has domain + subdomain + base_tags
- thesis and keyQuestion present

---

## Step 05: Embeddings

| | |
|---|---|
| **Agent** | Extraction Worker |
| **Script** | `embed.py` (stdin/stdout JSON) |
| **Time** | 60-90 seconds (BOTTLENECK — BERT model loading) |
| **Writes** | `data/temp/<slug>/05_embeddings.json` |

**What gets embedded:**
- Entity definitions + roles (concatenated)
- Project summary
- Tags concatenated into embedding text

**Model:** all-MiniLM-L6-v2, 384d vectors, cosine similarity.

Embeddings run on FINAL rich data — not bare names. This is why quality of definitions/roles matters for semantic search.

---

## Step 06: Validation (Hard Gate)

| | |
|---|---|
| **Agent** | Extraction Worker |
| **Script** | `validate_project.py` |
| **Time** | < 1 second |

Checks 30+ rules. See `extraction/quality-bar.md` for the complete list.

**If validation fails → ABORT. No upload. Worker reports specific errors to Main Agent.**

---

## Step 07: Upload to Neo4j

| | |
|---|---|
| **Agent** | Extraction Worker |
| **Script** | `upload.py` (HTTP API via db.py) |
| **Time** | 2-5 seconds |

**upload.py performs 9 operations:**
1. Create/merge Date + Time nodes, chain links
2. Create Project node with all metadata
3. Link Project → Directory (IN_DIRECTORY)
4. Link Project → Collection (BELONGS_TO)
5. For each entity: MERGE by name + aliases (cross-project), increment projectCount, create MENTIONED_IN
6. For each relationship: CREATE RELATES_TO with all properties (not MERGE — multiple edges between same pair allowed)
7. For each causal chain: Create CausalChain node + CHAIN_LINK edges (ordered)
8. For each temporal event: Create TemporalEvent node + FIRST_APPEARS_IN links
9. Store embeddings on Entity and Project nodes

**Entity merge logic:** `WHERE e.name = $name OR $name IN e.aliases OR ANY(alias IN $aliases WHERE e.name = alias OR alias IN e.aliases)` — case-sensitive.

---

## Step 08: GDS Recomputation

| | |
|---|---|
| **Agent** | Extraction Worker |
| **Script** | `gds.py` |
| **Time** | 1-10 seconds |

Runs on FULL graph (not just the new project):

| Algorithm | Writes To | Purpose |
|-----------|-----------|---------|
| PageRank | entity.pageRank | Entity importance (maxIter=20, dampingFactor=0.85) |
| Betweenness Centrality | entity.betweenness | Bridge detection, structural importance |
| Degree Centrality | entity.degree | Connection count |
| Node Similarity | SIMILAR_TO edges | Entity overlap (cutoff=0.3, topK=5, drops old first) |

**Projection is UNDIRECTED.** RAM guards: PageRank < 50k nodes, Betweenness < 10k nodes.

---

## Step 09: File Organization

Move from temp to permanent storage:
```
data/temp/<slug>/*.json  →  data/extracted/<slug>/
data/temp/<slug>/01_html.html  →  data/sources/YYYY-MM-DD/<slug>/01_html.html
```

Clean temp directory.

---

## Phase E: Report to User (Main Agent)

Main Agent receives worker report and tells user:

```
Extracted "US-China Trade Relations"
→ Research / Global Finance Systems
→ 24 entities, 37 relationships, 4 chains
→ 6 temporal phases, 384d embeddings
→ Graph metrics recomputed

Bridge entities found: Federal Reserve (Gold), IMF (Silver), Saudi Arabia (Silver)
```

Also reports: domain skill generation (if any), quality warnings (if entity count is borderline).

---

## File Artifacts

| # | File | Created By | Used By |
|---|------|-----------|---------|
| 01 | `01_html.html` | Worker (Claude) | upload.py → data/sources/. C03 displays in iframe. |
| 02 | `02_placement.json` | Worker (Claude) | upload.py reads directory, collection, name |
| 03 | `03_nlp_entities.json` | preprocess.py (spaCy) | Worker Step 03 as hints for entity discovery |
| 04 | `04_all_entities.json` | Worker (Claude) | Worker Step 04, embed.py, validate_project.py, upload.py |
| 05 | `05_embeddings.json` | embed.py (BERT) | upload.py writes vectors to Neo4j |
| 06 | `06_extraction.json` | Worker (Claude) | validate_project.py, upload.py |

---

## Decision Points

| # | Decision | Who | When |
|---|----------|-----|------|
| D1 | Domain detection | Main Agent (auto) | Phase A |
| D2 | Load/generate/skip skill | Main Agent (auto, informs user) | Phase B |
| D3 | Which directory | Main Agent suggests, **user confirms** | Phase C |
| D4 | Which collection | Main Agent suggests (ranked), **user confirms** | Phase C |
| D5 | New collection description | **User provides** | Phase C |
| D6 | Project name | Main Agent suggests, **user confirms** | Phase C |
| D7 | Retry failed step | Worker auto-retries once, then **user decides** | Steps 01-06 |
| D8 | Abort pipeline | **User's call** (always) | Any step |
| D9 | Accept quality | Main Agent reports, **user accepts or re-extracts** | Phase E |

---

## Timing Budget

```
Phase A: Text scan            ~2s   (Claude reasoning)
Phase B: Skill discovery      ~5s   (file check, possible generation ~20s)
Phase C: Smart placement      ~30s  (tool call + user interaction)
Step 01: HTML generation      ~15s  (Claude reasoning)
Step 02: NLP preprocessing    5-10s (Python spaCy)
Step 03: Entity discovery     20-40s (Claude reasoning — QUALITY CRITICAL)
Step 04: Full extraction      20-40s (Claude reasoning — QUALITY CRITICAL)
Step 05: Embeddings           60-90s (BERT model — BOTTLENECK)
Step 06: Validation           <1s   (Python, no ML)
Step 07: Upload               2-5s  (Neo4j HTTP writes)
Step 08: GDS                  1-10s (depends on graph size)
Step 09: File organization    <1s   (file moves)
```

---

## Tool-to-Script Mapping

| MCP Tool | Python Script | Communication | Returns |
|----------|--------------|---------------|---------|
| `memorytonic_nlp_preprocess` | preprocess.py | stdin JSON → stdout JSON | NLP entities, keywords, co-occurrences |
| `memorytonic_extract` | validate_project.py → upload.py → embed.py | Sequential subprocess spawns | Upload confirmation + entity counts |
| `memorytonic_recompute` | gds.py | Subprocess spawn | Algorithm results + timing |

---

## Critical Constraints

1. **stdout is MCP protocol pipe** — All Python scripts log to stderr, return data on stdout.
2. **Entity merge is case-sensitive** — "IMF" ≠ "imf". Aliases must match exact case.
3. **RELATES_TO uses CREATE, not MERGE** — Multiple edges between same entity pair are by design (from different projects).
4. **upload.py uses HTTP API** (via db.py) — different from C04's bolt driver for reads.
5. **GDS projection is UNDIRECTED** — affects all centrality calculations.
6. **Embeddings on rich data** — embed definitions+roles, not bare names. Quality of text fields directly affects semantic search quality.
7. **Validation is a HARD GATE** — no upload without passing all 30+ rules.
8. **Temp → permanent only after full success** — partial pipeline failure leaves no permanent artifacts.
