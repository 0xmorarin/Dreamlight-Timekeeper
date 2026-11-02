// 03 WEB / 05 QR reusable synthetic-only response corpus.
// Payloads are generated on demand; no personal save, secret or proprietary art.
// This is a UI rejection corpus, NOT a trusted CORE cursor/semantic test.
export const FIXTURE_PROTOCOL='timekeeper.web.projection-negatives@1';
export const ORIGINAL_P1G_SHA='0123456789abcdef'.repeat(4);
export const ALTERNATE_P1G_SHA='abcdef0123456789'.repeat(4);
export function identity(overrides={}){
 return {
  sessionKey:'core-session-A',generation:1,revision:0,
  originalSha256:ORIGINAL_P1G_SHA,schema:626,origin:'local-file',
  capabilities:{
   READ:{state:'AVAILABLE',evidence:'SYNTHETIC_TESTED'},
   ENCODE_COPY:{state:'DENIED',evidence:'UNKNOWN'},
   PERSISTENT_REPLACE:{state:'DENIED',evidence:'BLOCKED'}
  },...overrides
 };
}
export function query(id,cursor=null,limit=200,domain='timing',view='events'){
 return {identity:id,domain,view,page:{limit,cursor},
  filters:{area:'Plaza'},sort:'eventId'};
}
export function page(id,rows=[{eventId:2010000021}],complete=true,nextCursor=null,domain='timing',view='events'){
 return {identity:id,domain,view,rows,revision:id.revision,complete,nextCursor};
}
// Error labels are stable for independent QR. Exact numeric data is synthetic.
export const RESPONSE_NEGATIVES=Object.freeze([
 {id:'ROW_700KB',reason:'oversized single Grid object',mutate:r=>({...r,rows:[{grid:'x'.repeat(700000)}]})},
 {id:'ROW_MULTIBYTE',reason:'UTF-8 encoded bytes exceed row bound',mutate:r=>({...r,rows:[{quest:'界'.repeat(22000)}]})},
 {id:'PAGE_SUM',reason:'200 individually bounded Inventory rows exceed total page bytes',mutate:r=>({...r,rows:Array.from({length:200},(_,i)=>({index:i,inventory:'i'.repeat(12000)}))})},
 {id:'COMPLETE_WITH_CURSOR',reason:'final flag contradicts next cursor',mutate:r=>({...r,complete:true,nextCursor:'next'})},
 {id:'INCOMPLETE_WITHOUT_CURSOR',reason:'incomplete without continuation',mutate:r=>({...r,complete:false,nextCursor:null})},
 {id:'INCOMPLETE_EMPTY',reason:'continuation with zero progress',mutate:r=>({...r,rows:[],complete:false,nextCursor:'next'})},
 {id:'CURSOR_UNDEFINED',reason:'undefined is not a null terminal cursor',mutate:r=>({...r,nextCursor:undefined})},
 {id:'CURSOR_ABSENT',reason:'missing terminal cursor property',mutate:r=>{const a={...r};delete a.nextCursor;return a;}},
 {id:'CURSOR_OVERSIZE',reason:'overlong opaque token',mutate:r=>({...r,complete:false,nextCursor:'c'.repeat(513)})},
 {id:'SOURCE_SHA_SWAP',reason:'foreign source original encrypted P1G hash',mutate:r=>({...r,identity:identity({originalSha256:ALTERNATE_P1G_SHA})}),expected:'STALE_PROJECTION'},
 {id:'REVISION_STALE',reason:'old/new revision mismatch',mutate:r=>({...r,revision:r.revision+1}),expected:'STALE_PROJECTION'},
 {id:'SESSION_SWAP',reason:'foreign session identity',mutate:r=>({...r,identity:identity({sessionKey:'core-session-B'})}),expected:'STALE_PROJECTION'},
 {id:'QUERY_VIEW_SWAP',reason:'response from different view',mutate:r=>({...r,view:'inventory'}),expected:'INVALID_BOUNDED_PROJECTION'},
 {id:'ROW_NON_JSON',reason:'uncloneable unsupported record value',mutate:r=>({...r,rows:[{bad:BigInt(1)}]})}
]);
export const SEQUENTIAL_NEGATIVES=Object.freeze([
 'NEXT_CURSOR_REPLAY','NEXT_CURSOR_LOOP','NEXT_CURSOR_WRONG_ORDER',
 'SORT_CHANGED','OLD_GENERATION_AFTER_FILE_SWITCH','OLD_REVISION_AFTER_UNDO',
 'OLD_REVISION_AFTER_REDO','CONCURRENT_FIRST_PAGE_REPLACEMENT','DUPLICATE_RESPONSE'
]);
