# Extraction Pipeline Checklist

**This is a REFERENCE document.** The actual checklist is instantiated per-project from `checklist-template.md`.

## How It Works

1. Before starting any extraction, copy `checklist-template.md` to `data/temp/<project>/checklist.md`
2. Fill in project name, timestamp, source path
3. Tick checkboxes and fill stats AS the pipeline runs
4. The completed checklist becomes the audit trail — it stays with the project

## What the Template Tracks

- **Per-step:** artifacts produced, stats (counts, sizes, times), gate pass/fail
- **NLP reconciliation:** noise filtered, real entities, matched/dropped/LLM-added
- **Entity floor:** `max(10, NLP_real_entities * 0.8)` — enforces NLP→entity pipeline integrity
- **Structure validation:** literal JSON skeletons with field-name traps
- **Pipeline summary:** total time, entity counts, format errors caught, retries

## Reference Tables

### 14 Entity Categories (LOCKED)
```
Person, Organization, Place, Event, Concept, System,
Process, Technology, Law, Agreement, Metric, Document,
Resource, Other
```

### 15 Causal Classification Families (LOCKED)
```
CAUSES, ENABLES, BLOCKS, INFLUENCES, DEPENDS_ON,
CONTRADICTS, SUPPORTS, PRECEDES, COMPETES_WITH,
COOPERATES_WITH, REGULATES, TRANSFORMS, PRODUCES,
CONSUMES, IMPLEMENTS
```

### Evidence Strengths
```
established, claimed, disputed, speculative
```

### Magnitude Levels
```
foundational, significant, marginal
```

### Known Field-Name Traps
| Wrong | Right | What breaks |
|-------|-------|-------------|
| `collection_name` | `collection` | Upload fails |
| `name` at top level | `project_name` | Schema mismatch |
| Missing `unique_id` | Same as `project_name` | Upload fails |
| No `project` wrapper | `"project": { ... }` | KeyError in upload.py |
| `narrative_flow` as objects | Array of strings | Neo4j string[] fails |
| `source_entity` / `target_entity` | `source` / `target` | KeyError in upload.py |
| `period` in relationship | `year` | Wrong field stored |
| `from` / `to` in chain links | `source` / `target` | Format inconsistency |
| `entities` in NLP output | `entity_candidates` | Wrong key read |
