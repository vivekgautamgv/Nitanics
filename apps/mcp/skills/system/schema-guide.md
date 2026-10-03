# Neo4j Schema Guide

**The complete truth about what exists in the database. Every property, every relationship, every constraint.**

---

## Node Types (7)

### Entity
The core knowledge node. Extracted from documents. Merges across projects by name + aliases.

```
entityId              string, UUID, unique (constraint: entity_id)
name                  string (indexed: entity_name)
aliases               string[] (source-supported alternative names; [] is valid)
aliases_text          string (comma-joined for fulltext search)
category              string (indexed: entity_category) — one of 14 fixed:
                        Person, Organization, Place, Event, Concept, System,
                        Process, Technology, Law, Agreement, Metric, Document,
                        Resource, Other
definition            string (nonempty, source-supported, proportionate to the source)
role                  string (stance + mechanics + reasoning — per extraction, latest wins on merge)
firstAppearanceIndex  int | null (null when the source supports no temporal phase)
projectCount          int (incremented on merge — how many projects mention this entity)
pageRank              float (GDS — entity importance)
betweenness           float (GDS — structural bridge detection)
degree                int (GDS — connection count)
embedding             float[384] (BERT all-MiniLM-L6-v2, cosine similarity)
createdAt             datetime
```

**Merge logic (upload.py):** When a new entity is extracted, upload.py checks ALL existing entities:
`WHERE e.name = $name OR $name IN e.aliases OR ANY(alias IN $aliases WHERE e.name = alias OR alias IN e.aliases)`
If match found → increment `projectCount`. If no match → create new entity.

**Bridge tiers (computed from projectCount + betweenness):**
| Tier | Criteria | C02 Visual |
|------|----------|------------|
| Gold | projectCount >= 3 | Double ring, prominent glow |
| Silver | projectCount = 2 | Single ring |
| Bronze | projectCount = 1 + betweenness > 1000 | Subtle indicator |

### Project
A single extracted document. Has a unique kebab-case slug.

```
projectId             string, UUID, unique (constraint: project_id)
name                  string (indexed: project_name) — display name
uniqueId              string — kebab-case slug (e.g., "petrodollar-system")
summary               string (nonempty and proportionate to the source; no word quota)
narrativeFlow         string[] (source-supported ordered moments; [] is valid)
domain                string (e.g., "Geopolitics")
subdomain             string (e.g., "Energy & Financial Systems")
baseTags              string[] (at least one nonempty thematic tag)
htmlPath              string (path to stored HTML, format: "data/sources/YYYY-MM-DD/slug/01_html.html")
directory             string (e.g., "Research")
embedding             float[384] (BERT — project summary embedding)
createdAt             datetime
```

### Collection
A set/basket of projects. Cross-directory allowed. Assignment is MANDATORY for every project.

```
name                  string, unique (constraint: collection_id uses collectionId, but name also has constraint)
collectionId          string, UUID, unique
description           string (nullable — users fill in via C03 or C04)
createdAt             datetime
```

### DirectoryCategory
Top-level organizational category. Defaults: Research, Business, Personal. User-creatable.

```
name                  string, unique (constraint: directory_name)
description           string (nullable)
```

### DateTime
Commit date and time nodes. Dates chain across days. Times chain within same date.

```
datetimeId            string, unique (constraint: datetime_id)
                      Format: "YYYY-MM-DD" for date type, "YYYY-MM-DD-HHmmss" for time type
date                  string (the date portion)
time                  string (nullable — only for time type, format "HH:MM:SS")
type                  string ("date" or "time")
year                  int (on date nodes)
month                 int (on date nodes)
day                   int (on date nodes)
```

### TemporalEvent
Project-internal timeline. Year-based for temporal content, index-based for non-temporal.

```
eventId               string, UUID, unique (constraint: temporal_event_id)
projectId             string (links to project)
phaseIndex            int (ordering within the project)
label                 string (description of this phase)
period                string (e.g., "1973-1974" or "Phase 1")
```

### CausalChain
Named causal sequences within a project.

```
chainId               string, UUID, unique (constraint: causal_chain_id)
name                  string (descriptive chain name)
description           string (what this chain explains)
linkCount             int (number of links in the chain)
projectId             string (which project this chain belongs to)
createdAt             datetime
```

---

## Relationship Types (11)

