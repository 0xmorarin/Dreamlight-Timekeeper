import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {
 BASELINE,ITEM_IMAGE_CONTRACT,recurringImageTargets,snapshotVisibleItemIds,
 auditItemImageCoverage,resolveItemImageView
} from '../src/item-image-coverage.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const registry=await json('data/events-v1253.json');
const empty=await json('data/steam-icons-v1253.json');

test('authoritative v1.25.3 508 events link 244 distinct ItemIDs, never EventID',()=>{
 const result=recurringImageTargets(registry,{strictBaseline:true});
 assert.equal(result.eventDefinitionCount,BASELINE.eventDefinitionCount);
 assert.equal(result.itemIdCount,BASELINE.recurringItemIdCount);
 assert.equal(result.invalidReferences.length,0);
 assert.equal(result.items.length,244);
 const allEvents=new Set(registry.events.map(x=>x.id));
 assert.equal(result.items.filter(x=>allEvents.has(x.itemId)).length,0);
 assert.ok(result.items.every(x=>x.eventIds.length>=1&&x.references>=1));
 assert.equal(new Set(result.items.map(x=>x.itemId)).size,244);
 const thorn=result.items.find(x=>x.itemId===31300003);
 assert.ok(thorn.eventIds.includes(2010000003));
 assert.ok(thorn.eventIds.length>1);
});

test('current publicly packaged item art remains ZERO; all 244 missing, not silently mapped',()=>{
 const summary=auditItemImageCoverage(registry,empty);
 assert.equal(summary.contract,ITEM_IMAGE_CONTRACT);
 assert.deepEqual(summary.scope,{
  recurringItemIdCount:244,dynamicVisibleItemIdCount:0,
  dynamicScopeObserved:false,distinctDisplayedItemIdCount:244,snapshotRows:null});
 assert.deepEqual(summary.totals,{
  verifiedPublished:0,missingPublished:244,pathCollisions:0,invalidRecurringReferences:0});
 assert.ok(summary.entries.every(x=>x.state==='MISSING_PUBLISHED_IMAGE'&&
  x.path===null&&x.origin==='RECURRING_EVENT_DEFINITION'));
});

test('save-derived Grid/Store displayed ItemIDs add dynamic targets without confusing EventID',()=>{
 const snapshot={rows:[
  {source:'World.RecurringEvents',kind:'RecurringEvent',id:2010000003,
   items:[{id:31300003}]},
  {source:'World.GridCollection',kind:'Object.Growth',id:99912347,items:[]},
  {source:'World.Stores',kind:'StoreInfo.LastRefresh',id:99912348,items:[]},
  {source:'World.GridCollection',id:31300003,items:[{id:31300003}]}
 ]};
 assert.deepEqual(snapshotVisibleItemIds(snapshot).ids,[31300003,99912347,99912348]);
 const report=auditItemImageCoverage(registry,empty,{snapshot});
 assert.deepEqual(report.dynamicAdditionalItemIds,[99912347,99912348]);
 assert.equal(report.scope.distinctDisplayedItemIdCount,246);
 assert.equal(report.totals.missingPublished,246);
 assert.ok(!report.entries.some(x=>x.itemId===2010000003));
 assert.ok(!JSON.stringify(report).includes('OriginalSave')&&
   !JSON.stringify(report).includes('RecurringEvents/'));
});

test('read-only SvelteKit image contract uses exact ItemID, alt and text fallback',()=>{
 const absent=resolveItemImageView(empty,{id:31300003,en:'Small Night Thorn',ja:'小さな闇のトゲ'});
 assert.equal(absent.status,'MISSING');assert.equal(absent.url,null);
 assert.deepEqual(absent.alt,{en:'Small Night Thorn',ja:'小さな闇のトゲ'});
 assert.equal(absent.lazy,true);
 const verified={source:{platform:'Steam/Windows',gameVersion:'1.25.3',status:'VERIFIED_STEAM_ASSETS'},
  icons:{'31300003':{
   platform:'Steam',gameVersion:'1.25.3',verified:true,
   path:'assets/steam/v1253/31300003.webp',
   sha256:'a'.repeat(64),sourceSha256:'b'.repeat(64),
   sourceAsset:'CAB|GUID|Sprite|Texture',itemIdEvidence:'ActivityItem field1+4',
   width:128,height:128}}};
 const good=resolveItemImageView(verified,{id:31300003,en:'Small Night Thorn'},{basePath:'./'});
 assert.equal(good.status,'VERIFIED');
 assert.equal(good.url,'./assets/steam/v1253/31300003.webp');
 assert.equal(good.fallback,'text');
 assert.deepEqual([good.width,good.height],[128,128]);
 const report=auditItemImageCoverage(registry,verified);
 assert.equal(report.totals.verifiedPublished,1);
 assert.equal(report.totals.missingPublished,243);
 assert.throws(()=>resolveItemImageView(verified,{id:31300003},{basePath:'../'}),/Invalid static/);
});

