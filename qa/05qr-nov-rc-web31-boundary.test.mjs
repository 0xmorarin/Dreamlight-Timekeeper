// 05 QR Nov RC: independent new WEB31 contract+corpus ONLY (not old WEB27 reacceptance).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSessionResponseFence} from '../src/lib/timekeeper/session-response-fence.mjs';
import {FIXTURE_PROTOCOL,identity,query,page,RESPONSE_NEGATIVES,SEQUENTIAL_NEGATIVES}
 from '../tests/fixtures/web-projection-negative-corpus.mjs';
const contract=JSON.parse(await readFile(new URL('../contracts/web-core-projection-boundary-v1.json',import.meta.url),'utf8'));
const open=()=>{const f=createSessionResponseFence(),e=f.beginOpen(),id=f.acceptOpen(e,identity());return {f,e,id};};
const send=(f,e,q,response)=>f.acceptPage(e,f.issuePageQuery(e,q),response);
test('QR31: contract asserts trusted producer NOT IMPLEMENTED, no writer or false indexed completion',()=>{
 assert.equal(contract.status,'PROPOSED_NOT_IMPLEMENTED_NOT_ACCEPTED');
 assert.equal(contract.wire.bindingInstalled,false);
 assert.equal(contract.wire.currentProductWorker,'timekeeper.save-worker@1');
 assert.equal(contract.limits.rowUtf8JsonBytesMax,65536);
 assert.equal(contract.limits.responseUtf8JsonBytesMax,2097152);
 assert.equal(contract.limits.counting.includes('BEFORE postMessage'),true);
 assert.equal(contract.acceptance.phaseB,'BLOCKED');
 assert.equal(contract.trust.allowUIReferenceGraph,false);
 assert.equal(contract.trust.allowUIWriterCapability,false);
 assert.equal(contract.trust.capabilities.ENCODE_COPY,'DENIED');
 assert.equal(contract.trust.capabilities.PERSISTENT_REPLACE,'DENIED');
 for(const scope of ['encrypted original P1G SHA256','revision','index generation','page limit','stable sort']){
  assert(contract.cursorProvenance.boundClaims.some(a=>a.includes(scope)),scope);
 }
 assert.equal(contract.response.completeCursorInvariant,'complete === (nextCursor === null)');
 assert.equal(contract.response.noUnprovenFullDomainCompletion,true);
});
test('QR31: new negative corpus has unique labels and 700KB/UTF8/aggregate payloads',()=>{
 assert.equal(FIXTURE_PROTOCOL,'timekeeper.web.projection-negatives@1');
 assert.equal(new Set(RESPONSE_NEGATIVES.map(x=>x.id)).size,RESPONSE_NEGATIVES.length);
 assert.equal(new Set(SEQUENTIAL_NEGATIVES).size,SEQUENTIAL_NEGATIVES.length);
 for(const k of ['ROW_700KB','ROW_MULTIBYTE','PAGE_SUM','COMPLETE_WITH_CURSOR',
  'INCOMPLETE_WITHOUT_CURSOR','CURSOR_ABSENT','SESSION_SWAP','SOURCE_SHA_SWAP','REVISION_STALE']){
  const fx=RESPONSE_NEGATIVES.find(x=>x.id===k);assert(fx,k);
  const {f,e,id}=open(),res=fx.mutate(page(id));
  assert.throws(()=>send(f,e,query(id),res),new RegExp(fx.expected??'INVALID_BOUNDED_PROJECTION'),k);
 }
});
test('QR31: new corpus rejects foreign sort/filter continuation, stale undo and source switch',()=>{
 const {f,e,id}=open();
 assert.equal(send(f,e,query(id),page(id,[{n:1}],false,'n1')).nextCursor,'n1');
 assert.throws(()=>f.issuePageQuery(e,{...query(id,'n1'),sort:'altered'}),/OUT_OF_ORDER_CURSOR/);
 assert.throws(()=>f.issuePageQuery(e,{...query(id,'n1'),filters:{area:'switched'}}),/OUT_OF_ORDER_CURSOR/);
 const q=f.issuePageQuery(e,query(id,'n1'));
 const updated=f.acceptRevision(e,id,{...id,revision:1});
 assert.throws(()=>f.acceptPage(e,q,page(id)),/STALE_PROJECTION/);
 const q2=f.issuePageQuery(e,query(updated));
 const redone=f.acceptRevision(e,updated,{...updated,revision:2});
 assert.throws(()=>f.acceptPage(e,q2,page(updated)),/STALE_PROJECTION/);
 f.invalidate();
 assert.throws(()=>send(f,e,query(redone),page(redone)),/STALE_PROJECTION/);
});
test('QR31: malicious fake producer can assert complete after partial rows (blocking trust gap)',()=>{
 const {f,e,id}=open();
 // A partial watch-list is NOT source-complete; UI cannot distinguish it.
 const forged=send(f,e,query(id),page(id,[{eventId:1}],true,null));
 assert.equal(forged.complete,true);
 assert.equal(contract.response.noUnprovenFullDomainCompletion,true);
 assert.equal(contract.acceptance.phaseB,'BLOCKED');
});
test('QR31: fake producer may issue syntactically valid opaque cursor, UI cannot authenticate',()=>{
 const {f,e,id}=open();
 const invented='NOT_CORE_ISSUED_123';
 assert.equal(send(f,e,query(id),page(id,[{eventId:1}],false,invented)).nextCursor,invented);
 assert.equal(send(f,e,query(id,invented),page(id,[{eventId:2}],true,null)).complete,true);
 assert.equal(contract.cursorProvenance.authority,'only trusted same Worker/CORE; never Svelte or arbitrary caller');
});
