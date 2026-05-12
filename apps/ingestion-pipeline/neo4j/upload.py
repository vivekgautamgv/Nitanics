"""
MemoryTonic v4 — Neo4j Upload

Uploads extraction artifacts to Neo4j. Creates all nodes, relationships,
and embeddings from the extraction pipeline output.

Usage:
  python neo4j/upload.py <project-dir>

  project-dir: path to extraction folder containing:
    - 02_placement.json
    - 04_all_entities.json
    - 05_embeddings.json
    - 06_extraction.json

Connection: neo4j://127.0.0.1:7687 (database: memorytonic)

All writes are batched — multiple Cypher statements per HTTP request.
Typical upload: ~7 HTTP calls total regardless of entity/relationship count.
"""

import sys
import os
import json
import uuid
from datetime import datetime

from db import run_cypher, run_batch, check_connection


def load_artifacts(project_dir):
    """Load all extraction artifacts from project directory."""
    files = {
        "placement": os.path.join(project_dir, "02_placement.json"),
        "entities": os.path.join(project_dir, "04_all_entities.json"),
        "embeddings": os.path.join(project_dir, "05_embeddings.json"),
        "extraction": os.path.join(project_dir, "06_extraction.json"),
    }
    artifacts = {}
    for name, path in files.items():
        if not os.path.exists(path):
            print(f"[ERROR] Missing artifact: {path}")
            sys.exit(1)
        with open(path, "r", encoding="utf-8") as f:
            artifacts[name] = json.load(f)
        print(f"  Loaded {name}: {os.path.basename(path)}")
    return artifacts


def generate_id(prefix=""):
    """Generate a unique ID."""
    short = uuid.uuid4().hex[:12]
    return f"{prefix}-{short}" if prefix else short


# ---------------------------------------------------------------
# Upload Steps (batched)
# ---------------------------------------------------------------

