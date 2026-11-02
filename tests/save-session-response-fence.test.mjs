import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionResponseFence} from '../src/lib/timekeeper/session-response-fence.mjs';
const sha='0123456789abcdef'.repeat(4);
const base=()=>({sessionKey:'core-issued-session',generation:1,revision:0,originalSha256:sha,schema:626,origin:'local-file',
 capabilities:{READ:{state:'AVAILABLE',evidence:'CONFIRMED'},ENCODE_COPY:{state:'DENIED',evidence:'UNKNOWN'},PERSISTENT_REPLACE:{state:'DENIED',evidence:'BLOCKED'}}});
const page=(identity,rows=[])=>({identity,domain:'timing',rows,revision:identity.revision,nextCursor:null,complete:true});
test('single Core-issued session: A→B stale open, old response rejected',()=>{
 const f=createSessionResponseFence();
 const a=f.beginOpen();const b=f.beginOpen();
 assert.throws(()=>f.acceptOpen(a,base()),/STALE_OPEN_RESULT/);
 const owned=f.acceptOpen(b,base());
 assert.equal(f.acceptResult(b,owned),true);
 f.invalidate();
 assert.equal(f.current(),null);
 assert.throws(()=>f.acceptResult(b,owned),/STALE_SESSION_RESPONSE/);
});
test('bounded page, cursor, schema/revision/source CAS cannot be forged',()=>{
 const f=createSessionResponseFence({maxPageSize:80});const ep=f.beginOpen(),id=f.acceptOpen(ep,base());
 const query={identity:id,domain:'timing',page:{limit:2}};
 assert.deepEqual(f.acceptPage(ep,query,page(id,[{pointer:'/A'}])).rows,[{pointer:'/A'}]);
 assert.throws(()=>f.acceptPage(ep,query,page(id,[{a:1},{b:2},{c:3}])),/INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>f.acceptPage(ep,{...query,page:{limit:201}},page(id)),/INVALID_BOUNDED_PROJECTION/);
 assert.throws(()=>f.acceptPage(ep,query,page({...id,originalSha256:'b'.repeat(64)})),/STALE_PROJECTION/);
 assert.throws(()=>f.acceptPage(ep,query,page({...id,revision:1})),/STALE_PROJECTION/);
});
test('only Worker/Core can issue rising revisions; capability escalation not accepted',()=>{
 const f=createSessionResponseFence(),ep=f.beginOpen(),id=f.acceptOpen(ep,base());
 assert.throws(()=>f.acceptRevision(ep,id,{...id,revision:0}),/INVALID_CORE_REVISION/);
 assert.throws(()=>f.acceptRevision(ep,id,{...id,revision:1,originalSha256:'b'.repeat(64)}),/INVALID_CORE_REVISION/);
 assert.throws(()=>f.acceptRevision(ep,id,{...id,revision:1,capabilities:{...id.capabilities,PERSISTENT_REPLACE:{state:'AVAILABLE',evidence:'UNKNOWN'}}}),/SESSION_CORE_IDENTITY_INVALID/);
 const next=f.acceptRevision(ep,id,{...id,revision:1});
 assert.equal(next.revision,1);
 assert.throws(()=>f.acceptResult(ep,id),/STALE_SESSION_RESPONSE/);
 assert.throws(()=>f.acceptRevision(ep,id,{...id,revision:2}),/STALE_CHANGESET/);
});
test('unknown/invalid identity and oversized cursor fail closed',()=>{
 const f=createSessionResponseFence();
 const ep=f.beginOpen();
 assert.throws(()=>f.acceptOpen(ep,{...base(),originalSha256:'not-sha'}),/SESSION_CORE_IDENTITY_INVALID/);
 const id=f.acceptOpen(ep,base());
 assert.throws(()=>f.acceptPage(ep,{identity:id,domain:'timing',page:{limit:3}},
  {...page(id),nextCursor:'x'.repeat(513)}),/INVALID_BOUNDED_PROJECTION/);
});
