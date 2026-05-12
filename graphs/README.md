# graphs/

This is the single workspace for all your knowledge graph projects.

When you bring a new document and ask your AI agent to create a graph from it, everything lands here.

## Structure

```
graphs/
└── my-collection/              ← your collection name (group of related docs)
    └── my-project-slug/        ← one project per document
        ├── source.md           ← your raw source document (you add this)
        ├── 01_html.html        ← formatted HTML (agent generates)
        ├── 02_placement.json   ← collection + directory placement (agent generates)
        ├── 03_nlp_entities.json ← NLP candidate extraction (agent generates)
        ├── 04_all_entities.json ← full entity list (agent generates)
        ├── 05_embeddings.json  ← entity embeddings (agent generates)
        └── 06_extraction.json  ← final graph artifact (agent generates)
```

## How to Add a New Graph Project

1. Create a folder: `graphs/<collection-name>/<project-slug>/`
2. Put your source document in it as `source.md`
3. Open this repo in your AI coding tool (Claude, Codex, Cursor, Antigravity, etc.)
4. Give it this prompt:

```
Read docs/INGESTION_FOR_AGENTS.md.

Create a new graph project from:
graphs/<collection-name>/<project-slug>/source.md

Collection: <collection-name>
Project slug: <project-slug>

Generate all 6 extraction artifacts in the same folder.
Validate and upload to Neo4j without touching existing collections.
```

5. Refresh the app at http://127.0.0.1:5174 — your graph appears in Graph Studio.

## Rules

- Each folder = one source document
- Do not mix multiple documents into one project folder
- Keep collection names consistent (same name = same graph group)
- Never delete existing project folders — upload adds to the graph, not replaces it

## Sample Collection

The `global-finance/` collection is included as a reference.
It shows what correctly generated extraction artifacts look like.
