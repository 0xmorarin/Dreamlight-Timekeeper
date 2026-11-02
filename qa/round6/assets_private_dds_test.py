"""05 QR Round6: independent synthetic DDS decoder negative acceptance. No Steam source bytes."""
import importlib.util
import json
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('qr_round6_atlas',ROOT/'scripts'/'audit-steam-ui-atlas.py')
audit=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)

class Round6IndependentSourceBoundary(unittest.TestCase):
    def test_independent_compressed_dds_decode_rejects_png_mutation_and_dimensions(self):
        with TemporaryDirectory() as directory:
            base=Path(directory)
            master=base/'synthetic.png'
            dds=base/'synthetic.dds'
            expected=base/'decompressed.png'
            image=Image.new('RGBA',(8,8))
            image.putdata([((11*i)%256,(43+i)%256,(97+3*i)%256,255) for i in range(64)])
            image.save(master)
            subprocess.run(['magick',str(master),'-define','dds:compression=dxt5',str(dds)],check=True)
            subprocess.run(['magick',str(dds),str(expected)],check=True)
            evidence=audit.verify_private_dds_rgba(dds,expected,8,8)
            self.assertEqual(evidence['sourceTextureDecoders'],'PILLOW_DDS_AND_IMAGEMAGICK_DDS_AND_PNG_EQUAL')
            self.assertEqual(len(evidence['compressedSourceDecodedRgbaSha256']),64)
            with self.assertRaises(ValueError):
                audit.verify_private_dds_rgba(dds,expected,7,8)
            altered=Image.open(expected).convert('RGBA')
            altered.putpixel((4,2),(0,255,0,255))
            altered.save(expected)
            with self.assertRaises(ValueError):
                audit.verify_private_dds_rgba(dds,expected,8,8)
    def test_private_hold_candidate_prevents_repo_output_and_symlink_redirect(self):
        catalog=json.loads((ROOT/'data'/'steam-ui-candidates-v1253.json').read_text(encoding='utf-8'))
        manifest=json.loads((ROOT/'data'/'steam-ui-icons-v1253.json').read_text(encoding='utf-8'))
        with TemporaryDirectory() as directory:
            outside=Path(directory)
            for key in ('world.hgw','tab.shops','tab.daily'):
                row=audit.private_trial_candidate(catalog,key,outside)
                self.assertEqual(row['semanticUseProof'],'UNKNOWN')
                self.assertTrue(row['reviewState'].startswith('HOLD_'))
                self.assertNotIn(key,manifest['icons'])
            for key in ('world.valley','status.warning','unknown.future'):
                with self.assertRaises(ValueError):
                    audit.private_trial_candidate(catalog,key,outside)
            with self.assertRaises(ValueError):
                audit.private_trial_candidate(catalog,'world.hgw',ROOT/'qa'/'round6')
            private=outside/'private-steam-ui-review'
            private.symlink_to(ROOT,target_is_directory=True)
            with self.assertRaises(ValueError):
                audit.private_trial_candidate(catalog,'world.hgw',outside)

if __name__=='__main__': unittest.main()
