"""
MemoryTonic v4 — Collection Export

Exports a complete collection as a portable knowledge graph package.
Everything an agent or human needs to reason over the collection — no Neo4j required.

Usage:
  python neo4j/export_collection.py "Global Finance Systems"
  python neo4j/export_collection.py "Global Finance Systems" --json-only
  python neo4j/export_collection.py "Global Finance Systems" --no-embeddings
  python neo4j/export_collection.py --list

Output: apps/exports/<collection-slug>.zip (or .json with --json-only)

Package contents:
  graph.json          - Complete knowledge graph (agent-readable, no DB needed)
  embeddings.json     - Raw 384d BERT vectors (for apps wanting vector search)
  manifest.json       - Export metadata, checksums, schema version
  README.md           - Human-readable collection overview
  projects/<name>/
    source.html       - Full styled source document
    extraction.json   - Raw extraction artifacts
"""

import json
import os
import sys
import zipfile
import hashlib
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import run_cypher, run_batch, check_connection

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
EXTRACTED_DIR = os.path.join(BASE_DIR, "data", "extracted")
SOURCES_DIR = os.path.join(BASE_DIR, "data", "sources")
EXPORTS_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "exports"))


def slugify(name):
    """Convert collection name to kebab-case slug."""
    return name.lower().replace(" ", "-").replace(":", "").replace("--", "-").strip("-")


# ---------------------------------------------------------------------------
# Neo4j Queries
# ---------------------------------------------------------------------------

def find_collection(name):
    """Find collection by name. Returns collection dict or None."""
    r = run_cypher(
        "MATCH (c:Collection) WHERE toLower(c.name) = toLower($name) "
        "RETURN c.name AS name, c.collectionId AS id, c.createdAt AS created",
        {"name": name}
    )
    if not r["ok"] or not r["data"][0]["data"]:
        return None
    row = r["data"][0]["data"][0]["row"]
    return {"name": row[0], "id": row[1], "created": row[2]}


def list_collections():
    """List all collections with project counts."""
    r = run_cypher(
        "MATCH (c:Collection) "
        "OPTIONAL MATCH (p:Project)-[:BELONGS_TO]->(c) "
        "RETURN c.name AS name, c.collectionId AS id, count(p) AS projects "
        "ORDER BY c.name"
    )
    if not r["ok"]:
        return []
    cols = r["data"][0]["columns"]
    return [dict(zip(cols, row["row"])) for row in r["data"][0]["data"]]


