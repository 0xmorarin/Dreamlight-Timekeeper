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
const CATCHUP=Object.freeze({
  ItemSpawning:Object.freeze({getterRVA:'0x057C0140',maxIntervalCallRVA:'0x057C02C0',
    maximumCallRVA:'0x057C02E4',maximumMethod:'ItemSpawningRecurringEventItemData.GetMaximumAmount',
    amountField:'MinNumberOfSpawn',amountFieldOffset:'0x54',divisionRVA:'0x057C02EC',
    multiplicationRVA:'0x057C02F8',formula:'intervalTicks * trunc(GetMaximumAmount / MinNumberOfSpawn)',
    finalObjectCountGuarantee:false}),
  WildCropsSpawningInVillage:Object.freeze({getterRVA:'0x057C4350',maxIntervalCallRVA:'0x057C44D0',
    maximumCallRVA:'0x057C44F4',maximumMethod:'WildCropsSpawningInVillageRecurringEventItemData.GetMaximumAmount',
    amountField:'NumberOfGardensToSpawn',amountFieldOffset:'0x58',divisionRVA:'0x057C44FC',
    multiplicationRVA:'0x057C4508',formula:'intervalTicks * trunc(GetMaximumAmount / NumberOfGardensToSpawn)',
    finalObjectCountGuarantee:false}),
  FlowerSpawningInVillage:Object.freeze({getterRVA:'0x057CB7C0',maxIntervalCallRVA:'0x057CB940',
    maximumCallRVA:null,maximumMethod:null,maximumField:'MaximumAmount',
    maximumFieldOffset:'0x60',amountField:'NumberOfFlowersToSpawn',amountFieldOffset:'0x54',
    divisionRVA:'0x057CB964',multiplicationRVA:'0x057CB970',
    formula:'intervalTicks * trunc(MaximumAmount / NumberOfFlowersToSpawn)',
    finalObjectCountGuarantee:false}),
  FishSpawningInVillage:Object.freeze({getterRVA:'0x057C7EC0',maxIntervalCallRVA:'0x057C8098',
    maximumCallRVA:null,maximumMethod:null,maximumField:'MaxNumberOfPendingFishes',
    maximumFieldOffset:'0x60',amountField:null,divisionRVA:null,
    multiplicationRVA:'0x057C80B4',
    formula:'intervalTicks * MaxNumberOfPendingFishes',
    finalObjectCountGuarantee:false})
});
const STORAGE=Object.freeze({
  commonFields:Object.freeze(['RecurringEventItemID','NextOccurrence','EndDate']),
  itemSpawningOnlyLastOccurrence:Object.freeze({
    field:'LastOccurrence',fieldNumber:4,fieldOffset:'0x30',
    writeRVA:'0x057BF068',fromDateTimeRVA:'0x057BF058',
    onlyW1VariantWithThisSerializedField:true
  }),
  directSavePersistenceVerified:false,gameRestartRetentionVerified:false,
  existingGridObjectRemovedOnTimestampChange:false
});
const NATIVE=Object.freeze({
  catchupByVariant:CATCHUP,
  fieldLayout:STORAGE,
  pendingFishRemoval:Object.freeze({
    method:'ProfileWorld.RemovePendingFish',rva:'0x0598E800',
    pendingFishMapRemoveCallRVA:'0x0598E874',
    pendingFishMapRemoveTargetRVA:'0x03C141D0',
    dispatcherSlotArgumentRVA:'0x0598E8B8',
    dispatcherVirtualCallRVA:'0x0598E8E4',
    dispatcherSlotArgument:39,
    directRescheduleCall:false,indirectRescheduleViaDispatcherVerified:false,
    pickupOutcomeVerified:false,saveWriteVerified:false
  }),
  gridStateReadDisambiguation:Object.freeze({
    method:'ItemSpawning.Execute',
    accessorCallRVA:'0x057BC5BC',
    accessorTargetRVA:'0x04E66530',
    nextLoadRVA:'0x057BC5C4',
    nextLoadOpcode:'0xF9401414',
    nextLoadSemantic:'LDR X20,[X0,#0x28]',
    amountWithStateType:'Definitions.Items.AmountWithState',
    amountFieldOffset:'0x18',
    stateFieldOffset:'0x20',
    assignedPlayerFieldOffset:'0x28',
    observedSubfield:'AssignedPlayer',
    observedIsAmountField:false,
    provesSceneItemCount:false,
    objectCountViaIndirectDispatchResolved:false
  }),
  diffGridObjectCountBoundary:Object.freeze({
    concreteType:'Meta.Grids.DiffGrid',
    objectCountEntryRVA:'0x04E8DA90',
    predicateCountCoreRVA:'0x04E8DAA0',
    defaultGridFieldOffset:'0x58',
    modifiedObjectsFieldOffset:'0x40',
    removedObjectsFieldOffset:'0x48',
    nextGridObjectIdFieldOffset:'0x50',
    defaultGridLoadRVA:'0x04E8DBA8',
    removedObjectsLoadRVA:'0x04E8DBE8',
    baseCountReadRVA:'0x04E8DBF8',
    removedCountReadRVA:'0x04E8DBFC',
    baseMinusRemovedRVA:'0x04E8DC00',
    modifiedObjectsLoadRVA:'0x04E8DC08',
    conditionalModifiedCountIncrementRVA:'0x04E8DF04',
    stage:'STATIC_ONLY',
    countOnlyModifiedObjectsIsValid:false,
    defaultObjectMayBeFilteredByRemovedObjects:true,
    directlyReachedFromW1ExecuteVerified:false,
    W1IndirectObjectCountDispatchResolved:false,
    liveAreaPopulationVerified:false
  }),
  diffGridConditionalAddObject:Object.freeze({
    interfaceMethod:'Meta.Grids.IGridInternal.AddObject',
    implementationRVA:'0x04E8BC70',
    innerAddObjectRVA:'0x04E8BEA0',
    nextObjectIdLoadRVA:'0x04E8BDB4',
    nextObjectIdIncrementRVA:'0x04E8BDB8',
    nextObjectIdStoreRVA:'0x04E8BDBC',
    gridObjectIdentityStoreRVA:'0x04E8BDC8',
    gridObjectIdFieldOffset:'0x18',
    gridObjectItemIdFieldOffset:'0x1C',
    nextObjectIdFieldOffset:'0x50',
    modifiedObjectsFieldOffset:'0x40',
    validationCallRVA:'0x04E8BF70',
    validationFailureBranchRVA:'0x04E8BF7C',
    modifiedObjectsLoadRVA:'0x04E8BF80',
    modifiedObjectsMapInsertRVA:'0x04E8BFA0',
    modifiedObjectsMapInsertTargetRVA:'0x03C13CF0',
    conditionalAllocationPathProvedByNative:true,
    sourceEventIdWrittenIntoGridObject:false,
    fromFieldProvenToBePopulated:false,
    directW1CallToThisConcreteImplementationVerified:false,
    runtimeSuccessfulPlacementObserved:false,
    postSavePersistenceVerified:false
  }),
  gridConsumerDirectCallScan:Object.freeze({
    scope:'Four checked v1.25.3 Execute instruction windows through immediate completion paths',
    directDiffGridOrGridObjectCountCalls:0,
    indirectBLRSeen:Object.freeze({ItemSpawning:33,WildCropsSpawningInVillage:12,
      FlowerSpawningInVillage:10,FishSpawningInVillage:0}),
    indirectInterfaceCountCallsResolved:false,
    zeroDirectCallsProvesNoCountChecks:false,
    directCodeDoesNotProveDisappearanceOfSpawnedObjects:true
  }),
  sourceIdentityWitnesses:Object.freeze([
    Object.freeze({eventId:2010000003,sourceName:'NightThornSpawningVillage!UrbanNightThornSpawn',hint:'ItemSpawning',serializedVariantConfirmed:false,concreteGridObjectIDConfirmed:false}),
    Object.freeze({eventId:2010000021,sourceName:'Wood!Wetland_Softwood',hint:'ItemSpawning',serializedVariantConfirmed:false,concreteGridObjectIDConfirmed:false}),
    Object.freeze({eventId:2010400001,sourceName:'UrbanWildCropSpawn',hint:'WildCropsSpawningInVillage',serializedVariantConfirmed:false,concreteGridObjectIDConfirmed:false}),
    Object.freeze({eventId:2010500008,sourceName:'UrbanDandelionYellow',hint:'FlowerSpawningInVillage',serializedVariantConfirmed:false,concreteGridObjectIDConfirmed:false})
  ]),
  w1GenerationConsumers:Object.freeze({
    ItemSpawning:Object.freeze({
      executeRVA:'0x057B9BC0',
      conditionsListEvaluateRVA:'0x057BAA10',
      sceneGridsReadRVA:'0x057BAC58',
      areaShouldSpawnRVA:'0x057BB090',
      itemAmountStateReadRVA:'0x057BC5BC',
      findValidPositionRVA:'0x057BE080',
      requestConstructRVA:'0x057BE6F8',
      conclusion:'Scene/condition/area/item-count/position and PlaceOnGrid request paths exist',
      placedGridObjectIdProven:false,liveObjectSpawnObserved:false
    }),
    WildCropsSpawningInVillage:Object.freeze({
      executeRVA:'0x057C2BC0',
      areaShouldSpawnRVA:'0x057C34C0',
      maxAmountRVA:'0x057C38E8',
      findValidPositionRVA:'0x057C3EE0',
      placementResultCallRVA:'0x057C4190',
      placementResultBranchRVA:'0x057C4194',
      placementFailureBypassRVA:'0x057C41D8',
      gridIdLoadRVA:'0x057C41A0',
      gridObjectIdLoadRVA:'0x057C41A8',
      setupGardenProductionRVA:'0x057C41D4',
      setupSignature:'CreateGardeningTile.SetupGardenProduction(Item seedItem, uint gridID, uint gridObjectID, ...)',
      conclusion:'Successful placement-result branch passes gridID and gridObjectID into production setup',
      placedGridObjectIdProvenForRuntime:false,liveObjectSpawnObserved:false
    }),
    FlowerSpawningInVillage:Object.freeze({
      executeRVA:'0x057C99E0',
      tryGetGridRVA:'0x057CA490',
      placementHelperRVA:'0x057CAFA0',
      placementCallRvas:Object.freeze(['0x057CAE20','0x057CAE38']),
      nestedFindValidPositionRVA:'0x057CB464',
      conclusion:'Two placement helper calls; inner helper searches for valid position and uses indirect grid methods',
      indirectAddObjectTargetResolved:false,liveObjectSpawnObserved:false
    }),
    FishSpawningInVillage:Object.freeze({
      executeRVA:'0x057C6890',
      areaLookupRVA:'0x057C6C34',
      waterCapacityRVA:'0x057C6C44',
      countPendingFishRVA:'0x057C6E68',
      rarityChoiceRVA:'0x057C6F94',
      addPendingFishRVA:'0x057C70F4',
      sourceDefinitionCandidatesKnownInactive:46,
      sourceDefinitionCandidatesAllInactive:true,
      conclusion:'Generates PendingFish records, not direct evidence of GridObject placement',
      liveRippleObserved:false,gridObjectIdProven:false
    })
  }),
  pendingFishDispatchConsumer:Object.freeze({
    worldEventInterface:'IWorldEventDispatcher.RaisePendingFishRemoved',
    interfaceSlot:39,
    profileDispatcherImplementationRVA:'0x05A8DB40',
    profileDispatcherEventFieldOffset:'0x1F8',
    fishingSystemHandlerRVA:'0x033FDB20',
    fishingSystemListFieldOffset:'0xA8',
    bodyOfWaterRemoveFishCallRVA:'0x033FDB5C',
    bodyOfWaterRemoveFishTargetRVA:'0x033E89F0',
    handlerSubscribedByRuntimeVerified:false,
    handlerDirectRescheduleCall:false,
    bodyOfWaterDirectRescheduleCall:false,
    indirectReschedulePathVerified:false,
    removedPendingFishIsGridObject:false,
    gameRuntimeObserved:false
  }),
  runtimeAcceptanceCases:Object.freeze([
    ['ItemSpawning','SOURCE_HINT_ONLY','due_empty_vs_existing_grid','record NextOccurrence, LastOccurrence, grid IDs, counts, actual appearance'],
    ['ItemSpawning','SOURCE_HINT_ONLY','manual_pickup_or_remove','record LastOccurrence, NextOccurrence, callbacks; compare before/after'],
    ['WildCropsSpawningInVillage','SOURCE_HINT_ONLY','due_empty_vs_max_gardens','record garden grid IDs, production states and exact quantity'],
    ['WildCropsSpawningInVillage','SOURCE_HINT_ONLY','harvest_then_reload','record garden tile removal, grid IDs and NextOccurrence'],
    ['FlowerSpawningInVillage','SOURCE_HINT_ONLY','due_empty_vs_max_flowers','record placement result, area and object IDs'],
    ['FlowerSpawningInVillage','SOURCE_HINT_ONLY','flower_pickup_then_reload','record removal, NextOccurrence, grid IDs and eventual regeneration'],
    ['FishSpawningInVillage','INACTIVE_SOURCE_ONLY','passive_pending_fish_add_remove','no activation; observe PendingFish IDs, body of water and alternate scheduler only'],
    ['PROTECTED_OR_UNKNOWN','BLOCKED','negative_no_mutation','Moonstone, TimeBending, W2, inactive, unknown and new schema remain blocked']
  ].map(([variant,eligibility,caseId,observations])=>Object.freeze({
    variant,eligibility,caseId,observations,
    originalOwnerSaveMutationAllowed:false,
    requiresSeparateHardwareAcceptance:true,passed:false
  }))),
  primaryBinary:Object.freeze({
    file:'DDVRE v1.25.3 ExeFS/main',bytes:96027926,
    mainSHA256:SOURCE.mainSHA256,moduleIdPrefix:SOURCE.buildId,
    textSHA256:SOURCE.nsoTextSHA256,
    rodataSHA256:'2a8f5c5c9203b9c42cf59cf540e0d017ff6bc9b6709c1c2c691241ffb508348c',
    dataSHA256:'c3ac6f93de050aafaacdcc9bf77d4712643726e25374ef0179823191cebb4ce6',
    verification:'RAW_NSO_REHASHED_AND_SECTIONS_MATCH_HEADER',
    provenance:'Private DDVRE ExeFS/main, Google Drive ID 1towEM6WrKL6ZMwepI76xyPfpzxuqS6BN; no raw bytes distributed',
    runtimeVerified:false
  }),
  directRescheduleCallsites:Object.freeze([
    ['ItemSpawning.Execute','0x057BF0C4'],
    ['WildCropsSpawningInVillage.Execute','0x057C4260'],
    ['FishSpawningInVillage.Execute','0x057C7110'],
    ['FlowerSpawningInVillage.Execute','0x057CAE58'],
    ['FlowerDryingInVillage.Execute','0x057CEC34'],
    ['ChooseVillageArea.Execute','0x057D1DE8'],
    ['MiningRockTurningSpecial.Execute','0x057D5378'],
    ['PendingFishUpgrade.Execute','0x05801D50'],
    ['ChooseItem.Execute','0x0580737C'],
    ['Profile.AddRecurringEvent','0x05A29F18']
  ].map(([method,rva])=>Object.freeze({method,rva}))),
  readiness:Object.freeze({rva:'0x05A65440',method:'IsReadyForNextOccurence',
    evidence:'0x05A65640 CMP X8,X9 / 0x05A65644 CSET W0,HS; time-eligibility predicate, not a complete spawn outcome'}),
  expiry:Object.freeze({rva:'0x05AF3050',method:'IsEventOver',
    evidence:'raw NSO: checks optional EndDate then compares NextOccurrence vs EndDate; strict NextOccurrence > EndDate (not context.Now > EndDate)',
    nextOccurrenceGetterSlot:1,endDateGetterSlot:3,
    maskedCompareRVA:'0x05AF3228',conditionRVA:'0x05AF3230',
    resultRVA:'0x05AF3234',condition:'masked NextOccurrence > masked EndDate',
    actualizeDirectCallRvas:Object.freeze(['0x05A2AF4C','0x05A2AF84','0x05A2B044','0x05A2B058']),
    saveEffectVerified:false,runtimeVerified:false}),
  reschedule:Object.freeze({rva:'0x05AF24D0',method:'IRecurringEventExtensions.Reschedule',
    evidence:'Raw main: 10 direct BL sites (9 Execute and 1 AddRecurringEvent); dispatch on Interval oneof; virtual setter slot 2 confirmed, runtime call reachability unknown',
    intervalOneofFieldLoadRVA:'0x05AF25E8',
    intervalDurationCompareRVA:'0x05AF25F8',
    intervalTimeOfDayCompareRVA:'0x05AF25F0',
    setterInterfaceSlotRVA:'0x05AF2C7C',
    setterArgumentRVA:'0x05AF2CA0',
    setterCallRVA:'0x05AF2CA4',
    setterDispatchIsStaticOnly:true}),
  actualize:Object.freeze({rva:'0x05A2A170',method:'Profile.ActualizeRecurringEvents',
    evidence:'interface slots GetMaxInterval=6, Now=0, NextOccurrence getter=1, setter=2; overdue clamp only; future-date release not shown'}),
  actualizeSourceConflict:Object.freeze({
    rva:'0x05A2AC94',reportedAsm:'mov x25, x0',reportedOpcode:'0xB002B8C8',
    independentlyDecodedMnemonic:'adrp x8',
    status:'RESOLVED_SOURCE_ANNOTATION_OFF_BY_4',
    correctedRVA:'0x05A2AC98',correctedOpcode:'0xAA0003F9',
    correctedAsm:'mov x25, x0',
    evidence:'Raw rehashed main: 0x05A2AC94 ADRP X8; 0x05A2AC98 MOV X25,X0. Both slot-6 getter paths join at 0x05A2AC94; X25 compared at 0x05A2AE24 and used at 0x05A2B42C. No runtime inference.'}),
  itemCatchup:Object.freeze({rva:'0x057C0140',method:'ItemSpawning.GetMaxIntervalToFullyExecute',
    evidence:'uses interval and amount bounds; not a universal cooldown rule'}),
  itemMaximum:Object.freeze({rva:'0x047AB7F0',method:'ItemSpawningRecurringEventItemData.GetMaximumAmount',
    evidence:'base maximum and optional area-choice maximum; not proof of actual grid population'}),
  itemExecuteCompletion:Object.freeze({entryRVA:'0x057B9BC0',method:'ItemSpawning.Execute completion-side',
    lastOccurrenceFromDateTimeRVA:'0x057BF058',lastOccurrenceStoreRVA:'0x057BF068',
    rescheduleCallRVA:'0x057BF0C4',
    evidence:'writes LastOccurrence field +0x30 before direct BL Reschedule; entry now verified by main/dump.cs; spawn-result prerequisites unresolved'}),
  flowerExecute:Object.freeze({rva:'0x057C99E0',method:'FlowerSpawningInVillage.Execute',
    evidence:'BL readiness predicate followed by TBNZ branch; effects and reschedule still require full trace'})
});
const trace=Object.freeze({
  ItemSpawning:Object.freeze({
    catchupBound:CATCHUP.ItemSpawning,
    executeRVA:'0x057B9BC0',readinessCallsiteVerified:true,
    readinessCallRvas:Object.freeze(['0x057BA660','0x057BA684']),
    rescheduleCallRVA:'0x057BF0C4',readinessFalseBypassesDirectReschedule:true,
    sourceGuards:Object.freeze([
      Object.freeze({rva:'0x057BAA10',method:'ConditionsList.Evaluate'}),
      Object.freeze({rva:'0x057BB090',method:'SpawnRecurringEventAreaSpecification.ShouldSpawn'}),
      Object.freeze({rva:'0x057BBD88',method:'ItemSpawningRecurringEventItemData.GetMaximumAmount'}),
      Object.freeze({rva:'0x057BC5BC',method:'GridState.get_ItemAmountState'})
    ]),
    catchupBoundRVA:NATIVE.itemCatchup.rva,maxAmountRVA:NATIVE.itemMaximum.rva,
    spawnedGridObjectProvenanceVerified:false
  }),
  WildCropsSpawningInVillage:Object.freeze({
    catchupBound:CATCHUP.WildCropsSpawningInVillage,
    executeRVA:'0x057C2BC0',readinessCallsiteVerified:true,
    readinessCallRvas:Object.freeze(['0x057C2FC8']),
    rescheduleCallRVA:'0x057C4260',readinessFalseBypassesDirectReschedule:true,
    sourceGuards:Object.freeze([
      Object.freeze({rva:'0x057C34C0',method:'SpawnRecurringEventAreaSpecification.ShouldSpawn'}),
      Object.freeze({rva:'0x057C38E8',method:'WildCropsSpawningInVillageRecurringEventItemData.GetMaximumAmount'}),
      Object.freeze({rva:'0x057C41D4',method:'CreateGardeningTile.SetupGardenProduction'})
    ]),
    catchupBoundRVA:CATCHUP.WildCropsSpawningInVillage.getterRVA,maxAmountRVA:'0x047BCFA0',
    spawnedGridObjectProvenanceVerified:false
  }),
  FlowerSpawningInVillage:Object.freeze({
    catchupBound:CATCHUP.FlowerSpawningInVillage,
    executeRVA:NATIVE.flowerExecute.rva,readinessCallsiteVerified:true,
    readinessCallRvas:Object.freeze(['0x057C9DD4','0x057C9DF4']),
    rescheduleCallRVA:'0x057CAE58',readinessFalseBypassesDirectReschedule:true,
    sourceGuards:Object.freeze([
      Object.freeze({rva:'0x057CA490',method:'GridCollection.TryGetGrid'}),
      Object.freeze({rva:'0x057CAE20',method:'FlowerSpawningInVillage.TryPlaceFlowers'}),
      Object.freeze({rva:'0x057CAE38',method:'FlowerSpawningInVillage.TryPlaceFlowers'})
    ]),
    catchupBoundRVA:CATCHUP.FlowerSpawningInVillage.getterRVA,maxAmountRVA:null,
    spawnedGridObjectProvenanceVerified:false
  }),
  FishSpawningInVillage:Object.freeze({
    catchupBound:CATCHUP.FishSpawningInVillage,
    executeRVA:'0x057C6890',readinessCallsiteVerified:false,
    readinessCallRvas:Object.freeze([]), // no direct BL to common readiness in exact Execute
    rescheduleCallRVA:'0x057C7110',readinessFalseBypassesDirectReschedule:null,
    sourceGuards:Object.freeze([
      Object.freeze({rva:'0x057C6C34',method:'ProfileWorld.TryGetVillageArea'}),
      Object.freeze({rva:'0x057C6C44',method:'FishSpawningInVillage.GetNumberOfNormalBodiesOfWaterInArea'}),
      Object.freeze({rva:'0x057C6E68',method:'FishSpawningInVillage.CountMatchingPendingFishForLocation'}),
      Object.freeze({rva:'0x057C70F4',method:'ProfileWorld.AddPendingFish'})
    ]),
    catchupBoundRVA:CATCHUP.FishSpawningInVillage.getterRVA,maxAmountRVA:null,
    spawnedGridObjectProvenanceVerified:false
  })
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
  operationAllowlisted:false,writerAuthorized:false,gridDeletionAuthorized:false,
  editedExportAuthorized:false,moonstoneMovementAuthorized:false
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
      sourceRecordEvidence:'CONFIRMED',
      nativePerEventEvidence:'UNKNOWN',variantConsumerStaticEvidence:'UNKNOWN',
      actualAppearanceEvidence:'UNKNOWN',operationEvidence:'BLOCKED',
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
        return Object.freeze({eventId,saveKind,status:'UNKNOWN_EVENT_ID',
          sourceRecordEvidence:'UNKNOWN',nativePerEventEvidence:'UNKNOWN',
          variantConsumerStaticEvidence:'UNKNOWN',
          actualAppearanceEvidence:'UNKNOWN',operationEvidence:'BLOCKED',...baseline});
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
        nativePerEventEvidence:
          (status==='PROTECTED_MOONSTONE_CHEST'||status==='NON_W1_SOURCE_POLICY'||status==='INACTIVE_SOURCE_DEFINITION')?'BLOCKED':'UNKNOWN',
        variantConsumerStaticEvidence:status==='SOURCE_VARIANT_HINT_ONLY'?'STATIC_ONLY':
          (status==='PROTECTED_MOONSTONE_CHEST'||status==='NON_W1_SOURCE_POLICY'||status==='INACTIVE_SOURCE_DEFINITION'?'BLOCKED':'UNKNOWN'),
        actualAppearanceEvidence:'UNKNOWN',operationEvidence:'BLOCKED',
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
    actualizeBranchReached:null,executePathVerified:false,
    afterExecuteRescheduleVerified:false,pickupRescheduleVerified:false,
    gameRestartRetentionVerified:false,...noAuthority
  });
}
