// 05 QR independent WEB27 fixed-HEAD acceptance, synthetic transport only.
// This deliberately bypasses developer-owned tests and tests true public API.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionResponseFence,PROJECTION_TRANSPORT_LIMITS} from '../src/lib/timekeeper/session-response-fence.mjs';
const sha='a'.repeat(64);
const identity=(sessionKey='A',revision=0)=>({
 sessionKey,generation:1,revision,originalSha256:sha,schema:626,origin:'local-file',
 capabilities:{
  READ:{state:'AVAILABLE',evidence:'CONFIRMED'},
  ENCODE_COPY:{state:'DENIED',evidence:'BLOCKED'},
  PERSISTENT_REPLACE:{state:'DENIED',evidence:'BLOCKED'}
 }
});
const open=()=>{const fence=createSessionResponseFence(),e=fence.beginOpen(),id=fence.acceptOpen(e,identity());return {fence,e,id};};
const ask=(id,cursor=null,limit=200)=>({identity:id,domain:'world-grid',view:'objects',
  filters:{area:'valley'},sort:'id',page:{limit,cursor}});
const result=(id,rows=[{id:1}],complete=true,nextCursor=null)=>({
 identity:id,domain:'world-grid',view:'objects',revision:id.revision,rows,complete,nextCursor
});
const send=(f,e,id,rows,complete=true,nextCursor=null,cursor=null)=>
 f.acceptPage(e,f.issuePageQuery(e,ask(id,cursor)),result(id,rows,complete,nextCursor));
test('QR27: independent UTF-8 row and cumulative 2MiB cap',()=>{
 assert.equal(PROJECTION_TRANSPORT_LIMITS.maxRowBytes,65536);
 assert.equal(PROJECTION_TRANSPORT_LIMITS.maxPageBytes,2097152);
 const {fence:f,e,id}=open();
 assert.throws(()=>send(f,e,id,[{s:'a'.repeat(700000)}]),/INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>send(f,e,id,[{s:'界'.repeat(22000)}]),/INVALID_BOUNDED_PROJECTION/);
 const lots=Array.from({length:200},(_,i)=>({index:i,content:'x'.repeat(11000)}));
 assert.throws(()=>send(f,e,id,lots),/INVALID_BOUNDED_PROJECTION/);
 assert.equal(send(f,e,id,[{value:'ok',counter:1}]).rows.length,1);
});
test('QR27: conflicting complete/cursor, empty unfinished and loop all DENIED',()=>{
 const {fence:f,e,id}=open();
 for(const [complete,nextCursor,rows] of [
  [true,'fake',[{id:1}]],
  [false,null,[{id:1}]],
  [false,'x',[]],
  [false,'x'.repeat(513),[{id:1}]]
 ])assert.throws(()=>send(f,e,id,rows,complete,nextCursor),/INVALID_BOUNDED_PROJECTION/);
 assert.equal(send(f,e,id,[{id:1}],false,'c1').nextCursor,'c1');
 assert.throws(()=>f.issuePageQuery(e,ask(id,'forged')),/OUT_OF_ORDER_CURSOR/);
 const q=f.issuePageQuery(e,ask(id,'c1'));
 assert.throws(()=>f.acceptPage(e,q,result(id,[{id:2}],false,'c1')),/INVALID_BOUNDED_PROJECTION/);
 // Request is single-use even after denial.
 assert.throws(()=>f.acceptPage(e,q,result(id,[{id:2}],false,'c2')),/STALE_PROJECTION/);
 assert.equal(send(f,e,id,[{id:2}],false,'c2','c1').nextCursor,'c2');
 assert.throws(()=>send(f,e,id,[{id:3}],false,'c1','c2'),/INVALID_BOUNDED_PROJECTION/);
 assert.equal(send(f,e,id,[{id:3}],true,null,'c2').complete,true);
});
test('QR27: stale in-flight responses across revision Undo/Redo and source switch',()=>{
 const {fence:f,e,id}=open();
 const pending=f.issuePageQuery(e,ask(id));
 const next=f.acceptRevision(e,id,{...id,revision:1});
 assert.throws(()=>f.acceptPage(e,pending,result(id)),/STALE_PROJECTION/);
 const pend2=f.issuePageQuery(e,ask(next));
 const undo=f.acceptRevision(e,next,{...id,revision:2});
 assert.throws(()=>f.acceptPage(e,pend2,result(next)),/STALE_PROJECTION/);
 const pend3=f.issuePageQuery(e,ask(undo));
 const redo=f.acceptRevision(e,undo,{...id,revision:3});
 assert.throws(()=>f.acceptPage(e,pend3,result(undo)),/STALE_PROJECTION/);
 const pend4=f.issuePageQuery(e,ask(redo));
 f.beginOpen();
 assert.throws(()=>f.acceptPage(e,pend4,result(redo)),/STALE_PROJECTION/);
 assert.throws(()=>f.acceptResult(e,redo),/STALE_SESSION_RESPONSE/);
});
test('QR27: unauthorized capability and incorrect source SHA rejected',()=>{
 const {fence:f,e,id}=open();
 const q=f.issuePageQuery(e,ask(id));
 assert.throws(()=>f.acceptPage(e,q,result({...id,originalSha256:'b'.repeat(64)})),/STALE_PROJECTION/);
 const q2=f.issuePageQuery(e,ask(id));
 assert.throws(()=>f.acceptPage(e,q2,result({...id,capabilities:{
  ...id.capabilities,PERSISTENT_REPLACE:{state:'AVAILABLE',evidence:'CONFIRMED'}
 }})),/STALE_PROJECTION/);
 assert.throws(()=>f.acceptRevision(e,id,{...id,revision:1,originalSha256:'b'.repeat(64)}),/INVALID_CORE_REVISION/);
 assert.throws(()=>f.acceptRevision(e,id,{...id,revision:1,capabilities:{
  ...id.capabilities,PERSISTENT_REPLACE:{state:'AVAILABLE',evidence:'CONFIRMED'}
 }}),/SESSION_CORE_IDENTITY_INVALID/);
});
test('QR27: UI accepts an invented next cursor issued by a fake Worker (remaining authority boundary)',()=>{
 const {fence:f,e,id}=open();
 // Only the real CORE Worker can prove a cursor is genuine and bound to the
 // session, filter, source SHA, index generation and query. UI alone cannot.
 const bogus='USER_CONTROLLED_NOT_CORE_SIGNED';
 const p=send(f,e,id,[{id:1}],false,bogus);
 assert.equal(p.nextCursor,bogus);
 assert.equal(send(f,e,id,[{id:2}],true,null,bogus).complete,true);
 // This is an expected UI limitation, not authorization.
 assert.equal(f.current().capabilities.PERSISTENT_REPLACE.state,'DENIED');
});