def pull_collection_graph(collection_name):
    """Pull the complete graph for a collection from Neo4j.

    Returns dict with: projects, entities, relationships, causal_chains,
                        temporal_events, bridges, similar_pairs
    """
    queries = [
        # 0: Projects in this collection
        (
            "MATCH (p:Project)-[:BELONGS_TO]->(c:Collection) "
            "WHERE toLower(c.name) = toLower($name) "
            "RETURN DISTINCT p.name AS name, p.uniqueId AS uniqueId, p.projectId AS projectId, p.domain AS domain, p.subdomain AS subdomain, "
            "p.summary AS summary, p.baseTags AS tags, p.narrativeFlow AS narrative_flow, "
            "p.htmlPath AS htmlPath, p.createdAt AS created",
            {"name": collection_name}
        ),
        # 1: All entities in these projects (with GDS metrics)
        (
            "MATCH (p:Project)-[:BELONGS_TO]->(c:Collection) "
            "WHERE toLower(c.name) = toLower($name) "
            "MATCH (e:Entity)-[:MENTIONED_IN]->(p) "
            "WITH e, collect(DISTINCT p.name) AS projects "
            "RETURN e.name AS name, e.category AS category, "
            "e.definition AS definition, e.role AS role, e.aliases AS aliases, "
            "e.pageRank AS pageRank, e.betweenness AS betweenness, "
            "e.degree AS degree, projects",
            {"name": collection_name}
        ),
        # 2: All RELATES_TO relationships between entities in collection
        (
            "MATCH (p:Project)-[:BELONGS_TO]->(c:Collection) "
            "WHERE toLower(c.name) = toLower($name) "
            "MATCH (e1:Entity)-[:MENTIONED_IN]->(p) "
            "MATCH (e2:Entity)-[:MENTIONED_IN]->(p) "
            "MATCH (e1)-[r:RELATES_TO]->(e2) "
            "WHERE r.projectId IS NULL OR EXISTS { MATCH (owner:Project {projectId: r.projectId})-[:BELONGS_TO]->(c) } "
            "RETURN DISTINCT e1.name AS source, e2.name AS target, "
            "r.relType AS relType, r.causalClassification AS causalClassification, "
            "r.description AS description, r.evidence AS evidence, "
            "r.evidenceStrength AS evidenceStrength, r.magnitude AS magnitude, "
            "r.year AS year, r.projectId AS projectId",
            {"name": collection_name}
        ),
        # 3: Causal chains
        (
            "MATCH (p:Project)-[:BELONGS_TO]->(c:Collection) "
            "WHERE toLower(c.name) = toLower($name) "
            "MATCH (cc:CausalChain)-[:BELONGS_TO_PROJECT]->(p) "
            "OPTIONAL MATCH (source:Entity)-[cl:CHAIN_LINK]->(target:Entity) "
            "WHERE cl.chainId = cc.chainId "
            "WITH cc, p, cl, source, target ORDER BY cl.orderIndex "
            "WITH cc, p, collect(CASE WHEN source IS NULL THEN null ELSE {source: source.name, target: target.name, "
            "explanation: cl.explanation, order: cl.orderIndex} END) AS links "
            "RETURN cc.name AS name, cc.chainId AS chainId, cc.description AS description, "
            "p.name AS project, p.uniqueId AS projectUniqueId, links",
            {"name": collection_name}
        ),
        # 4: Temporal events
        (
            "MATCH (p:Project)-[:BELONGS_TO]->(c:Collection) "
            "WHERE toLower(c.name) = toLower($name) "
            "MATCH (te:TemporalEvent)-[:BELONGS_TO_PROJECT]->(p) "
            "RETURN te.label AS label, te.period AS period, "
            "te.phaseIndex AS phaseIndex, p.name AS project "
            "ORDER BY p.name, te.phaseIndex",
            {"name": collection_name}
        ),
        # 5: SIMILAR_TO pairs (pre-computed from embeddings)
        (
            "MATCH (p:Project)-[:BELONGS_TO]->(c:Collection) "
            "WHERE toLower(c.name) = toLower($name) "
            "MATCH (e1:Entity)-[:MENTIONED_IN]->(p) "
            "MATCH (e2:Entity)-[:MENTIONED_IN]->(p2:Project)-[:BELONGS_TO]->(c) "
            "MATCH (e1)-[s:SIMILAR_TO]->(e2) "
            "WHERE e1.name < e2.name "
            "WITH DISTINCT e1.name AS entity1, e2.name AS entity2, s.similarity AS rawScore "
            "RETURN entity1, entity2, round(rawScore * 1000) / 1000 AS score "
            "ORDER BY score DESC",
            {"name": collection_name}
        ),
        # 6: Embeddings (entity + project)
        (
            "MATCH (p:Project)-[:BELONGS_TO]->(c:Collection) "
            "WHERE toLower(c.name) = toLower($name) "
            "MATCH (e:Entity)-[:MENTIONED_IN]->(p) "
            "WHERE e.embedding IS NOT NULL "
            "WITH DISTINCT e "
            "RETURN e.name AS name, 'entity' AS type, e.embedding AS embedding",
            {"name": collection_name}
        ),
        # 7: Project embeddings
        (
            "MATCH (p:Project)-[:BELONGS_TO]->(c:Collection) "
            "WHERE toLower(c.name) = toLower($name) AND p.embedding IS NOT NULL "
            "RETURN p.name AS name, 'project' AS type, p.embedding AS embedding",
            {"name": collection_name}
        ),
    ]

    result = run_batch(queries)
    if not result["ok"]:
        print(f"[ERROR] Neo4j batch query failed: {result['errors']}")
        sys.exit(1)

    def rows_to_dicts(query_index):
        qr = result["data"][query_index]
        cols = qr["columns"]
        return [dict(zip(cols, row["row"])) for row in qr["data"]]

    return {
        "projects": rows_to_dicts(0),
        "entities": rows_to_dicts(1),
        "relationships": rows_to_dicts(2),
        "causal_chains": rows_to_dicts(3),
        "temporal_events": rows_to_dicts(4),
        "similar_pairs": rows_to_dicts(5),
        "entity_embeddings": rows_to_dicts(6),
        "project_embeddings": rows_to_dicts(7),
    }


# ---------------------------------------------------------------------------
# Bridge Tier Computation
# ---------------------------------------------------------------------------

