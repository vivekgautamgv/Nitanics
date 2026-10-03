# Skill Index

**Master registry of all instruction files. Read this to find what you need.**

---

## Maps (Orientation)

| File | Purpose | When to Read |
|------|---------|-------------|
| `maps/system-map.md` | What MemoryTonic is, 5 components, how they connect | Session start. New to the system. |
| `maps/pipeline-map.md` | Full extraction flow: Phases A-E, Steps 01-09, timing | Before extraction. Understanding the pipeline. |
| `maps/skill-index.md` | This file. Find any skill. | When you need to find something. |

---

## Extraction Skills (Steps 03-04)

| File | Purpose | When to Read |
|------|---------|-------------|
| `extraction/kg-theory.md` | KG theory + detective lens + system mechanics + source perspective | Before first extraction. Deep understanding. |
| `extraction/quality-bar.md` | Minimum quality requirements. Examples of pass/fail. | Before extraction. Quality reference. |
| `extraction/display-awareness.md` | How your output appears in C02/C03 UI. | Before extraction. Write for the display. |
| `extraction/tag-awareness.md` | How tags work (search, embeddings, collection matching). | Before extraction. Tag correctly. |
| `extraction/entity-discovery.md` | Step 03: The 11-step entity discovery process. | During Step 03. Entity writing. |
| `extraction/relationship-building.md` | Step 04 Part 1: Relationship quality and patterns. | During Step 04. Relationship writing. |
| `extraction/causal-chains.md` | Step 04 Part 2: How to build causal chains. | During Step 04. Chain writing. |
| `extraction/html-template.md` | Step 01: HTML generation template and rules. | During Step 01. HTML generation. |
| `extraction/domain-skill-template.md` | Template for creating new domain skills. | When generating a domain skill. |

---

## System Skills (Schema, GDS, Queries)

| File | Purpose | When to Read |
|------|---------|-------------|
| `system/schema-guide.md` | Complete Neo4j schema: all nodes, edges, properties, constraints. | When writing queries. Schema reference. |
| `system/gds-guide.md` | GDS algorithms: PageRank, betweenness, degree, similarity. | Understanding graph metrics. |
| `system/cypher-patterns.md` | Common Cypher query patterns from C02/C03. | Writing new queries. Pattern reference. |
| `system/export-import-guide.md` | How collections are exported to ZIP and imported back. | Export/import operations. |

---

## Analysis Skills (Research Agent)

| File | Purpose | When to Read |
|------|---------|-------------|
| `analysis/bridge-detection.md` | Finding and analyzing bridge entities. | Research Agent analysis. |
| `analysis/gap-analysis.md` | Finding missing entities, themes, and temporal coverage. | Research Agent analysis. |
| `analysis/collection-analysis.md` | Full 7-phase Research Agent protocol. | Starting collection analysis. |

---

## Domain Skills (Extraction Guidance)

| File | Purpose | When to Read |
|------|---------|-------------|
| `instructions/geopolitics.md` | Geopolitical content: power dynamics, sanctions, alliances. | Extracting geopolitical documents. |
| `instructions/finance.md` | Financial content: markets, central banks, instruments. | Extracting financial documents. |
| `instructions/technology.md` | Technology content: systems, dependencies, architectures. | Extracting technical documents. |

### Custom Domain Skills

User-created or AI-generated domain skills go in `instructions/custom/`. Created via Phase B of the extraction pipeline when a specialized domain has no existing skill.

---

## User Customization

| File | Purpose | When to Read |
|------|---------|-------------|
| `agent.md` | User's personal preferences and overrides. | Session start. Every extraction. |

---

## Skill Loading by Agent

### Main Agent (always loaded)
- `maps/system-map.md` — orientation
- `maps/skill-index.md` — navigation
- `agent.md` — user preferences

### Extraction Worker (loaded per extraction)
- `maps/pipeline-map.md` — pipeline steps
- `extraction/quality-bar.md` — quality requirements
- `extraction/kg-theory.md` — thinking methodology
- `extraction/display-awareness.md` — UI context
- `extraction/tag-awareness.md` — tag rules
- `extraction/entity-discovery.md` — Step 03 guidance
- `extraction/relationship-building.md` — Step 04 guidance
- `extraction/causal-chains.md` — chain guidance
- `extraction/html-template.md` — Step 01 template
- Domain skill if applicable (from Phase B)
- `agent.md` — user extraction preferences

### Research Agent (loaded per analysis)
- `analysis/collection-analysis.md` — 7-phase protocol
- `analysis/bridge-detection.md` — bridge analysis
- `analysis/gap-analysis.md` — gap detection
- `system/schema-guide.md` — query reference
- `system/gds-guide.md` — metrics understanding

### Import Worker (loaded per import)
- `system/export-import-guide.md` — import protocol
- `system/schema-guide.md` — schema reference

---

## File Counts

| Directory | Files | Total |
|-----------|-------|-------|
| maps/ | 3 | |
| extraction/ | 9 | |
| system/ | 4 | |
| analysis/ | 3 | |
| instructions/ | 3 (+custom/) | |
| root | 1 (agent.md) | |
| **Total** | | **23** |
