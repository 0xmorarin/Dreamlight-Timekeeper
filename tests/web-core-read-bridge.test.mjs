import test from 'node:test';
import assert from 'node:assert/strict';
import {createProspectiveCoreReadWorkerBridge,CORE_READ_BRIDGE} from '../src/lib/timekeeper/core-read-worker-bridge.mjs';
const original='a'.repeat(64),decoded='b'.repeat(64),registry='c'.repeat(64);
const roots=(overrides={})=>({
 encryptedOriginalP1gSha256:original,decodedJsonSha256:decoded,registrySha256:registry,
 sessionKey:'private-session-1',generation:1,revision:0,indexGeneration:0,schema:626,
 build:{platform:'Switch',version:'1.25.3',externalBid:'9A239D3DB569756D',bidBoundToSave:false},
 ...overrides
});
const request=(cursor=null)=>({domain:'timing',view:'summary',limit:2,cursor,filters:{area:'valley'},sort:'id'});
const makeCore=({verify=()=>true,produce=null}={})=>{
 let opened=0,closed=0,source=roots();
 return {
  state:()=>({opened,closed}),
  openLocal:async()=>{opened++;source=roots({generation:opened});return source;},
  queryIndexedPage:async intent=>produce?produce(intent,source):{
   roots:source,page:{domain:intent.domain,view:intent.view,rows:[{id:7}],
    complete:intent.cursor!==null,nextCursor:intent.cursor===null?'private-cursor':null}
  },
  verifyIndexedPage:verify,
  close:()=>{closed++;}
 };
};
test('research READ bridge is not product wired and exposes no writer, history, cursor mint or graph',()=>{
 const core=makeCore();const port=createProspectiveCoreReadWorkerBridge({core});
 assert.equal(port.contract,CORE_READ_BRIDGE);
 assert.equal(port.rustProductInstalled,false);
 assert.equal(port.writerAuthorized,false);
 for(const k of ['encodeCopy','prepareEdited','setCapability','setRevision','issueCursor','setReferenceGraph'])
  assert.equal(k in port,false);
});
test('trusted Core must privately mint and verify opaque cursor; first and last pages pass bounded egress',async()=>{
 const core=makeCore();const port=createProspectiveCoreReadWorkerBridge({core});
 const id=await port.openLocal({type:'synthetic-file'});
 assert.equal(id.schema,626);
 assert.equal(id.build.bidBoundToSave,false);
 const first=await port.queryPage(request());
 assert.equal(first.complete,false);assert.equal(first.nextCursor,'private-cursor');
 const second=await port.queryPage(request(first.nextCursor));
 assert.equal(second.complete,true);assert.equal(second.nextCursor,null);
 await assert.rejects(port.queryPage(request('private-cursor')),/CORE_CURSOR_REPLAY/);
 port.close();assert(core.state().closed>=2);
});
test('UI-supplied source identities, fake references, complete, capabilities and unsafe filters rejected',async()=>{
 const port=createProspectiveCoreReadWorkerBridge({core:makeCore()});await port.openLocal({});
 for(const extra of [{identity:roots()},{references:[{from:'x',to:'y'}]},{complete:true},
  {capabilities:{READ:'AVAILABLE'}},{indexGeneration:55},{revision:1}]){
  await assert.rejects(port.queryPage({...request(),...extra}),/READ_WORKER_UNTRUSTED_QUERY/);
 }
 for(const extra of [{limit:201},{domain:'unknown'},{cursor:'x'.repeat(513)},
  {filters:{k:Infinity}},{filters:{__proto__:123,valid:()=>5}}]){
  await assert.rejects(port.queryPage({...request(),...extra}),/READ_WORKER_UNTRUSTED_QUERY/);
 }
});
test('core verifier rejects plausible fake Complete/Cursor even when UI structure would accept',async()=>{
 const core=makeCore({verify:()=>false,produce:intent=>({
  roots:roots({generation:1}),
  page:{domain:intent.domain,view:intent.view,rows:[{id:1}],complete:true,nextCursor:null}
 })});
 const port=createProspectiveCoreReadWorkerBridge({core});await port.openLocal({});
 await assert.rejects(port.queryPage(request()),/CORE_PAGE_AUTHORITY_REJECTED/);
});
test('CORE root drift and index/revision mutation deny every page and permit no partial output',async()=>{
 for(const change of [{revision:1},{indexGeneration:1},{sessionKey:'other'},{encryptedOriginalP1gSha256:'f'.repeat(64)}]){
  const port=createProspectiveCoreReadWorkerBridge({core:makeCore({produce:(intent,source)=>({
   roots:{...source,...change},page:{domain:intent.domain,view:intent.view,
    rows:[{id:1}],complete:true,nextCursor:null}
  })})});
  await port.openLocal({});
  await assert.rejects(port.queryPage(request()),/CORE_PAGE_SOURCE_OR_INDEX_STALE/);
 }
});
test('Producer sends nothing above 64 KiB/row, 2 MiB/page or 200 rows, even when fake Core approves',async()=>{
 const bads=[
  [{text:'界'.repeat(22000)}],
  Array.from({length:200},(_,i)=>({id:i,text:'x'.repeat(12000)})),
  Array.from({length:201},(_,i)=>({id:i}))
 ];
 for(const rows of bads){
  const port=createProspectiveCoreReadWorkerBridge({core:makeCore({produce:(intent,source)=>({
   roots:source,page:{domain:intent.domain,view:intent.view,rows,
    complete:true,nextCursor:null}
  })})});
  await port.openLocal({});
  await assert.rejects(port.queryPage({...request(),limit:200}),/WORKER_PROJECTION_(?:BYTES|ENVELOPE)_REJECTED/);
 }
});
test('A->B File switch drops delayed Core response without emitting it',async()=>{
 let resolveOld;
 const pOld=new Promise(r=>{resolveOld=r;});
 let counter=0;
 const core=makeCore({produce:(intent,source)=>{
  counter++;
  if(counter===1)return pOld;
  return {roots:source,page:{domain:intent.domain,view:intent.view,rows:[{id:'B'}],
    complete:true,nextCursor:null}};
 }});
 const port=createProspectiveCoreReadWorkerBridge({core});
 const a=await port.openLocal({name:'A'});
 const pending=port.queryPage(request());
 const b=await port.openLocal({name:'B'});
 assert.notEqual(a.generation,b.generation);
 resolveOld({roots:a,page:{domain:'timing',view:'summary',rows:[{id:'A'}],
  complete:true,nextCursor:null}});
 await assert.rejects(pending,/STALE_CORE_PAGE/);
 const page=await port.queryPage(request());assert.equal(page.rows[0].id,'B');
});
test('Undo/Redo Core revision invalidation requires reopen and cannot use stale cached page/cursor',async()=>{
 const core=makeCore();const port=createProspectiveCoreReadWorkerBridge({core});
 await port.openLocal({});
 const old=await port.queryPage(request());
 port.invalidate(); // Worker cancel after native revision/index changes
 await assert.rejects(port.queryPage(request(old.nextCursor)),/CORE_READ_SESSION_NOT_READY/);
 await port.openLocal({});
 const newer=await port.queryPage(request());
 assert.equal(newer.complete,false);
});
test('invalid CORE build/schema/root proof is never accepted for product READ',async()=>{
 const core=makeCore();
 core.openLocal=async()=>roots({build:{platform:'Switch',version:'1.25.3',externalBid:'',bidBoundToSave:false}});
 const port=createProspectiveCoreReadWorkerBridge({core});
 await assert.rejects(port.openLocal({}),/CORE_SOURCE_ROOTS_INVALID/);
});

