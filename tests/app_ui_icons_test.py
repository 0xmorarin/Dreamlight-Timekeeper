import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('app_ui_builder', ROOT / 'scripts' / 'build-app-ui-icons.py')
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)

class AppIconTests(unittest.TestCase):
    def test_published_48px_lossless_icons_match_original_pixel_source(self):
        manifest = json.loads((ROOT / 'data' / 'app-ui-icons.json').read_text('utf-8'))
        self.assertEqual(set(manifest['icons']), set(BUILDER.KEYS))
        self.assertFalse(manifest['source']['writerAuthorization'])
        for key, record in manifest['icons'].items():
            image = BUILDER.render(key)
            file = ROOT / record['path']
            payload = file.read_bytes()
            self.assertEqual(payload[12:16], b'VP8L')
            self.assertEqual(hashlib.sha256(payload).hexdigest(), record['sha256'])
            self.assertEqual(hashlib.sha256(image.tobytes()).hexdigest(), record['sourceSha256'])
            saved = Image.open(file).convert('RGBA')
            self.assertEqual(saved.size, (48, 48))
            self.assertEqual(saved.tobytes(), image.tobytes())

    def test_regeneration_preserves_every_original_glyph(self):
        with tempfile.TemporaryDirectory() as directory:
            generated = BUILDER.generate(directory)
            expected = json.loads((ROOT / 'data' / 'app-ui-icons.json').read_text('utf-8'))
            self.assertEqual(set(generated['icons']), set(expected['icons']))
            for key in generated['icons']:
                output = Path(directory) / generated['icons'][key]['path']
                self.assertEqual(Image.open(output).convert('RGBA').tobytes(),
                                 Image.open(ROOT / expected['icons'][key]['path']).convert('RGBA').tobytes())

if __name__ == '__main__':
    unittest.main()
