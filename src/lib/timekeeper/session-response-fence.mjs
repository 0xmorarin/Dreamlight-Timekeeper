// UI-side *rejection only*: no revision mutation, Writer capabilities, SHA
// creation, or ChangeSet state ownership. Worker/CORE issues all identities.
const sha=/^[0-9a-f]{64}$/;
const fields=['sessionKey','generation','revision','originalSha256','schema','origin','capabilities'];
export const PROJECTION_TRANSPORT_LIMITS=Object.freeze({
 maxRows:200,maxRowBytes:65536,maxPageBytes:2097152,maxCursorChars:512,maxScopes:64,maxCursorHistory:16384
});
const domains=new Set(['timing','inventory','collections','storage','world-grid','rooms','progression','quests']);
const encoder=new TextEncoder();
// Estimate the exact UTF-8 JSON wire size without stringifying a whole Grid,
// Inventory or Quest tree. Reject non-JSON values, cycles and deep structures.
export function boundedJsonBytes(value,limit){
 let bytes=0,nodes=0;const ancestors=new WeakSet();
 const add=n=>{bytes+=n;if(bytes>limit)throw Error('PROJECTION_TOO_LARGE');};
 function visit(v,depth){
  if(++nodes>200000||depth>64)throw Error('INVALID_JSON_PROJECTION');
  if(v===null){add(4);return;}
  if(typeof v==='boolean'){add(v?4:5);return;}
  if(typeof v==='number'){
   if(!Number.isFinite(v)||Number.isInteger(v)&&!Number.isSafeInteger(v))
    throw Error('INVALID_JSON_PROJECTION');
   add(encoder.encode(String(v)).length);return;
  }
  if(typeof v==='string'){
   if(v.length>limit*2)throw Error('PROJECTION_TOO_LARGE');
   add(encoder.encode(JSON.stringify(v)).length);return;
  }
  if(typeof v!=='object'||ancestors.has(v)||
     !(Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype||
       Object.getPrototypeOf(v)===null))throw Error('INVALID_JSON_PROJECTION');
  ancestors.add(v);
  if(Array.isArray(v)){
   add(2);for(let i=0;i<v.length;i++){
    if(!(i in v))throw Error('INVALID_JSON_PROJECTION');
    if(i)add(1);visit(v[i],depth+1);
   }
  }else{
   add(2);const keys=Object.keys(v);
   for(let i=0;i<keys.length;i++){
    if(i)add(1);visit(keys[i],depth+1);add(1);visit(v[keys[i]],depth+1);
   }
  }
  ancestors.delete(v);
 }
 visit(value,0);return bytes;
}
function parseCursor(value){
 if(value===null||value===undefined)return null;
 if(typeof value!=='string'||!value||
    value.length>PROJECTION_TRANSPORT_LIMITS.maxCursorChars)throw Error('INVALID_PAGE_CURSOR');
 return value;
}
function scopeKey(query,maxPageSize){
 if(!query||!domains.has(query.domain)||typeof query.view!=='string'||
    !query.view||query.view.length>128||!query.page||
    !Number.isSafeInteger(query.page.limit)||query.page.limit<1||
    query.page.limit>maxPageSize||
    query.sort!==undefined&&(typeof query.sort!=='string'||query.sort.length>128))
  throw Error('INVALID_PAGE_QUERY');
 const filters=query.filters??{};
 if(!filters||typeof filters!=='object'||Array.isArray(filters)||
    Object.keys(filters).length>32)throw Error('INVALID_PAGE_QUERY');
 const normalized=Object.keys(filters).sort().map(k=>{
  const v=filters[k];
  if(k.length>128||!['string','number','boolean'].includes(typeof v)||
     typeof v==='number'&&!Number.isFinite(v)||
     typeof v==='string'&&v.length>512)throw Error('INVALID_PAGE_QUERY');
  return [k,v];
 });
 return JSON.stringify([query.domain,query.view,query.sort??'',normalized]);
}
function assertIdentity(x) {
 if(!x||typeof x!=='object'||fields.some(k=>!(k in x))||
    typeof x.sessionKey!=='string'||!x.sessionKey||x.sessionKey.length>128||
    !Number.isSafeInteger(x.generation)||x.generation<0||
    !Number.isSafeInteger(x.revision)||x.revision<0||
    !Number.isSafeInteger(x.schema)||x.schema<1||x.origin!=='local-file'||
    !sha.test(x.originalSha256)||!x.capabilities||
    x.capabilities.READ?.state!=='AVAILABLE'||
    ['READ','ENCODE_COPY','PERSISTENT_REPLACE'].some(k=>
     !x.capabilities[k]||!['AVAILABLE','DENIED','UNKNOWN'].includes(x.capabilities[k].state)||
     !['CONFIRMED','STATIC_ONLY','SYNTHETIC_TESTED','REAL_SAVE_READ_ONLY','RUNTIME_TESTED','UNKNOWN','BLOCKED'].includes(x.capabilities[k].evidence))||
    x.capabilities.PERSISTENT_REPLACE?.state==='AVAILABLE')
  throw new Error('SESSION_CORE_IDENTITY_INVALID');
 return x;
}
export function createSessionResponseFence({maxPageSize=200,maxRowBytes=65536,maxPageBytes=2097152}={}){
 if(!Number.isSafeInteger(maxPageSize)||maxPageSize<1||maxPageSize>200||
    !Number.isSafeInteger(maxRowBytes)||maxRowBytes<1||maxRowBytes>65536||
    !Number.isSafeInteger(maxPageBytes)||maxPageBytes<maxRowBytes||maxPageBytes>2097152)
  throw new TypeError('INVALID_PAGE_BOUND');
 let epoch=0,active=null,serial=0;
 const pages=new Map(),tickets=new WeakMap();
 const clearPages=()=>pages.clear();
 const invalidate=()=>{epoch++;active=null;clearPages();return epoch;};
 const beginOpen=()=>invalidate();
 const same=(id)=>{
  if(!active||!id)return false;
  return id.sessionKey===active.sessionKey&&
   id.generation===active.generation&&
   id.originalSha256===active.originalSha256&&
   id.schema===active.schema&&id.revision===active.revision&&
   id.origin===active.origin&&['READ','ENCODE_COPY','PERSISTENT_REPLACE'].every(k=>
    ['state','evidence','operation','reason'].every(p=>
     id.capabilities?.[k]?.[p]===active.capabilities?.[k]?.[p]));
 };
 const acceptOpen=(generation,id)=>{
  if(generation!==epoch||active)throw new Error('STALE_OPEN_RESULT');
  const good=assertIdentity(id);
  active=Object.freeze({...good,capabilities:Object.freeze(Object.fromEntries(
   ['READ','ENCODE_COPY','PERSISTENT_REPLACE'].map(k=>[k,Object.freeze({...good.capabilities[k]})])))});
  clearPages();
  return active;
 };
 // Dispatch registration is a transport correlation fence, never a source of
 // Core cursor, SHA, graph semantics or operation authority.
 const issuePageQuery=(generation,query)=>{
  if(generation!==epoch||!same(query?.identity))throw Error('STALE_PROJECTION');
  const key=scopeKey(query,maxPageSize),cursor=parseCursor(query.page.cursor);
  let state=pages.get(key);
  if(cursor===null){
   if(!state&&pages.size>=PROJECTION_TRANSPORT_LIMITS.maxScopes)
    throw Error('PROJECTION_SCOPE_LIMIT');
   state={next:null,complete:false,seen:new Set(),pending:0};
   pages.set(key,state); // First-page restart invalidates older pending work.
  }else if(!state||state.complete||state.next!==cursor||state.seen.has(cursor))
   throw Error('OUT_OF_ORDER_CURSOR');
  const request=Object.freeze({...query,page:Object.freeze({...query.page,cursor})});
  const number=++serial;
  state.pending=number;tickets.set(request,{epoch,key,cursor,number});
  return request;
 };
 const acceptPage=(generation,query,result)=>{
  const ticket=query&&tickets.get(query);
  if(generation!==epoch||!ticket||ticket.epoch!==epoch||
     !same(query.identity)||!same(result?.identity)||
     result.revision!==active.revision)throw Error('STALE_PROJECTION');
  tickets.delete(query); // No duplicate/replayed response.
  const state=pages.get(ticket.key);
  if(!state||state.pending!==ticket.number||
     ticket.cursor!==parseCursor(query.page.cursor))
   throw Error('STALE_PROJECTION');
  if(result.domain!==query.domain||result.view!==query.view||
     !Array.isArray(result.rows)||result.rows.length>query.page.limit||
     typeof result.complete!=='boolean'||!Object.hasOwn(result,'nextCursor')||
     result.nextCursor!==null&&typeof result.nextCursor!=='string')
   throw Error('INVALID_BOUNDED_PROJECTION');
  let next;
  try{next=parseCursor(result.nextCursor);}
  catch{throw Error('INVALID_BOUNDED_PROJECTION');}
  if(result.complete!==(next===null)||
     !result.complete&&result.rows.length===0||
     next!==null&&(next===ticket.cursor||state.seen.has(next)))
   throw Error('INVALID_BOUNDED_PROJECTION');
  try{
   for(const row of result.rows){
    if(row===null||typeof row!=='object'||Array.isArray(row))
     throw Error('INVALID_JSON_PROJECTION');
    boundedJsonBytes(row,maxRowBytes);
   }
   boundedJsonBytes(result,maxPageBytes); // Metadata counts towards total.
  }catch{throw Error('INVALID_BOUNDED_PROJECTION');}
  if(ticket.cursor!==null)state.seen.add(ticket.cursor);
  if(state.seen.size>=PROJECTION_TRANSPORT_LIMITS.maxCursorHistory)
   throw Error('PROJECTION_CURSOR_LIMIT');
  state.next=next;state.complete=result.complete;state.pending=0;
  return result;
 };
 const acceptRevision=(generation,prior,issued)=>{
  // Only adopt an already issued Core revision; never increment locally.
  if(generation!==epoch||!same(prior))throw new Error('STALE_CHANGESET');
  const next=assertIdentity(issued);
  if(next.sessionKey!==active.sessionKey||next.generation!==active.generation||
     next.originalSha256!==active.originalSha256||next.schema!==active.schema||
     next.revision<=active.revision)
   throw new Error('INVALID_CORE_REVISION');
  active=Object.freeze({...next,capabilities:Object.freeze(Object.fromEntries(
   ['READ','ENCODE_COPY','PERSISTENT_REPLACE'].map(k=>[k,Object.freeze({...next.capabilities[k]})])))});
  clearPages();
  return active;
 };
 return Object.freeze({
  beginOpen,invalidate,acceptOpen,issuePageQuery,acceptPage,acceptRevision,
  epoch:()=>epoch,current:()=>active,
  acceptResult:(generation,identity)=>{
   if(generation!==epoch||!same(identity))throw new Error('STALE_SESSION_RESPONSE');
   return true;
  }
 });
}
