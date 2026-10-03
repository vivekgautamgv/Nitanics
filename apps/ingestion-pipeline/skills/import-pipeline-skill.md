# Collection Import Pipeline — Zero-Context Agent Guide

**Purpose:** Complete, self-contained guide for importing a MemoryTonic collection export (ZIP) into a Neo4j instance. A fresh agent with ZERO prior context can follow this document and successfully import a collection.

**Working directory:** ALL commands assume cwd is `components/01-ingestion/`. If you are anywhere else, `cd` there first.

---

## WHEN TO USE THIS

A user gives you a `.zip` file and says something like:
- "Import this collection"
- "Load this knowledge graph into my database"
- "Add this export to my MemoryTonic"

The ZIP was produced by `export_collection.py` and contains a portable knowledge graph with all source documents, entities, relationships, causal chains, and embeddings.

---

## BEFORE YOU START

### 1. Verify Neo4j Is Running

```bash
python -c "import sys; sys.path.insert(0,'neo4j'); from db import check_connection; check_connection()"
```

If this fails: Neo4j is not running. Open Neo4j Desktop -> Start the DBMS.

### 2. Verify Schema Exists

```bash
python neo4j/bootstrap.py --status
```

Expected: 7 constraints, 8+ indexes, 3 directories. If not: run `python neo4j/bootstrap.py`.

### 3. Check What Already Exists

```bash
python -c "
import sys; sys.path.insert(0,'neo4j')
from db import run_cypher
r = run_cypher('MATCH (c:Collection) OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c) RETURN c.name, count(p) ORDER BY count(p) DESC')
print('COLLECTIONS:')
for row in r['data'][0]['data']:
    print(f'  {row[\"row\"][0]}: {row[\"row\"][1]} projects')
r2 = run_cypher('MATCH (d:DirectoryCategory) RETURN d.name')
print('DIRECTORIES:')
for row in r2['data'][0]['data']:
    print(f'  {row[\"row\"][0]}')
"
```

**Know the directories.** You need to pick one (or use the default "Research").

---

## STEP 1: DRY RUN (MANDATORY FIRST STEP)

**Never import without a dry run first.** This validates all 7 projects without touching the database.

```bash
python neo4j/import_collection.py "<path-to-zip>" --dry-run --directory <directory-name>
```

**What to look for:**
- All projects should show `[OK] Validation passed`
- Check the conflict report: does the collection already exist? Do some projects already exist?
- Review entity counts per project — they should be reasonable (15-80 per project)

**If validation fails:**
- `EXTRACT_ENTITY_MATCH` errors mean the extraction references entities not in the entity list. This is handled automatically by the import tool (cross-project entity resolution + stub creation). If it still fails, the extraction.json has a data integrity issue.
- `ENTITY_DEF_LENGTH` errors on stub entities are expected and handled.
- Other errors: read the error message, check the ZIP contents manually.

---

## STEP 2: IMPORT

### Option A: Fresh Import (No Conflicts)

```bash
python neo4j/import_collection.py "<path-to-zip>" --directory Research
```

### Option B: Partial Import (Some Projects Already Exist)

The tool automatically detects existing projects and imports only the new ones:

```bash
python neo4j/import_collection.py "<path-to-zip>" --directory Research
```

It will report: "Importing N new projects (skipping duplicates)"

### Option C: Override Collection Name

```bash
python neo4j/import_collection.py "<path-to-zip>" --directory Research --collection "My Custom Collection"
```

### Option D: Force (Skip All Conflict Prompts)

```bash
python neo4j/import_collection.py "<path-to-zip>" --directory Research --force
```

---

## STEP 3: VERIFY

After import, the tool automatically runs verification (Phase 6). But you should also check manually:

```bash
python -c "
import sys; sys.path.insert(0,'neo4j')
from db import run_cypher

# Overall counts
r = run_cypher('MATCH (n) RETURN labels(n)[0] AS label, count(n) AS cnt ORDER BY cnt DESC')
print('Database:')
for row in r['data'][0]['data']:
    print(f'  {row[\"row\"][0]}: {row[\"row\"][1]}')

# Bridge entities
r = run_cypher('''
MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project)
WITH e, count(DISTINCT p) AS pc WHERE pc >= 2
RETURN e.name, e.category, pc ORDER BY pc DESC LIMIT 10
''')
print('Bridges:')
for row in r['data'][0]['data']:
    print(f'  {row[\"row\"][0]} ({row[\"row\"][1]}) - {row[\"row\"][2]} projects')

# GDS metrics present
r = run_cypher('MATCH (e:Entity) WHERE e.pageRank IS NOT NULL RETURN count(e)')
print(f'Entities with PageRank: {r[\"data\"][0][\"data\"][0][\"row\"][0]}')
r = run_cypher('MATCH ()-[r:SIMILAR_TO]->() RETURN count(r)')
print(f'SIMILAR_TO relationships: {r[\"data\"][0][\"data\"][0][\"row\"][0]}')
"
```

