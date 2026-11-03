"""Read-only private UnityFS shared-placeholder audit; stdout metadata only.

Usage: python scripts/audit-shared-placeholder-source.py --bundle PRIVATE_BUNDLE [--check-webp]
Requires lz4; optional Pillow for independent in-memory lossless VP8L parity.
Do not commit original bundle, decoded pixels or generated game-derived WebP.
"""
import argparse
import hashlib
import io
import json
import re
import struct
from pathlib import Path

import lz4.block

GUID = b"04495f960b1edba4181ec51efa5e07d9"
SOURCE_SHA = "b839b22a5522e3c0b66a3a5831f427b5baac947d2ab56216e80d8a5273cb2eaf"
CAB = "CAB-5cfb74fab599979a6c24300d60fa8800"
SPRITE = 13192077654445607906
TEXTURE = 15528772250824494050


def rd(b, p, kind):
    return struct.unpack_from(kind, b, p)[0]


def align(p, n=16):
    return (p+n-1)//n*n


def cstr(b, p):
    end = b.index(0, p)
    return b[p:end].decode("ascii"), end+1


def decompress(src, n, flags):
    mode = flags & 63
    if mode == 0 and len(src) == n:
        return src
    if mode in (2, 3):
        return lz4.block.decompress(src, uncompressed_size=n)
    raise ValueError("unexpected UnityFS compression")


def bundle_nodes(src):
    p = 0
    magic, p = cstr(src, p)
    version = rd(src, p, ">I"); p += 4
    _, p = cstr(src, p)
    unity, p = cstr(src, p)
    size = rd(src, p, ">Q"); p += 8
    comp = rd(src, p, ">I")
    plain = rd(src, p+4, ">I")
    flags = rd(src, p+8, ">I"); p += 12
    if magic != "UnityFS" or version != 8 or unity != "6000.0.62f1" or size != len(src):
        raise ValueError("version/size mismatch")
    start = len(src)-comp if flags & 128 else (align(p) if flags & 512 else p)
    directory = decompress(src[start:start+comp], plain, flags)
    q = 16
    count = rd(directory, q, ">I"); q += 4
    blocks = []
    for _ in range(count):
        blocks.append((rd(directory,q,">I"),rd(directory,q+4,">I"),rd(directory,q+8,">H")))
        q += 10
    count = rd(directory, q, ">I"); q += 4
    names = []
    for _ in range(count):
        off = rd(directory,q,">Q"); n = rd(directory,q+8,">Q"); q += 20
        name,q = cstr(directory,q)
        names.append((name,off,n))
    pos = (align(p) if flags & 512 else p) if flags & 128 else (
        align(start+comp) if flags & 512 else start+comp)
    if sum(block[0] for block in blocks) > 128*1024*1024:
        raise ValueError("oversized audit source")
    data = bytearray()
    for plain,packed,fl in blocks:
        data.extend(decompress(src[pos:pos+packed],plain,fl))
        pos += packed
    out = {}
    for name,off,n in names:
        if off+n > len(data) or name in out:
            raise ValueError("CAB node overlap/out-of-bounds")
        out[name] = bytes(data[off:off+n])
    return out


def object_directory(cab):
    if rd(cab,8,">I") != 22:
        raise ValueError("unsupported serialized format")
    data_off = rd(cab,32,">Q")
    p = 48
    _,p = cstr(cab,p); p += 4
    if cab[p] != 0:
        raise ValueError("inline typetree is not supported")
    p += 1
    count = rd(cab,p,"<I"); p += 4
    types = []
    for _ in range(count):
        typ = rd(cab,p,"<i"); types.append(typ)
        # SerializedType carries an extra 16-byte script identifier for MonoBehaviour.
        p += 23+(16 if typ == 114 else 0)
    count = rd(cab,p,"<I"); p += 4
    if not 1 <= count <= 1024:
        raise ValueError("unexpected object cardinality")
    objects = {}
    for _ in range(count):
        path_id = rd(cab,p,"<Q")
        off = rd(cab,p+8,"<Q")
        n = rd(cab,p+16,"<I")
        type_idx = rd(cab,p+20,"<I")
        p += 24
        if type_idx >= len(types) or data_off+off+n > len(cab) or path_id in objects:
            raise ValueError("invalid object range/type")
        payload = cab[data_off+off:data_off+off+n]
        name_len = rd(payload,0,"<I") if len(payload)>=4 else 0
        name = payload[4:4+name_len].decode("utf8","replace") if 0<name_len<1024 and name_len+4<=len(payload) else ""
        objects[path_id] = (types[type_idx],name,payload)
    return objects


