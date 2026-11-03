import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {
 BASELINE,ITEM_IMAGE_CONTRACT,recurringImageTargets,snapshotVisibleItemIds,
 auditItemImageCoverage,resolveItemImageView,resolveRcItemTextRow,RC_ITEM_TEXT_CONTRACT
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

test('all ItemIDs remain required even when never first in a multi-item recurring event',()=>{
 // Prevent WEB consumers from mistaking event.items[0] for the entire
 // ItemID-bearing row. This is a source census, not browser acceptance.
 const all=recurringImageTargets(registry,{strictBaseline:true});
 const firstItemIds=new Set(registry.events.filter(e=>e.items.length)
  .map(e=>e.items[0].id));
 const multiEvents=registry.events.filter(e=>e.items.length>1);
 const notFirst=all.items.filter(x=>!firstItemIds.has(x.itemId));
 assert.equal(registry.events.reduce((n,e)=>n+e.items.length,0),489);
 assert.equal(multiEvents.length,41);
 assert.equal(Math.max(...registry.events.map(e=>e.items.length)),4);
 assert.equal(firstItemIds.size,214);
 assert.equal(notFirst.length,30);
 assert.deepEqual(notFirst.slice(0,3).map(x=>x.itemId),[31300004,31300005,31300006]);
 assert.ok(multiEvents.some(e=>e.id===2010000003&&e.items.length===4));
 assert.equal(all.itemIdCount,244);
});

test('81 shared IconAddress rows prove only a generic Sprite/Texture, not item-specific 2D variants',async()=>{
 const audit=await json('data/item-image-coverage-v1253.json');
 const ambiguous=audit.items.filter(x=>x.readOnlyImageResolution?.status==='AMBIGUOUS');
 assert.equal(ambiguous.length,81);
 assert.equal(ambiguous.reduce((total,x)=>total+x.references,0),173);
 assert.deepEqual(Object.fromEntries(['ActivityItem.json','Furniture.json','Companion.json']
  .map(stream=>[stream,ambiguous.filter(x=>x.itemSourceType?.sourceStream===stream).length])),{
   'ActivityItem.json':28,'Furniture.json':52,'Companion.json':1
 });
 const placeholder='04495f960b1edba4181ec51efa5e07d9';
 for(const row of ambiguous){
  const source=row.definitionAudit;
  const catalog=source.catalogDependency;
  assert.equal(source.declaredIconAddressGuid,placeholder);
  assert.equal(source.status,'SHARED_ICON_ADDRESS_NOT_ITEM_SPECIFIC');
  assert.equal(catalog.primaryBundle,'usedplaceholders_assets_all.bundle');
  assert.equal(catalog.genericSourceSpritePathId,'13192077654445607906');
  assert.equal(catalog.genericSourceTexturePathId,'15528772250824494050');
  assert.equal(catalog.perItemSpritePathId,null);
  assert.equal(catalog.perItemTexturePathId,null);
  assert.equal(catalog.variantStatus,'UNKNOWN_NOT_RUNTIME_OR_ITEM_SPECIFIC');
  assert.equal(source.spriteResolved,false);
  assert.equal(source.textureResolved,false);
  assert.equal(source.webpDecodedRgbaMatched,false);
  assert.equal(source.worldObjectSource.catalogResourceType,'UnityEngine.GameObject');
  assert.equal(source.worldObjectSource.candidateRenderingStrategy,'UNKNOWN_RUNTIME');
  assert.equal(source.worldObjectSource.doesNotResolve2DThumbnail,true);
  assert.equal(row.spritePathId,null);
  assert.equal(row.texturePathId,null);
  assert.equal(row.publishedImage,'MISSING');
  assert.equal(row.readOnlyImageResolution.url,null);
  const view=resolveRcItemTextRow(empty,{id:row.itemId},{coverageAudit:audit});
  assert.equal(view.image.status,'AMBIGUOUS');
  assert.equal(view.image.url,null);
  assert.equal(view.textFallback.visibleByDefault,true);
 }
 assert.equal(Object.keys(empty.icons).length,0);
 assert.equal(audit.readOnlyResolutionContract.verifiedPublished,0);
 assert.equal(audit.readOnlyResolutionContract.ambiguousWithoutUrl,81);
 assert.equal(audit.readOnlyResolutionContract.missingWithoutUrl,163);
});

test('81 field5 GameObject catalog census is private-digest aggregate; only nine P0 per-item routes are public metadata',async()=>{
 const audit=await json('data/item-image-coverage-v1253.json');
 const rows=audit.items.filter(x=>x.readOnlyImageResolution?.status==='AMBIGUOUS');
 const source=audit.field5WorldObjectCatalogAudit;
 assert.equal(source.sourceItemCount,81);
 assert.equal(source.distinctField5Guids,81);
 assert.equal(source.gameObjectCatalogEntries,81);
 assert.equal(source.uniquePrimaryBundleCount,32);
 assert.equal(source.privateRouteMetadataRowCount,81);
 assert.equal(source.privateCanonical81RouteMetadataSha256,
  '6d6d397b527736ade58d472d4693563f9484fd61f4cfe1e912d525a48f3f7057');
 assert.equal(source.field5NativeUsageVerified,false);
 assert.equal(source.actualRuntimeVariantVerified,false);
 assert.equal(source.renderedThumbsMatched,0);
 assert.equal(source.publicImageUrlsGranted,0);
 assert.equal(source.rights,'NOT_ESTABLISHED');
 const explicit=rows.filter(x=>typeof x.definitionAudit.worldObjectSource.gameObjectGuid==='string');
 const summaryOnly=rows.filter(x=>!x.definitionAudit.worldObjectSource.gameObjectGuid);
 assert.equal(explicit.length,9);
 assert.equal(summaryOnly.length,72);
 assert.equal(new Set(explicit.map(x=>x.definitionAudit.worldObjectSource.gameObjectGuid)).size,9);
 assert.ok(summaryOnly.every(x=>x.definitionAudit.worldObjectSource.additionalSourcePathProof==='SOURCE_CENSUS_ONLY'));
 assert.ok(explicit.every(x=>x.unresolvedVariantPriority.tier==='P0'&&
  x.definitionAudit.worldObjectSource.additionalSourcePathProof==='EXACT_FIELD5_AND_CATALOG_DEPENDENCY'));
 assert.deepEqual(explicit.map(x=>x.itemId),[
  30400263,31300004,31300005,31300006,40600035,40600448,40600449,40600450,40600451
 ]);
 assert.equal(explicit.reduce((sum,x)=>sum+x.references,0),82);
 assert.deepEqual(audit.sharedPlaceholderPriority.counts,{P0:9,P1:12,P2:60});
 // A metadata digest, a GameObject address or a same-source category never
 // grants a rendered UI variant, a sprite pair, media rights or an image URL.
 assert.ok(explicit.every(x=>!x.spritePathId&&!x.texturePathId&&!x.readOnlyImageResolution.url));
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

test('RC thumbnails require whole-manifest provenance and local static URL roots',()=>{
 const accepted={source:{platform:'Steam/Windows',gameVersion:'1.25.3',status:'VERIFIED_STEAM_ASSETS'},
  icons:{'31300004':{platform:'Steam',gameVersion:'1.25.3',verified:true,
   path:'assets/steam/v1253/31300004.webp',sha256:'a'.repeat(64),
   sourceSha256:'b'.repeat(64),sourceAsset:'CAB|Sprite|Texture',
   itemIdEvidence:'field1 ItemID + original IconAddress',width:128,height:128}}};
 const subject={id:31300004,en:'Small Night Thorn',ja:'小さな闇のトゲ'};
 const good=resolveRcItemTextRow(accepted,subject,{locale:'ja',basePath:'/Dreamlight-Timekeeper/'});
 assert.equal(good.image.url,'/Dreamlight-Timekeeper/assets/steam/v1253/31300004.webp');
 for(const altered of [
   m=>{delete m.icons['31300004'].width;},
   m=>{m.icons['31300004'].itemIdEvidence='';},
   m=>{m.icons['31300004'].sourceAsset='';},
   m=>{m.icons['31300004'].height=0;},
   m=>{m.source.platform='Nintendo Switch';},
   m=>{m.icons['31300005']={...m.icons['31300004']};} // duplicate output path
 ]){
  const untrusted=structuredClone(accepted);altered(untrusted);
  const missing=resolveRcItemTextRow(untrusted,subject,{locale:'ja'});
  assert.equal(missing.image.status,'MISSING');
  assert.equal(missing.image.url,null);
  assert.equal(missing.textFallback.visibleByDefault,true);
  assert.match(missing.textFallback.ariaLabel,/ItemID 31300004/);
 }
 for(const root of ['https://external.example/','//external.example/','../','/a/../','/a?b/','javascript:alert(1)/'])
  assert.throws(()=>resolveRcItemTextRow(accepted,subject,{basePath:root}),/Invalid static image URL base/);
 assert.equal(resolveRcItemTextRow(empty,{id:99912347},{locale:'en'}).category.code,'UNCLASSIFIED');
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
 const privatelyVerified=new Set([30000072,31400000,31400039,31300003,31300083,31300128,31300210,...[120200000,120200001,120200002,120200003,120200004,120200005,120200006,120200007,120200008,120200009,120200010,120200011,120200012,120200013,120200016,120200022,120200023,120200024]]);
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
 assert.equal(pinned.unresolvedDefinitionAudit.spriteTextureProof,25);
 assert.equal(pinned.unresolvedDefinitionAudit.remainingUnverifiedSpriteTexture,81);
 assert.equal(pinned.unresolvedDefinitionAudit.publicImageProof,0);
 assert.equal(pinned.summary.publishedVerifiedItemImages,0);
 assert.equal(pinned.summary.publishedMissingRecurringItemIDs,244);
});


test('strict ItemID read-only resolution leaves all 244 unshipped with 81 AMBIGUOUS URL-denied candidates',async()=>{
 const pinned=await json('data/item-image-coverage-v1253.json');
 const stats=new Map();
 for(const entry of pinned.items){
  const view=resolveItemImageView(empty,{id:entry.itemId,en:entry.enNames[0]??''},{coverageAudit:pinned});
  assert.equal(view.status,entry.readOnlyImageResolution.status);
  assert.equal(view.url,null);
  stats.set(view.status,(stats.get(view.status)||0)+1);
  assert.equal(entry.publishedImage,'MISSING');
 }
 assert.deepEqual(Object.fromEntries(stats),{MISSING:163,AMBIGUOUS:81});
 for(const id of [31300004,31300005,30400219,40600013]){
  assert.equal(resolveItemImageView(empty,{id},{coverageAudit:pinned}).status,'AMBIGUOUS');
 }
 for(const id of [31300003,31300083,31300128,31300210]){
  const x=pinned.items.find(r=>r.itemId===id);
  assert.equal(x.definitionAudit.privatePixelProof.status,'PRIVATE_SOURCE_VP8L_RGBA_EQUAL_NOT_RELEASED');
  assert.equal(resolveItemImageView(empty,{id},{coverageAudit:pinned}).status,'MISSING');
 }
 for(const id of [120200013,120200016]){
  const a=pinned.items.find(r=>r.itemId===id);
  assert.equal(a.definitionAudit.privatePixelProof.spriteName,'DemonEvil');
  assert.equal(a.definitionAudit.webpDecodedRgbaMatched,true);
  assert.equal(resolveItemImageView(empty,{id},{coverageAudit:pinned}).status,'MISSING');
 }
 const proofCount=pinned.items.filter(r=>r.definitionAudit?.privatePixelProof?.status==='PRIVATE_SOURCE_VP8L_RGBA_EQUAL_NOT_RELEASED').length;
 assert.equal(proofCount,25);
 assert.equal(pinned.addressablesCatalogAudit.catalogItemIDs,106);
 assert.equal(pinned.addressablesCatalogAudit.componentBundles.sharedPlaceholders,81);
 assert.equal(resolveItemImageView(empty,{id:99999999},{coverageAudit:pinned}).status,'MISSING');
 const bogus=structuredClone(pinned);
 bogus.source.eventRawSHA256='f'.repeat(64);
 assert.equal(resolveItemImageView(empty,{id:31300004},{coverageAudit:bogus}).status,'MISSING');
 assert.equal(pinned.readOnlyResolutionContract.unapprovedMediaPublishable,false);
 assert.equal(pinned.scope.additionalRealSaveItemIDs,'UNKNOWN_NOT_ENUMERATED_ON_THIS_STATIC_BASELINE');
});


test('private generic placeholder source cannot mint ItemID image URL; field5 world object is not thumbnail',async()=>{
 const pinned=await json('data/item-image-coverage-v1253.json');
 const original=await json('data/steam-icons-v1253.json');
 const audit=pinned.sharedPlaceholderAssetInspection;
 const source=pinned.field5WorldObjectCatalogAudit;
 assert.equal(audit.genericSpriteName,'icon_2x2');
 assert.equal(audit.genericSpritePathId,'13192077654445607906');
 assert.equal(audit.genericTexturePathId,'15528772250824494050');
 assert.equal(audit.genericTextureWidth,265);
 assert.equal(audit.genericTextureHeight,246);
 assert.equal(audit.rawTextureRgbaSha256,'42daa1b8ebadd81fc48eef2a8ecc2fb3f8eac4878f4f57d28b3dd44a40e28add');
 assert.equal(audit.privateLosslessWebpBytes,4316);
 assert.equal(audit.privateLosslessWebpSha256,'34be7222ed315fec5ee36b840fa163997a2fb4e1e764ac8f2cb180714ad34408');
 assert.equal(audit.privateReopenedRgbaIdentical,true);
 assert.equal(audit.privatePrototypeIsItemThumbnail,false);
 assert.equal(audit.perItemRuntimeVariant,'UNKNOWN');
 assert.equal(audit.perItemSourceSpriteTexture,'UNPROVEN');
 assert.equal(audit.pixelsOrGameBundlePublished,false);
 assert.equal(source.sourceItemCount,81);
 assert.equal(source.distinctField5Guids,81);
 assert.equal(source.gameObjectCatalogEntries,81);
 assert.equal(source.uniquePrimaryBundleCount,32);
 assert.equal(source.highPriorityObjectRoutesRecorded,9);
 assert.equal(source.actualRuntimeVariantVerified,false);
 assert.equal(source.renderedThumbsMatched,0);
 assert.equal(source.publicImageUrlsGranted,0);
 const placeholder=pinned.items.filter(i=>i.definitionAudit?.declaredIconAddressGuid===audit.declaredIconAddressGuid);
 assert.equal(placeholder.length,81);
 for(const item of placeholder){
  assert.equal(item.readOnlyImageResolution.status,'AMBIGUOUS');
  assert.equal(item.readOnlyImageResolution.url,null);
  assert.equal(item.definitionAudit.webpDecodedRgbaMatched,false);
  assert.equal(item.definitionAudit.spriteResolved,false);
  assert.equal(item.definitionAudit.catalogDependency.perItemSpritePathId,null);
  assert.equal(item.definitionAudit.catalogDependency.perItemTexturePathId,null);
  assert.equal(item.definitionAudit.worldObjectSource.doesNotResolve2DThumbnail,true);
  assert.equal(item.definitionAudit.worldObjectSource.candidateRenderingStrategy,'UNKNOWN_RUNTIME');
  const view=resolveItemImageView(original,{id:item.itemId},{coverageAudit:pinned});
  assert.equal(view.status,'AMBIGUOUS');
  assert.equal(view.url,null);
 }
 const top=placeholder.filter(i=>i.unresolvedVariantPriority.tier==='P0');
 assert.equal(top.length,9);
 assert.equal(top.every(i=>i.definitionAudit.worldObjectSource.additionalSourcePathProof==='EXACT_FIELD5_AND_CATALOG_DEPENDENCY'),true);
 assert.equal(new Set(top.map(i=>i.definitionAudit.worldObjectSource.gameObjectGuid)).size,9);
 assert.equal(placeholder.filter(i=>i.unresolvedVariantPriority.tier==='P1').length,12);
 assert.equal(placeholder.filter(i=>i.unresolvedVariantPriority.tier==='P2').length,60);
});


test('RC text fallback serves all 244 with ItemID, localized name, source-qualified category and accessible status',async()=>{
 const audit=await json('data/item-image-coverage-v1253.json');
 const counts={MISSING:0,AMBIGUOUS:0,VERIFIED:0},categories=new Map();
 for(const entry of audit.items){
  const row=resolveRcItemTextRow(empty,{id:entry.itemId},{locale:'ja',coverageAudit:audit});
  assert.equal(row.contract,RC_ITEM_TEXT_CONTRACT);
  assert.equal(row.itemId,entry.itemId);
  assert.equal(row.locale,'ja');
  assert.equal(row.idLabel,'ItemID '+entry.itemId);
  assert.ok(row.name.length>0);
  assert.ok(row.category.label.length>0);
  assert.ok(row.textFallback.visibleName.length>0);
  assert.equal(row.textFallback.visibleItemId,row.idLabel);
  assert.equal(row.category.source,'ORIGINAL_ITEMDB_STREAM');
  assert.equal(row.category.verified,true);
  assert.equal(row.textFallback.visibleCategory,row.category.label);
  assert.ok(row.textFallback.ariaLabel.includes('ItemID '+entry.itemId));
  assert.ok(row.textFallback.ariaLabel.includes(row.name));
  assert.equal(row.textFallback.renderAsPlainText,true);
  assert.equal(row.textFallback.required,true);
  assert.equal(row.textFallback.visibleByDefault,true);
  assert.equal(row.textFallback.onImageErrorMustShow,true);
  assert.equal(row.image.url,null);
  assert.equal(row.image.width,null);
  assert.equal(row.image.height,null);
  assert.equal(row.evidence.privatePixelDoesNotGrantImage,true);
  assert.equal(row.evidence.worldObjectPrefabDoesNotGrantImage,true);
  assert.equal(row.evidence.mediaRedistributionPermission,'NOT_ESTABLISHED');
  assert.equal(row.rcTextDisplaySupported,true);
  assert.equal(row.fullItemImageReleaseAccepted,false);
  assert.equal(row.image.status,entry.readOnlyImageResolution.status);
  assert.ok(!/<[^>]*>/.test(row.name));
  counts[row.image.status]++;
  categories.set(row.category.code,(categories.get(row.category.code)||0)+1);
 }
 assert.deepEqual(counts,{MISSING:163,AMBIGUOUS:81,VERIFIED:0});
 assert.deepEqual(Object.fromEntries(categories),{
  ACTIVITY_ITEM:173,FURNITURE_SOURCE:52,COMPANION:19
 });
 const legacy=resolveRcItemTextRow(empty,{id:30000062},{locale:'ja',coverageAudit:audit});
 assert.equal(legacy.category.code,'ACTIVITY_ITEM');
 assert.equal(legacy.category.verified,true);
 assert.equal(audit.originalItemTypeCensus.matchedByItemDbField1,244);
 assert.deepEqual(audit.originalItemTypeCensus.streamCounts,{
   'ActivityItem.json':173,'Furniture.json':52,'Companion.json':19
 });
 const thorn=resolveRcItemTextRow(empty,{id:31300004},{locale:'ja',coverageAudit:audit});
 assert.equal(thorn.name,'小さな闇のトゲ');
 assert.equal(thorn.category.code,'ACTIVITY_ITEM');
 assert.equal(thorn.category.source,'ORIGINAL_ITEMDB_STREAM');
 assert.equal(thorn.image.status,'AMBIGUOUS');
 assert.equal(thorn.textFallback.required,true);
 const blocker=resolveRcItemTextRow(empty,{id:40600035},{locale:'en',coverageAudit:audit});
 assert.equal(blocker.category.code,'FURNITURE_SOURCE');
 assert.equal(blocker.category.label,'Furniture / world object');
 assert.equal(blocker.image.url,null);
 const companion=resolveRcItemTextRow(empty,{id:120200017},{locale:'en',coverageAudit:audit});
 assert.equal(companion.category.code,'COMPANION');
 assert.equal(companion.image.status,'AMBIGUOUS');
});

test('RC row falls back safely for dynamic or invalid ItemIDs and does not treat event IDs or private pixel proof as image authority',async()=>{
 const audit=await json('data/item-image-coverage-v1253.json');
 const dynamic=resolveRcItemTextRow(empty,{
   id:99912348,name:'<img src=x onerror=alert(1)>Unknown\u202e item'
 },{locale:'en',coverageAudit:audit});
 assert.equal(dynamic.itemId,99912348);
 assert.equal(dynamic.name,'Unknown item');
 assert.equal(dynamic.category.code,'UNCLASSIFIED');
 assert.equal(dynamic.category.verified,false);
 assert.equal(dynamic.category.source,'NOT_VERIFIED');
 assert.equal(dynamic.image.url,null);
 assert.equal(dynamic.image.status,'MISSING');
 assert.equal(dynamic.textFallback.visibleItemId,'ItemID 99912348');
 assert.equal(dynamic.fullItemImageReleaseAccepted,false);
 const event=resolveRcItemTextRow(empty,{id:2010000003},{locale:'ja',coverageAudit:audit});
 assert.equal(event.image.url,null);
 assert.equal(event.category.code,'UNCLASSIFIED');
 const noAudit=resolveRcItemTextRow(empty,{id:31300004,en:'Small Night Thorn'},
  {locale:'en'});
 assert.equal(noAudit.image.status,'MISSING'); // No verified audit -> no ambiguous assertion.
 assert.equal(noAudit.category.verified,false);
 const forged=structuredClone(audit);forged.source.eventRawSHA256='0'.repeat(64);
 const tampered=resolveRcItemTextRow(empty,{id:31300004},
  {coverageAudit:forged});
 assert.equal(tampered.category.code,'UNCLASSIFIED');
 assert.equal(tampered.image.status,'MISSING');
 const privatePixel=resolveRcItemTextRow(empty,{id:120200013},{coverageAudit:audit});
 assert.equal(privatePixel.image.url,null);
 assert.equal(privatePixel.image.status,'MISSING');
 assert.equal(privatePixel.fullItemImageReleaseAccepted,false);
 assert.throws(()=>resolveRcItemTextRow(empty,{id:31300004},{locale:'fr',coverageAudit:audit}),
  /Unsupported RC text locale/);
 const invalid=resolveRcItemTextRow(empty,{id:-1,ja:'仮のアイテム'},
  {coverageAudit:audit});
 assert.equal(invalid.itemId,null);
 assert.equal(invalid.image.url,null);
 assert.equal(invalid.category.code,'UNCLASSIFIED');
});

test('RC row grants mock verified URL only from a fully provenance-validated item image manifest, never research audit',async()=>{
 const audit=await json('data/item-image-coverage-v1253.json');
 const verified={source:{platform:'Steam/Windows',gameVersion:'1.25.3',status:'VERIFIED_STEAM_ASSETS'},
  icons:{'31300004':{
    platform:'Steam',gameVersion:'1.25.3',verified:true,
    path:'assets/steam/v1253/31300004.webp',
    sha256:'a'.repeat(64),sourceSha256:'b'.repeat(64),
    sourceAsset:'CAB|GUID|Sprite|Texture',itemIdEvidence:'ActivityItem field1+4',
    width:128,height:128
  }}};
 const mock=resolveRcItemTextRow(verified,{id:31300004},{locale:'ja',coverageAudit:audit});
 assert.equal(mock.image.status,'VERIFIED');
 assert.equal(mock.image.url,'./assets/steam/v1253/31300004.webp');
 assert.equal(mock.image.alt,'小さな闇のトゲ');
 assert.equal(mock.textFallback.required,true);
 assert.equal(mock.textFallback.visibleByDefault,false);
 assert.equal(mock.textFallback.onImageErrorMustShow,true);
 assert.equal(mock.fullItemImageReleaseAccepted,false); // One mock path never clears 244 coverage gate.
 assert.equal(resolveRcItemTextRow(empty,{id:31300004},{coverageAudit:audit}).image.url,null);
});
