# Extraction Checklist — water-privatization-system

**Started:** 2026-04-05T10:30:00
**Source:** gatorsquare-studio-public-combined/projects/water-privatization-system/script.md

---

## STEP 01: HTML + PLACEMENT

**Status:** ⬜ PENDING
**Time:** ___ seconds

### Artifacts
- [ ] `01_html.html` — ___ bytes, ___ sections
- [ ] `02_placement.json`

### 02_placement.json — FILL THIS SKELETON
```json
{
  "directory": "___",
  "project_name": "___",
  "unique_id": "___",
  "collection": "___",
  "collection_is_new": ___
}
```

### Gate 01
- [ ] HTML renders cleanly (check: headings, paragraphs, emphasis)
- [ ] `02_placement.json` has ALL 5 fields: `directory`, `project_name`, `unique_id`, `collection`, `collection_is_new`
- [ ] Field is `collection` — NOT `collection_name`
- [ ] Field is `project_name` — NOT `name` or `projectName`
- [ ] `unique_id` matches `project_name`
- [ ] `collection_is_new` is boolean, not string
- [ ] Collection assignment confirmed

**Gate 01 Result:** ⬜ PASS / FAIL

---

## STEP 02: NLP PREPROCESSING

**Status:** ⬜ PENDING
**Time:** ___ seconds

### Artifacts
- [ ] `03_nlp_entities.json`

### Run
```bash
python nlp/preprocess.py "<source-text-path>"
```

### Stats
- NLP entity_candidates count: ___
- Keywords extracted: ___ sections
- Co-occurrence pairs: ___
- BERT dedup groups: ___
- Python stderr errors: ___

### Gate 02
- [ ] Output JSON has key `entity_candidates` (NOT `entities`)
- [ ] `entity_candidates` array is non-empty
- [ ] No fatal Python errors in stderr (warnings OK)
- [ ] Keywords extracted (check `sections` array)

**Gate 02 Result:** ⬜ PASS / FAIL

---

## STEP 03: ENTITY DISCOVERY

**Status:** ⬜ PENDING
**Time:** ___ seconds

### NLP RECONCILIATION (MANDATORY)

Before writing `04_all_entities.json`, audit ALL NLP candidates:

| Category | Count | Action |
|----------|-------|--------|
| Total NLP candidates | ___ | |
| Noise (%, $, adjectives, fragments) | ___ | DROP — document count |
| Real entities in NLP | ___ | MUST review each one |
| Matched to final entities | ___ | OK — consolidated |
| Dropped (real but excluded) | ___ | JUSTIFY each drop |
| LLM-added (not in NLP) | ___ | OK — concepts, systems, processes NLP misses |

**Entity floor: max(10, NLP_real_entities × 0.8)**
If final count < floor, you are losing entities. Go back and add them.

### Artifacts
- [ ] `04_all_entities.json`

### 04_all_entities.json — FILL THIS SKELETON
```json
{
  "temporal_phases": [
    { "index": 1, "label": "___", "period": "___" }
  ],
  "entities": [
    {
      "name": "___",
      "aliases": ["___"],
      "category": "___",
      "definition": "100+ chars: ___",
      "role": "stance + mechanics + reasoning: ___",
      "first_appearance_index": ___
    }
  ]
}
```

### Stats
- Temporal phases: ___
- Total entities: ___
- By category: Person=___ Organization=___ Place=___ Event=___ Concept=___ System=___ Process=___ Other=___
- Shortest definition: ___ chars (must be 100+)
- Entities with empty aliases: ___ (should be 0)

### Gate 03
- [ ] Entity count >= floor (max(10, NLP_real × 0.8))
- [ ] Every entity has: `name`, `aliases` (array), `category`, `definition`, `role`, `first_appearance_index`
- [ ] Every `definition` is 100+ characters
- [ ] Every `role` includes stance + mechanics + reasoning
- [ ] Every `category` is one of 14 valid categories
- [ ] Every `first_appearance_index` maps to an existing temporal phase
- [ ] No duplicate entity names
- [ ] Aliases checked for overlap with other entity names
- [ ] `temporal_phases` has at least 2 phases
- [ ] Each phase has `index` (integer), `label` (string), `period` (string)
- [ ] NLP reconciliation table filled (above)
- [ ] Every dropped real NLP entity has justification

