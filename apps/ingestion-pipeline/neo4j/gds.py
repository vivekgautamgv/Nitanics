"""
MemoryTonic v4 — Graph Data Science (GDS) Computations

Runs graph algorithms after project uploads to compute entity importance
and structural metrics. Stores results as node properties.

Usage:
  python neo4j/gds.py                  # Run all computations
  python neo4j/gds.py --pagerank       # PageRank only
  python neo4j/gds.py --betweenness    # Betweenness Centrality only
  python neo4j/gds.py --degree         # Degree Centrality only
  python neo4j/gds.py --similarity     # Node Similarity only
  python neo4j/gds.py --status         # Show current GDS metrics

Algorithms:
  PageRank          — Entity importance based on relationship structure
  Betweenness       — Structural bridge detection (sits on shortest paths)
  Degree            — Connection count (in + out)
  Node Similarity   — Entities with similar relationship patterns (for recommendations)

Prerequisites:
  - Neo4j GDS plugin installed
  - Data uploaded via upload.py
  - Credentials in neo4j/.env

Run after EVERY project upload to keep metrics current.
"""

import sys

from db import run_cypher, check_connection

# Graph projection name (recreated each run)
PROJECTION = "memorytonic-graph"


def check_gds():
    """Verify GDS plugin is available."""
    result = run_cypher("RETURN gds.version() AS version")
    if not result["ok"]:
        print("[ERROR] GDS plugin not installed.")
        print("  Install via Neo4j Desktop: DBMS → Plugins → Graph Data Science Library")
        sys.exit(1)
    version = result["data"][0]["data"][0]["row"][0]
    print(f"[OK] GDS v{version}")
    return version


def drop_projection():
    """Drop existing graph projection if it exists."""
    result = run_cypher(
        "CALL gds.graph.exists($name) YIELD exists RETURN exists",
        {"name": PROJECTION},
    )
    if result["ok"] and result["data"][0]["data"][0]["row"][0]:
        run_cypher("CALL gds.graph.drop($name)", {"name": PROJECTION})
        print(f"  Dropped existing projection: {PROJECTION}")


def create_projection():
    """Create in-memory graph projection for GDS algorithms.

    Projects Entity nodes with RELATES_TO relationships (the main
    knowledge edges). Undirected for centrality algorithms.
    """
    drop_projection()

    result = run_cypher(
        """
        CALL gds.graph.project(
            $name,
            'Entity',
            {
                RELATES_TO: {
                    orientation: 'UNDIRECTED'
                }
            }
        )
        YIELD graphName, nodeCount, relationshipCount
        RETURN graphName, nodeCount, relationshipCount
        """,
        {"name": PROJECTION},
    )
    if not result["ok"]:
        print(f"  [ERROR] Projection failed: {result['errors']}")
        return False

    row = result["data"][0]["data"][0]["row"]
    print(f"  Projection: {row[0]} ({row[1]} nodes, {row[2]} relationships)")
    return True


def run_pagerank():
    """Compute PageRank and write back to Entity nodes."""
    print("\n[PAGERANK]")

    result = run_cypher(
        """
        CALL gds.pageRank.write($name, {
            writeProperty: 'pageRank',
            maxIterations: 20,
            dampingFactor: 0.85
        })
        YIELD nodePropertiesWritten, ranIterations, didConverge,
              centralityDistribution
        RETURN nodePropertiesWritten, ranIterations, didConverge,
               centralityDistribution.mean AS mean,
               centralityDistribution.max AS max
        """,
        {"name": PROJECTION},
    )
    if not result["ok"]:
        print(f"  [ERROR] {result['errors']}")
        return False

    row = result["data"][0]["data"][0]["row"]
    print(f"  Written to {row[0]} nodes")
    print(f"  Iterations: {row[1]}, Converged: {row[2]}")
    print(f"  Mean: {row[3]:.4f}, Max: {row[4]:.4f}")

    # Show top 10
    top = run_cypher(
        "MATCH (e:Entity) WHERE e.pageRank IS NOT NULL "
        "RETURN e.name, round(e.pageRank, 4) AS pr "
        "ORDER BY e.pageRank DESC LIMIT 10"
    )
    if top["ok"] and top["data"][0]["data"]:
        print("  Top 10:")
        for r in top["data"][0]["data"]:
            print(f"    {r['row'][0]:45s} {r['row'][1]}")
    return True


def run_betweenness():
    """Compute Betweenness Centrality and write back to Entity nodes."""
    print("\n[BETWEENNESS CENTRALITY]")

    result = run_cypher(
        """
        CALL gds.betweenness.write($name, {
            writeProperty: 'betweenness'
        })
        YIELD nodePropertiesWritten, centralityDistribution
        RETURN nodePropertiesWritten,
               centralityDistribution.mean AS mean,
               centralityDistribution.max AS max
        """,
        {"name": PROJECTION},
    )
    if not result["ok"]:
        print(f"  [ERROR] {result['errors']}")
        return False

    row = result["data"][0]["data"][0]["row"]
    print(f"  Written to {row[0]} nodes")
    print(f"  Mean: {row[1]:.4f}, Max: {row[2]:.4f}")

    # Show top 10
    top = run_cypher(
        "MATCH (e:Entity) WHERE e.betweenness IS NOT NULL "
        "RETURN e.name, round(e.betweenness, 4) AS bc "
        "ORDER BY e.betweenness DESC LIMIT 10"
    )
    if top["ok"] and top["data"][0]["data"]:
        print("  Top 10:")
        for r in top["data"][0]["data"]:
            print(f"    {r['row'][0]:45s} {r['row'][1]}")
    return True