def create_scaffold(extraction, placement):
    """Create DateTime, Collection, Project nodes and all structural links.
    Single batch for all scaffold operations."""
    now = datetime.now()
    date_id = now.strftime("%Y-%m-%d")
    time_id = now.strftime("%Y-%m-%d-%H%M%S")
    project_id = generate_id("proj")
    project = extraction["project"]
    project_name = placement["project_name"]
    today = now.strftime("%Y-%m-%d")
    html_path = f"data/sources/{today}/{project_name}/01_html.html"

    # Phase 1: Create date + time + project, find/create collection (1 HTTP call)
    batch = [
        # DateTime: date
        ("""
        MERGE (d:DateTime {datetimeId: $dateId})
        SET d.date = $date, d.year = $year, d.month = $month, d.day = $day, d.type = 'date'
        RETURN d.datetimeId
        """, {"dateId": date_id, "date": date_id, "year": now.year, "month": now.month, "day": now.day}),
        # DateTime: time
        ("""
        MERGE (t:DateTime {datetimeId: $timeId})
        SET t.date = $date, t.time = $time, t.type = 'time'
        RETURN t.datetimeId
        """, {"timeId": time_id, "date": date_id, "time": now.strftime("%H:%M:%S")}),
        # Time -> Date link
        ("""
        MATCH (d:DateTime {datetimeId: $dateId}), (t:DateTime {datetimeId: $timeId})
        MERGE (t)-[:ON_DATE]->(d)
        """, {"dateId": date_id, "timeId": time_id}),
        # Project node
        ("""
        MERGE (p:Project {uniqueId: $uniqueId})
        ON CREATE SET 
            p.projectId = $projectId, p.name = $name, 
            p.summary = $summary, p.narrativeFlow = $narrativeFlow,
            p.domain = $domain, p.subdomain = $subdomain, p.baseTags = $baseTags,
            p.htmlPath = $htmlPath, p.directory = $directory, p.createdAt = datetime()
        ON MATCH SET
            p.name = $name, p.summary = $summary, p.narrativeFlow = $narrativeFlow,
            p.domain = $domain, p.subdomain = $subdomain, p.baseTags = $baseTags,
            p.htmlPath = $htmlPath, p.directory = $directory
        RETURN p.projectId
        """, {
            "projectId": project_id, "name": project["name"],
            "uniqueId": project["unique_id"], "summary": project["summary"],
            "narrativeFlow": project["narrative_flow"],
            "domain": project["tags"]["domain"], "subdomain": project["tags"]["subdomain"],
            "baseTags": project["tags"]["base_tags"], "htmlPath": html_path,
            "directory": placement["directory"],
        }),
    ]
    result = run_batch(batch)
    if not result["ok"]:
        return None, None, result["errors"]

    # Extract the actual projectId (in case of MERGE match, it's the old one)
    project_id = result["data"][3]["data"][0]["row"][0]


    print(f"  Date: {date_id}, Time: {time_id}")

    # Phase 2: Collection (may need lookup first)
    collection_name = placement["collection"]
    is_new = placement.get("collection_is_new", False)

    if is_new:
        collection_id = generate_id("col")
        r = run_cypher(
            "CREATE (c:Collection {collectionId: $cid, name: $name, createdAt: datetime()}) RETURN c.collectionId",
            {"cid": collection_id, "name": collection_name},
        )
        if not r["ok"]:
            return None, None, r["errors"]
        print(f"  Created collection: {collection_name} ({collection_id})")
    else:
        r = run_cypher(
            "MATCH (c:Collection {name: $name}) RETURN c.collectionId",
            {"name": collection_name},
        )
        if r["ok"] and r["data"][0]["data"]:
            collection_id = r["data"][0]["data"][0]["row"][0]
            print(f"  Found collection: {collection_name} ({collection_id})")
        else:
            collection_id = generate_id("col")
            run_cypher(
                "CREATE (c:Collection {collectionId: $cid, name: $name, createdAt: datetime()}) RETURN c.collectionId",
                {"cid": collection_id, "name": collection_name},
            )
            print(f"  Created collection (fallback): {collection_name} ({collection_id})")

    # Phase 3: All structural links (1 HTTP call)
    links = [
        ("MATCH (p:Project {projectId: $pid}), (d:DirectoryCategory {name: $dir}) MERGE (p)-[:IN_DIRECTORY]->(d)",
         {"pid": project_id, "dir": placement["directory"]}),
        ("MATCH (p:Project {projectId: $pid}), (d:DateTime {datetimeId: $did}) MERGE (p)-[:CREATED_ON]->(d)",
         {"pid": project_id, "did": date_id}),
        ("MATCH (p:Project {projectId: $pid}), (t:DateTime {datetimeId: $tid}) MERGE (p)-[:CREATED_AT]->(t)",
         {"pid": project_id, "tid": time_id}),
        ("MATCH (p:Project {projectId: $pid}), (c:Collection {collectionId: $cid}) MERGE (p)-[:BELONGS_TO]->(c)",
         {"pid": project_id, "cid": collection_id}),
    ]
    run_batch(links)

    print(f"  Project: {project_name} ({project_id})")
    return project_id, collection_id, None


