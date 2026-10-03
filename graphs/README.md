# Graph workspace

`graphs/` is the canonical workspace for new Nitanics knowledge graph projects. Both UI uploads and agents working in the cloned repository save complete source text and extraction artifacts here.

```text
graphs/
└── <collection-slug>/
    └── <unique-project-slug>/
        ├── source.md
        ├── 01_html.html
        ├── 02_placement.json
        ├── 03_nlp_entities.json
        ├── 04_all_entities.json
        ├── 05_embeddings.json
        └── 06_extraction.json
```

## Add documents through an AI agent

Open this repository in a local coding agent such as Claude Code or Codex. Attach complete documents to its chat, or provide local paths if the agent cannot read attachments. The agent needs file access, command execution, and the configured Neo4j database. Its own model performs semantic extraction; local tools generate NLP candidates and embeddings.

```text
Read docs/INGESTION_FOR_AGENTS.md.
Process the complete contents of every document attached to this chat.
Collection: <collection name>
Workspace directory: Research
Create one new unique project per document under graphs/ and preserve all existing data.
Generate source.md and all six artifacts using supported facts and real local model embeddings.
Validate, upload passing projects with --create-only, and report any failed documents.
```

Alternatively, create a new project folder and save the complete source as `source.md` before giving the agent its path. Use a globally unique lowercase kebab-case project ID; the placement and extraction IDs must match it. Keep the collection display name consistent to add documents to an existing collection.

Read [Ingestion for agents](../docs/INGESTION_FOR_AGENTS.md) for setup, schemas, and exact uv commands. After upload, refresh the UI at `http://127.0.0.1:5174` and open the target collection to inspect Documents, Graph, Bridges, and source evidence.

## Preserve the workspace

Keep one source document per project. Never overwrite existing project folders or replace existing collections. Keep validated artifacts here after upload; source HTML is served directly from its canonical path. Legacy `apps/ingestion-pipeline/data/` artifacts remain supported and should be preserved.

The included `global-finance/petrodollar-system/source.md` is a reproducible starter source. Generate its six artifacts through the workflow above; cloning the repository does not upload it automatically. Its length is not a minimum extraction quota.
