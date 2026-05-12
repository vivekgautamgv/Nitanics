# Ingestion For AI Agents

This repository is designed so a user can clone it, open it in an AI coding tool, add documents, and ask the agent to create graph-ready projects.

## The One Rule

All graph data lives in the `graphs/` folder at the root of this repo. That is the only place you read source documents from and write artifacts to.

```
graphs/
└── <collection-name>/
    └── <project-slug>/
        ├── source.md             ← user provides this
        ├── 01_html.html          ← you generate this
        ├── 02_placement.json     ← you generate this
        ├── 03_nlp_entities.json  ← you generate this
        ├── 04_all_entities.json  ← you generate this
        ├── 05_embeddings.json    ← you generate this
        └── 06_extraction.json    ← you generate this
```

## Agent Goal

Given a `source.md` in `graphs/<collection>/<project>/`, produce all 6 extraction artifacts in the same folder, validate them, and upload into Neo4j without damaging existing collections.

## Ground Rules

- Preserve existing graph data — never delete or overwrite existing collections
- Create new projects under the requested collection
- Reuse existing entities when names and aliases clearly match
- Add bridge entities only when an entity appears across multiple projects
- Validate artifacts before upload
- Do not invent unsupported facts — mark uncertainty in definitions or notes

## Required Artifacts Per Project

Generate these files inside `graphs/<collection>/<project>/`:

| File | Purpose |
|------|---------|
| `01_html.html` | Formatted HTML version of the source document |
| `02_placement.json` | Collection, directory, and project metadata |
| `03_nlp_entities.json` | NLP candidate extraction (NER, keywords, co-occurrence) |
| `04_all_entities.json` | Full entity list with types, definitions, aliases |
| `05_embeddings.json` | Entity embedding vectors |
| `06_extraction.json` | Final graph: entities, relationships, causal chains, summary |

The canonical schema and instructions are in:

```
apps/ingestion-pipeline/skills/extraction-agent.md
apps/ingestion-pipeline/skills/extraction-skill.md
apps/ingestion-pipeline/skills/neo4j-operations-skill.md
```

## Suggested Agent Prompt

```
You are working in the Nitanics repo.

Read docs/ARCHITECTURE.md and apps/ingestion-pipeline/skills/extraction-agent.md.

Source document: graphs/<collection>/<project>/source.md
Collection: <collection>
Project slug: <project>

Generate all 6 extraction artifacts in the same folder: graphs/<collection>/<project>/
Validate before upload.
Upload to Neo4j without deleting or replacing existing collections.
```

## Upload Flow

```bash
cd apps/ingestion-pipeline
python neo4j/validate_project.py ../../graphs/<collection>/<project>
python neo4j/upload.py ../../graphs/<collection>/<project>
python neo4j/gds.py
```

Then refresh the frontend at `http://127.0.0.1:5174`.

## Expanding Existing Collections

To add more projects to an existing collection, create new project folders under the same `<collection-name>`. Uploading new projects adds entities and relationships while preserving earlier graph data.

Bridge entities emerge automatically when the same entity appears across multiple projects in the same collection.

## Quality Bar

A good graph project should have:

- Clear project summary
- High-signal entities with definitions
- Typed relationships with evidence
- Causal chains where the source supports them
- No duplicate project IDs
- No destructive writes to unrelated collections
