import os
import sys
import json
import re
import argparse
import subprocess
import urllib.request
import urllib.error
import html
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
    title = html.escape(title)
    content = html.escape(content)
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
    import time
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    
    max_retries = 5
    initial_backoff = 2
    
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
        for attempt in range(max_retries):
            try:
                with urllib.request.urlopen(req, timeout=120) as res:
                    response = json.loads(res.read().decode('utf-8'))
                    text_out = response['candidates'][0]['content']['parts'][0]['text']
                    return text_out
            except urllib.error.HTTPError as e:
                if e.code in [429, 503] and attempt < max_retries - 1:
                    sleep_time = initial_backoff * (2 ** attempt)
                    # Check standard Retry-After header
                    retry_after = e.headers.get('Retry-After')
                    if retry_after:
                        try:
                            sleep_time = int(retry_after) + 2
                        except ValueError:
                            pass
                    else:
                        # Try parsing Google's specific RetryInfo
                        try:
                            err_body = e.read().decode('utf-8')
                            err_data = json.loads(err_body)
                            for detail in err_data.get('error', {}).get('details', []):
                                if detail.get('@type') == 'type.googleapis.com/google.rpc.RetryInfo':
                                    delay_str = detail.get('retryDelay', '')
                                    if delay_str.endswith('s'):
                                        sleep_time = float(delay_str[:-1]) + 2
                                        break
                        except Exception:
                            pass
                    if e.code == 429 and sleep_time < 45:
                        sleep_time = 45
                    print(f"Gemini API returned HTTP {e.code}. Retrying in {sleep_time} seconds (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(sleep_time)
                    continue
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
        for attempt in range(max_retries):
            try:
                with urllib.request.urlopen(req, timeout=120) as res:
                    response = json.loads(res.read().decode('utf-8'))
                    text_out = response['choices'][0]['message']['content']
                    return text_out
            except urllib.error.HTTPError as e:
                if e.code in [429, 503] and attempt < max_retries - 1:
                    sleep_time = initial_backoff * (2 ** attempt)
                    # Check standard Retry-After header
                    retry_after = e.headers.get('Retry-After')
                    if retry_after:
                        try:
                            sleep_time = int(retry_after) + 2
                        except ValueError:
                            pass
                    if e.code == 429 and sleep_time < 45:
                        sleep_time = 45
                    print(f"OpenAI API returned HTTP {e.code}. Retrying in {sleep_time} seconds (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(sleep_time)
                    continue
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
        for attempt in range(max_retries):
            try:
                with urllib.request.urlopen(req, timeout=120) as res:
                    response = json.loads(res.read().decode('utf-8'))
                    text_out = response['content'][0]['text']
                    return text_out
            except urllib.error.HTTPError as e:
                if e.code in [429, 503] and attempt < max_retries - 1:
                    sleep_time = initial_backoff * (2 ** attempt)
                    # Check standard Retry-After header
                    retry_after = e.headers.get('Retry-After')
                    if retry_after:
                        try:
                            sleep_time = int(retry_after) + 2
                        except ValueError:
                            pass
                    if e.code == 429 and sleep_time < 45:
                        sleep_time = 45
                    print(f"Anthropic API returned HTTP {e.code}. Retrying in {sleep_time} seconds (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(sleep_time)
                    continue
                print(f"Anthropic API Error: {e.code} - {e.read().decode('utf-8')}")
                raise e
    else:
        raise ValueError("No API keys found. Please set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.")


# Helper to sanitize and load JSON from LLM response
def clean_and_load_json(raw_text):
    import re
    cleaned = raw_text.strip()
    
    # 1. Strip markdown codeblocks
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    
    # 2. Basic character/newline escaping inside string values
    in_string = False
    escape = False
    repaired = []
    for char in cleaned:
        if escape:
            repaired.append(char)
            escape = False
            continue
        if char == '\\':
            repaired.append(char)
            escape = True
            continue
        if char == '"':
            in_string = not in_string
            repaired.append(char)
            continue
        if in_string:
            if char == '\n':
                repaired.append('\\n')
            elif char == '\r':
                repaired.append('\\r')
            elif char == '\t':
                repaired.append('\\t')
            else:
                repaired.append(char)
        else:
            repaired.append(char)
    cleaned = "".join(repaired)
    
    # 3. Terminate open string if truncated inside a string value
    in_string = False
    escape = False
    stack = []
    for char in cleaned:
        if escape:
            escape = False
            continue
        if char == '\\':
            escape = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if not in_string:
            if char in ['{', '[']:
                stack.append(char)
            elif char in ['}', ']']:
                if stack:
                    last = stack[-1]
                    if (char == '}' and last == '{') or (char == ']' and last == '['):
                        stack.pop()
                        
    if in_string:
        cleaned += '"'
        
    while stack:
        last = stack.pop()
        if last == '{':
            cleaned += '}'
        elif last == '[':
            cleaned += ']'
            
    # 4. Remove trailing commas before closing braces/brackets
    cleaned = re.sub(r',\s*([\]}])', r'\1', cleaned)
    
    # 5. Parse and dynamically escape inner quotes if there are JSONDecodeErrors
    max_repairs = 100
    for attempt in range(max_repairs):
        try:
            return json.loads(cleaned.strip())
        except json.JSONDecodeError as e:
            pos = e.pos
            # Search backwards from the failure position to find the nearest unescaped quote
            idx = pos - 1
            found = False
            while idx >= 0:
                if cleaned[idx] == '"':
                    # Check if it is already escaped
                    backslash_count = 0
                    j = idx - 1
                    while j >= 0 and cleaned[j] == '\\':
                        backslash_count += 1
                        j -= 1
                    if backslash_count % 2 == 0:
                        # Found unescaped quote. Let's escape it and retry.
                        cleaned = cleaned[:idx] + '\\"' + cleaned[idx+1:]
                        found = True
                        break
                idx -= 1
            if not found:
                print(f"Failed to load repaired JSON. Repaired string:\n{cleaned}")
                raise e



# Segment a long document into logical parts
def chunk_document(text, chunk_size):
    if chunk_size < 1:
        raise ValueError("Chunk size must be positive.")
    if len(text) <= chunk_size:
        return [text]
    
    # Split by double newline to avoid breaking paragraphs
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = []
    current_size = 0
    
    bounded_paragraphs = []
    for paragraph in paragraphs:
        while len(paragraph) > chunk_size:
            boundary = paragraph.rfind(' ', 0, chunk_size + 1)
            if boundary < chunk_size // 2:
                boundary = chunk_size
            bounded_paragraphs.append(paragraph[:boundary])
            paragraph = paragraph[boundary:].lstrip()
        if paragraph:
            bounded_paragraphs.append(paragraph)

    for p in bounded_paragraphs:
        p_len = len(p)
        if current_size + p_len + (2 if current_chunk else 0) > chunk_size and current_chunk:
            chunks.append('\n\n'.join(current_chunk))
            current_chunk = [p]
            current_size = p_len
        else:
            current_chunk.append(p)
            current_size += p_len + (2 if len(current_chunk) > 1 else 0)
            
    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))
        
    return chunks

def reserve_project_directory(cwd, collection, project_slug):
    """Give every upload a new identity and preserve any earlier graph artifacts."""
    import uuid
    import hashlib
    collection_slug = slugify(collection) or "collection-" + hashlib.sha256(collection.encode()).hexdigest()[:12]
    graphs_root = os.path.abspath(os.path.join(cwd, "..", "..", "graphs"))
    unique_id = (slugify(project_slug) or "document")[:100] + "-" + uuid.uuid4().hex[:12]
    project_dir = os.path.join(graphs_root, collection_slug[:100], unique_id)
    os.makedirs(project_dir, exist_ok=False)
    return project_dir, unique_id


def run_json_script(cwd, script, payload, output_path):
    """Use the same Python environment; avoid shell redirection and shell quoting."""
    result = subprocess.run(
        [sys.executable, script], cwd=cwd, input=json.dumps(payload),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", check=True,
    )
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    # Fail on malformed output rather than writing a broken artifact.
    data = json.loads(result.stdout)
    with open(output_path, "w", encoding="utf-8") as output:
        json.dump(data, output, indent=2)
    return data


def process_project(project_name, project_slug, text, collection, directory, cwd, model):
    project_dir, unique_id = reserve_project_directory(cwd, collection, project_slug)
    print(f"\n--- Ingesting {project_name} as new project {unique_id} ---")
    print(f"Artifacts: {project_dir}")
    # Keep the source and completed artifacts available when any later step fails.
    with open(os.path.join(project_dir, "source.md"), "w", encoding="utf-8") as source:
        source.write(text)
    with open(os.path.join(project_dir, "01_html.html"), "w", encoding="utf-8") as output:
        output.write(wrap_html(project_name, text))
    placement = {
        "directory": directory, "project_name": unique_id, "unique_id": unique_id,
        "collection": collection, "collection_is_new": False,
    }
    with open(os.path.join(project_dir, "02_placement.json"), "w", encoding="utf-8") as output:
        json.dump(placement, output, indent=2)

    print("Step 2: NLP candidate extraction...")
    nlp_data = run_json_script(cwd, "nlp/preprocess.py", {"text": text, "title": project_name},
                               os.path.join(project_dir, "03_nlp_entities.json"))
    grounding = (
        "Use only facts supported by this source document. Do not fabricate entities, aliases, "
        "relationships, temporal phases, summaries, or causal links to satisfy a count or length. "
        "Mark uncertain interpretations as uncertain. Return strict JSON without Markdown."
    )
    entity_prompt = (
        "Extract entities and any temporal phases from the source. Return an object with "
        "'temporal_phases': [{index: integer, label: string, period: string}] and "
        "'entities': [{name: string, aliases: string[], category: string, definition: string, "
        "role: string, first_appearance_index: integer or null}]. "
        "Categories: " + ", ".join(VALID_CATEGORIES) + ". "
        "Definitions should concisely explain the entity's role using only details supported by this source. "
        "Use a temporal phase only when supported. Use null for first_appearance_index when no supported phase applies. "
        "Empty arrays are appropriate for missing facts.\n"
        f"NLP candidates:\n{json.dumps(nlp_data.get('entity_candidates', []))}\nSource:\n{text}"
    )
    print("Step 3: Source-grounded entity discovery...")
    entities_data = clean_and_load_json(call_llm(entity_prompt, grounding, model))
    if not isinstance(entities_data, dict) or not isinstance(entities_data.get("entities"), list):
        raise ValueError("Entity extraction returned an invalid schema. Saved source artifacts are available for review.")
    # Safe normalization does not supply any missing factual content.
    entities = []
    seen = set()
    for entity in entities_data["entities"]:
        if not isinstance(entity, dict) or not isinstance(entity.get("name"), str) or not entity["name"].strip():
            raise ValueError("Entity extraction returned an unnamed entity.")
        entity["name"] = entity["name"].strip()
        if entity["name"].casefold() not in seen:
            entities.append(entity)
            seen.add(entity["name"].casefold())
    entities_data["entities"] = entities
    with open(os.path.join(project_dir, "04_all_entities.json"), "w", encoding="utf-8") as output:
        json.dump(entities_data, output, indent=2)

    extraction_prompt = (
        "Return exactly {project: {name: string, unique_id: string, summary: string, "
        "narrative_flow: string[], tags: {domain: string, subdomain: string, base_tags: string[]}}, "
        "relationships: [{source: string, target: string, relType: string, causalClassification: string, "
        "description: string, evidence: string, evidenceStrength: string, magnitude: string, year: string}], "
        "causal_chains: [{name: string, description: string, links: [{source: string, target: string, explanation: string}]}]}. "
        "All relationship and chain names must exactly match an extracted entity. "
        "Evidence must be an exact source quote. Use empty arrays when the source does not support a relationship or chain. "
        "Use an empty year string when the date is unknown. "
        "Causal classifications: " + ", ".join(VALID_CAUSAL) + ". "
        "Evidence strengths: " + ", ".join(VALID_EVIDENCE_STRENGTH) + ". "
        "Magnitudes: " + ", ".join(VALID_MAGNITUDE) + ". "
        "Write a source-proportionate summary, supported narrative flow, and specific tags. Do not pad short sources.\n"
        f"Project name: {project_name}\nUnique ID: {unique_id}\n"
        f"Entities:\n{json.dumps(entities, ensure_ascii=False)}\nSource:\n{text}"
    )
    print("Step 4: Evidence-based relationship extraction...")
    extraction = clean_and_load_json(call_llm(extraction_prompt, grounding, model))
    if not isinstance(extraction, dict) or not isinstance(extraction.get("project"), dict):
        raise ValueError("Relationship extraction returned an invalid project wrapper.")
    extraction["project"]["name"] = project_name
    extraction["project"]["unique_id"] = unique_id
    with open(os.path.join(project_dir, "06_extraction.json"), "w", encoding="utf-8") as output:
        json.dump(extraction, output, indent=2)
    normalized_source = " ".join(text.split())
    for relationship in extraction.get("relationships", []):
        evidence = relationship.get("evidence")
        if not isinstance(evidence, str) or not evidence.strip() or " ".join(evidence.split()) not in normalized_source:
            raise ValueError("A relationship has missing or unsupported source evidence. Review 06_extraction.json; nothing was uploaded.")

    print("Step 5: Local embeddings...")
    names = [entity["name"] for entity in entities] + [unique_id]
    texts = [entity.get("definition", "") + " " + entity.get("role", "") for entity in entities]
    texts.append(extraction["project"].get("summary", ""))
    run_json_script(cwd, "nlp/embed.py", {"texts": texts, "names": names},
                    os.path.join(project_dir, "05_embeddings.json"))
    print("Step 5.5: Validation gate...")
    subprocess.run([sys.executable, "neo4j/validate_project.py", project_dir], cwd=cwd, check=True)
    print("Step 6: Uploading validated new project...")
    subprocess.run([sys.executable, "neo4j/upload.py", project_dir, "--create-only"], cwd=cwd, check=True)
    print(f"Uploaded {project_name}. Original source and six artifacts remain in {project_dir}.")
    return True


def load_provider_environment(cwd):
    """Explicit process environment wins over .env; honor the provider chosen in the UI."""
    env_path = os.path.join(cwd, "neo4j", ".env")
    if os.path.isfile(env_path):
        with open(env_path, encoding="utf-8") as source:
            for line in source:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))
    provider = os.environ.get("NITANICS_LLM_PROVIDER")
    keys = {"gemini": "GEMINI_API_KEY", "openai": "OPENAI_API_KEY", "anthropic": "ANTHROPIC_API_KEY"}
    if provider:
        if provider not in keys:
            raise ValueError("Unknown extraction provider.")
        for key in keys.values():
            if key != keys[provider]:
                os.environ.pop(key, None)
        if not os.environ.get(keys[provider]):
            raise ValueError(f"No API key configured for selected provider: {provider}.")
    elif not any(os.environ.get(key) for key in keys.values()):
        raise ValueError("No API key configured. Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.")


