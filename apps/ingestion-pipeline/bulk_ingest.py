import os
import sys
import json
import re
import argparse
import subprocess
import urllib.request
import urllib.error
from datetime import datetime

# Valid schemas for Nitanics validation compatibility
VALID_CATEGORIES = [
    "Person", "Organization", "Place", "Event", "Concept", "System", "Process",
    "Technology", "Law", "Agreement", "Metric", "Document", "Resource", "Other",
]

VALID_CAUSAL = [
    "CAUSES", "ENABLES", "BLOCKS", "INFLUENCES", "DEPENDS_ON", "CONTRADICTS",
    "SUPPORTS", "PRECEDES", "COMPETES_WITH", "COOPERATES_WITH", "REGULATES",
    "TRANSFORMS", "PRODUCES", "CONSUMES", "IMPLEMENTS",
]

VALID_EVIDENCE_STRENGTH = ["established", "claimed", "disputed", "speculative"]
VALID_MAGNITUDE = ["foundational", "significant", "marginal"]

# Clean slugs for unique_ids
def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

# Wrap text in dark-themed HTML template
def wrap_html(title, content):
    css_block = """
/* MemoryTonic Investigation Viewer — v1 */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --bg: #0b0c0e;
  --bg-surface: #12141a;
  --bg-elevated: #1a1d25;
  --text: #c8ccd4;
  --text-muted: #6b7280;
  --text-bright: #e8ecf4;
  --accent: #60a5fa;
  --accent-dim: #2563eb;
  --narrator-border: #374151;
  --gs-border: #d97706;
  --gs-bg: rgba(217, 119, 6, 0.04);
  --gs-tag: #f59e0b;
  --divider: #1e2028;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
}

html {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 17px;
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
}

body {
  max-width: 740px;
  margin: 0 auto;
  padding: 2rem 1.5rem 6rem;
}

article { position: relative; }

.hero {
  padding: 4rem 0 3rem;
  border-bottom: 1px solid var(--divider);
  margin-bottom: 3rem;
}
.hero-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1rem;
}
.hero h1 {
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--text-bright);
  line-height: 1.2;
  margin-bottom: 0.75rem;
}
.hero-meta {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.moment {
  position: relative;
  padding: 2.5rem 0;
  border-bottom: 1px solid var(--divider);
}
.moment:last-of-type {
  border-bottom: none;
}

.moment-number {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent-dim);
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
}

.moment h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-bright);
  margin-bottom: 1.5rem;
  line-height: 1.3;
}

.voice {
  margin: 1.25rem 0;
  padding: 1.25rem 1.5rem;
  border-left: 3px solid var(--narrator-border);
  border-radius: 0 6px 6px 0;
  background: var(--bg-surface);
}
.voice p {
  margin-bottom: 0.9rem;
}
.voice p:last-child {
  margin-bottom: 0;
}

.voice-tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  margin-bottom: 0.75rem;
}

.voice-narrator .voice-tag {
  color: var(--text-muted);
  background: var(--bg-elevated);
}

strong {
  color: var(--text-bright);
  font-weight: 600;
}
em {
  color: var(--accent);
  font-style: italic;
}

blockquote {
  border-left: 3px solid var(--accent-dim);
  padding: 0.75rem 1.25rem;
  margin: 1rem 0;
  background: var(--bg-elevated);
  border-radius: 0 4px 4px 0;
  color: var(--text);
  font-style: italic;
}

ul, ol {
  margin: 1rem 0;
  padding-left: 1.5rem;
}
li {
  margin-bottom: 0.5rem;
}
li strong {
  color: var(--accent);
}

.investigation-footer {
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid var(--divider);
  text-align: center;
}
.investigation-footer p {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-muted);
}
"""
    # Simple conversion of markdown paragraphs to HTML paragraphs
    paragraphs = content.split('\n\n')
    body_html = ""
    for idx, p in enumerate(paragraphs):
        p = p.strip()
        if not p:
            continue
        # Convert header
        if p.startswith('# '):
            body_html += f"<h1>{p[2:]}</h1>\n"
        elif p.startswith('## '):
            body_html += f"<section class='moment'>\n<div class='moment-number'>{idx+1:02d}</div>\n<h2>{p[3:]}</h2>\n"
        elif p.startswith('### '):
            body_html += f"<h3>{p[4:]}</h3>\n"
        else:
            # Wrap standard text in a voice block
            cleaned_text = p.replace('**', '')
            body_html += f"<div class='voice voice-narrator'>\n<span class='voice-tag'>NARRATOR</span>\n<p>{cleaned_text}</p>\n</div>\n"
            if p.startswith('## '):
                body_html += "</section>\n"
                
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
{css_block}
</style>
</head>
<body>
<article>
  <header class="hero">
    <div class="hero-label">MEMORYTONIC DOCUMENT</div>
    <h1>{title}</h1>
    <p class="hero-meta">AUTOMATED EXTRACTION</p>
  </header>
  {body_html}
  <footer class="investigation-footer">
    <p>Extracted by MemoryTonic Bulk Ingestion</p>
  </footer>
