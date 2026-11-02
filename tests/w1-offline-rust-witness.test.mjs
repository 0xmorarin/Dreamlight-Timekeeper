import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {indexEvents,projectProfile,validTime} from '../src/reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';
import {compileW1NativeSemantics,analyzeW1StaticBranches} from '../src/timing-native-semantics.mjs';
import {assessMinimalW1WriteTargets} from '../src/w1-minimal-write-contract.mjs';
import {projectW1RustAdapterOracle} from '../src/w1-rust-adapter-oracle.mjs';

const file=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const vectors=await file('tests/fixtures/w1-offline-rust-witness-v1253.json');
const registry=await file('data/events-v1253.json');
const woodTagPack=await file('data/wand-iswood-crosswalk-v1253.json');
const rules=indexTimingReviewRules(await file('data/timing-review-rules-v1253.json'));
const sourceIndex=indexEvents(registry);
const ledger=compileW1NativeSemantics(registry,{woodTagPack});
const OLD=vectors.oldValueUtc,NEW=vectors.newValueUtc;
const mockSave=()=>({
 GameInfo:{Version:626},Player:{PrivateMarker:'UNCHANGED',Inventory:{Unknown:{nested:[1,true,null]}}},
 World:{RecurringEvents:Object.fromEntries(vectors.cases.map(c=>[String(c.savedIndex),{
  [c.oneof]:{RecurringEventItemID:c.eventId,NextOccurrence:OLD,EndDate:'2127-01-01T00:00:00Z',
   ...(c.oneof==='ItemSpawning'?{LastOccurrence:'2025-01-01T00:00:00Z'}:{})}
 }]))}
});
function review(save){
 return assessTimingSnapshot(projectProfile(save,sourceIndex,{now:Date.parse('2026-11-03T00:00:00Z')}),rules);
}
function request(save,eventId,target=NEW,snapshot=review(save)){
 const row=snapshot.rows.find(r=>r.id===eventId);
 assert(row,'Synthetic fixture EventID must be in the snapshot: '+eventId);
 return [{pointer:row.pointer,originalTime:row.time,targetTime:target}];
}
function compare(save,plan,snapshot=review(save)){
 const legacy=assessMinimalW1WriteTargets(save,snapshot,plan,registry,ledger);
 const dto=projectW1RustAdapterOracle({profile:save,snapshot,plan,registry,ledger});
 return {legacy,dto};
}
test('fixed provenance: source registry, build/schema, 4 distinct W1 identities and Rust structural-only flags',()=>{
 assert.equal(vectors.source.schema,626);
 assert.equal(vectors.source.bid,'9A239D3DB569756D');
 assert.equal(vectors.source.registrySha256,ledger.source.recurringSourceSHA256);
 assert.equal(vectors.source.mainSha256,ledger.source.mainSHA256);
 assert.equal(ledger.sourceEventCount,508);
 assert.equal(vectors.cases.length,4);
 assert.deepEqual(vectors.cases.map(c=>c.oneof),[
  'ItemSpawning','WildCropsSpawningInVillage','FlowerSpawningInVillage','FishSpawningInVillage']);
 assert.equal(new Set(vectors.cases.map(c=>c.eventId)).size,4);
 assert.equal(new Set(vectors.cases.map(c=>c.savedIndex)).size,4);
 for(const key of ['registryEventSemanticsVerified','nativeSemanticsVerified',
  'requiredReferenceClosureComplete','encodeCopyAuthorized'])
  assert.equal(vectors.rustResearchWitnessShape[key],false);
 assert.equal(vectors.rustFixtureActualExecution,false);
 assert.equal(vectors.writerAuthorized,false);
});
test('four W1 source hints match existing Native subtype Execute and conditional Reschedule RVAs',()=>{
 for(const v of vectors.cases){
  const hint=ledger.query(v.eventId,v.oneof);
  assert.equal(hint.eventId,v.eventId);
  assert.equal(hint.saveKind,v.oneof);
  assert.equal(hint.trace.executeRVA,v.nativeExecuteRVA);
  assert.equal(hint.trace.rescheduleCallRVA,v.nativeRescheduleCallRVA);
  assert.equal(hint.trace.spawnedGridObjectProvenanceVerified,false);
  assert.equal(hint.nativePerEventEvidence,
   v.expectedJs==='DENY'?'BLOCKED':'UNKNOWN');
  if(v.expectedJs==='DENY')assert.equal(hint.status,'INACTIVE_SOURCE_DEFINITION');
  else assert.equal(hint.status,'SOURCE_VARIANT_HINT_ONLY');
  assert.equal(hint.writerAuthorized,false);
  assert.equal(hint.operationAllowlisted,false);
 }
});
test('shared saved timestamp Native Consumer route is static; a waiter is not proof of a spawn',()=>{
 const n=ledger.native;
 assert.equal(n.clientNextOccurrenceWaitLifecycle.eventDataOneofLoadRVA,'0x060B51B0');
 assert.equal(n.clientNextOccurrenceWaitLifecycle.timestampConversionCallRVA,'0x060B5388');
 assert.equal(n.clientNextOccurrenceWaitLifecycle.clockAppointmentCtorCallRVA,'0x060B53F0');
 assert.equal(n.recurringAppointmentToTransaction.transactionRequestIdStoreRVA,'0x060B5E7C');
 assert.equal(n.recurringAppointmentToTransaction.transactionRpcCallRVA,'0x060B5F30');
 assert.equal(n.recurringAppointmentToTransaction.transactionServerConsumerToW1SubtypeVerified,false);
 assert.equal(n.recurringAppointmentToTransaction.actualGridMutationAndPersistenceVerified,false);
 assert.equal(n.recurringWaitRecreationCallsites.startOrProfileSet.waitForRecurringEventsRVA,'0x060AA13C');
 assert.equal(n.recurringWaitRecreationCallsites.debugTimeSkip.debugOnlyPathNotAuthorizedProductFlow,true);
 assert.equal(n.clientNextOccurrenceWaitLifecycle.exactWaiterCancellationRaceResolved,false);
 assert.equal(n.clientNextOccurrenceWaitLifecycle.gameRestartRestorationVerified,false);
 assert.equal(n.nextOccurrenceSetterCallGraph.setterDirectlyEmitsSlot62,false);
 assert.equal(n.recurringEventClientDispatchGuards.earlyReturnWhenBlockFlagNonzero,true);
 assert.equal(n.clockAppointmentEvaluation.existingAppointmentReReadsRecurringEventTimestamp,false);
});
test('Now equality in readiness differs from existing Clock appointment strict expiry',()=>{
 const n=ledger.native.clockAppointmentEvaluation;
 assert.equal(n.strictDueCondition,'appointmentMaskedDateTime < currentProviderMaskedNow');
 assert.equal(n.deadlineEqualsNowTriggersCompletion,false);
 for(const v of vectors.cases){
  const q=analyzeW1StaticBranches(ledger,{eventId:v.eventId,saveKind:v.oneof,
   nowTicks:100n,nextOccurrenceTicks:100n,maxIntervalTicks:20n});
  if(v.expectedJs==='DENY'){
   assert.equal(q.status,'EVENT_OUTSIDE_STATIC_W1_BRANCH_SCOPE');
   assert.equal(q.readinessCondition,null);
  }else{
   assert.equal(q.status,'STATIC_PREDICATE_MODEL_ONLY');
   assert.equal(q.readinessCondition,true); // Now >= NextOccurrence
   assert.equal(q.overdueClampCondition,false);
   assert.equal(q.spawnObserved,false);
  }
 }
 assert.equal(n.directOSClockTimeSourceConfirmed,false);
 assert.equal(n.timezoneAndDSTBehaviorConfirmed,false);
});
test('synthetic saved EventID/index/oneof map and Rust research DTO fields match JS oracle identities',()=>{
 const save=mockSave(),snapshot=review(save),before=JSON.stringify(save);
 for(const v of vectors.cases){
  const {legacy,dto}=compare(save,request(save,v.eventId,NEW,snapshot),snapshot);
  assert.equal(dto.decisions.length,1);
  const decision=dto.decisions[0],sel=decision.selector;
  // Adapts existing JS oracle into the exact Rust research W1Identity field names.
  // This is a shape comparison, NOT an actual Rust test invocation.
  const rustInput={event_id:sel.sourceEventId,saved_index:sel.savedIndex,variant:sel.savedOneofVariant};
  assert.deepEqual(rustInput,{event_id:v.eventId,saved_index:v.savedIndex,variant:v.oneof});
  const rowPointer='/World/RecurringEvents/'+rustInput.saved_index;
  assert.equal(sel.jsonPointer,rowPointer+'/'+rustInput.variant+'/NextOccurrence');
  assert.equal(sel.jsonPointer.slice(0,-'/NextOccurrence'.length)+'/RecurringEventItemID',
   rowPointer+'/'+v.oneof+'/RecurringEventItemID');
  assert.equal(decision.comparison.expectedOldUtc,OLD);
  assert.equal(decision.comparison.requestedNewUtc,NEW);
  assert.equal(decision.nativeEvidence.nativeExecuteRVA,v.nativeExecuteRVA);
  assert.equal(decision.nativeEvidence.nativeRescheduleCallRVA,v.nativeRescheduleCallRVA);
  assert.equal(decision.nativeEvidence.nativeEventIdSpecificExecution,'UNKNOWN');
  assert.equal(decision.nativeEvidence.independentRuntimeAcceptance,false);
  assert.equal(decision.verdict,v.expectedJs);
  assert.equal(legacy.rows[0].targetStructurallyEligible,v.expectedJs==='STRUCTURAL_CANDIDATE');
  assert.equal(dto.writerAuthorized,false);
  assert.equal(dto.capabilityGranted,false);
  if(v.expectedJs==='DENY'){
   assert.equal(dto.status,'DENIED');
   assert.deepEqual(dto.operations,[]);
  }else{
   assert.equal(dto.status,'STRUCTURAL_CANDIDATE_ONLY');
   assert.equal(dto.operations.length,1);
   assert.equal(dto.operations[0].savedIndex,v.savedIndex);
   assert.equal(dto.operations[0].requiredCapability,'ENCODE_COPY');
   assert.equal(dto.operations[0].capabilityGranted,false);
  }
 }
 assert.equal(JSON.stringify(save),before);
});
test('all four kinds are atomic: inactive Fish keeps three structural candidates from becoming a write',()=>{
 const save=mockSave(),snapshot=review(save);
 const plan=vectors.cases.map(v=>request(save,v.eventId,NEW,snapshot)[0]);
 const {legacy,dto}=compare(save,plan,snapshot);
 assert.equal(legacy.status,'BLOCKED_W1_WRITE_TARGETS');
 assert.equal(dto.status,'DENIED');
 assert.deepEqual(dto.operations,[]);
 assert.deepEqual(dto.decisions.map(d=>d.verdict),
  ['STRUCTURAL_CANDIDATE','STRUCTURAL_CANDIDATE','STRUCTURAL_CANDIDATE','DENY']);
 assert.equal(dto.writerAuthorized,false);
});
test('stale saved EventID, duplicate oneof, wrong index and old-value CAS cannot generate a candidate',()=>{
 const save=mockSave(),snapshot=review(save),v=vectors.cases[0],original=request(save,v.eventId,NEW,snapshot);
 save.World.RecurringEvents['7'].ItemSpawning.RecurringEventItemID=2010500008;
 assert.equal(compare(save,original,snapshot).dto.status,'DENIED');
 save.World.RecurringEvents['7'].ItemSpawning.RecurringEventItemID=v.eventId;
 save.World.RecurringEvents['7'].FlowerSpawningInVillage={RecurringEventItemID:2010500008,NextOccurrence:OLD};
 assert.equal(compare(save,original,snapshot).dto.status,'DENIED');
 delete save.World.RecurringEvents['7'].FlowerSpawningInVillage;
 save.World.RecurringEvents['7'].ItemSpawning.NextOccurrence='2025-01-01T00:00:00Z';
 assert.equal(compare(save,original,snapshot).dto.status,'DENIED');
 save.World.RecurringEvents['7'].ItemSpawning.NextOccurrence=OLD;
 const wrong=[{...original[0],pointer:'/World/RecurringEvents/8/WildCropsSpawningInVillage/NextOccurrence'}];
 assert.equal(compare(save,wrong,snapshot).dto.status,'DENIED');
});
test('NoOp, invalid UTC, and intentional 2126 scheduling remain distinct',()=>{
 const save=mockSave(),snap=review(save),eventId=vectors.cases[0].eventId;
 for(const d of ['2022-09-06T00:00:00Z','2127-02-01T00:00:00Z','2026-11-03T00:00:00Z']){
  assert.equal(validTime(d),true,d);
  const x=compare(save,request(save,eventId,d,snap),snap).dto;
  assert.equal(x.status,'STRUCTURAL_CANDIDATE_ONLY');
  assert.equal(x.ownerFutureDateIsCorruption,false);
  assert.equal(x.operations[0].capabilityGranted,false);
 }
 assert.equal(compare(save,request(save,eventId,OLD,snap),snap).dto.status,'DENIED');
 for(const d of ['2026-02-30T00:00:00Z','2026-13-01T00:00:00Z','not-a-time']){
  assert.equal(validTime(d),false);
  assert.equal(compare(save,request(save,eventId,d,snap),snap).dto.status,'DENIED');
 }
});
test('timestamps are the only structural target: LastOccurrence, EndDate and nested unknowns unchanged',()=>{
 const save=mockSave(),snap=review(save),initial=JSON.stringify(save);
 const r=compare(save,request(save,vectors.cases[0].eventId,NEW,snap),snap).dto;
 assert.equal(r.operations.length,1);
 assert(r.operations[0].jsonPointer.endsWith('/NextOccurrence'));
 assert.equal(r.operations[0].allowedMutation,'REPLACE_EXISTING_TIMESTAMP_TOKEN_ONLY');
 assert.equal(JSON.stringify(save),initial);
 assert.equal(save.World.RecurringEvents['7'].ItemSpawning.LastOccurrence,'2025-01-01T00:00:00Z');
 assert.equal(save.World.RecurringEvents['7'].ItemSpawning.EndDate,'2127-01-01T00:00:00Z');
 assert.equal(save.Player.PrivateMarker,'UNCHANGED');
 assert.equal(r.gridDeletionAllowed,false);
 assert.equal(r.moonstoneRelocationAllowed,false);
 assert.equal(r.originalSourceOverwriteAllowed,false);
});
test('protected IDs and unknown Oneof remain excluded independently of Rust structural ability',()=>{
 const save=mockSave();
 for(const [index,kind,id] of [
  [11,'ItemSpawning',2010000064],
  [12,'ItemSpawning',2010000093],
  [13,'ItemSpawning',2010000120],
  [14,'SnippetSpawning',2011300000]
 ]){
  save.World.RecurringEvents[String(index)]={[kind]:{RecurringEventItemID:id,NextOccurrence:OLD}};
 }
 const snap=review(save);
 for(const id of [2010000064,2010000093,2010000120,2011300000]){
  const r=compare(save,request(save,id,NEW,snap),snap).dto;
  assert.equal(r.status,'DENIED');
  assert.deepEqual(r.operations,[]);
 }
});
