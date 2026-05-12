# Data

Pipeline artifacts and permanent storage for ingested projects.

## Directories

| Folder | Purpose | Contents |
|--------|---------|----------|
| `projects/` | Raw text copies of source material | `script.md` files copied from source |
| `sources/` | Formatted HTML versions | `{project-name}/01_html.html` |
| `extracted/` | JSON extraction results | `{project-name}/` with all numbered artifacts |

## Pipeline Flow

```
1. Raw text copied to projects/{project-name}/script.md
2. Pipeline runs in temp folder (numbered artifacts: 01-06)
3. On success, artifacts move to:
   - sources/{project-name}/01_html.html
   - extracted/{project-name}/ (all numbered JSONs)
```

## Storage = Source of Truth
Neo4j holds the graph structure. These folders hold the raw artifacts.
HTML link in Neo4j Project node points to `sources/{project-name}/01_html.html`.
