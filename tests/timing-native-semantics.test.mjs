import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileW1NativeSemantics,analyzeW1StaticBranches} from '../src/timing-native-semantics.mjs';

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
  const verifiedEntries={
    ItemSpawning:'0x057B9BC0',
    WildCropsSpawningInVillage:'0x057C2BC0',
    FlowerSpawningInVillage:'0x057C99E0',
    FishSpawningInVillage:'0x057C6890'
  };
  for(const [kind,rva] of Object.entries(verifiedEntries))
    assert.equal(native.traces[kind].executeRVA,rva);
  assert.equal(native.traces.ItemSpawning.readinessCallsiteVerified,true);
  assert.equal(native.traces.WildCropsSpawningInVillage.readinessCallsiteVerified,true);
  assert.equal(native.traces.FishSpawningInVillage.readinessCallsiteVerified,false);
  assert.equal(native.native.itemExecuteCompletion.entryRVA,'0x057B9BC0');
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


test('exact Native artifact separates NSO text fingerprint from full main SHA and BID',()=>{
  assert.equal(native.source.nsoTextSHA256,'15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328');
  assert.notEqual(native.source.nsoTextSHA256,native.source.mainSHA256);
  assert.notEqual(native.source.buildId,native.source.mainSHA256);
  assert.equal(native.source.saveSchema,626);
});
test('future schedule: reviewed readiness false and overdue correction branch false, never write authorization',()=>{
  const r=analyzeW1StaticBranches(native,{eventId:2010000021,saveKind:'ItemSpawning',
    nowTicks:1_000_000n,nextOccurrenceTicks:2_000_000n,maxIntervalTicks:300_000n});
  assert.equal(r.status,'STATIC_PREDICATE_MODEL_ONLY');
  assert.equal(r.readinessCondition,false);
  assert.equal(r.overdueClampCondition,false);
  assert.equal(r.actualizeBranchReached,null);
  assert.equal(r.runtimeVerified,false);
  assert.equal(r.writerAuthorized,false);
  assert.equal(r.spawnObserved,false);
  assert.equal(r.removedObjectsUnchangedByThisModel,true);
});
test('now matches reviewed predicate but does not prove spawn or event action',()=>{
  const r=analyzeW1StaticBranches(native,{eventId:2010500008,saveKind:'FlowerSpawningInVillage',
    nowTicks:1_000_000n,nextOccurrenceTicks:1_000_000n,maxIntervalTicks:300_000n});
  assert.equal(r.readinessCondition,true);
  assert.equal(r.overdueClampCondition,false);
  assert.equal(r.executePathVerified,false);
  assert.equal(r.afterExecuteRescheduleVerified,false);
  assert.equal(r.gameRestartRetentionVerified,false);
  assert.equal(r.operationAllowlisted,false);
});
test('overdue catch-up condition is strict greater-than, not greater-than-or-equal',()=>{
  const p={eventId:2010400001,saveKind:'WildCropsSpawningInVillage',
    nowTicks:1_000_000n,maxIntervalTicks:300_000n};
  const equal=analyzeW1StaticBranches(native,{...p,nextOccurrenceTicks:700_000n});
  const greater=analyzeW1StaticBranches(native,{...p,nextOccurrenceTicks:699_999n});
  assert.equal(equal.overdueClampCondition,false);
  assert.equal(greater.overdueClampCondition,true);
  assert.equal(greater.actualizeBranchReached,null);
  assert.equal(greater.pickupRescheduleVerified,false);
});
test('unknown catch-up interval is not silently guessed, even when readiness predicate is true',()=>{
  const r=analyzeW1StaticBranches(native,{eventId:2010000003,saveKind:'ItemSpawning',
    nowTicks:900n,nextOccurrenceTicks:100n});
  assert.equal(r.readinessCondition,true);
  assert.equal(r.overdueClampCondition,null);
  assert.equal(r.overdueClampIntervalKnown,false);
  assert.equal(r.runtimeVerified,false);
});
test('special, inactive, mismatched, and unknown IDs cannot enter a static branch model',()=>{
  const p={nowTicks:100n,nextOccurrenceTicks:200n,maxIntervalTicks:50n};
  const cases=[
    [2010000064,'ItemSpawning','PROTECTED_MOONSTONE_CHEST'],
    [2011300000,'SnippetSpawning','NON_W1_SOURCE_POLICY'],
    [2010000093,'ItemSpawning','NON_W1_SOURCE_POLICY'],
    [2010000120,'ItemSpawning','NON_W1_SOURCE_POLICY'],
    [2010200014,'FishSpawningInVillage','INACTIVE_SOURCE_DEFINITION'],
    [2010500008,'FishSpawningInVillage','SOURCE_VARIANT_HINT_CONFLICT'],
    [2010000021,'UnknownFutureVariant','UNRECOGNIZED_OR_NON_W1_SAVED_VARIANT'],
    [2010009999,'ItemSpawning','UNKNOWN_EVENT_ID']
  ];
  for(const [id,kind,status] of cases){
    const r=analyzeW1StaticBranches(native,{...p,eventId:id,saveKind:kind});
    assert.equal(r.status,'EVENT_OUTSIDE_STATIC_W1_BRANCH_SCOPE');
    assert.equal(r.eventEvidenceStatus,status);
    assert.equal(r.readinessCondition,null);
    assert.equal(r.overdueClampCondition,null);
    assert.equal(r.writerAuthorized,false);
  }
});
test('static branches reject unsafe operands and unrecognized evidence ledger',()=>{
  const p={eventId:2010000021,saveKind:'ItemSpawning',nowTicks:100n,
    nextOccurrenceTicks:50n,maxIntervalTicks:10n};
  for(const bad of [{nowTicks:100},{nextOccurrenceTicks:-1n},
    {maxIntervalTicks:-1n},{nowTicks:1n<<62n},{maxIntervalTicks:1n<<62n}])
    assert.throws(()=>analyzeW1StaticBranches(native,{...p,...bad}),/bigint/);
  assert.throws(()=>analyzeW1StaticBranches({...native,source:{...native.source}},p),/provenance/);
  assert.throws(()=>analyzeW1StaticBranches(null,p),/provenance/);
  const r=analyzeW1StaticBranches(native,p);
  assert.throws(()=>{r.readinessCondition=false;},TypeError);
});


