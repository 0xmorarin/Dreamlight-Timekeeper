import {inspectTimingPlan} from './core/timing-plan-preflight.mjs';

const W1=Object.freeze(['ItemSpawning','WildCropsSpawningInVillage',
  'FlowerSpawningInVillage','FishSpawningInVillage']);
const W1_SET=new Set(W1);
const SOURCE=Object.freeze({
  platform:'Nintendo Switch',version:'1.25.3',buildId:'9A239D3DB569756D',
  saveSchema:626,definitionCount:508,
  rawEventSHA256:'028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea'
});
const BLOCKED_IDS=new Set([2010000064,2010000093,2010000120]);
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const POINTER=new RegExp('^/World/RecurringEvents/(0|[1-9][0-9]*)/([A-Za-z][A-Za-z0-9]*)/NextOccurrencetypeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:
  typeof v==='string'&&/^(?:0|[1-9][0-9]*)$/.test(v)&&
  Number.isSafeInteger(Number(v))?Number(v):null;
const linkedIds=items=>items.map(i=>i.id).sort((a,b)=>a-b);
const sameIds=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const freezeRows=rows=>Object.freeze(rows.map(r=>Object.freeze({
  ...r,linkedItemIds:Object.freeze(r.linkedItemIds.slice())
})));
const scope=Object.freeze({
  operation:'REPLACE_EXISTING_NEXT_OCCURRENCE_ONLY',
  jsonPointerTemplate:'/World/RecurringEvents/<index>/<Variant>/NextOccurrence',
  dataPathTemplate:'World.RecurringEvents/<index>/<Variant>/NextOccurrence',
  allowedVariants:W1,
  allowedProfileSchema:626,
  modificationOfOtherFieldsPermitted:false,
  originalSaveMutationPermitted:false,
  writerAuthorized:false,
  editedExportAuthorized:false
});
const ownerObservation=Object.freeze({
  evidence:'OWNER_REPORTED_RUNTIME_CONFIRMED',
  observation:'Owner reported successful in-game suppression of automatic spawns with intentional long-future NextOccurrence',
  exactEventIdsConfirmed:Object.freeze([]),
  eventIdSpecificRuntimeAuthorization:false,
  gameBuildAndSchemaIndependentlyVerifiedForObservation:false,
  extensionToAllW1VariantsPermitted:false,
  independentQRAcceptance:false
});

function validateSources(registry,ledger){
  const s=registry?.source;
  if(!isObject(s)||s.version!==SOURCE.version||s.buildId!==SOURCE.buildId||
     s.schema!==SOURCE.saveSchema||s.rawEventSHA256!==SOURCE.rawEventSHA256||
     s.writerAuthorization!==false||!Array.isArray(registry.events)||
     registry.events.length!==SOURCE.definitionCount)
    throw new Error('Unrecognized v1.25.3 recurring-event registry.');
  const definitions=new Map();
  for(const item of registry.events){
    if(!isObject(item)||!Number.isSafeInteger(item.id)||item.id<=0||
       definitions.has(item.id)||typeof item.name!=='string'||!item.name||
       !Array.isArray(item.items)||!item.items.every(x=>
         isObject(x)&&Number.isSafeInteger(x.id)&&x.id>0))
      throw new Error('Ambiguous recurring-event source definition.');
    definitions.set(item.id,item);
  }
  if(ledger?.source?.buildId!==SOURCE.buildId||
     ledger.source?.saveSchema!==SOURCE.saveSchema||
     ledger.source?.recurringSourceSHA256!==SOURCE.rawEventSHA256||
     ledger.source?.evidence!=='STATIC_ONLY'||
     ledger.sourceEventCount!==SOURCE.definitionCount||
     !Array.isArray(ledger.rows)||ledger.rows.length!==SOURCE.definitionCount||
     typeof ledger.query!=='function')
    throw new Error('Unrecognized native/source variant ledger.');
  const ledgerIds=new Set();
  for(const row of ledger.rows){
    const def=definitions.get(row.eventId);
    if(!def||ledgerIds.has(row.eventId)||row.eventName!==def.name||
       row.sourcePolicy!==def.eventPolicy||row.sourceDefinitionActive!==def.active||
       !Array.isArray(row.linkedItemIds)||
       !sameIds([...row.linkedItemIds].sort((a,b)=>a-b),linkedIds(def.items)))
      throw new Error('Native/source definitions diverge.');
    ledgerIds.add(row.eventId);
  }
  return definitions;
}

function countSavedIDs(world){
  const seen=new Map(),events=world?.RecurringEvents;
  if(!isObject(events))return seen;
  for(const container of Object.values(events)){
    if(!isObject(container))continue;
    for(const [variant,data] of Object.entries(container)){
      if(!W1_SET.has(variant)&&!isObject(data))continue;
      if(!isObject(data)||!Object.hasOwn(data,'RecurringEventItemID'))continue;
      const id=integer(data.RecurringEventItemID);
      if(id!==null)seen.set(id,(seen.get(id)||0)+1);
    }
  }
  return seen;
}
function assessOne(preflight,row,profile,snapshot,definitions,ledger,savedCounts){
  const pointer=preflight.pointer;
  const match=typeof pointer==='string'?POINTER.exec(pointer):null;
  let code='TARGET_STRUCTURALLY_ELIGIBLE';
  const savedIndex=match?integer(match[1]):null;
  const variant=match?.[2]??null;
  const id=integer(row?.id);
  const def=id===null?null:definitions.get(id);
  const events=profile.World?.RecurringEvents;
  const container=savedIndex!==null&&isObject(events)&&
    Object.hasOwn(events,String(savedIndex))?events[String(savedIndex)]:null;
  const event=isObject(container)&&variant&&Object.hasOwn(container,variant)?
    container[variant]:null;
  const native=def&&variant?ledger.query(def.id,variant):null;
  if(profile.GameInfo?.Version!==SOURCE.saveSchema||
     snapshot.identity?.schema!==SOURCE.saveSchema)
    code='SCHEMA_MISMATCH';
  else if(!match||savedIndex===null||!W1_SET.has(variant))
    code='PATH_OR_VARIANT_OUT_OF_SCOPE';
  else if(preflight.code!=='STRUCTURE_OBSERVED')
    code='PREFLIGHT_'+preflight.code;
  else if(!isObject(container)||Object.keys(container).length!==1||
    !isObject(event)||!Object.hasOwn(event,'NextOccurrence'))
    code='AMBIGUOUS_OR_UNKNOWN_VARIANT';
  else if(id===null||!def)
    code='UNKNOWN_EVENT_ID';
  else if(integer(event.RecurringEventItemID)!==id||
    integer(preflight.eventId)!==id||row?.pointer!==pointer||
    row.kind!==variant||row.source!=='World.RecurringEvents')
    code='EVENT_ID_OR_SAVED_VARIANT_MISMATCH';
  else if(savedCounts.get(id)!==1)
    code='DUPLICATE_SAVED_EVENT_ID';
  else if(BLOCKED_IDS.has(id)||def.eventPolicy!=='W1')
    code='PROTECTED_OR_NON_W1';
  else if(def.active!==true)
    code='INACTIVE_OR_UNKNOWN_SOURCE';
  else if(row.policy!==def.eventPolicy||row.eventActive!==true||
    row.eventName!==def.name||row.structureValid!==true)
    code='SOURCE_SNAPSHOT_MISMATCH';
  else if(!Array.isArray(row.items)||
    !row.items.every(x=>isObject(x)&&Number.isSafeInteger(x.id))||
    !sameIds(linkedIds(def.items),linkedIds(row.items)))
    code='LINKED_ITEM_ID_MISMATCH';
  else if(native?.status!=='SOURCE_VARIANT_HINT_ONLY'||
    native.sourceVariantHint!==variant||
    native.eventId!==id||native.sourcePolicy!=='W1'||
    native.sourceDefinitionActive!==true||
    !sameIds([...native.linkedItemIds].sort((a,b)=>a-b),linkedIds(def.items)))
    code='SOURCE_VARIANT_NOT_SUPPORTED';
  return {
    code,pointer,eventId:id,savedIndex,variant,
    linkedItemIds:def?linkedIds(def.items):[],
    originalTime:preflight.originalTime,targetTime:preflight.targetTime,
    sourceDefinitionName:def?.name??null,
    sourcePolicy:def?.eventPolicy??null,definitionActive:def?.active??null,
    savedEventId:integer(event?.RecurringEventItemID),sourceVariantHint:native?.sourceVariantHint??null,
    sourceRecordEvidence:def?'CONFIRMED':'UNKNOWN',
    saveStructureEvidence:code==='TARGET_STRUCTURALLY_ELIGIBLE'?'SYNTHETIC_TESTED':'UNKNOWN',
    nativeEventIdSpecificEvidence:'UNKNOWN',ownerReportedEvidenceNotEventSpecific:true,
    targetStructurallyEligible:code==='TARGET_STRUCTURALLY_ELIGIBLE',
    writerAuthorized:false,editedExportAuthorized:false,gridDeletionAuthorized:false
  };
}

/**
 * Worker/CORE-owned inputs only. This proves a bounded existing JSON field
 * target, not semantic game safety or a runnable write allowlist.
 * No copy is changed, constructed, serialized or returned by this function.
 */
export function assessMinimalW1WriteTargets(profile,snapshot,plan,registry,ledger){
  const definitions=validateSources(registry,ledger);
  const preflight=inspectTimingPlan(profile,snapshot,plan);
  if(!isObject(snapshot.timingReview)||
     snapshot.timingReview.gameVersion!==SOURCE.version||
     snapshot.timingReview.evidenceBuildId!==SOURCE.buildId||
     snapshot.timingReview.schema!==SOURCE.saveSchema||
     snapshot.timingReview.evidenceLevel!=='STATIC_ONLY'||
     snapshot.timingReview.writerAuthorization!==false)
    throw new Error('Unrecognized timing-review provenance.');
  const savedCounts=countSavedIDs(profile.World);
  const rows=freezeRows(preflight.rows.map(p=>{
    const source=snapshot.rows.find(s=>s.pointer===p.pointer);
    return assessOne(p,source,profile,snapshot,definitions,ledger,savedCounts);
  }));
  const allValid=rows.length>0&&rows.every(r=>r.targetStructurallyEligible);
  const candidates=allValid?Object.freeze(rows.map(row=>Object.freeze({
    pointer:row.pointer,eventId:row.eventId,
    savedIndex:row.savedIndex,variant:row.variant,
    originalTime:row.originalTime,targetTime:row.targetTime,
    linkedItemIds:row.linkedItemIds,
    writerAuthorized:false
  }))):Object.freeze([]);
  return Object.freeze({
    status:allValid?'STRUCTURAL_W1_TARGETS_ONLY':'BLOCKED_W1_WRITE_TARGETS',
    contractVersion:'minimal-w1-target-v1',source:SOURCE,scope,
    ownerObservation,
    targetScopeVerified:allValid,
    ownerFutureDateIsCorruption:false,
    sourceMutationPerformed:false,encodedEditedFile:false,
    writerAuthorized:false,editedExportAuthorized:false,exportAvailable:false,
    candidateTargets:candidates,authorizedMutationPaths:Object.freeze([]),
    summary:Object.freeze({requested:rows.length,candidates:candidates.length,
      rejected:rows.filter(r=>!r.targetStructurallyEligible).length}),
    rows
  });
}
);
const integer=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:
  typeof v==='string'&&/^(?:0|[1-9]\\d*)$/.test(v)&&
  Number.isSafeInteger(Number(v))?Number(v):null;
