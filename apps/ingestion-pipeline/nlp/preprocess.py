"""
MemoryTonic v4 — NLP Preprocessing (spawn-and-exit)

Called by Claude during Step 02 of the extraction pipeline.

Input (stdin):  {"text": "...", "title": "..."}
Output (stdout): {
  entity_candidates,   — spaCy NER results with categories + contexts
  co_occurrences,      — entities appearing in same sections
  keywords,            — TF-IDF global top-20
  keywords_by_section, — TF-IDF per-section top-10
  dedup_groups,        — BERT similarity > 0.85 (alias candidates)
  section_count,
  total_entities
}

Models: spaCy en_core_web_lg + sentence-transformers/all-MiniLM-L6-v2
"""

import re
import sys
import json


# ---------------------------------------------------------------
# spaCy label → MT v4 entity category mapping (14 categories)
# ---------------------------------------------------------------

SPACY_TO_CATEGORY = {
    "PERSON": "Person",
    "ORG": "Organization",
    "GPE": "Place",
    "LOC": "Place",
    "FAC": "Place",
    "EVENT": "Event",
    "NORP": "Organization",
    "PRODUCT": "Resource",
    "LAW": "Law",
    "WORK_OF_ART": "Document",
    "LANGUAGE": "Concept",
    "MONEY": "Metric",
    "QUANTITY": "Metric",
    "PERCENT": "Metric",
    # Skip — not entities in our schema:
    "DATE": "_skip",
    "TIME": "_skip",
    "CARDINAL": "_skip",
    "ORDINAL": "_skip",
}


# ---------------------------------------------------------------
# Auto-chunking: split text into sections by paragraph
# ---------------------------------------------------------------

def auto_chunk(text):
    """Split document into sections by double-newline."""
    paragraphs = re.split(r'\n{2,}', text.strip())
    sections = []
    current_heading = None

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        heading_match = re.match(r'^#{1,4}\s+(.+)', para)
        if heading_match:
            current_heading = heading_match.group(1).strip()
            lines = para.split('\n', 1)
            if len(lines) > 1 and lines[1].strip():
                sections.append({
                    "section_id": len(sections),
                    "text": lines[1].strip(),
                    "heading": current_heading,
                })
            continue

        sections.append({
            "section_id": len(sections),
            "text": para,
            "heading": current_heading,
        })

    if not sections:
        sections = [{"section_id": 0, "text": text.strip(), "heading": None}]

    return sections


# ---------------------------------------------------------------
# spaCy NER extraction
# ---------------------------------------------------------------

def extract_entities_spacy(sections, nlp):
    """Run spaCy NER on each section, aggregate by entity text."""
    entity_map = {}

    for section in sections:
        doc = nlp(section["text"])
        for ent in doc.ents:
            label = ent.label_
            category = SPACY_TO_CATEGORY.get(label, "Concept")
            if category.startswith("_"):
                continue

            name = ent.text.strip()
            if name.lower().startswith("the "):
                name = name[4:]
            name = name.strip()

            if len(name) < 2:
                continue

            if name not in entity_map:
                entity_map[name] = {
                    "text": name,
                    "spacy_label": label,
                    "suggested_category": category,
                    "frequency": 0,
                    "sections": set(),
                    "contexts": [],
                }

            entity_map[name]["frequency"] += 1
            entity_map[name]["sections"].add(section["section_id"])

            # Store up to 3 context sentences
            sent = ent.sent.text.strip()[:200] if ent.sent else ""
            if sent and len(entity_map[name]["contexts"]) < 3:
                entity_map[name]["contexts"].append(sent)

    candidates = []
    for e in entity_map.values():
        candidates.append({
            "text": e["text"],
            "spacy_label": e["spacy_label"],
            "suggested_category": e["suggested_category"],
            "frequency": e["frequency"],
            "sections": sorted(e["sections"]),
            "contexts": e["contexts"],
        })
    candidates.sort(key=lambda x: x["frequency"], reverse=True)
    return candidates


# ---------------------------------------------------------------
# Co-occurrence matrix
# ---------------------------------------------------------------

