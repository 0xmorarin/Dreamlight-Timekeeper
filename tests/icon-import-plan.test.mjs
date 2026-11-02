import test from 'node:test';
import assert from 'node:assert/strict';
import {checkIconImportPlan,readPngRgbaHeader} from '../src/icon-import-plan.mjs';
const hash='b'.repeat(64);
const candidate={itemId:'31300003',pngPath:'items/31300003.png',sourceAsset:'asset-guid-synthetic',itemIdEvidence:'synthetic mapping evidence',sourceSha256:hash};
const one=(overrides={})=>({source:{platform:'Steam/Windows',gameVersion:'1.25.3'},icons:[{...candidate,...overrides}]});
test('source audit plan accepts only explicit Steam item mapping evidence',()=>{
 assert.equal(checkIconImportPlan(one()),true);
 for(const bad of [{itemId:'1.0'},{itemId:'01'},{pngPath:'../secret.png'},{pngPath:'/secret.png'},
  {pngPath:'c:/secret.png'},{pngPath:'items/fake.webp'},{sourceAsset:''},{itemIdEvidence:''},
  {sourceSha256:'unknown'}])assert.throws(()=>checkIconImportPlan(one(bad)));
});
test('source audit rejects duplicate item ids and source images',()=>{
 const p=one();p.icons.push({...candidate,itemId:'31300004'});
 assert.throws(()=>checkIconImportPlan(p));
});
test('PNG input checker refuses non-RGBA/non-8-bit and oversized textures',()=>{
 const b=new Uint8Array(33),v=new DataView(b.buffer);
 b.set([137,80,78,71,13,10,26,10]);v.setUint32(8,13,false);
 b.set([73,72,68,82],12);v.setUint32(16,128,false);v.setUint32(20,128,false);
 b[24]=8;b[25]=6;b[28]=0;
 assert.deepEqual(readPngRgbaHeader(b),{width:128,height:128});
 b[25]=2;assert.throws(()=>readPngRgbaHeader(b),/RGBA/);
 b[25]=6;v.setUint32(16,16384,false);assert.throws(()=>readPngRgbaHeader(b),/1024/);
});