def main():
    parser = argparse.ArgumentParser(description="Nitanics source-grounded document ingestion")
    parser.add_argument("--folder", required=True, help="Folder containing source documents")
    parser.add_argument("--collection", required=True, help="Target collection name")
    parser.add_argument("--directory", default="Research", help="Workspace folder")
    parser.add_argument("--chunk-size", type=int, default=30000, help="Maximum characters per project chunk")
    parser.add_argument("--model", default="gemini-2.5-flash", help="Gemini model")
    args = parser.parse_args()
    cwd = os.path.dirname(os.path.abspath(__file__))
    if args.chunk_size < 1:
        parser.error("--chunk-size must be positive")
    try:
        load_provider_environment(cwd)
    except ValueError as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        return 1
    if not os.path.isdir(args.folder):
        print("[ERROR] Source folder does not exist.", file=sys.stderr)
        return 1
    files = sorted(entry.path for entry in os.scandir(args.folder)
                   if entry.is_file() and entry.name.lower().endswith((".md", ".txt", ".pdf")))
    if not files:
        print("[ERROR] No Markdown, text, or PDF files to process.", file=sys.stderr)
        return 1
    total = success = failures = 0
    for filepath in files:
        title = os.path.splitext(os.path.basename(filepath))[0]
        try:
            if filepath.lower().endswith(".pdf"):
                text = extract_pdf_text(filepath)
            else:
                with open(filepath, encoding="utf-8-sig") as source:
                    text = source.read()
            if not text or not text.strip():
                raise ValueError("No readable text. Scanned PDFs need OCR before ingestion.")
            chunks = chunk_document(text.strip(), args.chunk_size)
            for index, chunk in enumerate(chunks, 1):
                chunk_title = f"{title} - Part {index}" if len(chunks) > 1 else title
                total += 1
                try:
                    if process_project(chunk_title, slugify(chunk_title), chunk, args.collection, args.directory, cwd, args.model):
                        success += 1
                    else:
                        failures += 1
                except Exception as error:
                    failures += 1
                    print(f"[ERROR] {chunk_title}: {error}. Saved artifacts are retained for review.", file=sys.stderr)
        except Exception as error:
            failures += 1
            print(f"[ERROR] {os.path.basename(filepath)}: {error}", file=sys.stderr)
    if success:
        try:
            subprocess.run([sys.executable, "neo4j/gds.py"], cwd=cwd, check=True)
        except subprocess.CalledProcessError as error:
            print(f"[WARN] Projects uploaded, but graph metrics need recomputation: {error}", file=sys.stderr)
    print(f"\nIngestion finished. Uploaded {success}/{total} projects; failures: {failures}.")
    return 0 if success and not failures else 1


if __name__ == "__main__":
    sys.exit(main())