test('transport preflight rejects forged, skipped, mismatched-scope and repeated cursors before touching Core',async()=>{
 let called=0;
 const core=makeCore();
 const query=core.queryIndexedPage.bind(core);
 core.queryIndexedPage=async(...args)=>{called++;return query(...args)};
 const port=createProspectiveCoreReadWorkerBridge({core});
 await port.openLocal({});
 await assert.rejects(port.queryPage(request('forged-never-issued')),/CORE_CURSOR_SCOPE_OR_SEQUENCE_INVALID/);
 assert.equal(called,0);
 const first=await port.queryPage(request());
 assert.equal(called,1);
 for(const mutated of [
  {...request(first.nextCursor),limit:1},
  {...request(first.nextCursor),filters:{area:'forest'}},
  {...request(first.nextCursor),sort:'time'},
  {...request(first.nextCursor),view:'other'},
  request('skipped-or-expired')
 ]){
  await assert.rejects(port.queryPage(mutated),/CORE_CURSOR_SCOPE_OR_SEQUENCE_INVALID/);
 }
 assert.equal(called,1);
 await port.queryPage(request(first.nextCursor));
 await assert.rejects(port.queryPage(request(first.nextCursor)),/CORE_CURSOR_REPLAY/);
 assert.equal(called,2);
});
test('CORE verifier false or producer overage clears session and requires private reopen',async()=>{
 const denied=createProspectiveCoreReadWorkerBridge({core:makeCore({verify:()=>false})});
 await denied.openLocal({});
 await assert.rejects(denied.queryPage(request()),/CORE_PAGE_AUTHORITY_REJECTED/);
 await assert.rejects(denied.queryPage(request()),/CORE_READ_SESSION_NOT_READY/);
 const oversized=createProspectiveCoreReadWorkerBridge({core:makeCore({produce:(intent,source)=>({
  roots:source,page:{domain:intent.domain,view:intent.view,
   rows:[{giant:'界'.repeat(22000)}],complete:true,nextCursor:null}
 })})});
 await oversized.openLocal({});
 await assert.rejects(oversized.queryPage(request()),/WORKER_PROJECTION_BYTES_REJECTED/);
 await assert.rejects(oversized.queryPage(request()),/CORE_READ_SESSION_NOT_READY/);
});
test('new file during delayed verifier result invalidates old page (not just delayed query)',async()=>{
 let resolveVerify;
 const verifier=new Promise(resolve=>resolveVerify=resolve);
 let call=0;
 const core=makeCore({verify:async()=>{call++;return call===1?verifier:true}});
 const port=createProspectiveCoreReadWorkerBridge({core});
 await port.openLocal({name:'A'});
 const oldPage=port.queryPage(request());
 // Allow queryIndexedPage and async verifier to advance before switching.
 await new Promise(r=>setImmediate(r));
 await port.openLocal({name:'B'});
 resolveVerify(true);
 await assert.rejects(oldPage,/STALE_CORE_PAGE/);
 const result=await port.queryPage(request());
 assert.equal(result.rows.length,1);
});
