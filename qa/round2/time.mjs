// 05 QR independent TIME acceptance; evaluated against immutable PR #7 HEAD.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {compileW1NativeSemantics,analyzeW1StaticBranches} from '../src/timing-native-semantics.mjs';
const source=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url)));
const wood=JSON.parse(await readFile(new URL('../data/wand-iswood-crosswalk-v1253.json',import.meta.url)));
const ledger=compileW1NativeSemantics(source,{woodTagPack:wood});
const cannotWrite=r=>{
 for(const key of ['writerAuthorized','operationAllowlisted','gridDeletionAuthorized','sourceBuildVerifiedFromSave',
  'sourceVariantHintVerifiedByNative','spawnAllocationVerified','pickupOrRemovalRescheduleVerified',
  'restartBehaviorVerified','sourceBinaryIndependentlyRehashed','userFutureTimestampIsCorruption',
  'nowGuaranteesImmediateSpawn','futureGuaranteesSuppression'])assert.equal(r[key],false,key);
};
test('QR-R2 TIME exact 508 ID inventory and fixed source fingerprint cannot grant permissions',()=>{
 assert.equal(ledger.sourceEventCount,508);
 assert.equal(ledger.rows.length,508);
 assert.equal(new Set(ledger.rows.map(x=>x.eventId)).size,508);
 assert.equal(ledger.source.platform,'Nintendo Switch');
 assert.equal(ledger.source.gameVersion,'1.25.3');
 assert.equal(ledger.source.buildId,'9A239D3DB569756D');
 assert.equal(ledger.source.saveSchema,626);
 assert.equal(ledger.source.recurringSourceSHA256,'028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea');
 assert.equal(ledger.source.mainSHA256,'16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a');
 assert.equal(ledger.source.evidence,'STATIC_ONLY');
 ledger.rows.forEach(cannotWrite);
});
test('QR-R2 TIME RVAs are build-scoped and incomplete consumer state is explicit',()=>{
 assert.equal(ledger.native.readiness.rva,'0x05A65440');
 assert.equal(ledger.native.reschedule.rva,'0x05AF24D0');
 assert.equal(ledger.native.actualize.rva,'0x05A2A170');
 assert.equal(ledger.native.expiry.rva,'0x05AF3050');
 assert.equal(ledger.traces.FlowerSpawningInVillage.executeRVA,'0x057C99E0');
 assert.equal(ledger.native.itemExecuteCompletion.entryRVA,null);
 for(const kind of ['ItemSpawning','WildCropsSpawningInVillage','FishSpawningInVillage']){
  assert.equal(ledger.traces[kind].executeRVA,null);
  assert.equal(ledger.traces[kind].readinessCallsiteVerified,false);
 }
 for(const row of ledger.rows){
  assert.equal(row.gridObjectProvenance,'UNKNOWN');
  assert.equal(row.conditionalEventHistoryDependency,'UNKNOWN');
  assert.equal(row.nativeExecuteLifecycleVerified,false);
 }
});
test('QR-R2 TIME inactive, Moonstone, TimeBending and W2 never become editable',()=>{
 for(const [id,kind,status] of [
  [2010000064,'ItemSpawning','PROTECTED_MOONSTONE_CHEST'],
  [2010200014,'FishSpawningInVillage','INACTIVE_SOURCE_DEFINITION'],
  [2010000093,'ItemSpawning','NON_W1_SOURCE_POLICY'],
  [2010000120,'ItemSpawning','NON_W1_SOURCE_POLICY'],
  [2011300000,'SnippetSpawning','NON_W1_SOURCE_POLICY']
 ]){
  const row=ledger.query(id,kind);assert.equal(row.status,status);cannotWrite(row);
 }
 for(const id of [2010000093,2010000120]){
  assert.equal(ledger.query(id,'ItemSpawning').areaChoiceMaximumReference,true);
 }
});
test('QR-R2 TIME unknown variant and wrong variant prevent source hint from masquerading as native evidence',()=>{
 const id=2010500008;
 const options=['ItemSpawning','WildCropsSpawningInVillage','FishSpawningInVillage','FutureNewSavedBranch',null];
 for(const kind of options){
  const r=ledger.query(id,kind);
  assert.notEqual(r.status,'SOURCE_VARIANT_HINT_ONLY');
  cannotWrite(r);
 }
 const genuine=ledger.query(id,'FlowerSpawningInVillage');
 assert.equal(genuine.status,'SOURCE_VARIANT_HINT_ONLY');
 cannotWrite(genuine);
 for(const unknown of [-1,0,NaN,2019999999,'2010500008']){
  const r=ledger.query(unknown,'FlowerSpawningInVillage');
  assert.equal(r.status,'UNKNOWN_EVENT_ID');
  // Unknown-ID responses expose the strict gate fields, not the normal row-only native hint.
  for(const key of ['writerAuthorized','operationAllowlisted','gridDeletionAuthorized',
   'sourceBuildVerifiedFromSave','nativeExecuteLifecycleVerified','futureGuaranteesSuppression'])
   assert.equal(r[key],false,key);
 }
});
test('QR-R2 TIME modified source provenance and missing Wand pack fail closed without mutating sources',()=>{
 const original=JSON.stringify(source),woodBefore=JSON.stringify(wood);
 for(const modified of [
  {...source,source:{...source.source,buildId:'UNKNOWN_BUILD'}},
  {...source,source:{...source.source,rawEventSHA256:'0'.repeat(64)}},
  {...source,events:source.events.slice(0,507)}
 ])assert.throws(()=>compileW1NativeSemantics(modified,{woodTagPack:wood}));
 assert.throws(()=>compileW1NativeSemantics(source,{woodTagPack:{...wood,sourceEventSha256:'0'.repeat(64)}}));
 assert.throws(()=>compileW1NativeSemantics(source));
 assert.equal(JSON.stringify(source),original);
 assert.equal(JSON.stringify(wood),woodBefore);
 assert.throws(()=>ledger.rows.push({}),TypeError);
});

