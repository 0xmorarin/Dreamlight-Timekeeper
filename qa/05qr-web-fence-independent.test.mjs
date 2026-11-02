// Independent read-only typed session fence negative coverage for WEB PR24.
// A UI-side fence is a second-line rejection filter, never an auth authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionResponseFence} from '../src/lib/timekeeper/session-response-fence.mjs';
const sha='abcdef0123456789'.repeat(4);
function identity(){
 return {sessionKey:'sessionA',generation:12,revision:0,
  originalSha256:sha,schema:626,origin:'local-file',
  capabilities:{READ:{state:'AVAILABLE',evidence:'CONFIRMED'},
    ENCODE_COPY:{state:'DENIED',evidence:'BLOCKED'},
    PERSISTENT_REPLACE:{state:'DENIED',evidence:'BLOCKED'}}};
}
test('05QR WEB: old revision, schema and another open generation cannot project into one Session',()=>{
 const fence=createSessionResponseFence({maxPageSize:3});
 const e=fence.beginOpen();const id=fence.acceptOpen(e,identity());
 const query={identity:id,domain:'timing',page:{limit:2}};
 const ok={identity:id,domain:'timing',revision:0,complete:true,nextCursor:null,rows:[{id:1}]};
 assert.deepEqual(fence.acceptPage(e,query,ok).rows,[{id:1}]);
 for(const bad of [{...ok,identity:{...id,originalSha256:'0'.repeat(64)}},
    {...ok,identity:{...id,schema:627}},{...ok,revision:1}])
  assert.throws(()=>fence.acceptPage(e,query,bad),/STALE_PROJECTION/);
 fence.beginOpen();
 assert.throws(()=>fence.acceptResult(e,id),/STALE_SESSION_RESPONSE/);
});
test('05QR WEB: new revision is core-issued only, persistent permission increase is denied',()=>{
 const f=createSessionResponseFence();const e=f.beginOpen(),id=f.acceptOpen(e,identity());
 const upgraded={...id,revision:1};
 const out=f.acceptRevision(e,id,upgraded);
 assert.equal(out.revision,1);
 assert.throws(()=>f.acceptRevision(e,id,{...upgraded,revision:2}),/STALE_CHANGESET/);
 assert.throws(()=>f.acceptRevision(e,out,
  {...out,revision:2,capabilities:{...id.capabilities,PERSISTENT_REPLACE:{state:'AVAILABLE',evidence:'CONFIRMED'}}}),
  /SESSION_CORE_IDENTITY_INVALID/);
});
test('05QR WEB: row-count cap does not bound byte size or prove opaque data minimization',()=>{
 const f=createSessionResponseFence({maxPageSize:1});
 const e=f.beginOpen(),id=f.acceptOpen(e,identity());
 const query={identity:id,domain:'timing',page:{limit:1}};
 const huge={identity:id,domain:'timing',revision:0,complete:true,nextCursor:'x',
   rows:[{opaque:'Q'.repeat(700_000)}]};
 // Current fence checks rows.length <= limit, not individual row byte size.
 // It is a known product resource/privacy gate, not an independent PASS.
 assert.equal(f.acceptPage(e,query,huge).rows[0].opaque.length,700_000);
 assert.equal(huge.complete,true);
 assert.equal(huge.nextCursor,'x');
});
