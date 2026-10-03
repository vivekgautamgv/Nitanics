import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('export_collection', ROOT / 'neo4j' / 'export_collection.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportSourcesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='nitanics-export-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pipeline = self.root / 'apps' / 'ingestion-pipeline'
        self.pipeline.mkdir(parents=True)
        self.patch = patch.multiple(exporter, BASE_DIR=str(self.pipeline), SOURCES_DIR=str(self.pipeline / 'data' / 'sources'), EXTRACTED_DIR=str(self.pipeline / 'data' / 'extracted'))
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def test_canonical_graph_source_and_adjacent_extraction_are_exported(self):
        project = self.root / 'graphs' / 'research' / 'document-unique-id'
        project.mkdir(parents=True)
        (project / '01_html.html').write_text('<p>Correct source</p>', encoding='utf-8')
        (project / '06_extraction.json').write_text('{}', encoding='utf-8')
        result = exporter.find_project_files('graphs/research/document-unique-id/01_html.html')
        self.assertEqual(Path(result['html']), project / '01_html.html')
        self.assertEqual(Path(result['extraction']), project / '06_extraction.json')

    def test_missing_path_never_attaches_an_unrelated_source(self):
        unrelated = self.pipeline / 'data' / 'sources' / '2026-01-01' / 'other-document'
        unrelated.mkdir(parents=True)
        (unrelated / '01_html.html').write_text('Unrelated source', encoding='utf-8')
        self.assertIsNone(exporter.find_project_files('')['html'])
        self.assertIsNone(exporter.find_project_files('graphs/../../secret/01_html.html')['html'])

    def test_chain_enrichment_uses_project_identity_when_names_collide(self):
        extraction = self.root / '06_extraction.json'
        extraction.write_text(json.dumps({'project': {'name': 'Repeated title', 'unique_id': 'first'}, 'causal_chains': [{'name': 'Same chain', 'links': [{'source': 'A', 'target': 'B', 'explanation': 'First project facts'}]}]}), encoding='utf-8')
        graph = {'causal_chains': [
            {'name': 'Same chain', 'project': 'Repeated title', 'projectUniqueId': 'first', 'links': []},
            {'name': 'Same chain', 'project': 'Repeated title', 'projectUniqueId': 'second', 'links': []},
        ]}
        exporter.enrich_causal_chains(graph, {'first': {'extraction': str(extraction)}})
        self.assertEqual(len(graph['causal_chains'][0]['links']), 1)
        self.assertEqual(graph['causal_chains'][1]['links'], [])

    def test_relationship_assertions_keep_separate_project_evidence(self):
        relationship = {'source': 'A', 'target': 'B', 'relType': 'SUPPORTS', 'causalClassification': 'SUPPORTS', 'description': 'Source explanation', 'evidence': 'Source quote', 'projectId': 'first'}
        graph_data = {key: [] for key in ['projects', 'entities', 'causal_chains', 'temporal_events', 'similar_pairs']}
        graph_data['relationships'] = [relationship, {**relationship, 'projectId': 'second'}]
        graph = exporter.build_graph_json({'name': 'Research', 'id': 'collection'}, graph_data)
        self.assertEqual(len(graph['relationships']), 2)
        self.assertEqual([r['projectId'] for r in graph['relationships']], ['first', 'second'])


if __name__ == '__main__':
    unittest.main()