### Structural Relationships (6)

| Relationship | From → To | Properties | Notes |
|---|---|---|---|
| IN_DIRECTORY | Project → DirectoryCategory | — | Every project has exactly one |
| CREATED_ON | Project → DateTime(date) | — | Commit date |
| CREATED_AT | Project → DateTime(time) | — | Commit time |
| ON_DATE | DateTime(time) → DateTime(date) | — | Time-to-date link |
| BELONGS_TO | Project → Collection | — | Every project has at least one |
| BELONGS_TO_PROJECT | CausalChain/TemporalEvent → Project | — | CRITICAL: NOT "IN_PROJECT" |

### Knowledge Relationships (5)

| Relationship | From → To | Properties | Notes |
|---|---|---|---|
| MENTIONED_IN | Entity → Project | role (string) | Per-project role text. Entity can be mentioned in many projects. |
| RELATES_TO | Entity → Entity | relType, causalClassification, description, evidence, evidenceStrength, magnitude, year, projectId | The main knowledge edge. Created with CREATE not MERGE — multiple edges between same pair allowed. |
| FIRST_APPEARS_IN | Entity → TemporalEvent | — | Maps entity to the temporal phase where it first appears |
| CHAIN_LINK | Entity → Entity | chainId, orderIndex, explanation | Ordered causal chain links |
| SIMILAR_TO | Entity → Entity | similarity (float) | GDS-generated, deleted and recreated on each recompute |

### RELATES_TO Edge Properties (ALL REQUIRED)

```
relType               string — specific verb: SANCTIONS, FUNDS, ENABLES, BLOCKS, etc.
                      Extensible, project-dependent. Not from a fixed list.
causalClassification  string — one of 15 fixed families (for filtering/coloring):
                        CAUSES, ENABLES, BLOCKS, INFLUENCES, DEPENDS_ON,
                        CONTRADICTS, SUPPORTS, PRECEDES, COMPETES_WITH,
                        COOPERATES_WITH, REGULATES, TRANSFORMS, PRODUCES,
                        CONSUMES, IMPLEMENTS
description           string (nonempty explanation supported by the evidence)
evidence              string (exact quote from source text — no paraphrasing)
evidenceStrength      string — established | claimed | disputed | speculative
magnitude             string — foundational | significant | marginal
year                  string (use an empty string when the source supplies no date)
projectId             string (which project this relationship comes from)
```

**Two-layer classification:** Every edge has BOTH:
1. `relType` — the specific verb (extensible, tells you exactly what happened)
2. `causalClassification` — the broader family (15 fixed types, used for graph coloring and filtering in C02)

---

## Constraints (7)

| Name | Node | Property |
|------|------|----------|
| entity_id | Entity | entityId |
| project_id | Project | projectId |
| collection_id | Collection | collectionId |
| directory_name | DirectoryCategory | name |
| datetime_id | DateTime | datetimeId |
| temporal_event_id | TemporalEvent | eventId |
| causal_chain_id | CausalChain | chainId |

## Indexes

| Type | Name | Target | Purpose |
|------|------|--------|---------|
| Property | entity_name | Entity.name | Lookup |
| Property | entity_category | Entity.category | Filter |
| Property | project_name | Project.name | Lookup |
| Property | collection_name | Collection.name | Lookup |
| Property | temporal_project | TemporalEvent.projectId | Filter |
| Fulltext | entity_fulltext | Entity [name, definition, aliases_text] | Text search |
| Vector | entityEmbedding | Entity.embedding | 384d, cosine |
| Vector | projectEmbedding | Project.embedding | 384d, cosine |

---

## Fixed Enums

### 14 Entity Categories (ONTOLOGICAL — do NOT add domain-specific)
```
Person, Organization, Place, Event, Concept, System,
Process, Technology, Law, Agreement, Metric, Document,
Resource, Other
```

### 15 Causal Classification Families (for filtering/coloring)
```
CAUSES, ENABLES, BLOCKS, INFLUENCES, DEPENDS_ON,
CONTRADICTS, SUPPORTS, PRECEDES, COMPETES_WITH,
COOPERATES_WITH, REGULATES, TRANSFORMS, PRODUCES,
CONSUMES, IMPLEMENTS
```

### Evidence Strengths
```
established — documented fact, verifiable
claimed     — stated by source but not independently verified
disputed    — contested by other sources
speculative — inferred, hypothesized, or predicted
```

