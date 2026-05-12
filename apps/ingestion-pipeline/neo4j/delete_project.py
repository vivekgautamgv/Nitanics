"""
MemoryTonic v4 — Project Deletion (Cascade)

Deletes a project from Neo4j and removes associated files from the filesystem.
Handles all cascading relationships and entity cleanup.

Usage:
  python neo4j/delete_project.py <unique-id>           # Delete by unique_id
  python neo4j/delete_project.py <unique-id> --dry-run  # Preview what would be deleted
  python neo4j/delete_project.py <unique-id> --keep-files  # Neo4j only, keep filesystem

Cascade order:
  1. CHAIN_LINK relationships (from this project's causal chains)
  2. CausalChain nodes
  3. FIRST_APPEARS_IN relationships (from this project's temporal events)
  4. TemporalEvent nodes
  5. RELATES_TO relationships (between entities MENTIONED_IN this project)
  6. MENTIONED_IN relationships
  7. Entity cleanup (decrement projectCount, delete if 0)
  8. SIMILAR_TO relationships (from GDS, involving affected entities)
  9. Project node + structural links (IN_DIRECTORY, CREATED_ON, CREATED_AT, BELONGS_TO)
  10. DateTime cleanup (orphaned time nodes)
  11. Filesystem: data/sources/YYYY-MM-DD/<project>/ (HTML)
  12. Filesystem: data/extracted/<project>/ (artifacts)
  13. Filesystem: data/projects/<project>/ (source script)

Does NOT delete:
  - Collection nodes (shared across projects)
  - DirectoryCategory nodes (structural)
  - DateTime date nodes (may be shared)
"""

import sys
import os
import shutil

from db import run_cypher, check_connection


def find_project(unique_id):
    """Find project by uniqueId and return its details."""
    result = run_cypher(
        """
        MATCH (p:Project {uniqueId: $uid})
        RETURN p.projectId, p.name, p.uniqueId, p.htmlPath, p.directory
        """,
        {"uid": unique_id},
    )
    if not result["ok"] or not result["data"][0]["data"]:
        return None

    row = result["data"][0]["data"][0]["row"]
    return {
        "projectId": row[0],
        "name": row[1],
        "uniqueId": row[2],
        "htmlPath": row[3],
        "directory": row[4],
    }


def preview_deletion(project):
    """Show what would be deleted (dry run)."""
    pid = project["projectId"]
    uid = project["uniqueId"]

    print(f"\n[DRY RUN] Would delete project: {project['name']} ({uid})")
    print()

    # Entities
    r = run_cypher(
        "MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project {projectId: $pid}) RETURN count(e)",
        {"pid": pid},
    )
    entity_count = r["data"][0]["data"][0]["row"][0] if r["ok"] else 0

    # Entities that would be fully deleted (only in this project)
    r = run_cypher(
        """
        MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project {projectId: $pid})
        WHERE e.projectCount <= 1
        RETURN count(e)
        """,
        {"pid": pid},
    )
    delete_count = r["data"][0]["data"][0]["row"][0] if r["ok"] else 0
    decrement_count = entity_count - delete_count

    # Relationships
    r = run_cypher(
        """
        MATCH (a:Entity)-[:MENTIONED_IN]->(p:Project {projectId: $pid}),
              (b:Entity)-[:MENTIONED_IN]->(p),
              (a)-[r:RELATES_TO]->(b)
        RETURN count(r)
        """,
        {"pid": pid},
    )
    rel_count = r["data"][0]["data"][0]["row"][0] if r["ok"] else 0

    # Causal chains
    r = run_cypher(
        "MATCH (cc:CausalChain {projectId: $pid}) RETURN count(cc)",
        {"pid": pid},
    )
    chain_count = r["data"][0]["data"][0]["row"][0] if r["ok"] else 0

    # Temporal events
    r = run_cypher(
        "MATCH (te:TemporalEvent {projectId: $pid}) RETURN count(te)",
        {"pid": pid},
    )
    event_count = r["data"][0]["data"][0]["row"][0] if r["ok"] else 0

    print(f"  Neo4j:")
    print(f"    Entities to DELETE (only in this project): {delete_count}")
    print(f"    Entities to DECREMENT projectCount:        {decrement_count}")
    print(f"    Relationships (RELATES_TO):                {rel_count}")
    print(f"    Causal chains:                             {chain_count}")
    print(f"    Temporal events:                           {event_count}")
    print(f"    Project node:                              1")

    # Filesystem
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    paths = [
        os.path.join(base, "data", "extracted", uid),
        os.path.join(base, "data", "projects", uid),
    ]
    # HTML path from Neo4j
    if project.get("htmlPath"):
        html_dir = os.path.join(base, os.path.dirname(project["htmlPath"]))
        paths.append(html_dir)

    print(f"\n  Filesystem:")
    for p in paths:
        exists = os.path.isdir(p)
        print(f"    {'EXISTS' if exists else 'MISSING':7s} {p}")


