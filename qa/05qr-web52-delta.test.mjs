// Independent 05 QR source/bridge delta only, frozen WEB52 HEAD.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createProspectiveCoreReadWorkerBridge} from '../src/lib/timekeeper/core-read-worker-bridge.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const base='b4450e0e847fd93670c3461312c5911387e483fb';
const web='907e7cd4ac36c1166d974d46e0da39e3bee360de';
test('QR WEB52 exactly 11 files against PR48, Worker only 7 extra lines and no actual Core binding',async()=>{
 const files=git('diff','--name-only',base,web).split('\n').sort();
 assert.deepEqual(files,[
 '.github/workflows/web-readonly-rc-validate-v1.yml',
 'contracts/web-readonly-core-worker-v1.json',
 'scripts/audit-web-compiled-egress.mjs',
 'scripts/verify-web-compiled-reproducibility.mjs',
 'src/lib/timekeeper/core-read-worker-bridge.mjs',
 'src/lib/timekeeper/model.ts','src/worker.mjs','svelte.config.js',
 'tests/browser-sveltekit-readonly-text-rc.smoke.mjs',
 'tests/web-compiled-egress-review.test.mjs','tests/web-core-read-bridge.test.mjs'
 ].sort());
 const worker=await readFile(new URL('../src/worker.mjs',import.meta.url),'utf8');
 const bridge=await readFile(new URL('../src/lib/timekeeper/core-read-worker-bridge.mjs',import.meta.url),'utf8');
 assert(worker.includes("if(data.type==='queryPage')"));
 assert(worker.includes("throw Error('CORE_READ_ABI_NOT_ACCEPTED')"));
 assert(worker.includes("if(READONLY_TEXT_RC_BUILD)throw Error('RC_READ_ONLY_WRITER_DISABLED')"));
 assert(!worker.includes('createProspectiveCoreReadWorkerBridge'));
 assert(bridge.includes('rustProductInstalled:false,writerAuthorized:false'));
});
const roots=(rev=0)=>({
 encryptedOriginalP1gSha256:'a'.repeat(64),decodedJsonSha256:'b'.repeat(64),
 registrySha256:'c'.repeat(64),sessionKey:'core-private',generation:1,
 revision:rev,indexGeneration:0,schema:626,
 build:{platform:'Switch',version:'1.25.3',externalBid:'9A239D3DB569756D',bidBoundToSave:false}
});
const input=(cursor=null,overrides={})=>({domain:'timing',view:'events',limit:5,
 filters:{area:'Forest'},sort:'id',cursor,...overrides});
const p=(src,nextCursor,complete=false)=>({domain:'timing',view:'events',
 rows:[{id:1}],nextCursor,complete});
test('QR WEB52 research bridge refuses fabricated UI identity, malformed query scope before touching private Core',async()=>{
 let touches=0,closed=0;
 const core={openLocal:async()=>roots(),queryIndexedPage:async()=>{touches++;return{roots:roots(),page:p(roots(),null,true)}},
 verifyIndexedPage:()=>true,close:()=>{closed++;}};
 const b=createProspectiveCoreReadWorkerBridge({core});await b.openLocal({});
 for(const extra of [
  {sourceSha256:'a'.repeat(64)},{sessionKey:'fake'},{revision:1},
  {capabilities:{READ:true}},{complete:true},{referenceGraph:{all:true}},
  {coreVerified:true},{indexGeneration:20},{cursor:'f'.repeat(513)},
  {domain:'wrong'},{filters:{nested:{complete:true}}}
 ]){
  await assert.rejects(b.queryPage(input(null,extra)),/READ_WORKER_UNTRUSTED_QUERY/);
 }
 assert.equal(touches,0);
 assert.equal(b.rustProductInstalled,false);
 assert.equal(b.writerAuthorized,false);
 assert(!('prepareEdited' in b)&&!('encodeCopy' in b));
 assert(closed>=1);
});
test('QR WEB52 accepted private witness must refuse invalid Core proof of Complete and expire whole session',async()=>{
 let closed=0;
 const core={openLocal:async()=>roots(),queryIndexedPage:async intent=>({
  roots:roots(),page:p(roots(),'attacker-core-cursor',false)}),
 verifyIndexedPage:async()=>false,close:()=>{closed++;}};
 const b=createProspectiveCoreReadWorkerBridge({core});await b.openLocal({});
 await assert.rejects(b.queryPage(input()),/CORE_PAGE_AUTHORITY_REJECTED/);
 await assert.rejects(b.queryPage(input()),/CORE_READ_SESSION_NOT_READY/);
 assert(closed>=2);
});
test('QR WEB52 expiry is Core-owned; a transport-only Cursor scope check does not prove expiry',async()=>{
 let next=true;
 const core={openLocal:async()=>roots(),
 queryIndexedPage:async intent=>({roots:roots(),page:p(roots(),next?'nonce123':null,!next)}),
 verifyIndexedPage:async intent=>intent.cursor===null,close:()=>{}};
 const b=createProspectiveCoreReadWorkerBridge({core});await b.openLocal({});
 const first=await b.queryPage(input());assert.equal(first.nextCursor,'nonce123');
 await assert.rejects(b.queryPage(input('nonce123')),/CORE_PAGE_AUTHORITY_REJECTED/);
 await assert.rejects(b.queryPage(input('nonce123')),/CORE_READ_SESSION_NOT_READY/);
});
test('QR WEB52 worker bridge zero partial results on an oversized 64KiB row despite fake Core yes',async()=>{
 const core={openLocal:async()=>roots(),queryIndexedPage:async()=>({roots:roots(),
 page:{domain:'timing',view:'events',rows:[{text:'é'.repeat(33000)}],
  complete:true,nextCursor:null}}),verifyIndexedPage:async()=>true,close:()=>{}};
 const b=createProspectiveCoreReadWorkerBridge({core});await b.openLocal({});
 await assert.rejects(b.queryPage(input()),/WORKER_PROJECTION_BYTES_REJECTED/);
 await assert.rejects(b.queryPage(input()),/CORE_READ_SESSION_NOT_READY/);
});

