import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionResponseFence,PROJECTION_TRANSPORT_LIMITS} from '../src/lib/timekeeper/session-response-fence.mjs';
import {
 FIXTURE_PROTOCOL,identity,query,page,RESPONSE_NEGATIVES,SEQUENTIAL_NEGATIVES
} from './fixtures/web-projection-negative-corpus.mjs';

const init=()=>{
 const fence=createSessionResponseFence();
 const epoch=fence.beginOpen();
 const id=fence.acceptOpen(epoch,identity());
 return {fence,epoch,id};
};
function send(fence,epoch,q,result){
 const ticket=fence.issuePageQuery(epoch,q);
 return fence.acceptPage(epoch,ticket,result);
}
test('corpus is stable, scoped and product Writer remains unavailable',()=>{
 assert.equal(FIXTURE_PROTOCOL,'timekeeper.web.projection-negatives@1');
 assert.equal(PROJECTION_TRANSPORT_LIMITS.maxRows,200);
 assert.equal(PROJECTION_TRANSPORT_LIMITS.maxRowBytes,65536);
 assert.equal(PROJECTION_TRANSPORT_LIMITS.maxPageBytes,2097152);
 assert.equal(PROJECTION_TRANSPORT_LIMITS.maxCursorChars,512);
 assert.equal(identity().capabilities.ENCODE_COPY.state,'DENIED');
 assert.equal(identity().capabilities.PERSISTENT_REPLACE.state,'DENIED');
 assert.equal(new Set(RESPONSE_NEGATIVES.map(x=>x.id)).size,RESPONSE_NEGATIVES.length);
 assert.equal(new Set(SEQUENTIAL_NEGATIVES).size,SEQUENTIAL_NEGATIVES.length);
});
for(const fixture of RESPONSE_NEGATIVES){
 test('05 QR response negative '+fixture.id+' — '+fixture.reason,()=>{
  const {fence,epoch,id}=init();
  const q=query(id);
  const forged=fixture.mutate(page(id));
  assert.throws(()=>send(fence,epoch,q,forged),
   new RegExp(fixture.expected??'INVALID_BOUNDED_PROJECTION'));
  // A rejected reply never becomes an accepted next-page continuation.
  assert.throws(()=>fence.issuePageQuery(epoch,query(id,'fabricated')),
   /OUT_OF_ORDER_CURSOR/);
 });
}
test('05 QR cursor NEXT_CURSOR_REPLAY / LOOP / WRONG_ORDER',()=>{
 const {fence,epoch,id}=init();
 const q=query(id);
 assert.equal(send(fence,epoch,q,page(id,[{eventId:1}],false,'cursor-one')).nextCursor,'cursor-one');
 assert.throws(()=>fence.issuePageQuery(epoch,query(id,'cursor-other')),/OUT_OF_ORDER_CURSOR/);
 const next=query(id,'cursor-one');
 assert.throws(()=>send(fence,epoch,next,page(id,[{eventId:2}],false,'cursor-one')),
  /INVALID_BOUNDED_PROJECTION/);
 assert.equal(send(fence,epoch,next,page(id,[{eventId:2}],false,'cursor-two')).nextCursor,'cursor-two');
 assert.throws(()=>fence.issuePageQuery(epoch,query(id,'cursor-one')),/OUT_OF_ORDER_CURSOR/);
 assert.throws(()=>send(fence,epoch,query(id,'cursor-two'),page(id,[{eventId:3}],false,'cursor-one')),
  /INVALID_BOUNDED_PROJECTION/);
 assert.equal(send(fence,epoch,query(id,'cursor-two'),page(id,[{eventId:3}])).complete,true);
 assert.throws(()=>fence.issuePageQuery(epoch,query(id,'cursor-two')),/OUT_OF_ORDER_CURSOR/);
});
test('05 QR SORT_CHANGED / filters-bound scope isolation',()=>{
 const {fence,epoch,id}=init();
 send(fence,epoch,query(id),page(id,[{eventId:1}],false,'next'));
 assert.throws(()=>fence.issuePageQuery(epoch,{...query(id,'next'),sort:'time'}),/OUT_OF_ORDER_CURSOR/);
 assert.throws(()=>fence.issuePageQuery(epoch,{...query(id,'next'),filters:{area:'Forest'}}),/OUT_OF_ORDER_CURSOR/);
 assert.equal(send(fence,epoch,query(id,'next'),page(id)).complete,true);
});
test('05 QR OLD_GENERATION_AFTER_FILE_SWITCH / source CAS',()=>{
 const {fence,epoch,id}=init();
 const pending=fence.issuePageQuery(epoch,query(id));
 const opened=fence.beginOpen();
 const replacement=identity({sessionKey:'core-session-B',generation:2,originalSha256:'a'.repeat(64)});
 fence.acceptOpen(opened,replacement);
 assert.throws(()=>fence.acceptPage(epoch,pending,page(id)),/STALE_PROJECTION/);
 assert.equal(send(fence,opened,query(replacement),page(replacement)).complete,true);
});
test('05 QR OLD_REVISION_AFTER_UNDO / REDO (Core-issued revisions only)',()=>{
 const {fence,epoch,id}=init();
 const stale=fence.issuePageQuery(epoch,query(id));
 const afterUndo=fence.acceptRevision(epoch,id,{...id,revision:1});
 assert.throws(()=>fence.acceptPage(epoch,stale,page(id)),/STALE_PROJECTION/);
 const staleRedo=fence.issuePageQuery(epoch,query(afterUndo));
 const afterRedo=fence.acceptRevision(epoch,afterUndo,{...afterUndo,revision:2});
 assert.throws(()=>fence.acceptPage(epoch,staleRedo,page(afterUndo)),/STALE_PROJECTION/);
 assert.equal(send(fence,epoch,query(afterRedo),page(afterRedo)).complete,true);
});
test('05 QR CONCURRENT_FIRST_PAGE_REPLACEMENT / DUPLICATE_RESPONSE',()=>{
 const {fence,epoch,id}=init();
 const old=fence.issuePageQuery(epoch,query(id));
 const newer=fence.issuePageQuery(epoch,query(id));
 assert.throws(()=>fence.acceptPage(epoch,old,page(id)),/STALE_PROJECTION/);
 assert.equal(fence.acceptPage(epoch,newer,page(id)).complete,true);
 assert.throws(()=>fence.acceptPage(epoch,newer,page(id)),/STALE_PROJECTION/);
});
test('05 QR accepted compact rows for Grid / Inventory / Quest across domains',()=>{
 const {fence,epoch,id}=init();
 for(const [domain,view,row] of [
  ['world-grid','grid-summary',{gridId:'G',objectCount:999999,loaded:false}],
  ['inventory','slot',{inventoryId:'I',slot:10,itemId:31700014,quantity:999}],
  ['quests','summary',{questId:7,status:'ACTIVE',dependencyCount:100000}]]){
  assert.equal(send(fence,epoch,query(id,null,200,domain,view),
   page(id,[row],true,null,domain,view)).complete,true);
 }
});
