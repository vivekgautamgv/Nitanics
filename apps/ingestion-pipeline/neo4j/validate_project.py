"""
Nitanics — Project Validation (Lifecycle Gate)

Validates extraction pipeline artifacts BEFORE upload to Neo4j.
Runs after extraction, before upload.py. Claude (extraction agent) runs this
and must respond to its output.

Usage:
  python neo4j/validate_project.py <project-dir>
  python neo4j/validate_project.py --all <extracted-dir>
  python neo4j/validate_project.py --human <project-dir>
  python neo4j/validate_project.py --all --human <extracted-dir>

Output:
  JSON to stdout (default) or human-readable text (--human).
  Exit code 0 = valid, exit code 1 = errors found.

No external dependencies — pure Python stdlib.
"""

import json
import math
import os
import re
import sys

# ---------------------------------------------------------------
# Constants
# ---------------------------------------------------------------

REQUIRED_FILES = [
    "01_html.html",
    "02_placement.json",
    "03_nlp_entities.json",
    "04_all_entities.json",
    "05_embeddings.json",
    "06_extraction.json",
]

# Import mode skips NLP artifact (not available in collection exports)
IMPORT_MODE_SKIP_FILES = {"03_nlp_entities.json"}

PLACEMENT_FIELDS = {"directory", "project_name", "unique_id", "collection", "collection_is_new"}
PLACEMENT_BAD_NAMES = {"collection_name", "name", "projectName"}

VALID_CATEGORIES = {
    "Person", "Organization", "Place", "Event", "Concept", "System",
    "Process", "Technology", "Law", "Agreement", "Metric", "Document",
    "Resource", "Other",
}

ENTITY_REQUIRED_FIELDS = {"name", "aliases", "category", "definition", "role", "first_appearance_index"}

VALID_CAUSAL_CLASSIFICATIONS = {
    "CAUSES", "ENABLES", "BLOCKS", "INFLUENCES", "DEPENDS_ON",
    "CONTRADICTS", "SUPPORTS", "PRECEDES", "COMPETES_WITH",
    "COOPERATES_WITH", "REGULATES", "TRANSFORMS", "PRODUCES",
    "CONSUMES", "IMPLEMENTS",
}

VALID_EVIDENCE_STRENGTHS = {"established", "claimed", "disputed", "speculative"}
VALID_MAGNITUDES = {"foundational", "significant", "marginal"}

RELATIONSHIP_REQUIRED_FIELDS = {
    "source", "target", "relType", "causalClassification",
    "description", "evidence", "evidenceStrength", "magnitude", "year",
}

EXTRACT_PROJECT_FIELDS = {"name", "unique_id", "summary", "narrative_flow", "tags"}
EXTRACT_TOPLEVEL_KEYS = {"project", "relationships", "causal_chains"}


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