def run_degree():
    """Compute Degree Centrality and write back to Entity nodes."""
    print("\n[DEGREE CENTRALITY]")

    result = run_cypher(
        """
        CALL gds.degree.write($name, {
            writeProperty: 'degree'
        })
        YIELD nodePropertiesWritten, centralityDistribution
        RETURN nodePropertiesWritten,
               centralityDistribution.mean AS mean,
               centralityDistribution.max AS max
        """,
        {"name": PROJECTION},
    )
    if not result["ok"]:
        print(f"  [ERROR] {result['errors']}")
        return False

    row = result["data"][0]["data"][0]["row"]
    print(f"  Written to {row[0]} nodes")
    print(f"  Mean: {row[1]:.4f}, Max: {row[2]:.4f}")

    # Show top 10
    top = run_cypher(
        "MATCH (e:Entity) WHERE e.degree IS NOT NULL "
        "RETURN e.name, e.degree "
        "ORDER BY e.degree DESC LIMIT 10"
    )
    if top["ok"] and top["data"][0]["data"]:
        print("  Top 10:")
        for r in top["data"][0]["data"]:
            print(f"    {r['row'][0]:45s} {r['row'][1]}")
    return True


def run_similarity():
    """Compute Node Similarity and write relationships between similar entities.

    Creates SIMILAR_TO relationships between entities that share similar
    relationship patterns. Used for recommendations ("entities like this one").
    """
    print("\n[NODE SIMILARITY]")

    # Drop existing SIMILAR_TO relationships first
    run_cypher("MATCH ()-[r:SIMILAR_TO]->() DELETE r")

    result = run_cypher(
        """
        CALL gds.nodeSimilarity.write($name, {
            writeRelationshipType: 'SIMILAR_TO',
            writeProperty: 'similarity',
            similarityCutoff: 0.3,
            topK: 5
        })
        YIELD nodesCompared, relationshipsWritten, similarityDistribution
        RETURN nodesCompared, relationshipsWritten,
               similarityDistribution.mean AS mean,
               similarityDistribution.max AS max
        """,
        {"name": PROJECTION},
    )
    if not result["ok"]:
        print(f"  [ERROR] {result['errors']}")
        return False

    row = result["data"][0]["data"][0]["row"]
    print(f"  Compared {row[0]} nodes")
    print(f"  Created {row[1]} SIMILAR_TO relationships")
    print(f"  Mean similarity: {row[2]:.4f}, Max: {row[3]:.4f}")

    # Show top pairs
    top = run_cypher(
        "MATCH (a:Entity)-[r:SIMILAR_TO]->(b:Entity) "
        "RETURN a.name, b.name, round(r.similarity, 3) AS sim "
        "ORDER BY r.similarity DESC LIMIT 10"
    )
    if top["ok"] and top["data"][0]["data"]:
        print("  Top 10 similar pairs:")
        for r in top["data"][0]["data"]:
            print(f"    {r['row'][0]:30s} <-> {r['row'][1]:30s} {r['row'][2]}")
    return True


def show_status():
    """Show current GDS metrics stored on nodes."""
    print("\n[GDS STATUS]")

    # Check which metrics exist
    for prop in ["pageRank", "betweenness", "degree"]:
        result = run_cypher(
            f"MATCH (e:Entity) WHERE e.{prop} IS NOT NULL RETURN count(e) AS c"
        )
        if result["ok"]:
            count = result["data"][0]["data"][0]["row"][0]
            total = run_cypher("MATCH (e:Entity) RETURN count(e)")["data"][0]["data"][0]["row"][0]
            print(f"  {prop:20s} {count}/{total} entities")

    # SIMILAR_TO count
    result = run_cypher("MATCH ()-[r:SIMILAR_TO]->() RETURN count(r) AS c")
    if result["ok"]:
        count = result["data"][0]["data"][0]["row"][0]
        print(f"  {'SIMILAR_TO rels':20s} {count}")

    # Top entities by composite score
    result = run_cypher(
        """
        MATCH (e:Entity)
        WHERE e.pageRank IS NOT NULL AND e.betweenness IS NOT NULL
        RETURN e.name, e.projectCount,
               round(e.pageRank, 4) AS pr,
               round(e.betweenness, 2) AS bc,
               e.degree AS deg
        ORDER BY e.pageRank DESC LIMIT 15
        """
    )
    if result["ok"] and result["data"][0]["data"]:
        print("\n  Top 15 entities (by PageRank):")
        print(f"    {'Name':40s} {'Projects':>8s} {'PageRank':>10s} {'Between.':>10s} {'Degree':>8s}")
        print(f"    {'-' * 40} {'-' * 8} {'-' * 10} {'-' * 10} {'-' * 8}")
        for r in result["data"][0]["data"]:
            name, pc, pr, bc, deg = r["row"]
            print(f"    {name:40s} {pc or 1:8d} {pr:10.4f} {bc:10.2f} {deg or 0:8.0f}")


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------

def main():
    args = set(sys.argv[1:])

    check_connection()
    check_gds()

    if "--status" in args:
        show_status()
        return

    run_all = not args or args == set()
    needs_projection = run_all or bool(args & {"--pagerank", "--betweenness", "--degree", "--similarity"})

    if needs_projection:
        print("\n[PROJECTION]")
        if not create_projection():
            sys.exit(1)

    try:
        if run_all or "--pagerank" in args:
            run_pagerank()
        if run_all or "--betweenness" in args:
            run_betweenness()
        if run_all or "--degree" in args:
            run_degree()
        if run_all or "--similarity" in args:
            run_similarity()
    finally:
        # Always clean up projection, even if an algorithm crashes
        if needs_projection:
            drop_projection()
            print("\n[CLEANUP] Projection dropped")

    print("\n" + "=" * 50)
    print(" GDS computation complete!")
    print("=" * 50)

    show_status()


if __name__ == "__main__":
    main()