def audit(path, check_webp=False):
    raw = Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_SHA:
        raise ValueError("wrong original v1.25.3 bundle SHA256")
    nodes = bundle_nodes(raw)
    cab = nodes[CAB]
    stream = nodes[CAB+".resS"]
    objects = object_directory(cab)
    roots = [v[2] for v in objects.values() if v[0]==142]
    if len(roots) != 1:
        raise ValueError("unexpected AssetBundle object count")
    links = {28:set(),213:set()}
    for match in re.finditer(GUID,roots[0]):
        for i in range(match.end(),min(match.end()+24,len(roots[0])-8)):
            ref=rd(roots[0],i,"<Q")
            if ref in objects and objects[ref][0] in links:
                links[objects[ref][0]].add(ref)
    if links != {28:{TEXTURE},213:{SPRITE}}:
        raise ValueError("generic GUID->Sprite/Texture not unique")
    _,sprite_name,sprite=objects[SPRITE]
    _,texture_name,texture=objects[TEXTURE]
    if sprite_name!="icon_2x2" or texture_name!=sprite_name or rd(sprite,116,"<Q")!=TEXTURE:
        raise ValueError("generic Sprite->Texture pointer mismatch")
    p = align(4+len(texture_name),4)
    width=rd(texture,p+4,"<I")
    height=rd(texture,p+8,"<I")
    fmt=rd(texture,p+20,"<I")
    offset=rd(texture,len(texture)-104,"<Q")
    length=rd(texture,len(texture)-96,"<I")
    if (width,height,fmt)!=(265,246,4) or length!=width*height*4 or offset+length>len(stream):
        raise ValueError("RGBA32 source byte range mismatch")
    rgba=stream[offset:offset+length]
    classes={str(v):sum(x[0]==v for x in objects.values()) for v in sorted({x[0] for x in objects.values()})}
    report={"sourceSha256":SOURCE_SHA,"cab":CAB,"guid":GUID.decode(),
            "assetBundleGuidMatches":2,"sourceObjects":len(objects),"sourceClasses":classes,
            "genericSpriteName":sprite_name,"genericSpritePathId":str(SPRITE),
            "genericTexturePathId":str(TEXTURE),"width":width,"height":height,
            "textureFormat":"RGBA32","rawTextureRgbaSha256":hashlib.sha256(rgba).hexdigest(),
            "rawTextureRgbaBytes":len(rgba),"perItemVariant":"UNKNOWN",
            "sharedSourceOnly":True,"itemImageUrlsAuthorized":0,"publishedBytes":False}
    if check_webp:
        from PIL import Image
        buffer=io.BytesIO()
        Image.frombytes("RGBA",(width,height),rgba).save(
            buffer,format="WEBP",lossless=True,method=6,exact=True)
        webp=buffer.getvalue()
        identical=Image.open(io.BytesIO(webp)).convert("RGBA").tobytes()==rgba
        if not identical:
            raise ValueError("generic private RGBA->VP8L->RGBA mismatch")
        report["privateGenericVp8l"]={"sha256":hashlib.sha256(webp).hexdigest(),
                                       "bytes":len(webp),"rgbaIdentical":True,
                                       "itemIdCoverageGranted":0}
    return report


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle",required=True,type=Path)
    parser.add_argument("--check-webp",action="store_true")
    args=parser.parse_args()
    print(json.dumps(audit(args.bundle,args.check_webp),sort_keys=True,indent=2))
