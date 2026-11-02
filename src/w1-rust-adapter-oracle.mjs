// 02 TIME: narrow, non-mutating oracle for a future Wand-owned Rust Save Engine.
// Do not replace the shared serializer, trust UI metadata, or grant a Writer.
import {assessMinimalW1WriteTargets} from './w1-minimal-write-contract.mjs';

const freezeRows=rows=>Object.freeze(rows.map(r=>Object.freeze(r)));
const withId=registry=>{
  if(!Array.isArray(registry?.events))throw Error('W1_RUST_SOURCE_REGISTRY_REQUIRED');
  return new Map(registry.events.map(e=>[e.id,e]));
};
const evidenceFor=(ledger,row)=>{
  const trace=ledger.traces?.[row.variant];
  const event=row.eventId==null?null:ledger.query(row.eventId,row.variant);
  return Object.freeze({
    level:'STATIC_ONLY',
    sourceDefinitionEvidence:row.sourceRecordEvidence,
    nativeConsumerKind:trace?'VERSION_SCOPED_EXECUTE':'UNKNOWN',
    nativeExecuteRVA:trace?.executeRVA??null,
    nativeRescheduleCallRVA:trace?.rescheduleCallRVA??null,
    nativeReadinessCallsiteRvas:Object.freeze([...(trace?.readinessCallRvas??[])]),
    nativeMaxIntervalFormula:trace?.catchupBound?.formula??null,
    nativeCapSemantics:'TYPE_SCOPED_STATIC_ONLY',
    nativeAreaGridResult:'UNKNOWN',
    nativePickupRemoveReschedules:'UNKNOWN',
    nativeSpawnSuccess:'UNKNOWN',
    nativeEventIdSpecificExecution:'UNKNOWN',
    linkedGridObjectId:'UNKNOWN',
    nextOccurrenceSetterNotification:'NOT_IN_SETTER',
    nativeEventStatus:event?.status??'UNKNOWN_EVENT_ID',
    independentRuntimeAcceptance:false
  });
};
/**
 * Future Rust W1 adapter DTO v1. This does not resolve byte spans or edit data.
 * Inputs must be Worker/CORE-owned and match the current immutable source.
 * Rust CommonSaveEngine must locate spans and re-validate old value and identity.
 */
export function projectW1RustAdapterOracle({
  profile,snapshot,plan,registry,ledger
}={}){
  const review=assessMinimalW1WriteTargets(profile,snapshot,plan,registry,ledger);
  const defs=withId(registry);
  const decisions=freezeRows(review.rows.map(row=>{
    const source=defs.get(row.eventId);
    return {
      verdict:row.targetStructurallyEligible?'STRUCTURAL_CANDIDATE':'DENY',
      reason:row.code,
      selector:Object.freeze({
        sourceEventId:row.eventId,savedIndex:row.savedIndex,
        savedOneofVariant:row.variant,
        jsonPointer:row.pointer,
        linkedItemIds:Object.freeze([...row.linkedItemIds]),
        sourceDefinitionActive:source?.active===true,
        sourcePolicy:source?.eventPolicy??'UNKNOWN'
      }),
      comparison:Object.freeze({
        expectedOldUtc:row.originalTime??null,
        requestedNewUtc:row.targetTime??null,
        precondition:'EXACT_ORIGINAL_JSON_VALUE_AND_EVENT_ID_ONEOF_CAS',
        nextOccurrenceValueKind:'GOOGLE_PROTOBUF_TIMESTAMP_RFC3339_STRING',
        tokenSpanStatus:'COMMON_RUST_ENGINE_MUST_RESOLVE'
      }),
      nativeEvidence:evidenceFor(ledger,row),
      requiredCapability:row.targetStructurallyEligible?'ENCODE_COPY':'NONE',
      grantedCapabilities:Object.freeze([])
    };
  }));
  const allEligible=review.status==='STRUCTURAL_W1_TARGETS_ONLY';
  // Intentionally no ByteOffset/ByteLength, prepared bytes, source mutations,
  // runtime approval or guessed cross-grid origin.
  const changes=allEligible?freezeRows(review.candidateTargets.map(row=>({
    sourceEventId:row.eventId,
    savedIndex:row.savedIndex,
    savedOneofVariant:row.variant,
    jsonPointer:row.pointer,
    linkedItemIds:Object.freeze([...row.linkedItemIds]),
    oldValueUtc:row.originalTime,
    newValueUtc:row.targetTime,
    expectedChangedFieldCount:1,
    oldValueCASRequired:true,
    parsedJsonSpanRequired:true,
    allowedMutation:'REPLACE_EXISTING_TIMESTAMP_TOKEN_ONLY',
    requiredCapability:'ENCODE_COPY',
    capabilityGranted:false
  }))):Object.freeze([]);
  return Object.freeze({
    interfaceId:'dreamlight-timekeeper.w1-rust-semantic-adapter.v1',
    status:allEligible?'STRUCTURAL_CANDIDATE_ONLY':'DENIED',
    source:Object.freeze({
      platform:ledger.source.platform,gameVersion:ledger.source.gameVersion,
      buildId:ledger.source.buildId,saveSchema:ledger.source.saveSchema,
      definitionsCount:ledger.sourceEventCount,
      recurringSourceSha256:ledger.source.recurringSourceSHA256,
      mainSha256:ledger.source.mainSHA256,
      originalSaveSha256:'COMMON_ENGINE_MUST_VERIFY_SEPARATELY'
    }),
    provenanceEvidence:'SOURCE_AND_NATIVE_STATIC_ONLY',
    runtimeEvidence:review.ownerObservation.evidence,
    runtimePerEventIdConfirmed:false,
    ownerFutureDateIsCorruption:false,
    allOrNothing:true,
    operations:Object.freeze(changes),
    decisions,
    requiredCommonEngineGates:Object.freeze([
      'EXACT_SOURCE_SHA','EXPLICIT_BUILD_AND_SCHEMA','ORIGINAL_VALUE_CAS',
      'CANONICAL_ONEOF_AND_EVENT_ID','STRICT_JSON_SPAN','EXACT_DELTA',
      'UNRELATED_BYTES_PRESERVED_OR_REJECT','SINGLE_ENCODE_AND_INDEPENDENT_REOPEN',
      'OPERATION_SPECIFIC_CAPABILITY','INDEPENDENT_QR_ACCEPTANCE'
    ]),
    capabilityGranted:false,
    writerAuthorized:false,
    persistentReplaceAuthorized:false,
    originalSourceOverwriteAllowed:false,
    gridDeletionAllowed:false,
    moonstoneRelocationAllowed:false
  });
}