</article>
</body>
</html>"""

# Extract plain text from PDF if pypdf is installed
def extract_pdf_text(filepath):
    try:
        import pypdf
        reader = pypdf.PdfReader(filepath)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text
    except ImportError:
        print("Warning: 'pypdf' is not installed. PDF files cannot be processed.")
        print("Please install pypdf via 'pip install pypdf' or 'uv pip install pypdf'")
        return None

# LLM caller that handles key checking, standard POST requests, and markdown JSON cleaning
def call_llm(prompt, system_instruction=None, model="gemini-2.5-flash"):
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    
    # Priority: Gemini -> OpenAI -> Anthropic
    if gemini_key:
        # Use Gemini API (Gemini 2.5 Flash)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
        headers = {"Content-Type": "application/json"}
        
        contents_item = {"parts": [{"text": prompt}]}
        payload = {"contents": [contents_item]}
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        payload["generationConfig"] = {"responseMimeType": "application/json"}
        
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req) as res:
                response = json.loads(res.read().decode('utf-8'))
                text_out = response['candidates'][0]['content']['parts'][0]['text']
                return text_out
        except urllib.error.HTTPError as e:
            print(f"Gemini API Error: {e.code} - {e.read().decode('utf-8')}")
            raise e
            
    elif openai_key:
        # Use OpenAI API (gpt-4o-mini as default for cost-efficiency)
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {openai_key}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": "gpt-4o-mini",
            "messages": messages,
            "response_format": {"type": "json_object"}
        }
        
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req) as res:
                response = json.loads(res.read().decode('utf-8'))
                text_out = response['choices'][0]['message']['content']
                return text_out
        except urllib.error.HTTPError as e:
            print(f"OpenAI API Error: {e.code} - {e.read().decode('utf-8')}")
            raise e
            
    elif anthropic_key:
        # Use Anthropic API (claude-3-5-sonnet)
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": anthropic_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        
        prompt_with_system = prompt
        if system_instruction:
            prompt_with_system = f"{system_instruction}\n\n{prompt}"
            
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 4000,
            "messages": [{"role": "user", "content": prompt_with_system + "\n\nRespond strictly in valid JSON format."}]
        }
        
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req) as res:
                response = json.loads(res.read().decode('utf-8'))
                text_out = response['content'][0]['text']
                return text_out
        except urllib.error.HTTPError as e:
            print(f"Anthropic API Error: {e.code} - {e.read().decode('utf-8')}")
            raise e
    else:
        raise ValueError("No API keys found. Please set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.")

# Helper to sanitize and load JSON from LLM response
def clean_and_load_json(raw_text):
    cleaned = raw_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return json.loads(cleaned.strip())

# Segment a long document into logical parts
def chunk_document(text, chunk_size):
    if len(text) <= chunk_size:
        return [text]
    
    # Split by double newline to avoid breaking paragraphs
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = []
    current_size = 0
    
    for p in paragraphs:
        p_len = len(p)
        if current_size + p_len > chunk_size and current_chunk:
            chunks.append('\n\n'.join(current_chunk))
            current_chunk = [p]
            current_size = p_len
        else:
            current_chunk.append(p)
            current_size += p_len + 2 # account for double newline
            
    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))
        
    return chunks

def process_project(project_name, project_slug, text, collection, directory, cwd, model):
    print(f"\n--- Starting Ingestion Pipeline for: {project_name} ({project_slug}) ---")
    temp_dir = os.path.join(cwd, "data", "temp", project_slug)
    os.makedirs(temp_dir, exist_ok=True)
    
    # Step 0: Save script.md
    print("Step 0: Saving raw text script...")
    with open(os.path.join(temp_dir, "script.md"), "w", encoding='utf-8') as f:
        f.write(f"# {project_name}\n\n{text}")
        
    # Step 1: HTML & Placement
    print("Step 1: Generating HTML and placement metadata...")
    with open(os.path.join(temp_dir, "01_html.html"), "w", encoding='utf-8') as f:
        f.write(wrap_html(project_name, text))
        
    placement = {
        "directory": directory,
        "project_name": project_slug,
        "unique_id": project_slug,
        "collection": collection,
        "collection_is_new": False
    }
    with open(os.path.join(temp_dir, "02_placement.json"), "w", encoding='utf-8') as f:
        json.dump(placement, f, indent=2)
        
    # Step 2: NLP preprocessing
    print("Step 2: Performing NLP preprocessing...")
    with open(os.path.join(temp_dir, "input.json"), "w", encoding='utf-8') as f:
        json.dump({"text": text, "title": project_name}, f)
        
    try:
        subprocess.run(
            f"uv run python nlp/preprocess.py < data/temp/{project_slug}/input.json > data/temp/{project_slug}/03_nlp_entities.json",
            cwd=cwd, shell=True, check=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Warning: NLP preprocessing failed ({e}). Generating fallback empty candidates.")
        with open(os.path.join(temp_dir, "03_nlp_entities.json"), "w", encoding='utf-8') as f:
            json.dump({"entity_candidates": [], "keywords": []}, f, indent=2)
            
    # Read NLP candidates
    with open(os.path.join(temp_dir, "03_nlp_entities.json"), "r", encoding='utf-8') as f:
        nlp_data = json.load(f)
    nlp_candidates = nlp_data.get("entity_candidates", [])
    
    # Step 3: Entity Discovery via LLM
    print("Step 3: Discovering high-quality entities via LLM...")
    entity_system_prompt = (
        "You are an expert NLP and knowledge graph architect. Your goal is to analyze the source document "
        "and return a list of discovered entities and temporal phases in strict JSON format.\n"
        "Rules:\n"
        "1. Every real, non-noise candidate from the provided NLP candidate list MUST be preserved (NLP reconciliation).\n"
        "2. Add LLM-only entities (concepts, systems, processes) that the simple NLP scanner missed.\n"
        "3. Write a highly detailed definition (100+ characters) explaining system mechanics for each entity.\n"
        "4. Write a role (describing stance, mechanics, and reasoning) for each entity.\n"
        "5. Group categories strictly into: Person, Organization, Place, Event, Concept, System, Process, "
        "Technology, Law, Agreement, Metric, Document, Resource, Other.\n"
        "6. Provide 1-3 aliases for each entity (critical for cross-project merging).\n"
        "7. Map entities to temporal phases with a first_appearance_index."
    )
    
    entity_prompt = f"""