### Magnitudes
```
foundational — defines the system structure, removing it collapses the system
significant  — important but system survives without it
marginal     — minor influence, details
```

---

## Downstream Contract (WHAT C02/C03 READ)

This is the COMPLETE set of properties that C02 Graph Studio and C03 Frontend read from Neo4j. Every one of these MUST exist after upload, or the UI breaks.

```
Entity:           entityId, name, category, definition, aliases, aliases_text,
                  role, firstAppearanceIndex, projectCount,
                  pageRank, betweenness, degree, embedding[384]

Project:          projectId, name, uniqueId, summary, narrativeFlow,
                  domain, subdomain, baseTags, htmlPath, directory,
                  embedding[384], createdAt

Collection:       name, collectionId, description, createdAt

DirectoryCategory: name, description

DateTime:         datetimeId, date, time, type

TemporalEvent:    eventId, projectId, phaseIndex, label, period

CausalChain:      chainId, name, description, linkCount, projectId

MENTIONED_IN:     role
RELATES_TO:       relType, causalClassification, description, evidence,
                  evidenceStrength, magnitude, year, projectId
CHAIN_LINK:       chainId, orderIndex, explanation
SIMILAR_TO:       similarity
```

**If a property is not in this list, C02/C03 won't display it.**

---

## C02 Graph Studio Queries (9 functions)

| # | Function | Purpose | Key Properties Read |
|---|----------|---------|---------------------|
| Q1 | fetchCollectionGraph | Load force graph nodes + edges | Entity: all display props. RELATES_TO: all props |
| Q1b | fetchMentionedInEdges | Entity→Project membership | Entity: entityId. Project: uniqueId. MENTIONED_IN: role |
| Q2 | fetchCollectionProjects | Project list for sidebar | Project: name, uniqueId, summary, domain, subdomain, baseTags, htmlPath |
| Q3 | fetchEntityDetail | Full entity card | Entity: ALL. MENTIONED_IN: role. RELATES_TO: all. CHAIN_LINK: all. SIMILAR_TO: similarity |
| Q4 | fulltextSearch | Text search | Entity: name, category, definition |
| Q5 | findShortestPath | Path between entities | Entity: name |
| Q6 | fetchCausalChains | Chains per project | CausalChain: all. CHAIN_LINK: all |
| Q7 | fetchBridgeEntities | Bridge entities | Entity: name, category, pageRank, betweenness, projectCount |
| Q9 | fetchCollections | Collection picker | Collection: name + computed counts |

## C03 Frontend Queries (30+ functions)

**Directory View (6):** F1-F6 — directories, collections, projects, entities, cross-entity search
**Collection View (7):** F7-F10, F24-F26 — summary, projects, bridges, recommendations, top entities, categories, chains
**Project View (6):** F11-F14, F27-F28 — detail, entities, relationships, related projects, chains, timeline
**Entity View (2+):** F15, RSB1-RSB2 — 6-pass entity profile, entity info card, project info card
**CRUD (6):** F19-F23 — directory CRUD, collection CRUD, add/remove project to collection
**Export (1):** F30 — ZIP export (fflate in browser)

---

## Traps (Things That Will Bite You)

1. **BELONGS_TO_PROJECT, not IN_PROJECT** — C03 had this bug (F2 in failures.md). Always verify relationship names against this guide.
2. **Entity merge is case-sensitive** — "IMF" and "imf" are different entities. Aliases help, but they must match case.
3. **CREATE not MERGE for RELATES_TO** — Multiple edges between the same entity pair are allowed (from different projects). This is by design.
4. **upload.py hardcodes field lists** — If you add new fields, you MUST update upload.py explicitly. It doesn't dynamically discover fields.
5. **export_collection.py hardcodes field lists too** — Same applies. New fields need explicit additions to 8 queries.
6. **GDS projection is UNDIRECTED** — Affects PageRank and Betweenness calculations.
7. **SIMILAR_TO edges are deleted and recreated** — Every GDS recompute drops all SIMILAR_TO first.
8. **bootstrap.py fulltext index** — Currently indexes name, definition, aliases_text. Changing requires DROP + RECREATE.
9. **C01 uses HTTP API, C04 uses bolt** — Different connection methods to the same database. Both work against same schema.
