import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';

const events=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const woodTagPack=JSON.parse(await readFile(new URL('../data/wand-iswood-crosswalk-v1253.json',import.meta.url),'utf8'));
const native=compileW1NativeSemantics(events,{woodTagPack});

test('508 exact v1.25.3 records are reused, not regenerated or authorized',()=>{
  assert.equal(native.sourceEventCount,508);
  assert.equal(native.rows.length,508);
  assert.equal(new Set(native.rows.map(r=>r.eventId)).size,508);
  assert.equal(native.source.buildId,'9A239D3DB569756D');
  assert.equal(native.source.mainSHA256,'16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a');
  assert(native.rows.every(r=>!r.writerAuthorized&&!r.gridDeletionAuthorized&&!r.operationAllowlisted));
  assert(native.rows.every(r=>!r.sourceVariantHintVerifiedByNative&&!r.spawnedGridObjectIdentityVerified));
  assert(native.rows.every(r=>!r.userFutureTimestampIsCorruption));
});
test('family-to-saved-variant is only a STATIC source hint, not a native execution proof',()=>{
  const cases=[
    [2010000003,'ItemSpawning','OBSTACLE_EVENT'],
    [2010000021,'ItemSpawning','WOOD_MATERIAL_EVENT'],
    [2010400001,'WildCropsSpawningInVillage','WILD_PLANT_EVENT'],
    [2010500008,'FlowerSpawningInVillage','FLOWER_EVENT']
  ];
  for(const [id,kind,family] of cases){
    const r=native.query(id,kind);
    assert.equal(r.sourceFamily,family);
    assert.equal(r.status,'SOURCE_VARIANT_HINT_ONLY');
    assert.equal(r.sourceVariantHintVerifiedByNative,false);
    assert.equal(r.nativeExecuteLifecycleVerified,false);
    assert.equal(r.futureGuaranteesSuppression,false);
    assert.equal(r.nowGuaranteesImmediateSpawn,false);
    assert.equal(r.pickupOrRemovalRescheduleVerified,false);
    assert.equal(r.restartBehaviorVerified,false);
  }
});
test('flower branch and global predicates are distinguished from untraced W1 consumers',()=>{
  assert.equal(native.native.readiness.rva,'0x05A65440');
  assert.equal(native.native.actualize.rva,'0x05A2A170');
  assert.equal(native.native.reschedule.rva,'0x05AF24D0');
  assert.equal(native.native.expiry.rva,'0x05AF3050');
  assert.equal(native.traces.FlowerSpawningInVillage.executeRVA,'0x057C99E0');
  assert.equal(native.traces.FlowerSpawningInVillage.readinessCallsiteVerified,true);
  for(const kind of ['ItemSpawning','WildCropsSpawningInVillage','FishSpawningInVillage']){
    assert.equal(native.traces[kind].executeRVA,null);
    assert.equal(native.traces[kind].readinessCallsiteVerified,false);
  }
  assert.equal(native.native.itemExecuteCompletion.entryRVA,null);
  assert.equal(native.native.itemExecuteCompletion.lastOccurrenceStoreRVA,'0x057BF068');
  assert.equal(native.native.itemExecuteCompletion.rescheduleCallRVA,'0x057BF0C4');
  assert.equal(native.traces.ItemSpawning.catchupBoundRVA,'0x057C0140');
  assert.equal(native.traces.ItemSpawning.maxAmountRVA,'0x047AB7F0');
});
test('Moonstone and inactive fishing/source records cannot inherit a W1 permit',()=>{
  assert.equal(native.query(2010000064,'ItemSpawning').status,'PROTECTED_MOONSTONE_CHEST');
  assert.equal(native.query(2010200014,'FishSpawningInVillage').status,'INACTIVE_SOURCE_DEFINITION');
  assert.equal(native.query(2011300000,'SnippetSpawning').status,'NON_W1_SOURCE_POLICY');
  assert.equal(native.query(2010000113,'ItemSpawning').status,'INACTIVE_SOURCE_DEFINITION');
  for(const id of [2010000064,2010200014,2011300000,2010000113])
    assert.equal(native.query(id,'ItemSpawning').writerAuthorized,false);
});
test('area-choice maximum references belong to HOLD TimeBending events, not W1',()=>{
  for(const id of [2010000093,2010000120]){
    const r=native.query(id,'ItemSpawning');
    assert.equal(r.areaChoiceMaximumReference,true);
    assert.equal(r.sourcePolicy,'HOLD');
    assert.equal(r.status,'NON_W1_SOURCE_POLICY');
    assert.equal(r.areaAndPopulationCapsVerified,false);
  }
});
test('wrong saved variant and unclassified source group stay unresolved',()=>{
  assert.equal(native.query(2010500008,'ItemSpawning').status,'SOURCE_VARIANT_HINT_CONFLICT');
  assert.equal(native.query(2010400001,'FishSpawningInVillage').status,'SOURCE_VARIANT_HINT_CONFLICT');
  assert.equal(native.query(2010000021,'FutureNewVariant').status,'UNRECOGNIZED_OR_NON_W1_SAVED_VARIANT');
  assert.equal(native.query(2010400001,null).status,'UNRECOGNIZED_OR_NON_W1_SAVED_VARIANT');
  assert.equal(native.query(2010009999,'ItemSpawning').status,'UNKNOWN_EVENT_ID');
});
test('exact source metadata, complete source inventory, and Wand isWood pack are mandatory',()=>{
  assert.throws(()=>compileW1NativeSemantics(events),/isWood/);
  assert.throws(()=>compileW1NativeSemantics({...events,source:{...events.source,buildId:'DIFFERENT'}},{woodTagPack}));
  assert.throws(()=>compileW1NativeSemantics({...events,source:{...events.source,rawEventSHA256:'WRONG'}},{woodTagPack}));
  assert.throws(()=>compileW1NativeSemantics({...events,events:events.events.slice(1)},{woodTagPack}));
  assert.throws(()=>compileW1NativeSemantics(events,{woodTagPack:{...woodTagPack,sourceEventSha256:'WRONG'}}));
});
test('source and results stay read only; future dates are not evaluated as anomalies',()=>{
  const original=JSON.stringify(events),wood=JSON.stringify(woodTagPack);
  assert.throws(()=>native.rows.push({}),TypeError);
  assert.throws(()=>native.query(2010500008,'FlowerSpawningInVillage').linkedItemIds.push(999),TypeError);
  assert.throws(()=>{native.traces.ItemSpawning.executeRVA='0x0';},TypeError);
  const a=native.query(2010000021,'ItemSpawning');
  assert.equal(a.userFutureTimestampIsCorruption,false);
  assert.equal(a.sourceBinaryIndependentlyRehashed,false);
  assert.equal(a.sourceBuildVerifiedFromSave,false);
  assert.equal(JSON.stringify(events),original);
  assert.equal(JSON.stringify(woodTagPack),wood);
});