Source text:
\"\"\"
{text}
\"\"\"

NLP Candidate List:
{json.dumps(nlp_candidates, indent=2)}

Return a JSON object in this exact schema (no other text):
{{
  "temporal_phases": [
    {{ "index": 1, "label": "Phase Label", "period": "Timeframe" }}
  ],
  "entities": [
    {{
      "name": "Exact Entity Name",
      "aliases": ["Alias A", "Alias B"],
      "category": "Concept",
      "definition": "100+ characters detailing the system mechanics...",
      "role": "Stance, mechanics, and reasoning...",
      "first_appearance_index": 1
    }}
  ]
}}
"""
    raw_entities = call_llm(entity_prompt, entity_system_prompt, model)
    entities_data = clean_and_load_json(raw_entities)
    
    # Normalize categories
    for ent in entities_data.get("entities", []):
        if ent.get("category") not in VALID_CATEGORIES:
            ent["category"] = "Concept"
            
    with open(os.path.join(temp_dir, "04_all_entities.json"), "w", encoding='utf-8') as f:
        json.dump(entities_data, f, indent=2)
        
    # Step 4: Relationship & Causal Chain Extraction via LLM
    print("Step 4: Extracting relationships and causal chains via LLM...")
    extraction_system_prompt = (
        "You are an expert knowledge graph architect. Your goal is to analyze the source document and the "
        "provided entities, and construct a high-density, valid graph representation in strict JSON format.\n"
        "Rules:\n"
        "1. Write a detailed summary (200+ words) of the document's system mechanics.\n"
        "2. Provide narrative_flow as an array of strings (4+ key moments).\n"
        "3. Provide project tags (domain, subdomain, 3+ base_tags).\n"
        "4. Construct 15+ RELATES_TO relationships. Every relationship source and target MUST exactly match one of the entity names from the provided list.\n"
        "5. The causalClassification must be exactly one of: CAUSES, ENABLES, BLOCKS, INFLUENCES, DEPENDS_ON, CONTRADICTS, SUPPORTS, PRECEDES, COMPETES_WITH, COOPERATES_WITH, REGULATES, TRANSFORMS, PRODUCES, CONSUMES, IMPLEMENTS.\n"
        "6. Edge descriptions must be 80+ characters detailing HOW the relationship works, and include an exact quote as evidence.\n"
        "7. Include 2+ causal chains (each with 3+ links) showing sequencing of operational effects."
    )
    
    entity_names = [e["name"] for e in entities_data.get("entities", [])]
    extraction_prompt = f"""