def compute_bridges(entities):
    """Compute bridge tiers from entity project counts and betweenness."""
    bridges = []
    for e in entities:
        proj_count = len(e.get("projects", []))
        btw = e.get("betweenness") or 0
        if proj_count >= 3:
            tier = "gold"
        elif proj_count == 2:
            tier = "silver"
        elif proj_count == 1 and btw > 1000:
            tier = "bronze"
        else:
            continue
        bridges.append({
            "name": e["name"],
            "category": e["category"],
            "tier": tier,
            "projects": proj_count,
            "betweenness": round(btw),
            "pageRank": round(e.get("pageRank") or 0, 2),
        })
    tier_rank = {"gold": 3, "silver": 2, "bronze": 1}
    bridges.sort(key=lambda b: (-tier_rank[b["tier"]], -b["betweenness"]))
    return bridges


# ---------------------------------------------------------------------------
# Build graph.json
# ---------------------------------------------------------------------------

def build_graph_json(collection, graph_data):
    """Assemble the agent-readable graph.json."""

    # Deduplicate entities (may appear via multiple projects)
    entity_map = {}
    for e in graph_data["entities"]:
        name = e["name"]
        if name in entity_map:
            # Merge project lists
            existing = entity_map[name]
            for p in (e.get("projects") or []):
                if p not in existing["projects"]:
                    existing["projects"].append(p)
        else:
            entity_map[name] = {
                "name": e["name"],
                "category": e["category"],
                "definition": e["definition"],
                "role": e["role"],
                "aliases": e.get("aliases") or [],
                "projects": list(e.get("projects") or []),
                "metrics": {
                    "pageRank": round(e.get("pageRank") or 0, 2),
                    "betweenness": round(e.get("betweenness") or 0),
                    "degree": e.get("degree") or 0,
                },
            }

    entities_list = sorted(entity_map.values(), key=lambda x: x["name"])
    bridges = compute_bridges([
        {**e, "projects": entity_map[e["name"]]["projects"]}
        for e in graph_data["entities"]
        if e["name"] in entity_map
    ])

    # Add bridge_tier to entities
    bridge_tiers = {b["name"]: b["tier"] for b in bridges}
    for e in entities_list:
        e["bridge_tier"] = bridge_tiers.get(e["name"])

    # Deduplicate relationships
    rel_seen = set()
    relationships = []
    for r in graph_data["relationships"]:
        key = (r["source"], r["target"], r["relType"], r.get("projectId"), r.get("evidence"), r.get("description"))
        if key not in rel_seen:
            rel_seen.add(key)
            relationships.append({
                "source": r["source"],
                "target": r["target"],
                "relType": r["relType"],
                "causalClassification": r["causalClassification"],
                "description": r["description"],
                "evidence": r["evidence"],
                "evidenceStrength": r.get("evidenceStrength"),
                "magnitude": r.get("magnitude"),
                "year": r.get("year"),
                "projectId": r.get("projectId"),
            })

    # Preserve graph links; adjacent extraction artifacts can enrich older data.
    causal_chains = []
    for cc in graph_data["causal_chains"]:
        causal_chains.append({
            "name": cc["name"],
            "description": cc.get("description") or "",
            "project": cc.get("project") or "",
            "projectUniqueId": cc.get("projectUniqueId"),
            "chainId": cc.get("chainId"),
            "links": cc.get("links") or [],
        })

    # Group temporal events by project
    temporal_by_project = {}
    for te in graph_data["temporal_events"]:
        proj = te.get("project") or "unknown"
        if proj not in temporal_by_project:
            temporal_by_project[proj] = []
        temporal_by_project[proj].append({
            "index": te.get("phaseIndex"),
            "label": te.get("label"),
            "period": te.get("period"),
        })

    # Build projects
    projects = []
    for p in graph_data["projects"]:
        # Extract slug from htmlPath (more reliable than slugifying display name)
        html_path = (p.get("htmlPath") or "").replace("\\", "/")
        parts = html_path.split("/")
        slug = parts[-2] if len(parts) >= 2 else slugify(p["name"])
        projects.append({
            "name": p["name"],
            "uniqueId": p.get("uniqueId"),
            "projectId": p.get("projectId"),
            "domain": p.get("domain"),
            "subdomain": p.get("subdomain"),
            "summary": p.get("summary") or "",
            "narrative_flow": p.get("narrative_flow") or [],
            "tags": p.get("tags") or [],
            "created": p.get("created"),
            "temporal_phases": temporal_by_project.get(p["name"], []),
            "html_file": f"projects/{slug}/source.html",
            "extraction_file": f"projects/{slug}/extraction.json",
        })

    return {
        "meta": {
            "collection": collection["name"],
            "collection_id": collection["id"],
            "exported_at": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            "schema_version": "1.0",
            "generator": "MemoryTonic v4 export_collection.py",
            "stats": {
                "projects": len(projects),
                "entities": len(entities_list),
                "relationships": len(relationships),
                "causal_chains": len(causal_chains),
                "bridges": len(bridges),
                "similar_pairs": len(graph_data["similar_pairs"]),
            },
        },
        "projects": projects,
        "entities": entities_list,
        "relationships": relationships,
        "causal_chains": causal_chains,
        "bridges": bridges,
        "similar_pairs": graph_data["similar_pairs"],
    }


