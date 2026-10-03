"""No provider requests or Neo4j writes: pipeline dependencies are mocked."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bulk_ingest", ROOT / "bulk_ingest.py")
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)


class BulkIngestTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="nitanics-ingest-test-")
        self.addCleanup(self.temp.cleanup)
        self.cwd = Path(self.temp.name) / "apps" / "ingestion-pipeline"
        self.cwd.mkdir(parents=True)

    def test_new_uploads_never_replace_existing_artifacts(self):
        first, first_id = pipeline.reserve_project_directory(str(self.cwd), "Research", "same-name")
        source = Path(first) / "source.md"
        source.write_text("Original source", encoding="utf-8")
        second, second_id = pipeline.reserve_project_directory(str(self.cwd), "Research", "same-name")
        self.assertNotEqual(first_id, second_id)
        self.assertNotEqual(first, second)
        self.assertEqual(source.read_text(encoding="utf-8"), "Original source")
        self.assertTrue(Path(second).is_relative_to(Path(self.temp.name) / "graphs"))

    def test_invalid_small_extraction_is_preserved_without_fabrication_or_upload(self):
        entities = {"temporal_phases": [], "entities": [{"name": "Alice", "aliases": [], "category": "Person", "definition": "A person in the source.", "role": "Speaker", "first_appearance_index": 1}]}
        extraction = {"project": {"summary": "Alice is a speaker.", "narrative_flow": [], "tags": {}}, "relationships": [], "causal_chains": []}
        calls = []

        def run(command, **_kwargs):
            calls.append(command)
            raise subprocess.CalledProcessError(1, command)

        with patch.object(pipeline, "call_llm", side_effect=[json.dumps(entities), json.dumps(extraction)]), \
             patch.object(pipeline, "run_json_script", return_value={"entity_candidates": []}), \
             patch.object(pipeline.subprocess, "run", side_effect=run):
            with self.assertRaises(subprocess.CalledProcessError):
                pipeline.process_project("Source", "source", "Alice is a speaker.", "Research", "Research", str(self.cwd), "test-model")
        project_dir = next((Path(self.temp.name) / "graphs" / "research").iterdir())
        actual_entities = json.loads((project_dir / "04_all_entities.json").read_text())
        actual_extraction = json.loads((project_dir / "06_extraction.json").read_text())
        self.assertEqual(actual_entities, entities)
        self.assertEqual(actual_extraction["relationships"], [])
        self.assertEqual(actual_extraction["causal_chains"], [])
        self.assertEqual(actual_extraction["project"]["summary"], "Alice is a speaker.")
        self.assertFalse(any("upload.py" in command for command in calls))
        self.assertEqual((project_dir / "source.md").read_text(), "Alice is a speaker.")

    def test_unsupported_quote_stops_before_embedding_or_upload(self):
        entities = {"temporal_phases": [], "entities": []}
        extraction = {"project": {"summary": "Source summary"}, "relationships": [{"evidence": "This did not occur"}], "causal_chains": []}
        with patch.object(pipeline, "call_llm", side_effect=[json.dumps(entities), json.dumps(extraction)]), \
             patch.object(pipeline, "run_json_script", return_value={"entity_candidates": []}) as scripts, \
             patch.object(pipeline.subprocess, "run") as run:
            with self.assertRaisesRegex(ValueError, "unsupported source evidence"):
                pipeline.process_project("Source", "source", "Actual source words", "Research", "Research", str(self.cwd), "test-model")
            self.assertEqual(scripts.call_count, 1)
            run.assert_not_called()

    def test_selected_provider_and_explicit_key_win_over_dotenv(self):
        env_dir = self.cwd / "neo4j"
        env_dir.mkdir()
        (env_dir / ".env").write_text("OPENAI_API_KEY=file-key\nGEMINI_API_KEY=other-provider\n", encoding="utf-8")
        with patch.dict(os.environ, {"NITANICS_LLM_PROVIDER": "openai", "OPENAI_API_KEY": "request-key"}, clear=True):
            pipeline.load_provider_environment(str(self.cwd))
            self.assertEqual(os.environ["OPENAI_API_KEY"], "request-key")
            self.assertNotIn("GEMINI_API_KEY", os.environ)

    def test_total_and_partial_failures_return_nonzero_status(self):
        folder = self.cwd / "uploads"
        folder.mkdir()
        (folder / "a.md").write_text("Alice is a speaker", encoding="utf-8")
        (folder / "b.md").write_text("Bob is a speaker", encoding="utf-8")
        args = ["bulk_ingest.py", "--folder", str(folder), "--collection", "Research"]
        for outcomes in ([False, False], [True, False]):
            with self.subTest(outcomes=outcomes), patch.object(sys, "argv", args), \
                 patch.object(pipeline, "load_provider_environment"), \
                 patch.object(pipeline, "process_project", side_effect=outcomes), \
                 patch.object(pipeline.subprocess, "run"):
                self.assertEqual(pipeline.main(), 1)

    def test_source_html_escapes_document_markup(self):
        html = pipeline.wrap_html("<script>title</script>", "<script>alert('source')</script>")
        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;", html)

    def test_long_single_paragraph_obeys_chunk_limit(self):
        text = "Document words " * 100
        chunks = pipeline.chunk_document(text, 100)
        self.assertTrue(all(len(chunk) <= 100 for chunk in chunks))
        self.assertEqual(" ".join(" ".join(chunks).split()), " ".join(text.split()))
        self.assertTrue(all(len(chunk) <= 100 for chunk in pipeline.chunk_document("x" * 405, 100)))
        with self.assertRaises(ValueError):
            pipeline.chunk_document("text", 0)


if __name__ == "__main__":
    unittest.main()