const linkedIds=items=>items.map(i=>i.id).sort((a,b)=>a-b);
const sameIds=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const freezeRows=rows=>Object.freeze(rows.map(r=>Object.freeze({
  ...r,linkedItemIds:Object.freeze(r.linkedItemIds.slice())
})));
const scope=Object.freeze({
  operation:'REPLACE_EXISTING_NEXT_OCCURRENCE_ONLY',
  jsonPointerTemplate:'/World/RecurringEvents/<index>/<Variant>/NextOccurrence',
  dataPathTemplate:'World.RecurringEvents/<index>/<Variant>/NextOccurrence',
  allowedVariants:W1,
  allowedProfileSchema:626,
  modificationOfOtherFieldsPermitted:false,
  originalSaveMutationPermitted:false,
  writerAuthorized:false,
  editedExportAuthorized:false
});
const ownerObservation=Object.freeze({
  evidence:'OWNER_REPORTED_RUNTIME_CONFIRMED',
  observation:'Owner reported successful in-game suppression of automatic spawns with intentional long-future NextOccurrence',
  exactEventIdsConfirmed:Object.freeze([]),
  eventIdSpecificRuntimeAuthorization:false,
  gameBuildAndSchemaIndependentlyVerifiedForObservation:false,
  extensionToAllW1VariantsPermitted:false,
  independentQRAcceptance:false
});

