// 02 TIME / SHA-pinned Native V3 narrow negative controls.
//
// The 4-byte opcode words are analysis DERIVATIVES from the SHA-checked,
// privately held Switch v1.25.3 NSO; no game binary/dump/source is bundled.
// Tests independently reconstruct two branch targets and their signed
// predicates. This does NOT execute Native game code or grant an edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileW1NativeSemantics,analyzeW1StaticBranches} from '../src/timing-native-semantics.mjs';

const readData=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const definitions=await readData('events-v1253.json');
const verifiedWood=await readData('wand-iswood-crosswalk-v1253.json');
const ledger=compileW1NativeSemantics(definitions,{woodTagPack:verifiedWood});
const n=ledger.native;
const observed=[
 {eventId:2010000021,kind:'ItemSpawning',execute:'0x057B9BC0',reschedule:'0x057BF0C4',status:'SOURCE_VARIANT_HINT_ONLY'},
 {eventId:2010400001,kind:'WildCropsSpawningInVillage',execute:'0x057C2BC0',reschedule:'0x057C4260',status:'SOURCE_VARIANT_HINT_ONLY'},
 {eventId:2010500008,kind:'FlowerSpawningInVillage',execute:'0x057C99E0',reschedule:'0x057CAE58',status:'SOURCE_VARIANT_HINT_ONLY'},
 {eventId:2010200014,kind:'FishSpawningInVillage',execute:'0x057C6890',reschedule:'0x057C7110',status:'INACTIVE_SOURCE_DEFINITION'}
];
function decodeSubOrCompare(word){
 const opcode=(word&0xffe0fc00)>>>0; // JS bitwise op is signed i32
 assert([0xcb000000,0xeb000000].includes(opcode),
  'Expected signed 64-bit SUB or SUBS/CMP (shifted-register form)');
 return {kind:opcode===0xcb000000?'SUB':'CMP',
  rd:word&31,rn:(word>>>5)&31,rm:(word>>>16)&31};
}
function decodeBCond(word,pc){
 assert.equal(word&0xff000010,0x54000000,'Expected AArch64 B.cond');
 let imm19=(word>>>5)&0x7ffff;
 if(imm19&0x40000)imm19-=0x80000;
 return {condition:word&15,target:pc+imm19*4};
}
const TICKS_EPOCH=621355968000000000n;
const ticks=s=>TICKS_EPOCH+BigInt(Date.parse(s))*10000n;
const now=ticks('2026-11-03T00:00:00Z');
const year100=ticks('2126-08-20T00:00:00Z');
const later=ticks('2127-01-01T00:00:00Z');
const early=ticks('2022-09-06T00:00:00Z');
const illustrativeMax=30n*24n*3600n*10000000n; // NOT event's actual max interval.

test('verified exact NSO/text identity and signed Actualize overdue guards (no binary in CI)',()=>{
 assert.equal(ledger.source.mainSHA256,'16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a');
 assert.equal(ledger.source.nsoTextSHA256,'15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328');
 assert.equal(ledger.source.buildId,'9A239D3DB569756D');
 // Native 0x05A2AE20 SUB X8,X8,X9 ; 0x05A2AE24 CMP X8,X25 ;
 // 0x05A2AE28 B.LE to 0x05A2AF00 skips overdue clamp.
 assert.deepEqual(decodeSubOrCompare(0xcb090108),
  {kind:'SUB',rd:8,rn:8,rm:9});
 assert.deepEqual(decodeSubOrCompare(0xeb19011f),
  {kind:'CMP',rd:31,rn:8,rm:25});
 assert.deepEqual(decodeBCond(0x540006cd,0x05A2AE28),
  {condition:0xd,target:0x05A2AF00}); // signed LE
 // Native 0x05A2AEF4 SUB ; 0x05A2AEF8 CMP ;
 // 0x05A2AEFC B.GT back to 0x05A2AE2C enters correction.
 assert.deepEqual(decodeBCond(0x54fff98c,0x05A2AEFC),
  {condition:0xc,target:0x05A2AE2C}); // signed GT
 assert.equal(n.actualize.rva,'0x05A2A170');
 assert.equal(n.actualizeSourceConflict.status,'RESOLVED_SOURCE_ANNOTATION_OFF_BY_4');
 assert.equal(n.actualizeSourceConflict.correctedRVA,'0x05A2AC98');
 assert.equal(n.actualizeSourceConflict.correctedAsm,'mov x25, x0');
 assert.equal(n.actualize.evidence.includes('overdue clamp only'),true);
});

