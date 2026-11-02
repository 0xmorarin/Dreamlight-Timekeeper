import argparse
import hashlib
import json
import re
import struct
import subprocess
from bisect import bisect_right
from pathlib import Path
from tempfile import TemporaryDirectory

import lz4.block

def sha(data):
    return hashlib.sha256(data).hexdigest()

def align(value,amount=4):
    return (value+amount-1)//amount*amount

def get_cstring(buffer,position):
    end=buffer.index(0,position)
    return buffer[position:end].decode('utf-8'),end+1

def analyze_bundle(data):
    p=0
    signature,p=get_cstring(data,p)
    version=struct.unpack_from('>I',data,p)[0]
    p+=4
    _,p=get_cstring(data,p)
    unity,p=get_cstring(data,p)
    size,packed,unpacked,flags=struct.unpack_from('>QIII',data,p)
    p+=20
    if signature!='UnityFS' or version!=8 or size!=len(data) or not unity.startswith('6000.'):
        raise ValueError('Unsupported or truncated UnityFS bundle')
    if packed>2*1024*1024 or unpacked>8*1024*1024:
        raise ValueError('UnityFS metadata exceeds guard')
    meta_start=len(data)-packed if flags&128 else (align(p,16) if flags&512 else p)
    info=lz4.block.decompress(data[meta_start:meta_start+packed],uncompressed_size=unpacked)
    q=16
    block_count=struct.unpack_from('>I',info,q)[0]
    q+=4
    if block_count>10000:
        raise ValueError('Too many compressed blocks')
    blocks=[]
    for _ in range(block_count):
        unpack_size,pack_size,block_flags=struct.unpack_from('>IIH',info,q)
        q+=10
        blocks.append((unpack_size,pack_size,block_flags))
    node_count=struct.unpack_from('>I',info,q)[0]
    q+=4
    if node_count!=2:
        raise ValueError('Expected one CAB and one external texture data node')
    nodes=[]
    for _ in range(node_count):
        off,length,_=struct.unpack_from('>QQI',info,q)
        q+=20
        name,q=get_cstring(info,q)
        nodes.append((name,off,length))
    if not nodes[1][0].endswith('.resS') or nodes[0][2]>64*1024*1024:
        raise ValueError('Unexpected Unity asset stream layout')
    comp_start=(align(meta_start+packed,16) if flags&512 else meta_start+packed) if not flags&128 else (align(p,16) if flags&512 else p)
    packed_start=[]
    plain_start=[]
    cpos=comp_start
    upos=0
    for unpack_size,pack_size,block_flags in blocks:
        if block_flags&63 not in (2,3):
            raise ValueError('Unsupported compressed block type')
        packed_start.append(cpos)
        plain_start.append(upos)
        cpos+=pack_size
        upos+=unpack_size
    if upos<sum(node[2] for node in nodes) or cpos>len(data):
        raise ValueError('Bundle streams invalid')
    def extract(offset,length):
        if offset<0 or length<1 or offset+length>upos:
            raise ValueError('Stream slice outside UnityFS data')
        i=bisect_right(plain_start,offset)-1
        result=bytearray()
        while i<len(blocks) and plain_start[i]<offset+length:
            unpack_size,pack_size,_=blocks[i]
            decoded=lz4.block.decompress(data[packed_start[i]:packed_start[i]+pack_size],uncompressed_size=unpack_size)
            low=max(offset-plain_start[i],0)
            high=min(offset+length-plain_start[i],unpack_size)
            result.extend(decoded[low:high])
            i+=1
        if len(result)!=length:
            raise ValueError('Incomplete compressed stream slice')
        return bytes(result)
    cab=extract(nodes[0][1],nodes[0][2])
    return unity,nodes,cab,extract