### 14 Valid Categories
```
Person, Organization, Place, Event, Concept, System,
Process, Technology, Law, Agreement, Metric, Document,
Resource, Other
```

**Gate 03 Result:** ⬜ PASS / FAIL

---

## STEP 04: FULL EXTRACTION

**Status:** ⬜ PENDING
**Time:** ___ seconds

### Artifacts
- [ ] `06_extraction.json`

### 06_extraction.json — FILL THIS SKELETON

**CRITICAL: `project` wrapper is MANDATORY. upload.py reads `extraction["project"]`.**

```json
{
  "project": {
    "name": "___",
    "unique_id": "___",
    "summary": "200+ words: ___",
    "narrative_flow": [
      "String 1",
      "String 2"
    ],
    "tags": {
      "domain": "___",
      "subdomain": "___",
      "base_tags": ["___", "___", "___"]
    }
  },
  "relationships": [
    {
      "source": "___",
      "target": "___",
      "relType": "SPECIFIC_VERB",
      "causalClassification": "___",
      "description": "80+ chars: ___",
      "evidence": "exact quote: ___",
      "evidenceStrength": "___",
      "magnitude": "___",
      "year": "___"
    }
  ],
  "causal_chains": [
    {
      "name": "___",
      "description": "___",
      "links": [
        {
          "source": "___",
          "target": "___",
          "explanation": "HOW and WHY: ___"
        }
      ]
    }
  ]
}
```

### STRUCTURE TRAPS (every one has caused a real failure)
| Wrong | Right | What breaks |
|-------|-------|-------------|
| No `project` wrapper | `"project": { name, summary, ... }` | `extraction["project"]` KeyError in upload.py |
| `narrative_flow` as objects | `narrative_flow` as strings | Neo4j string[] property fails |
| `source_entity` / `target_entity` | `source` / `target` | KeyError in upload.py |
| `period` in relationship | `year` | Wrong field stored |
| Flat tags at top level | `tags` inside `project` | Schema mismatch |
| Entity name mismatch vs Step 03 | Exact name match required | Relationship skipped silently |

### Stats
- Summary word count: ___ (must be 200+)
- Narrative flow entries: ___ (must be 4+)
- Base tags count: ___ (must be 3+)
- Relationship count: ___ (must be 15+)
- Causal chain count: ___ (must be 2+)
- Avg links per chain: ___
- Shortest description: ___ chars (must be 80+)
- Entity name mismatches vs Step 03: ___ (must be 0)

### Gate 04
**Structure:**
- [ ] Top-level keys are EXACTLY: `project`, `relationships`, `causal_chains`
- [ ] `project` wrapper exists (NOT flat name/summary at top level)
- [ ] `narrative_flow` is array of STRINGS (NOT objects)
- [ ] `tags` is inside `project` (NOT at top level)

**Content:**
- [ ] Summary is 200+ words
- [ ] Narrative flow has 4+ entries
- [ ] Tags: domain + subdomain + 3+ base_tags
- [ ] Relationships: minimum 15
- [ ] Causal chains: minimum 2, each with 3+ links

**Relationship fields:**
- [ ] Every relationship has: `source`, `target`, `relType`, `causalClassification`, `description`, `evidence`, `evidenceStrength`, `magnitude`
- [ ] Uses `source` / `target` — NOT `source_entity` / `target_entity`
- [ ] Uses `year` — NOT `period`
- [ ] `description` is 80+ characters
- [ ] `evidence` is exact quote from source
- [ ] `causalClassification` is one of 15 valid families
- [ ] `evidenceStrength` is one of: established, claimed, disputed, speculative
- [ ] `magnitude` is one of: foundational, significant, marginal
- [ ] ALL source/target names match Step 03 entity names exactly

