// 03 WEB Phase A: prospective Worker-side transport checker.
// This MAY be called in the future Rust/WASM READ Worker AFTER trusted 01 CORE
// verifies session provenance, index completeness and minted opaque Cursor.
// It does not issue credentials, trust UI claims, or authorize product READ/Writer.
import {boundedJsonBytes,PROJECTION_TRANSPORT_LIMITS as L} from './session-response-fence.mjs';
export const WORKER_PRODUCER_BOUNDS_CONTRACT='timekeeper.worker-producer-bounds.proposal@1';
export function rejectOversizeWorkerProjection(page,{requestedLimit=200}={}){
 if(!page||typeof page!=='object'||Array.isArray(page)||
    !Number.isSafeInteger(requestedLimit)||requestedLimit<1||requestedLimit>L.maxRows||
    !Array.isArray(page.rows)||page.rows.length>L.maxRows||
    page.rows.length>requestedLimit||
    typeof page.complete!=='boolean'||!Object.hasOwn(page,'nextCursor')||
    !(page.nextCursor===null||
      typeof page.nextCursor==='string'&&page.nextCursor.length>0&&page.nextCursor.length<=L.maxCursorChars)||
    page.complete!==(page.nextCursor===null)||
    !page.complete&&page.rows.length===0)
  throw Error('WORKER_PROJECTION_ENVELOPE_REJECTED');
 try{
  for(const row of page.rows){
   if(row===null||typeof row!=='object'||Array.isArray(row))
    throw Error('WORKER_ROW_SHAPE_REJECTED');
   boundedJsonBytes(row,L.maxRowBytes);
  }
  // Entire response JSON envelope: metadata, source identity and cursor count.
  boundedJsonBytes(page,L.maxPageBytes);
 }catch{
  throw Error('WORKER_PROJECTION_BYTES_REJECTED');
 }
 return page; // Read-only pass-through; cannot attest any Core-issued claim.
}
