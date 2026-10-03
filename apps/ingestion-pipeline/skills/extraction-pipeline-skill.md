# Extraction Pipeline — Zero-Context Agent Guide

**Purpose:** Complete, self-contained guide for running the MemoryTonic extraction pipeline from raw text to Neo4j. A fresh agent with ZERO prior context can follow this document and produce correct output.

**Working directory:** ALL commands assume cwd is `components/01-ingestion/`. If you are anywhere else, `cd` there first.

**Companion files you MUST read during execution:**
- `skills/extraction-skill.md` — Quality bar with BAD/GOOD examples
- `skills/html-template-skill.md` — HTML template (dark theme, voice blocks, styled sections)
- `skills/checklist-template.md` — Live tracker (copy per project)

---

## BEFORE YOU START

### 1. Verify Neo4j Is Running

```bash
python -c "import sys; sys.path.insert(0,'neo4j'); from db import check_connection; check_connection()"
```

If this fails: Neo4j is not running. Open Neo4j Desktop → Start the DBMS.

### 2. Verify Schema Exists

```bash
python neo4j/bootstrap.py --status
```

Expected: 7 constraints, 8+ indexes, 3 directories. If not: run `python neo4j/bootstrap.py`.

### 3. Check Existing Collections and Projects

Before deciding placement, you MUST know what already exists:

```bash
python -c "
import sys; sys.path.insert(0,'neo4j')
from db import run_cypher
r = run_cypher('MATCH (c:Collection) OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c) RETURN c.name, count(p) ORDER BY count(p) DESC')
print('COLLECTIONS:')
for row in r['data'][0]['data']:
    print(f'  {row[\"row\"][0]}: {row[\"row\"][1]} projects')
r2 = run_cypher('MATCH (d:DirectoryCategory) OPTIONAL MATCH (p:Project)-[:IN_DIRECTORY]->(d) RETURN d.name, d.description, count(p)')
print('DIRECTORIES:')
for row in r2['data'][0]['data']:
    print(f'  {row[\"row\"][0]} ({row[\"row\"][2]} projects): {row[\"row\"][1]}')
r3 = run_cypher('MATCH (p:Project) RETURN p.name, p.uniqueId ORDER BY p.name')
print('PROJECTS:')
for row in r3['data'][0]['data']:
    print(f'  {row[\"row\"][0]} (uid: {row[\"row\"][1]})')
"
```

### 4. Platform Notes

- **Windows cp1252 terminal:** Do NOT use Unicode arrows (→, ↔), box-drawing (─, │), or other non-ASCII in Python print statements. Use ASCII equivalents.
- **Python:** Use system Python. The `.venv` in `nlp/` may not work on all machines. If `python nlp/preprocess.py` fails with import errors, try `nlp/.venv/Scripts/python.exe nlp/preprocess.py` (Windows) or `nlp/.venv/bin/python nlp/preprocess.py` (Mac/Linux).
- **Embeddings take 60-90 seconds** per project (BERT model load time). This is normal.

---

## PLACEMENT DECISIONS (How to Choose Directory, Project Name, Collection)

This is the most important decision in the pipeline. Get it wrong and the graph becomes incoherent.

### Directory Selection

| Directory | Use When | Examples |
|-----------|----------|---------|
| **Research** | Investigations, academic studies, system analyses, historical deep-dives, journalism | "The Opium Equation", "Bretton Woods", "Water Privatization" |
| **Business** | Business processes, strategy, operations, market analysis | Company case studies, industry reports, operational playbooks |
| **Personal** | Personal notes, learning materials, journal entries | Study notes, reading summaries, personal research |

**Default to Research** for GatorSquare Studio investigations. They are always research.

### Project Naming

- **Format:** `kebab-case-slug` (lowercase, hyphens, no special characters)
- **Derive from:** The subject/topic of the document, NOT the filename
- **Convention:** Descriptive semantic slug, 2-5 words
- **`unique_id` = `project_name`** (always identical)

**Examples from existing projects:**
| Document Title | project_name |
|---------------|-------------|
| "The Petrodollar System" | `petrodollar-system` |
| "Central Banks: The Invisible Hand" | `central-banks-the-invisible-hand` |
| "The Green Revolution Trap" | `green-revolution-trap` |
| "The IMF: Lender of Last Resort" | `imf-the-lender-of-last-resort` |