**Causal chain fields:**
- [ ] Each chain has `name`, `links`
- [ ] Each link has `source`, `target`, `explanation`
- [ ] Links follow temporal order
- [ ] Entity names match Step 03

### 15 Causal Classification Families
```
CAUSES, ENABLES, BLOCKS, INFLUENCES, DEPENDS_ON,
CONTRADICTS, SUPPORTS, PRECEDES, COMPETES_WITH,
COOPERATES_WITH, REGULATES, TRANSFORMS, PRODUCES,
CONSUMES, IMPLEMENTS
```

**Gate 04 Result:** ⬜ PASS / FAIL

---

## STEP 05: EMBEDDINGS

**Status:** ⬜ PENDING
**Time:** ___ seconds

### Artifacts
- [ ] `05_embeddings.json`

### Run
```bash
python nlp/embed.py --entities <04_all_entities.json> --extraction <06_extraction.json>
```

### 05_embeddings.json — EXPECTED FORMAT
```json
{
  "model": "all-MiniLM-L6-v2",
  "dimensions": 384,
  "entity_embeddings": [
    { "name": "Entity Name", "embedding": [0.023, -0.041, ...] }
  ],
  "project_embedding": {
    "name": "project-name",
    "embedding": [0.012, 0.056, ...]
  }
}
```

### Stats
- Entity embeddings count: ___ (must match Step 03 entity count)
- Project embedding: ___ (must be 1)
- Dimensions: ___ (must be 384)
- embed.py reformatting needed: YES/NO

### Gate 05
- [ ] JSON has `entity_embeddings` array and `project_embedding` object
- [ ] Every entity embedding has `name` (string) and `embedding` (384-float array)
- [ ] Entity names match Step 03 exactly
- [ ] Project embedding has `name` and `embedding`
- [ ] All embeddings are 384 dimensions
- [ ] If embed.py format differs: reformatted to expected structure

**Gate 05 Result:** ⬜ PASS / FAIL

---

## STEP 06: STORE + UPLOAD

**Status:** ⬜ PENDING
**Time:** ___ seconds

### Pre-Upload
- [ ] Neo4j running (http://localhost:7474)
- [ ] All 4 upload files exist: `02_placement.json`, `04_all_entities.json`, `05_embeddings.json`, `06_extraction.json`
- [ ] Upload in FOREGROUND (not background)

### Run
```bash
python neo4j/upload.py <temp-project-dir>
```

### Post-Upload Verification
- [ ] Upload script reports no errors
- [ ] Project node exists: `MATCH (p:Project {uniqueId: "___"}) RETURN p`
- [ ] Entity count matches Step 03: ___
- [ ] Relationship count matches Step 04: ___
- [ ] Bridge entities checked: `MATCH (e:Entity) WHERE e.projectCount > 1 RETURN e.name, e.projectCount`

### Permanent Storage
- [ ] Created: `data/extracted/water-privatization-system/`
- [ ] Copied: 01_html.html, 02_placement.json, 03_nlp_entities.json, 04_all_entities.json, 05_embeddings.json, 06_extraction.json
- [ ] Copied: source script.md to `data/projects/water-privatization-system/`
- [ ] Copied: stderr logs (02_nlp_stderr.log, 05_embed_stderr.log)
- [ ] Verified all files in permanent folder
- [ ] Temp folder cleaned (only after verification)

**Gate 06 Result:** ⬜ PASS / FAIL

---

## PIPELINE COMPLETE

| Metric | Value |
|--------|-------|
| Total time | ___ seconds |
| NLP candidates | ___ |
| NLP noise filtered | ___ |
| NLP real entities | ___ |
| Final entities | ___ |
| LLM-added entities | ___ |
| Dropped NLP entities (justified) | ___ |
| Relationships | ___ |
| Causal chains | ___ |
| Bridge entities (new/updated) | ___ |
| Format errors caught | ___ |
| Retries needed | ___ |

**Overall Result:** ⬜ PASS / FAIL
