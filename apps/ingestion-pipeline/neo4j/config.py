"""
MemoryTonic v4 — Neo4j Configuration

Shared configuration for all Neo4j scripts (bootstrap, upload, validate, gds).
Reads from environment variables with sensible defaults.

Environment variables:
  NEO4J_HTTP       — HTTP API endpoint (default: http://localhost:7474)
  NEO4J_USER       — Username (default: neo4j)
  NEO4J_PASSWORD   — Password (required, default: neo4j)
  NEO4J_DATABASE   — Database name (default: memorytonic)

Optional .env file support: place a .env file in the project root or
component directory. Values are loaded automatically if python-dotenv
is installed, otherwise only OS environment variables are read.
"""

import os

# Try loading .env file (optional dependency)
try:
    from dotenv import load_dotenv

    # Walk up from this file to find .env
    _dir = os.path.dirname(os.path.abspath(__file__))
    for _candidate in [
        os.path.join(_dir, ".env"),
        os.path.join(_dir, "..", ".env"),
    ]:
        if os.path.isfile(_candidate):
            load_dotenv(_candidate)
            break
except ImportError:
    pass

NEO4J_HTTP = os.environ.get("NEO4J_HTTP", "http://localhost:7474")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "neo4j")
NEO4J_DATABASE = os.environ.get("NEO4J_DATABASE", "memorytonic")