test('primary NSO resolves the upstream wrong-RVA annotation, preserving evidence history',()=>{
  const c=native.native.actualizeSourceConflict;
  assert.equal(c.rva,'0x05A2AC94');
  assert.equal(c.status,'RESOLVED_SOURCE_ANNOTATION_OFF_BY_4');
  assert.equal(c.reportedAsm,'mov x25, x0');
  // 0xB0... is ADRP encoding class, not ORR register alias MOV.
  assert.equal((0xB002B8C8 & 0x9F000000)>>>0,0x90000000);
  assert.notEqual(0xB002B8C8,0xAA0003F9); // actual MOV X25, X0 encoding
  assert.equal(c.independentlyDecodedMnemonic,'adrp x8');
  assert.equal(c.correctedRVA,'0x05A2AC98');
  assert.equal(c.correctedOpcode,'0xAA0003F9');
  assert.equal(c.correctedAsm,'mov x25, x0');
  assert.equal(native.native.actualize.rva,'0x05A2A170');
});


// All opcode words below were extracted from the SHA-verified v1.25.3 NSO.
// These are byte fixtures only: tests do not distribute or load the game binary.
const decodeBL=(at,op)=>{
  assert.equal((op & 0xfc000000)>>>0,0x94000000);
  const v=op&0x03ffffff;
  return at+((v&0x02000000)?v-0x04000000:v)*4;
};
test('raw NSO section SHA identities, size and module BID remain distinct from schema',()=>{
  const b=native.native.primaryBinary;
  assert.equal(b.verification,'RAW_NSO_REHASHED_AND_SECTIONS_MATCH_HEADER');
  assert.equal(b.bytes,96027926);
  assert.equal(b.moduleIdPrefix,'9A239D3DB569756D');
  assert.equal(b.mainSHA256,native.source.mainSHA256);
  assert.equal(b.textSHA256,native.source.nsoTextSHA256);
  assert.equal(b.rodataSHA256,'2a8f5c5c9203b9c42cf59cf540e0d017ff6bc9b6709c1c2c691241ffb508348c');
  assert.equal(b.dataSHA256,'c3ac6f93de050aafaacdcc9bf77d4712643726e25374ef0179823191cebb4ce6');
  assert.equal(b.runtimeVerified,false);
  assert.equal(native.query(2010000021,'ItemSpawning').sourceBuildVerifiedFromSave,false);
  assert.equal(native.query(2010000021,'ItemSpawning').writerAuthorized,false);
});
test('X25 from slot-6 call converges at 0x05A2AC98; source annotation was one instruction early',()=>{
  const x=native.native.actualizeSourceConflict;
  assert.equal(x.rva,'0x05A2AC94');
  assert.equal(x.reportedOpcode,'0xB002B8C8');
  assert.equal(x.correctedOpcode,'0xAA0003F9');
  assert.equal(x.correctedRVA,'0x05A2AC98');
  assert.equal(x.status,'RESOLVED_SOURCE_ANNOTATION_OFF_BY_4');
  assert.notEqual(x.correctedRVA,x.rva);
  assert.equal(native.native.actualize.rva,'0x05A2A170');
});
test('all ten raw NSO direct Reschedule BL addresses match exact method/target map',()=>{
  const verified=[
    ['ItemSpawning.Execute',0x057BF0C4,0x940CCD03],
    ['WildCropsSpawningInVillage.Execute',0x057C4260,0x940CB89C],
    ['FishSpawningInVillage.Execute',0x057C7110,0x940CACF0],
    ['FlowerSpawningInVillage.Execute',0x057CAE58,0x940C9D9E],
    ['FlowerDryingInVillage.Execute',0x057CEC34,0x940C8E27],
    ['ChooseVillageArea.Execute',0x057D1DE8,0x940C81BA],
    ['MiningRockTurningSpecial.Execute',0x057D5378,0x940C7456],
    ['PendingFishUpgrade.Execute',0x05801D50,0x940BC1E0],
    ['ChooseItem.Execute',0x0580737C,0x940BAC55],
    ['Profile.AddRecurringEvent',0x05A29F18,0x9403216E]
  ];
  assert.equal(native.native.directRescheduleCallsites.length,10);
  assert.equal(new Set(native.native.directRescheduleCallsites.map(x=>x.rva)).size,10);
  for(let i=0;i<verified.length;i++){
    const [name,rva,opcode]=verified[i],row=native.native.directRescheduleCallsites[i];
    assert.equal(row.method,name);
    assert.equal(row.rva,'0x'+rva.toString(16).toUpperCase().padStart(8,'0'));
    assert.equal(decodeBL(rva,opcode),0x05AF24D0);
  }
});
test('four W1 Execute exact callsites preserve readiness versus reschedule distinction',()=>{
  const entries={
    ItemSpawning:{at:'0x057B9BC0',ready:['0x057BA660','0x057BA684'],later:'0x057BF0C4',skips:true},
    WildCropsSpawningInVillage:{at:'0x057C2BC0',ready:['0x057C2FC8'],later:'0x057C4260',skips:true},
    FlowerSpawningInVillage:{at:'0x057C99E0',ready:['0x057C9DD4','0x057C9DF4'],later:'0x057CAE58',skips:true},
    FishSpawningInVillage:{at:'0x057C6890',ready:[],later:'0x057C7110',skips:null}
  };
  const readyOpcodes={
    '0x057BA660':0x940AAB78,'0x057BA684':0x940AAB6F,
    '0x057C2FC8':0x940A891E,
    '0x057C9DD4':0x940A6D9B,'0x057C9DF4':0x940A6D93
  };
  for(const [kind,checks] of Object.entries(entries)){
    const t=native.traces[kind];
    assert.equal(t.executeRVA,checks.at);
    assert.deepEqual(t.readinessCallRvas,checks.ready);
    assert.equal(t.rescheduleCallRVA,checks.later);
    assert.equal(t.readinessFalseBypassesDirectReschedule,checks.skips);
    assert.equal(t.spawnedGridObjectProvenanceVerified,false);
    for(const r of checks.ready)
      assert.equal(decodeBL(Number(r),readyOpcodes[r]),0x05A65440);
  }
});
test('fish pending-fish allocation is not converted into a confirmed GridObject spawn or universal readiness',()=>{
  const t=native.traces.FishSpawningInVillage;
  assert.equal(t.readinessCallsiteVerified,false);
  assert.equal(t.readinessFalseBypassesDirectReschedule,null);
  assert(t.sourceGuards.some(x=>x.method==='ProfileWorld.AddPendingFish'&&x.rva==='0x057C70F4'));
  assert(t.sourceGuards.some(x=>x.method.includes('CountMatchingPendingFishForLocation')));
  assert.equal(t.spawnedGridObjectProvenanceVerified,false);
  assert.equal(native.query(2010200014,'FishSpawningInVillage').status,'INACTIVE_SOURCE_DEFINITION');
});
test('per-family guard presence never elevates any W1 Event ID to Writer or allocation proof',()=>{
  const ids=[[2010000021,'ItemSpawning'],[2010400001,'WildCropsSpawningInVillage'],
    [2010500008,'FlowerSpawningInVillage']];
  for(const [id,kind] of ids){
    const r=native.query(id,kind);
    assert(r.trace.sourceGuards.length>0);
    assert.equal(r.trace.spawnedGridObjectProvenanceVerified,false);
    assert.equal(r.spawnAllocationVerified,false);
    assert.equal(r.areaAndPopulationCapsVerified,false);
    assert.equal(r.pickupOrRemovalRescheduleVerified,false);
    assert.equal(r.restartBehaviorVerified,false);
    assert.equal(r.writerAuthorized,false);
    assert.equal(r.gridDeletionAuthorized,false);
  }
});

