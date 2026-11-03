// Independent 05 QR: ASSET23 post-QA41 resolver hardening only, no private pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveRcItemTextRow,resolveItemImageView} from '../src/item-image-coverage.mjs';
const empty=JSON.parse(await readFile(new URL('../data/steam-icons-v1253.json',import.meta.url)));
const evidence=JSON.parse(await readFile(new URL('../data/item-image-coverage-v1253.json',import.meta.url)));
const icon=(id='31300004')=>({platform:'Steam',gameVersion:'1.25.3',verified:true,
 path:'assets/steam/v1253/'+id+'.webp',sha256:'a'.repeat(64),
 sourceSha256:'b'.repeat(64),sourceAsset:'CAB|Sprite|Texture',
 itemIdEvidence:'field1 ItemID + original IconAddress',width:128,height:128});
const verified=()=>({source:{platform:'Steam/Windows',gameVersion:'1.25.3',status:'VERIFIED_STEAM_ASSETS'},icons:{'31300004':icon()}});
const row={id:31300004,en:'Small Night Thorn',ja:'小さな闇のトゲ'};
test('QR23: valid synthetic manifest permits only relative local static artwork, never real release by itself',()=>{
 const v=resolveRcItemTextRow(verified(),row,{locale:'ja',basePath:'/Dreamlight-Timekeeper/',coverageAudit:evidence});
 assert.equal(v.image.status,'VERIFIED');
 assert.equal(v.image.url,'/Dreamlight-Timekeeper/assets/steam/v1253/31300004.webp');
 assert.equal(v.fullItemImageReleaseAccepted,false);
 assert.equal(v.evidence.mediaRedistributionPermission,'NOT_ESTABLISHED');
 assert.equal(v.category.verified,true);
 assert.equal(v.textFallback.onImageErrorMustShow,true);
});
test('QR23: one malformed OTHER icon invalidates whole manifest; valid entry cannot leak an URL',()=>{
 for(const mutate of [
  m=>m.icons['31300005']={...icon('31300004')}, // path collision with first entry
  m=>m.icons['31300005']={...icon('31300005'),width:0},
  m=>m.icons['31300005']={...icon('31300005'),sha256:'00'},
  m=>m.source.platform='Nintendo Switch'
 ]){
  const bad=verified();mutate(bad);
  const out=resolveItemImageView(bad,row,{coverageAudit:evidence});
  assert.equal(out.url,null);
  assert.equal(out.status,'AMBIGUOUS');
  const text=resolveRcItemTextRow(bad,row,{locale:'ja',coverageAudit:evidence});
  assert.equal(text.image.url,null);
  assert.equal(text.textFallback.visibleByDefault,true);
  assert.equal(text.textFallback.renderAsPlainText,true);
 }
});
test('QR23: remote URL roots, path traversal and JS scheme reject when image manifest valid',()=>{
 for(const base of [
  'https://evil.example/','//evil.example/','javascript:alert(1)/',
  '../','/x/../','/a?src=evil/','/\\evil/','/a/#fragment/'
 ]){
  assert.throws(()=>resolveItemImageView(verified(),row,{basePath:base}),/Invalid static image URL base/);
 }
 for(const base of ['./','/Dreamlight-Timekeeper/','']){
  const v=resolveItemImageView(verified(),row,{basePath:base});
  assert.equal(v.status,'VERIFIED');
  assert(v.url.startsWith(base));
 }
});
test('QR23: real static public baseline remains text-only, private pixels never approve game-media URL',()=>{
 assert.equal(evidence.readOnlyResolutionContract.verifiedPublished,0);
 assert.equal(evidence.policy.allowGameImagePublication,false);
 assert.equal(evidence.policy.permissionState,'NOT_ESTABLISHED');
 assert.equal(Object.keys(empty.icons).length,0);
 for(const id of [31300004,31300003,120200013,30400219]){
  const o=resolveRcItemTextRow(empty,{id},{locale:'ja',coverageAudit:evidence});
  assert.equal(o.image.url,null);
  assert.equal(o.textFallback.required,true);
  assert.equal(o.fullItemImageReleaseAccepted,false);
 }
});