test('future 2126/2127 cannot take confirmed >max overdue branch; 2022 depends on real max',()=>{
 assert(early<now && now<year100 && year100<later);
 for(const row of observed){
  const base={eventId:row.eventId,saveKind:row.kind,nowTicks:now};
  if(row.status==='INACTIVE_SOURCE_DEFINITION'){
   const no=analyzeW1StaticBranches(ledger,{...base,nextOccurrenceTicks:year100,
    maxIntervalTicks:illustrativeMax});
   assert.equal(no.status,'EVENT_OUTSIDE_STATIC_W1_BRANCH_SCOPE');
   assert.equal(no.overdueClampCondition,null);
   assert.equal(no.operationAllowlisted,false);
   continue;
  }
  for(const next of [year100,later]){
   const s=analyzeW1StaticBranches(ledger,{...base,nextOccurrenceTicks:next,
    maxIntervalTicks:illustrativeMax});
   assert.equal(s.status,'STATIC_PREDICATE_MODEL_ONLY');
   assert.equal(s.readinessCondition,false);
   assert.equal(s.overdueClampCondition,false);
   assert.equal(s.actualizeBranchReached,null);
   assert.equal(s.spawnObserved,false);
   assert.equal(s.writerAuthorized,false);
  }
  const unknown=analyzeW1StaticBranches(ledger,{...base,nextOccurrenceTicks:early});
  assert.equal(unknown.readinessCondition,true);
  assert.equal(unknown.overdueClampCondition,null,'Actual event max interval unmeasured');
  const smaller=analyzeW1StaticBranches(ledger,{...base,nextOccurrenceTicks:early,
    maxIntervalTicks:illustrativeMax});
  assert.equal(smaller.overdueClampCondition,true);
  const longer=analyzeW1StaticBranches(ledger,{...base,nextOccurrenceTicks:early,
    maxIntervalTicks:10n*365n*24n*3600n*10000000n});
  assert.equal(longer.overdueClampCondition,false);
 }
});

test('exact-Now boundary: static W1 readiness is inclusive, local Clock expiry strict',()=>{
 assert.equal(n.readiness.rva,'0x05A65440');
 assert.equal(n.clockAppointmentEvaluation.strictDueCondition,
  'appointmentMaskedDateTime < currentProviderMaskedNow');
 assert.equal(n.clockAppointmentEvaluation.deadlineEqualsNowTriggersCompletion,false);
 const atNow=analyzeW1StaticBranches(ledger,{eventId:2010000021,
  saveKind:'ItemSpawning',nowTicks:now,nextOccurrenceTicks:now,maxIntervalTicks:illustrativeMax});
 assert.equal(atNow.readinessCondition,true);
 assert.equal(atNow.overdueClampCondition,false);
 assert.equal(atNow.gameRestartRetentionVerified,false);
 assert.equal(atNow.afterExecuteRescheduleVerified,false);
 assert.equal(n.clockAppointmentEvaluation.directOSClockTimeSourceConfirmed,false);
 assert.equal(n.clockAppointmentEvaluation.timezoneAndDSTBehaviorConfirmed,false);
});

test('four W1 per-operation sources remain STATIC_ONLY, not a cross-domain edit authority',()=>{
 for(const row of observed){
  const source=ledger.query(row.eventId,row.kind),trace=ledger.traces[row.kind];
  assert.equal(source.status,row.status);
  assert.equal(trace.executeRVA,row.execute);
  assert.equal(trace.rescheduleCallRVA,row.reschedule);
  assert.equal(source.operationAllowlisted,false);
  assert.equal(source.writerAuthorized,false);
  assert.equal(source.nativeExecuteLifecycleVerified,false);
  assert.equal(source.pickupOrRemovalRescheduleVerified,false);
  assert.equal(source.spawnedGridObjectIdentityVerified,false);
  assert.equal(source.gridDeletionAuthorized,false);
  assert.equal(source.userFutureTimestampIsCorruption,false);
 }
 assert.equal(n.fieldLayout.itemSpawningOnlyLastOccurrence.onlyW1VariantWithThisSerializedField,true);
 assert.equal(n.itemExecuteCompletion.lastOccurrenceStoreRVA,'0x057BF068');
 assert.equal(n.itemExecuteCompletion.rescheduleCallRVA,'0x057BF0C4');
 assert.equal(n.pendingFishRemoval.dispatcherSlotArgument,39);
 assert.equal(n.pendingFishRemoval.indirectRescheduleViaDispatcherVerified,false);
 assert.equal(n.clientRecurringRescheduleNotification.notificationFiredByEverySetterVerified,false);
 assert.equal(n.clientRecurringRescheduleNotification.actualizeRaisesRescheduleNotificationVerified,false);
 assert.equal(n.clientRecurringEventRemovalLifecycle.invocationOnTimestampEditVerified,false);
});

test('source-only IDs, private-save Index155 and protected IDs do not become each other',()=>{
 // Index155 is cited from independent QR343 private V1/V2 receipt, NOT
 // recomputed from a bundled save. These are example scoped descriptors only.
 const id=2010000021,index=155,kind='ItemSpawning';
 const pointer='/World/RecurringEvents/'+index+'/'+kind+'/NextOccurrence';
 assert.equal(pointer,'/World/RecurringEvents/155/ItemSpawning/NextOccurrence');
 assert.equal(ledger.query(id,kind).sourceRecordEvidence,'CONFIRMED');
 assert.equal(ledger.query(index,kind).status,'UNKNOWN_EVENT_ID');
 for(const [x,variant] of [
  [2010000064,'ItemSpawning'],
  [2010000093,'ItemSpawning'],
  [2010000120,'ItemSpawning'],
  [2011300000,'SnippetSpawning'],
  [2010200014,'FishSpawningInVillage'],
  [999999999,'ItemSpawning']
 ]){
  const q=ledger.query(x,variant);
  assert.notEqual(q.status,'SOURCE_VARIANT_HINT_ONLY');
  assert.equal(q.writerAuthorized,false);
 }
});