def create_entity_nodes(entities_data, project_id):
    """Create or merge Entity nodes. Returns map of name -> entityId.

    3 HTTP calls total:
      1. Check all entities for existing matches
      2. Create new / increment existing
      3. Create all MENTIONED_IN links
    """
    entities = entities_data["entities"]
    entity_map = {}  # name -> entityId

    # --- Batch 1: Check all entities for existing matches (1 HTTP call) ---
    checks = []
    for entity in entities:
        checks.append((
            """
            OPTIONAL MATCH (e:Entity)
            WHERE e.name = $name
               OR $name IN e.aliases
               OR ANY(alias IN $aliases WHERE e.name = alias OR alias IN e.aliases)
            RETURN e.entityId, e.name
            LIMIT 1
            """,
            {"name": entity["name"], "aliases": entity.get("aliases", [])},
        ))
    check_result = run_batch(checks)
    if not check_result["ok"]:
        print(f"  [ERROR] Entity existence check: {check_result['errors']}")
        return entity_map

    # Parse results: which entities exist, which are new
    existing = {}  # index -> existing entityId
    for i, res in enumerate(check_result["data"]):
        if res["data"] and res["data"][0]["row"][0] is not None:
            existing[i] = res["data"][0]["row"][0]

    # --- Batch 2: Create new entities + increment existing (1 HTTP call) ---
    mutations = []
    for i, entity in enumerate(entities):
        name = entity["name"]
        if i in existing:
            # Merge: increment projectCount on existing entity
            eid = existing[i]
            entity_map[name] = eid
            mutations.append((
                "MATCH (e:Entity {entityId: $eid}) SET e.projectCount = coalesce(e.projectCount, 1) + 1",
                {"eid": eid},
            ))
        else:
            # Create new entity
            eid = generate_id("ent")
            entity_map[name] = eid
            aliases_text = ", ".join(entity.get("aliases", []))
            mutations.append((
                """
                CREATE (e:Entity {
                    entityId: $eid, name: $name, aliases: $aliases, aliases_text: $at,
                    category: $cat, definition: $def, role: $role,
                    firstAppearanceIndex: $fai, projectCount: 1, createdAt: datetime()
                })
                RETURN e.entityId
                """,
                {
                    "eid": eid, "name": name, "aliases": entity.get("aliases", []),
                    "at": aliases_text, "cat": entity["category"],
                    "def": entity["definition"], "role": entity["role"],
                    "fai": entity["first_appearance_index"],
                },
            ))

    mut_result = run_batch(mutations)
    if not mut_result["ok"]:
        print(f"  [ERROR] Entity creation: {mut_result['errors']}")

    # --- Batch 3: Create all MENTIONED_IN links (1 HTTP call) ---
    links = []
    for entity in entities:
        eid = entity_map.get(entity["name"])
        if not eid:
            continue
        links.append((
            """
            MATCH (e:Entity {entityId: $eid}), (p:Project {projectId: $pid})
            MERGE (e)-[:MENTIONED_IN {role: $role}]->(p)
            """,
            {"eid": eid, "pid": project_id, "role": entity["role"]},
        ))
    run_batch(links)

    return entity_map


def create_temporal_events(entities_data, project_id):
    """Create TemporalEvent nodes + links to project. 1 HTTP call total."""
    phases = entities_data.get("temporal_phases", [])
    if not phases:
        return

    batch = []
    for phase in phases:
        event_id = generate_id("evt")
        # Create event + link in one statement using WITH
        batch.append((
            """
            CREATE (te:TemporalEvent {
                eventId: $eid, projectId: $pid,
                phaseIndex: $idx, label: $label, period: $period
            })
            WITH te
            MATCH (p:Project {projectId: $pid})
            MERGE (te)-[:BELONGS_TO_PROJECT]->(p)
            """,
            {
                "eid": event_id, "pid": project_id,
                "idx": phase["index"], "label": phase["label"],
                "period": phase["period"],
            },
        ))
    result = run_batch(batch)
    if not result["ok"]:
        print(f"  [ERROR] Temporal events: {result['errors']}")


def create_relationships(extraction, entity_map, project_id):
    """Create RELATES_TO edges between entities. 1 HTTP call total."""
    rels = extraction.get("relationships", [])
    if not rels:
        return 0

    batch = []
    skipped = []
    for rel in rels:
        source_name = rel["source"]
        target_name = rel["target"]
        source_id = entity_map.get(source_name)
        target_id = entity_map.get(target_name)

        if not source_id or not target_id:
            skipped.append(f"{source_name} -> {target_name}")
            continue

        batch.append((
            """
            MATCH (a:Entity {entityId: $sid}), (b:Entity {entityId: $tid})
            CREATE (a)-[r:RELATES_TO {
                relType: $rt, causalClassification: $cc,
                description: $desc, evidence: $ev,
                evidenceStrength: $es, magnitude: $mag, year: $yr,
                projectId: $pid
            }]->(b)
            RETURN type(r)
            """,
            {
                "sid": source_id, "tid": target_id,
                "rt": rel["relType"], "cc": rel["causalClassification"],
                "desc": rel["description"], "ev": rel.get("evidence", ""),
                "es": rel.get("evidenceStrength", "established"),
                "mag": rel.get("magnitude", "significant"),
                "yr": rel.get("year", ""),
                "pid": project_id,
            },
        ))

    if skipped:
        for s in skipped:
            print(f"  [WARN] Skipped: {s} (entity not found)")

    if not batch:
        return 0

    result = run_batch(batch)
    if not result["ok"]:
        print(f"  [ERROR] Relationships: {result['errors']}")
        return 0
    return len(batch)


