"""
Query YT Startups (Backstage with Millionaires) Knowledge Graph
---------------------------------------------------------------
Connects to the MemoryTonic Neo4j database and extracts:
  - Company names
  - CEO / Founder names
  - Working area / Industry / Sector

Run from: d:\MT-v4\apps\ingestion-pipeline
  python query_yt_startups.py
"""

import json
import sys
import urllib.request
import urllib.error
import base64

# ── Neo4j connection (matches .env in neo4j/) ─────────────────────────────────
NEO4J_HTTP = "http://127.0.0.1:7474"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "12345678"
NEO4J_DATABASE = "memorytonic"

# ── Raw HTTP helper ────────────────────────────────────────────────────────────
def run_cypher(statement, params=None):
    url = f"{NEO4J_HTTP}/db/{NEO4J_DATABASE}/tx/commit"
    body = {"statements": [{"statement": statement, **({"parameters": params} if params else {})}]}
    data = json.dumps(body).encode("utf-8")
    auth = base64.b64encode(f"{NEO4J_USER}:{NEO4J_PASSWORD}".encode()).decode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Basic {auth}"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        print(f"[ERROR] Cannot reach Neo4j: {e}")
        sys.exit(1)

    if result.get("errors"):
        print(f"[CYPHER ERROR] {result['errors']}")
        return []

    rows = []
    for res in result.get("results", []):
        cols = res["columns"]
        for row in res["data"]:
            rows.append(dict(zip(cols, row["row"])))
    return rows


# ── Connection check ───────────────────────────────────────────────────────────
print("Connecting to Neo4j …")
ping = run_cypher("RETURN 1 AS ok")
if not ping:
    print("[ERROR] Neo4j connection failed.")
    sys.exit(1)
print(f"[OK] Connected to {NEO4J_HTTP}  db={NEO4J_DATABASE}\n")

# ── 1. What collections exist? (to find the YT Startups one) ──────────────────
print("=" * 60)
print("Collections in MemoryTonic:")
print("=" * 60)
collections = run_cypher("""
MATCH (c:Collection)
RETURN c.name AS name, c.description AS description
ORDER BY c.name
""")
for c in collections:
    print(f"  • {c['name']}  —  {c.get('description','')[:80]}")

# ── 2. Find the YT-Startups / Backstage collection ────────────────────────────
print("\n" + "=" * 60)
print("Projects in 'Startup Info' / Backstage collection:")
print("=" * 60)
projects = run_cypher("""
MATCH (col:Collection)-[:HAS_PROJECT]->(p:Project)
WHERE toLower(col.name) CONTAINS 'startup'
   OR toLower(col.name) CONTAINS 'backstage'
   OR toLower(col.name) CONTAINS 'yt'
   OR toLower(col.name) CONTAINS 'millionaire'
RETURN col.name AS collection, p.name AS project, p.id AS id
ORDER BY p.name
LIMIT 5
""")
for r in projects:
    print(f"  [{r['collection']}]  {r['project']}")

# ── 3. MAIN QUERY — Companies + CEO + Working Area ────────────────────────────
print("\n" + "=" * 60)
print("Companies | CEO/Founder | Working Area")
print("=" * 60)

# Strategy A: Entity nodes with type = Company + Person (CEO relationship)
rows_a = run_cypher("""
MATCH (company:Entity)
WHERE toLower(company.type) IN ['company', 'organization', 'startup', 'firm', 'business']
OPTIONAL MATCH (ceo:Entity)-[r:RELATED_TO|CEO_OF|FOUNDED_BY|LEADS|FOUNDED|WORKS_AT|IS_CEO_OF]->(company)
WHERE toLower(ceo.type) IN ['person', 'founder', 'ceo', 'entrepreneur']
   OR toLower(type(r)) IN ['ceo_of', 'founded_by', 'leads', 'founded']
OPTIONAL MATCH (company)-[:RELATED_TO|OPERATES_IN|SECTOR|INDUSTRY|FIELD]->(area:Entity)
WHERE toLower(area.type) IN ['sector', 'industry', 'field', 'domain', 'area', 'category']
RETURN DISTINCT
    company.name  AS company,
    company.type  AS company_type,
    ceo.name      AS ceo_founder,
    area.name     AS working_area
ORDER BY company.name
LIMIT 200
""")

