"""
MemoryTonic v4 — Neo4j Bootstrap

Creates schema (constraints, indexes, default directories) in Neo4j.
Uses HTTP API — no additional Python dependencies needed.

Usage:
  python neo4j/bootstrap.py                    # Bootstrap (keep existing data)
  python neo4j/bootstrap.py --clean            # Wipe everything + bootstrap fresh
  python neo4j/bootstrap.py --status           # Show current database stats

Connection: neo4j://127.0.0.1:7687 (database: memorytonic)
"""

import sys

from db import run_cypher, check_connection


def clean_database():
    """Delete ALL nodes and relationships."""
    print("[CLEAN] Deleting all data...")
    # Delete in batches to avoid memory issues on large graphs
    total = 0
    while True:
        result = run_cypher("MATCH (n) WITH n LIMIT 1000 DETACH DELETE n RETURN count(n) AS deleted")
        if not result["ok"]:
            print(f"  [ERROR] {result['errors']}")
            break
        deleted = result["data"][0]["data"][0]["row"][0] if result["data"][0]["data"] else 0
        total += deleted
        if deleted == 0:
            break
    print(f"  Deleted {total} nodes total")

    # Drop existing indexes and constraints
    print("[CLEAN] Dropping indexes and constraints...")
    result = run_cypher("SHOW CONSTRAINTS YIELD name RETURN name")
    if result["ok"] and result["data"][0]["data"]:
        for row in result["data"][0]["data"]:
            name = row["row"][0]
            drop_result = run_cypher(f"DROP CONSTRAINT {name} IF EXISTS")
            if drop_result["ok"]:
                print(f"  Dropped constraint: {name}")

    result = run_cypher("SHOW INDEXES YIELD name, type WHERE type <> 'LOOKUP' RETURN name")
    if result["ok"] and result["data"][0]["data"]:
        for row in result["data"][0]["data"]:
            name = row["row"][0]
            drop_result = run_cypher(f"DROP INDEX {name} IF EXISTS")
            if drop_result["ok"]:
                print(f"  Dropped index: {name}")

    print("[CLEAN] Database wiped clean")


