// 02 TIME: version-scoped, source-only W1 native semantics ledger.
// This is NOT a scheduler simulator, event allowlist, or save mutation API.
import {compileDecorationSpawnEvidence} from './decoration-spawn-evidence.mjs';

const SOURCE=Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.3',buildId:'9A239D3DB569756D',
  saveSchema:626,mainSHA256:'16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a',
  recurringSourceSHA256:'028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea',
  evidence:'STATIC_ONLY'
});
const W1=Object.freeze([
  'ItemSpawning','WildCropsSpawningInVillage',
  'FlowerSpawningInVillage','FishSpawningInVillage'
]);
const W1_SET=new Set(W1);
const NATIVE=Object.freeze({
  readiness:Object.freeze({rva:'0x05A65440',method:'IsReadyForNextOccurence',
    evidence:'CMP/CSET HS time-eligibility predicate; not proof of a complete spawn outcome'}),
  expiry:Object.freeze({rva:'0x05AF3050',method:'IsEventOver',
    evidence:'separate expiry predicate; EndDate is not NextOccurrence'}),
  reschedule:Object.freeze({rva:'0x05AF24D0',method:'IRecurringEventExtensions.Reschedule',
    evidence:'10 direct BL sites in reviewed native text: 9 Execute and 1 AddRecurringEvent; indirect callers unresolved'}),
  actualize:Object.freeze({rva:'0x05A2A170',method:'Profile.ActualizeRecurringEvents',
    evidence:'overdue catch-up clamp when Now minus scheduled time is greater than maximum interval; future-date release not shown'}),
  itemCatchup:Object.freeze({rva:'0x057C0140',method:'ItemSpawning.GetMaxIntervalToFullyExecute',
    evidence:'uses interval and amount bounds; not a universal cooldown rule'}),
  itemMaximum:Object.freeze({rva:'0x047AB7F0',method:'ItemSpawningRecurringEventItemData.GetMaximumAmount',
    evidence:'base maximum and optional area-choice maximum; not proof of actual grid population'}),
  flowerExecute:Object.freeze({rva:'0x057C99E0',method:'FlowerSpawningInVillage.Execute',
    evidence:'BL readiness predicate followed by TBNZ branch; effects and reschedule still require full trace'})
});
const trace=Object.freeze({
  ItemSpawning:Object.freeze({executeRVA:null,readinessCallsiteVerified:false,
    catchupBoundRVA:NATIVE.itemCatchup.rva,maxAmountRVA:NATIVE.itemMaximum.rva}),
  WildCropsSpawningInVillage:Object.freeze({executeRVA:null,readinessCallsiteVerified:false,
    catchupBoundRVA:null,maxAmountRVA:null}),
  FlowerSpawningInVillage:Object.freeze({executeRVA:NATIVE.flowerExecute.rva,
    readinessCallsiteVerified:true,catchupBoundRVA:null,maxAmountRVA:null}),
  FishSpawningInVillage:Object.freeze({executeRVA:null,readinessCallsiteVerified:false,
    catchupBoundRVA:null,maxAmountRVA:null})
});
const hintFor=r=>{
  if(r.family==='OBSTACLE_EVENT'||r.family==='WOOD_MATERIAL_EVENT'||
    r.family==='OTHER_FORAGE_EVENT')return 'ItemSpawning';
  if(r.family==='WILD_PLANT_EVENT')return 'WildCropsSpawningInVillage';
  if(r.family==='FLOWER_EVENT')return 'FlowerSpawningInVillage';
  if(r.tab==='resources'&&r.group==='釣り'&&r.subgroup==='波紋の生成')
    return 'FishSpawningInVillage';
  return null;
};
const baseline=Object.freeze({
  sourceBuildVerifiedFromSave:false,sourceBinaryIndependentlyRehashed:false,
  nativeExecuteLifecycleVerified:false,spawnAllocationVerified:false,
  spawnedGridObjectIdentityVerified:false,areaAndPopulationCapsVerified:false,
  pickupOrRemovalRescheduleVerified:false,restartBehaviorVerified:false,
  sourceVariantHypothesisIsNativeProof:false,
  userFutureTimestampIsCorruption:false,
  nowGuaranteesImmediateSpawn:false,futureGuaranteesSuppression:false,
  operationAllowlisted:false,writerAuthorized:false,gridDeletionAuthorized:false
});
const isId=n=>Number.isSafeInteger(n)&&n>0;

/** Compile exact-source events using already accepted Wand-tag projection. */
export function compileW1NativeSemantics(sourceEvents,{woodTagPack}={}){
  if(!woodTagPack)throw new Error('Verified Wand isWood evidence is required.');
  const decoration=compileDecorationSpawnEvidence(sourceEvents,{woodTagPack});
  if(decoration.source.status!=='BYTE_VERIFIED_WOOD_TAG_PROJECTION')
    throw new Error('Unverified source taxonomy.');
  const byId=new Map();
  const rows=decoration.rows.map(r=>{
    const origin=sourceEvents.events.find(e=>e.id===r.eventId);
    const sourceVariantHint=hintFor({...r,tab:origin.tab,group:origin.group,subgroup:origin.subgroup});
    const row=Object.freeze({
      eventId:r.eventId,eventName:r.eventName,sourceDefinitionActive:r.definitionActive,
      sourcePolicy:r.sourceEventPolicy,sourceIntervalType:origin.intervalType??null,
      sourceFamily:r.family,sourceVariantHint,
      sourceVariantHintVerifiedByNative:false,
      linkedItemIds:Object.freeze([...r.linkedItemIds]),
      areaChoiceMaximumReference:[2010000093,2010000120].includes(r.eventId),
      conditionalEventHistoryDependency:'UNKNOWN',
      gridObjectProvenance:'UNKNOWN',
      ...baseline
    });
    byId.set(row.eventId,row);
    return row;
  });
  return Object.freeze({
    source:SOURCE,native:NATIVE,traces:trace,
    sourceEventCount:508,rows:Object.freeze(rows),
    query(eventId,saveKind){
      if(!isId(eventId)||!byId.has(eventId))
        return Object.freeze({eventId,saveKind,status:'UNKNOWN_EVENT_ID',...baseline});
      const r=byId.get(eventId);
      let status;
      if(r.eventId===2010000064)status='PROTECTED_MOONSTONE_CHEST';
      else if(r.sourcePolicy!=='W1')status='NON_W1_SOURCE_POLICY';
      else if(!r.sourceDefinitionActive)status='INACTIVE_SOURCE_DEFINITION';
      else if(!W1_SET.has(saveKind))status='UNRECOGNIZED_OR_NON_W1_SAVED_VARIANT';
      else if(r.sourceVariantHint===null)status='SOURCE_TO_VARIANT_UNRESOLVED';
      else if(r.sourceVariantHint!==saveKind)status='SOURCE_VARIANT_HINT_CONFLICT';
      else status='SOURCE_VARIANT_HINT_ONLY';
      // A source-family hint is intentionally weaker than an observed native
      // discriminator, serialized profile field, or runtime behavior.
      return Object.freeze({...r,saveKind,status,
        trace:W1_SET.has(saveKind)?trace[saveKind]:null,
        ...baseline});
    }
  });
}