def parse_objects(cab):
    data_offset=struct.unpack_from('>Q',cab,32)[0]
    if struct.unpack_from('>I',cab,8)[0]!=22:
        raise ValueError('Unsupported Unity serialization revision')
    p=48
    _,p=get_cstring(cab,p)
    platform=struct.unpack_from('<I',cab,p)[0]
    p+=4
    if cab[p]!=0 or platform!=19:
        raise ValueError('Unexpected platform or type tree')
    p+=1
    type_count=struct.unpack_from('<I',cab,p)[0]
    p+=4
    if type_count>1000:
        raise ValueError('Excessive type count')
    classes=[]
    for _ in range(type_count):
        class_id=struct.unpack_from('<i',cab,p)[0]
        p+=23
        if class_id==114 or class_id<0:
            p+=16
        classes.append(class_id)
    count=struct.unpack_from('<I',cab,p)[0]
    p=align(p+4)
    if count>100000:
        raise ValueError('Excessive object count')
    result={}
    histogram={}
    for _ in range(count):
        path_id,off,length,typ=struct.unpack_from('<QQII',cab,p)
        p+=24
        if typ>=len(classes) or data_offset+off+length>len(cab):
            raise ValueError('Invalid serialized object location')
        class_id=classes[typ]
        histogram[class_id]=histogram.get(class_id,0)+1
        if class_id not in (28,213):
            continue
        blob=cab[data_offset+off:data_offset+off+length]
        name_size=struct.unpack_from('<I',blob)[0]
        if name_size>512 or name_size+4>len(blob):
            raise ValueError('Invalid object name')
        name=blob[4:4+name_size].decode('utf-8')
        result[str(path_id)]=(class_id,name,blob)
    return result,histogram

