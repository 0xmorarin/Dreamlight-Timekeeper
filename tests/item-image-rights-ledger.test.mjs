import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildItemImageRightsLedger,ITEM_IMAGE_RIGHTS_LEDGER} from '../scripts/item-image-rights-ledger.mjs';

const read=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const baseline=await read('data/item-image-coverage-v1253.json');
const manifest=await read('data/steam-icons-v1253.json');
const copy=x=>structuredClone(x);
const failPattern=/IMAGE_RIGHTS_LEDGER_FAIL_CLOSED/;

test('244 IDs have independently recorded image and rights states; no public URL',()=>{
 const result=buildItemImageRightsLedger(baseline,manifest);
 assert.equal(result.schema,ITEM_IMAGE_RIGHTS_LEDGER);
 assert.equal(result.records.length,244);
 assert.deepEqual(result.summary,{
  VERIFIED:0,AMBIGUOUS:81,MISSING:163,RIGHTS_APPROVED:0,
  REVIEW_REQUIRED:244,OFF:244,publicExactPrefabRouteMetadata:9,
  privateAggregateOnlyPrefabRoutes:72,originalPerItemUiVariantsVerified:0,
  independentLosslessWebpPixelReopens:0
 });
 assert.equal(new Set(result.records.map(r=>r.itemId)).size,244);
 assert.deepEqual(result.records.map(r=>r.itemId),baseline.items.map(x=>x.itemId));
 for(const row of result.records){
  assert(['AMBIGUOUS','MISSING'].includes(row.image.status));
  assert.equal(row.image.publicUrl,null);
  assert.equal(row.image.originalItemSpritePathId,null);
  assert.equal(row.image.originalItemTexturePathId,null);
  assert.equal(row.image.runtimeVariant,'UNKNOWN_NOT_PROVEN');
  assert.equal(row.image.sourceRgbaSha256,null);
  assert.equal(row.image.losslessWebpSha256,null);
  assert.equal(row.image.losslessWebpBytes,null);
  assert.equal(row.image.independentPixelParity,'NOT_RUN');
  assert.equal(row.rights.status,'REVIEW_REQUIRED');
  assert.equal(row.rights.release,'OFF');
  assert.equal(row.rights.assetRedistributionPermission,'NOT_ESTABLISHED');
 }
 assert.equal(result.rightsBasis.technicalAuthenticityDoesNotGrantRights,true);
});

test('all 81 shared field4 assets remain one generic Sprite, never 81 item-specific images',()=>{
 const result=buildItemImageRightsLedger(baseline,manifest);
 const subset=result.records.filter(r=>r.image.status==='AMBIGUOUS');
 assert.equal(subset.length,81);
 assert.deepEqual(Object.fromEntries(['FIELD5_GAMEOBJECT_PUBLIC_REFERENCE_ONLY',
 'FIELD5_GAMEOBJECT_PRIVATE_CENSUS_ONLY'].map(x=>[x,subset.filter(r=>r.image.evidence===x).length])),{
  FIELD5_GAMEOBJECT_PUBLIC_REFERENCE_ONLY:9,
  FIELD5_GAMEOBJECT_PRIVATE_CENSUS_ONLY:72
 });
 const types=Object.fromEntries(['ActivityItem.json','Furniture.json','Companion.json']
  .map(x=>[x,subset.filter(r=>r.sourceRecordType===x).length]));
 assert.deepEqual(types,{'ActivityItem.json':28,'Furniture.json':52,'Companion.json':1});
 assert.ok(subset.every(r=>r.image.publicUrl===null&&r.rights.release==='OFF'));
});

test('private pixel metadata may be preserved without independent source/pixel or rights promotion',()=>{
 const result=buildItemImageRightsLedger(baseline,manifest);
 const privatePrototype=result.records.filter(r=>
  r.image.evidence==='PRIVATE_PIXEL_PROTOTYPE_METADATA_NOT_INDEPENDENT_RELEASE_PROOF');
 assert.equal(privatePrototype.length,138);
 assert.ok(privatePrototype.every(r=>r.image.independentPixelParity==='NOT_RUN'&&
  r.rights.status==='REVIEW_REQUIRED'));
 const privateOther=result.records.filter(r=>
  r.image.evidence==='PRIVATE_ITEM_PIXEL_METADATA_NOT_INDEPENDENT_RELEASE_PROOF');
 assert.equal(privateOther.length,25);
 assert.ok(privateOther.every(r=>r.image.publicUrl===null&&r.rights.release==='OFF'));
});

test('unapproved image manifest, forged status, extra unknown ID, and source-type drift fail closed',()=>{
 const approved=copy(manifest);approved.source.status='VERIFIED_STEAM_ASSETS';
 assert.throws(()=>buildItemImageRightsLedger(baseline,approved),failPattern);
 const published=copy(manifest);published.icons['31300004']={path:'assets/steam/v1253/fake.webp'};
 assert.throws(()=>buildItemImageRightsLedger(baseline,published),failPattern);
 const promoted=copy(baseline);promoted.items[0].readOnlyImageResolution.status='VERIFIED';
 assert.throws(()=>buildItemImageRightsLedger(promoted,manifest),failPattern);
 const leaked=copy(baseline);leaked.items[0].readOnlyImageResolution.url='https://example.com/fake.webp';
 assert.throws(()=>buildItemImageRightsLedger(leaked,manifest),failPattern);
 const fromSave=copy(baseline);fromSave.items.push({...fromSave.items[0],itemId:99912347});
 assert.throws(()=>buildItemImageRightsLedger(fromSave,manifest),failPattern);
 const source=copy(baseline);source.items[0].itemSourceType.sourceSha256='f'.repeat(64);
 assert.throws(()=>buildItemImageRightsLedger(source,manifest),failPattern);
});

test('tampered shared placeholder Sprite/field5 and forged runtime variant cannot become VERIFIED',()=>{
 const first=baseline.items.findIndex(r=>r.readOnlyImageResolution.status==='AMBIGUOUS');
 assert(first>=0);
 for(const change of [
  a=>a.items[first].definitionAudit.catalogDependency.genericSourceSpritePathId='123',
  a=>a.items[first].definitionAudit.catalogDependency.perItemTexturePathId='123',
  a=>a.items[first].definitionAudit.worldObjectSource.catalogResourceType='UnityEngine.Sprite',
  a=>a.items[first].definitionAudit.worldObjectSource.candidateRenderingStrategy='CONFIRMED',
  a=>a.field5WorldObjectCatalogAudit.actualRuntimeVariantVerified=true,
  a=>a.field5WorldObjectCatalogAudit.privateCanonical81RouteMetadataSha256='0'.repeat(64),
  a=>a.policy.permissionState='RIGHTS_APPROVED'
 ]){
  const cloned=copy(baseline);change(cloned);
  assert.throws(()=>buildItemImageRightsLedger(cloned,manifest),failPattern);
 }
});

test('does not reinterpret EventID or grant image distribution to original Owner SVG',()=>{
 const out=buildItemImageRightsLedger(baseline,manifest);
 assert.equal(out.records.some(x=>x.itemId===2010000003),false);
 assert.equal(out.records.every(x=>x.rights.scope==='EXTRACTED_DDV_ITEM_IMAGE_PUBLIC_STATIC_WEB_DISTRIBUTION'),true);
 assert.equal(out.fullUserSaveVisibleItemIDDenominator,'UNKNOWN_NOT_OBSERVED');
 assert.equal(out.summary.RIGHTS_APPROVED,0);
});