test('reject forged event source, duplicate event IDs, forged image provenance and output conflicts',()=>{
 const other=structuredClone(registry);other.source.rawEventSHA256='0'.repeat(64);
 assert.throws(()=>recurringImageTargets(other),/Untrusted event/);
 const dup=structuredClone(registry);dup.events[1].id=dup.events[0].id;
 assert.throws(()=>recurringImageTargets(dup),/Duplicate/);
 const drift=structuredClone(registry);drift.events.pop();
 assert.throws(()=>recurringImageTargets(drift,{strictBaseline:true}),/baseline drift/);
 const forged={source:{platform:'Steam/Windows',gameVersion:'1.25.3',status:'VERIFIED_STEAM_ASSETS'},
  icons:{'31300003':{verified:true,path:'assets/steam/v1253/31300003.webp'}}};
 assert.throws(()=>auditItemImageCoverage(registry,forged),/provenance/);
 const invalid=structuredClone(registry);invalid.events[0].items.push({id:0});
 assert.throws(()=>recurringImageTargets(invalid,{strictBaseline:true}),/baseline drift/);
 assert.throws(()=>snapshotVisibleItemIds({rows:{}}),/rows array/);
});


test('original framed three-stream ItemID IconAddress census closes 106 typed provenance gaps, not image proof',async()=>{
 const pinned=await json('data/item-image-coverage-v1253.json');
 const gaps=pinned.items.filter(x=>x.sourceCrosswalk==='NO_STATIC_LINK_IN_SEVEN_CATEGORY_SOURCES');
 const census=new Map(),guids=new Map();
 const privatelyVerified=new Set([30000072,31400000,31400039,31300003,31300083,31300128,31300210]);
 for(const row of gaps){
   const evidence=row.definitionAudit,proven=privatelyVerified.has(row.itemId);
   assert.equal(evidence?.spriteResolved,proven);
   assert.equal(evidence?.textureResolved,proven);
   assert.equal(evidence?.webpDecodedRgbaMatched,proven);
   assert.equal(!!evidence?.privatePixelProof,proven);
   if(proven){
     assert.equal(evidence.privatePixelProof.status,'PRIVATE_SOURCE_VP8L_RGBA_EQUAL_NOT_RELEASED');
     assert.match(evidence.privatePixelProof.decodedRgbaSha256,/^[0-9a-f]{64}$/);
     assert.match(evidence.privatePixelProof.prototypeWebpSha256,/^[0-9a-f]{64}$/);
     assert.ok(evidence.privatePixelProof.prototypeWebpBytes>0);
   }
   assert.equal(row.publishedImage,'MISSING');
   assert.equal(row.spritePathId,null);assert.equal(row.texturePathId,null);
   assert.match(evidence.declaredIconAddressGuid,/^[0-9a-f]{32}$/);
   assert.match(evidence.sourceSha256,/^[0-9a-f]{64}$/);
   census.set(evidence.sourceStream,(census.get(evidence.sourceStream)||0)+1);
   guids.set(evidence.declaredIconAddressGuid,(guids.get(evidence.declaredIconAddressGuid)||0)+1);
 }
 assert.equal(gaps.length,106);
 assert.deepEqual(Object.fromEntries(census),{
  'ActivityItem.json':35,'Furniture.json':52,'Companion.json':19
 });
 assert.equal(guids.size,25);
 assert.equal(guids.get('04495f960b1edba4181ec51efa5e07d9'),81);
 assert.equal(gaps.find(x=>x.itemId===120200013).definitionAudit.declaredIconAddressGuid,
  gaps.find(x=>x.itemId===120200016).definitionAudit.declaredIconAddressGuid);
 assert.equal(pinned.unresolvedDefinitionAudit.spriteTextureProof,7);
 assert.equal(pinned.unresolvedDefinitionAudit.remainingUnverifiedSpriteTexture,99);
 assert.equal(pinned.unresolvedDefinitionAudit.publicImageProof,0);
 assert.equal(pinned.summary.publishedVerifiedItemImages,0);
 assert.equal(pinned.summary.publishedMissingRecurringItemIDs,244);
});


test('strict ItemID read-only resolution leaves all 244 unshipped with 83 AMBIGUOUS URL-denied candidates',async()=>{
 const pinned=await json('data/item-image-coverage-v1253.json');
 const stats=new Map();
 for(const entry of pinned.items){
  const view=resolveItemImageView(empty,{id:entry.itemId,en:entry.enNames[0]??''},{coverageAudit:pinned});
  assert.equal(view.status,entry.readOnlyImageResolution.status);
  assert.equal(view.url,null);
  stats.set(view.status,(stats.get(view.status)||0)+1);
  assert.equal(entry.publishedImage,'MISSING');
 }
 assert.deepEqual(Object.fromEntries(stats),{MISSING:161,AMBIGUOUS:83});
 for(const id of [31300004,31300005,120200013,120200016]){
  assert.equal(resolveItemImageView(empty,{id},{coverageAudit:pinned}).status,'AMBIGUOUS');
 }
 for(const id of [31300003,31300083,31300128,31300210]){
  const x=pinned.items.find(r=>r.itemId===id);
  assert.equal(x.definitionAudit.privatePixelProof.status,'PRIVATE_SOURCE_VP8L_RGBA_EQUAL_NOT_RELEASED');
  assert.equal(resolveItemImageView(empty,{id},{coverageAudit:pinned}).status,'MISSING');
 }
 assert.equal(resolveItemImageView(empty,{id:99999999},{coverageAudit:pinned}).status,'MISSING');
 const bogus=structuredClone(pinned);
 bogus.source.eventRawSHA256='f'.repeat(64);
 assert.equal(resolveItemImageView(empty,{id:31300004},{coverageAudit:bogus}).status,'MISSING');
 assert.equal(pinned.readOnlyResolutionContract.unapprovedMediaPublishable,false);
 assert.equal(pinned.scope.additionalRealSaveItemIDs,'UNKNOWN_NOT_ENUMERATED_ON_THIS_STATIC_BASELINE');
});