def build_co_occurrence(entities):
    """Which entities appear in the same sections."""
    co_map = {}

    for i, e1 in enumerate(entities):
        for e2 in entities[i + 1:]:
            shared = set(e1["sections"]) & set(e2["sections"])
            if shared:
                key = tuple(sorted([e1["text"], e2["text"]]))
                if key not in co_map:
                    co_map[key] = {"shared_sections": set(), "count": 0}
                co_map[key]["shared_sections"] |= shared
                co_map[key]["count"] = len(co_map[key]["shared_sections"])

    results = []
    for (a, b), data in co_map.items():
        if data["count"] >= 1:
            results.append({
                "entity_a": a,
                "entity_b": b,
                "shared_sections": sorted(data["shared_sections"]),
                "count": data["count"],
            })
    results.sort(key=lambda x: x["count"], reverse=True)
    return results[:200]


# ---------------------------------------------------------------
# TF-IDF keywords
# ---------------------------------------------------------------

def compute_tfidf_keywords(sections):
    """Global and per-section TF-IDF keywords."""
    from sklearn.feature_extraction.text import TfidfVectorizer

    if not sections:
        return [], {}

    texts = [s["text"] for s in sections]
    try:
        vectorizer = TfidfVectorizer(
            max_features=500, stop_words="english",
            ngram_range=(1, 2), min_df=1
        )
        tfidf_matrix = vectorizer.fit_transform(texts)
        feature_names = vectorizer.get_feature_names_out()
    except ValueError:
        return [], {}

    # Global top-20
    global_scores = tfidf_matrix.sum(axis=0).A1
    top_indices = global_scores.argsort()[-20:][::-1]
    global_keywords = [
        {"term": feature_names[i], "score": round(float(global_scores[i]), 4)}
        for i in top_indices if global_scores[i] > 0
    ]

    # Per-section top-10
    section_keywords = {}
    for idx, section in enumerate(sections):
        row = tfidf_matrix[idx].toarray().flatten()
        top = row.argsort()[-10:][::-1]
        section_keywords[str(section["section_id"])] = [
            feature_names[i] for i in top if row[i] > 0
        ]

    return global_keywords, section_keywords


# ---------------------------------------------------------------
# BERT dedup (alias detection)
# ---------------------------------------------------------------

def deduplicate_entities(entities, embedder):
    """Find entity names that likely refer to the same thing (cosine > 0.85)."""
    import numpy as np

    if len(entities) < 2:
        return []

    names = [e["text"] for e in entities]
    embeddings = embedder.encode(names, show_progress_bar=False)

    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1
    normalized = embeddings / norms
    sim_matrix = normalized @ normalized.T

    visited = set()
    groups = []

    for i in range(len(names)):
        if i in visited:
            continue
        group = [names[i]]
        visited.add(i)
        for j in range(i + 1, len(names)):
            if j in visited:
                continue
            if sim_matrix[i][j] > 0.85:
                group.append(names[j])
                visited.add(j)
        if len(group) > 1:
            groups.append(group)

    return groups


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------

def main():
    raw = sys.stdin.read()
    if not raw.strip():
        json.dump({"error": "No input"}, sys.stdout)
        sys.exit(1)

    data = json.loads(raw)
    text = data.get("text", "")

    if not text.strip():
        json.dump({"error": "Empty text"}, sys.stdout)
        sys.exit(1)

    # Monkeypatch for Pydantic v1 on Python 3.12 compatibility inside spaCy
    import pydantic.v1.typing
    from typing import Any
    if hasattr(pydantic.v1.typing, "evaluate_forwardref"):
        original_evaluate_forwardref = pydantic.v1.typing.evaluate_forwardref
        def patched_evaluate_forwardref(type_, globalns, localns=None):
            try:
                return original_evaluate_forwardref(type_, globalns, localns)
            except TypeError as e:
                if "recursive_guard" in str(e):
                    from typing import cast
                    return cast(Any, type_)._evaluate(globalns, localns, recursive_guard=set())
                raise
        pydantic.v1.typing.evaluate_forwardref = patched_evaluate_forwardref

    # Load models (once per invocation)
    import spacy
    from sentence_transformers import SentenceTransformer

    nlp = spacy.load("en_core_web_lg")
    embedder = SentenceTransformer("all-MiniLM-L6-v2")

    # Process
    sections = auto_chunk(text)
    entities = extract_entities_spacy(sections, nlp)
    co_occurrences = build_co_occurrence(entities)
    global_keywords, section_keywords = compute_tfidf_keywords(sections)
    dedup_groups = deduplicate_entities(entities, embedder)

    result = {
        "entity_candidates": entities,
        "co_occurrences": co_occurrences,
        "keywords": global_keywords,
        "keywords_by_section": section_keywords,
        "dedup_groups": dedup_groups,
        "total_entities": len(entities),
        "total_co_occurrences": len(co_occurrences),
        "section_count": len(sections),
    }

    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
