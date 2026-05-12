"""
MemoryTonic v4 — Neo4j Database Client

Shared HTTP client for all Neo4j scripts.
All scripts import from here instead of duplicating HTTP logic.

Functions:
  run_cypher(statement, params)  — single Cypher statement
  run_batch(statements_with_params) — N statements in one HTTP call
  check_connection() — verify Neo4j reachable, exit(1) if not
"""

import json
import sys
import urllib.request
import urllib.error
import base64

from config import NEO4J_HTTP, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE


def _http_post(body):
    """Raw HTTP POST to Neo4j transaction endpoint."""
    url = f"{NEO4J_HTTP}/db/{NEO4J_DATABASE}/tx/commit"
    data = json.dumps(body).encode("utf-8")
    auth = base64.b64encode(f"{NEO4J_USER}:{NEO4J_PASSWORD}".encode()).decode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json", "Authorization": f"Basic {auth}"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        return {"errors": [{"message": str(e)}], "results": []}


def run_cypher(statement, params=None):
    """Execute a single Cypher statement.

    Returns:
        {"ok": bool, "data": [results], "errors": []}
    """
    entry = {"statement": statement}
    if params:
        entry["parameters"] = params
    result = _http_post({"statements": [entry]})
    if result.get("errors"):
        return {"ok": False, "errors": result["errors"], "data": result.get("results", [])}
    return {"ok": True, "data": result.get("results", []), "errors": []}


def run_batch(statements_with_params):
    """Execute N Cypher statements in a single HTTP request.

    Args:
        statements_with_params: list of (statement, params) tuples.
    Returns:
        {"ok": bool, "data": [result_per_statement], "errors": []}
    """
    if not statements_with_params:
        return {"ok": True, "data": [], "errors": []}

    body = {"statements": []}
    for stmt, params in statements_with_params:
        entry = {"statement": stmt}
        if params:
            entry["parameters"] = params
        body["statements"].append(entry)

    result = _http_post(body)
    if result.get("errors"):
        return {"ok": False, "data": result.get("results", []), "errors": result["errors"]}
    return {"ok": True, "data": result.get("results", []), "errors": []}


def check_connection():
    """Verify Neo4j is reachable. Exits with code 1 if not."""
    result = run_cypher("RETURN 1 AS test")
    if not result["ok"]:
        print(f"[ERROR] Cannot connect to Neo4j: {result['errors']}")
        print(f"  URL: {NEO4J_HTTP}")
        print(f"  Database: {NEO4J_DATABASE}")
        print(f"  Make sure Neo4j is running and credentials are correct.")
        sys.exit(1)
    print("[OK] Neo4j connected")
