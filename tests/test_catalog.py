"""Run: python -m unittest discover -s tests -p test_catalog.py"""
import unittest
from update_catalog import extract_catalog


class CatalogTest(unittest.TestCase):
    def test_json_only_and_invalid_input(self):
        item = '{"url":"https://raw.githubusercontent.com/noxelisdev/TFT_DDragon/master/a.png","name":"素材"}'
        self.assertEqual(len(extract_catalog('const ITEMS = /* source */[' + item + ',' + item + '];')), 1)
        for source in ['const ITEMS = [];', 'const ITEMS = alert(1);', 'const ITEMS = [{"url":"javascript:alert(1)","name":"bad"}];']:
            with self.assertRaises(ValueError):
                extract_catalog(source)
