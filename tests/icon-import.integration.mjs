import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const exec=promisify(execFile);
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function crc32(buffer){
 let c=0xffffffff;
 for(const v of buffer){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
 return (c^0xffffffff)>>>0;
}
function chunk(kind,body){
 const type=Buffer.from(kind),n=Buffer.alloc(4),crc=Buffer.alloc(4);
 n.writeUInt32BE(body.length);crc.writeUInt32BE(crc32(Buffer.concat([type,body])));
 return Buffer.concat([n,type,body,crc]);
}
function samplePng(){
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(2,4);ihdr[8]=8;ihdr[9]=6;
 const pixels=Buffer.from([0,245,100,10,0,20,30,40,255,0,35,45,55,120,200,110,90,255]);
 return Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),
  chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))
 ]);
}
test('offline importer preserves visible and fully transparent RGBA and verifies published bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'timekeeper-integration-'));
 try{
  const input=join(dir,'input'),output=join(dir,'site');
  await mkdir(join(input,'items'),{recursive:true});
  const png=samplePng(),id='31300003';
  await writeFile(join(input,'items',id+'.png'),png);
  const plan={source:{platform:'Steam/Windows',gameVersion:'1.25.3'},icons:[{
   itemId:id,pngPath:'items/'+id+'.png',sourceAsset:'TEST_SYNTHETIC_ONLY',
   itemIdEvidence:'TEST_SYNTHETIC_MAPPING',sourceSha256:sha(png)
  }]};
  const planPath=join(input,'plan.json');await writeFile(planPath,JSON.stringify(plan));
  const importer=join(root,'scripts','import-steam-icons.mjs');
  const verifier=join(root,'scripts','verify-icon-assets.mjs');
  await exec(process.execPath,[importer,planPath,output],{maxBuffer:8*1024*1024});
  for(const file of ['steam-ui-icons-v1253.json','app-ui-icons.json','steam-ui-candidates-v1253.json','steam-ui-private-pixel-evidence-v1253.json'])
   await copyFile(join(root,'data',file),join(output,'data',file));
  const manifest=JSON.parse(await readFile(join(output,'data','steam-icons-v1253.json'),'utf8'));
  assert.equal(manifest.icons[id].sourceSha256,sha(png));
  assert.equal(manifest.icons[id].verified,true);
  assert.equal(manifest.icons[id].itemIdEvidence,'TEST_SYNTHETIC_MAPPING');
  for(const name of ['steam-ui-icons-v1253.json','app-ui-icons.json']){
   const published=JSON.parse(await readFile(join(output,'data',name),'utf8'));
   for(const entry of Object.values(published.icons)){
    const destination=join(output,entry.path);
    await mkdir(dirname(destination),{recursive:true});
    await copyFile(join(root,entry.path),destination);
   }
  }
  await exec(process.execPath,[verifier,output]);
  await assert.rejects(exec(process.execPath,[importer,planPath,output]),/already published/);
  const saved=await readFile(join(output,'assets','steam','v1253',id+'.webp'));
  saved[25]^=0x01;
  await writeFile(join(output,'assets','steam','v1253',id+'.webp'),saved);
  await assert.rejects(exec(process.execPath,[verifier,output]),/mismatch/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