**Expected after a successful import:**
- Entity count matches the export's stats
- Bridge entities span multiple projects
- PageRank and SIMILAR_TO are populated (GDS ran)

---

## HOW IT WORKS (6 Phases)

The import pipeline runs automatically in sequence:

### Phase 1: Pre-flight
- Verifies Neo4j connection and schema
- Extracts ZIP to temp directory
- Reads manifest.json (format + schema version check)
- Reads graph.json (the flat knowledge graph)
- Reads embeddings.json (384d BERT vectors)

### Phase 2: Conflict Detection
- Checks for existing collection by name
- Checks for existing projects by name (skips duplicates)
- Reports entity overlap (entities already in graph become bridges)
- Lists available directories

### Phase 3: Artifact Reconstruction
For each project, builds upload-ready artifact folders from the flat graph.json:

| Artifact | Source | Notes |
|----------|--------|-------|
| `01_html.html` | ZIP `projects/<slug>/source.html` | Full styled source document |
| `02_placement.json` | Generated | Directory + collection assignment |
| `04_all_entities.json` | Filtered from graph.json | Includes cross-project entities referenced in relationships |
| `05_embeddings.json` | Filtered from embeddings.json | Zero-vector placeholders for stub entities |
| `06_extraction.json` | ZIP `projects/<slug>/extraction.json` | Or reconstructed from graph.json |

**Key: `03_nlp_entities.json` is NOT created** — NLP output isn't available in exports. The validator runs in `--import-mode` which skips this check.

**Cross-project entity resolution:** Some extraction.json files reference entities from other projects (bridge entities). The tool scans relationships and causal chains, pulls missing entities from graph.json, tries alias resolution, and creates stub entities as last resort.

### Phase 4: Validate + Upload
- Runs `validate_project.py --import-mode` on each project
- On pass: runs `upload.py` to insert into Neo4j
- Moves artifacts to permanent storage (`data/extracted/`, `data/sources/`)

### Phase 5: GDS Recompute
- Runs `gds.py` to recompute PageRank, Betweenness, Similarity
- Pre-computed metrics from the export are DISCARDED — metrics depend on the full graph

### Phase 6: Verify
- Compares expected vs actual project counts
- Reports database state (node counts by label)
- Lists top bridge entities

---

## FLAGS REFERENCE

| Flag | Purpose | Example |
|------|---------|---------|
| `--dry-run` | Validate only, no upload | `--dry-run` |
| `--directory <name>` | Target directory | `--directory Research` |
| `--collection <name>` | Override collection name | `--collection "My Studies"` |
| `--force` | Skip conflict prompts | `--force` |

---

## TROUBLESHOOTING

### "All projects already exist"
The collection is already fully imported. Delete individual projects with `delete_project.py` if you want to reimport.

### Validation errors on specific projects
Run the dry-run and check which projects fail. Common causes:
- **Entity name mismatch:** extraction.json references an entity that was merged/aliased during original upload
- **Missing HTML:** source.html not found in ZIP for that project slug
- **Schema version:** older exports may have different field names

### GDS fails
GDS requires sufficient RAM. If it fails:
```bash
python neo4j/gds.py
```
Check for memory-related errors. Reduce RAM allocation or run PageRank/Betweenness separately.

### Upload fails mid-way
The import is NOT atomic per-collection — it uploads project by project. If it fails:
1. Check which projects succeeded (look at the output)
2. Delete the failed project: `python neo4j/delete_project.py <slug>`
3. Re-run the import (it will skip already-imported projects)

---

## EXPORT + IMPORT ROUND-TRIP

The export/import cycle is tested and verified:
```
Export collection -> ZIP (graph.json + HTMLs + embeddings)
Delete project(s) from Neo4j
Import from ZIP -> reconstructs artifacts -> uploads -> GDS
Verify: all entities, relationships, chains, temporal events restored
```

Bridges, PageRank, and SIMILAR_TO are recomputed from the new graph state — they may differ slightly from the export if the graph has changed.
