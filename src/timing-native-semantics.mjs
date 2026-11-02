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
  itemOwnerGroupedCount:Object.freeze({
    helperName:'ItemSpawning.<Execute>g__IncNumberOfItemsOnValidGrid|50_15',
    helperRVA:'0x057BF720',
    directCallsites:Object.freeze(['0x057BC0EC','0x057BC5EC']),
    argumentType:'Nullable<int> playerId',
    closureField:'numberOfItemsOnValidGrid',
    closureType:'Dictionary<int,int>',
    dictionaryReadCallRVA:'0x057BF82C',
    dictionaryReadTargetRVA:'0x03B56B30',
    existingCountIncrementRVA:'0x057BF850',
    dictionaryUpdateCallRVA:'0x057BF878',
    dictionaryUpdateTargetRVA:'0x03B51D40',
    amountWithStateAssignedPlayerRVA:'0x057BC5C4',
    recordedValueNotProofOfTotalGridObjects:true,
    runtimeGroupPopulationUnverified:true,
    activeConditionalEventAttributionUnverified:true
  }),
  wildCropsBoundedExistingCount:Object.freeze({
    method:'WildCropsSpawningInVillage.<Execute>g__CountTillMaximumAmount|0',
    helperRVA:'0x057C49A0',
    closureMaxField:'maximumAmount',
    closureMaxFieldOffset:'0x10',
    inputType:'Item seedItem',
    gridEnumerationSelectorRVA:'0x057C4810',
    gridSelectorInterfaceSlot:6,
    enumeratorCountInitRVA:'0x057C4D10',
    countIncrementRVA:'0x057C4E0C',
    countVsMaximumCompareRVA:'0x057C4E10',
    repeatIfBelowMaximumRVA:'0x057C4E14',
    returnCountRVA:'0x057C4E84',
    exactPerItemFilterAndEffectiveGridCompleteness:'UNKNOWN',
    isCappedEnumeratorNotNativeIntervalMax:true,
    successfulGardenSpawnObserved:false
  }),
  nextOccurrenceSetterCallGraph:Object.freeze({
    writeFieldOffset:'0x20',
    writeInstructionWord:'0xF8020C01',
    writeInstruction:'STR X1, [X0,#0x20]!',
    setters:Object.freeze([
      Object.freeze({kind:'ItemSpawning',entryRVA:'0x057B8AA0',writeRVA:'0x057B8AA8'}),
      Object.freeze({kind:'WildCropsSpawningInVillage',entryRVA:'0x057C1CC0',writeRVA:'0x057C1CC8'}),
      Object.freeze({kind:'FlowerSpawningInVillage',entryRVA:'0x057C8AE0',writeRVA:'0x057C8AE8'}),
      Object.freeze({kind:'FishSpawningInVillage',entryRVA:'0x057C58B0',writeRVA:'0x057C58B8'})
    ]),
    eachSetterWindowBytes:0x50,
    eachSetterDirectBLCalls:0,
    eachSetterIndirectBLRCalls:0,
    postStorePath:'GC write-barrier/card-table update and return',
    setterDirectlyEmitsSlot62:false,
    callerCanEmitSeparateNotification:true,
    anySetterCausesClientWaitRearmVerified:false
  }),
  slot62EmissionSiteAudit:Object.freeze({
    slotRegisterWord:'0x528007C2',
    opcodeMeaning:'MOV W2,#62',
    checkedWindows:Object.freeze([
      Object.freeze({method:'Profile.AddRecurringEvent',entryRVA:'0x05A29920',endRVA:'0x05A2A170',movW2Slot62Rvas:Object.freeze(['0x05A2A0F0'])}),
      Object.freeze({method:'Profile.ActualizeRecurringEvents',entryRVA:'0x05A2A170',endRVA:'0x05A2B650',movW2Slot62Rvas:Object.freeze([])}),
      Object.freeze({method:'IRecurringEventExtensions.Reschedule',entryRVA:'0x05AF24D0',endRVA:'0x05AF2CC0',movW2Slot62Rvas:Object.freeze([])}),
      Object.freeze({method:'ItemSpawning.Execute',entryRVA:'0x057B9BC0',endRVA:'0x057BF180',movW2Slot62Rvas:Object.freeze([])}),
      Object.freeze({method:'WildCropsSpawningInVillage.Execute',entryRVA:'0x057C2BC0',endRVA:'0x057C42C0',movW2Slot62Rvas:Object.freeze([])}),
      Object.freeze({method:'FlowerSpawningInVillage.Execute',entryRVA:'0x057C99E0',endRVA:'0x057CAED0',movW2Slot62Rvas:Object.freeze([])}),
      Object.freeze({method:'FishSpawningInVillage.Execute',entryRVA:'0x057C6890',endRVA:'0x057C7190',movW2Slot62Rvas:Object.freeze([])})
    ]),
    absenceOfInstructionDoesNotExcludeVirtualOrIndirectNotification:true,
    actualizeClientNotificationVerified:false,
    executeClientNotificationVerified:false
  }),
  clockAppointmentEvaluation:Object.freeze({
    type:'Meta.Util.Clock',
    clockUpdateRVA:'0x05BB4D30',
    clockPausedLoadRVA:'0x05BB4E08',
    clockPausedFieldOffset:'0x28',
    clockPausedSkipBranchRVA:'0x05BB4E0C',
    clockAppointmentsFieldOffset:'0x10',
    currentTimeProviderFieldOffset:'0x18',
    timeZoneOffsetProviderFieldOffset:'0x20',
    currentTimeProviderLoadRVA:'0x05BB4E30',
    currentTimeProviderInvokeRVA:'0x05BB4E48',
    nowTicksMaskRVA:'0x05BB4E70',
    appointmentDateTimeFieldOffset:'0x10',
    appointmentCancellationTokenOffset:'0x18',
    appointmentTaskCompletionSourceOffset:'0x20',
    appointmentDateTimeMaskRVA:'0x05BB4F68',
    deadlineCompareRVA:'0x05BB4F6C',
    deadlineSkipBranchRVA:'0x05BB4F70',
    strictDueCondition:'appointmentMaskedDateTime < currentProviderMaskedNow',
    deadlineEqualsNowTriggersCompletion:false,
    cancellationTrySetCanceledCallRVA:'0x05BB4F18',
    cancellationTrySetCanceledTargetRVA:'0x03979630',
    completionTrySetResultCallRVA:'0x05BB4F90',
    completionTrySetResultTargetRVA:'0x03979330',
    listRemoveAtCallRVA:'0x05BB4FA4',
    listRemoveAtTargetRVA:'0x03C08B50',
    providerInvokedAtEachNonPausedClockUpdate:true,
    existingAppointmentReReadsRecurringEventTimestamp:false,
    timezoneOffsetReadWithinUpdate:false,
    directOSClockTimeSourceConfirmed:false,
    timezoneAndDSTBehaviorConfirmed:false,
    realTimeTickFrequencyConfirmed:false,
    consoleClockJumpResultConfirmed:false
  }),
  clockClientPolling:Object.freeze({
    clientUpdateRVA:'0x0604C460',
    profilePresentGuardRVA:'0x0604C4F0',
    clocks:Object.freeze([
      Object.freeze({clientField:'Clock',offset:'0xF0',callRVA:'0x0604C500',opcode:'0x97EDA20C'}),
      Object.freeze({clientField:'ClockOnline',offset:'0xF8',callRVA:'0x0604C510',opcode:'0x97EDA208'}),
      Object.freeze({clientField:'ClockPortal',offset:'0x100',callRVA:'0x0604C52C',opcode:'0x17EDA201',tailBranch:true})
    ]),
    clockCtorRvas:Object.freeze(['0x0604A7EC','0x0604A980','0x0604AB20']),
    constructorCreatesThreeDistinctClockObjects:true,
    clientUpdateEntryCalledInRuntimeVerified:false,
    worldRecurringEventUsesMainClockConfirmed:true,
    updateLoopDoesNotRearmAppointments:true
  }),
  recurringEventClientDispatchGuards:Object.freeze({
    handlerRVA:'0x0604E9B0',
    blockFlagField:'blockRecurringEventReschedule',
    blockFlagOffset:'0x1D0',
    flagLoadRVA:'0x0604EA34',
    earlyReturnBranchRVA:'0x0604EA3C',
    branchTargetRVA:'0x0604EA58',
    earlyReturnWhenBlockFlagNonzero:true,
    isWorldAuthoritativeCallRVA:'0x0604EA5C',
    profileEventLookupRVA:'0x0604EB9C',
    handlerContainsDirectSetterCall:false,
    handlerIsNotProofOfSubscription:true
  }),
  recurringWaitRecreationCallsites:Object.freeze({
    startOrProfileSet:Object.freeze({
      stateMachine:'Client.<SetProfile>d__126.MoveNext',
      stateMachineRVA:'0x060A9B70',
      waitForRecurringEventsRVA:'0x060AA13C',
      targetRVA:'0x0604D9D0'
    }),
    debugTimeSkip:Object.freeze({
      stateMachine:'Client.<DebugSkipTime>d__553.MoveNext',
      stateMachineRVA:'0x060911E0',
      blockFlagSetRVA:'0x060912B8',
      blockFlagClearRVA:'0x06091580',
      waitReissueCallRVA:'0x060915E0',
      waitTargetRVA:'0x0604D9D0',
      debugOnlyPathNotAuthorizedProductFlow:true
    }),
    newProfileWaitEnumeratesCandidates:true,
    existingCTSGenerationAndCleanupAcrossReloadVerified:false,
    coldLoadAndRestartRuntimeVerified:false,
    noMutationOfOwnersActualSave:true
  }),
  clientNextOccurrenceWaitLifecycle:Object.freeze({
    waitEntryRVA:'0x0604E770',
    waitStateMachineRVA:'0x060B4D80',
    entryFromStartRecurringWaitLoopRVA:'0x0604E65C',
    entryFromRescheduledCallbackRVA:'0x0604EC7C',
    eventDataOneofLoadRVA:'0x060B51B0',
    timestampConversionCallRVA:'0x060B5388',
    timestampConversionTargetRVA:'0x03D92280',
    clockAppointmentCtorCallRVA:'0x060B53F0',
    clockAppointmentCtorTargetRVA:'0x05BB4950',
    clockAppointmentType:'Clock.Appointment(DateTime dateTime, CancellationToken ct)',
    clientRecurringEventCTSOffset:'0xE8',
    perEventSourceType:'Dictionary<uint,CancellationTokenSource>',
    profileCTSOffset:'0xC0',
    stateMachineSavedSourceOffset:'0x48',
    stateMachineLinkedSourceOffset:'0x50',
    recurringDictionaryLoadRVA:'0x060B5734',
    existingSourceLookupCallRVA:'0x060B57EC',
    existingSourceLookupTargetRVA:'0x03B56B30',
    existingSourceCancelCallRVA:'0x060B5838',
    existingSourceCancelTargetRVA:'0x0651D2F0',
    linkedSourceCreateCallRVA:'0x060B5AA4',
    linkedSourceCreateTargetRVA:'0x0651F5B0',
    dictionarySourceUpdateCallRVA:'0x060B59FC',
    dictionarySourceUpdateTargetRVA:'0x03B51D40',
    exactWaiterCancellationRaceResolved:false,
    automaticSavedTimestampChangeNotification:false,
    sceneSpawnAfterWaitVerified:false,
    gameRestartRestorationVerified:false
  }),
  clientRecurringEventRemovalLifecycle:Object.freeze({
    callback:'Client.OnRecurringEventRemoved',
    callbackRVA:'0x0604ECF0',
    dictionaryLoadRVA:'0x0604ED48',
    keyLookupCallRVA:'0x0604ED68',
    keyLookupTargetRVA:'0x03B56B30',
    cancellationNotifyRVA:'0x0604ED88',
    cancellationNotifyTargetRVA:'0x0651D2F0',
    disposalRVA:'0x0604ED98',
    disposalTargetRVA:'0x0651DA20',
    dictionaryRemoveCallRVA:'0x0604EDB4',
    dictionaryRemoveTargetRVA:'0x03B55A10',
    cancellationConditionalOnMatchingSource:true,
    invocationOnTimestampEditVerified:false,
    gameRuntimeObserved:false
  }),
  clientRecurringRescheduleNotification:Object.freeze({
    dispatcherInterface:'IWorldEventDispatcher.RaiseRecurringEventRescheduled',
    dispatcherInterfaceSlot:62,
    profileDispatcherMethodRVA:'0x05A8EC10',
    profileDispatcherDelegateFieldOffset:'0x208',
    clientHandlerRVA:'0x0604E9B0',
    clientHandlerEventLookupRVA:'0x0604EB9C',
    clientIsEventOverCalls:Object.freeze(['0x0604EBF8','0x0604EC0C']),
    clientWaitForNextOccurrenceCallRVA:'0x0604EC7C',
    waitForNextOccurrenceRVA:'0x0604E770',
    fishRemovedDispatcherInterfaceSlot:39,
    clientHandlerDirectRescheduleCall:false,
    profileAddRecurringEventRVA:'0x05A29920',
    profileAddNotificationSlotRVA:'0x05A2A0F0',
    profileAddNotificationSlotOpcode:'0x528007C2',
    profileAddNotificationVirtualCallRVA:'0x05A2A118',
    profileAddNotificationConditionalOnDispatcher:true,
    endDatePreventsClientWaitOnMatchedRecordByStaticBranch:true,
    actualizeRaisesRescheduleNotificationVerified:false,
    notificationFiredByEverySetterVerified:false,
    handlerSubscriptionRuntimeVerified:false,
    eventIdToConcreteSaveVariantVerified:false,
    normalSaveTimingVerified:false
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
    idAdvanceBeforeInnerPlacementValidation:true,
    idAdvanceEquatesSuccessfulPlacement:false,
    failedResultCounterRollbackVerified:false,
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