function validateSources(registry,ledger){
  const s=registry?.source;
  if(!isObject(s)||s.version!==SOURCE.version||s.buildId!==SOURCE.buildId||
     s.schema!==SOURCE.saveSchema||s.rawEventSHA256!==SOURCE.rawEventSHA256||
     s.writerAuthorization!==false||!Array.isArray(registry.events)||
     registry.events.length!==SOURCE.definitionCount)
    throw new Error('Unrecognized v1.25.3 recurring-event registry.');
  const definitions=new Map();
  for(const item of registry.events){
    if(!isObject(item)||!Number.isSafeInteger(item.id)||item.id<=0||
       definitions.has(item.id)||typeof item.name!=='string'||!item.name||
       !Array.isArray(item.items)||!item.items.every(x=>
         isObject(x)&&Number.isSafeInteger(x.id)&&x.id>0))
      throw new Error('Ambiguous recurring-event source definition.');
    definitions.set(item.id,item);
  }
  if(ledger?.source?.buildId!==SOURCE.buildId||
     ledger.source?.saveSchema!==SOURCE.saveSchema||
     ledger.source?.recurringSourceSHA256!==SOURCE.rawEventSHA256||
     ledger.source?.evidence!=='STATIC_ONLY'||
     ledger.sourceEventCount!==SOURCE.definitionCount||
     !Array.isArray(ledger.rows)||ledger.rows.length!==SOURCE.definitionCount||
     typeof ledger.query!=='function')
    throw new Error('Unrecognized native/source variant ledger.');
  const ledgerIds=new Set();
  for(const row of ledger.rows){
    const def=definitions.get(row.eventId);
    if(!def||ledgerIds.has(row.eventId)||row.eventName!==def.name||
       row.sourcePolicy!==def.eventPolicy||row.sourceDefinitionActive!==def.active||
       !Array.isArray(row.linkedItemIds)||
       !sameIds([...row.linkedItemIds].sort((a,b)=>a-b),linkedIds(def.items)))
      throw new Error('Native/source definitions diverge.');
    ledgerIds.add(row.eventId);
  }
  return definitions;
}

