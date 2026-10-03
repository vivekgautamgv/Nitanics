# NLP Setup Skill

**Purpose:** How to set up and call the Python NLP scripts.
**Future:** Becomes part of `memorytonic_health` / `memorytonic_setup_nlp` MCP tools.

---

## Architecture: Spawn-and-Exit

No persistent Python service. No port. No health checks.

```
Claude needs NLP → spawns Python script → pipes JSON to stdin →
reads JSON from stdout → script exits. Done.
```

Each call is independent. Model loads once per invocation (~2-5 seconds), processes, returns, exits.

---

## First-Time Setup

Run once to create .venv and download models:

```bash
cd components/01-ingestion
python nlp/setup-nlp.py
```

This creates:
```
nlp/.venv/           (~640MB total)
  ├── spaCy en_core_web_lg     (~560MB)
  └── BERT all-MiniLM-L6-v2   (~80MB)
```

**Requirements:** Python 3.9+

---

## Calling preprocess.py (Step 02)

**What it does:** spaCy NER + TF-IDF keywords + co-occurrences + BERT alias detection.

**How Claude calls it:**
```bash
# Activate venv and run
echo '{"text": "full document text...", "title": "project name"}' | \
  nlp/.venv/Scripts/python.exe nlp/preprocess.py
```

**Input (JSON via stdin):**
```json
{
  "text": "The full document text...",
  "title": "petrodollar-system"
}
```

**Output (JSON via stdout):**
```json
{
  "entity_candidates": [
    {
      "text": "Henry Kissinger",
      "spacy_label": "PERSON",
      "suggested_category": "Person",
      "frequency": 12,
      "sections": [3, 5, 7, 12],
      "contexts": ["Kissinger negotiated the 1974 pact...", "..."]
    }
  ],
  "co_occurrences": [
    {
      "entity_a": "Henry Kissinger",
      "entity_b": "Saudi Arabia",
      "shared_sections": [3, 5],
      "count": 2
    }
  ],
  "keywords": [
    {"term": "petrodollar", "score": 4.2301},
    {"term": "oil pricing", "score": 3.8912}
  ],
  "keywords_by_section": {
    "0": ["bretton woods", "gold standard"],
    "3": ["kissinger", "saudi", "military protection"]
  },
  "dedup_groups": [
    ["IMF", "International Monetary Fund"],
    ["US", "United States", "America"]
  ],
  "total_entities": 45,
  "section_count": 28
}
```

---

## Calling embed.py (Step 05)

**What it does:** Generates BERT 384d embeddings for text strings.

**How Claude calls it:**
```bash
echo '{"texts": ["text1", "text2"], "names": ["label1", "label2"]}' | \
  nlp/.venv/Scripts/python.exe nlp/embed.py
```

**Input (JSON via stdin):**
```json
{
  "texts": [
    "Henry Kissinger: US Secretary of State who architected the petrodollar system...",
    "Saudi Arabia: Kingdom that exchanged dollar-denominated oil for military protection..."
  ],
  "names": ["Henry Kissinger", "Saudi Arabia"]
}
```

**Output (JSON via stdout):**
```json
{
  "embeddings": [
    {
      "name": "Henry Kissinger",
      "embedding": [0.023, -0.041, 0.087, ...],
      "dimensions": 384
    },
    {
      "name": "Saudi Arabia",
      "embedding": [0.012, 0.056, -0.033, ...],
      "dimensions": 384
    }
  ],
  "model": "all-MiniLM-L6-v2",
  "dimensions": 384
}
```

---

## What to Embed (Step 05 specifics)

Embed the FINAL rich data from Steps 03 + 04, not bare names:

```
For each entity:
  text = "{entity.name}: {entity.definition}. {entity.role}"
  → This captures what the entity IS + what it DOES

For the project:
  text = "{project.name}: {project.summary}"
  → This captures the project's subject and scope
```

---

## Error Handling

| Situation | Response |
|-----------|----------|
| .venv doesn't exist | Run `python nlp/setup-nlp.py` first |
| Python not found | Install Python 3.9+ from python.org |
| Script outputs error JSON | Read error message, fix input |
| Script times out (>120s) | Text might be too long. Chunk it. |
| Model download fails | Check internet, retry setup |

---

## Electron Packaging (Component 5 — Future)

Three options for shipping Python with the desktop app:
1. **First-run setup** — app detects Python, creates venv, downloads models
2. **Bundle compiled .exe** — PyInstaller the scripts, no Python needed
3. **Replace with JavaScript** — transformers.js + compromise.js

Decision deferred to Component 5. The JSON in/out contract stays the same regardless.

---

## File Locations

```
components/01-ingestion/nlp/
├── preprocess.py      ← Step 02: NLP entity extraction
├── embed.py           ← Step 05: BERT embeddings (384d)
├── setup-nlp.py       ← First-time setup (creates .venv)
├── requirements.txt   ← Python dependencies
└── .venv/             ← Created by setup-nlp.py (gitignored)
```