def bootstrap_schema():
    """Create all constraints, indexes, and default directories."""
    print()
    print("=" * 50)
    print(" Creating v4 Schema")
    print("=" * 50)

    # Constraints
    constraints = [
        ("entity_id", "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.entityId IS UNIQUE"),
        ("project_id", "CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.projectId IS UNIQUE"),
        ("collection_id", "CREATE CONSTRAINT collection_id IF NOT EXISTS FOR (c:Collection) REQUIRE c.collectionId IS UNIQUE"),
        ("directory_name", "CREATE CONSTRAINT directory_name IF NOT EXISTS FOR (d:DirectoryCategory) REQUIRE d.name IS UNIQUE"),
        ("datetime_id", "CREATE CONSTRAINT datetime_id IF NOT EXISTS FOR (dt:DateTime) REQUIRE dt.datetimeId IS UNIQUE"),
        ("temporal_event_id", "CREATE CONSTRAINT temporal_event_id IF NOT EXISTS FOR (te:TemporalEvent) REQUIRE te.eventId IS UNIQUE"),
        ("causal_chain_id", "CREATE CONSTRAINT causal_chain_id IF NOT EXISTS FOR (cc:CausalChain) REQUIRE cc.chainId IS UNIQUE"),
    ]

    print("\n[CONSTRAINTS]")
    for name, cypher in constraints:
        result = run_cypher(cypher)
        status = "OK" if result["ok"] else f"FAIL: {result['errors']}"
        print(f"  {name:25s} {status}")

    # Indexes
    indexes = [
        ("entity_name", "CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name)"),
        ("entity_category", "CREATE INDEX entity_category IF NOT EXISTS FOR (e:Entity) ON (e.category)"),
        ("project_name", "CREATE INDEX project_name IF NOT EXISTS FOR (p:Project) ON (p.name)"),
        ("collection_name", "CREATE INDEX collection_name IF NOT EXISTS FOR (c:Collection) ON (c.name)"),
        ("temporal_project", "CREATE INDEX temporal_event_project IF NOT EXISTS FOR (te:TemporalEvent) ON (te.projectId)"),
    ]

    print("\n[INDEXES]")
    for name, cypher in indexes:
        result = run_cypher(cypher)
        status = "OK" if result["ok"] else f"FAIL: {result['errors']}"
        print(f"  {name:25s} {status}")

    # Full-text index
    print("\n[FULLTEXT INDEX]")
    result = run_cypher(
        "CREATE FULLTEXT INDEX entity_fulltext IF NOT EXISTS "
        "FOR (e:Entity) ON EACH [e.name, e.definition, e.aliases_text]"
    )
    status = "OK" if result["ok"] else f"FAIL: {result['errors']}"
    print(f"  entity_fulltext           {status}")

    # Vector indexes
    print("\n[VECTOR INDEXES]")
    result = run_cypher(
        "CREATE VECTOR INDEX entityEmbedding IF NOT EXISTS "
        "FOR (e:Entity) ON (e.embedding) "
        "OPTIONS {indexConfig: {`vector.dimensions`: 384, `vector.similarity_function`: 'cosine'}}"
    )
    status = "OK" if result["ok"] else f"FAIL: {result['errors']}"
    print(f"  entityEmbedding (384d)    {status}")

    result = run_cypher(
        "CREATE VECTOR INDEX projectEmbedding IF NOT EXISTS "
        "FOR (p:Project) ON (p.embedding) "
        "OPTIONS {indexConfig: {`vector.dimensions`: 384, `vector.similarity_function`: 'cosine'}}"
    )
    status = "OK" if result["ok"] else f"FAIL: {result['errors']}"
    print(f"  projectEmbedding (384d)   {status}")

    # Default directories
    print("\n[DEFAULT DIRECTORIES]")
    directories = [
        ("Research", "Research papers, investigations, academic studies"),
        ("Business", "Business processes, operations, strategy documents"),
        ("Personal", "Personal knowledge, notes, learning materials"),
    ]
    for name, desc in directories:
        result = run_cypher(
            "MERGE (d:DirectoryCategory {name: $name}) SET d.description = $desc RETURN d.name",
            {"name": name, "desc": desc},
        )
        status = "OK" if result["ok"] else f"FAIL: {result['errors']}"
        print(f"  {name:25s} {status}")

    print("\n" + "=" * 50)
    print(" Schema bootstrap complete!")
    print("=" * 50)


def show_status():
    """Show current database statistics."""
    print("\n[DATABASE STATUS]")

    # Node counts
    result = run_cypher(
        "MATCH (n) RETURN labels(n) AS labels, count(n) AS count ORDER BY count DESC"
    )
    if result["ok"] and result["data"][0]["data"]:
        print("\n  Nodes:")
        for row in result["data"][0]["data"]:
            print(f"    {str(row['row'][0]):35s} {row['row'][1]}")
    else:
        print("  No nodes in database")

    # Relationship counts
    result = run_cypher(
        "MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count ORDER BY count DESC"
    )
    if result["ok"] and result["data"][0]["data"]:
        print("\n  Relationships:")
        for row in result["data"][0]["data"]:
            print(f"    {row['row'][0]:35s} {row['row'][1]}")
    else:
        print("  No relationships in database")

    # Index counts
    result = run_cypher("SHOW INDEXES YIELD name, type, state RETURN name, type, state")
    if result["ok"] and result["data"][0]["data"]:
        print("\n  Indexes:")
        for row in result["data"][0]["data"]:
            print(f"    {row['row'][0]:35s} {row['row'][1]:15s} {row['row'][2]}")

    # Constraint counts
    result = run_cypher("SHOW CONSTRAINTS YIELD name, type RETURN name, type")
    if result["ok"] and result["data"][0]["data"]:
        print("\n  Constraints:")
        for row in result["data"][0]["data"]:
            print(f"    {row['row'][0]:35s} {row['row'][1]}")


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------

def main():
    args = sys.argv[1:]

    check_connection()

    if "--status" in args:
        show_status()
        return

    if "--clean" in args:
        print()
        clean_database()

    bootstrap_schema()

    print()
    show_status()


if __name__ == "__main__":
    main()
