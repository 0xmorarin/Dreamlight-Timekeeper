import argparse
import hashlib
import json
import re
import shutil
import struct
import subprocess
import tempfile
from collections import defaultdict
from pathlib import Path

import lz4.block

def rd(b,p,fmt):
    return struct.unpack_from(fmt,b,p)[0]

def sha(b):
    return hashlib.sha256(b).hexdigest()

def align(v,n=16):
    return (v+n-1)//n*n

def cstr(b,p):
    e=b.index(0,p)
    return b[p:e].decode('utf-8'),e+1

def decode(raw,size,flags):
    mode=flags&63
    if mode==0 and len(raw)==size:
        return raw
    if mode in (2,3):
        return lz4.block.decompress(raw,uncompressed_size=size)
    raise ValueError('Unknown UnityFS compression')

def bundle_nodes(b):
    p=0
    marker,p=cstr(b,p)
    version=rd(b,p,'>I');p+=4
    unity,p=cstr(b,p)
    revision,p=cstr(b,p)
    size=rd(b,p,'>Q');p+=8
    comp=rd(b,p,'>I');rawsize=rd(b,p+4,'>I');flags=rd(b,p+8,'>I');p+=12
    if marker!='UnityFS' or version!=8 or size!=len(b) or not revision.startswith('6000.'):
        raise ValueError('Unrecognized Steam UnityFS format')
    info_start=len(b)-comp if flags&128 else (align(p) if flags&512 else p)
    info=decode(b[info_start:info_start+comp],rawsize,flags)
    q=16;n=rd(info,q,'>I');q+=4
    blocks=[]
    for _ in range(n):
        blocks.append((rd(info,q,'>I'),rd(info,q+4,'>I'),rd(info,q+8,'>H')))
        q+=10
    n=rd(info,q,'>I');q+=4
    nodes=[]
    for _ in range(n):
        off=rd(info,q,'>Q');length=rd(info,q+8,'>Q');q+=20
        name,q=cstr(info,q)
        nodes.append((name,off,length))
    start=(align(info_start+comp) if flags&512 else info_start+comp) if not flags&128 else (align(p) if flags&512 else p)
    if sum(x[0] for x in blocks)>512*1024*1024:
        raise ValueError('Uncompressed bundle exceeds research limit')
    out=bytearray()
    for size,comp,fl in blocks:
        out.extend(decode(b[start:start+comp],size,fl))
        start+=comp
    result={}
    for name,off,length in nodes:
        if off+length>len(out) or name in result:
            raise ValueError('Bad node range')
        result[name]=bytes(out[off:off+length])
    return revision,result

def unity_objects(cab):
    if rd(cab,8,'>I')!=22:
        raise ValueError('Expected Unity serialized format 22')
    dataoff=rd(cab,32,'>Q')
    p=48;revision,p=cstr(cab,p)
    p+=4
    if cab[p]!=0:
        raise ValueError('Unexpected Unity type tree')
    p+=1
    count=rd(cab,p,'<I');p+=4
    classes=[]
    for _ in range(count):
        classes.append(rd(cab,p,'<I'))
        p+=23
    count=rd(cab,p,'<I');p=align(p+4,8)
    if count>100000:
        raise ValueError('Unexpected serialized object count')
    result={}
    for _ in range(count):
        pid=rd(cab,p,'<Q')
        off=rd(cab,p+8,'<Q')
        size=rd(cab,p+16,'<I')
        class_index=rd(cab,p+20,'<I')
        p+=24
        if class_index>=len(classes) or dataoff+off+size>len(cab):
            raise ValueError('Invalid object location')
        payload=cab[dataoff+off:dataoff+off+size]
        n=rd(payload,0,'<I')
        name=payload[4:4+n].decode('utf-8') if 4+n<=len(payload) and n<1024 else ''
        result[pid]={'name':name,'classId':classes[class_index],'data':payload}
    return result

