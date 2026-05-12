"""
MemoryTonic v4 — BERT Embedding Script (spawn-and-exit)

Called by Claude during Step 05 of the extraction pipeline.

Input (stdin):  {"texts": ["text1", "text2"], "names": ["label1", "label2"]}
Output (stdout): {"embeddings": [...], "model": "all-MiniLM-L6-v2", "dimensions": 384}

Model: sentence-transformers/all-MiniLM-L6-v2 (384d, cosine similarity)
"""

import sys
import json


def main():
    raw = sys.stdin.read()
    if not raw.strip():
        json.dump({
            "embeddings": [],
            "model": "all-MiniLM-L6-v2",
            "dimensions": 384
        }, sys.stdout)
        return

    data = json.loads(raw)
    texts = data.get("texts", [])
    names = data.get("names", [])

    if not texts:
        json.dump({
            "embeddings": [],
            "model": "all-MiniLM-L6-v2",
            "dimensions": 384
        }, sys.stdout)
        return

    # Load model (once per invocation)
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("all-MiniLM-L6-v2")
    vectors = model.encode(texts, show_progress_bar=False)

    embeddings = []
    for i, vec in enumerate(vectors):
        name = names[i] if i < len(names) else None
        embeddings.append({
            "name": name,
            "embedding": vec.tolist(),
            "dimensions": len(vec),
        })

    result = {
        "embeddings": embeddings,
        "model": "all-MiniLM-L6-v2",
        "dimensions": int(model.get_sentence_embedding_dimension()),
    }

    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
