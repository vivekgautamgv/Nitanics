# Post-Upload Maintenance

**Purpose:** Checklist of operations to run after every project upload.
**When:** After `upload.py` completes successfully.

---

## Mandatory (run every time)

### 1. GDS Recomputation

```bash
python neo4j/gds.py
```

Computes and writes back to Entity nodes:
- **PageRank** → `entity.pageRank` — importance based on relationship structure
- **Betweenness** → `entity.betweenness` — structural bridge detection
- **Degree** → `entity.degree` — connection count
- **Node Similarity** → `SIMILAR_TO` relationships between structurally similar entities

Takes <1 second at current scale. Must run after EVERY upload because adding a project changes the entire graph structure.

### 2. Bridge Entity Verification

```cypher
MATCH (e:Entity) WHERE e.projectCount > 1
RETURN e.name, e.projectCount ORDER BY e.projectCount DESC
```

Verify that bridge entities were correctly detected. New uploads may create new bridges or increment existing ones.

### 3. Embedding Verification

```cypher
-- Entity embeddings
MATCH (e:Entity) RETURN count(e) AS total,
  sum(CASE WHEN e.embedding IS NOT NULL THEN 1 ELSE 0 END) AS withEmbedding

-- Project embedding
MATCH (p:Project {uniqueId: $uid}) WHERE p.embedding IS NOT NULL RETURN p.name
```

All entities and the project should have 384d embeddings. If any are missing, re-run `nlp/embed.py`.

### 4. HTML Path Verification

```bash
# Verify the file exists at the path Neo4j stores
python -c "
import sys; sys.path.insert(0, 'neo4j')
# ... query Project.htmlPath and check os.path.exists
"
```

The `htmlPath` property on the Project node must point to an actual file in `data/sources/`.

---

## After Project Deletion

### 1. GDS Recomputation

```bash
python neo4j/gds.py
```

Removing a project changes PageRank, Betweenness, and Degree for all remaining entities.

### 2. Orphan Check

```cypher
-- Entities with no project
MATCH (e:Entity) WHERE NOT (e)-[:MENTIONED_IN]->() RETURN e.name

-- Temporal events with no project
MATCH (te:TemporalEvent) WHERE NOT (te)-[:BELONGS_TO_PROJECT]->() RETURN te

-- Causal chains with no project
MATCH (cc:CausalChain) WHERE NOT (cc)-[:BELONGS_TO_PROJECT]->() RETURN cc
```

`delete_project.py` handles cascade cleanup, but always verify no orphans remain.

---

## After Collection Import

**When:** After `import_collection.py` completes successfully.

### 1. GDS Recomputation

```bash
python neo4j/gds.py
```

Import runs GDS automatically in Phase 5, but if it was skipped or failed, run manually. GDS must recompute because imported entities change the entire graph structure.

### 2. Bridge Entity Verification

```cypher
MATCH (e:Entity) WHERE e.projectCount > 1
RETURN e.name, e.projectCount ORDER BY e.projectCount DESC
```

Imported projects should create new bridges or increment existing ones. Compare bridge count before and after import.

### 3. Embedding Verification

```cypher
MATCH (e:Entity) WHERE e.embedding IS NULL OR size(e.embedding) = 0
RETURN e.name
```

Import creates zero-vector placeholders for stub entities. These should be replaced with real embeddings by running `nlp/embed.py` on imported projects. Check for any entities with null or zero-vector embeddings after import.

### 4. Stub Entity Check

```cypher
MATCH (e:Entity) WHERE e.definition CONTAINS 'import stub'
RETURN e.name, e.definition
```

Stub entities are created for cross-project references that couldn't be resolved during import. These should be reviewed and enriched with proper definitions.

### 5. Collection Assignment

```cypher
MATCH (p:Project)-[:BELONGS_TO]->(c:Collection)
RETURN c.name, count(p) AS projects
ORDER BY projects DESC
```

Verify all imported projects are assigned to the correct collection.

---

## Periodic Maintenance

### Database Health

```bash
python neo4j/bootstrap.py --status
```

Shows node counts, relationship counts, index status. Run periodically to verify graph integrity.

### Vector Index Health

```cypher
SHOW INDEXES YIELD name, type, state
WHERE type = 'VECTOR'
RETURN name, state
```

Both `entityEmbedding` and `projectEmbedding` should show `ONLINE`.

### Stale GDS Metrics

If multiple projects were uploaded without running GDS between each:

```bash
python neo4j/gds.py  # One run covers everything
```

GDS always operates on the full graph, so a single run after multiple uploads is fine.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `gds.version()` unknown function | GDS plugin not installed | Neo4j Desktop → DBMS → Plugins → Install GDS |
| PageRank all zeros | No RELATES_TO edges in projection | Check: `MATCH ()-[r:RELATES_TO]->() RETURN count(r)` |
| Bridge count seems low | Alias matching didn't fire | Check entity aliases overlap with `detect_overlaps` MCP tool |
| Embeddings missing | embed.py failed silently | Re-run embedding step, check stderr log |
| htmlPath file missing | Not copied to data/sources/ | Copy from data/extracted/<project>/01_html.html |
