// 05 QR November RC: metadata-only diff on frozen ASSET PR23 8f3516a -> 0195af3.
// No private bundle, original RGBA, compressed VP8L, or publishing rights are present.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const prev=JSON.parse(execFileSync('git',['show',
 '8f3516a543e381709f73db96bdabd6b78a144bcd:data/item-image-coverage-v1253.json'],
 {encoding:'utf8',maxBuffer:20*1024*1024}));
const now=JSON.parse(await readFile(new URL('../data/item-image-coverage-v1253.json',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../data/steam-icons-v1253.json',import.meta.url),'utf8'));
const common='04495f960b1edba4181ec51efa5e07d9';
const selected=now.items.filter(r=>r.definitionAudit?.declaredIconAddressGuid===common);
test('05QR delta has exact 81 field5 GameObject source metadata without modifying 25 private pixel claims',()=>{
 assert.equal(prev.field5WorldObjectCatalogAudit,undefined);
 assert.equal(selected.length,81);
 assert.equal(now.items.length,244);
 const byId=new Map(prev.items.map(x=>[x.itemId,x]));
 let seen=0;
 for(const item of now.items){
  const before=byId.get(item.itemId);
  assert(before);
  assert.deepEqual(item.definitionAudit?.privatePixelProof,before.definitionAudit?.privatePixelProof);
  assert.equal(item.publishedImage,before.publishedImage);
  if(item.definitionAudit?.worldObjectSource){
   seen++;
   assert.equal(item.definitionAudit.worldObjectSource.itemDbField,5);
   assert.equal(item.definitionAudit.worldObjectSource.catalogResourceType,'UnityEngine.GameObject');
   assert.equal(item.definitionAudit.worldObjectSource.candidateRenderingStrategy,'UNKNOWN_RUNTIME');
   assert.equal(item.definitionAudit.worldObjectSource.doesNotResolve2DThumbnail,true);
  }
 }
 assert.equal(seen,81);
 assert.equal(now.items.filter(x=>x.definitionAudit?.privatePixelProof).length,25);
});
test('05QR 81 GameObject catalog entries != 81 actual image thumbs',()=>{
 const f=now.field5WorldObjectCatalogAudit;
 assert.equal(f.gameVersion,'1.25.3');
 assert.equal(f.sourceItemCount,81);
 assert.equal(f.distinctField5Guids,81);
 assert.equal(f.gameObjectCatalogEntries,81);
 assert.equal(f.eachGuidMatchesExactlyOneGameObjectEntry,true);
 assert.equal(f.resourceType,'UnityEngine.GameObject');
 assert.equal(f.uniquePrimaryBundleCount,32);
 assert.equal(f.highPriorityObjectRoutesRecorded,9);
 assert.equal(f.privateRouteMetadataRowCount,81);
 assert.match(f.privateCanonical81RouteMetadataSha256,/^[0-9a-f]{64}$/);
 assert.equal(f.field5NativeUsageVerified,false);
 assert.equal(f.actualRuntimeVariantVerified,false);
 assert.equal(f.renderedThumbsMatched,0);
 assert.equal(f.publicImageUrlsGranted,0);
 assert.equal(f.rights,'NOT_ESTABLISHED');
 const count=Object.values(f.originalCatalogDependencyRouteFamilies).reduce((a,b)=>a+b,0);
 assert.equal(count,81);
 const top=selected.filter(x=>x.unresolvedVariantPriority?.tier==='P0');
 assert.equal(top.length,9);
 assert(top.every(x=>x.definitionAudit.worldObjectSource.additionalSourcePathProof==='EXACT_FIELD5_AND_CATALOG_DEPENDENCY'));
});
test('05QR source pointer and placeholder do not turn into item-specific Sprite or public URL',()=>{
 const p=now.sharedPlaceholderAssetInspection;
 assert.equal(p.privatePrototypeIsItemThumbnail,false);
 assert.equal(p.perItemRuntimeVariant,'UNKNOWN');
 assert.equal(p.perItemSourceSpriteTexture,'UNPROVEN');
 assert.equal(p.pixelsOrGameBundlePublished,false);
 assert.equal(now.unresolvedDefinitionAudit.remainingUnverifiedSpriteTexture,81);
 assert.equal(now.unresolvedDefinitionAudit.privatePrototypeRgbaMatched,25);
 assert.equal(now.readOnlyResolutionContract.privatePixelProofsNotPublished,25);
 for(const item of selected){
  const a=item.definitionAudit;
  assert.equal(a.status,'SHARED_ICON_ADDRESS_NOT_ITEM_SPECIFIC');
  assert.equal(a.spriteResolved,false);
  assert.equal(a.textureResolved,false);
  assert.equal(a.webpDecodedRgbaMatched,false);
  assert.equal(a.catalogDependency.perItemSpritePathId,null);
  assert.equal(a.catalogDependency.perItemTexturePathId,null);
  assert.equal(a.catalogDependency.releaseImageUrl,null);
  assert.equal(item.readOnlyImageResolution.status,'AMBIGUOUS');
  assert.equal(item.readOnlyImageResolution.url,null);
 }
});
test('05QR release manifest and 244 statuses remain denied regardless of private metadata',()=>{
 assert.equal(Object.keys(manifest.icons).length,0);
 assert.equal(now.readOnlyResolutionContract.recurringTotal,244);
 assert.equal(now.readOnlyResolutionContract.verifiedPublished,0);
 assert.equal(now.readOnlyResolutionContract.ambiguousWithoutUrl,81);
 assert.equal(now.readOnlyResolutionContract.missingWithoutUrl,163);
 assert.equal(now.policy.allowGameImagePublication,false);
 assert.equal(now.policy.permissionState,'NOT_ESTABLISHED');
 assert.equal(now.scope.additionalRealSaveItemIDs,'UNKNOWN_NOT_ENUMERATED_ON_THIS_STATIC_BASELINE');
 assert(now.items.every(x=>x.publishedImage==='MISSING'));
 assert.equal(now.field5WorldObjectCatalogAudit.publicImageUrlsGranted,0);
});

test('05QR only nine P0 routes carry item-level Field5 GUID/bundle metadata, not thumbnail evidence',()=>{
 const top=selected.filter(r=>r.unresolvedVariantPriority?.tier==='P0');
 assert.equal(top.length,9);
 const guids=new Set();
 for(const row of top){
  const p=row.definitionAudit.worldObjectSource;
  assert.match(p.gameObjectGuid,/^[0-9a-f]{32}$/);
  assert.equal(p.additionalSourcePathProof,'EXACT_FIELD5_AND_CATALOG_DEPENDENCY');
  assert(typeof p.primaryDependencyBundle==='string'&&p.primaryDependencyBundle.length>5);
  assert.equal(p.doesNotResolve2DThumbnail,true);
  assert.equal(row.readOnlyImageResolution.url,null);
  guids.add(p.gameObjectGuid);
 }
 assert.equal(guids.size,9);
 const other=selected.filter(r=>r.unresolvedVariantPriority?.tier!=='P0');
 assert.equal(other.length,72);
 for(const row of other){
  assert.equal(row.definitionAudit.worldObjectSource.additionalSourcePathProof,'SOURCE_CENSUS_ONLY');
  assert.equal(row.definitionAudit.worldObjectSource.doesNotResolve2DThumbnail,true);
 }
});
