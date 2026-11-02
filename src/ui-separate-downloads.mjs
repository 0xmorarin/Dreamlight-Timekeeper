export function createSeparateDownloadCoordinator({currentSession,triggerDownload}){
 if(typeof currentSession!=='function'||typeof triggerDownload!=='function')throw new TypeError('Invalid download callbacks.');
 let pair=null;
 const invalidate=()=>{pair=null;};
 const install=receipt=>{
  pair=null;
  if(receipt?.status!=='WORKER_VERIFIED_PAIR'||!Number.isSafeInteger(receipt.sessionId)||receipt.sessionId<1||
   receipt.sessionId!==currentSession())throw new Error('No verified Worker export preparation.');
  for(const name of ['original','edited']){
   const file=receipt[name];
   if(!file||typeof file.name!=='string'||!file.name.trim()||!(file.buffer instanceof ArrayBuffer))
    throw new Error('Both output files must be prepared before any download.');
  }
  if(receipt.original.name===receipt.edited.name)throw new Error('Separate downloads require distinct file names.');
  pair=receipt;
 };
 const attempt=name=>{
  if(!pair||pair.sessionId!==currentSession())throw new Error('Prepared export session changed.');
  try{
   triggerDownload(name,pair[name]);
   return 'TRIGGER_REQUESTED_UNCONFIRMED';
  }catch{return 'TRIGGER_FAILED';}
 };
 const downloadBoth=()=>{
  const original=attempt('original');
  const edited=original==='TRIGGER_REQUESTED_UNCONFIRMED'?attempt('edited'):'NOT_ATTEMPTED';
  return Object.freeze({original,edited,multipleDownloadsMayBeBlocked:true});
 };
 return Object.freeze({install,invalidate,downloadBoth,retryOriginal:()=>attempt('original'),retryEdited:()=>attempt('edited')});
}
