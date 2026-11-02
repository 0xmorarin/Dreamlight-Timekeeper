import {createSeparateDownloadCoordinator} from './ui-separate-downloads.mjs';

/**
 * Presentation-only bridge. Only a future Worker-verified, CORE-authorized
 * receipt may call acceptWorkerPair from the product's private app scope.
 * This module neither verifies P1G semantics nor creates an edited copy.
 */
export function createVerifiedPairDownloadUi({
 currentSession,currentPlanRevision,triggerDownload,controls,onStatus=()=>{}
}){
 if([currentSession,currentPlanRevision,triggerDownload,onStatus].some(fn=>typeof fn!=='function')||
    !controls||['panel','both','original','edited'].some(name=>!controls[name]))
  throw new TypeError('Missing verified pair download UI callbacks.');
 const coordinator=createSeparateDownloadCoordinator({currentSession,triggerDownload});
 let prepared=null,originalTriggered=false;
 const active=()=>Boolean(prepared)&&
   Number.isSafeInteger(currentSession())&&currentSession()===prepared.sessionId&&
   currentPlanRevision()===prepared.planRevision;
 const sync=()=>{
  const ready=active();
  controls.panel.hidden=!ready;
  for(const key of ['both','original','edited'])
   controls[key].disabled=!ready||(key==='edited'&&!originalTriggered);
  return ready;
 };
 const invalidate=()=>{
  coordinator.invalidate();prepared=null;originalTriggered=false;sync();
 };
 const acceptWorkerPair=(receipt,context)=>{
  invalidate();
  // A receipt is never synthesized by this UI. Phase B must only call this
  // after CORE's exact SourceHash/plan CAS/Encode/Reopen contract is accepted.
  if(!context||!Number.isSafeInteger(context.sessionId)||context.sessionId<1||
     !Number.isSafeInteger(context.planRevision)||context.planRevision<0||
     context.sessionId!==currentSession()||
     context.planRevision!==currentPlanRevision()||
     receipt?.status!=='WORKER_VERIFIED_PAIR'||
     receipt.sessionId!==context.sessionId)
   throw new Error('Worker-verified output belongs to an inactive save or plan.');
  coordinator.install(receipt);
  prepared={sessionId:context.sessionId,planRevision:context.planRevision};
  sync();
 };
 const act=kind=>{
  if(!sync()){invalidate();throw new Error('Verified output is no longer current.');}
  let result;
  if(kind==='both'){
   result=coordinator.downloadBoth();
   if(result.original==='TRIGGER_REQUESTED_UNCONFIRMED')originalTriggered=true;
  }else if(kind==='original'){
   result=coordinator.retryOriginal();
   if(result==='TRIGGER_REQUESTED_UNCONFIRMED')originalTriggered=true;
  }else{
   if(!originalTriggered)throw new Error('Original download must be requested first.');
   result=coordinator.retryEdited();
  }
  sync();onStatus(kind,result);
  return result;
 };
 controls.both.addEventListener('click',()=>{try{act('both');}catch(e){onStatus('error',e.message);}});
 controls.original.addEventListener('click',()=>{try{act('original');}catch(e){onStatus('error',e.message);}});
 controls.edited.addEventListener('click',()=>{try{act('edited');}catch(e){onStatus('error',e.message);}});
 invalidate();
 return Object.freeze({invalidate,sync,acceptWorkerPair,downloadBoth:()=>act('both'),
  retryOriginal:()=>act('original'),retryEdited:()=>act('edited')});
}