test('QR-R2 TIME future/now/overdue are only bounded static predicates, never spawn results',()=>{
 const common={eventId:2010000021,saveKind:'ItemSpawning',nowTicks:1000n,maxIntervalTicks:300n};
 const future=analyzeW1StaticBranches(ledger,{...common,nextOccurrenceTicks:1100n});
 const equal=analyzeW1StaticBranches(ledger,{...common,nextOccurrenceTicks:1000n});
 const overdue=analyzeW1StaticBranches(ledger,{...common,nextOccurrenceTicks:699n});
 for(const r of [future,equal,overdue]){
  assert.equal(r.status,'STATIC_PREDICATE_MODEL_ONLY');
  assert.equal(r.writerAuthorized,false);
  assert.equal(r.operationAllowlisted,false);
  assert.equal(r.runtimeVerified,false);
  assert.equal(r.spawnObserved,false);
  assert.equal(r.afterExecuteRescheduleVerified,false);
  assert.equal(r.pickupRescheduleVerified,false);
  assert.equal(r.gameRestartRetentionVerified,false);
 }
 assert.equal(future.readinessCondition,false);
 assert.equal(future.overdueClampCondition,false);
 assert.equal(equal.readinessCondition,true);
 assert.equal(equal.overdueClampCondition,false);
 assert.equal(overdue.readinessCondition,true);
 assert.equal(overdue.overdueClampCondition,true);
});
test('QR-R2 TIME protected and unknown IDs cannot enter even a static branch',()=>{
 for(const [id,kind] of [[2010000064,'ItemSpawning'],[2010000093,'ItemSpawning'],
  [2010000120,'ItemSpawning'],[2010200014,'FishSpawningInVillage'],
  [2011300000,'SnippetSpawning'],[2010000021,'FutureUnknownVariant'],[2010009999,'ItemSpawning']]){
  const r=analyzeW1StaticBranches(ledger,{eventId:id,saveKind:kind,
   nowTicks:500n,nextOccurrenceTicks:600n,maxIntervalTicks:100n});
  assert.equal(r.status,'EVENT_OUTSIDE_STATIC_W1_BRANCH_SCOPE');
  assert.equal(r.readinessCondition,null);
  assert.equal(r.writerAuthorized,false);
  assert.equal(r.operationAllowlisted,false);
 }
});
test('QR-R2 TIME native tick operands require bounded bigint and are not inferred from saved ISO timestamps',()=>{
 const source={eventId:2010500008,saveKind:'FlowerSpawningInVillage',nowTicks:100n,nextOccurrenceTicks:50n};
 for(const invalid of [
  {nowTicks:'2026-11-02T00:00:00Z'},{nextOccurrenceTicks:-1n},
  {nowTicks:1n<<62n},{maxIntervalTicks:-1n},{maxIntervalTicks:1n<<62n}
 ])assert.throws(()=>analyzeW1StaticBranches(ledger,{...source,...invalid}),/bigint/);
 const unknown=analyzeW1StaticBranches(ledger,source);
 assert.equal(unknown.overdueClampCondition,null);
 assert.equal(unknown.actualizeBranchReached,null); // Unreached native path is UNKNOWN, not confirmed false
});
