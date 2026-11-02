import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PRIVATE_SOURCE_BUNDLES,reconcileReviewedIconAudits} from '../scripts/reconcile-item-image-source-audits.mjs';

const events=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const sourceSha='20e4f190fc4481325cb4311a4a3f3e6fc57d3f1ca7a67acffd9c9008394ba5d4';
const hashes=Object.values(PRIVATE_SOURCE_BUNDLES);
const fakeRow=(itemId,overrides={})=>({
 itemId:String(itemId),internalName:'ResearchOnlyFixture',
 guid:'cde81d2b9fb9e5646849beef392f99d4',
 spriteName:'ResearchOnlyFixture',spritePathId:'15475831571031946655',
 texturePathId:'9245154426014365087',textureFormat:'BC7',
 width:128,height:128,...overrides
});
const audit=(sha,rows=[])=>({
 source:{platform:'Steam/Windows',gameVersion:'1.25.3',
  activityItemSHA256:sourceSha,bundleSHA256:sha},
 summary:{itemIds:rows.length},
 candidates:rows
});

test('existing original seven source hashes are immutable and no data can pose as WebP parity',()=>{
 assert.equal(Object.keys(PRIVATE_SOURCE_BUNDLES).length,7);
 assert.equal(new Set(hashes).size,7);
 assert.ok(hashes.every(x=>/^[0-9a-f]{64}$/.test(x)));
 const result=reconcileReviewedIconAudits(events,[audit(hashes[0],[fakeRow(31300003)])],
  {requireAllSeven:false});
 assert.equal(result.recurringItemIDs,244);
 assert.equal(result.recurringStaticLinked,1);
 assert.equal(result.recurringUnlinked,243);
 assert.equal(result.covered[0].state,'STATIC_SOURCE_LINK_ONLY_NO_PUBLIC_IMAGE');
 assert.equal(result.duplicateItemIdConflicts,0);
});

test('reused source Sprite across two different ItemIDs is a valid image alias, not ItemID collision',()=>{
 const rows=[fakeRow(31300003),fakeRow(31300004)];
 const result=reconcileReviewedIconAudits(events,[audit(hashes[0],rows)],{requireAllSeven:false});
 assert.equal(result.recurringStaticLinked,2);
 assert.equal(result.sharedSourceSpriteAliases,1);
});

test('same ItemID across two original bundles is an actual conflict',()=>{
 const a=audit(hashes[0],[fakeRow(31300003)]);
 const b=audit(hashes[1],[fakeRow(31300003)]);
 assert.throws(()=>reconcileReviewedIconAudits(events,[a,b],{requireAllSeven:false}),/conflicting/);
});

test('reject fake game version, source hash, Sprite/Texture relationship and bundle duplication',()=>{
 const a=audit(hashes[0],[fakeRow(31300003)]);
 assert.throws(()=>reconcileReviewedIconAudits(events,[a,a],{requireAllSeven:false}),/Duplicate source/);
 assert.throws(()=>reconcileReviewedIconAudits(events,[{...a,source:{...a.source,activityItemSHA256:'0'.repeat(64)}}],
  {requireAllSeven:false}),/Unverified Steam/);
 assert.throws(()=>reconcileReviewedIconAudits(events,[audit(hashes[0],[fakeRow(31300003,{spritePathId:'0'})])],
  {requireAllSeven:false}),/Malformed/);
 assert.throws(()=>reconcileReviewedIconAudits(events,[a]),/missing one of seven/);
});

test('checked-in 244 ItemID status ledger is fail-closed and explicitly missing all deployed images',async()=>{
 const report=JSON.parse(await readFile(new URL('../data/item-image-coverage-v1253.json',import.meta.url),'utf8'));
 assert.equal(report.scope.recurringEventDefinitions,508);
 assert.equal(report.scope.recurringDistinctItemIDs,244);
 assert.equal(report.summary.recurringStaticSourceLinkedCandidateIDs,138);
 assert.equal(report.summary.recurringNotLinkedByThoseSourceBundles,106);
 assert.equal(report.summary.publishedVerifiedItemImages,0);
 assert.equal(report.summary.publishedMissingRecurringItemIDs,244);
 assert.equal(report.summary.itemIdCollisionsAcrossSevenSources,0);
 assert.equal(report.summary.assetGUIDLinkAmbiguitiesNotPromoted,3);
 assert.equal(report.scope.additionalRealSaveItemIDs,'UNKNOWN_NOT_ENUMERATED_ON_THIS_STATIC_BASELINE');
 assert.equal(report.policy.permissionState,'NOT_ESTABLISHED');
 assert.ok(report.items.every(x=>x.publishedImage==='MISSING'&&
  x.rgbaVerifiedForThisItem==='NOT_ATTESTED_IN_PUBLIC_RELEASE_RECORD'));
});