def inspect_candidate(row,objects):
    name=row['spriteName']
    sid=row['spritePathId']
    tid=row['texturePathId']
    sprite=objects.get(sid)
    texture=objects.get(tid)
    if not sprite or not texture or sprite[0]!=213 or texture[0]!=28 or sprite[1]!=name or texture[1]!=name:
        raise ValueError('Candidate object identity mismatch: '+row['key'])
    sb=sprite[2]
    start=align(4+struct.unpack_from('<I',sb)[0])
    rect=struct.unpack_from('<ffff',sb,start)
    tb=texture[2]
    start=align(4+struct.unpack_from('<I',tb)[0])
    width,height=struct.unpack_from('<II',tb,start+4)
    fmt=struct.unpack_from('<I',tb,start+20)[0]
    if (width,height,fmt)!=(row['width'],row['height'],row['textureFormat']):
        raise ValueError('Candidate texture metadata drift: '+row['key'])
    if rect!=(0.0,0.0,float(width),float(height)) or struct.pack('<Q',int(tid)) not in sb:
        raise ValueError('Subrect or incorrect Sprite-to-Texture reference: '+row['key'])
    if fmt not in (10,12,25) or not 1<=width<=1024 or not 1<=height<=1024:
        raise ValueError('Unsupported texture format: '+row['key'])
    off=struct.unpack_from('<Q',tb,len(tb)-104)[0]
    stream_size=struct.unpack_from('<I',tb,len(tb)-96)[0]
    bytes_per_block=8 if fmt==10 else 16
    required=((width+3)//4)*((height+3)//4)*bytes_per_block
    if required>stream_size:
        raise ValueError('Invalid texture source size: '+row['key'])
    return off,required

def dds_image(row,pixels):
    width,height,fmt=row['width'],row['height'],row['textureFormat']
    header=bytearray(148 if fmt==25 else 128)
    header[:4]=b'DDS '
    struct.pack_into('<I',header,4,124)
    struct.pack_into('<I',header,8,0x81007)
    struct.pack_into('<III',header,12,height,width,len(pixels))
    struct.pack_into('<I',header,76,32)
    struct.pack_into('<I',header,80,4)
    header[84:88]=b'DX10' if fmt==25 else b'DXT1' if fmt==10 else b'DXT5'
    struct.pack_into('<I',header,108,0x1000)
    if fmt==25:
        struct.pack_into('<IIIII',header,128,98,3,0,1,0)
    return bytes(header)+pixels


def private_trial_candidate(catalog,key,output):
    if not isinstance(key,str) or not re.fullmatch(r'[a-z]+(?:[.-][a-z0-9]+)*',key):
        raise ValueError('Invalid private review semantic key')
    root=Path(__file__).resolve().parents[1]
    if output.resolve()==root or output.resolve().is_relative_to(root):
        raise ValueError('Private trial output must be outside the public repository')
    matches=[row for row in catalog['candidates'] if row['key']==key]
    if len(matches)!=1 or matches[0]['reviewState'] not in ('HOLD_DEPLOYMENT','HOLD_SEMANTIC_REVIEW'):
        raise ValueError('Private review requires one uniquely identified HOLD candidate')
    return matches[0]

def verify_private_rgba_parity(png,webp,width,height):
    from PIL import Image
    payload=webp.read_bytes()
    if (len(payload)<25 or payload[:4]!=b'RIFF' or payload[8:16]!=b'WEBPVP8L' or
        struct.unpack_from('<I',payload,4)[0]!=len(payload)-8 or payload[20]!=47):
        raise ValueError('Private candidate must be lossless VP8L WebP')
    bits=struct.unpack_from('<I',payload,21)[0]
    if (bits>>29)!=0 or ((bits&16383)+1,((bits>>14)&16383)+1)!=(width,height):
        raise ValueError('Private VP8L dimensions or version mismatch')
    original=Image.open(png).convert('RGBA')
    converted=Image.open(webp).convert('RGBA')
    if original.size!=(width,height) or converted.size!=(width,height) or original.tobytes()!=converted.tobytes():
        raise ValueError('Pillow source and WebP RGBA mismatch')
    def decode(path):
        return subprocess.run(['magick',str(path),'-alpha','on','-depth','8','RGBA:-'],
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True).stdout
    a=decode(png)
    b=decode(webp)
    if len(a)!=width*height*4 or a!=b or a!=original.tobytes():
        raise ValueError('Independent ImageMagick RGBA mismatch')
    return {'rgbaSha256':sha(a),'pngSha256':sha(png.read_bytes()),
            'trialWebpSha256':sha(payload),'width':width,'height':height}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--bundle',type=Path,required=True)
    parser.add_argument('--candidates',type=Path,default=Path(__file__).resolve().parents[1]/'data'/'steam-ui-candidates-v1253.json')
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--extract',action='store_true')
    parser.add_argument('--private-trial-key',help='Verify one HOLD candidate in an external private directory')
    args=parser.parse_args()
    if args.private_trial_key and args.extract:
        parser.error('--private-trial-key cannot be combined with --extract')
    data=args.bundle.read_bytes()
    candidates=json.loads(args.candidates.read_text('utf-8'))
    private_row=private_trial_candidate(candidates,args.private_trial_key,args.output) if args.private_trial_key else None
    if candidates['source']['platform']!='Steam/Windows' or candidates['source']['gameVersion']!='1.25.3' or candidates['source']['fullVersion']!='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22':
        raise ValueError('Source identity or Steam build mismatch')
    if candidates['source']['bundleSHA256']!=sha(data):
        raise ValueError('Original Steam atlas SHA-256 does not match expected source')
    unity,nodes,cab,extract=analyze_bundle(data)
    if candidates['source']['cabSHA256']!=sha(cab):
        raise ValueError('Unity CAB SHA-256 does not match expected source')
    objects,histogram=parse_objects(cab)
    if histogram.get(28)!=2330 or histogram.get(213)!=2428:
        raise ValueError('Unexpected atlas Sprite/Texture2D population')
    audits=[]
    exported={}
    private_trial=None
    seen=set()
    for row in candidates['candidates']:
        key=row['key']
        if key in seen or not re.fullmatch(r'[a-z]+(?:[.-][a-z0-9]+)*',key):
            raise ValueError('Duplicate or invalid UI semantic key')
        seen.add(key)
        off,length=inspect_candidate(row,objects)
        audits.append({**row,'sourceTextureOffset':off,'textureCompressedBytes':length})
        trial=private_row is not None and key==private_row['key']
        if not trial and (not args.extract or row['reviewState']!='STATIC_REFERENCE_VERIFIED'):
            continue
        from PIL import Image
        pixelbytes=extract(nodes[1][1]+off,length)
        with TemporaryDirectory() as directory:
            source=Path(directory)/'source.dds'
            png=Path(directory)/'source.png'
            source.write_bytes(dds_image(row,pixelbytes))
            subprocess.run(['magick',str(source),str(png)],check=True)
            input_rgba=Image.open(png).convert('RGBA')
            if input_rgba.size!=(row['width'],row['height']):
                raise ValueError('Decoded image changed dimensions: '+key)
            output_path=('private-steam-ui-review/'+key.replace('.','-')+'.webp') if trial else 'assets/steam/v1253/ui/'+key.replace('.','/')+'.webp'
            target=args.output/output_path
            if target.exists():
                raise ValueError('Refusing to overwrite icon file: '+str(target))
            target.parent.mkdir(parents=True,exist_ok=True)
            input_rgba.save(target,format='WEBP',lossless=True,method=6,exact=True)
            verify=Image.open(target).convert('RGBA')
            if verify.tobytes()!=input_rgba.tobytes() or target.read_bytes()[12:16]!=b'VP8L':
                raise ValueError('Lossless RGBA verification failed: '+key)
            if trial:
                parity=verify_private_rgba_parity(png,target,row['width'],row['height'])
                private_trial={
                    'kind':'PRIVATE_RESEARCH_TRIAL_NOT_DEPLOYMENT',
                    'candidateKey':key,'reviewState':row['reviewState'],'semanticUse':'UNVERIFIED',
                    'sourceBundleSha256':sha(data),'cabSha256':sha(cab),
                    'spriteName':row['spriteName'],'spritePathId':row['spritePathId'],
                    'texturePathId':row['texturePathId'],'textureFormat':row['textureFormat'],
                    'textureCompressedSha256':sha(pixelbytes),'trialRelativePath':output_path,
                    'rgbaDecoders':'PILLOW_AND_IMAGEMAGICK_EQUAL',
                    'outputWebpSha256':parity['trialWebpSha256'],
                    'decodedRgbaSha256':parity['rgbaSha256'],
                    'sourcePngSha256':parity['pngSha256'],'width':row['width'],'height':row['height'],
                    'releaseApproved':False,'publishedToManifest':False,'saveWriterEnabled':False
                }
                continue
            exported[key]={
                'kind':'game_ui','verified':True,'platform':'Steam','gameVersion':'1.25.3',
                'path':output_path,'sha256':sha(target.read_bytes()),'sourceSha256':sha(png.read_bytes()),
                'sourceAsset':nodes[0][0]+'|Sprite:'+row['spritePathId']+'|Texture:'+row['texturePathId'],
                'mappingEvidence':'Unity6 Sprite/Texture PPtr + full rectangle + source name:'+row['spriteName'],
                'spritePathId':row['spritePathId'],'texturePathId':row['texturePathId'],
                'width':row['width'],'height':row['height']
            }
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/'atlas-audit.json').write_text(json.dumps({
        'source':candidates['source'],'histogram':histogram,'candidates':audits},indent=2)+'\n')
    if private_trial is not None:
        report=args.output/'private-steam-ui-review'/'review-only-evidence.json'
        if report.exists():
            raise ValueError('Refusing to overwrite private candidate evidence: '+str(report))
        report.write_text(json.dumps(private_trial,indent=2)+'\n')
    if args.extract:
        manifest={
            'kind':'game_ui',
            'source':{
                'platform':'Steam/Windows','gameVersion':'1.25.3',
                'status':'VERIFIED_ASSETS' if exported else 'NO_ASSETS_VERIFIED',
                'sourceBundle':'ddv_Data/StreamingAssets/aa/win/'+candidates['source']['bundle'],
                'sourceBundleSha256':sha(data),'writerAuthorization':False
            },
            'icons':exported
        }
        target=args.output/'data'/'steam-ui-icons-v1253.json'
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'Texture2D':histogram[28],'Sprite':histogram[213],
        'sourceCandidates':len(audits),'pixelVerifiedExports':len(exported),
        'saveWriterEnabled':False,'privateTrial':args.private_trial_key,
        'privateTrialReleaseApproved':False}))

if __name__=='__main__':
    main()
