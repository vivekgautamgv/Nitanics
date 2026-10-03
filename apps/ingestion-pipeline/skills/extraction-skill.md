# Extraction Quality and Schemas

This is the schema/quality companion to `extraction-agent.md` for Nitanics. Use complete source documents, the agent's own model for semantic extraction, actual local NLP output, and actual local model embeddings. Store each new project in `graphs/<collection>/<unique-project>/`.

## Grounding comes first

Describe what the source supports. Keep claims, uncertainty, disputes, and attribution intact. Entity definitions and roles should be useful and precise without adding background knowledge as if it came from the document. Aliases must describe the same entity. Reconcile NLP false positives and duplicates; candidate co-occurrence does not prove a relationship.

Every relationship needs an exact source quote that supports its actual meaning. The validator ignores whitespace differences when finding the quote in `source.md`; it cannot decide whether a quote proves a claim. Never modify the preserved source to make an invented quote pass.

At least one supported entity is required. Graph size follows source content: no word-count, entity-density, relationship-count, or causal-chain quota applies. Leave `temporal_phases`, `relationships`, `causal_chains`, and `narrative_flow` empty when unsupported. Causal chains describe supported mechanisms, and every link requires a corresponding evidence-bearing relationship. Do not turn mere chronology or correlation into causation.

## Placement: 02_placement.json

Exactly five fields are required:

```json
{
  "directory": "Research",
  "project_name": "atlas-note-a1b2c3",
  "unique_id": "atlas-note-a1b2c3",
  "collection": "Engineering Notes",
  "collection_is_new": false
}
```

Directory/collection names are nonempty strings. The project folder slug, `project_name`, `unique_id`, and extraction `project.unique_id` agree. The globally unique ID uses lowercase kebab-case. `collection_is_new` is a boolean. Use `collection`, not `collection_name`, and `project_name`, not `name`.

## NLP: 03_nlp_entities.json

Save the actual output of `uv run python nlp/preprocess.py`, whose stdin payload is `{"text": "complete source text", "title": "Source title"}`. `entity_candidates` is an array of objects with nonempty `text`. An honest empty array is valid; failed tool output is not.

## Entities: 04_all_entities.json

For a hypothetical source containing `Mira created Atlas. Atlas is an engine.`, a small valid extraction is:

```json
{
  "temporal_phases": [],
  "entities": [
    {
      "name": "Mira",
      "aliases": [],
      "category": "Person",
      "definition": "The named person who created Atlas in this note.",
      "role": "Creator of Atlas.",
      "first_appearance_index": null
    },
    {
      "name": "Atlas",
      "aliases": [],
      "category": "Technology",
      "definition": "The engine created by Mira in this note.",
      "role": "The creation described in the note.",
      "first_appearance_index": null
    }
  ]
}
```

Each entity requires nonempty `name`, `definition`, and `role`, a supported `category`, an alias array (possibly empty), and `first_appearance_index`. Names are unique and relationship references must match exactly. A non-null phase index is an integer referring to an existing phase. Use `null` when there is no supported temporal placement.

Allowed categories:

`Person`, `Organization`, `Place`, `Event`, `Concept`, `System`, `Process`, `Technology`, `Law`, `Agreement`, `Metric`, `Document`, `Resource`, `Other`.

When supported, a temporal phase has `{"index": 1, "label": "Phase title", "period": "Source-supported time period"}`. Indices are distinct nonnegative integers; labels/periods are nonempty strings. Do not invent dates or phases to fit the schema.

## Extraction: 06_extraction.json

The top-level keys are exactly `project`, `relationships`, and `causal_chains`. For the same hypothetical source:

```json
{
  "project": {
    "name": "Mira and Atlas",
    "unique_id": "atlas-note-a1b2c3",
    "summary": "The note identifies Mira as the creator of Atlas and describes Atlas as an engine.",
    "narrative_flow": [],
    "tags": {
      "domain": "Engineering",
      "subdomain": "Engines",
      "base_tags": ["Atlas"]
    }
  },
  "relationships": [
    {
      "source": "Mira",
      "target": "Atlas",
      "relType": "CREATED",
      "causalClassification": "PRODUCES",
      "description": "The note attributes Atlas's creation to Mira.",
      "evidence": "Mira created Atlas.",
      "evidenceStrength": "claimed",
      "magnitude": "significant",
      "year": ""
    }
  ],
  "causal_chains": []
}
```

The project title/ID/summary are nonempty strings. `narrative_flow` is an array of nonempty strings, possibly empty; objects in that array are invalid. Tags contain nonempty `domain`, `subdomain`, and a nonempty `base_tags` array of strings. Keep summaries and tags faithful to source detail rather than padding them.

Every relationship requires the nine fields shown above. Endpoints exactly match entity names. `relType` is a specific verb; `description` explains the supported connection. Use `year` as a string: a source-supported date/period, `ongoing` for a genuinely ongoing relationship, or an empty string when unspecified (validation emits a warning). An empty year is preferable to inventing a date.

Allowed `causalClassification` values:

`CAUSES`, `ENABLES`, `BLOCKS`, `INFLUENCES`, `DEPENDS_ON`, `CONTRADICTS`, `SUPPORTS`, `PRECEDES`, `COMPETES_WITH`, `COOPERATES_WITH`, `REGULATES`, `TRANSFORMS`, `PRODUCES`, `CONSUMES`, `IMPLEMENTS`.

Allowed `evidenceStrength`: `established`, `claimed`, `disputed`, `speculative`. Use the document's level of certainty, not the agent's confidence alone. Allowed `magnitude`: `foundational`, `significant`, `marginal`; choose a proportionate value for the document's context.

A supported causal chain has a nonempty `name`, optional nonempty `description`, and a nonempty `links` array. Each link has nonempty `source`, `target`, and `explanation`, references existing entities, and matches a relationship pair in this extraction. Explain supported causal mechanics; omit a chain when the source does not establish one.

## Embeddings: 05_embeddings.json

Generate this file with `uv run python nlp/embed.py`. Its stdin payload contains equal-length `texts` and `names` arrays: one definition/role text per entity, followed by the project summary. Names are exact entity names, followed by the project `unique_id` as the final name.

Output is an object with `model: "all-MiniLM-L6-v2"`, `dimensions: 384`, and an `embeddings` array. Each entry contains `name`, `embedding` (384 finite numbers), and `dimensions: 384`. Include every entity exactly once, then the project exactly once. A project ID cannot also be an entity name.

Never handcraft vectors, repeat a single vector, or use zero placeholders. The validator checks numeric shape, names, coverage, and zero vectors; only actual model execution establishes model provenance. Treat model failures as failed stages to repair before upload.

## Other artifacts, validation, and upload

`source.md` preserves complete source text. `01_html.html` is safe, readable HTML of the complete source. Preserve both alongside the five JSON artifacts in the new project folder. Do not move new projects into legacy storage.

From `apps/ingestion-pipeline`:

```bash
uv run python neo4j/validate_project.py --human ../../graphs/<collection>/<unique-project>
uv run python neo4j/upload.py ../../graphs/<collection>/<unique-project> --create-only
```

Upload only after validation succeeds. Keep prior collections/projects intact, never use destructive schema cleanup for ingestion, and report failures without claiming complete ingestion. Refresh the web UI and inspect the collection's Documents, Graph, Bridges, and source evidence after successful upload.