# ---------------------------------------------------------------------------
# Build embeddings.json
# ---------------------------------------------------------------------------

def build_embeddings_json(graph_data):
    """Build the raw embeddings file for vector search apps."""
    embeddings = []
    seen = set()
    for e in graph_data["entity_embeddings"] + graph_data["project_embeddings"]:
        if e["name"] not in seen and e.get("embedding"):
            seen.add(e["name"])
            embeddings.append({
                "name": e["name"],
                "type": e["type"],
                "embedding": e["embedding"],
                "dimensions": len(e["embedding"]),
            })
    return {
        "model": "all-MiniLM-L6-v2",
        "dimensions": 384,
        "count": len(embeddings),
        "embeddings": embeddings,
    }


# ---------------------------------------------------------------------------
# Build README.md
# ---------------------------------------------------------------------------

def build_readme(graph_json):
    """Generate a human-readable README for the export."""
    meta = graph_json["meta"]
    lines = [
        f"# {meta['collection']}",
        "",
        f"Exported from MemoryTonic on {meta['exported_at'][:10]}",
        "",
        f"## Stats",
        f"- **{meta['stats']['projects']}** projects",
        f"- **{meta['stats']['entities']}** entities",
        f"- **{meta['stats']['relationships']}** relationships",
        f"- **{meta['stats']['causal_chains']}** causal chains",
        f"- **{meta['stats']['bridges']}** bridge entities (cross-project)",
        "",
        "## Projects",
    ]
    for p in graph_json["projects"]:
        lines.append(f"### {p['name']}")
        lines.append(f"**{p.get('domain', '')}** / {p.get('subdomain', '')}")
        lines.append("")
        summary = p.get("summary", "")
        if len(summary) > 300:
            summary = summary[:300] + "..."
        lines.append(summary)
        lines.append("")

    lines.extend([
        "## Bridge Entities (cross-project connections)",
        "",
        "| Entity | Category | Projects | Tier |",
        "|--------|----------|----------|------|",
    ])
    for b in graph_json["bridges"][:15]:
        lines.append(f"| {b['name']} | {b['category']} | {b['projects']} | {b['tier']} |")

    lines.extend([
        "",
        "## Files",
        "- `graph.json` — Complete knowledge graph (agent-readable, no database needed)",
        "- `embeddings.json` — Raw 384d BERT vectors for vector search",
        "- `manifest.json` — Export metadata and checksums",
        "- `projects/<name>/source.html` — Full styled source documents",
        "- `projects/<name>/extraction.json` — Raw extraction artifacts",
        "",
        "## For AI Agents",
        "Load `graph.json` to reason over this collection. No database required.",
        "Entities, relationships, causal chains, bridges, and similarity pairs are all included.",
        "For the full source text, read the HTML files in `projects/`.",
    ])
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Find source files on disk
# ---------------------------------------------------------------------------

