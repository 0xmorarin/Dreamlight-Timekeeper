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