### Collection Assignment (MANDATORY)

Every project MUST belong to a collection. Collections group related projects for graph analysis.

**Decision process:**
1. Read the document's subject matter and tags
2. Check existing collections (Step 3 above)
3. Ask: "Does this document investigate the same SYSTEM or DOMAIN as an existing collection?"
   - **YES → use existing collection**, set `collection_is_new: false`
   - **NO → create new collection**, set `collection_is_new: true`
4. **Collection scope:** A collection represents a research DOMAIN or SYSTEM, not a single topic
   - Good: "Global Finance Systems" (covers petrodollar, IMF, central banks, water privatization)
   - Good: "Geopolitical Intelligence" (covers military, alliances, conflicts)
   - Bad: "Petrodollar" (too narrow — one project per collection defeats the purpose)

**When in doubt:** If the new project shares 3+ entities with an existing collection's projects, it belongs in that collection.

### Confirming With User

After determining placement, present your suggestion to the user:

```
Suggested placement:
  Directory:  Research
  Project:    opium-finance-system
  Unique ID:  opium-finance-system
  Collection: Global Finance Systems (existing, 6 projects)

Confirm or modify?
```

**Wait for user confirmation before proceeding.** The user may override any field.

---

## THE PIPELINE (6 Steps)

### Overview

```
STEP 01  →  STEP 02  →  STEP 03  →  STEP 04  →  STEP 05  →  VALIDATE  →  STEP 06
HTML+Place   NLP        Entities    Extraction   Embeddings    Gate        Upload+GDS
(you+user)   (auto)     (you)       (you)        (auto)        (auto)      (auto)
```

All artifacts go in `data/temp/<project-name>/` during execution.
Move to `data/extracted/<project-name>/` only after full success.

### STEP 01: HTML + PLACEMENT

**Create:** `data/temp/<project-name>/01_html.html` + `02_placement.json`

1. Read the raw source text completely
2. Read `skills/html-template-skill.md` for the HTML template
3. Convert to styled HTML using the template — dark theme, voice blocks (NARRATOR/GATORSQUARE), proper sections, embedded CSS. Preserve ALL content, ALL depth, no summarizing.
4. Determine placement (see section above), confirm with user
5. Write `02_placement.json`:

```json
{
  "directory": "Research",
  "project_name": "kebab-case-name",
  "unique_id": "kebab-case-name",
  "collection": "Collection Name",
  "collection_is_new": false
}
```

**TRAPS:**
- Field is `collection` — NOT `collection_name`
- Field is `project_name` — NOT `name` or `projectName`
- `unique_id` MUST equal `project_name`
- `collection_is_new` is boolean (`true`/`false`), NOT string (`"true"`)

---

### STEP 02: NLP PREPROCESSING

**Create:** `data/temp/<project-name>/03_nlp_entities.json`

The NLP script reads from stdin. You must pipe JSON to it:

```bash
# Create the temp directory first
mkdir -p data/temp/<project-name>

# Write the source text to a temp file, then pipe to preprocess
python -c "
import json, sys
text = open('<source-text-path>').read()
json.dump({'text': text, 'title': '<project display title>'}, sys.stdout)
" | python nlp/preprocess.py > data/temp/<project-name>/03_nlp_entities.json 2> data/temp/<project-name>/02_nlp_stderr.log
```

**Alternative (if source text is already in a variable/file):**
You can construct the JSON input manually and pipe it. The key requirement is:
- stdin must be `{"text": "<full source text>", "title": "<project title>"}`
- stdout is the NLP results (redirect to `03_nlp_entities.json`)
- stderr may contain warnings (redirect to `02_nlp_stderr.log`)

**Check the output:**
- Must have `entity_candidates` array (NOT `entities`)
- Array should be non-empty
- Check stderr log for fatal errors (warnings are OK)

**If NLP fails:** WARN and continue. You (Claude) will handle entity discovery alone in Step 03.

---

### STEP 03: ENTITY DISCOVERY

**Create:** `data/temp/<project-name>/04_all_entities.json`

**Read:** `skills/extraction-skill.md` for quality bar (BAD/GOOD examples).