test('raw Reschedule uses interval-variant branching and a virtual slot-2 NextOccurrence setter',()=>{
  const r=native.native.reschedule;
  assert.equal(r.intervalOneofFieldLoadRVA,'0x05AF25E8');
  assert.equal(r.intervalTimeOfDayCompareRVA,'0x05AF25F0');
  assert.equal(r.intervalDurationCompareRVA,'0x05AF25F8');
  assert.equal(r.setterInterfaceSlotRVA,'0x05AF2C7C');
  assert.equal(r.setterArgumentRVA,'0x05AF2CA0');
  assert.equal(r.setterCallRVA,'0x05AF2CA4');
  // Two direct calls inside Reschedule converge on its TimeOfDay helper.
  assert.equal(decodeBL(0x05AF2A60,0x940000C0),0x05AF2D60);
  assert.equal(decodeBL(0x05AF2C30,0x9400004C),0x05AF2D60);
  assert.equal(r.setterDispatchIsStaticOnly,true);
  const model=analyzeW1StaticBranches(native,{eventId:2010000021,saveKind:'ItemSpawning',
    nowTicks:120n,nextOccurrenceTicks:100n});
  assert.equal(model.afterExecuteRescheduleVerified,false);
  assert.equal(model.writerAuthorized,false);
});
