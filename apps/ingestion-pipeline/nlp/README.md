# NLP

Python scripts for NLP preprocessing and embeddings.
Spawn-and-exit architecture — no persistent service.

## Scripts
- `preprocess.py` — spaCy NER + TF-IDF keywords + co-occurrences + BERT dedup (Step 02)
- `embed.py` — BERT all-MiniLM-L6-v2 embeddings, 384d (Step 05)
- `setup-nlp.py` — Creates .venv, installs deps, downloads models (~640MB)
- `requirements.txt` — spacy, sentence-transformers, scikit-learn, numpy

## First-Time Setup
```bash
python nlp/setup-nlp.py
```

## Architecture
- Each invocation spawns Python, pipes JSON in via stdin, reads JSON out via stdout, script exits.
- No persistent Python service running.
- Model loads once per invocation (~2-5 seconds).
- .venv is gitignored (created locally by setup-nlp.py).

## Detailed Usage
See `skills/nlp-setup-skill.md` for full I/O contracts, error handling, and examples.
