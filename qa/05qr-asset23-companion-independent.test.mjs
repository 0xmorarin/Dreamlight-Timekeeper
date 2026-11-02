// 05 QR independent ASSET23 18 new Companion metadata delta, NOT pixel re-decode.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const url=new URL('../data/item-image-coverage-v1253.json',import.meta.url);
const current=JSON.parse(await readFile(url,'utf8'));
const previous=JSON.parse(execFileSync('git',['show','b71b07d32cd895530811ccc4e2b64292210d98c6:data/item-image-coverage-v1253.json'],
 {encoding:'utf8',maxBuffer:12*1024*1024}));
const pub=JSON.parse(await readFile(new URL('../data/steam-icons-v1253.json',import.meta.url),'utf8'));
const proofMap=d=>new Map(d.items.filter(x=>x.definitionAudit?.privatePixelProof)
 .map(x=>[x.itemId,x.definitionAudit.privatePixelProof]));
const now=proofMap(current),before=proofMap(previous);
const expected=new Set([120200000,120200001,120200002,120200003,
 120200004,120200005,120200006,120200007,120200008,120200009,
 120200010,120200011,120200012,120200013,120200016,
 120200022,120200023,120200024]);
test('05QR ASSET frozen delta is exact new 18 Companion ItemIDs with old seven unchanged',()=>{
 assert.equal(before.size,7);
 assert.equal(now.size,25);
 for(const [k,v] of before)assert.deepEqual(now.get(k),v,'old proof unexpectedly changed '+k);
 const added=new Set([...now.keys()].filter(x=>!before.has(x)));
 assert.deepEqual([...added].sort((a,b)=>a-b),[...expected].sort((a,b)=>a-b));
 assert.equal(current.scope.recurringDistinctItemIDs,244);
 assert.equal(current.scope.recurringEventDefinitions,508);
});
test('05QR distinct Companion sources alias only 120200013/016 and complete metadata present',()=>{
 const companion=current.items.filter(r=>expected.has(r.itemId));
 assert.equal(companion.length,18);
 const bundle='craftingmaterial_a01be543.bundle';
 const sha=/^[0-9a-f]{64}$/;
 let total=0;
 for(const row of companion){
  const a=row.definitionAudit,b=a.privatePixelProof;
  assert.equal(a.sourceStream,'Companion.json');
  assert.equal(a.status,'DECLARED_ICON_ADDRESS_RESOLVED_PRIVATE_SOURCE');
  assert.equal(b.sourceBundle,bundle);
  assert.equal(b.bundleSha256,'85255ade497a5fcf9945d569624286d518c7d07d874f32b84ad612173436137c');
  assert.equal(b.unityCab,'CAB-dc96f4e2a160bea829b0dccdd5e870ad');
  assert.equal(b.status,'PRIVATE_SOURCE_VP8L_RGBA_EQUAL_NOT_RELEASED');
  assert.equal(b.width,256);assert.equal(b.height,256);
  assert.equal(b.compression,'BC7');
  assert(sha.test(b.decodedRgbaSha256)&&sha.test(b.prototypeWebpSha256));
  assert(/^[1-9][0-9]*$/.test(b.spritePathId));
  assert(/^[1-9][0-9]*$/.test(b.texturePathId));
  assert.equal(row.publishedImage,'MISSING');
  assert(!row.url&&!b.publicUrl);
  total+=b.prototypeWebpBytes;
 }
 const keyed=new Map();
 for(const r of companion){
  const a=r.definitionAudit.privatePixelProof;
  const identity=[a.spritePathId,a.texturePathId,a.decodedRgbaSha256,a.prototypeWebpSha256].join('/');
  keyed.set(identity,[...(keyed.get(identity)||[]),r.itemId]);
 }
 assert.equal(keyed.size,17);
 const shared=[...keyed.values()].filter(ids=>ids.length>1);
 assert.deepEqual(shared,[[120200013,120200016]]);
 assert.equal(total,617802);
 assert.equal(current.unresolvedDefinitionAudit.privateCompanionWebpBytes,total);
 assert.equal(current.unresolvedDefinitionAudit.privateCompanionPixelRecords,18);
 assert.equal(current.unresolvedDefinitionAudit.privatePixelEvidenceJsonSha256,
  previous.unresolvedDefinitionAudit.privatePixelEvidenceJsonSha256);
});
test('05QR no item media release even after source metadata evidence',()=>{
 assert.equal(current.policy.allowGameImagePublication,false);
 assert.equal(current.policy.permissionState,'NOT_ESTABLISHED');
 assert.equal(current.policy.privateSourcePixelsNotInRepository,true);
 assert.equal(current.summary.publishedVerifiedItemImages,0);
 assert.equal(current.readOnlyResolutionContract.verifiedPublished,0);
 assert.equal(current.readOnlyResolutionContract.ambiguousWithoutUrl,81);
 assert.equal(current.readOnlyResolutionContract.missingWithoutUrl,163);
 assert.equal(current.readOnlyResolutionContract.privatePixelProofsNotPublished,25);
 assert.equal(current.readOnlyResolutionContract.unverifiedSourceSpriteTargets,81);
 assert.equal(current.readOnlyResolutionContract.additionalRealSaveVisibleItemIDs,'UNKNOWN_SESSION_NOT_PROVIDED');
 assert.equal(current.scope.additionalRealSaveItemIDs,'UNKNOWN_NOT_ENUMERATED_ON_THIS_STATIC_BASELINE');
 assert.equal(Object.keys(pub.icons).length,0);
 assert(current.items.every(row=>row.publishedImage==='MISSING'));
});
