// UI-side *rejection only*: no revision mutation, Writer capabilities, SHA
// creation, or ChangeSet state ownership. Worker/CORE issues all identities.
const sha=/^[0-9a-f]{64}$/;
const fields=['sessionKey','generation','revision','originalSha256','schema','origin','capabilities'];
function assertIdentity(x) {
 if(!x||typeof x!=='object'||fields.some(k=>!(k in x))||
    typeof x.sessionKey!=='string'||!x.sessionKey||x.sessionKey.length>128||
    !Number.isSafeInteger(x.generation)||x.generation<0||
    !Number.isSafeInteger(x.revision)||x.revision<0||
    !Number.isSafeInteger(x.schema)||x.schema<1||x.origin!=='local-file'||
    !sha.test(x.originalSha256)||!x.capabilities||
    x.capabilities.READ?.state!=='AVAILABLE'||
    x.capabilities.PERSISTENT_REPLACE?.state==='AVAILABLE')
  throw new Error('SESSION_CORE_IDENTITY_INVALID');
 return x;
}
export function createSessionResponseFence({maxPageSize=200}={}){
 if(!Number.isSafeInteger(maxPageSize)||maxPageSize<1||maxPageSize>200)
  throw new TypeError('INVALID_PAGE_BOUND');
 let epoch=0,active=null;
 const invalidate=()=>{epoch++;active=null;return epoch;};
 const beginOpen=()=>invalidate();
 const same=(id)=>{
  if(!active||!id)return false;
  return id.sessionKey===active.sessionKey&&
   id.generation===active.generation&&
   id.originalSha256===active.originalSha256&&
   id.schema===active.schema&&id.revision===active.revision;
 };
 const acceptOpen=(generation,id)=>{
  if(generation!==epoch)throw new Error('STALE_OPEN_RESULT');
  const good=assertIdentity(id);
  active=Object.freeze({...good,capabilities:Object.freeze({...good.capabilities})});
  return active;
 };
 const acceptPage=(generation,query,result)=>{
  if(generation!==epoch||!same(query?.identity)||!same(result?.identity)||
     result.revision!==active.revision)throw new Error('STALE_PROJECTION');
  const limit=query?.page?.limit;
  if(!Number.isSafeInteger(limit)||limit<1||limit>maxPageSize||
     !Array.isArray(result?.rows)||result.rows.length>limit||
     typeof result.complete!=='boolean'||
     (result.nextCursor!==null&&
      (typeof result.nextCursor!=='string'||result.nextCursor.length>512))||
     result.domain!==query.domain||
     result.rows.some(row=>row===null||typeof row!=='object'))
   throw new Error('INVALID_BOUNDED_PROJECTION');
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
  active=Object.freeze({...next,capabilities:Object.freeze({...next.capabilities})});
  return active;
 };
 return Object.freeze({
  beginOpen,invalidate,acceptOpen,acceptPage,acceptRevision,
  epoch:()=>epoch,current:()=>active,
  acceptResult:(generation,identity)=>{
   if(generation!==epoch||!same(identity))throw new Error('STALE_SESSION_RESPONSE');
   return true;
  }
 });
}
