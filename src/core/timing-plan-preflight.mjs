// Read-only preflight. The parsed profile in the Worker, not UI supplied paths
// or claims, is the source of truth. This function NEVER builds an edited save.
import {validTime} from '../reader.mjs';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const VARIANTS=new Set([
 'ItemSpawning','WildCropsSpawningInVillage','FlowerSpawningInVillage',
 'FishSpawningInVillage','SnippetSpawning','MiningRockTurningSpecial',
 'FlowerDryingInVillage','ChooseVillageArea','ChooseItem',
 'TimeLostTreasureSpawning','MakeCharacterEager','PendingFishUpgrade'
]);
const frozen=rows=>Object.freeze(rows.map(row=>Object.freeze(row)));
const canonicalId=value=>{
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?value:null;
 if(typeof value!=='string'||!/^(?:0|[1-9]\d*)$/.test(value))return null;
 const n=Number(value);return Number.isSafeInteger(n)?n:null;
};
const POINTER=/^\/(?:[^~/]|~[01])+(?:\/(?:[^~/]|~[01])+)*$/;
function pointerParts(pointer){
 if(typeof pointer!=='string'||!POINTER.test(pointer))return null;
 const parts=pointer.slice(1).split('/').map(x=>x.replaceAll('~1','/').replaceAll('~0','~'));
 // Never resolve special property names even if malicious JSON contains them.
 return parts.some(x=>['__proto__','prototype','constructor'].includes(x))?null:parts;
}
function atOwnPath(root,parts){
 let obj=root;
 for(const part of parts){
  if((!object(obj)&&!Array.isArray(obj))||!Object.hasOwn(obj,part))
   return {exists:false,value:undefined};
  obj=obj[part];
 }
 return {exists:true,value:obj};
}
function structuralCheck(profile,row,parts){
 if(row.source!=='World.RecurringEvents'||parts.length!==5||
    parts[0]!=='World'||parts[1]!=='RecurringEvents'||
    parts[3]!==row.kind||parts[4]!=='NextOccurrence'||
    !VARIANTS.has(parts[3]))
  return 'FIELD_KIND_NOT_YET_REVIEWED';
 const container=atOwnPath(profile,parts.slice(0,3));
 const entry=atOwnPath(profile,parts.slice(0,4));
 if(!container.exists||!object(container.value)||!entry.exists||!object(entry.value))
  return 'RECURRING_CONTAINER_INVALID';
 const variants=Object.keys(container.value).filter(k=>VARIANTS.has(k)&&object(container.value[k]));
 if(variants.length!==1||variants[0]!==parts[3]||row.structureValid!==true)
  return 'AMBIGUOUS_RECURRING_VARIANT';
 // Unknown parallel NextOccurrence branches may be added in future schemas.
 if(Object.entries(container.value).some(([key,v])=>!VARIANTS.has(key)&&object(v)&&
   (Object.hasOwn(v,'NextOccurrence')||Object.hasOwn(v,'RecurringEventItemID'))))
  return 'UNKNOWN_PARALLEL_EVENT_VARIANT';
 const actualId=canonicalId(entry.value.RecurringEventItemID);
 if(actualId===null||actualId!==row.id)return 'RECURRING_EVENT_ID_MISMATCH';
 if(typeof row.eventName!=='string'||!row.eventName)return 'EVENT_DEFINITION_UNKNOWN';
 return 'STRUCTURE_OBSERVED';
}

export function inspectTimingPlan(profile,snapshot,plan,{maxEntries=10000}={}){
 if(!object(profile)||!object(profile.GameInfo)||!object(profile.World)||
    !object(snapshot)||!object(snapshot.identity)||!Array.isArray(snapshot.rows)||
    snapshot.capabilities?.editingAllowed!==false||
    snapshot.capabilities?.exportEditedAllowed!==false||
    !Array.isArray(plan)||!Number.isSafeInteger(maxEntries)||maxEntries<1||
    plan.length>maxEntries||snapshot.rows.length>250000)
  throw new Error('Unrecognized read-only timing preflight input.');
 const schema=canonicalId(profile.GameInfo.Version);
 if(schema===null||schema!==snapshot.identity.schema)
  throw new Error('Profile/schema snapshot identity mismatch.');
 const byPointer=new Map();
 for(const row of snapshot.rows){
  if(!pointerParts(row.pointer)||byPointer.has(row.pointer))
   throw new Error('Duplicate or invalid source timing pointer.');
  byPointer.set(row.pointer,row);
 }
 const seen=new Set(),results=[];
 let observed=0,rejected=0,held=0;
 for(const item of plan){
  if(!object(item)||!pointerParts(item.pointer)||seen.has(item.pointer))
   throw new Error('Invalid or duplicate timing plan pointer.');
  seen.add(item.pointer);
  const row=byPointer.get(item.pointer);
  const parts=pointerParts(item.pointer);
  const saved=atOwnPath(profile,parts);
  let code='STRUCTURE_OBSERVED';
  if(!row)code='SOURCE_ROW_NOT_FOUND';
  else if(!saved.exists)code='SOURCE_FIELD_NOT_FOUND';
  else if(row.pointer!==item.pointer||row.time!==item.originalTime||
          saved.value!==item.originalTime)code='ORIGINAL_VALUE_MISMATCH';
  else if(!validTime(item.originalTime))code='ORIGINAL_TIME_INVALID';
  else if(!validTime(item.targetTime))code='TARGET_TIME_INVALID';
  else if(item.targetTime===item.originalTime)code='NO_CHANGE';
  else code=structuralCheck(profile,row,parts);
  if(code==='STRUCTURE_OBSERVED')observed++;
  else if(code==='FIELD_KIND_NOT_YET_REVIEWED'||code==='EVENT_DEFINITION_UNKNOWN')held++;
  else rejected++;
  results.push({
   pointer:item.pointer,
   source:row?.source??null,kind:row?.kind??null,
   eventId:row?.id??null,
   originalTime:row?.time??null,
   targetTime:typeof item.targetTime==='string'?item.targetTime:null,
   code,
   sourceSchema:schema,
   structuralShapeObserved:code==='STRUCTURE_OBSERVED',
   sourceBuildVerified:false,nativeSemanticsVerified:false,
   serializationVerified:false,writerAuthorized:false,
   editedCopyAuthorized:false
  });
 }
 return Object.freeze({
  status:'READ_ONLY_PLAN_PREFLIGHT',
  schema,
  researchedSourceSchema:626,
  sourceBuildVerified:false,
  newVersionReadAllowed:true,
  exactFieldSemanticsVerified:false,
  sourceMutationPerformed:false,
  writerAuthorized:false,editedCopyAuthorized:false,
  exportAvailable:false,
  summary:Object.freeze({requested:plan.length,structuralShapeObserved:observed,
    heldForReview:held,rejected}),
  rows:frozen(results)
 });
}