test('QR WEB52 delayed Core query from File A cannot contaminate File B session',async()=>{
 let releaseA;
 const delayed=new Promise(resolve=>{releaseA=resolve;});
 let opened=0,queries=0,active;
 const core={
  openLocal:async()=>{active={...roots(),generation:++opened,sessionKey:'File-'+opened};return active;},
  queryIndexedPage:async()=>++queries===1?delayed:{
   roots:active,page:{domain:'timing',view:'events',rows:[{id:'B'}],complete:true,nextCursor:null}
  },
  verifyIndexedPage:async()=>true,close:()=>{}
 };
 const b=createProspectiveCoreReadWorkerBridge({core});
 const a=await b.openLocal({name:'File A'});
 const pending=b.queryPage(input());
 const bRoots=await b.openLocal({name:'File B'});
 assert.notEqual(a.sessionKey,bRoots.sessionKey);
 releaseA({roots:a,page:{domain:'timing',view:'events',rows:[{id:'A'}],
   complete:true,nextCursor:null}});
 await assert.rejects(pending,/STALE_CORE_PAGE/);
 const current=await b.queryPage(input());
 assert.equal(current.rows[0].id,'B');
});
test('QR WEB52 delayed positive verifier result after File B replacement is stale and cannot emit rows',async()=>{
 let resolveVerifier;
 const held=new Promise(resolve=>{resolveVerifier=resolve;});
 let opened=0,verifyCount=0,active;
 const core={
  openLocal:async()=>{active={...roots(),generation:++opened,sessionKey:'File-'+opened};return active;},
  queryIndexedPage:async()=>({roots:active,page:{domain:'timing',view:'events',
   rows:[{id:active.sessionKey}],complete:true,nextCursor:null}}),
  verifyIndexedPage:async()=>++verifyCount===1?held:true,close:()=>{}
 };
 const b=createProspectiveCoreReadWorkerBridge({core});
 await b.openLocal({name:'File A'});
 const pending=b.queryPage(input());
 await new Promise(resolve=>setImmediate(resolve));
 await b.openLocal({name:'File B'});
 resolveVerifier(true);
 await assert.rejects(pending,/STALE_CORE_PAGE/);
 const fresh=await b.queryPage(input());
 assert.equal(fresh.rows[0].id,'File-2');
});
test('QR WEB52 cursor reuse and altered filter/query scope are denied before private Core',async()=>{
 let n=0,active;
 const core={
  openLocal:async()=>{active=roots();return active;},
  queryIndexedPage:async intent=>{n++;return{roots:active,page:{
   domain:'timing',view:'events',rows:[{id:n}],
   complete:intent.cursor!==null,nextCursor:intent.cursor===null?'core-minted-opaque':null
  }};},
  verifyIndexedPage:async()=>true,close:()=>{}
 };
 const b=createProspectiveCoreReadWorkerBridge({core});await b.openLocal({});
 const first=await b.queryPage(input());
 assert.equal(first.nextCursor,'core-minted-opaque');
 for(const altered of [input('made-up'),input('core-minted-opaque',{view:'other'}),
  input('core-minted-opaque',{limit:2}),input('core-minted-opaque',{filters:{area:'other'}})]){
  await assert.rejects(b.queryPage(altered),/CORE_CURSOR_SCOPE_OR_SEQUENCE_INVALID/);
 }
 assert.equal(n,1,'untrusted query touched private Core');
 const last=await b.queryPage(input('core-minted-opaque'));
 assert.equal(last.complete,true);assert.equal(last.nextCursor,null);
 await assert.rejects(b.queryPage(input('core-minted-opaque')),/CORE_CURSOR_REPLAY/);
 assert.equal(n,2);
});
