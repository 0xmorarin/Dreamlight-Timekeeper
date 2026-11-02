"""05 QR Round 5 synthetic-only independent private HOLD and RGBA guards."""
import copy
import importlib.util
import json
import struct
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('round5_steam_review',ROOT/'scripts'/'audit-steam-ui-atlas.py')
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class IndependentPrivateTrial(unittest.TestCase):
    def setUp(self):
        self.ledger=json.loads((ROOT/'data'/'steam-ui-candidates-v1253.json').read_text(encoding='utf-8'))
        self.manifest=json.loads((ROOT/'data'/'steam-ui-icons-v1253.json').read_text(encoding='utf-8'))
    def test_external_directory_is_required_and_existing_public_images_are_not_private_trial_candidates(self):
        with TemporaryDirectory() as directory:
            external=Path(directory)
            for key in ('world.hgw','tab.shops','tab.daily'):
                row=audit.private_trial_candidate(self.ledger,key,external)
                self.assertTrue(row['reviewState'].startswith('HOLD_'))
                self.assertNotIn(key,self.manifest['icons'])
            for key in ('world.valley','skill.mining','../../assets','undefined'):
                with self.assertRaises(ValueError):
                    audit.private_trial_candidate(self.ledger,key,external)
            with self.assertRaises(ValueError):
                audit.private_trial_candidate(self.ledger,'world.hgw',ROOT/'assets'/'steam')
            changed=copy.deepcopy(self.ledger)
            changed['candidates'].append(copy.deepcopy(next(x for x in changed['candidates'] if x['key']=='world.hgw')))
            with self.assertRaises(ValueError):
                audit.private_trial_candidate(changed,'world.hgw',external)
    def test_lossless_private_rgba_parity_and_corrupt_container_are_refused(self):
        with TemporaryDirectory() as directory:
            d=Path(directory);png=d/'a.png';webp=d/'a.webp'
            image=Image.new('RGBA',(3,2))
            image.putdata([(1,2,3,0),(4,5,6,255),(71,83,99,150),
                           (250,120,55,0),(128,62,202,80),(9,8,7,255)])
            image.save(png)
            image.save(webp,format='WEBP',lossless=True,method=6,exact=True)
            result=audit.verify_private_rgba_parity(png,webp,3,2)
            self.assertEqual(result['width'],3)
            self.assertEqual(result['height'],2)
            self.assertEqual(len(result['rgbaSha256']),64)
            with self.assertRaises(ValueError):
                audit.verify_private_rgba_parity(png,webp,2,3)
            corrupted=bytearray(webp.read_bytes())
            corrupted[12:16]=b'VP8 '
            webp.write_bytes(corrupted)
            with self.assertRaises(ValueError):
                audit.verify_private_rgba_parity(png,webp,3,2)

if __name__=='__main__': unittest.main()
