// 02 TIME: version-scoped, source-only W1 native semantics ledger.
// This is NOT a scheduler simulator, event allowlist, or save mutation API.
import {compileDecorationSpawnEvidence} from './decoration-spawn-evidence.mjs';

const SOURCE=Object.freeze({
  platform:'Nintendo Switch',gameVersion:'1.25.3',buildId:'9A239D3DB569756D',
  saveSchema:626,mainSHA256:'16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a',
  recurringSourceSHA256:'028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea',
  nsoTextSHA256:'15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328',
  evidence:'STATIC_ONLY'
});
const W1=Object.freeze([
  'ItemSpawning','WildCropsSpawningInVillage',
  'FlowerSpawningInVillage','FishSpawningInVillage'
]);
const W1_SET=new Set(W1);
const NATIVE=Object.freeze({
  readiness:Object.freeze({rva:'0x05A65440',method:'IsReadyForNextOccurence',
    evidence:'0x05A65640 CMP X8,X9 / 0x05A65644 CSET W0,HS; time-eligibility predicate, not a complete spawn outcome'}),
  expiry:Object.freeze({rva:'0x05AF3050',method:'IsEventOver',
    evidence:'separate expiry predicate; EndDate is not NextOccurrence'}),
  reschedule:Object.freeze({rva:'0x05AF24D0',method:'IRecurringEventExtensions.Reschedule',
    evidence:'10 direct BL sites in reviewed native text: 9 Execute and 1 AddRecurringEvent; indirect callers unresolved'}),
  actualize:Object.freeze({rva:'0x05A2A170',method:'Profile.ActualizeRecurringEvents',
    evidence:'interface slots GetMaxInterval=6, Now=0, NextOccurrence getter=1, setter=2; overdue clamp only; future-date release not shown'}),
  itemCatchup:Object.freeze({rva:'0x057C0140',method:'ItemSpawning.GetMaxIntervalToFullyExecute',
    evidence:'uses interval and amount bounds; not a universal cooldown rule'}),
  itemMaximum:Object.freeze({rva:'0x047AB7F0',method:'ItemSpawningRecurringEventItemData.GetMaximumAmount',
    evidence:'base maximum and optional area-choice maximum; not proof of actual grid population'}),
  itemExecuteCompletion:Object.freeze({entryRVA:null,method:'ItemSpawning.Execute completion-side',
    lastOccurrenceFromDateTimeRVA:'0x057BF058',lastOccurrenceStoreRVA:'0x057BF068',
    rescheduleCallRVA:'0x057BF0C4',
    evidence:'writes LastOccurrence field +0x30 before direct BL Reschedule; entry and spawn-result prerequisites unresolved'}),
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


// The ONLY executable operations modeled here are two previously documented
// AArch64 predicate results. They are conditional observations, not the game's
// scheduler, native runtime, or an edit permission.
const MAX_MASKED_DOTNET_TICKS=(1n<<62n)-1n;
const timingTicksOK=x=>typeof x==='bigint'&&x>=0n&&x<=MAX_MASKED_DOTNET_TICKS;
/**
 * Interpret the reviewed CMP/CSET HS readiness check and signed SUB/CMP/B.LE
 * overdue branch for one statically plausible W1 source event.
 * Callers must NOT infer actual spawn, removal, release, or write eligibility.
 * maxIntervalTicks=null means the event's effective bound is not known.
 */
export function analyzeW1StaticBranches(ledger,{eventId,saveKind,nowTicks,
  nextOccurrenceTicks,maxIntervalTicks=null}={}){
  if(ledger?.source!==SOURCE||ledger?.native!==NATIVE||typeof ledger.query!=='function')
    throw new Error('Unrecognized Native evidence ledger or build provenance.');
  const event=ledger.query(eventId,saveKind);
  const allowed=event.status==='SOURCE_VARIANT_HINT_ONLY';
  const noAuthority={operationAllowlisted:false,writerAuthorized:false,
    runtimeVerified:false,spawnObserved:false,removedObjectsUnchangedByThisModel:true};
  if(!allowed)return Object.freeze({
    eventId,saveKind,status:'EVENT_OUTSIDE_STATIC_W1_BRANCH_SCOPE',
    eventEvidenceStatus:event.status,readinessCondition:null,
    overdueClampCondition:null,...noAuthority
  });
  if(!timingTicksOK(nowTicks)||!timingTicksOK(nextOccurrenceTicks)||
     (maxIntervalTicks!==null&&!timingTicksOK(maxIntervalTicks)))
    throw new Error('Require nonnegative bigint masked tick operands from the reviewed Native flow.');
  const lag=nowTicks-nextOccurrenceTicks;
  return Object.freeze({
    eventId,saveKind,status:'STATIC_PREDICATE_MODEL_ONLY',
    eventEvidenceStatus:event.status,
    readinessCondition:nowTicks>=nextOccurrenceTicks,
    overdueClampCondition:maxIntervalTicks===null?null:lag>maxIntervalTicks,
    overdueClampIntervalKnown:maxIntervalTicks!==null,
    // The static conditional does NOT attest the callsite is reached or
    // the actual native setter executed in the current save or game.
    actualizeBranchReached:false,executePathVerified:false,
    afterExecuteRescheduleVerified:false,pickupRescheduleVerified:false,
    gameRestartRetentionVerified:false,...noAuthority
  });
}