def create_causal_chains(extraction, entity_map, project_id):
    """Create CausalChain nodes and their ordered links. 2 HTTP calls total."""
    chains = extraction.get("causal_chains", [])
    if not chains:
        return 0

    # Batch 1: Create chain nodes + link to project
    chain_batch = []
    chain_ids = []
    for chain in chains:
        chain_id = generate_id("chain")
        chain_ids.append(chain_id)
        chain_batch.append((
            """
            CREATE (cc:CausalChain {
                chainId: $cid, name: $name, description: $desc,
                linkCount: $lc, projectId: $pid, createdAt: datetime()
            })
            WITH cc
            MATCH (p:Project {projectId: $pid})
            MERGE (cc)-[:BELONGS_TO_PROJECT]->(p)
            RETURN cc.chainId
            """,
            {
                "cid": chain_id, "name": chain["name"],
                "desc": chain.get("description", ""),
                "lc": len(chain.get("links", [])),
                "pid": project_id,
            },
        ))

    result = run_batch(chain_batch)
    if not result["ok"]:
        print(f"  [ERROR] Causal chains: {result['errors']}")
        return 0

    # Batch 2: Create chain link relationships
    link_batch = []
    for i, chain in enumerate(chains):
        chain_id = chain_ids[i]
        for order, link in enumerate(chain.get("links", [])):
            source_id = entity_map.get(link["source"])
            target_id = entity_map.get(link["target"])
            if not source_id or not target_id:
                print(f"  [WARN] Chain link skipped: {link['source']} -> {link['target']}")
                continue
            link_batch.append((
                """
                MATCH (cc:CausalChain {chainId: $cid}),
                      (a:Entity {entityId: $sid}),
                      (b:Entity {entityId: $tid})
                CREATE (a)-[r:CHAIN_LINK {
                    chainId: $cid, orderIndex: $ord,
                    explanation: $expl
                }]->(b)
                """,
                {
                    "cid": chain_id, "sid": source_id, "tid": target_id,
                    "ord": order, "expl": link.get("explanation", ""),
                },
            ))

    if link_batch:
        result = run_batch(link_batch)
        if not result["ok"]:
            print(f"  [ERROR] Chain links: {result['errors']}")

    return len(chains)


def create_first_appears_in(entities_data, entity_map, project_id):
    """Create FIRST_APPEARS_IN links from entities to their temporal events. 1 HTTP call."""
    entities = entities_data.get("entities", [])
    phases = entities_data.get("temporal_phases", [])
    if not entities or not phases:
        return 0

    batch = []
    for entity in entities:
        eid = entity_map.get(entity["name"])
        fai = entity.get("first_appearance_index")
        if not eid or fai is None:
            continue
        batch.append((
            """
            MATCH (e:Entity {entityId: $eid}),
                  (te:TemporalEvent {projectId: $pid, phaseIndex: $fai})
            MERGE (e)-[:FIRST_APPEARS_IN]->(te)
            """,
            {"eid": eid, "pid": project_id, "fai": fai},
        ))

    if not batch:
        return 0

    result = run_batch(batch)
    if not result["ok"]:
        print(f"  [ERROR] FIRST_APPEARS_IN: {result['errors']}")
        return 0
    return len(batch)