1. Read the NLP output (`03_nlp_entities.json`)
2. Count total NLP candidates
3. Filter noise: percentages, money amounts, adjectives, fragments → record count
4. Count real NLP entities (total - noise). **ALL go into final list.**
5. For each real NLP entity: write definition (100+ chars) + role (stance + mechanics + reasoning)
6. Add entities NLP missed: concepts, systems, processes (NLP is weak here)
7. Final count MUST exceed NLP real count

**Skeleton — `04_all_entities.json`:**
```json
{
  "temporal_phases": [
    { "index": 1, "label": "Phase Label", "period": "1839-1842" }
  ],
  "entities": [
    {
      "name": "Entity Name",
      "aliases": ["Alias 1", "Alias 2"],
      "category": "Organization",
      "definition": "100+ chars: system mechanics, what IS this entity...",
      "role": "Stance + mechanics + reasoning: what role, why, how...",
      "first_appearance_index": 1
    }
  ]
}
```

**14 valid categories:** Person, Organization, Place, Event, Concept, System, Process, Technology, Law, Agreement, Metric, Document, Resource, Other

**Quality bar (non-negotiable):**
- Definition: 100+ chars, system mechanics — what IS this entity
- Role: stance + mechanics + reasoning — a researcher understands WITHOUT reading source
- Aliases: 1-3 per entity — CRITICAL for cross-project merge
- Every entity needs `first_appearance_index` mapping to a temporal phase

---

### STEP 04: FULL EXTRACTION

**Create:** `data/temp/<project-name>/06_extraction.json`

**Skeleton — `06_extraction.json`:**
```json
{
  "project": {
    "name": "Human-Readable Display Title",
    "unique_id": "kebab-case-slug",
    "summary": "200+ words describing the system mechanics...",
    "narrative_flow": [
      "Key moment 1 as a string",
      "Key moment 2 as a string",
      "Key moment 3 as a string",
      "Key moment 4 as a string"
    ],
    "tags": {
      "domain": "Economics",
      "subdomain": "International Finance",
      "base_tags": ["tag1", "tag2", "tag3"]
    }
  },
  "relationships": [
    {
      "source": "Entity A",
      "target": "Entity B",
      "relType": "SPECIFIC_VERB",
      "causalClassification": "ENABLES",
      "description": "80+ chars: HOW this relationship works mechanically...",
      "evidence": "Exact quote from source text",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "1974"
    }
  ],
  "causal_chains": [
    {
      "name": "Chain Name",
      "description": "What this chain traces",
      "links": [
        {
          "source": "Entity A",
          "target": "Entity B",
          "explanation": "HOW and WHY, system mechanics"
        }
      ]
    }
  ]
}
```

**CRITICAL TRAPS (every one has caused a real failure):**

| Wrong | Right | What Breaks |
|-------|-------|-------------|
| No `project` wrapper | `"project": { ... }` | KeyError in upload.py |
| `narrative_flow` as objects | Array of STRINGS | Neo4j string[] property fails |
| `source_entity` / `target_entity` | `source` / `target` | KeyError in upload.py |
| `period` in relationship | `year` | Wrong field stored |
| Tags at top level | Tags inside `project` | Schema mismatch |
| Entity name != Step 03 name | Exact match required | Relationship skipped SILENTLY |

**For ongoing/structural relationships without a specific year:** use `"year": "ongoing"`

**Minimums:** 200+ word summary, 4+ narrative_flow entries, 3+ base_tags, 15+ relationships, 2+ causal chains (each 3+ links)

**Valid causalClassification (15):** CAUSES, ENABLES, BLOCKS, INFLUENCES, DEPENDS_ON, CONTRADICTS, SUPPORTS, PRECEDES, COMPETES_WITH, COOPERATES_WITH, REGULATES, TRANSFORMS, PRODUCES, CONSUMES, IMPLEMENTS

**Valid evidenceStrength:** established, claimed, disputed, speculative

**Valid magnitude:** foundational, significant, marginal

---

### STEP 05: EMBEDDINGS

**Create:** `data/temp/<project-name>/05_embeddings.json`

Build the embed input by reading `04_all_entities.json` and `06_extraction.json`, then pipe to `embed.py`:

