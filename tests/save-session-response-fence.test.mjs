import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionResponseFence,PROJECTION_TRANSPORT_LIMITS as B} from '../src/lib/timekeeper/session-response-fence.mjs';
const sha='0123456789abcdef'.repeat(4);
const base=()=>({sessionKey:'core-issued-session',generation:1,revision:0,originalSha256:sha,schema:626,origin:'local-file',
 capabilities:{READ:{state:'AVAILABLE',evidence:'CONFIRMED'},ENCODE_COPY:{state:'DENIED',evidence:'UNKNOWN'},PERSISTENT_REPLACE:{state:'DENIED',evidence:'BLOCKED'}}});
const query=(identity,cursor=null,limit=2,domain='timing',view='events')=>
 ({identity,domain,view,page:{limit,cursor}});
const page=(identity,rows=[],complete=true,nextCursor=null,domain='timing',view='events')=>
 ({identity,domain,view,rows,revision:identity.revision,nextCursor,complete});
const send=(f,ep,q,result)=>f.acceptPage(ep,f.issuePageQuery(ep,q),result);
test('open A→B and stale source/result never cross file/session epochs',()=>{
 const f=createSessionResponseFence(),a=f.beginOpen(),b=f.beginOpen();
 assert.throws(()=>f.acceptOpen(a,base()),/STALE_OPEN_RESULT/);
 const id=f.acceptOpen(b,base());
 const pending=f.issuePageQuery(b,query(id));
 assert.equal(f.acceptResult(b,id),true);
 f.invalidate();
 assert.equal(f.current(),null);
 assert.throws(()=>f.acceptResult(b,id),/STALE_SESSION_RESPONSE/);
 assert.throws(()=>f.acceptPage(b,pending,page(id)),/STALE_PROJECTION/);
 const c=f.beginOpen(),idC=f.acceptOpen(c,{...base(),sessionKey:'C',originalSha256:'b'.repeat(64)});
 assert.equal(send(f,c,query(idC),page(idC)).complete,true);
 assert.throws(()=>f.acceptPage(c,pending,page(id)),/STALE_PROJECTION/);
});
test('single record, total response bytes and UTF-8 are bounded independently',()=>{
 assert.equal(B.maxRowBytes,65536);assert.equal(B.maxPageBytes,2097152);
 const f=createSessionResponseFence(),ep=f.beginOpen(),id=f.acceptOpen(ep,base());
 const q=query(id,null,200);
 assert.throws(()=>send(f,ep,q,page(id,[{grid:'x'.repeat(700000)}])),/INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>send(f,ep,q,page(id,[{text:'界'.repeat(22000)}])),/INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>send(f,ep,q,page(id,Array.from({length:200},(_,i)=>({i,quest:'q'.repeat(11500)})))),/INVALID_BOUNDED_PROJECTION/);
 assert.equal(send(f,ep,q,page(id,Array.from({length:20},(_,i)=>({gridId:i,inventory:{ids:[1,2],slots:[{itemId:31700014}]} }))))
  .rows.length,20);
 const cycle={};cycle.self=cycle;
 assert.throws(()=>send(f,ep,q,page(id,[cycle])),/INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>createSessionResponseFence({maxRowBytes:700000}),/INVALID_PAGE_BOUND/);
 assert.throws(()=>createSessionResponseFence({maxPageBytes:3000000}),/INVALID_PAGE_BOUND/);
});
test('complete/cursor contradiction, empty incomplete and cursor loops fail closed',()=>{
 const f=createSessionResponseFence(),ep=f.beginOpen(),id=f.acceptOpen(ep,base());
 const q=query(id);
 assert.throws(()=>send(f,ep,q,page(id,[{id:1}],true,'c1')), /INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>send(f,ep,q,{...page(id,[{id:1}]),nextCursor:undefined}),/INVALID_BOUNDED_PROJECTION/);
 const missingCursor=page(id,[{id:1}]);delete missingCursor.nextCursor;
 assert.throws(()=>send(f,ep,q,missingCursor),/INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>send(f,ep,q,page(id,[{id:1}],false,null)), /INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>send(f,ep,q,page(id,[],false,'c1')), /INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>send(f,ep,q,page(id,[{id:1}],false,'x'.repeat(513))),/INVALID_BOUNDED_PROJECTION/);
 assert.equal(send(f,ep,q,page(id,[{id:1}],false,'c1')).nextCursor,'c1');
 assert.throws(()=>f.issuePageQuery(ep,query(id,'wrong')),/OUT_OF_ORDER_CURSOR/);
 assert.throws(()=>send(f,ep,query(id,'c1'),page(id,[{id:2}],false,'c1')),/INVALID_BOUNDED_PROJECTION/);
 assert.equal(send(f,ep,query(id,'c1'),page(id,[{id:2}],false,'c2')).nextCursor,'c2');
 assert.throws(()=>send(f,ep,query(id,'c2'),page(id,[{id:3}],false,'c1')),/INVALID_BOUNDED_PROJECTION/);
 assert.equal(send(f,ep,query(id,'c2'),page(id,[{id:3}])).complete,true);
 assert.throws(()=>f.issuePageQuery(ep,query(id,'c2')),/OUT_OF_ORDER_CURSOR/);
});
test('out-of-order same-cursor responses, replays and different views are rejected',()=>{
 const f=createSessionResponseFence(),ep=f.beginOpen(),id=f.acceptOpen(ep,base());
 const first=f.issuePageQuery(ep,query(id));
 const replacement=f.issuePageQuery(ep,query(id));
 assert.throws(()=>f.acceptPage(ep,first,page(id)),/STALE_PROJECTION/);
 assert.equal(f.acceptPage(ep,replacement,page(id,[{id:1}],false,'next')).complete,false);
 assert.throws(()=>f.acceptPage(ep,replacement,page(id)),/STALE_PROJECTION/);
 const next=f.issuePageQuery(ep,query(id,'next'));
 assert.throws(()=>f.acceptPage(ep,next,page(id,[{id:2}],true,null,'inventory')),/INVALID_BOUNDED_PROJECTION/);
 assert.equal(send(f,ep,query(id,'next'),page(id,[{id:2}])).complete,true);
 assert.equal(send(f,ep,query(id,null,1,'world-grid','summary'),
    page(id,[{gridId:7,objectCount:500000}],true,null,'world-grid','summary')).complete,true);
});
test('source/session/revision, undo/redo and capability boundary reject stale replies',()=>{
 const f=createSessionResponseFence(),ep=f.beginOpen(),id=f.acceptOpen(ep,base());
 assert.throws(()=>send(f,ep,query(id),page({...id,originalSha256:'b'.repeat(64)})),/STALE_PROJECTION/);
 assert.throws(()=>send(f,ep,query(id),page({...id,revision:1})),/STALE_PROJECTION/);
 assert.throws(()=>send(f,ep,query(id),page({...id,capabilities:{...id.capabilities,ENCODE_COPY:{state:'AVAILABLE',evidence:'UNKNOWN'}}})),/STALE_PROJECTION/);
 const pending=f.issuePageQuery(ep,query(id));
 assert.throws(()=>f.acceptRevision(ep,id,{...id,revision:0}),/INVALID_CORE_REVISION/);
 assert.throws(()=>f.acceptRevision(ep,id,{...id,revision:1,originalSha256:'b'.repeat(64)}),/INVALID_CORE_REVISION/);
 assert.throws(()=>f.acceptRevision(ep,id,{...id,revision:1,capabilities:{...id.capabilities,PERSISTENT_REPLACE:{state:'AVAILABLE',evidence:'UNKNOWN'}}}),/SESSION_CORE_IDENTITY_INVALID/);
 const next=f.acceptRevision(ep,id,{...id,revision:1});
 assert.equal(next.revision,1);
 assert.throws(()=>f.acceptPage(ep,pending,page(id)),/STALE_PROJECTION/);
 assert.throws(()=>f.acceptResult(ep,id),/STALE_SESSION_RESPONSE/);
 assert.equal(send(f,ep,query(next),page(next,[{eventId:2010000021}])).complete,true);
 assert.throws(()=>f.acceptRevision(ep,id,{...id,revision:2}),/STALE_CHANGESET/);
});
test('invalid query/page geometry, Source fingerprint and malformed payloads fail closed',()=>{
 const f=createSessionResponseFence({maxPageSize:80}),ep=f.beginOpen();
 assert.throws(()=>f.acceptOpen(ep,{...base(),originalSha256:'not-sha'}),/SESSION_CORE_IDENTITY_INVALID/);
 assert.throws(()=>f.acceptOpen(ep,{...base(),capabilities:{READ:{state:'AVAILABLE',evidence:'CONFIRMED'}}}),/SESSION_CORE_IDENTITY_INVALID/);
 const id=f.acceptOpen(ep,base());
 assert.throws(()=>f.issuePageQuery(ep,query(id,null,201)),/INVALID_PAGE_QUERY/);
 assert.throws(()=>f.issuePageQuery(ep,query(id,'x'.repeat(513))),/INVALID_PAGE_CURSOR/);
 assert.throws(()=>f.issuePageQuery(ep,{...query(id),view:''}),/INVALID_PAGE_QUERY/);
 assert.throws(()=>send(f,ep,query(id),page(id,[null])),/INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>send(f,ep,query(id),page(id,[{counter:BigInt(1)}])),/INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>send(f,ep,query(id),page(id,[{number:Number.MAX_SAFE_INTEGER+1}])),/INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>send(f,ep,query(id),page(id,[{a:1},{b:2},{c:3}])),/INVALID_BOUNDED_PROJECTION/);
});