def store_embeddings(embeddings_data, entity_map, project_id):
    """Store embeddings as node properties. 1 HTTP call total.

    Accepts embed.py output format:
      {"embeddings": [{"name": "...", "embedding": [...]}], "model": "...", "dimensions": N}
    Last entry where name matches project unique_id is the project embedding.
    All others are entity embeddings.
    """
    batch = []
    all_embs = embeddings_data.get("embeddings", [])

    if not all_embs:
        print("  [WARN] No embeddings found in data")
        return 0

    for emb in all_embs:
        name = emb.get("name")
        vector = emb.get("embedding")
        if not name or not vector:
            continue

        eid = entity_map.get(name)
        if eid:
            # Entity embedding
            batch.append((
                "MATCH (e:Entity {entityId: $eid}) SET e.embedding = $emb RETURN e.entityId",
                {"eid": eid, "emb": vector},
            ))
        else:
            # Project embedding (name doesn't match any entity — it's the project unique_id)
            batch.append((
                "MATCH (p:Project {projectId: $pid}) SET p.embedding = $emb RETURN p.projectId",
                {"pid": project_id, "emb": vector},
            ))

    if not batch:
        return 0

    result = run_batch(batch)
    if not result["ok"]:
        print(f"  [ERROR] Embeddings: {result['errors']}")
        return 0
    return len(batch)


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: python neo4j/upload.py <project-dir>")
        sys.exit(1)

    project_dir = sys.argv[1]
    if not os.path.isdir(project_dir):
        print(f"[ERROR] Not a directory: {project_dir}")
        sys.exit(1)

    print(f"[UPLOAD] Starting upload from: {project_dir}")
    print()

    check_connection()
    print()

    print("[LOAD] Loading artifacts...")
    artifacts = load_artifacts(project_dir)
    print()

    placement = artifacts["placement"]
    entities_data = artifacts["entities"]
    embeddings_data = artifacts["embeddings"]
    extraction = artifacts["extraction"]

    # Step 1-3: Scaffold (DateTime + Collection + Project + links) — ~3 HTTP calls
    print("[STEP 1-3] Creating scaffold (DateTime, Collection, Project)...")
    project_id, collection_id, err = create_scaffold(extraction, placement)
    if err:
        print(f"  [ERROR] {err}")
        sys.exit(1)

    # Step 4: Entity nodes — 3 HTTP calls (check + create + link)
    print("[STEP 4] Creating Entity nodes...")
    entity_map = create_entity_nodes(entities_data, project_id)
    print(f"  Created/merged {len(entity_map)} entities")

    # Step 5: Temporal events — 1 HTTP call
    print("[STEP 5] Creating TemporalEvent nodes...")
    create_temporal_events(entities_data, project_id)
    print(f"  Created {len(entities_data.get('temporal_phases', []))} temporal events")

    # Step 6: Relationships — 1 HTTP call
    print("[STEP 6] Creating relationships...")
    rel_count = create_relationships(extraction, entity_map, project_id)
    print(f"  Created {rel_count} relationships")

    # Step 7: FIRST_APPEARS_IN links — 1 HTTP call
    print("[STEP 7] Creating FIRST_APPEARS_IN links...")
    fai_count = create_first_appears_in(entities_data, entity_map, project_id)
    print(f"  Created {fai_count} FIRST_APPEARS_IN links")

    # Step 8: Causal chains — 2 HTTP calls
    print("[STEP 8] Creating causal chains...")
    chain_count = create_causal_chains(extraction, entity_map, project_id)
    print(f"  Created {chain_count} causal chains")

    # Step 9: Embeddings — 1 HTTP call
    print("[STEP 9] Storing embeddings...")
    emb_count = store_embeddings(embeddings_data, entity_map, project_id)
    expected_emb = len(entity_map) + 1  # entities + project
    print(f"  Stored {emb_count} embeddings")
    if emb_count < expected_emb:
        print(f"  [WARN] Expected {expected_emb} embeddings (entities + project), got {emb_count}")
    else:
        print(f"  [OK] Embedding count matches ({emb_count} = {len(entity_map)} entities + 1 project)")

    project_name = placement["project_name"]
    print()
    print("=" * 50)
    print(" Upload complete!")
    print("=" * 50)
    print(f"  Project:      {project_name} ({project_id})")
    print(f"  Collection:   {placement['collection']} ({collection_id})")
    print(f"  Directory:    {placement['directory']}")
    print(f"  Entities:     {len(entity_map)}")
    print(f"  Relationships:{rel_count}")
    print(f"  Causal chains:{chain_count}")
    print(f"  Embeddings:   {emb_count} / {expected_emb} expected")
    print(f"  Phases:       {len(entities_data.get('temporal_phases', []))}")
    print(f"  FIRST_APPEARS:{fai_count}")


if __name__ == "__main__":
    main()