def delete_from_neo4j(project):
    """Delete all project data from Neo4j. Returns counts."""
    pid = project["projectId"]
    counts = {}

    # 1. Delete CHAIN_LINK relationships from this project's chains
    r = run_cypher(
        """
        MATCH (cc:CausalChain {projectId: $pid})
        WITH cc.chainId AS cid
        MATCH (a)-[r:CHAIN_LINK {chainId: cid}]->(b)
        DELETE r
        RETURN count(r) AS deleted
        """,
        {"pid": pid},
    )
    counts["chain_links"] = r["data"][0]["data"][0]["row"][0] if r["ok"] and r["data"][0]["data"] else 0

    # 2. Delete CausalChain nodes
    r = run_cypher(
        "MATCH (cc:CausalChain {projectId: $pid}) DETACH DELETE cc RETURN count(cc)",
        {"pid": pid},
    )
    counts["causal_chains"] = r["data"][0]["data"][0]["row"][0] if r["ok"] and r["data"][0]["data"] else 0

    # 3. Delete FIRST_APPEARS_IN links to this project's events
    r = run_cypher(
        """
        MATCH (te:TemporalEvent {projectId: $pid})
        WITH te
        MATCH (e)-[r:FIRST_APPEARS_IN]->(te)
        DELETE r
        RETURN count(r) AS deleted
        """,
        {"pid": pid},
    )
    counts["first_appears"] = r["data"][0]["data"][0]["row"][0] if r["ok"] and r["data"][0]["data"] else 0

    # 4. Delete TemporalEvent nodes
    r = run_cypher(
        "MATCH (te:TemporalEvent {projectId: $pid}) DETACH DELETE te RETURN count(te)",
        {"pid": pid},
    )
    counts["temporal_events"] = r["data"][0]["data"][0]["row"][0] if r["ok"] and r["data"][0]["data"] else 0

    # 5. Delete RELATES_TO between entities of this project
    # Get entities mentioned in this project
    r = run_cypher(
        """
        MATCH (a:Entity)-[:MENTIONED_IN]->(p:Project {projectId: $pid}),
              (b:Entity)-[:MENTIONED_IN]->(p),
              (a)-[r:RELATES_TO]->(b)
        DELETE r
        RETURN count(r) AS deleted
        """,
        {"pid": pid},
    )
    counts["relationships"] = r["data"][0]["data"][0]["row"][0] if r["ok"] and r["data"][0]["data"] else 0

    # 6. Delete MENTIONED_IN links + handle entity cleanup
    # First: get entities that are ONLY in this project (will be deleted)
    r = run_cypher(
        """
        MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project {projectId: $pid})
        WHERE e.projectCount <= 1
        RETURN collect(e.entityId) AS toDelete
        """,
        {"pid": pid},
    )
    entities_to_delete = r["data"][0]["data"][0]["row"][0] if r["ok"] and r["data"][0]["data"] else []

    # Decrement projectCount on entities that appear in other projects too
    r = run_cypher(
        """
        MATCH (e:Entity)-[r:MENTIONED_IN]->(p:Project {projectId: $pid})
        WHERE e.projectCount > 1
        SET e.projectCount = e.projectCount - 1
        DELETE r
        RETURN count(e) AS decremented
        """,
        {"pid": pid},
    )
    counts["entities_decremented"] = r["data"][0]["data"][0]["row"][0] if r["ok"] and r["data"][0]["data"] else 0

    # Delete single-project entities (and their remaining relationships)
    if entities_to_delete:
        r = run_cypher(
            """
            MATCH (e:Entity) WHERE e.entityId IN $ids
            DETACH DELETE e
            RETURN count(e) AS deleted
            """,
            {"ids": entities_to_delete},
        )
        counts["entities_deleted"] = r["data"][0]["data"][0]["row"][0] if r["ok"] and r["data"][0]["data"] else 0
    else:
        counts["entities_deleted"] = 0

    # 7. Delete the project node and all structural links
    r = run_cypher(
        "MATCH (p:Project {projectId: $pid}) DETACH DELETE p RETURN count(p)",
        {"pid": pid},
    )
    counts["project"] = r["data"][0]["data"][0]["row"][0] if r["ok"] and r["data"][0]["data"] else 0

    # 8. Clean up orphaned DateTime time nodes (no project links)
    r = run_cypher(
        """
        MATCH (t:DateTime {type: 'time'})
        WHERE NOT (t)<-[:CREATED_AT]-()
        DETACH DELETE t
        RETURN count(t) AS deleted
        """
    )
    counts["orphaned_times"] = r["data"][0]["data"][0]["row"][0] if r["ok"] and r["data"][0]["data"] else 0

    return counts