def vint(b,p):
    value=0
    for i in range(10):
        part=b[p];p+=1
        value|=(part&127)<<(i*7)
        if part<128:
            return value,p
    raise ValueError('Excessive varint')

def proto_fields(b):
    p=0;result={}
    while p<len(b):
        tag,p=vint(b,p)
        field,wire=tag>>3,tag&7
        if wire==0:
            value,p=vint(b,p)
        elif wire==2:
            n,p=vint(b,p);value=b[p:p+n];p+=n
        elif wire==1:
            value=b[p:p+8];p+=8
        elif wire==5:
            value=b[p:p+4];p+=4
        else:
            raise ValueError('Unsupported activity protobuf field')
        result[field]=value
    return result

def activity_icons(b):
    p=0;result=defaultdict(list)
    while p<len(b):
        _,p=vint(b,p)
        n,p=vint(b,p)
        if p+n>len(b):
            raise ValueError('Truncated activity item')
        fields=proto_fields(b[p:p+n]);p+=n
        if not all(k in fields for k in (1,2,4)):
            continue
        guid=fields[4].decode('ascii')
        if re.fullmatch('guid:[0-9a-f]{32}',guid):
            result[guid[5:]].append((str(fields[1]),fields[2].decode('utf-8')))
    return result

def links(objects):
    roots=[x['data'] for x in objects.values() if x['classId']==142]
    if len(roots)!=1:
        raise ValueError('Expected one AssetBundle object')
    data=roots[0]
    found=defaultdict(lambda:{28:set(),213:set()})
    for match in re.finditer(rb'\x20\x00\x00\x00([0-9a-f]{32})',data):
        guid=match.group(1).decode('ascii')
        for p in range(match.end(),min(len(data)-7,match.end()+24)):
            obj=objects.get(rd(data,p,'<Q'))
            if obj and obj['classId'] in (28,213):
                found[guid][obj['classId']].add(rd(data,p,'<Q'))
    return found

