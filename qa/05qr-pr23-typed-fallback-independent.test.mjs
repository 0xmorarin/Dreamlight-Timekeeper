// 05 QR PR23 delta: all 244 typed source mapping and safe text-only UI contract.
// Synthetic data only; private source bytes and rights separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveRcItemTextRow,resolveItemImageView,RC_ITEM_TEXT_CONTRACT}
 from '../src/item-image-coverage.mjs';
const get=async f=>JSON.parse(await readFile(new URL('../data/'+f,import.meta.url)));
const audit=await get('item-image-coverage-v1253.json');
const manifest=await get('steam-icons-v1253.json');
const expected={'ActivityItem.json':['ACTIVITY_ITEM',173],
 'Furniture.json':['FURNITURE_SOURCE',52],
 'Companion.json':['COMPANION',19]};
test('QR ASSET23: all 244 exact ItemIDs have original item source witness and text fallback without URLs',()=>{
 assert.equal(audit.items.length,244);
 const tally={};
 for(const row of audit.items){
  const s=row.itemSourceType;
  assert.equal(s.status,'ORIGINAL_V1253_ITEMDB_FIELD1_VERIFIED');
  assert.equal(s.itemIdField,1);
  assert.equal(s.itemSourceCategoryOnly,true);
  assert.equal(s.notRuntimeGameCategory,true);
  assert.equal(s.notImageProof,true);
  assert(expected[s.sourceStream]);
  tally[s.sourceStream]=(tally[s.sourceStream]||0)+1;
  const en=resolveRcItemTextRow(manifest,{id:row.itemId},{locale:'en',coverageAudit:audit});
  const ja=resolveRcItemTextRow(manifest,{id:row.itemId},{locale:'ja',coverageAudit:audit});
  assert.equal(en.contract,RC_ITEM_TEXT_CONTRACT);
  assert.equal(en.category.code,expected[s.sourceStream][0]);
  assert.equal(en.category.verified,true);
  assert.equal(ja.category.verified,true);
  for(const v of [en,ja]){
   assert.equal(v.itemId,row.itemId);
   assert.equal(v.idLabel,'ItemID '+row.itemId);
   assert.equal(v.image.url,null);
   assert.equal(v.image.loading,'lazy');
   assert.equal(v.textFallback.visibleByDefault,true);
   assert.equal(v.textFallback.onImageErrorMustShow,true);
   assert.equal(v.textFallback.renderAsPlainText,true);
   assert.equal(v.evidence.privatePixelDoesNotGrantImage,true);
   assert.equal(v.evidence.worldObjectPrefabDoesNotGrantImage,true);
   assert.equal(v.fullItemImageReleaseAccepted,false);
   assert.equal(v.evidence.mediaRedistributionPermission,'NOT_ESTABLISHED');
   assert(v.textFallback.ariaLabel.includes('ItemID '+row.itemId));
  }
 }
 assert.deepEqual(tally,Object.fromEntries(Object.entries(expected).map(([k,[,count]])=>[k,count])));
 assert.equal(Object.keys(manifest.icons).length,0);
});
test('QR ASSET23: dynamic/unknown ItemIDs, misleading name strings and fake EventID are NOT classified',()=>{
 for(const item of [
  {id:99912348,name:'<img src=x onerror=alert(1)>NAME'},
  {id:2010000021,name:'EventID cannot be ItemID'},
  {id:null,name:'Unknown'},
  {id:99912349,en:'\u202eDanger\u202c\u200b',ja:'<b>fake</b>表示'}
 ]){
  const r=resolveRcItemTextRow(manifest,item,{locale:'ja',coverageAudit:audit});
  assert.equal(r.category.code,'UNCLASSIFIED');
  assert.equal(r.category.verified,false);
  assert.equal(r.image.url,null);
  assert.equal(r.textFallback.visibleByDefault,true);
  assert.equal(r.textFallback.renderAsPlainText,true);
  assert(!/<[^>]*>/.test(r.name));
  assert(!/[\u202a-\u202e\u2066-\u2069]/.test(r.name));
 }
});
test('QR ASSET23: tampered baseline header and unknown type hash fail typed evidence promotion',()=>{
 const original=audit.items.find(r=>r.itemSourceType?.sourceStream==='Furniture.json');
 assert(original);
 const bad=structuredClone(audit);
 bad.source.eventRawSHA256='0'.repeat(64);
 let r=resolveRcItemTextRow(manifest,{id:original.itemId},{coverageAudit:bad});
 assert.equal(r.category.verified,false);
 const fake=structuredClone(audit);
 fake.items.find(z=>z.itemId===original.itemId).itemSourceType.sourceSha256='f'.repeat(64);
 r=resolveRcItemTextRow(manifest,{id:original.itemId},{coverageAudit:fake});
 assert.equal(r.category.verified,false);
 assert.equal(r.image.url,null);
});
test('QR ASSET23: source type metadata and fallback cannot independently prove image pixels/public rights',()=>{
 assert.equal(audit.readOnlyResolutionContract.verifiedPublished,0);
 assert.equal(audit.readOnlyResolutionContract.ambiguousWithoutUrl,81);
 assert.equal(audit.readOnlyResolutionContract.missingWithoutUrl,163);
 assert.equal(audit.policy.allowGameImagePublication,false);
 assert.equal(audit.policy.permissionState,'NOT_ESTABLISHED');
 assert.equal(audit.scope.additionalRealSaveItemIDs,'UNKNOWN_NOT_ENUMERATED_ON_THIS_STATIC_BASELINE');
 for(const row of audit.items){
  const r=resolveItemImageView(manifest,{id:row.itemId},{coverageAudit:audit});
  assert.equal(r.url,null);
  assert(['AMBIGUOUS','MISSING'].includes(r.status));
 }
});