def _load_json(filepath):
    """Load a JSON file. Returns (data, error_message)."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f), None
    except json.JSONDecodeError as e:
        return None, f"Malformed JSON: {e}"
    except Exception as e:
        return None, f"Cannot read file: {e}"


def _word_count(text):
    """Count words in a string."""
    if not isinstance(text, str):
        return 0
    return len(text.split())


def _nonempty_string(value):
    return isinstance(value, str) and bool(value.strip())


def _finite_number(value):
    if type(value) not in (int, float):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _source_text(project_dir, result):
    path = os.path.join(project_dir, "source.md")
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as source:
            return " ".join(source.read().split())
    except (OSError, UnicodeError) as error:
        result.error("source.md", "SOURCE_READ", f"Cannot verify source evidence: {error}")
        return None


# ---------------------------------------------------------------
# Validation Engine
# ---------------------------------------------------------------

class ValidationResult:
    """Collects errors, warnings, and stats for a single project."""

    def __init__(self, project_name):
        self.project = project_name
        self.errors = []
        self.warnings = []
        self.stats = {
            "entities": 0,
            "relationships": 0,
            "causal_chains": 0,
            "embeddings": 0,
            "temporal_phases": 0,
        }

    def error(self, filename, rule, message):
        self.errors.append({"file": filename, "rule": rule, "message": message})

    def warn(self, filename, rule, message):
        self.warnings.append({"file": filename, "rule": rule, "message": message})

    @property
    def valid(self):
        return len(self.errors) == 0

    def to_dict(self):
        return {
            "project": self.project,
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "stats": self.stats,
        }

    def to_json(self):
        return json.dumps(self.to_dict(), indent=2)

    def to_human(self):
        lines = []
        status = "PASS" if self.valid else "FAIL"
        lines.append(f"{'=' * 60}")
        lines.append(f"  Project: {self.project}")
        lines.append(f"  Status:  {status}")
        lines.append(f"{'=' * 60}")

        # Stats
        lines.append("")
        lines.append("  Stats:")
        for key, val in self.stats.items():
            lines.append(f"    {key}: {val}")

        # Errors
        if self.errors:
            lines.append("")
            lines.append(f"  Errors ({len(self.errors)}):")
            for e in self.errors:
                lines.append(f"    [{e['rule']}] {e['file']}: {e['message']}")

        # Warnings
        if self.warnings:
            lines.append("")
            lines.append(f"  Warnings ({len(self.warnings)}):")
            for w in self.warnings:
                lines.append(f"    [{w['rule']}] {w['file']}: {w['message']}")

        if self.valid and not self.warnings:
            lines.append("")
            lines.append("  No issues found. Ready for upload.")

        lines.append("")
        return "\n".join(lines)


# ---------------------------------------------------------------
# Individual Validators
# ---------------------------------------------------------------

def _validate_file_presence(project_dir, result, import_mode=False):
    """Check all required files exist. In import mode, skips NLP artifacts."""
    for filename in REQUIRED_FILES:
        if import_mode and filename in IMPORT_MODE_SKIP_FILES:
            continue
        filepath = os.path.join(project_dir, filename)
        if not os.path.isfile(filepath):
            result.error(filename, "FILE_MISSING", f"Required file not found: {filename}")


def _validate_placement(project_dir, result):
    """Validate 02_placement.json structure and field names."""
    filename = "02_placement.json"
    filepath = os.path.join(project_dir, filename)
    if not os.path.isfile(filepath):
        return None  # Already caught by FILE_MISSING

    data, err = _load_json(filepath)
    if err:
        result.error(filename, "JSON_PARSE", err)
        return None
    if not isinstance(data, dict):
        result.error(filename, "PLACEMENT_FIELDS", "Placement must be a JSON object")
        return None

    # Exactly 5 fields
    keys = set(data.keys())
    if keys != PLACEMENT_FIELDS:
        missing = PLACEMENT_FIELDS - keys
        extra = keys - PLACEMENT_FIELDS
        parts = []
        if missing:
            parts.append(f"missing: {sorted(missing)}")
        if extra:
            parts.append(f"unexpected: {sorted(extra)}")
        result.error(filename, "PLACEMENT_FIELDS", f"Expected exactly 5 fields ({sorted(PLACEMENT_FIELDS)}). {'; '.join(parts)}")

    # Bad field names
    bad = keys & PLACEMENT_BAD_NAMES
    if bad:
        result.error(filename, "PLACEMENT_FIELD_NAMES", f"Invalid field names found: {sorted(bad)}. Use {sorted(PLACEMENT_FIELDS)}")

    # unique_id matches project_name
    uid = data.get("unique_id")
    pname = data.get("project_name")
    for field in ["directory", "project_name", "unique_id", "collection"]:
        if not _nonempty_string(data.get(field)):
            result.error(filename, "PLACEMENT_TYPES", f"{field} must be a non-empty string")
    if isinstance(uid, str) and not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", uid):
        result.error(filename, "PLACEMENT_ID", "unique_id must be a lowercase kebab-case slug")
    if uid and pname and uid != pname:
        result.error(filename, "PLACEMENT_ID_MATCH", f"unique_id '{uid}' does not match project_name '{pname}'")

    # collection_is_new is boolean
    cin = data.get("collection_is_new")
    if not isinstance(cin, bool):
        result.error(filename, "PLACEMENT_BOOL", f"collection_is_new must be boolean, got {type(cin).__name__}: {cin}")

    return data


def _validate_nlp(project_dir, result):
    """Validate 03_nlp_entities.json."""
    filename = "03_nlp_entities.json"
    filepath = os.path.join(project_dir, filename)
    if not os.path.isfile(filepath):
        return None

    data, err = _load_json(filepath)
    if err:
        result.error(filename, "JSON_PARSE", err)
        return None
    if not isinstance(data, dict):
        result.error(filename, "NLP_CANDIDATES", "NLP output must be a JSON object")
        return None

    if "entity_candidates" not in data:
        result.error(filename, "NLP_CANDIDATES", "Missing 'entity_candidates' key")
        return data

    candidates = data["entity_candidates"]
    if not isinstance(candidates, list):
        result.error(filename, "NLP_CANDIDATES", "entity_candidates must be an array; an honest empty NLP result is allowed")
    else:
        for index, candidate in enumerate(candidates):
            if not isinstance(candidate, dict) or not _nonempty_string(candidate.get("text")):
                result.error(filename, "NLP_CANDIDATES", f"Candidate {index} must be an object with non-empty text")

    return data


def _validate_entities(project_dir, result):
    """Validate 04_all_entities.json. Returns (data, entity_names set, phase_indices set)."""
    filename = "04_all_entities.json"
    filepath = os.path.join(project_dir, filename)
    if not os.path.isfile(filepath):
        return None, set(), set()

    data, err = _load_json(filepath)
    if err:
        result.error(filename, "JSON_PARSE", err)
        return None, set(), set()
    if not isinstance(data, dict):
        result.error(filename, "ENTITY_ARRAY", "Entity artifact must be a JSON object")
        return None, set(), set()

    # --- Temporal phases ---
    phases = data.get("temporal_phases")
    phase_indices = set()
    if not isinstance(phases, list):
        result.error(filename, "ENTITY_PHASES", "temporal_phases must be an array; use [] when the source has no supported timeline")
    else:
        result.stats["temporal_phases"] = len(phases)
        for i, phase in enumerate(phases):
            if not isinstance(phase, dict):
                result.error(filename, "ENTITY_PHASE_FIELDS", f"Phase {i} must be an object")
                continue
            # Each phase: index (int), label (str), period (str)
            missing_fields = []
            if "index" not in phase:
                missing_fields.append("index")
            elif type(phase["index"]) is not int or phase["index"] < 0:
                result.error(filename, "ENTITY_PHASE_FIELDS", f"Phase {i}: 'index' must be int, got {type(phase['index']).__name__}")
            else:
                if phase["index"] in phase_indices:
                    result.error(filename, "ENTITY_PHASE_FIELDS", f"Phase {i}: duplicate index {phase['index']}")
                phase_indices.add(phase["index"])

            if "label" not in phase:
                missing_fields.append("label")
            elif not _nonempty_string(phase["label"]):
                result.error(filename, "ENTITY_PHASE_FIELDS", f"Phase {i}: 'label' must be str, got {type(phase['label']).__name__}")

            if "period" not in phase:
                missing_fields.append("period")
            elif not _nonempty_string(phase["period"]):
                result.error(filename, "ENTITY_PHASE_FIELDS", f"Phase {i}: 'period' must be str, got {type(phase['period']).__name__}")

            if missing_fields:
                result.error(filename, "ENTITY_PHASE_FIELDS", f"Phase {i}: missing required fields: {missing_fields}")

    # --- Entities array ---
    entities = data.get("entities")
    entity_names = set()

    if not isinstance(entities, list):
        result.error(filename, "ENTITY_ARRAY", f"'entities' must be an array, got {type(entities).__name__ if entities is not None else 'missing'}")
        return data, entity_names, phase_indices

    result.stats["entities"] = len(entities)

    if not entities:
        result.error(filename, "ENTITY_COUNT_MIN", "At least one source-grounded entity is required")

    seen_names = set()
    for i, entity in enumerate(entities):
        if not isinstance(entity, dict):
            result.error(filename, "ENTITY_FIELDS", f"Entity {i}: expected object, got {type(entity).__name__}")
            continue

        name = entity.get("name", f"<unnamed-{i}>")

        # Required fields
        missing = ENTITY_REQUIRED_FIELDS - set(entity.keys())
        if missing:
            result.error(filename, "ENTITY_FIELDS", f"Entity '{name}': missing fields: {sorted(missing)}")

        # aliases must be array
        aliases = entity.get("aliases")
        if not isinstance(aliases, list) or any(not _nonempty_string(alias) for alias in aliases):
            result.error(filename, "ENTITY_FIELDS", f"Entity '{name}': 'aliases' must be an array, got {type(aliases).__name__}")

        # Detail should follow the source rather than encourage invented padding.
        for field in ["name", "definition", "role"]:
            if not _nonempty_string(entity.get(field)):
                result.error(filename, "ENTITY_FIELDS", f"Entity {i}: {field} must be a non-empty string")

        # Category validation
        category = entity.get("category")
        if not isinstance(category, str) or category not in VALID_CATEGORIES:
            result.error(filename, "ENTITY_CATEGORY", f"Entity '{name}': invalid category '{category}'. Valid: {sorted(VALID_CATEGORIES)}")

        # first_appearance_index maps to existing phase
        fai = entity.get("first_appearance_index")
        if fai is not None and (type(fai) is not int or fai not in phase_indices):
            result.error(filename, "ENTITY_PHASE_MAP", f"Entity '{name}': first_appearance_index {fai} does not match any phase index ({sorted(phase_indices)})")

        # Duplicate check
        entity_name = entity.get("name")
        if _nonempty_string(entity_name):
            if entity_name in seen_names:
                result.error(filename, "ENTITY_DUPLICATE", f"Duplicate entity name: '{entity_name}'")
            seen_names.add(entity_name)
            entity_names.add(entity_name)

    return data, entity_names, phase_indices


def _validate_extraction(project_dir, result, entity_names, placement_data):
    """Validate 06_extraction.json."""
    filename = "06_extraction.json"
    filepath = os.path.join(project_dir, filename)
    if not os.path.isfile(filepath):
        return None

    data, err = _load_json(filepath)
    if err:
        result.error(filename, "JSON_PARSE", err)
        return None
    if not isinstance(data, dict):
        result.error(filename, "EXTRACT_TOPLEVEL", "Extraction must be a JSON object")
        return None
    source_text = _source_text(project_dir, result)

    # --- Top-level keys ---
    keys = set(data.keys())
    if keys != EXTRACT_TOPLEVEL_KEYS:
        missing = EXTRACT_TOPLEVEL_KEYS - keys
        extra = keys - EXTRACT_TOPLEVEL_KEYS
        parts = []
        if missing:
            parts.append(f"missing: {sorted(missing)}")
        if extra:
            parts.append(f"unexpected: {sorted(extra)}")
        result.error(filename, "EXTRACT_TOPLEVEL", f"Top-level keys must be exactly {sorted(EXTRACT_TOPLEVEL_KEYS)}. {'; '.join(parts)}")

    # --- Project wrapper ---
    project = data.get("project")
    if not isinstance(project, dict):
        result.error(filename, "EXTRACT_PROJECT", f"'project' must be an object, got {type(project).__name__ if project is not None else 'missing'}")
    else:
        missing_pf = EXTRACT_PROJECT_FIELDS - set(project.keys())
        if missing_pf:
            result.error(filename, "EXTRACT_PROJECT", f"Project wrapper missing fields: {sorted(missing_pf)}")

        # unique_id cross-check with placement
        extraction_uid = project.get("unique_id")
        for field in ["name", "unique_id", "summary"]:
            if not _nonempty_string(project.get(field)):
                result.error(filename, "EXTRACT_PROJECT", f"project.{field} must be a non-empty string")
        if placement_data:
            placement_uid = placement_data.get("unique_id")
            if extraction_uid and placement_uid and extraction_uid != placement_uid:
                result.error(filename, "EXTRACT_ID_MATCH", f"project.unique_id '{extraction_uid}' does not match 02_placement.json unique_id '{placement_uid}'")

        # Narrative flow may be empty for sources without an ordered narrative.
        nf = project.get("narrative_flow")
        if not isinstance(nf, list):
            result.error(filename, "EXTRACT_NARRATIVE", f"narrative_flow must be an array, got {type(nf).__name__ if nf is not None else 'missing'}")
        else:
            for i, item in enumerate(nf):
                if not _nonempty_string(item):
                    result.error(filename, "EXTRACT_NARRATIVE", f"narrative_flow[{i}] must be a string, got {type(item).__name__}")
                    break  # One error is enough to flag the issue

        # Tags
        tags = project.get("tags")
        if not isinstance(tags, dict):
            result.error(filename, "EXTRACT_TAGS", f"tags must be an object, got {type(tags).__name__ if tags is not None else 'missing'}")
        else:
            if not _nonempty_string(tags.get("domain")):
                result.error(filename, "EXTRACT_TAGS", "tags.domain must be a string")
            if not _nonempty_string(tags.get("subdomain")):
                result.error(filename, "EXTRACT_TAGS", "tags.subdomain must be a string")
            bt = tags.get("base_tags")
            if not isinstance(bt, list) or not bt or any(not _nonempty_string(tag) for tag in bt):
                result.error(filename, "EXTRACT_TAGS", "tags.base_tags must be a non-empty array of strings")

    # --- Relationships ---
    rels = data.get("relationships", [])
    if not isinstance(rels, list):
        result.error(filename, "EXTRACT_REL_COUNT", f"'relationships' must be an array, got {type(rels).__name__}")
        rels = []

    result.stats["relationships"] = len(rels)

    relationship_pairs = set()
    for i, rel in enumerate(rels):
        if not isinstance(rel, dict):
            result.error(filename, "EXTRACT_REL_FIELDS", f"Relationship {i}: expected object, got {type(rel).__name__}")
            continue

        # Required fields
        missing_rf = RELATIONSHIP_REQUIRED_FIELDS - set(rel.keys())
        if missing_rf:
            src = rel.get("source", rel.get("source_entity", f"<rel-{i}>"))
            tgt = rel.get("target", rel.get("target_entity", "?"))
            result.error(filename, "EXTRACT_REL_FIELDS", f"Relationship '{src}' -> '{tgt}': missing fields: {sorted(missing_rf)}")

        # Bad field names (source_entity/target_entity instead of source/target)
        if "source_entity" in rel or "target_entity" in rel:
            result.error(filename, "EXTRACT_REL_NAMES", f"Relationship {i}: use 'source'/'target', NOT 'source_entity'/'target_entity'")

        for field in ["source", "target", "relType", "description", "evidence"]:
            if not _nonempty_string(rel.get(field)):
                result.error(filename, "EXTRACT_REL_FIELDS", f"Relationship {i}: {field} must be a non-empty string")
        if _nonempty_string(rel.get("source")) and _nonempty_string(rel.get("target")):
            relationship_pairs.add((rel["source"], rel["target"]))
        evidence = rel.get("evidence")
        if source_text is not None and _nonempty_string(evidence) and " ".join(evidence.split()) not in source_text:
            result.error(filename, "EXTRACT_EVIDENCE_SOURCE", f"Relationship {i}: evidence must be a quote present in source.md")

        # causalClassification
        cc = rel.get("causalClassification")
        if not isinstance(cc, str) or cc not in VALID_CAUSAL_CLASSIFICATIONS:
            result.error(filename, "EXTRACT_CAUSAL_CLASS", f"Relationship {i}: invalid causalClassification '{cc}'. Valid: {sorted(VALID_CAUSAL_CLASSIFICATIONS)}")

        # evidenceStrength
        es = rel.get("evidenceStrength")
        if not isinstance(es, str) or es not in VALID_EVIDENCE_STRENGTHS:
            result.error(filename, "EXTRACT_EVIDENCE", f"Relationship {i}: invalid evidenceStrength '{es}'. Valid: {sorted(VALID_EVIDENCE_STRENGTHS)}")

        # magnitude
        mag = rel.get("magnitude")
        if not isinstance(mag, str) or mag not in VALID_MAGNITUDES:
            result.error(filename, "EXTRACT_MAGNITUDE", f"Relationship {i}: invalid magnitude '{mag}'. Valid: {sorted(VALID_MAGNITUDES)}")

        # Entity name matching (source/target must exist in 04_all_entities.json)
        if entity_names:
            src = rel.get("source")
            tgt = rel.get("target")
            if _nonempty_string(src) and src not in entity_names:
                result.error(filename, "EXTRACT_ENTITY_MATCH", f"Relationship {i}: source '{src}' not found in entity list")
            if _nonempty_string(tgt) and tgt not in entity_names:
                result.error(filename, "EXTRACT_ENTITY_MATCH", f"Relationship {i}: target '{tgt}' not found in entity list")

        # Year field: missing = error, empty string = warning, "ongoing" = valid
        if "year" not in rel:
            result.error(filename, "EXTRACT_REL_FIELDS", f"Relationship {i}: missing 'year' field")
        else:
            yr = rel["year"]
            if not isinstance(yr, str):
                result.error(filename, "EXTRACT_REL_FIELDS", f"Relationship {i}: year must be a string")
            if isinstance(yr, str) and yr.strip() == "":
                src = rel.get("source", f"<rel-{i}>")
                tgt = rel.get("target", "?")
                result.warn(filename, "YEAR_MISSING", f"Relationship '{src}' -> '{tgt}': year is empty string (consider adding a year or 'ongoing')")

    # --- Causal chains ---
    chains = data.get("causal_chains", [])
    if not isinstance(chains, list):
        result.error(filename, "EXTRACT_CHAIN_COUNT", f"'causal_chains' must be an array, got {type(chains).__name__}")
        chains = []

    result.stats["causal_chains"] = len(chains)

    for i, chain in enumerate(chains):
        if not isinstance(chain, dict):
            result.error(filename, "EXTRACT_CHAIN_FIELDS", f"Chain {i}: expected object, got {type(chain).__name__}")
            continue

        chain_name = chain.get("name", f"<chain-{i}>")

        if not _nonempty_string(chain.get("name")):
            result.error(filename, "EXTRACT_CHAIN_FIELDS", f"Chain {i}: name must be a non-empty string")
        if "description" in chain and not _nonempty_string(chain["description"]):
            result.error(filename, "EXTRACT_CHAIN_FIELDS", f"Chain {i}: description must be a non-empty string")

        links = chain.get("links")
        if not isinstance(links, list):
            result.error(filename, "EXTRACT_CHAIN_FIELDS", f"Chain '{chain_name}': 'links' must be an array, got {type(links).__name__ if links is not None else 'missing'}")
            continue
        if not links:
            result.error(filename, "EXTRACT_CHAIN_FIELDS", f"Chain '{chain_name}': include supported links or omit this chain")

        for j, link in enumerate(links):
            if not isinstance(link, dict):
                result.error(filename, "EXTRACT_CHAIN_FIELDS", f"Chain '{chain_name}' link {j}: expected object, got {type(link).__name__}")
                continue

            link_missing = []
            if "source" not in link:
                link_missing.append("source")
            if "target" not in link:
                link_missing.append("target")
            if "explanation" not in link:
                link_missing.append("explanation")
            if link_missing:
                result.error(filename, "EXTRACT_CHAIN_FIELDS", f"Chain '{chain_name}' link {j}: missing fields: {link_missing}")
            for field in ["source", "target", "explanation"]:
                if not _nonempty_string(link.get(field)):
                    result.error(filename, "EXTRACT_CHAIN_FIELDS", f"Chain '{chain_name}' link {j}: {field} must be a non-empty string")
            if _nonempty_string(link.get("source")) and _nonempty_string(link.get("target")):
                if (link["source"], link["target"]) not in relationship_pairs:
                    result.error(filename, "EXTRACT_CHAIN_EVIDENCE", f"Chain '{chain_name}' link {j}: no evidence-bearing relationship supports this link")

            # Chain entity matching
            if entity_names:
                lsrc = link.get("source")
                ltgt = link.get("target")
                if _nonempty_string(lsrc) and lsrc not in entity_names:
                    result.error(filename, "EXTRACT_CHAIN_MATCH", f"Chain '{chain_name}' link {j}: source '{lsrc}' not found in entity list")
                if _nonempty_string(ltgt) and ltgt not in entity_names:
                    result.error(filename, "EXTRACT_CHAIN_MATCH", f"Chain '{chain_name}' link {j}: target '{ltgt}' not found in entity list")

    # Cross-file ID check
    if placement_data and project:
        p_uid = placement_data.get("unique_id")
        e_uid = project.get("unique_id") if isinstance(project, dict) else None
        if p_uid and e_uid and p_uid != e_uid:
            result.error("CROSS", "CROSS_ID", f"unique_id mismatch: 02_placement.json='{p_uid}', 06_extraction.json='{e_uid}'")

    return data


def _validate_embeddings(project_dir, result, entity_names, placement_data):
    """Validate 05_embeddings.json."""
    filename = "05_embeddings.json"
    filepath = os.path.join(project_dir, filename)
    if not os.path.isfile(filepath):
        return None

    data, err = _load_json(filepath)
    if err:
        result.error(filename, "JSON_PARSE", err)
        return None
    if not isinstance(data, dict):
        result.error(filename, "EMBED_STRUCTURE", "Embeddings must be a JSON object")
        return None

    # Must have "embeddings" key (not entity_embeddings/project_embedding)
    if "entity_embeddings" in data or "project_embedding" in data:
        result.error(filename, "EMBED_STRUCTURE", "Use 'embeddings' key, NOT 'entity_embeddings' or 'project_embedding'")

    embeddings = data.get("embeddings")
    if not isinstance(embeddings, list):
        result.error(filename, "EMBED_STRUCTURE", f"'embeddings' must be an array, got {type(embeddings).__name__ if embeddings is not None else 'missing'}")
        return data

    result.stats["embeddings"] = len(embeddings)
    if not _nonempty_string(data.get("model")) or type(data.get("dimensions")) is not int or data["dimensions"] != 384:
        result.error(filename, "EMBED_STRUCTURE", "model must be a non-empty string and dimensions must be 384")

    # Validate each embedding
    embed_names = set()
    for i, emb in enumerate(embeddings):
        if not isinstance(emb, dict):
            result.error(filename, "EMBED_FIELDS", f"Embedding {i}: expected object, got {type(emb).__name__}")
            continue

        name = emb.get("name")
        vector = emb.get("embedding")

        if not _nonempty_string(name):
            result.error(filename, "EMBED_FIELDS", f"Embedding {i}: 'name' must be a string, got {type(name).__name__ if name is not None else 'missing'}")
        else:
            if name in embed_names:
                result.error(filename, "EMBED_DUPLICATE", f"Duplicate embedding name: '{name}'")
            embed_names.add(name)

        if not isinstance(vector, list):
            result.error(filename, "EMBED_FIELDS", f"Embedding {i} ('{name}'): 'embedding' must be an array, got {type(vector).__name__ if vector is not None else 'missing'}")
        else:
            # Dimension check
            if len(vector) != 384:
                result.error(filename, "EMBED_DIMENSIONS", f"Embedding '{name}': expected 384 dimensions, got {len(vector)}")

            if any(not _finite_number(value) for value in vector):
                result.error(filename, "EMBED_FIELDS", f"Embedding '{name}': all elements must be finite numbers")
            elif vector and not any(value != 0 for value in vector):
                result.error(filename, "EMBED_ZERO", f"Embedding '{name}': zero-vector placeholders are not valid model embeddings")
        if "dimensions" in emb and (type(emb["dimensions"]) is not int or emb["dimensions"] != 384):
            result.error(filename, "EMBED_DIMENSIONS", f"Embedding '{name}': dimensions must be 384")

    # Entity name matching
    if entity_names and embed_names:
        missing_entities = entity_names - embed_names
        if missing_entities:
            # Allow for the project embedding being the extra one
            result.error(filename, "EMBED_ENTITY_MATCH", f"Entity embeddings missing for: {sorted(missing_entities)}")
        project_uid = placement_data.get("unique_id") if placement_data else None
        if isinstance(project_uid, str):
            if project_uid in entity_names:
                result.error(filename, "EMBED_PROJECT_NAME", "Project unique_id must differ from entity names")
            unexpected = embed_names - entity_names - {project_uid}
            if unexpected:
                result.error(filename, "EMBED_ENTITY_MATCH", f"Unexpected embedding names: {sorted(unexpected)}")

    # Last embedding should match project unique_id
    if embeddings and placement_data:
        last_name = embeddings[-1].get("name") if isinstance(embeddings[-1], dict) else None
        project_uid = placement_data.get("unique_id")
        if last_name != project_uid:
            result.error(filename, "EMBED_PROJECT", f"Last embedding name '{last_name}' does not match project unique_id '{project_uid}'")

    # Count check: entity_count + 1 (for project)
    expected_count = len(entity_names) + 1 if entity_names else None
    if expected_count is not None and len(embeddings) != expected_count:
        result.error(filename, "EMBED_COUNT", f"Expected {expected_count} embeddings ({len(entity_names)} entities + 1 project), got {len(embeddings)}")

    return data


# ---------------------------------------------------------------
# Main Validation Entry Point
# ---------------------------------------------------------------

def validate_project(project_dir, **kwargs):
    """Validate a single project directory. Returns result dict.

    Importable as a module:
        from validate_project import validate_project
        result = validate_project("/path/to/project")
        if not result["valid"]:
            print(result["errors"])
    """
    project_name = os.path.basename(os.path.normpath(project_dir))
    result = ValidationResult(project_name)
    import_mode = kwargs.get("import_mode", False)

    if not os.path.isdir(project_dir):
        result.error("<dir>", "DIR_MISSING", f"Not a directory: {project_dir}")
        return result.to_dict()

    # Phase 1: File presence
    _validate_file_presence(project_dir, result, import_mode=import_mode)

    # Phase 2: Individual file validation (order matters — later validators
    # use data from earlier ones for cross-file checks)
    placement_data = _validate_placement(project_dir, result)
    if not import_mode:
        _validate_nlp(project_dir, result)
    _, entity_names, phase_indices = _validate_entities(project_dir, result)
    _validate_extraction(project_dir, result, entity_names, placement_data)
    _validate_embeddings(project_dir, result, entity_names, placement_data)

    return result.to_dict()


def validate_all(extracted_dir):
    """Validate all project subdirectories. Returns list of result dicts."""
    results = []
    if not os.path.isdir(extracted_dir):
        return [{"project": "<dir>", "valid": False,
                 "errors": [{"file": "<dir>", "rule": "DIR_MISSING",
                             "message": f"Not a directory: {extracted_dir}"}],
                 "warnings": [], "stats": {}}]

    subdirs = sorted([
        d for d in os.listdir(extracted_dir)
        if os.path.isdir(os.path.join(extracted_dir, d))
    ])

    if not subdirs:
        return [{"project": "<dir>", "valid": False,
                 "errors": [{"file": "<dir>", "rule": "DIR_EMPTY",
                             "message": f"No project subdirectories found in: {extracted_dir}"}],
                 "warnings": [], "stats": {}}]

    for subdir in subdirs:
        project_path = os.path.join(extracted_dir, subdir)
        results.append(validate_project(project_path))

    return results


def _print_summary_table(results):
    """Print a human-readable summary table for --all mode."""
    lines = []
    lines.append("")
    lines.append("=" * 70)
    lines.append("  VALIDATION SUMMARY")
    lines.append("=" * 70)
    lines.append("")

    # Table header
    lines.append(f"  {'Project':<35} {'Status':<8} {'Errors':<8} {'Warnings':<8}")
    lines.append(f"  {'-' * 35} {'-' * 8} {'-' * 8} {'-' * 8}")

    total_pass = 0
    total_fail = 0

    for r in results:
        status = "PASS" if r["valid"] else "FAIL"
        name = r["project"][:35]
        err_count = len(r["errors"])
        warn_count = len(r["warnings"])
        lines.append(f"  {name:<35} {status:<8} {err_count:<8} {warn_count:<8}")
        if r["valid"]:
            total_pass += 1
        else:
            total_fail += 1

    lines.append("")
    lines.append(f"  Total: {len(results)} projects — {total_pass} passed, {total_fail} failed")
    lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------
# CLI
# ---------------------------------------------------------------

def main():
    args = sys.argv[1:]
    human_mode = False
    all_mode = False
    import_mode = False

    # Parse flags
    remaining = []
    for arg in args:
        if arg == "--human":
            human_mode = True
        elif arg == "--all":
            all_mode = True
        elif arg == "--import-mode":
            import_mode = True
        else:
            remaining.append(arg)

    if not remaining:
        print("Usage: python neo4j/validate_project.py [--human] [--all] [--import-mode] <project-dir|extracted-dir>", file=sys.stderr)
        sys.exit(1)

    target = remaining[0]

    if all_mode:
        results = validate_all(target)
        has_errors = any(not r["valid"] for r in results)

        if human_mode:
            for r in results:
                vr = ValidationResult(r["project"])
                vr.errors = r["errors"]
                vr.warnings = r["warnings"]
                vr.stats = r["stats"]
                print(vr.to_human())
            print(_print_summary_table(results))
        else:
            print(json.dumps(results, indent=2))

        sys.exit(1 if has_errors else 0)
    else:
        result = validate_project(target, import_mode=import_mode)

        if human_mode:
            vr = ValidationResult(result["project"])
            vr.errors = result["errors"]
            vr.warnings = result["warnings"]
            vr.stats = result["stats"]
            print(vr.to_human())
        else:
            print(json.dumps(result, indent=2))

        sys.exit(0 if result["valid"] else 1)


if __name__ == "__main__":
    main()
