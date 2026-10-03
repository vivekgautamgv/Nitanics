# Skills

Extraction protocol, graph operations, and agent behavior documentation.
These files become MCP tool instructions in Component 4.

## Files

| Skill | Future MCP Tool | Purpose |
|-------|-----------------|---------|
| `extraction-pipeline-skill.md` | — | **Zero-context agent guide:** Complete end-to-end pipeline with placement decisions, exact commands, all traps. A fresh agent reads THIS first. |
| `extraction-skill.md` | `memorytonic_extraction_guide` | Quality bar, format rules, examples |
| `extraction-agent.md` | `memorytonic_extract` | 6-step pipeline orchestration, validation |
| `nlp-setup-skill.md` | `memorytonic_health` | Python setup, calling scripts, I/O contracts |
| `checklist-template.md` | — | Step-by-step extraction checklist |
| `extraction-checklist.md` | — | Quick reference: common mistakes and fixes |
| `neo4j-operations-skill.md` | Multiple tools | CRUD, search, explore, gaps, bridges, paths |
| `cypher-queries-skill.md` | `memorytonic_query` | 30+ common Cypher query patterns |
| `gds-skill.md` | `memorytonic_recompute` | GDS operations: PageRank, Betweenness, Degree, Similarity |
| `gds-catalog-skill.md` | — | Full GDS algorithm catalog: 7 categories, 30+ algorithms rated |
| `maintenance-skill.md` | — | Post-upload/deletion checklists, periodic maintenance |
| `html-template-skill.md` | --- | Dark theme HTML template with voice blocks for source documents |
| `import-pipeline-skill.md` | `memorytonic_import` | **Zero-context agent guide:** Complete import pipeline from ZIP to Neo4j. Dry-run, conflict resolution, verification. |

## Forward Compatibility
The skill files ARE the tool instructions. When Component 4 (MCP) wraps these
into tools, zero translation is needed. The skill content becomes the tool's
protocol directly.