function countSavedIDs(world){
  const seen=new Map(),events=world?.RecurringEvents;
  if(!isObject(events))return seen;
  for(const container of Object.values(events)){
    if(!isObject(container))continue;
    for(const [variant,data] of Object.entries(container)){
      if(!W1_SET.has(variant)&&!isObject(data))continue;
      if(!isObject(data)||!Object.hasOwn(data,'RecurringEventItemID'))continue;
      const id=integer(data.RecurringEventItemID);
      if(id!==null)seen.set(id,(seen.get(id)||0)+1);
    }
  }
  return seen;
}
function assessOne(preflight,row,profile,snapshot,definitions,ledger,savedCounts){
  const pointer=preflight.pointer;
  const match=typeof pointer==='string'?
    /^\\/World\\/RecurringEvents\\/(0|[1-9]\\d*)\\/([A-Za-z][A-Za-z0-9]*)\\/NextOccurrence$/.exec(pointer):null;
  let code='TARGET_STRUCTURALLY_ELIGIBLE';
  const savedIndex=match?integer(match[1]):null;
  const variant=match?.[2]??null;
  const id=integer(row?.id);
  const def=id===null?null:definitions.get(id);
  const events=profile.World?.RecurringEvents;
  const container=savedIndex!==null&&isObject(events)&&
    Object.hasOwn(events,String(savedIndex))?events[String(savedIndex)]:null;
  const event=isObject(container)&&variant&&Object.hasOwn(container,variant)?
    container[variant]:null;
  const native=def&&variant?ledger.query(def.id,variant):null;
  if(profile.GameInfo?.Version!==SOURCE.saveSchema||
     snapshot.identity?.schema!==SOURCE.saveSchema)
    code='SCHEMA_MISMATCH';
  else if(!match||savedIndex===null||!W1_SET.has(variant))
    code='PATH_OR_VARIANT_OUT_OF_SCOPE';
  else if(preflight.code!=='STRUCTURE_OBSERVED')
    code='PREFLIGHT_'+preflight.code;
  else if(!isObject(container)||Object.keys(container).length!==1||
    !isObject(event)||!Object.hasOwn(event,'NextOccurrence'))
    code='AMBIGUOUS_OR_UNKNOWN_VARIANT';
  else if(id===null||!def)
    code='UNKNOWN_EVENT_ID';
  else if(integer(event.RecurringEventItemID)!==id||
    integer(preflight.eventId)!==id||row?.pointer!==pointer||
    row.kind!==variant||row.source!=='World.RecurringEvents')
    code='EVENT_ID_OR_SAVED_VARIANT_MISMATCH';
  else if(savedCounts.get(id)!==1)
    code='DUPLICATE_SAVED_EVENT_ID';
  else if(BLOCKED_IDS.has(id)||def.eventPolicy!=='W1')
    code='PROTECTED_OR_NON_W1';
  else if(def.active!==true)
    code='INACTIVE_OR_UNKNOWN_SOURCE';
  else if(row.policy!==def.eventPolicy||row.eventActive!==true||
    row.eventName!==def.name||row.structureValid!==true)
    code='SOURCE_SNAPSHOT_MISMATCH';
  else if(!Array.isArray(row.items)||
    !row.items.every(x=>isObject(x)&&Number.isSafeInteger(x.id))||
    !sameIds(linkedIds(def.items),linkedIds(row.items)))
    code='LINKED_ITEM_ID_MISMATCH';
  else if(native?.status!=='SOURCE_VARIANT_HINT_ONLY'||
    native.sourceVariantHint!==variant||
    native.eventId!==id||native.sourcePolicy!=='W1'||
    native.sourceDefinitionActive!==true||
    !sameIds([...native.linkedItemIds].sort((a,b)=>a-b),linkedIds(def.items)))
    code='SOURCE_VARIANT_NOT_SUPPORTED';
  return {
    code,pointer,eventId:id,savedIndex,variant,
    linkedItemIds:def?linkedIds(def.items):[],
    originalTime:preflight.originalTime,targetTime:preflight.targetTime,
    sourceDefinitionName:def?.name??null,
    sourcePolicy:def?.eventPolicy??null,definitionActive:def?.active??null,
    savedEventId:integer(event?.RecurringEventItemID),sourceVariantHint:native?.sourceVariantHint??null,
    sourceRecordEvidence:def?'CONFIRMED':'UNKNOWN',
    saveStructureEvidence:code==='TARGET_STRUCTURALLY_ELIGIBLE'?'SYNTHETIC_TESTED':'UNKNOWN',
    nativeEventIdSpecificEvidence:'UNKNOWN',ownerReportedEvidenceNotEventSpecific:true,
    targetStructurallyEligible:code==='TARGET_STRUCTURALLY_ELIGIBLE',
    writerAuthorized:false,editedExportAuthorized:false,gridDeletionAuthorized:false
  };
}

