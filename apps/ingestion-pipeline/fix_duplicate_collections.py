"""
fix_duplicate_collections.py
Finds and removes duplicate Collection nodes in Neo4j.

Run with Neo4j running:
  python fix_duplicate_collections.py

Uses the same db.py / config.py setup as all other ingestion scripts.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'neo4j'))
from db import run_cypher, check_connection

check_connection()

# ── Step 1: Find duplicates ────────────────────────────────────

print("\n=== Checking for duplicate Collection nodes ===")

res = run_cypher("""
    MATCH (c:Collection)
    WITH c.name AS name, collect(id(c)) AS nodeIds, count(*) AS cnt
    WHERE cnt > 1
    RETURN name, cnt, nodeIds
    ORDER BY cnt DESC
""")

if not res["ok"]:
    print(f"Query failed: {res['errors']}")
    sys.exit(1)

rows = res["data"]
if not rows or not rows[0]["data"]:
    print("No duplicate collections found. Database is clean.")
    sys.exit(0)

# Unpack result rows: data[0] = first statement, "data" = rows, "columns" = headers
cols   = rows[0]["columns"]   # ['name', 'cnt', 'nodeIds']
data   = rows[0]["data"]      # list of {"row": [...], "meta": [...]}

duplicates = []
for item in data:
    row = item["row"]
    name     = row[cols.index("name")]
    cnt      = row[cols.index("cnt")]
    node_ids = row[cols.index("nodeIds")]
    print(f"  '{name}': {cnt} copies  internal IDs: {node_ids}")
    duplicates.append({"name": name, "nodeIds": node_ids})

print()

# ── Step 2: Fix each duplicate set ────────────────────────────

for dup in duplicates:
    name = dup["name"]
    ids  = dup["nodeIds"]
    canonical_id = ids[0]
    dupes_to_remove = ids[1:]

    print(f"Fixing '{name}': canonical={canonical_id}, removing={dupes_to_remove}")

    for dup_id in dupes_to_remove:
        # Migrate all BELONGS_TO edges from the dup node to the canonical
        migrate_res = run_cypher(
            """
            MATCH (canonical:Collection)  WHERE id(canonical) = $cid
            MATCH (dup:Collection)        WHERE id(dup)       = $did
            MATCH (p:Project)-[r:BELONGS_TO]->(dup)
            MERGE (p)-[:BELONGS_TO]->(canonical)
            DELETE r
            RETURN count(p) AS migrated
            """,
            {"cid": canonical_id, "did": dup_id}
        )
        if migrate_res["ok"] and migrate_res["data"] and migrate_res["data"][0]["data"]:
            migrated_count = migrate_res["data"][0]["data"][0]["row"][0]
            print(f"  Migrated {migrated_count} project(s) from node {dup_id} -> {canonical_id}")
        else:
            print(f"  No projects to migrate from node {dup_id} (or query error: {migrate_res.get('errors')})")

        # Delete the duplicate node (now it should have no relationships)
        del_res = run_cypher(
            "MATCH (dup:Collection) WHERE id(dup) = $did DETACH DELETE dup",
            {"did": dup_id}
        )
        if del_res["ok"]:
            print(f"  Deleted duplicate node {dup_id}")
        else:
            print(f"  Failed to delete node {dup_id}: {del_res['errors']}")

# ── Step 3: Final state ────────────────────────────────────────

print("\n=== Final Collection state ===")
final_res = run_cypher("""
    MATCH (c:Collection)
    OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c)
    RETURN c.name AS name, count(DISTINCT p) AS projects
    ORDER BY name
""")
if final_res["ok"] and final_res["data"] and final_res["data"][0]["data"]:
    for item in final_res["data"][0]["data"]:
        row   = item["row"]
        name  = row[0]
        projs = row[1]
        print(f"  '{name}': {projs} project(s)")

print("\nDone — duplicate collection nodes fixed.")