```bash
python -c "
import json, sys

entities = json.load(open('data/temp/<project-name>/04_all_entities.json'))
extraction = json.load(open('data/temp/<project-name>/06_extraction.json'))

texts = []
names = []

# Entity embeddings: definition + role concatenated
for e in entities['entities']:
    texts.append(e['definition'] + ' ' + e['role'])
    names.append(e['name'])

# Project embedding (LAST): summary
texts.append(extraction['project']['summary'])
names.append(extraction['project']['unique_id'])

json.dump({'texts': texts, 'names': names}, sys.stdout)
" | python nlp/embed.py > data/temp/<project-name>/05_embeddings.json 2> data/temp/<project-name>/05_embed_stderr.log
```

**What this does:**
- For each entity: concatenates `definition + " " + role` as the text to embed
- Last entry: project summary, named by `unique_id`
- Pipes to `embed.py` which returns 384d BERT vectors

**Verify output:**
- Must have `"embeddings"` array (NOT `"entity_embeddings"` / `"project_embedding"`)
- Each embedding: `{"name": "...", "embedding": [384 floats], "dimensions": 384}`
- Count = entity count + 1 (the project)
- Last embedding name = project `unique_id`

**If embeddings fail:** WARN and continue. The graph works without embeddings, but similarity search won't.

---

### STEP 05.5: VALIDATION GATE (MANDATORY)

**Do NOT skip this. Do NOT proceed to upload without passing.**

```bash
python neo4j/validate_project.py --human data/temp/<project-name>
```

- **PASS (exit code 0):** Proceed to Step 06
- **ERRORS:** Fix the specific issues reported, re-run validation. Maximum 2 fix-and-revalidate cycles.
- **After 2 failed retries:** Stop and report to user.

The validator checks 30+ rules: file presence, field names, types, entity name consistency across files, embedding counts, definition lengths, etc.

---

### STEP 06: UPLOAD + STORE + GDS

**This step does 3 things: upload to Neo4j, move to permanent storage, recompute GDS.**

#### 6A. Upload to Neo4j

```bash
python neo4j/upload.py data/temp/<project-name>
```

**Run in FOREGROUND.** Do NOT background this.

#### 6B. Verify Upload

```bash
python -c "
import sys; sys.path.insert(0,'neo4j')
from db import run_cypher

uid = '<project-unique-id>'

# Project exists
r = run_cypher('MATCH (p:Project {uniqueId: \$uid}) RETURN p.name, p.uniqueId', {'uid': uid})
print('Project:', r['data'][0]['data'][0]['row'] if r['data'][0]['data'] else 'NOT FOUND')

# Entity count
r = run_cypher('MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project {uniqueId: \$uid}) RETURN count(e)', {'uid': uid})
print('Entities:', r['data'][0]['data'][0]['row'][0])

# Relationship count
r = run_cypher('MATCH (e1)-[r:RELATES_TO]->(e2) WHERE r.projectId = \$uid RETURN count(r)', {'uid': uid})
print('Relationships:', r['data'][0]['data'][0]['row'][0])

# Bridge entities (appear in 2+ projects)
r = run_cypher('MATCH (e:Entity) WHERE e.projectCount > 1 RETURN e.name, e.projectCount ORDER BY e.projectCount DESC LIMIT 10')
print('Top bridges:', [(row['row'][0], row['row'][1]) for row in r['data'][0]['data']])
"
```

#### 6C. Permanent Storage

```bash
# Create permanent directories
mkdir -p data/extracted/<project-name>
mkdir -p data/sources/$(date +%Y-%m-%d)/<project-name>
mkdir -p data/projects/<project-name>

# Copy artifacts
cp data/temp/<project-name>/01_html.html data/extracted/<project-name>/
cp data/temp/<project-name>/02_placement.json data/extracted/<project-name>/
cp data/temp/<project-name>/03_nlp_entities.json data/extracted/<project-name>/
cp data/temp/<project-name>/04_all_entities.json data/extracted/<project-name>/
cp data/temp/<project-name>/05_embeddings.json data/extracted/<project-name>/
cp data/temp/<project-name>/06_extraction.json data/extracted/<project-name>/

# Copy HTML to sources (matches Neo4j htmlPath)
cp data/temp/<project-name>/01_html.html data/sources/$(date +%Y-%m-%d)/<project-name>/01_html.html

# Copy original source
cp <original-script-path> data/projects/<project-name>/script.md

# Copy stderr logs
cp data/temp/<project-name>/*stderr* data/extracted/<project-name>/ 2>/dev/null
```