/**
 * Worker/CORE-owned inputs only. This proves a bounded existing JSON field
 * target, not semantic game safety or a runnable write allowlist.
 * No copy is changed, constructed, serialized or returned by this function.
 */
export function assessMinimalW1WriteTargets(profile,snapshot,plan,registry,ledger){
  const definitions=validateSources(registry,ledger);
  const preflight=inspectTimingPlan(profile,snapshot,plan);
  if(!isObject(snapshot.timingReview)||
     snapshot.timingReview.gameVersion!==SOURCE.version||
     snapshot.timingReview.evidenceBuildId!==SOURCE.buildId||
     snapshot.timingReview.schema!==SOURCE.saveSchema||
     snapshot.timingReview.evidenceLevel!=='STATIC_ONLY'||
     snapshot.timingReview.writerAuthorization!==false)
    throw new Error('Unrecognized timing-review provenance.');
  const savedCounts=countSavedIDs(profile.World);
  const rows=freezeRows(preflight.rows.map(p=>{
    const source=snapshot.rows.find(s=>s.pointer===p.pointer);
    return assessOne(p,source,profile,snapshot,definitions,ledger,savedCounts);
  }));
  const allValid=rows.length>0&&rows.every(r=>r.targetStructurallyEligible);
  const candidates=allValid?Object.freeze(rows.map(row=>Object.freeze({
    pointer:row.pointer,eventId:row.eventId,
    savedIndex:row.savedIndex,variant:row.variant,
    originalTime:row.originalTime,targetTime:row.targetTime,
    linkedItemIds:row.linkedItemIds,
    writerAuthorized:false
  }))):Object.freeze([]);
  return Object.freeze({
    status:allValid?'STRUCTURAL_W1_TARGETS_ONLY':'BLOCKED_W1_WRITE_TARGETS',
    contractVersion:'minimal-w1-target-v1',source:SOURCE,scope,
    ownerObservation,
    targetScopeVerified:allValid,
    ownerFutureDateIsCorruption:false,
    sourceMutationPerformed:false,encodedEditedFile:false,
    writerAuthorized:false,editedExportAuthorized:false,exportAvailable:false,
    candidateTargets:candidates,authorizedMutationPaths:Object.freeze([]),
    summary:Object.freeze({requested:rows.length,candidates:candidates.length,
      rejected:rows.filter(r=>!r.targetStructurallyEligible).length}),
    rows
  });
}
