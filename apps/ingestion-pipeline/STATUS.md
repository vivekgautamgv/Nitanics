# Component 01: Ingestion

**Status:** CLOSED
**Started:** 2026-04-04
**Closed:** 2026-04-06

## Scope
- Extraction pipeline (4 stages: NLP -> Project Overview -> Entities -> Relationships)
- Neo4j schema + bootstrap + queries
- NLP preprocessing (Python: spaCy, BERT, TF-IDF)
- Embeddings (BERT 384d)
- GDS computation (PageRank, Betweenness, Degree, Node Similarity)
- 7 projects ingested and validated
- Collections created from test projects
- Portable collection export/import pipeline

## Definition of Done
- [x] Extraction pipeline produces valid JSON for all 4 stages
- [x] Neo4j schema bootstraps cleanly
- [x] 7 projects extracted with full quality bar
- [x] All entities have definition + role (stance + mechanics)
- [x] All edges have two-layer classification + evidence + magnitude
- [x] Causal chains are entity-driven with system mechanics
- [x] Temporal flow assigned to all projects
- [x] Embeddings generated for all entities + projects
- [x] GDS metrics computed (PageRank, Betweenness, Degree, Node Similarity)
- [x] Collections created grouping related projects
- [x] Bridge entities detected across projects (41 bridges)
- [x] All validation passing (30+ rules)
- [x] Interface contracts documented for Component 2 and Component 4
- [x] README complete with full documentation
- [x] Collection export/import pipeline tested (round-trip verified)
- [x] 12 skill files written
- [x] All documentation audit gaps fixed