#### 6D. GDS Recompute

```bash
python neo4j/gds.py
```

This recomputes PageRank, Betweenness, Degree, and Node Similarity across ALL entities (not just the new project). Takes ~5 seconds at current scale.

---

## POST-PIPELINE VERIFICATION

After everything completes, run this comprehensive check:

```bash
python -c "
import sys; sys.path.insert(0,'neo4j')
from db import run_cypher

print('=== DATABASE STATE ===')
r = run_cypher('MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY count DESC')
for row in r['data'][0]['data']:
    print(f'  {row[\"row\"][0]}: {row[\"row\"][1]}')

print('\n=== COLLECTIONS ===')
r = run_cypher('MATCH (c:Collection) OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c) RETURN c.name, count(p)')
for row in r['data'][0]['data']:
    print(f'  {row[\"row\"][0]}: {row[\"row\"][1]} projects')

print('\n=== GDS STATUS ===')
r = run_cypher('MATCH (e:Entity) WHERE e.pageRank IS NOT NULL RETURN count(e)')
print(f'  Entities with PageRank: {r[\"data\"][0][\"data\"][0][\"row\"][0]}')
r = run_cypher('MATCH ()-[r:SIMILAR_TO]->() RETURN count(r)')
print(f'  SIMILAR_TO relationships: {r[\"data\"][0][\"data\"][0][\"row\"][0]}')
"
```

---

## REFERENCE: Complete Artifact Map

After a successful extraction, a project produces these artifacts:

| File | Step | Contents |
|------|------|---------|
| `01_html.html` | 01 | Semantic HTML of full source text |
| `02_placement.json` | 01 | Directory, project name, collection assignment |
| `03_nlp_entities.json` | 02 | NLP entity candidates, keywords, co-occurrences |
| `04_all_entities.json` | 03 | Final entity list with definitions, roles, phases |
| `05_embeddings.json` | 05 | 384d BERT vectors for all entities + project |
| `06_extraction.json` | 04 | Project metadata, relationships, causal chains |
| `02_nlp_stderr.log` | 02 | Python stderr from NLP preprocessing |
| `05_embed_stderr.log` | 05 | Python stderr from embedding generation |

**Storage locations after completion:**
```
data/extracted/<project>/          <- All 6 JSON/HTML artifacts + stderr logs
data/sources/YYYY-MM-DD/<project>/ <- HTML (matches Neo4j htmlPath)
data/projects/<project>/           <- Original source script.md
```

---

## REFERENCE: Quality Checklist (Quick Version)

Before marking extraction complete, verify:

- [ ] Every entity definition is 100+ chars with system mechanics
- [ ] Every entity role has stance + mechanics + reasoning
- [ ] Every entity has 1-3 aliases (for cross-project merge)
- [ ] Every relationship description is 80+ chars explaining HOW
- [ ] Every relationship has an exact-quote evidence field
- [ ] Every source/target name matches Step 03 entity names EXACTLY
- [ ] Summary is 200+ words
- [ ] At least 15 relationships, 2 causal chains (3+ links each)
- [ ] `validate_project.py` passes
- [ ] Upload succeeds, entity/relationship counts match
- [ ] GDS recompute runs without errors

---

## OPTIONAL: Export Collection

After extraction and upload, you can export the entire collection as a portable package:

```bash
python neo4j/export_collection.py "Collection Name"           # Full ZIP export
python neo4j/export_collection.py "Collection Name" --json-only  # graph.json only
python neo4j/export_collection.py --list                       # List all collections
```

The export produces a self-contained ZIP with:
- `graph.json` — Complete knowledge graph (agent-readable, no database needed)
- `embeddings.json` — Raw 384d BERT vectors
- `projects/<slug>/source.html` — Full styled source documents
- `projects/<slug>/extraction.json` — Raw extraction artifacts
- `README.md` + `manifest.json` — Metadata and checksums

An agent can load `graph.json` and reason over the entire collection without Neo4j.
