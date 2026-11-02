export function createOriginalBackupCoordinator({requestBackup,saveOriginal,isCurrentSession}){
 if([requestBackup,saveOriginal,isCurrentSession].some(fn=>typeof fn!=='function'))
  throw new TypeError('Original backup coordinator requires three callbacks.');
 let generation=0,pending=null;
 const invalidate=()=>{generation++;pending=null;};
 const download=async(sessionId)=>{
  if(!Number.isSafeInteger(sessionId)||sessionId<1||!isCurrentSession(sessionId))
   throw new Error('Original backup session is not active.');
  if(pending!==null)throw new Error('Original backup already in progress.');
  const ticket=Symbol('original-backup'),at=generation;
  pending=ticket;
  try{
   const response=await requestBackup(sessionId);
   if(generation!==at||pending!==ticket||!isCurrentSession(sessionId)||response?.sessionId!==sessionId)
    throw new Error('Original backup response belongs to an inactive save.');
   if(!(response.buffer instanceof ArrayBuffer)||typeof response.name!=='string'||!response.name.trim())
    throw new Error('Original backup response is incomplete.');
   return saveOriginal(response);
  }finally{if(pending===ticket)pending=null;}
 };
 return Object.freeze({invalidate,download});
}
