"""Validate source-grounded artifacts in temporary folders, without Neo4j/models."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "project_validator", ROOT / "neo4j" / "validate_project.py"
)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class ProjectValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="nitanics-validation-test-")
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name) / "atlas-note-test"
        self.project.mkdir()
        self.source = "Mira created Atlas.\nAtlas is an engine.\n"
        (self.project / "source.md").write_text(self.source, encoding="utf-8")
        (self.project / "01_html.html").write_text(
            "<p>Mira created Atlas.</p><p>Atlas is an engine.</p>", encoding="utf-8"
        )
        self.artifacts = {
            "02_placement.json": {
                "directory": "Research",
                "project_name": "atlas-note-test",
                "unique_id": "atlas-note-test",
                "collection": "Engineering Notes",
                "collection_is_new": False,
            },
            "03_nlp_entities.json": {"entity_candidates": []},
            "04_all_entities.json": {
                "temporal_phases": [],
                "entities": [self.entity("Mira"), self.entity("Atlas")],
            },
            "05_embeddings.json": {
                "model": "all-MiniLM-L6-v2",
                "dimensions": 384,
                "embeddings": [self.embedding(name) for name in ("Mira", "Atlas", "atlas-note-test")],
            },
            "06_extraction.json": {
                "project": {
                    "name": "Mira and Atlas",
                    "unique_id": "atlas-note-test",
                    "summary": "Mira created the engine Atlas.",
                    "narrative_flow": [],
                    "tags": {"domain": "Engineering", "subdomain": "Engines", "base_tags": ["Atlas"]},
                },
                "relationships": [],
                "causal_chains": [],
            },
        }

    @staticmethod
    def entity(name):
        return {
            "name": name,
            "aliases": [],
            "category": "Person" if name == "Mira" else "Technology",
            "definition": "Creator of Atlas." if name == "Mira" else "An engine created by Mira.",
            "role": "Creator." if name == "Mira" else "The creation.",
            "first_appearance_index": None,
        }

    @staticmethod
    def embedding(name):
        # Synthetic vectors exercise shape validation; no model is loaded by tests.
        return {"name": name, "embedding": [0.125] + [0.0] * 383, "dimensions": 384}

    @staticmethod
    def relationship(**overrides):
        result = {
            "source": "Mira",
            "target": "Atlas",
            "relType": "CREATED",
            "causalClassification": "PRODUCES",
            "description": "The source attributes Atlas's creation to Mira.",
            "evidence": "Mira created Atlas.",
            "evidenceStrength": "claimed",
            "magnitude": "significant",
            "year": "",
        }
        result.update(overrides)
        return result

    def validate(self, **kwargs):
        for filename, artifact in self.artifacts.items():
            (self.project / filename).write_text(json.dumps(artifact), encoding="utf-8")
        return validator.validate_project(str(self.project), **kwargs)

    def assertRule(self, result, rule):
        self.assertFalse(result["valid"], result)
        self.assertIn(rule, {error["rule"] for error in result["errors"]}, result)

    def test_small_source_needs_no_density_or_narrative_quotas(self):
        self.artifacts["04_all_entities.json"]["entities"] = [self.entity("Mira")]
        self.artifacts["05_embeddings.json"]["embeddings"] = [
            self.embedding("Mira"), self.embedding("atlas-note-test")
        ]
        result = self.validate()
        self.assertTrue(result["valid"], result)
        self.assertEqual(result["stats"], {
            "entities": 1, "relationships": 0, "causal_chains": 0,
            "embeddings": 2, "temporal_phases": 0,
        })

    def test_empty_entity_graph_is_rejected(self):
        self.artifacts["04_all_entities.json"]["entities"] = []
        self.assertRule(self.validate(), "ENTITY_COUNT_MIN")

    def test_empty_nlp_result_is_valid_but_error_payload_is_not(self):
        self.assertTrue(self.validate()["valid"])
        self.artifacts["03_nlp_entities.json"] = {"error": "Model unavailable"}
        self.assertRule(self.validate(), "NLP_CANDIDATES")

    def test_source_quotes_accept_whitespace_changes_and_reject_fabrication(self):
        self.artifacts["06_extraction.json"]["relationships"] = [
            self.relationship(evidence="Mira  created\nAtlas.")
        ]
        self.assertTrue(self.validate()["valid"])
        self.artifacts["06_extraction.json"]["relationships"][0]["evidence"] = "Mira destroyed Atlas."
        self.assertRule(self.validate(), "EXTRACT_EVIDENCE_SOURCE")

    def test_legacy_project_without_source_remains_valid(self):
        (self.project / "source.md").unlink()
        self.artifacts["06_extraction.json"]["relationships"] = [self.relationship()]
        self.assertTrue(self.validate()["valid"])

    def test_unknown_relationship_endpoint_is_rejected(self):
        self.artifacts["06_extraction.json"]["relationships"] = [
            self.relationship(target="Unknown engine")
        ]
        self.assertRule(self.validate(), "EXTRACT_ENTITY_MATCH")

    def test_causal_chain_requires_an_evidenced_relationship(self):
        self.artifacts["06_extraction.json"]["causal_chains"] = [{
            "name": "Creation",
            "links": [{"source": "Mira", "target": "Atlas", "explanation": "Mira creates Atlas."}],
        }]
        self.assertRule(self.validate(), "EXTRACT_CHAIN_EVIDENCE")
        self.artifacts["06_extraction.json"]["relationships"] = [self.relationship()]
        self.assertTrue(self.validate()["valid"])

    def test_phase_references_require_supported_integer_indices(self):
        entity = self.artifacts["04_all_entities.json"]["entities"][0]
        entity["first_appearance_index"] = 1
        self.assertRule(self.validate(), "ENTITY_PHASE_MAP")
        self.artifacts["04_all_entities.json"]["temporal_phases"] = [
            {"index": 1, "label": "Creation", "period": "During the note"}
        ]
        self.assertTrue(self.validate()["valid"])
        entity["first_appearance_index"] = True
        self.assertRule(self.validate(), "ENTITY_PHASE_MAP")

    def test_duplicate_entities_are_rejected(self):
        self.artifacts["04_all_entities.json"]["entities"].append(self.entity("Mira"))
        self.assertRule(self.validate(), "ENTITY_DUPLICATE")

    def test_project_ids_must_agree(self):
        self.artifacts["06_extraction.json"]["project"]["unique_id"] = "different-id"
        self.assertRule(self.validate(), "EXTRACT_ID_MATCH")

    def test_complete_embedding_coverage_and_project_last_are_required(self):
        vectors = self.artifacts["05_embeddings.json"]["embeddings"]
        vectors.pop(0)
        self.assertRule(self.validate(), "EMBED_ENTITY_MATCH")
        vectors.insert(0, self.embedding("Mira"))
        vectors.reverse()
        self.assertRule(self.validate(), "EMBED_PROJECT")

    def test_duplicate_unexpected_and_ambiguous_embedding_names_are_rejected(self):
        vectors = self.artifacts["05_embeddings.json"]["embeddings"]
        vectors[1]["name"] = "Mira"
        self.assertRule(self.validate(), "EMBED_DUPLICATE")
        vectors[1]["name"] = "Unknown entity"
        self.assertRule(self.validate(), "EMBED_ENTITY_MATCH")
        self.artifacts["04_all_entities.json"]["entities"][1]["name"] = "atlas-note-test"
        vectors[1]["name"] = "atlas-note-test"
        self.assertRule(self.validate(), "EMBED_PROJECT_NAME")

    def test_missing_and_zero_embeddings_are_rejected(self):
        vectors = self.artifacts["05_embeddings.json"]["embeddings"]
        vectors[0]["embedding"] = [0.0] * 384
        self.assertRule(self.validate(), "EMBED_ZERO")
        self.artifacts["05_embeddings.json"]["embeddings"] = []
        self.assertRule(self.validate(), "EMBED_COUNT")

    def test_nonfinite_nonnumeric_and_overflowing_vector_values_report_errors(self):
        for value in (True, "0.1", None, float("nan"), float("inf"), 10 ** 400):
            with self.subTest(value_type=type(value).__name__):
                self.artifacts["05_embeddings.json"]["embeddings"][0]["embedding"][0] = value
                self.assertRule(self.validate(), "EMBED_FIELDS")

    def test_wrong_embedding_dimensions_are_rejected(self):
        self.artifacts["05_embeddings.json"]["embeddings"][0]["embedding"].pop()
        self.assertRule(self.validate(), "EMBED_DIMENSIONS")

    def test_malformed_top_level_artifacts_return_errors_without_crashing(self):
        for filename in self.artifacts:
            with self.subTest(filename=filename):
                original = self.artifacts[filename]
                self.artifacts[filename] = []
                result = self.validate()
                self.assertFalse(result["valid"], result)
                self.assertTrue(any(error["file"] == filename for error in result["errors"]), result)
                self.artifacts[filename] = original

    def test_invalid_nested_types_return_errors_without_crashing(self):
        self.artifacts["04_all_entities.json"]["entities"][0]["category"] = []
        self.artifacts["06_extraction.json"]["relationships"] = [self.relationship(causalClassification={})]
        result = self.validate()
        self.assertRule(result, "ENTITY_CATEGORY")
        self.assertRule(result, "EXTRACT_CAUSAL_CLASS")


if __name__ == "__main__":
    unittest.main()
