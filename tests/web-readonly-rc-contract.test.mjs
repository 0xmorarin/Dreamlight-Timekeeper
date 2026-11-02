import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rcTextOnlyItem,checkedTextItemTypes} from '../src/lib/timekeeper/item-text-only.mjs';
import {rejectOversizeWorkerProjection,WORKER_PRODUCER_BOUNDS_CONTRACT} from '../src/lib/timekeeper/worker-projection-bounds.mjs';
import {PROJECTION_TRANSPORT_LIMITS} from '../src/lib/timekeeper/session-response-fence.mjs';
const load=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const types=await load('data/web-text-item-types-v1253.json');
const core=await load('contracts/web-readonly-core-worker-v1.json');
const release=await load('contracts/web-readonly-rc-release-v1.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const page=(rows=[{id:1}],complete=true,nextCursor=null)=>({
 identity:{sessionKey:'core-private',generation:2,revision:1,originalSha256:'a'.repeat(64)},
 indexGeneration:4,domain:'timing',view:'summary',rows,complete,nextCursor
});
test('asset-derived source type baseline is 244 unique ItemIDs and has no media authority',()=>{
 assert.equal(checkedTextItemTypes(types).size,244);
 assert.equal(types.assetSource.head,'067cd1b1b59eb7e0ce4119d2355ed074fd49cc5b');
 assert.equal(types.assetSource.blobSha,'9d8941c6c28d6d12b0a1bcd82422bd32792e1ff5');
 assert.equal(types.counts.ActivityItem,173);
 assert.equal(types.counts.Furniture,52);
 assert.equal(types.counts.Companion,19);
 assert.equal(types.policy.imageUrlAuthority,false);
 assert.equal(types.policy.mediaRedistributionPermission,'NOT_ESTABLISHED');
 assert.equal(types.items.every(([id,stream],i)=>Number.isSafeInteger(id)&&id>0&&
  (i===0||id>types.items[i-1][0])&&
  ['ActivityItem.json','Furniture.json','Companion.json'].includes(stream)),true);
});
test('source-types render plain accessibility text; never infer EventID or an image URL',()=>{
 for(const [id,stream] of types.items){
  const output=rcTextOnlyItem({id,name:'Item '+id},'ja-JP',types);
  assert.equal(output.sourceCategory,stream);
  assert.equal(output.sourceTypeVerified,true);
  assert.equal(output.mediaUrl,null);
  assert.equal(output.mediaRightsGranted,false);
  assert.match(output.displayLine,new RegExp('ItemID '+id));
  assert.equal(output.displayTextFirst,true);
 }
 const unknown=rcTextOnlyItem({id:777777777,name:'<img src=x onerror=alert(1)>'},'en-US',types);
 assert.equal(unknown.sourceCategory,'UNCLASSIFIED');
 assert.equal(unknown.sourceTypeVerified,false);
 assert.equal(unknown.mediaUrl,null);
 assert.equal(unknown.name,'Item 777777777');
 assert.match(unknown.ariaLabel,/Image unavailable/);
 const unset=rcTextOnlyItem({id:2010000021},'fr-FR',types);
 // An EventID is not automatically an ItemID; unknown numeric IDs stay unclassified.
 assert.equal(unset.sourceTypeVerified,false);
});
test('tampered ASSET digest, source category, image permission or duplicate ItemIDs fail closed',()=>{
 for(const edited of [
  a=>a.assetSource.blobSha='f'.repeat(40),
  a=>a.policy.imageUrlAuthority=true,
  a=>a.items[1][0]=a.items[0][0],
  a=>a.items[3][1]='nonexistent',
  a=>a.counts.Companion=20,
  a=>a.items.shift()
 ]){
  const c=clone(types);edited(c);
  assert.throws(()=>checkedTextItemTypes(c),/UNVERIFIED_ITEM_SOURCE_TYPE/);
 }
});
test('prospective producer egress accepts bounded complete/incomplete pages without issuing cursors',()=>{
 assert.equal(WORKER_PRODUCER_BOUNDS_CONTRACT,'timekeeper.worker-producer-bounds.proposal@1');
 const x=page();assert.equal(rejectOversizeWorkerProjection(x),x);
 const p=page([{id:1}],false,'opaque-from-C-o-r-e');
 assert.equal(rejectOversizeWorkerProjection(p).nextCursor,'opaque-from-C-o-r-e');
 // This helper does not validate whether the cursor was minted by Core.
 // Such a check is a REQUIRED separate gate, not a product READ acceptance.
 assert.equal(rejectOversizeWorkerProjection(page([{id:2}],false,'FAKE')).nextCursor,'FAKE');
});
test('producer budget refuses 700KB row, multibyte UTF8 row, aggregate >2MiB and >200 rows',()=>{
 assert.throws(()=>rejectOversizeWorkerProjection(page([{oversized:'x'.repeat(700000)}])),
  /WORKER_PROJECTION_BYTES_REJECTED/);
 assert.throws(()=>rejectOversizeWorkerProjection(page([{multi:'界'.repeat(22000)}])),
  /WORKER_PROJECTION_BYTES_REJECTED/);
 assert.throws(()=>rejectOversizeWorkerProjection(page(Array.from({length:200},(_,i)=>({id:i,data:'x'.repeat(12000)})))),
  /WORKER_PROJECTION_BYTES_REJECTED/);
 assert.throws(()=>rejectOversizeWorkerProjection(page(Array.from({length:201},(_,i)=>({id:i}))),/WORKER_PROJECTION_ENVELOPE_REJECTED/);
});
test('producer rejects contradictory complete/cursor, missing cursor, zero-progress and invalid JSON',()=>{
 assert.throws(()=>rejectOversizeWorkerProjection(page([{id:1}],true,'extra')),/WORKER_PROJECTION_ENVELOPE_REJECTED/);
 assert.throws(()=>rejectOversizeWorkerProjection(page([{id:1}],false,null)),/WORKER_PROJECTION_ENVELOPE_REJECTED/);
 assert.throws(()=>rejectOversizeWorkerProjection(page([],false,'next')),/WORKER_PROJECTION_ENVELOPE_REJECTED/);
 assert.throws(()=>rejectOversizeWorkerProjection({...page(),nextCursor:undefined}),/WORKER_PROJECTION_ENVELOPE_REJECTED/);
 assert.throws(()=>rejectOversizeWorkerProjection(page([{bad:1n}])),/WORKER_PROJECTION_BYTES_REJECTED/);
 assert.throws(()=>rejectOversizeWorkerProjection(page([{bad:1}],false,'x'.repeat(513))),/WORKER_PROJECTION_ENVELOPE_REJECTED/);
});
test('versioned RC contract keeps true product release and Rust/WASM Writer disabled',()=>{
 assert.equal(core.status,'PROPOSED_NOT_BOUND');
 assert.equal(core.actualReadWorkerEnabled,false);
 assert.equal(core.transport.maxRows,PROJECTION_TRANSPORT_LIMITS.maxRows);
 assert.equal(core.transport.maxRowBytesUtf8Json,PROJECTION_TRANSPORT_LIMITS.maxRowBytes);
 assert.equal(core.transport.maxWholePageBytesUtf8Json,PROJECTION_TRANSPORT_LIMITS.maxPageBytes);
 assert.equal(core.transport.workerHelperWiredToRealCore,false);
 assert.equal(core.permissions.ENCODE_COPY,false);
 assert.equal(core.permissions.PERSISTENT_REPLACE,false);
 assert.equal(release.status,'DRAFT_NEVER_DEPLOY');
 assert.equal(release.product.assetRasterImagesApproved,0);
 assert.equal(release.product.staticSourceTypes,244);
 assert.equal(release.product.writerEnabled,false);
 assert.equal(release.product.editedCopyOutputEnabled,false);
 assert.equal(release.releaseGates.publicReleaseApproved,false);
 assert.equal(release.releaseGates.legacyHtmlVerifyGreen,false);
 assert.equal(release.staging.noUploadOrDeployInThisWorkflow,true);
});
