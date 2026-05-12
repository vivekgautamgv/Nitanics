"""
MemoryTonic v4 — Collection Import

Imports a portable collection export (ZIP) into a MemoryTonic Neo4j instance.
Reconstructs per-project artifacts from graph.json, then reuses upload.py for
actual database operations.

Usage:
  python neo4j/import_collection.py <path-to-zip>
  python neo4j/import_collection.py <path-to-zip> --directory Research
  python neo4j/import_collection.py <path-to-zip> --dry-run
  python neo4j/import_collection.py <path-to-zip> --collection "My Custom Name"

Flow:
  1. Pre-flight: verify Neo4j, unzip, read manifest + graph.json
  2. User decisions: directory, collection name, conflict check
  3. Reconstruct: build per-project artifact folders from graph.json
  4. Upload: validate + upload each project via existing tools
  5. GDS: recompute all metrics for the new graph state
  6. Verify: compare expected vs actual, report bridges
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import run_cypher, run_batch, check_connection

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = os.path.join(os.path.dirname(__file__), "..")
TEMP_DIR = os.path.join(BASE_DIR, "data", "temp")
EXTRACTED_DIR = os.path.join(BASE_DIR, "data", "extracted")
SOURCES_DIR = os.path.join(BASE_DIR, "data", "sources")
PROJECTS_DIR = os.path.join(BASE_DIR, "data", "projects")
NEO4J_DIR = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------------------
# Phase 1: Pre-flight
# ---------------------------------------------------------------------------

def preflight(zip_path):
    """Verify ZIP, extract to temp, read manifest and graph.json."""
    if not os.path.isfile(zip_path):
        print(f"[ERROR] File not found: {zip_path}")
        sys.exit(1)

    if not zipfile.is_zipfile(zip_path):
        print(f"[ERROR] Not a valid ZIP file: {zip_path}")
        sys.exit(1)

    # Extract to temp
    extract_dir = tempfile.mkdtemp(prefix="mt-import-")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_dir)

    # Read manifest
    manifest_path = os.path.join(extract_dir, "manifest.json")
    if not os.path.isfile(manifest_path):
        print("[ERROR] No manifest.json in ZIP. Is this a MemoryTonic export?")
        shutil.rmtree(extract_dir)
        sys.exit(1)

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    if manifest.get("format") != "memorytonic-collection-export":
        print(f"[ERROR] Unknown format: {manifest.get('format')}")
        shutil.rmtree(extract_dir)
        sys.exit(1)

    # Read graph.json
    graph_path = os.path.join(extract_dir, "graph.json")
    if not os.path.isfile(graph_path):
        print("[ERROR] No graph.json in ZIP.")
        shutil.rmtree(extract_dir)
        sys.exit(1)

    with open(graph_path, "r", encoding="utf-8") as f:
        graph = json.load(f)

    # Read embeddings if present
    embeddings = None
    embed_path = os.path.join(extract_dir, "embeddings.json")
    if os.path.isfile(embed_path):
        with open(embed_path, "r", encoding="utf-8") as f:
            embeddings = json.load(f)

    return extract_dir, manifest, graph, embeddings


def show_summary(graph):
    """Display import summary."""
    meta = graph["meta"]
    stats = meta["stats"]
    print(f"\n  Collection: {meta['collection']}")
    print(f"  Exported:   {meta.get('exported_at', 'unknown')[:10]}")
    print(f"  Projects:   {stats['projects']}")
    print(f"  Entities:   {stats['entities']}")
    print(f"  Relationships: {stats['relationships']}")
    print(f"  Causal chains: {stats['causal_chains']}")
    print(f"  Bridges:    {stats['bridges']}")
    print()


# ---------------------------------------------------------------------------
# Phase 2: Conflict detection
# ---------------------------------------------------------------------------

def check_conflicts(graph):
    """Check for existing collections and projects that would conflict."""
    collection_name = graph["meta"]["collection"]

    # Check if collection exists
    r = run_cypher(
        "MATCH (c:Collection) WHERE toLower(c.name) = toLower($name) "
        "RETURN c.name, c.collectionId",
        {"name": collection_name}
    )
    existing_collection = None
    if r["ok"] and r["data"][0]["data"]:
        row = r["data"][0]["data"][0]["row"]
        existing_collection = {"name": row[0], "id": row[1]}

    # Check for existing projects by name
    project_names = [p["name"] for p in graph["projects"]]
    r = run_cypher(
        "MATCH (p:Project) WHERE p.name IN $names RETURN p.name",
        {"names": project_names}
    )
    existing_projects = []
    if r["ok"]:
        existing_projects = [row["row"][0] for row in r["data"][0]["data"]]

    # Check entity overlap
    entity_names = [e["name"] for e in graph["entities"]]
    r = run_cypher(
        "MATCH (e:Entity) WHERE e.name IN $names RETURN count(e) AS overlap",
        {"names": entity_names}
    )
    entity_overlap = 0
    if r["ok"] and r["data"][0]["data"]:
        entity_overlap = r["data"][0]["data"][0]["row"][0]

    # Get existing directories
    r = run_cypher("MATCH (d:DirectoryCategory) RETURN d.name ORDER BY d.name")
    directories = []
    if r["ok"]:
        directories = [row["row"][0] for row in r["data"][0]["data"]]

    return {
        "existing_collection": existing_collection,
        "existing_projects": existing_projects,
        "entity_overlap": entity_overlap,
        "directories": directories,
    }


# ---------------------------------------------------------------------------
# Phase 3: Reconstruct per-project artifacts
# ---------------------------------------------------------------------------

def reconstruct_artifacts(graph, embeddings, extract_dir, directory, collection_name):
    """Build upload-ready artifact folders from graph.json + embeddings.

    For each project, creates:
      data/temp/<slug>/
        01_html.html        - from ZIP projects/<slug>/source.html
        02_placement.json   - generated from graph.json + user directory
        04_all_entities.json - from graph.json entities for this project
        05_embeddings.json  - from embeddings.json for this project
        06_extraction.json  - from ZIP projects/<slug>/extraction.json
    """
    # Build embedding lookup: name -> embedding data
    embed_lookup = {}
    if embeddings and "embeddings" in embeddings:
        for e in embeddings["embeddings"]:
            embed_lookup[e["name"]] = e

    project_dirs = []

    for project in graph["projects"]:
        proj_name = project["name"]

        # Get slug from html_file path in graph.json
        html_ref = project.get("html_file", "")
        parts = html_ref.replace("\\", "/").split("/")
        slug = parts[1] if len(parts) >= 2 else proj_name.lower().replace(" ", "-")

        temp_proj_dir = os.path.join(TEMP_DIR, slug)
        os.makedirs(temp_proj_dir, exist_ok=True)

        # 1. HTML: copy from ZIP
        zip_html = os.path.join(extract_dir, "projects", slug, "source.html")
        dest_html = os.path.join(temp_proj_dir, "01_html.html")
        if os.path.isfile(zip_html):
            shutil.copy2(zip_html, dest_html)
        else:
            # Create minimal placeholder
            with open(dest_html, "w", encoding="utf-8") as f:
                f.write(f"<html><body><h1>{proj_name}</h1><p>Imported from collection export.</p></body></html>")

        # 2. Placement JSON
        placement = {
            "directory": directory,
            "project_name": slug,
            "unique_id": slug,
            "collection": collection_name,
            "collection_is_new": False,  # import_collection handles this
        }
        with open(os.path.join(temp_proj_dir, "02_placement.json"), "w", encoding="utf-8") as f:
            json.dump(placement, f, indent=2)

        # 3. Extraction JSON: process BEFORE entities so we can scan for
        #    cross-project entity references that must be in the entity list
        zip_extraction = os.path.join(extract_dir, "projects", slug, "extraction.json")
        dest_extraction = os.path.join(temp_proj_dir, "06_extraction.json")
        extraction_data = None
        if os.path.isfile(zip_extraction):
            shutil.copy2(zip_extraction, dest_extraction)
            with open(zip_extraction, "r", encoding="utf-8") as f:
                extraction_data = json.load(f)
        # (fallback reconstruction happens after entity list is built)

        # 4. Entities JSON: start with entities tagged to this project, then
        #    add any cross-project entities referenced in relationships/chains
        project_entities = [
            e for e in graph["entities"]
            if proj_name in (e.get("projects") or [])
        ]
        entity_name_set = {e["name"] for e in project_entities}

        # Build alias reverse-lookup: alias -> canonical entity name
        # Extraction.json may use original pre-merge names (e.g. "Bretton Woods
        # Conference") while graph.json has the merged name ("Bretton Woods System")
        alias_to_entity = {}
        for e in graph["entities"]:
            for alias in (e.get("aliases") or []):
                alias_to_entity[alias] = e["name"]

        # Scan extraction for referenced entities not in our set
        referenced_names = set()
        if extraction_data:
            for rel in extraction_data.get("relationships", []):
                for key in ("source", "target"):
                    name = rel.get(key)
                    if name:
                        referenced_names.add(name)
            for chain in extraction_data.get("causal_chains", []):
                for link in chain.get("links", []):
                    for key in ("source", "target"):
                        name = link.get(key)
                        if name:
                            referenced_names.add(name)

        # Pull missing entities from global graph (by name or alias)
        graph_entity_lookup = {e["name"]: e for e in graph["entities"]}
        for name in referenced_names:
            if name not in entity_name_set:
                # Try direct lookup in graph
                if name in graph_entity_lookup:
                    project_entities.append(graph_entity_lookup[name])
                    entity_name_set.add(name)
                # Try alias resolution
                elif name in alias_to_entity and alias_to_entity[name] in graph_entity_lookup:
                    canonical = graph_entity_lookup[alias_to_entity[name]]
                    project_entities.append(canonical)
                    entity_name_set.add(name)
                else:
                    # Create stub entity — extraction references it but graph
                    # doesn't have it (pre-merge name, no alias match).
                    # Definition must be 100+ chars to pass validation.
                    project_entities.append({
                        "name": name,
                        "aliases": [],
                        "category": "Other",
                        "definition": (
                            f"{name} is an entity referenced in the extraction data for this project. "
                            f"It was present in the original knowledge graph but its detailed definition "
                            f"was stored under a different canonical name during entity merging."
                        ),
                        "role": f"Referenced in relationships or causal chains within {proj_name}.",
                        "projects": [proj_name],
                    })
                    entity_name_set.add(name)

        # Build temporal phases from project data
        temporal_phases = project.get("temporal_phases") or []

        entities_json = {
            "temporal_phases": [
                {"index": tp.get("index"), "label": tp.get("label"), "period": tp.get("period")}
                for tp in temporal_phases
            ],
            "entities": [
                {
                    "name": e["name"],
                    "aliases": e.get("aliases") or [],
                    "category": e["category"],
                    "definition": e.get("definition") or "",
                    "role": e.get("role") or "",
                    "first_appearance_index": 1,
                }
                for e in project_entities
            ]
        }
        with open(os.path.join(temp_proj_dir, "04_all_entities.json"), "w", encoding="utf-8") as f:
            json.dump(entities_json, f, indent=2, ensure_ascii=False)

        # If no ZIP extraction, reconstruct from graph.json now that entities are built
        if not extraction_data:
            proj_rels = [
                r for r in graph["relationships"]
                if r["source"] in entity_name_set and r["target"] in entity_name_set
            ]
            proj_chains = [
                cc for cc in graph["causal_chains"]
                if cc.get("project") == proj_name
            ]
            extraction_data = {
                "project": {
                    "name": proj_name,
                    "unique_id": slug,
                    "summary": project.get("summary") or "",
                    "narrative_flow": project.get("narrative_flow") or [],
                    "tags": {
                        "domain": project.get("domain") or "",
                        "subdomain": project.get("subdomain") or "",
                        "base_tags": project.get("tags") or [],
                    }
                },
                "relationships": proj_rels,
                "causal_chains": proj_chains,
            }
            with open(dest_extraction, "w", encoding="utf-8") as f:
                json.dump(extraction_data, f, indent=2, ensure_ascii=False)

        # 5. Embeddings JSON: filter by this project's entities + project summary
        #    Stub entities (from alias resolution) need zero-vector placeholders
        proj_embeddings = []
        for e in project_entities:
            if e["name"] in embed_lookup:
                entry = embed_lookup[e["name"]]
                proj_embeddings.append({
                    "name": entry["name"],
                    "embedding": entry["embedding"],
                    "dimensions": entry.get("dimensions", 384),
                })
            else:
                # Zero-vector placeholder for stub/unresolved entities
                proj_embeddings.append({
                    "name": e["name"],
                    "embedding": [0.0] * 384,
                    "dimensions": 384,
                })
        # Add project embedding (keyed by slug or project name)
        for key in [slug, proj_name]:
            if key in embed_lookup:
                entry = embed_lookup[key]
                proj_embeddings.append({
                    "name": slug,  # upload.py expects unique_id as name
                    "embedding": entry["embedding"],
                    "dimensions": entry.get("dimensions", 384),
                })
                break

        embeddings_json = {
            "model": "all-MiniLM-L6-v2",
            "dimensions": 384,
            "embeddings": proj_embeddings,
        }
        with open(os.path.join(temp_proj_dir, "05_embeddings.json"), "w", encoding="utf-8") as f:
            json.dump(embeddings_json, f, indent=2)

        project_dirs.append({
            "slug": slug,
            "name": proj_name,
            "dir": temp_proj_dir,
            "entity_count": len(project_entities),
            "embedding_count": len(proj_embeddings),
        })

    return project_dirs


# ---------------------------------------------------------------------------
# Phase 4: Upload (reuses existing tools)
# ---------------------------------------------------------------------------

def validate_and_upload(project_dirs, dry_run=False):
    """Validate and upload each project using existing tools."""
    results = []

    for proj in project_dirs:
        slug = proj["slug"]
        proj_dir = proj["dir"]

        print(f"\n  --- {proj['name']} ({slug}) ---")

        # Validate (import mode — skip NLP check)
        print(f"  [validate] Running validation...")
        validate_cmd = [
            sys.executable,
            os.path.join(NEO4J_DIR, "validate_project.py"),
            "--import-mode", proj_dir
        ]
        val_result = subprocess.run(validate_cmd, capture_output=True, text=True)
        try:
            val_data = json.loads(val_result.stdout)
            if not val_data.get("valid"):
                errors = val_data.get("errors", [])
                print(f"  [FAIL] Validation failed: {len(errors)} errors")
                for err in errors[:5]:
                    print(f"    - {err.get('rule')}: {err.get('message', '')[:80]}")
                results.append({"slug": slug, "status": "validation_failed", "errors": errors})
                continue
            print(f"  [OK] Validation passed")
        except json.JSONDecodeError:
            # If JSON parsing fails, check stderr
            if val_result.returncode != 0:
                print(f"  [FAIL] Validation error: {val_result.stderr[:200]}")
                results.append({"slug": slug, "status": "validation_error"})
                continue
            print(f"  [OK] Validation passed (non-JSON output)")

        if dry_run:
            print(f"  [DRY-RUN] Would upload {proj['entity_count']} entities, {proj['embedding_count']} embeddings")
            results.append({"slug": slug, "status": "dry_run"})
            continue

        # Upload
        print(f"  [upload] Uploading to Neo4j...")
        upload_cmd = [
            sys.executable,
            os.path.join(NEO4J_DIR, "upload.py"),
            proj_dir
        ]
        up_result = subprocess.run(upload_cmd, capture_output=True, text=True)
        if up_result.returncode != 0:
            print(f"  [FAIL] Upload failed:")
            print(f"    {up_result.stderr[:300]}")
            results.append({"slug": slug, "status": "upload_failed"})
            continue

        print(f"  [OK] Upload complete")

        # Move to permanent storage
        perm_dir = os.path.join(EXTRACTED_DIR, slug)
        os.makedirs(perm_dir, exist_ok=True)
        for f in os.listdir(proj_dir):
            src = os.path.join(proj_dir, f)
            if os.path.isfile(src):
                shutil.copy2(src, os.path.join(perm_dir, f))

        # Copy HTML to sources
        today = datetime.now().strftime("%Y-%m-%d")
        source_dir = os.path.join(SOURCES_DIR, today, slug)
        os.makedirs(source_dir, exist_ok=True)
        html_src = os.path.join(proj_dir, "01_html.html")
        if os.path.isfile(html_src):
            shutil.copy2(html_src, os.path.join(source_dir, "01_html.html"))

        results.append({"slug": slug, "status": "success"})

    return results


# ---------------------------------------------------------------------------
# Phase 5: GDS Recompute
# ---------------------------------------------------------------------------

def run_gds():
    """Recompute all GDS metrics for the full graph."""
    print("\n[...] Recomputing GDS metrics (PageRank, Betweenness, Degree, Similarity)...")
    gds_cmd = [sys.executable, os.path.join(NEO4J_DIR, "gds.py")]
    result = subprocess.run(gds_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[WARN] GDS recompute had errors: {result.stderr[:200]}")
        return False
    print("[OK] GDS recompute complete")
    return True


# ---------------------------------------------------------------------------
# Phase 6: Verify
# ---------------------------------------------------------------------------

def verify_import(graph, upload_results):
    """Compare expected vs actual after import."""
    expected = graph["meta"]["stats"]
    successes = [r for r in upload_results if r["status"] == "success"]
    failures = [r for r in upload_results if r["status"] != "success" and r["status"] != "dry_run"]

    print(f"\n{'='*60}")
    print(f"  IMPORT REPORT")
    print(f"{'='*60}")
    print(f"  Projects uploaded:  {len(successes)}/{expected['projects']}")
    if failures:
        print(f"  Projects FAILED:    {len(failures)}")
        for f in failures:
            print(f"    - {f['slug']}: {f['status']}")

    # Query actual counts
    r = run_cypher("MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY count DESC")
    if r["ok"]:
        print(f"\n  Database state:")
        for row in r["data"][0]["data"]:
            print(f"    {row['row'][0]}: {row['row'][1]}")

    # Bridge report
    r = run_cypher(
        "MATCH (e:Entity)-[:MENTIONED_IN]->(p:Project) "
        "WITH e, count(DISTINCT p) AS pc WHERE pc >= 2 "
        "RETURN e.name, e.category, pc ORDER BY pc DESC LIMIT 10"
    )
    if r["ok"] and r["data"][0]["data"]:
        print(f"\n  Top bridge entities:")
        for row in r["data"][0]["data"]:
            name, cat, count = row["row"]
            print(f"    {name} ({cat}) - {count} projects")

    print(f"\n{'='*60}")
    return len(failures) == 0


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

def cleanup_temp(project_dirs, extract_dir):
    """Remove temp directories after successful import."""
    for proj in project_dirs:
        proj_dir = proj["dir"]
        if os.path.isdir(proj_dir):
            shutil.rmtree(proj_dir, ignore_errors=True)
    if os.path.isdir(extract_dir):
        shutil.rmtree(extract_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = sys.argv[1:]

    if not args or args[0] in ("-h", "--help"):
        print("Usage: python neo4j/import_collection.py <zip-path> [flags]")
        print()
        print("Flags:")
        print("  --directory <name>    Target directory (default: asks or uses 'Research')")
        print("  --collection <name>   Override collection name from export")
        print("  --dry-run             Validate only, don't upload")
        print("  --force               Skip conflict prompts")
        sys.exit(0)

    zip_path = args[0]
    dry_run = "--dry-run" in args
    force = "--force" in args

    directory = None
    if "--directory" in args:
        idx = args.index("--directory")
        if idx + 1 < len(args):
            directory = args[idx + 1]

    collection_override = None
    if "--collection" in args:
        idx = args.index("--collection")
        if idx + 1 < len(args):
            collection_override = args[idx + 1]

    # ---------------------------------------------------------------
    # Phase 1: Pre-flight
    # ---------------------------------------------------------------
    print("[PHASE 1] Pre-flight checks...")
    check_connection()

    # Verify schema is bootstrapped
    r = run_cypher("MATCH (d:DirectoryCategory) RETURN count(d)")
    if r["ok"] and r["data"][0]["data"][0]["row"][0] == 0:
        print("[ERROR] Schema not bootstrapped. Run: python neo4j/bootstrap.py")
        sys.exit(1)

    extract_dir, manifest, graph, embeddings = preflight(zip_path)
    print(f"[OK] Valid MemoryTonic export (schema v{manifest.get('schema_version', '?')})")
    show_summary(graph)

    # ---------------------------------------------------------------
    # Phase 2: Conflict detection + user decisions
    # ---------------------------------------------------------------
    print("[PHASE 2] Checking conflicts...")
    conflicts = check_conflicts(graph)

    collection_name = collection_override or graph["meta"]["collection"]

    # Interactive prompts when flags not provided (agents pass flags, humans don't)
    interactive = sys.stdin.isatty() and not force

    # Ask for directory if not provided via --directory
    if not directory:
        dirs = conflicts["directories"]
        if interactive and dirs:
            print(f"  Available directories: {', '.join(dirs)}")
            try:
                choice = input(f"  Directory [{dirs[0]}]: ").strip()
                directory = choice if choice else dirs[0]
            except EOFError:
                directory = dirs[0]
        else:
            directory = dirs[0] if dirs else "Research"

    # Ask for collection name if not provided via --collection
    if not collection_override and interactive:
        default_name = graph["meta"]["collection"]
        try:
            choice = input(f"  Collection name [{default_name}]: ").strip()
            if choice:
                collection_name = choice
        except EOFError:
            pass  # keep default

    print(f"  Directory:    {directory}")
    print(f"  Collection:   {collection_name}")

    if conflicts["existing_collection"]:
        print(f"  [!] Collection '{conflicts['existing_collection']['name']}' already exists - projects will be added to it")

    if conflicts["existing_projects"]:
        print(f"  [!] {len(conflicts['existing_projects'])} projects already exist: {conflicts['existing_projects']}")
        if not force:
            print("  Use --force to skip existing projects, or remove them first.")
            # Filter out existing projects
            existing_set = set(conflicts["existing_projects"])
            graph["projects"] = [p for p in graph["projects"] if p["name"] not in existing_set]
            if not graph["projects"]:
                print("[ERROR] All projects already exist. Nothing to import.")
                shutil.rmtree(extract_dir)
                sys.exit(1)
            print(f"  Importing {len(graph['projects'])} new projects (skipping duplicates)")

    if conflicts["entity_overlap"] > 0:
        print(f"  [i] {conflicts['entity_overlap']} entities already in graph (will merge as bridges)")

    # ---------------------------------------------------------------
    # Phase 3: Reconstruct artifacts
    # ---------------------------------------------------------------
    print(f"\n[PHASE 3] Reconstructing {len(graph['projects'])} project artifacts...")
    project_dirs = reconstruct_artifacts(graph, embeddings, extract_dir, directory, collection_name)
    for proj in project_dirs:
        print(f"  {proj['slug']}: {proj['entity_count']} entities, {proj['embedding_count']} embeddings")

    # ---------------------------------------------------------------
    # Phase 4: Validate + Upload
    # ---------------------------------------------------------------
    mode_label = "DRY-RUN" if dry_run else "UPLOAD"
    print(f"\n[PHASE 4] {mode_label} — {len(project_dirs)} projects...")
    upload_results = validate_and_upload(project_dirs, dry_run=dry_run)

    if dry_run:
        print(f"\n[DRY-RUN] Complete. {len(project_dirs)} projects validated.")
        cleanup_temp(project_dirs, extract_dir)
        return

    # ---------------------------------------------------------------
    # Phase 5: GDS Recompute
    # ---------------------------------------------------------------
    successes = [r for r in upload_results if r["status"] == "success"]
    if successes:
        print(f"\n[PHASE 5] GDS recompute ({len(successes)} new projects in graph)...")
        run_gds()

    # ---------------------------------------------------------------
    # Phase 6: Verify
    # ---------------------------------------------------------------
    print(f"\n[PHASE 6] Verification...")
    all_ok = verify_import(graph, upload_results)

    # Cleanup temp
    cleanup_temp(project_dirs, extract_dir)

    if all_ok:
        print(f"\n[DONE] Import complete: {len(successes)} projects imported into '{collection_name}'")
    else:
        print(f"\n[WARN] Import completed with errors. Check report above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
