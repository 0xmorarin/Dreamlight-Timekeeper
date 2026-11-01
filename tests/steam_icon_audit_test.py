import importlib.util
import struct
import unittest
from pathlib import Path

path=Path(__file__).resolve().parents[1]/'scripts'/'audit-steam-icons.py'
spec=importlib.util.spec_from_file_location('steam_audit',path)
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class SteamIconAuditTests(unittest.TestCase):
    def test_literal_lz4(self):
        self.assertEqual(audit.decode(b'\x40ABCD',4,3),b'ABCD')

    def test_protobuf_guid_itemid(self):
        guid=b'guid:' + b'a'*32
        inner=b'\x08'+b'\x15'+b'\x12\x06Sample'+b'\x22'+bytes([len(guid)])+guid
        block=bytes([1,len(inner)])+inner
        mapping=audit.activity_icons(block)
        self.assertEqual(mapping['a'*32],[('21','Sample')])

    def test_bundle_container_sprite_texture_guid_join(self):
        guid=b'b'*32
        id_texture=801
        id_sprite=802
        data=b'\x20\x00\x00\x00'+guid+b'\x00\x00\x00\x00'+struct.pack('<Q',id_texture)
        data+=b'\x20\x00\x00\x00'+guid+b'\x00\x00\x00\x00'+struct.pack('<Q',id_sprite)
        objs={1:{'classId':142,'data':data},id_texture:{'classId':28,'data':b''},
              id_sprite:{'classId':213,'data':b''}}
        found=audit.links(objs)
        self.assertEqual(found['b'*32][28],{id_texture})
        self.assertEqual(found['b'*32][213],{id_sprite})

    def test_dds_headers_differentiate_BC7_and_DXT5(self):
        for fmt,expected in [(12,b'DXT5'),(25,b'DX10')]:
            pixel=b'\x00'*64
            output=audit.dds(8,8,fmt,pixel)
            self.assertEqual(output[84:88],expected)
            self.assertEqual(output[-64:],pixel)
            self.assertEqual(len(output),128+len(pixel)+(20 if fmt==25 else 0))

if __name__=='__main__':
    unittest.main()