def texture(obj,ress):
    b=obj['data'];n=rd(b,0,'<I');p=align(4+n,4)
    w=rd(b,p+4,'<I');h=rd(b,p+8,'<I');fmt=rd(b,p+20,'<I')
    stream=len(b)-104
    off=rd(b,stream,'<Q');size=rd(b,stream+8,'<I')
    amount=((w+3)//4)*((h+3)//4)*16
    if fmt not in (12,25) or not 1<=w<=1024 or not 1<=h<=1024:
        raise ValueError('Unsupported texture format/size')
    if size<amount or off+amount>len(ress):
        raise ValueError('Texture stream invalid')
    return w,h,fmt,ress[off:off+amount]

def dds(w,h,fmt,pixels):
    out=bytearray(148 if fmt==25 else 128)
    out[:4]=b'DDS '
    struct.pack_into('<I',out,4,124)
    struct.pack_into('<I',out,8,0x81007)
    struct.pack_into('<III',out,12,h,w,len(pixels))
    struct.pack_into('<I',out,76,32)
    struct.pack_into('<I',out,80,4)
    out[84:88]=b'DX10' if fmt==25 else b'DXT5'
    struct.pack_into('<I',out,108,0x1000)
    if fmt==25:
        struct.pack_into('<IIIII',out,128,98,3,0,1,0)
    return bytes(out)+pixels

def main():
    a=argparse.ArgumentParser()
    a.add_argument('--bundle',required=True,type=Path)
    a.add_argument('--activity',required=True,type=Path)
    a.add_argument('--output',required=True,type=Path)
    a.add_argument('--extract',action='store_true')
    args=a.parse_args()
    raw=args.bundle.read_bytes()
    if len(raw)>512*1024*1024:
        raise ValueError('Bundle exceeds 512 MiB limit')
    database=args.activity.read_bytes()
    revision,nodes=bundle_nodes(raw)
    cab=[(k,v) for k,v in nodes.items() if not k.endswith('.resS')]
    ress=[v for k,v in nodes.items() if k.endswith('.resS')]
    if len(cab)!=1 or len(ress)!=1:
        raise ValueError('Expected one CAB and one resS node')
    cabname,cabbytes=cab[0]
    objects=unity_objects(cabbytes)
    mapping=activity_icons(database)
    candidate=[]
    image_data={}
    for guid,targets in sorted(links(objects).items()):
        if guid not in mapping:
            continue
        if len(targets[28])!=1 or len(targets[213])!=1:
            raise ValueError('Ambiguous icon GUID: '+guid)
        texture_id=next(iter(targets[28]))
        sprite_id=next(iter(targets[213]))
        texture_obj=objects[texture_id]
        sprite_obj=objects[sprite_id]
        if texture_obj['name']!=sprite_obj['name']:
            raise ValueError('GUID Sprite and Texture mismatch: '+guid)
        w,h,fmt,pixels=texture(texture_obj,ress[0])
        name_length=rd(sprite_obj['data'],0,'<I')
        p=align(4+name_length,4)
        rect=struct.unpack_from('<ffff',sprite_obj['data'],p)
        if rect!=(0.0,0.0,float(w),float(h)):
            raise ValueError('Sub-rectangle sprite requires separate extraction: '+guid)
        if sprite_obj['data'].find(struct.pack('<Q',texture_id))<0:
            raise ValueError('Sprite has no expected texture reference: '+guid)
        image_data[guid]=(w,h,fmt,pixels)
        for itemid,internal_name in mapping[guid]:
            candidate.append({'itemId':itemid,'internalName':internal_name,'guid':guid,
                'spriteName':sprite_obj['name'],'spritePathId':str(sprite_id),
                'texturePathId':str(texture_id),'textureFormat':'BC7' if fmt==25 else 'DXT5',
                'width':w,'height':h})
    candidate.sort(key=lambda x:int(x['itemId']))
    if len({x['itemId'] for x in candidate})!=len(candidate):
        raise ValueError('Duplicate ItemID mapping')
    summary={'itemIds':len(candidate),
        'spriteAssets':len(image_data),
        'totalTexture2D':sum(x['classId']==28 for x in objects.values()),
        'totalSprite':sum(x['classId']==213 for x in objects.values())}
    source={'platform':'Steam/Windows','gameVersion':'1.25.3','unity':revision,
        'bundleSHA256':sha(raw),'activityItemSHA256':sha(database),
        'evidenceLevel':'STATIC_ASSET_REFERENCE','writeAuthorized':False}
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'icon-audit.json').write_text(json.dumps({
        'source':source,'summary':summary,'candidates':candidate},indent=2)+'\n',encoding='utf-8')
    if args.extract:
        if not shutil.which('magick'):
            raise ValueError('ImageMagick magick executable required')
        image_dir=args.output/'items'
        image_dir.mkdir(exist_ok=True)
        plan={'source':{'platform':'Steam/Windows','gameVersion':'1.25.3'},'icons':[]}
        with tempfile.TemporaryDirectory() as temp:
            for row in candidate:
                dest=image_dir/(row['itemId']+'.png')
                if dest.exists():
                    raise ValueError('Refusing to overwrite existing PNG: '+str(dest))
                w,h,fmt,pixels=image_data[row['guid']]
                dds_path=Path(temp)/(row['itemId']+'.dds')
                dds_path.write_bytes(dds(w,h,fmt,pixels))
                subprocess.run(['magick',str(dds_path),str(dest)],check=True)
                plan['icons'].append({'itemId':row['itemId'],'pngPath':'items/'+dest.name,
                    'sourceAsset':cabname+' | guid:'+row['guid']+
                        ' | SpritePathID:'+row['spritePathId']+
                        ' | TexturePathID:'+row['texturePathId'],
                    'itemIdEvidence':'ActivityItem SHA256:'+sha(database)+
                        ' field4 GUID:'+row['guid'],
                    'sourceSha256':sha(dest.read_bytes())})
        (args.output/'icon-import-plan.json').write_text(
            json.dumps(plan,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary))

if __name__=='__main__':
    main()
