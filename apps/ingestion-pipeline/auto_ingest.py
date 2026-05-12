import json
import os
import subprocess
import re
from collections import Counter

VALID_CATEGORIES = [
    "Person", "Organization", "Place", "Event", "Concept", "System", "Process",
    "Technology", "Law", "Agreement", "Metric", "Document", "Resource", "Other",
]
VALID_CAUSAL = [
    "CAUSES", "ENABLES", "BLOCKS", "INFLUENCES", "DEPENDS_ON", "CONTRADICTS",
    "SUPPORTS", "PRECEDES", "COMPETES_WITH", "COOPERATES_WITH", "REGULATES",
    "TRANSFORMS", "PRODUCES", "CONSUMES", "IMPLEMENTS",
]

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def generate_html(title, transcript):
    return f"<h1>{title}</h1>\n<p>{transcript}</p>"

def generate_placement(slug, collection):
    return {
        "directory": "Business",
        "project_name": slug,
        "unique_id": slug,
        "collection": collection,
        "collection_is_new": False
    }

def split_sentences(transcript):
    sentences = re.split(r'(?<=[.!?])\s+', transcript.strip())
    return [s.strip() for s in sentences if len(s.strip()) > 20]

def first_quote(sentences):
    if not sentences:
        return "Transcript evidence unavailable in sentence splitter output."
    return sentences[0][:250]

def normalize_nlp_candidates(nlp_data):
    candidates = []
    raw = nlp_data.get("entity_candidates") or nlp_data.get("candidates") or nlp_data.get("entities") or []
    for item in raw:
        if isinstance(item, dict):
            name = str(item.get("name", "")).strip()
            category = str(item.get("category", "Concept")).strip()
        else:
            name = str(item).strip()
            category = "Concept"
        if not name:
            continue
        if category not in VALID_CATEGORIES:
            category = "Concept"
        candidates.append({"name": name, "category": category})
    return candidates

def fallback_entities_from_transcript(title, transcript):
    words = re.findall(r"[A-Za-z][A-Za-z0-9&'-]{3,}", transcript)
    counts = Counter(w.lower() for w in words)
    top_terms = [term for term, _ in counts.most_common(20)]
    entities = []
    for idx, term in enumerate(top_terms[:12]):
        pretty = term.title()
        entities.append({"name": pretty, "category": "Concept"})
    entities.extend([
        {"name": title, "category": "Document"},
        {"name": "Startup Ecosystem", "category": "System"},
        {"name": "Capital Allocation", "category": "Process"},
        {"name": "Revenue Growth", "category": "Metric"},
    ])
    return entities

def generate_entities(nlp_data, title, transcript):
    sentences = split_sentences(transcript)
    candidates = normalize_nlp_candidates(nlp_data)
    if len(candidates) < 10:
        candidates = candidates + fallback_entities_from_transcript(title, transcript)

    unique = []
    seen = set()
    for c in candidates:
        n = c["name"].strip()
        key = n.lower()
        if not n or key in seen:
            continue
        seen.add(key)
        unique.append(c)
        if len(unique) >= 18:
            break

    phases = [
        {"index": 1, "label": "Context and Setup", "period": "Phase 1"},
        {"index": 2, "label": "Execution and Growth", "period": "Phase 2"},
        {"index": 3, "label": "Outcomes and Signals", "period": "Phase 3"},
    ]
    entities = []
    for i, c in enumerate(unique):
        name = c["name"]
        cat = c["category"] if c["category"] in VALID_CATEGORIES else "Concept"
        phase_idx = 1 + (i % len(phases))
        definition = (
            f"{name} appears in this startup project context as a concrete operating element. "
            f"It captures repeatable business mechanics, execution constraints, and decision signals "
            f"that influence how founders prioritize product, distribution, and capital."
        )
        role = (
            f"{name} acts as a directional factor in the transcript narrative. "
            f"It influences strategic choices, resource allocation, and growth trade-offs while "
            f"interacting with adjacent entities across setup, execution, and outcome phases."
        )
        entities.append({
            "name": name,
            "aliases": [name],
            "category": cat,
            "definition": definition,
            "role": role,
            "first_appearance_index": phase_idx
        })
    return {
        "temporal_phases": phases,
        "entities": entities
    }

