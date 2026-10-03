# Export & Import Guide

**How collections are packaged into portable ZIP files and imported into other MemoryTonic instances.**

---

## Export: Collection → ZIP

### Script: `export_collection.py`

**Tool:** `memorytonic_export`
**Input:** Collection name
**Output:** ZIP file at `apps/exports/{collection-name}.zip`

### What Gets Exported

The script runs 8 Neo4j queries to gather everything in the collection:

| Query | What It Fetches |
|-------|----------------|
| 1 | All projects in the collection (name, domain, subdomain, summary, baseTags, narrativeFlow, htmlPath, createdAt) |
| 2 | All entities mentioned in those projects (name, category, definition, role, aliases, pageRank, betweenness, degree) |
| 3 | All RELATES_TO edges between those entities (relType, causalClassification, description, evidence, evidenceStrength, magnitude, year) |
| 4 | All causal chains for those projects (name, description + links with sourceName, target, explanation, order) |
| 5 | All temporal events for those projects (label, period, phaseIndex) |
| 6 | SIMILAR_TO edges between exported entities (entity1, entity2, similarity) |
| 7 | Entity embeddings (384d vectors) |
| 8 | Project embeddings (384d vectors) |

**Causal chain enrichment:** Chain link data from extraction JSON files on disk (data/extracted/<slug>/06_extraction.json) is merged with Neo4j chain data to produce complete chain links.

### Bridge Computation

`compute_bridges()` runs during export:
- Gold: projectCount >= 3
- Silver: projectCount = 2
- Bronze: projectCount = 1 AND betweenness > 1000

Bridge tiers are stored in `graph.json` so the receiving instance knows which entities were bridges in the original collection.

### ZIP Structure

```
{collection-name}.zip
├── manifest.json          ← Format version, export date, source instance, entity/project counts
├── graph.json             ← All entities, relationships, chains, temporal events, bridge tiers
├── embeddings.json        ← Entity + project 384d vectors
├── README.md              ← Human-readable collection description + stats
└── projects/
    └── {slug}/
        ├── source.html    ← Original HTML (from data/sources/)
        └── extraction.json ← Full extraction artifact (from data/extracted/)
```

### Field Lists Are HARDCODED

**TRAP:** `export_collection.py` has hardcoded field lists in all 8 queries. If new fields are added to the schema (e.g., Discussion 10 additions: tags, thesis, keyQuestion), the export script MUST be explicitly updated. It does NOT dynamically discover fields.

---

## Import: ZIP → Neo4j

### Script: `import_collection.py`

**Tool:** `memorytonic_import`
**Input:** Path to ZIP file

### 6-Phase Pipeline

#### Phase 1: Preflight

Verify the ZIP structure:
- manifest.json present and valid
- graph.json present and parseable
- embeddings.json present
- Project directories have source.html + extraction.json

**Fail here = bad ZIP, abort immediately.**

#### Phase 2: Conflict Detection

Check for conflicts with existing data:
- **Collection name conflict:** Does a collection with this name already exist?
- **Project slug conflict:** Do any projects with these slugs already exist?
- **Entity overlap:** Do entities with matching names already exist? (This is expected — entity merge is by design)

**Resolution:**
- Collection conflict → ask user: merge into existing or rename?
- Project conflict → abort (can't have duplicate project slugs)
- Entity overlap → normal merge behavior (projectCount incremented)

#### Phase 3: Reconstruct Artifacts

Transform `graph.json` back into per-project extraction artifacts:

For each project in the graph:
1. Extract project-specific entities from graph.json
2. Extract project-specific relationships
3. Extract project-specific chains
4. Extract project-specific temporal events
5. Resolve aliases (graph.json stores merged entities — reconstruct per-project views)
6. Create stub entity files (04_all_entities.json format)
7. Create extraction files (06_extraction.json format)
8. Create placement files (02_placement.json format)
9. Copy embeddings into per-project format (05_embeddings.json)

**This is the most complex phase.** The import essentially reverses the export, splitting a unified graph back into individual project artifacts.

#### Phase 4: Validate + Upload

For each reconstructed project:
1. Run `validate_project.py --import-mode` (relaxed validation for imports)
2. If validation passes → run `upload.py`
3. If validation fails → report errors, skip this project, continue with others

**Import mode validation** is slightly relaxed:
- Doesn't check for HTML file presence (may be in different path)
- Accepts embeddings from external source without re-computing

#### Phase 5: GDS Recompute

After all projects are uploaded:
- Run `gds.py` to recompute PageRank, betweenness, degree, similarity
- This updates metrics for ALL entities, not just imported ones

#### Phase 6: Verification

Verify the import succeeded:
- Collection exists in Neo4j
- All projects queryable
- Entity counts match expected
- Relationship counts match expected

---

## Key Design Decisions

### Entity Merge on Import

Imported entities go through the SAME merge logic as fresh extractions:
```
WHERE e.name = $name OR $name IN e.aliases OR ANY(alias IN $aliases WHERE ...)
```

This means:
- Importing a collection that mentions "Federal Reserve" will MERGE with an existing "Federal Reserve" entity
- The entity's projectCount increases
- The entity may gain new aliases from the import
- Bridge tiers may change (Silver → Gold if now 3+ projects)

### Per-Project Artifacts

The import doesn't just insert graph.json directly into Neo4j. It reconstructs individual project artifacts and feeds them through the normal upload pipeline. This ensures:
- Same validation rules apply
- Same merge logic applies
- Same entity dedup applies
- GDS runs on the full graph

### What's NOT Imported

- GDS metrics from the source instance (recomputed locally)
- SIMILAR_TO edges from the source (recomputed locally)
- Collection descriptions (may be updated by user)

---

## Export/Import for the Research Agent

The Research Agent can use export/import for:
- **Sharing findings:** Export a collection → share the ZIP → recipient imports and explores
- **Backup:** Export before destructive operations
- **Migration:** Export from one Neo4j instance → import to another

---

## Trap Summary

| Trap | Impact | Mitigation |
|------|--------|------------|
| Hardcoded field lists in export | New schema fields won't be exported | Must update export_collection.py when schema changes |
| Hardcoded field lists in import | New schema fields won't be imported | Must update import_collection.py when schema changes |
| Case-sensitive merge | "IMF" and "imf" won't merge | Aliases must match exact case |
| Project slug uniqueness | Can't import if slug exists | Check conflicts in Phase 2 |
| GDS recompute on full graph | May be slow on large graphs | RAM guards in gds.py |
| Missing HTML files | Import path may differ from export path | Import mode relaxes HTML check |