def delete_from_filesystem(project, base_dir):
    """Delete project files from filesystem."""
    uid = project["uniqueId"]
    deleted = []

    # data/extracted/<project>/
    extracted = os.path.join(base_dir, "data", "extracted", uid)
    if os.path.isdir(extracted):
        shutil.rmtree(extracted)
        deleted.append(extracted)

    # data/projects/<project>/
    projects = os.path.join(base_dir, "data", "projects", uid)
    if os.path.isdir(projects):
        shutil.rmtree(projects)
        deleted.append(projects)

    # data/sources/YYYY-MM-DD/<project>/ (from htmlPath)
    if project.get("htmlPath"):
        html_dir = os.path.join(base_dir, os.path.dirname(project["htmlPath"]))
        if os.path.isdir(html_dir):
            shutil.rmtree(html_dir)
            deleted.append(html_dir)

    return deleted


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: python neo4j/delete_project.py <unique-id> [--dry-run] [--keep-files]")
        sys.exit(1)

    unique_id = sys.argv[1]
    dry_run = "--dry-run" in sys.argv
    keep_files = "--keep-files" in sys.argv

    check_connection()

    project = find_project(unique_id)
    if not project:
        print(f"[ERROR] Project not found: {unique_id}")
        sys.exit(1)

    print(f"[FOUND] {project['name']} ({project['uniqueId']})")
    print(f"  ID: {project['projectId']}")
    print(f"  Directory: {project['directory']}")
    print(f"  HTML: {project['htmlPath']}")

    if dry_run:
        preview_deletion(project)
        print("\n[DRY RUN] No changes made.")
        return

    # Confirm
    print(f"\n  This will permanently delete this project and all associated data.")
    print(f"  Press Ctrl+C to abort, or Enter to continue...")
    try:
        input()
    except (KeyboardInterrupt, EOFError):
        print("\n[ABORTED]")
        return

    # Delete from Neo4j
    print("\n[NEO4J] Deleting...")
    counts = delete_from_neo4j(project)
    print(f"  Project node:          {counts['project']}")
    print(f"  Entities deleted:      {counts['entities_deleted']}")
    print(f"  Entities decremented:  {counts['entities_decremented']}")
    print(f"  Relationships:         {counts['relationships']}")
    print(f"  Causal chains:         {counts['causal_chains']}")
    print(f"  Chain links:           {counts['chain_links']}")
    print(f"  Temporal events:       {counts['temporal_events']}")
    print(f"  FIRST_APPEARS_IN:      {counts['first_appears']}")
    print(f"  Orphaned times:        {counts['orphaned_times']}")

    # Delete from filesystem
    if not keep_files:
        base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        print("\n[FILESYSTEM] Deleting...")
        deleted = delete_from_filesystem(project, base_dir)
        for d in deleted:
            print(f"  Deleted: {d}")
        if not deleted:
            print("  No filesystem paths found to delete")
    else:
        print("\n[FILESYSTEM] Skipped (--keep-files)")

    print("\n" + "=" * 50)
    print(f" Project '{project['name']}' deleted.")
    print("=" * 50)
    print("\n[NOTE] Run 'python neo4j/gds.py' to recompute graph metrics.")


if __name__ == "__main__":
    main()