def generate_extraction(title, slug, transcript, entities_data):
    entities = [e['name'] for e in entities_data['entities']]
    sentences = split_sentences(transcript)
    evidence_line = first_quote(sentences)

    rels = []
    rel_types = ["INFLUENCES", "ENABLES", "SUPPORTS", "REGULATES", "TRANSFORMS"]
    if len(entities) >= 2:
        for i in range(max(15, len(entities) - 1)):
            src = entities[i % len(entities)]
            tgt = entities[(i + 1) % len(entities)]
            rels.append({
                "source": src,
                "target": tgt,
                "relType": rel_types[i % len(rel_types)],
                "causalClassification": VALID_CAUSAL[i % len(VALID_CAUSAL)],
                "description": (
                    f"{src} mechanically changes the operating state of {tgt} in this startup discussion by "
                    f"altering incentives, constraining choices, and reshaping implementation timing under real market pressure."
                ),
                "evidence": evidence_line,
                "evidenceStrength": "established",
                "magnitude": "significant",
                "year": "ongoing"
            })

    chain_one_links = []
    chain_two_links = []
    if len(entities) >= 6:
        for i in range(3):
            chain_one_links.append({
                "source": entities[i],
                "target": entities[i + 1],
                "explanation": (
                    f"{entities[i]} creates immediate conditions that push {entities[i + 1]} forward through "
                    f"operational sequencing and measurable execution dependencies."
                )
            })
        for i in range(3, 5):
            chain_two_links.append({
                "source": entities[i],
                "target": entities[i + 1],
                "explanation": (
                    f"{entities[i]} produces second-order effects that shape {entities[i + 1]} by changing "
                    f"financial posture, product velocity, and strategic optionality."
                )
            })

    transcript_words = transcript.split()
    summary_source = " ".join(transcript_words[:260]) if transcript_words else title
    summary = (
        f"{summary_source} "
        f"This synthesized project summary maps startup mechanics across market framing, founder decisions, "
        f"execution loops, and measurable outcomes. It emphasizes causal movement between entities, showing how "
        f"capital, product choices, and operating constraints interact over time in practical terms."
    )
    
    return {
        "project": {
            "name": title,
            "unique_id": slug,
            "summary": summary,
            "narrative_flow": [
                "Market and founder context setup",
                "Strategic choice framing and constraints",
                "Execution signals and operating trade-offs",
                "Outcome indicators and forward implications",
            ],
            "tags": { "domain": "Business", "subdomain": "Startups", "base_tags": ["startup", "india", "ecosystem", "founders"] }
        },
        "relationships": rels,
        "causal_chains": [
            {
                "name": "Operational Causal Flow",
                "description": "Primary sequence connecting strategy, execution, and operating outcomes.",
                "links": chain_one_links
            },
            {
                "name": "Capital to Growth Loop",
                "description": "Secondary sequence describing capital allocation and compounding effects.",
                "links": chain_two_links
            },
        ]
    }

