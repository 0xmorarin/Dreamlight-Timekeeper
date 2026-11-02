import importlib.util
import struct
import unittest
from pathlib import Path

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

if __name__=='__main__':
    unittest.main()
