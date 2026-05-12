# Extracted (JSON Artifacts)

Numbered pipeline artifacts for each project.
Created during the extraction pipeline (Steps 01-06).

Each subfolder: `{project-name}/`
```
02_placement.json       ← directory, project name, collection
03_nlp_entities.json    ← NLP preprocessing results
04_all_entities.json    ← Complete entity list + temporal phases
05_embeddings.json      ← BERT 384d vectors
06_extraction.json      ← Relationships, causal chains, summary, tags
```

These are debuggable artifacts — open any file to see exactly what each pipeline step produced.
