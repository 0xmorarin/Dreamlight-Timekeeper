// 03 WEB/CORE handoff: WORKER-INTERNAL READ adapter only, no product engine.
// This must never be instantiated from UI-provided Core, capabilities, graph,
// "complete" or cursor. Only the accepted Wand 01A Rust Worker can bind it.
// In this PR it is NOT imported by src/worker.mjs or compiled in the RC build.
import {rejectOversizeWorkerProjection} from './worker-projection-bounds.mjs';
export const CORE_READ_BRIDGE='timekeeper.core-read-bridge.proposal@1';
const hash=/^[a-f0-9]{64}$/;
const domainNames=new Set(['timing','inventory','collections','storage',
  'world-grid','rooms','progression','quests']);
const allowedIntent=new Set(['domain','view','limit','cursor','filters','sort']);
const own=(o,k)=>Object.hasOwn(o,k);
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 (Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const validRoots=r=>plain(r)&&
 ['encryptedOriginalP1gSha256','decodedJsonSha256','registrySha256'].every(k=>hash.test(r[k]))&&
 typeof r.sessionKey==='string'&&r.sessionKey.length>0&&r.sessionKey.length<=128&&
 ['generation','revision','indexGeneration','schema'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0)&&
 r.schema>0&&
 plain(r.build)&&r.build.platform==='Switch'&&typeof r.build.version==='string'&&
 typeof r.build.externalBid==='string'&&r.build.externalBid.length>0&&
 r.build.bidBoundToSave===false;
const rootsKey=r=>JSON.stringify([
 r.encryptedOriginalP1gSha256,r.decodedJsonSha256,r.registrySha256,
 r.sessionKey,r.generation,r.revision,r.indexGeneration,r.schema,
 r.build.platform,r.build.version,r.build.externalBid,r.build.bidBoundToSave
]);
function canonicalIntent(x){
 if(!plain(x)||Object.keys(x).some(k=>!allowedIntent.has(k))||
   !domainNames.has(x.domain)||typeof x.view!=='string'||!x.view||x.view.length>128||
   !Number.isSafeInteger(x.limit)||x.limit<1||x.limit>200||
   !(x.cursor===undefined||x.cursor===null||
     typeof x.cursor==='string'&&x.cursor.length>0&&x.cursor.length<=512)||
   x.sort!==undefined&&(typeof x.sort!=='string'||x.sort.length>128))
  throw Error('READ_WORKER_UNTRUSTED_QUERY');
 const filters=x.filters??{};
 if(!plain(filters)||Object.keys(filters).length>32)throw Error('READ_WORKER_UNTRUSTED_QUERY');
 const canonical={};
 for(const key of Object.keys(filters).sort()){
  const val=filters[key];
  if(!key||key.length>128||!['string','boolean','number'].includes(typeof val)||
    typeof val==='number'&&!Number.isFinite(val)||
    typeof val==='string'&&val.length>512)throw Error('READ_WORKER_UNTRUSTED_QUERY');
  canonical[key]=val;
 }
 return Object.freeze({domain:x.domain,view:x.view,limit:x.limit,
  cursor:x.cursor??null,filters:Object.freeze(canonical),sort:x.sort??''});
}
/** The core object is a *private trusted Rust/WASM port* supplied by the
 * Worker module, never by the serialized UI request. In this review-only
 * source we simulate it for tests; no authoritative Core is installed.
 *
 * Required Core methods:
 *   openLocal(File) -> immutable ReadRoots (includes SHA/session/index)
 *   queryIndexedPage(intent, expectedRoots) -> {roots,page}
 *   verifyIndexedPage(intent,page,expectedRoots) -> true ONLY after authentic
 *     cursor consume, reference/index completeness, full count and SHA checks.
 *   close() -> destroys all Core session/cursors.
 *
 * No write, export, graph mutation, Cursor issue, or revision increment exposed.
 */
export function createProspectiveCoreReadWorkerBridge({core}={}){
 if(!core||['openLocal','queryIndexedPage','verifyIndexedPage','close'].some(k=>typeof core[k]!=='function'))
  throw Error('CORE_READ_PRIVATE_PORT_REQUIRED');
 let epoch=0,active=null,seen=new Set(),busy=false;
 const invalidate=()=>{
  epoch++;active=null;seen.clear();busy=false;
  core.close();
 };
 const openLocal=async file=>{
  invalidate();const run=epoch;
  const roots=await core.openLocal(file);
  if(run!==epoch)throw Error('STALE_CORE_OPEN');
  if(!validRoots(roots))throw Error('CORE_SOURCE_ROOTS_INVALID');
  active=Object.freeze({...roots,build:Object.freeze({...roots.build})});
  return active;
 };
 const queryPage=async input=>{
  if(!active||busy)throw Error('CORE_READ_SESSION_NOT_READY');
  const intent=canonicalIntent(input);
  const cursor=intent.cursor;
  if(cursor!==null&&seen.has(cursor))throw Error('CORE_CURSOR_REPLAY');
  busy=true;
  const run=epoch,expected=active,key=rootsKey(expected);
  try{
   // Core *must* verify the Cursor itself; our local history is only a
   // supplementary transport replay guard.
   const reply=await core.queryIndexedPage(intent,expected);
   if(run!==epoch||!active||rootsKey(active)!==key)throw Error('STALE_CORE_PAGE');
   if(!plain(reply)||!validRoots(reply.roots)||rootsKey(reply.roots)!==key)
    throw Error('CORE_PAGE_SOURCE_OR_INDEX_STALE');
   const page=reply.page;
   if(!plain(page)||page.domain!==intent.domain||page.view!==intent.view)
    throw Error('CORE_PAGE_SCOPE_INVALID');
   // This call MUST prove full-domain enumeration, actual Next cursor mint,
   // validated reference graph and true Complete. A UI proof flag is forbidden.
   if(await core.verifyIndexedPage(intent,page,expected)!==true)
    throw Error('CORE_PAGE_AUTHORITY_REJECTED');
   if(run!==epoch||!active||rootsKey(active)!==key)throw Error('STALE_CORE_PAGE');
   if(cursor!==null)seen.add(cursor);
   // Must be done before a Worker postMessage; metadata counts toward budget.
   rejectOversizeWorkerProjection(page,{requestedLimit:intent.limit});
   if(page.nextCursor!==null&&seen.has(page.nextCursor))
    throw Error('CORE_CURSOR_REPLAY');
   // The caller may emit this bounded page only after all checks.
   return page;
  }finally{if(run===epoch)busy=false;}
 };
 return Object.freeze({
  contract:CORE_READ_BRIDGE,openLocal,queryPage,invalidate,close:invalidate,
  // Explicitly NO semantic edit/encode/history/capability setter.
  rustProductInstalled:false,writerAuthorized:false
 });
}
