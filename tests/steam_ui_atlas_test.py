import importlib.util
import struct
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from PIL import Image
import json

path=Path(__file__).resolve().parents[1]/'scripts'/'audit-steam-ui-atlas.py'
spec=importlib.util.spec_from_file_location('steam_ui_atlas',path)
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class SteamUiAtlasTests(unittest.TestCase):
    def test_dds_bc7_dxt1_and_dxt5(self):
        for fmt,tag,head in [(25,b'DX10',148),(10,b'DXT1',128),(12,b'DXT5',128)]:
            row={'width':8,'height':8,'textureFormat':fmt}
            payload=b'Q'*64
            data=audit.dds_image(row,payload)
            self.assertEqual(data[84:88],tag)
            self.assertEqual(len(data),head+64)
            self.assertEqual(data[-64:],payload)

    def test_valid_exact_sprite_to_texture_link(self):
        name=b'IconWarning'
        width,height,fmt=32,32,25
        sprite_id=88
        texture_id=99
        sprite=bytearray(64)
        struct.pack_into('<I',sprite,0,len(name))
        sprite[4:4+len(name)]=name
        off=audit.align(4+len(name))
        struct.pack_into('<ffff',sprite,off,0,0,width,height)
        struct.pack_into('<Q',sprite,off+20,texture_id)
        texture=bytearray(256)
        struct.pack_into('<I',texture,0,len(name))
        texture[4:4+len(name)]=name
        toff=audit.align(4+len(name))
        struct.pack_into('<II',texture,toff+4,width,height)
        struct.pack_into('<I',texture,toff+20,fmt)
        struct.pack_into('<Q',texture,len(texture)-104,120)
        struct.pack_into('<I',texture,len(texture)-96,4096)
        objects={str(sprite_id):(213,name.decode(),bytes(sprite)),str(texture_id):(28,name.decode(),bytes(texture))}
        row={'key':'status.warning','spriteName':name.decode(),'spritePathId':str(sprite_id),
          'texturePathId':str(texture_id),'width':width,'height':height,'textureFormat':fmt}
        self.assertEqual(audit.inspect_candidate(row,objects),(120,1024))
        row['width']=33
        with self.assertRaises(ValueError):
            audit.inspect_candidate(row,objects)


    def test_private_hold_review_requires_unique_candidate_and_non_public_output(self):
        ledger=json.loads((Path(__file__).resolve().parents[1]/'data'/'steam-ui-candidates-v1253.json').read_text('utf-8'))
        with TemporaryDirectory() as directory:
            output=Path(directory)
            for key in ('world.hgw','tab.shops','tab.daily'):
                row=audit.private_trial_candidate(ledger,key,output)
                self.assertEqual(row['key'],key)
                self.assertTrue(row['reviewState'].startswith('HOLD_'))
            for key in ('world.valley','skill.mining','fake.key','bad/../key'):
                with self.assertRaises(ValueError):
                    audit.private_trial_candidate(ledger,key,output)
            duplicate=json.loads(json.dumps(ledger))
            duplicate['candidates'].append(dict(duplicate['candidates'][-1]))
            with self.assertRaises(ValueError):
                audit.private_trial_candidate(duplicate,'world.hgw',output)
            with self.assertRaises(ValueError):
                audit.private_trial_candidate(ledger,'world.hgw',Path(__file__).resolve().parents[1]/'private-build')

    def test_private_lossless_trial_preserves_transparent_rgb_and_detects_mutation(self):
        with TemporaryDirectory() as directory:
            root=Path(directory)
            png=root/'test.png'
            webp=root/'test.webp'
            image=Image.new('RGBA',(3,2))
            image.putdata([(10,33,200,0),(200,100,10,255),(70,140,20,100),
                           (0,0,0,0),(255,0,255,3),(6,7,8,255)])
            image.save(png)
            image.save(webp,format='WEBP',lossless=True,method=6,exact=True)
            checks=audit.verify_private_rgba_parity(png,webp,3,2)
            self.assertEqual(len(checks['rgbaSha256']),64)
            self.assertEqual(len(checks['trialWebpSha256']),64)
            with self.assertRaises(ValueError):
                audit.verify_private_rgba_parity(png,webp,2,3)
            altered=bytearray(webp.read_bytes())
            altered[12:16]=b'VP8 '
            webp.write_bytes(altered)
            with self.assertRaises(ValueError):
                audit.verify_private_rgba_parity(png,webp,3,2)

if __name__=='__main__':
    unittest.main()
