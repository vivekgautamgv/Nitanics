import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'neo4j'))
spec = importlib.util.spec_from_file_location('upload', ROOT / 'neo4j' / 'upload.py')
uploader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(uploader)


class UploadFailureTests(unittest.TestCase):
    def test_failed_neo4j_statement_and_batch_raise(self):
        failure = {'ok': False, 'errors': [{'message': 'Database unavailable'}], 'data': []}
        with patch.object(uploader, '_run_cypher', return_value=failure):
            with self.assertRaisesRegex(RuntimeError, 'Database unavailable'):
                uploader.run_cypher('RETURN 1')
        with patch.object(uploader, '_run_batch', return_value=failure):
            with self.assertRaisesRegex(RuntimeError, 'Database unavailable'):
                uploader.create_entity_nodes({'entities': [{'name': 'Alice', 'aliases': []}]}, 'project')

    def test_scaffold_keeps_canonical_source_path_and_reuses_collection(self):
        batches = []

        def run_batch(statements):
            batches.append(statements)
            if len(batches) == 1:
                return {'ok': True, 'errors': [], 'data': [None, None, None, {'data': [{'row': ['project-id']}]}]}
            return {'ok': True, 'errors': [], 'data': []}

        project = {'name': 'Paper', 'unique_id': 'paper-new-id', 'summary': 'Grounded summary', 'narrative_flow': [], 'tags': {'domain': 'Research', 'subdomain': 'AI', 'base_tags': ['Paper']}}
        placement = {'project_name': 'paper-new-id', 'collection': 'Research', 'directory': 'Research', 'collection_is_new': True}
        with patch.object(uploader, '_run_batch', side_effect=run_batch), \
             patch.object(uploader, '_run_cypher', return_value={'ok': True, 'errors': [], 'data': [{'data': [{'row': ['existing-collection-id']}]}]}) as query:
            project_id, collection_id, error = uploader.create_scaffold({'project': project}, placement, html_path='graphs/research/paper-new-id/01_html.html')
        self.assertEqual(project_id, 'project-id')
        self.assertEqual(collection_id, 'existing-collection-id')
        self.assertIsNone(error)
        self.assertEqual(batches[0][3][1]['htmlPath'], 'graphs/research/paper-new-id/01_html.html')
        self.assertIn('MERGE (c:Collection', query.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