def find_project_files(html_path):
    """Find HTML and extraction files for a project on disk.

    Args:
        html_path: The htmlPath from Neo4j (e.g. "data/sources/2026-04-05/petrodollar-system/01_html.html")
    """
    html_file = None
    extraction_file = None

    # Extract the project slug from htmlPath
    # Format: data/sources/YYYY-MM-DD/<slug>/01_html.html
    slug = None
    if html_path:
        parts = html_path.replace("\\", "/").split("/")
        # slug is the second-to-last part
        if len(parts) >= 2:
            slug = parts[-2]

        if any(part in ('.', '..') for part in parts) or not slug or '/' in slug or '\\' in slug:
            return {"html": None, "extraction": None, "slug": None}
        # Canonical graph artifacts are repo-relative; legacy source paths are
        # relative to the pipeline. Never choose a different project's document.
        repository_root = Path(BASE_DIR).resolve().parents[1]
        root = repository_root if parts[0] == 'graphs' else Path(BASE_DIR).resolve()
        allowed_root = repository_root / 'graphs' if parts[0] == 'graphs' else Path(SOURCES_DIR).resolve()
        candidate = (root / html_path.replace('\\', '/')).resolve()
        if candidate.is_relative_to(allowed_root.resolve()) and candidate.is_file():
            html_file = str(candidate)
            extraction_candidate = candidate.parent / '06_extraction.json'
            if extraction_candidate.is_file():
                extraction_file = str(extraction_candidate)

    # Find extraction dir using slug
    if slug and not extraction_file:
        extraction_dir = os.path.join(EXTRACTED_DIR, slug)
        if os.path.isdir(extraction_dir):
            candidate = os.path.join(extraction_dir, "06_extraction.json")
            if os.path.isfile(candidate):
                extraction_file = candidate
            # Fallback: check extracted dir for HTML too
            if not html_file:
                candidate = os.path.join(extraction_dir, "01_html.html")
                if os.path.isfile(candidate):
                    html_file = candidate

    return {"html": html_file, "extraction": extraction_file, "slug": slug}


# ---------------------------------------------------------------------------
# Write export
# ---------------------------------------------------------------------------

def enrich_causal_chains(graph_json, project_files):
    """Fill in causal chain links from extraction files on disk.

    Neo4j stores chain metadata but not link details.
    The full link data lives in each project's 06_extraction.json.
    """
    for slug, files in project_files.items():
        ext_path = files.get("extraction")
        if not ext_path or not os.path.isfile(ext_path):
            continue
        try:
            with open(ext_path, "r", encoding="utf-8") as f:
                extraction = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue

        chains = extraction.get("causal_chains", [])
        for cc in chains:
            name = cc.get("name")
            project = extraction.get('project', {})
            for exported_chain in graph_json['causal_chains']:
                if exported_chain['name'] != name:
                    continue
                if exported_chain.get('projectUniqueId'):
                    if exported_chain['projectUniqueId'] != project.get('unique_id'):
                        continue
                elif exported_chain.get('project') != project.get('name'):
                    continue
                links = cc.get("links", [])
                exported_chain["links"] = [
                    {
                        "source": l.get("source", ""),
                        "target": l.get("target", ""),
                        "explanation": l.get("explanation", ""),
                    }
                    for l in links
                ]