# Strategy B: Using chunk/node properties directly
rows_b = run_cypher("""
MATCH (n:Entity)
WHERE n.type IS NOT NULL
RETURN DISTINCT
    n.name AS entity_name,
    n.type AS entity_type,
    n.description AS description
ORDER BY n.type, n.name
LIMIT 300
""")

# ── Display Strategy A results ─────────────────────────────────────────────────
if rows_a:
    print(f"\n{'Company':<40} {'CEO/Founder':<30} {'Working Area':<30}")
    print("-" * 100)
    for r in rows_a:
        company = (r.get("company") or "—")[:39]
        ceo = (r.get("ceo_founder") or "—")[:29]
        area = (r.get("working_area") or "—")[:29]
        print(f"{company:<40} {ceo:<30} {area:<30}")
    print(f"\n  Total companies found (Strategy A): {len(rows_a)}")
else:
    print("\n[Strategy A] No direct Company→CEO→Area relationships found.")
    print("Trying alternate entity scan …\n")

    # ── Strategy B fallback — group by type ───────────────────────────────────
    from collections import defaultdict
    by_type = defaultdict(list)
    for r in rows_b:
        by_type[r.get("entity_type", "unknown")].append(r)

    for etype, entities in sorted(by_type.items()):
        print(f"\n  [{etype.upper()}] ({len(entities)} entities)")
        for e in entities[:15]:
            desc = (e.get("description") or "")[:60]
            print(f"    • {e['entity_name']}  — {desc}")

# ── 4. Relationship scan for CEO/Founder links ────────────────────────────────
print("\n" + "=" * 60)
print("Relationship types in the graph:")
print("=" * 60)
rel_types = run_cypher("""
CALL db.relationshipTypes()
YIELD relationshipType
RETURN relationshipType ORDER BY relationshipType
""")
for r in rel_types:
    print(f"  {r.get('relationshipType', r)}")

# ── 5. Focused: Company + their related People nodes ─────────────────────────
print("\n" + "=" * 60)
print("Company–Person pairs (any relationship):")
print("=" * 60)
pairs = run_cypher("""
MATCH (person:Entity)-[r]->(company:Entity)
WHERE toLower(company.type) IN ['company','organization','startup','firm','business']
  AND toLower(person.type) IN ['person','founder','ceo','entrepreneur','co-founder']
RETURN DISTINCT
    company.name AS company,
    person.name  AS person,
    type(r)      AS relationship,
    company.description AS company_desc
ORDER BY company.name
LIMIT 200
""")
if pairs:
    print(f"\n{'Company':<40} {'Person':<30} {'Rel':<20}")
    print("-" * 90)
    for r in pairs:
        print(f"{(r['company'] or '')[:39]:<40} {(r['person'] or '')[:29]:<30} {(r['relationship'] or '')[:19]}")
    print(f"\n  Total pairs: {len(pairs)}")
else:
    print("  No person→company pairs found via entity types.")

# ── 6. All-relationships approach: find CEO mentions ─────────────────────────
print("\n" + "=" * 60)
print("Nodes mentioning 'CEO' or 'founder' in name/description:")
print("=" * 60)
ceo_nodes = run_cypher("""
MATCH (n:Entity)
WHERE toLower(n.name) CONTAINS 'ceo'
   OR toLower(n.name) CONTAINS 'founder'
   OR toLower(n.description) CONTAINS 'ceo'
   OR toLower(n.description) CONTAINS 'founder'
RETURN n.name AS name, n.type AS type, n.description AS description
ORDER BY n.name
LIMIT 50
""")
for r in ceo_nodes:
    print(f"  • {r['name']}  [{r['type']}]  —  {(r.get('description') or '')[:70]}")

print("\n[DONE]")
