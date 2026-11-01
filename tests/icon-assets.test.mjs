import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateIconManifest,resolveIconAsset,inspectLosslessWebP} from '../src/icon-assets.mjs';

const manifest = JSON.parse(await readFile(new URL('../data/steam-icons-v1253.json',import.meta.url),'utf8'));
const hash = 'a'.repeat(64);
const record = {platform:'Steam',gameVersion:'1.25.3',verified:true,
 path:'assets/steam/v1253/31300003.webp',sha256:hash,sourceSha256:'b'.repeat(64),
 sourceAsset:'Steam AssetBundle ItemIcon/31300003',width:1,height:1};
function oneIcon(overrides={}) {
 return {source:{platform:'Steam/Windows',gameVersion:'1.25.3',status:'VERIFIED_STEAM_ASSETS'},
 icons:{31300003:{...record,...overrides}}};
}
test('empty manifest never exposes unverified image assets',()=>{
 assert.equal(validateIconManifest(manifest),true);
 assert.equal(resolveIconAsset(manifest,31300003),null);
});
test('verified Steam lossless icon resolves by exact item ID',()=>{
 const m=oneIcon();assert.equal(validateIconManifest(m),true);
 assert.equal(resolveIconAsset(m,31300003)?.path,record.path);
 assert.equal(resolveIconAsset(m,31300004),null);
});
test('Switch-derived, lossy, path traversal or missing provenance images are rejected',()=>{
 for (const change of [
  {platform:'Switch'},{gameVersion:'1.25.0'},{path:'assets/steam/v1253/31300003.png'},
  {path:'assets/steam/v1253/../leak.webp'},{sourceSha256:undefined},
  {sourceAsset:''},{verified:false},{sha256:'bad'}
 ]) assert.throws(()=>validateIconManifest(oneIcon(change)));
 assert.equal(resolveIconAsset(oneIcon({platform:'Switch'}),31300003),null);
});
test('manifest refuses inconsistent status and duplicate output paths',()=>{
 const status=oneIcon();status.source.status='NO_STEAM_ASSET_BYTES_VERIFIED';
 assert.throws(()=>validateIconManifest(status));
 const duplicate=oneIcon();duplicate.icons['31300004']={...record};
 assert.throws(()=>validateIconManifest(duplicate));
});
test('VP8L structural checker rejects lossy VP8 and broken RIFF',()=>{
 // Minimal synthetic VP8L envelope tests header screening, not full decoding.
 const out=new Uint8Array(26),v=new DataView(out.buffer);
 out.set([...Buffer.from('RIFF')],0);v.setUint32(4,18,true);
 out.set([...Buffer.from('WEBPVP8L')],8);v.setUint32(16,5,true);out[20]=0x2f;
 assert.deepEqual(inspectLosslessWebP(out),{width:1,height:1});
 out.set([...Buffer.from('VP8 ')],12);
 assert.throws(()=>inspectLosslessWebP(out),/lossless VP8L/);
 out.set([...Buffer.from('VP8L')],12);v.setUint32(4,17,true);
 assert.throws(()=>inspectLosslessWebP(out),/RIFF/);
});