Source text:
\"\"\"
{text}
\"\"\"

Discovered Entity Names:
{json.dumps(entity_names, indent=2)}

Return a JSON object in this exact schema (no other text, must include the "project" wrapper):
{{
  "project": {{
    "name": "{project_name}",
    "unique_id": "{project_slug}",
    "summary": "200+ words detailing system mechanics...",
    "narrative_flow": [
      "Key moment 1 as a string",
      "Key moment 2 as a string"
    ],
    "tags": {{
      "domain": "Economics",
      "subdomain": "Finance",
      "base_tags": ["tag1", "tag2", "tag3"]
    }}
  }},
  "relationships": [
    {{
      "source": "Entity A",
      "target": "Entity B",
      "relType": "SPECIFIC_VERB",
      "causalClassification": "ENABLES",
      "description": "80+ characters explaining the mechanic in detail...",
      "evidence": "Exact quote from text",
      "evidenceStrength": "established",
      "magnitude": "foundational",
      "year": "1974"
    }}
  ],
  "causal_chains": [
    {{
      "name": "Chain Name",
      "description": "What this chain traces",
      "links": [
        {{
          "source": "Entity A",
          "target": "Entity B",
          "explanation": "HOW and WHY"
        }}
      ]
    }}
  ]
}}
"""
    raw_extraction = call_llm(extraction_prompt, extraction_system_prompt, model)
    extraction_data = clean_and_load_json(raw_extraction)
    
    # Normalize relationship enums and cross-references
    clean_relationships = []
    for rel in extraction_data.get("relationships", []):
        src = rel.get("source")
        tgt = rel.get("target")
        if src in entity_names and tgt in entity_names:
            if rel.get("causalClassification") not in VALID_CAUSAL:
                rel["causalClassification"] = "INFLUENCES"
            if rel.get("evidenceStrength") not in VALID_EVIDENCE_STRENGTH:
                rel["evidenceStrength"] = "claimed"
            if rel.get("magnitude") not in VALID_MAGNITUDE:
                rel["magnitude"] = "significant"
            clean_relationships.append(rel)
    extraction_data["relationships"] = clean_relationships
    
    with open(os.path.join(temp_dir, "06_extraction.json"), "w", encoding='utf-8') as f:
        json.dump(extraction_data, f, indent=2)
        
    # Step 5: Local Embeddings
    print("Step 5: Generating local BERT embeddings...")
    embed_texts = [e['definition'] + " " + e['role'] for e in entities_data.get('entities', [])]
    embed_names = [e['name'] for e in entities_data.get('entities', [])]
    # Add project summary
    embed_texts.append(extraction_data['project']['summary'])
    embed_names.append(project_slug)
    
    with open(os.path.join(temp_dir, "embed_input.json"), "w", encoding='utf-8') as f:
        json.dump({"texts": embed_texts, "names": embed_names}, f)
        
    try:
        subprocess.run(
            f"uv run python nlp/embed.py < data/temp/{project_slug}/embed_input.json > data/temp/{project_slug}/05_embeddings.json",
            cwd=cwd, shell=True, check=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Warning: Embeddings script failed ({e}). Mocking embeddings.")
        mock_embeddings = {
            "model": "mock",
            "dimensions": 384,
            "embeddings": [{"name": name, "embedding": [0.0]*384, "dimensions":384} for name in embed_names]
        }
        with open(os.path.join(temp_dir, "05_embeddings.json"), "w", encoding='utf-8') as f:
            json.dump(mock_embeddings, f, indent=2)
            
    # Step 5.5: Validation Gate
    print("Step 5.5: Validating schemas...")
    try:
        subprocess.run(f"uv run python neo4j/validate_project.py data/temp/{project_slug}", cwd=cwd, shell=True, check=True)
        print("Validation: PASS")
    except subprocess.CalledProcessError as e:
        print(f"Validation FAILED for {project_slug}. Skipping upload.")
        return False
        
    # Step 6: Store and Upload
    print("Step 6: Uploading to Neo4j database...")
    try:
        subprocess.run(f"uv run python neo4j/upload.py data/temp/{project_slug}", cwd=cwd, shell=True, check=True)
        print("Upload: SUCCESS")
    except subprocess.CalledProcessError as e:
        print(f"Upload FAILED for {project_slug}. ({e})")
        return False
        
    print(f"Successfully finished Ingestion Pipeline for: {project_name}\n")
    return True

def main():
    parser = argparse.ArgumentParser(description="MemoryTonic Bulk Document Ingestion Pipeline")
    parser.add_argument("--folder", required=True, help="Path to directory containing source files")
    parser.add_argument("--collection", required=True, help="Target collection name in Neo4j")
    parser.add_argument("--directory", default="Research", help="Directory category grouping")
    parser.add_argument("--chunk-size", type=int, default=30000, help="Max character size per project chunk")
    parser.add_argument("--model", default="gemini-2.5-flash", help="LLM model name to use")
    
    args = parser.parse_args()
    
    cwd = os.path.dirname(os.path.abspath(__file__))
    
    # Try loading local .env file first
    env_path = os.path.join(cwd, "neo4j", ".env")
    if os.path.isfile(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip()
                    
    # Read environment keys
    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")):
        print("Error: No API keys found. Please set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in your environment.")
        sys.exit(1)
        
    if not os.path.exists(args.folder):
        print(f"Error: Folder path '{args.folder}' does not exist.")
        sys.exit(1)
        
    files = []
    for entry in os.scandir(args.folder):
        if entry.is_file() and entry.name.lower().endswith(('.md', '.txt', '.pdf')):
            files.append(entry.path)
            
    if not files:
        print(f"No processable files (.md, .txt, .pdf) found in {args.folder}.")
        sys.exit(0)
        
    print(f"Found {len(files)} files to process in {args.folder}.")
    
    success_count = 0
    total_count = 0
    
    for filepath in files:
        filename = os.path.basename(filepath)
        name_no_ext = os.path.splitext(filename)[0]
        
        print(f"\n==========================================")
        print(f"Reading file: {filename}")
        print(f"==========================================")
        
        text = ""
        if filepath.lower().endswith('.pdf'):
            text = extract_pdf_text(filepath)
            if not text:
                print(f"Skipping PDF file: {filename} (could not extract text)")
                continue
        else:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
                
        text = text.strip()
        if not text:
            print(f"Skipping empty file: {filename}")
            continue
            
        chunks = chunk_document(text, args.chunk_size)
        print(f"Document segmented into {len(chunks)} chunk(s).")
        
        for i, chunk in enumerate(chunks):
            total_count += 1
            if len(chunks) > 1:
                chunk_title = f"{name_no_ext} - Part {i+1}"
                chunk_slug = slugify(f"{name_no_ext}-part-{i+1}")
            else:
                chunk_title = name_no_ext
                chunk_slug = slugify(name_no_ext)
                
            res = process_project(chunk_title, chunk_slug, chunk, args.collection, args.directory, cwd, args.model)
            if res:
                success_count += 1
                
    # Run GDS recomputation
    if success_count > 0:
        print("\n==========================================")
        print("Running GDS Graph Algorithms Recomputation...")
        print("==========================================")
        try:
            subprocess.run("uv run python neo4j/gds.py", cwd=cwd, shell=True, check=True)
            print("GDS recomputation: SUCCESS")
        except subprocess.CalledProcessError as e:
            print(f"Warning: GDS recomputation failed ({e})")
            
    print(f"\nBulk Ingestion Finished. Succeeded: {success_count}/{total_count} projects.")

if __name__ == '__main__':
    main()