def write_zip(output_path, graph_json, embeddings_json, readme, project_files):
    """Write the complete ZIP export."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Compute checksums
    graph_bytes = json.dumps(graph_json, indent=2).encode("utf-8")
    embed_bytes = json.dumps(embeddings_json, indent=2).encode("utf-8")

    manifest = {
        "format": "memorytonic-collection-export",
        "schema_version": "1.0",
        "exported_at": graph_json["meta"]["exported_at"],
        "collection": graph_json["meta"]["collection"],
        "checksums": {
            "graph.json": hashlib.sha256(graph_bytes).hexdigest(),
            "embeddings.json": hashlib.sha256(embed_bytes).hexdigest(),
        },
        "files": ["graph.json", "embeddings.json", "manifest.json", "README.md"],
        "missing_sources": [slug for slug, files in project_files.items() if not files.get('html')],
    }

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("graph.json", graph_bytes)
        zf.writestr("embeddings.json", embed_bytes)
        zf.writestr("README.md", readme)

        # Add project files
        for slug, files in project_files.items():
            if files.get("html") and os.path.isfile(files["html"]):
                zf.write(files["html"], f"projects/{slug}/source.html")
                manifest["files"].append(f"projects/{slug}/source.html")
            if files.get("extraction") and os.path.isfile(files["extraction"]):
                zf.write(files["extraction"], f"projects/{slug}/extraction.json")
                manifest["files"].append(f"projects/{slug}/extraction.json")

        zf.writestr("manifest.json", json.dumps(manifest, indent=2))

    return manifest


def write_json_only(output_path, graph_json):
    """Write just graph.json to disk."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(graph_json, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = sys.argv[1:]

    if not args or args[0] in ("-h", "--help"):
        print("Usage: python neo4j/export_collection.py <collection-name> [flags]")
        print("")
        print("Flags:")
        print("  --list           List all collections")
        print("  --json-only      Output graph.json only (no ZIP, no HTMLs)")
        print("  --no-embeddings  Skip raw embedding vectors in export")
        print("  --output <path>  Custom output path")
        sys.exit(0)

    if args[0] == "--list":
        check_connection()
        colls = list_collections()
        if not colls:
            print("No collections found.")
            return
        print(f"\n{'Name':<40} {'ID':<20} {'Projects':>8}")
        print("-" * 70)
        for c in colls:
            print(f"{c['name']:<40} {c['id']:<20} {c['projects']:>8}")
        return

    collection_name = args[0]
    json_only = "--json-only" in args
    no_embeddings = "--no-embeddings" in args
    custom_output = None
    if "--output" in args:
        idx = args.index("--output")
        if idx + 1 < len(args):
            custom_output = args[idx + 1]

    # Connect and find collection
    check_connection()
    collection = find_collection(collection_name)
    if not collection:
        print(f"[ERROR] Collection not found: '{collection_name}'")
        print("Available collections:")
        for c in list_collections():
            print(f"  - {c['name']}")
        sys.exit(1)

    print(f"[OK] Found collection: {collection['name']} ({collection['id']})")

    # Pull graph from Neo4j
    print("[...] Pulling collection graph from Neo4j...")
    graph_data = pull_collection_graph(collection_name)

    print(f"  Projects:      {len(graph_data['projects'])}")
    print(f"  Entities:      {len(graph_data['entities'])}")
    print(f"  Relationships: {len(graph_data['relationships'])}")
    print(f"  Causal chains: {len(graph_data['causal_chains'])}")
    print(f"  Similar pairs: {len(graph_data['similar_pairs'])}")
    print(f"  Embeddings:    {len(graph_data['entity_embeddings']) + len(graph_data['project_embeddings'])}")

    # Build graph.json
    print("[...] Building graph.json...")
    graph_json = build_graph_json(collection, graph_data)

    slug = slugify(collection_name)

    # Find project files on disk (needed for both ZIP and json-only — causal chain links)
    print("[...] Locating source files on disk...")
    project_files = {}
    for p in graph_data["projects"]:
        files = find_project_files(p.get("htmlPath") or "")
        s = files.get("slug") or slugify(p["name"])
        project_files[s] = files
        html_ok = "OK" if files.get("html") else "MISSING"
        ext_ok = "OK" if files.get("extraction") else "MISSING"
        print(f"  {s}: html={html_ok}, extraction={ext_ok}")

    # Enrich causal chains from extraction files
    print("[...] Enriching causal chain links from extraction files...")
    enrich_causal_chains(graph_json, project_files)
    chains_with_links = sum(1 for cc in graph_json["causal_chains"] if cc["links"])
    total_links = sum(len(cc["links"]) for cc in graph_json["causal_chains"])
    print(f"  {chains_with_links}/{len(graph_json['causal_chains'])} chains enriched, {total_links} total links")

    if json_only:
        output_path = custom_output or os.path.join(EXPORTS_DIR, f"{slug}.json")
        write_json_only(output_path, graph_json)
        size_kb = os.path.getsize(output_path) / 1024
        print(f"\n[DONE] graph.json written: {output_path} ({size_kb:.0f} KB)")
        return

    # Build embeddings
    embeddings_json = {"model": "none", "dimensions": 0, "count": 0, "embeddings": []}
    if not no_embeddings:
        print("[...] Building embeddings.json...")
        embeddings_json = build_embeddings_json(graph_data)
        print(f"  Vectors: {embeddings_json['count']}")

    # Build README
    readme = build_readme(graph_json)

    # Write ZIP
    output_path = custom_output or os.path.join(EXPORTS_DIR, f"{slug}.zip")
    print(f"[...] Writing export to {output_path}...")
    manifest = write_zip(output_path, graph_json, embeddings_json, readme, project_files)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\n[DONE] Export complete: {output_path}")
    print(f"  Size: {size_mb:.1f} MB")
    print(f"  Files: {len(manifest['files'])}")
    print(f"  Graph: {graph_json['meta']['stats']['entities']} entities, "
          f"{graph_json['meta']['stats']['relationships']} relationships, "
          f"{graph_json['meta']['stats']['causal_chains']} chains")


if __name__ == "__main__":
    main()