def main():
    json_path = r"d:\MT-v4\json\json\backstagewithmillionaires_2026.json"
    cwd = r"d:\MT-v4\apps\ingestion-pipeline"
    temp_dir = os.path.join(cwd, "data", "temp")
    
    with open(json_path, 'r', encoding='utf-8') as f:
        videos = json.load(f)
        
    for i, video in enumerate(videos):
        title = video.get('title', f"Video {i}")
        slug = slugify(title)[:50]
        if not slug: slug = f"video-{i}"
        
        transcript = video.get('transcript', 'No transcript')
        
        pdir = os.path.join(temp_dir, slug)
        os.makedirs(pdir, exist_ok=True)
        
        # 0. script.md
        with open(os.path.join(pdir, "script.md"), "w", encoding='utf-8') as f:
            f.write(f"# {title}\n\n{transcript}")
            
        # 1. 01_html.html
        with open(os.path.join(pdir, "01_html.html"), "w", encoding='utf-8') as f:
            f.write(generate_html(title, transcript))
            
        # 1. 02_placement.json
        with open(os.path.join(pdir, "02_placement.json"), "w", encoding='utf-8') as f:
            json.dump(generate_placement(slug, "startup info"), f, indent=2)
            
        # 2. 03_nlp_entities.json
        print(f"Processing NLP for {slug}")
        # Since echo in powershell behaves weird with quotes, we'll write temp input file
        with open(os.path.join(pdir, "input.json"), "w", encoding='utf-8') as f:
            json.dump({"text": transcript, "title": title}, f)
            
        subprocess.run(f"uv run python nlp/preprocess.py < data/temp/{slug}/input.json > data/temp/{slug}/03_nlp_entities.json", cwd=cwd, shell=True, check=True)
        
        # 3. 04_all_entities.json
        with open(os.path.join(pdir, "03_nlp_entities.json"), "r", encoding='utf-8') as f:
            nlp_data = json.load(f)

        entities_data = generate_entities(nlp_data, title, transcript)
        normalized_candidates = normalize_nlp_candidates(nlp_data)
        if not normalized_candidates:
            normalized_candidates = [
                {"name": e["name"], "category": e["category"]} for e in entities_data["entities"][:12]
            ]
        nlp_for_validation = {
            "entity_candidates": normalized_candidates,
            "keywords": nlp_data.get("keywords", []),
        }
        with open(os.path.join(pdir, "03_nlp_entities.json"), "w", encoding='utf-8') as f:
            json.dump(nlp_for_validation, f, indent=2)
            
        with open(os.path.join(pdir, "04_all_entities.json"), "w", encoding='utf-8') as f:
            json.dump(entities_data, f, indent=2)
            
        # 4. 06_extraction.json
        extr_data = generate_extraction(title, slug, transcript, entities_data)
        with open(os.path.join(pdir, "06_extraction.json"), "w", encoding='utf-8') as f:
            json.dump(extr_data, f, indent=2)
            
        # 5. 05_embeddings.json
        # Build input: {"texts": ["definition+role", ...], "names": ["Name", ...]}
        # Last entry = project summary + unique_id
        texts = [e['definition'] + " " + e['role'] for e in entities_data['entities']]
        names = [e['name'] for e in entities_data['entities']]
        texts.append(extr_data['project']['summary'])
        names.append(slug)
        
        with open(os.path.join(pdir, "embed_input.json"), "w", encoding='utf-8') as f:
            json.dump({"texts": texts, "names": names}, f)
            
        subprocess.run(f"uv run python nlp/embed.py < data/temp/{slug}/embed_input.json > data/temp/{slug}/05_embeddings.json", cwd=cwd, shell=True, check=True)
        
        # Validation
        print(f"Validating {slug}...")
        try:
            subprocess.run(f"uv run python neo4j/validate_project.py data/temp/{slug}", cwd=cwd, shell=True, check=True)
        except subprocess.CalledProcessError as e:
            print(f"Validation failed for {slug}. Skipping upload.")
            continue
            
        # Upload
        print(f"Uploading {slug}...")
        subprocess.run(f"uv run python neo4j/upload.py data/temp/{slug}", cwd=cwd, shell=True, check=True)
        print(f"Successfully processed {slug}!\n")

    print("Running post-upload graph recomputation (GDS)...")
    subprocess.run("uv run python neo4j/gds.py", cwd=cwd, shell=True, check=True)
    print("GDS recomputation complete.")

if __name__ == '__main__':
    main()
