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


test('all four W1 native catch-up bound formulas are source-specific, not live object counts',()=>{
  const expected={
    ItemSpawning:{getter:'0x057C0140',maxcall:'0x057C02E4',
      amount:'MinNumberOfSpawn',field:'0x54',division:'0x057C02EC',mul:'0x057C02F8'},
    WildCropsSpawningInVillage:{getter:'0x057C4350',maxcall:'0x057C44F4',
      amount:'NumberOfGardensToSpawn',field:'0x58',division:'0x057C44FC',mul:'0x057C4508'},
    FlowerSpawningInVillage:{getter:'0x057CB7C0',maxcall:null,
      amount:'NumberOfFlowersToSpawn',field:'0x54',division:'0x057CB964',mul:'0x057CB970'},
    FishSpawningInVillage:{getter:'0x057C7EC0',maxcall:null,
      amount:null,field:null,division:null,mul:'0x057C80B4'}
  };
  for(const [kind,x] of Object.entries(expected)){
    const c=native.native.catchupByVariant[kind];
    const t=native.traces[kind];
    assert.equal(c.getterRVA,x.getter);
    assert.equal(t.catchupBoundRVA,x.getter);
    assert.strictEqual(t.catchupBound,c);
    assert.equal(c.maximumCallRVA,x.maxcall);
    assert.equal(c.amountField,x.amount);
    assert.equal(c.amountFieldOffset??null,x.field);
    assert.equal(c.divisionRVA,x.division);
    assert.equal(c.multiplicationRVA,x.mul);
    assert.equal(c.finalObjectCountGuarantee,false);
    assert.equal(t.spawnedGridObjectProvenanceVerified,false);
  }
  assert.match(native.native.catchupByVariant.FishSpawningInVillage.formula,/MaxNumberOfPendingFishes/);
  assert.equal(native.native.catchupByVariant.FishSpawningInVillage.divisionRVA,null);
});
test('opcode fixtures prove four max-interval source BLs, signed divisions and fish multiplication',()=>{
  assert.equal(decodeBL(0x057C02C0,0x97bf4fc4),0x047941d0);
  assert.equal(decodeBL(0x057C02E4,0x97bfad43),0x047ab7f0);
  assert.equal(decodeBL(0x057C44D0,0x97bf3f40),0x047941d0);
  assert.equal(decodeBL(0x057C44F4,0x97bfe2ab),0x047bcfa0);
  assert.equal(decodeBL(0x057CB940,0x97bf2224),0x047941d0);
  assert.equal(decodeBL(0x057C8098,0x97bf304e),0x047941d0);
  const words=[
    [0x057C02E8,0xB9405668],[0x057C02EC,0x1AC80C08],
    [0x057C44F8,0xB9405A68],[0x057C44FC,0x1AC80C08],
    [0x057CB95C,0xB9406268],[0x057CB960,0xB9405669],
    [0x057CB964,0x1AC90D08],
    [0x057C80B0,0xB9806268]
  ];
  assert.equal(words.length,8);
  assert.equal(new Set(words.map(x=>x[0])).size,8);
  assert.equal(native.native.catchupByVariant.FlowerSpawningInVillage.maximumFieldOffset,'0x60');
  assert.equal(native.native.catchupByVariant.FishSpawningInVillage.maximumFieldOffset,'0x60');
});
test('native IsEventOver strictly compares NextOccurrence to EndDate, not Now',()=>{
  const e=native.native.expiry;
  assert.equal(e.rva,'0x05AF3050');
  assert.equal(e.nextOccurrenceGetterSlot,1);
  assert.equal(e.endDateGetterSlot,3);
  assert.equal(e.maskedCompareRVA,'0x05AF3228');
  assert.equal(e.conditionRVA,'0x05AF3230');
  assert.equal(e.resultRVA,'0x05AF3234');
  assert.equal(e.condition,'masked NextOccurrence > masked EndDate');
  assert.deepEqual(e.actualizeDirectCallRvas,
    ['0x05A2AF4C','0x05A2AF84','0x05A2B044','0x05A2B058']);
  for(const [loc,opcode] of [[0x05A2AF4C,0x94032041],[0x05A2AF84,0x94032033],
    [0x05A2B044,0x94032003],[0x05A2B058,0x94031FFE]])
    assert.equal(decodeBL(loc,opcode),0x05AF3050);
  assert.equal(e.saveEffectVerified,false);
  assert.equal(e.runtimeVerified,false);
});
test('LastOccurrence is only serialized in ItemSpawning; no timestamp rewrites GridObjects',()=>{
  const st=native.native.fieldLayout;
  assert.deepEqual(st.commonFields,['RecurringEventItemID','NextOccurrence','EndDate']);
  assert.equal(st.itemSpawningOnlyLastOccurrence.field,'LastOccurrence');
  assert.equal(st.itemSpawningOnlyLastOccurrence.fieldNumber,4);
  assert.equal(st.itemSpawningOnlyLastOccurrence.fieldOffset,'0x30');
  assert.equal(st.itemSpawningOnlyLastOccurrence.writeRVA,'0x057BF068');
  assert.equal(st.itemSpawningOnlyLastOccurrence.onlyW1VariantWithThisSerializedField,true);
  assert.equal(st.directSavePersistenceVerified,false);
  assert.equal(st.gameRestartRetentionVerified,false);
  assert.equal(st.existingGridObjectRemovedOnTimestampChange,false);
  assert.equal(native.traces.FishSpawningInVillage.spawnedGridObjectProvenanceVerified,false);
});
test('every Event ID has separately scoped evidence states and all operations are BLOCKED',()=>{
  assert.equal(native.rows.length,508);
  assert(native.rows.every(r=>r.sourceRecordEvidence==='CONFIRMED'));
  assert(native.rows.every(r=>r.nativePerEventEvidence==='UNKNOWN'&&r.variantConsumerStaticEvidence==='UNKNOWN'));
  assert(native.rows.every(r=>r.actualAppearanceEvidence==='UNKNOWN'&&r.operationEvidence==='BLOCKED'));
  for(const [id,kind,expectation] of [
    [2010000021,'ItemSpawning','STATIC_ONLY'],
    [2010400001,'WildCropsSpawningInVillage','STATIC_ONLY'],
    [2010500008,'FlowerSpawningInVillage','STATIC_ONLY'],
    [2010200014,'FishSpawningInVillage','BLOCKED'],
    [2010000064,'ItemSpawning','BLOCKED'],
    [2010000093,'ItemSpawning','BLOCKED'],
    [2010500008,'FishSpawningInVillage','UNKNOWN'],
    [2010009999,'ItemSpawning','UNKNOWN']
  ]){
    const x=native.query(id,kind);
    assert.equal(x.variantConsumerStaticEvidence,expectation);
    assert.equal(x.nativePerEventEvidence,expectation==='BLOCKED'?'BLOCKED':'UNKNOWN');
    assert.equal(x.actualAppearanceEvidence,'UNKNOWN');
    assert.equal(x.operationEvidence,'BLOCKED');
    assert.equal(x.writerAuthorized,false);
    assert.equal(x.editedExportAuthorized,false);
    assert.equal(x.gridDeletionAuthorized,false);
    assert.equal(x.moonstoneMovementAuthorized,false);
    assert.equal(x.userFutureTimestampIsCorruption,false);
  }
  assert.equal(native.query(2010009999,'ItemSpawning').sourceRecordEvidence,'UNKNOWN');
});

test('RemovePendingFish mutates PendingFish map and notifies a dispatcher, not direct Reschedule',()=>{
  const p=native.native.pendingFishRemoval;
  assert.equal(p.rva,'0x0598E800');
  assert.equal(p.pendingFishMapRemoveCallRVA,'0x0598E874');
  assert.equal(p.pendingFishMapRemoveTargetRVA,'0x03C141D0');
  assert.equal(p.dispatcherSlotArgumentRVA,'0x0598E8B8');
  assert.equal(p.dispatcherSlotArgument,39);
  assert.equal(p.dispatcherVirtualCallRVA,'0x0598E8E4');
  assert.equal(p.directRescheduleCall,false);
  assert.equal(p.indirectRescheduleViaDispatcherVerified,false);
  assert.equal(p.pickupOutcomeVerified,false);
  assert.equal(p.saveWriteVerified,false);
  assert.equal(decodeBL(0x0598E874,0x978A1657),0x03C141D0);
  const fish=native.query(2010200014,'FishSpawningInVillage');
  assert.equal(fish.pickupOrRemovalRescheduleVerified,false);
  assert.equal(fish.status,'INACTIVE_SOURCE_DEFINITION');
  assert.equal(fish.editedExportAuthorized,false);
});


const decodeTBZTarget=(rva,opcode)=>{
  assert.equal((opcode&0x7E000000)>>>0,0x36000000);
  const imm14=(opcode>>>5)&0x3fff;
  return rva+4*(imm14&0x2000?imm14-0x4000:imm14);
};
test('Item spawning gates object candidates by source scene, conditions, Area and grid state',()=>{
  const c=native.native.w1GenerationConsumers.ItemSpawning;
  assert.equal(c.executeRVA,native.traces.ItemSpawning.executeRVA);
  assert.equal(c.conditionsListEvaluateRVA,'0x057BAA10');
  assert.equal(c.sceneGridsReadRVA,'0x057BAC58');
  assert.equal(c.areaShouldSpawnRVA,'0x057BB090');
  assert.equal(c.itemAmountStateReadRVA,'0x057BC5BC');
  assert.equal(c.findValidPositionRVA,'0x057BE080');
  assert.equal(c.requestConstructRVA,'0x057BE6F8');
  assert.equal(decodeBL(0x057BAC58,0x9407040E),0x0597BC90);
  assert.equal(decodeBL(0x057BB090,0x979A4358),0x03E4BDF0);
  assert.equal(decodeBL(0x057BE080,0x97DC287C),0x04EC8270);
  assert.equal(c.placedGridObjectIdProven,false);
  assert.equal(c.liveObjectSpawnObserved,false);
});
test('WildCrops generated grid IDs pass to garden production only after conditional placement result',()=>{
  const c=native.native.w1GenerationConsumers.WildCropsSpawningInVillage;
  assert.equal(c.executeRVA,native.traces.WildCropsSpawningInVillage.executeRVA);
  assert.equal(decodeBL(0x057C3EE0,0x97DC10E4),0x04EC8270);
  assert.equal(decodeBL(0x057C4190,0x97876478),0x0399D370);
  assert.equal(decodeTBZTarget(0x057C4194,0x36000220),0x057C41D8);
  assert.equal(c.placementFailureBypassRVA,'0x057C41D8');
  assert.equal(c.gridIdLoadRVA,'0x057C41A0');
  assert.equal(c.gridObjectIdLoadRVA,'0x057C41A8');
  assert.equal(decodeBL(0x057C41D4,0x97E4B1F3),0x050F09A0);
  assert.equal(c.setupSignature.includes('uint gridID, uint gridObjectID'),true);
  assert.equal(c.placedGridObjectIdProvenForRuntime,false);
});
test('Flower has two placement-helper callsites with valid-grid search but no runtime result proof',()=>{
  const c=native.native.w1GenerationConsumers.FlowerSpawningInVillage;
  assert.equal(c.tryGetGridRVA,'0x057CA490');
  assert.equal(c.placementHelperRVA,'0x057CAFA0');
  assert.deepEqual(c.placementCallRvas,['0x057CAE20','0x057CAE38']);
  assert.equal(decodeBL(0x057CAE20,0x94000060),0x057CAFA0);
  assert.equal(decodeBL(0x057CAE38,0x9400005A),0x057CAFA0);
  assert.equal(decodeBL(0x057CB464,0x97DBF383),0x04EC8270);
  assert.equal(c.indirectAddObjectTargetResolved,false);
  assert.equal(c.liveObjectSpawnObserved,false);
});
test('fish source definitions for ripple spawning are all inactive, not runnable W1 claims',()=>{
  const fish=events.events.filter(e=>e.group==='釣り'&&e.subgroup==='波紋の生成');
  assert.equal(fish.length,46);
  assert(fish.every(e=>e.active===false));
  const c=native.native.w1GenerationConsumers.FishSpawningInVillage;
  assert.equal(c.sourceDefinitionCandidatesKnownInactive,46);
  assert.equal(c.sourceDefinitionCandidatesAllInactive,true);
  assert.equal(decodeBL(0x057C6E68,0x94000216),0x057C76C0);
  assert.equal(decodeBL(0x057C6F94,0x940CBE5F),0x05AF6910);
  assert.equal(decodeBL(0x057C70F4,0x94071D7B),0x0598E6E0);
  for(const e of fish){
    const row=native.query(e.id,'FishSpawningInVillage');
    assert.equal(row.sourceDefinitionActive,false);
    assert.equal(row.operationEvidence,'BLOCKED');
    assert.equal(row.writerAuthorized,false);
  }
  assert.equal(c.liveRippleObserved,false);
  assert.equal(c.gridObjectIdProven,false);
});
test('RemovePendingFish dispatcher slot 39 maps to pending-fish removal UI consumer, not timer mutation',()=>{
  const d=native.native.pendingFishDispatchConsumer;
  assert.equal(native.native.pendingFishRemoval.dispatcherSlotArgument,39);
  assert.equal(d.worldEventInterface,'IWorldEventDispatcher.RaisePendingFishRemoved');
  assert.equal(d.interfaceSlot,39);
  assert.equal(d.profileDispatcherImplementationRVA,'0x05A8DB40');
  assert.equal(d.profileDispatcherEventFieldOffset,'0x1F8');
  assert.equal(d.fishingSystemHandlerRVA,'0x033FDB20');
  assert.equal(d.fishingSystemListFieldOffset,'0xA8');
  assert.equal(decodeBL(0x033FDB5C,0x97FFABA5),0x033E89F0);
  assert.equal(d.handlerSubscribedByRuntimeVerified,false);
  assert.equal(d.handlerDirectRescheduleCall,false);
  assert.equal(d.bodyOfWaterDirectRescheduleCall,false);
  assert.equal(d.indirectReschedulePathVerified,false);
  assert.equal(d.removedPendingFishIsGridObject,false);
  assert.equal(d.gameRuntimeObserved,false);
});
test('hardware minimum matrix is static, immutable and never authorizes a source-hint save write',()=>{
  const matrix=native.native.runtimeAcceptanceCases;
  assert.equal(matrix.length,8);
  assert.equal(new Set(matrix.map(x=>x.caseId)).size,8);
  assert(matrix.every(x=>x.originalOwnerSaveMutationAllowed===false&&x.requiresSeparateHardwareAcceptance===true&&!x.passed));
  assert.equal(matrix.filter(x=>x.variant==='FishSpawningInVillage').length,1);
  assert.equal(matrix.find(x=>x.variant==='FishSpawningInVillage').eligibility,'INACTIVE_SOURCE_ONLY');
  assert.equal(matrix.find(x=>x.variant==='PROTECTED_OR_UNKNOWN').eligibility,'BLOCKED');
  assert.throws(()=>{matrix[0].passed=true},TypeError);
  assert.equal(native.query(2010000021,'ItemSpawning').nativePerEventEvidence,'UNKNOWN');
  assert.equal(native.query(2010000021,'ItemSpawning').operationEvidence,'BLOCKED');
  assert.equal(native.query(2010000021,'ItemSpawning').editedExportAuthorized,false);
});


const decodeLdrXUnsigned=(word)=>{
  assert.equal((word & 0xFFC00000)>>>0,0xF9400000);
  return {rt:word&31,rn:(word>>>5)&31,byteOffset:8*((word>>>10)&0xfff)};
};
test('ItemSpawning GridState ItemAmountState reads AssignedPlayer, NOT Amount or live scene count',()=>{
  const x=native.native.gridStateReadDisambiguation;
  assert.equal(decodeBL(0x057BC5BC,0x97DAA7DD),0x04E66530);
  assert.deepEqual(decodeLdrXUnsigned(0xF9401414),{rt:20,rn:0,byteOffset:0x28});
  assert.equal(x.nextLoadRVA,'0x057BC5C4');
  assert.equal(x.nextLoadOpcode,'0xF9401414');
  assert.equal(x.amountFieldOffset,'0x18');
  assert.equal(x.stateFieldOffset,'0x20');
  assert.equal(x.assignedPlayerFieldOffset,'0x28');
  assert.equal(x.observedSubfield,'AssignedPlayer');
  assert.equal(x.observedIsAmountField,false);
  assert.equal(x.provesSceneItemCount,false);
  assert.equal(x.objectCountViaIndirectDispatchResolved,false);
  assert.notEqual(x.assignedPlayerFieldOffset,x.amountFieldOffset);
});
test('DiffGrid ObjectCount uses default layout, removed and modified components, not ModifiedObjects alone',()=>{
  const g=native.native.diffGridObjectCountBoundary;
  assert.equal(g.objectCountEntryRVA,'0x04E8DA90');
  assert.equal(g.predicateCountCoreRVA,'0x04E8DAA0');
  assert.deepEqual(decodeLdrXUnsigned(0xF9402EB3),{rt:19,rn:21,byteOffset:0x58});
  assert.deepEqual(decodeLdrXUnsigned(0xF94026A9),{rt:9,rn:21,byteOffset:0x48});
  assert.deepEqual(decodeLdrXUnsigned(0xF94022A0),{rt:0,rn:21,byteOffset:0x40});
  assert.equal(g.defaultGridLoadRVA,'0x04E8DBA8');
  assert.equal(g.removedObjectsLoadRVA,'0x04E8DBE8');
  assert.equal(g.baseCountReadRVA,'0x04E8DBF8');
  assert.equal(g.removedCountReadRVA,'0x04E8DBFC');
  assert.equal(g.baseMinusRemovedRVA,'0x04E8DC00');
  assert.equal(g.conditionalModifiedCountIncrementRVA,'0x04E8DF04');
  const sub=0x4B090108;
  assert.equal(sub&31,8); // destination W8
  assert.equal((sub>>>5)&31,8); // source W8
  assert.equal((sub>>>16)&31,9); // W9 removed count
  const add=0x11000508;
  assert.equal(add&31,8);
  assert.equal((add>>>10)&0xfff,1);
  assert.equal(g.countOnlyModifiedObjectsIsValid,false);
  assert.equal(g.directlyReachedFromW1ExecuteVerified,false);
  assert.equal(g.W1IndirectObjectCountDispatchResolved,false);
  assert.equal(g.liveAreaPopulationVerified,false);
});
test('absence of direct ObjectCount BL cannot prove W1 lacks indirect quantity checks',()=>{
  const s=native.native.gridConsumerDirectCallScan;
  assert.equal(s.directDiffGridOrGridObjectCountCalls,0);
  assert.deepEqual(s.indirectBLRSeen,{
    ItemSpawning:33,WildCropsSpawningInVillage:12,
    FlowerSpawningInVillage:10,FishSpawningInVillage:0
  });
  assert.equal(s.indirectInterfaceCountCallsResolved,false);
  assert.equal(s.zeroDirectCallsProvesNoCountChecks,false);
  assert.equal(s.directCodeDoesNotProveDisappearanceOfSpawnedObjects,true);
});
test('NightThorn, Wood, WildCrop and Flower IDs are source witnesses only, never GridObject identities',()=>{
  const witnessed=[
    [2010000003,'NightThornSpawningVillage!UrbanNightThornSpawn','ItemSpawning'],
    [2010000021,'Wood!Wetland_Softwood','ItemSpawning'],
    [2010400001,'UrbanWildCropSpawn','WildCropsSpawningInVillage'],
    [2010500008,'UrbanDandelionYellow','FlowerSpawningInVillage']
  ];
  const items=native.native.sourceIdentityWitnesses;
  assert.equal(items.length,4);
  assert.equal(new Set(items.map(x=>x.eventId)).size,4);
  for(let i=0;i<4;i++){
    const [id,name,hint]=witnessed[i];
    const r=items[i],src=events.events.find(x=>x.id===id),view=native.query(id,hint);
    assert.equal(r.eventId,id);
    assert.equal(r.sourceName,name);
    assert.equal(src.name,name);
    assert.equal(src.active,true);
    assert.equal(r.hint,hint);
    assert.equal(r.serializedVariantConfirmed,false);
    assert.equal(r.concreteGridObjectIDConfirmed,false);
    assert.equal(view.status,'SOURCE_VARIANT_HINT_ONLY');
    assert.equal(view.nativePerEventEvidence,'UNKNOWN');
    assert.equal(view.spawnedGridObjectIdentityVerified,false);
    assert.equal(view.writerAuthorized,false);
    assert.equal(view.editedExportAuthorized,false);
    assert.equal(view.gridDeletionAuthorized,false);
  }
});

test('DiffGrid conditional allocation sets object ID and ItemID without EventID identity proof',()=>{
  const x=native.native.diffGridConditionalAddObject;
  assert.equal(x.implementationRVA,'0x04E8BC70');
  assert.equal(x.innerAddObjectRVA,'0x04E8BEA0');
  assert.equal(x.nextObjectIdFieldOffset,'0x50');
  assert.equal(x.gridObjectIdFieldOffset,'0x18');
  assert.equal(x.gridObjectItemIdFieldOffset,'0x1C');
  assert.equal(x.nextObjectIdLoadRVA,'0x04E8BDB4');
  assert.equal(x.nextObjectIdIncrementRVA,'0x04E8BDB8');
  assert.equal(x.nextObjectIdStoreRVA,'0x04E8BDBC');
  assert.equal(x.gridObjectIdentityStoreRVA,'0x04E8BDC8');
  assert.equal(decodeBL(0x04E8BF70,0x9400E40C),0x04EC4FA0);
  assert.equal(decodeTBZTarget(0x04E8BF7C,0x36000828),0x04E8C080);
  assert.equal(decodeBL(0x04E8BFA0,0x97B61F54),0x03C13CF0);
  assert.deepEqual(decodeLdrXUnsigned(0xF94022A0),{rt:0,rn:21,byteOffset:0x40});
  assert.equal(x.conditionalAllocationPathProvedByNative,true);
  assert(Number(x.nextObjectIdStoreRVA)<Number(x.validationCallRVA));
  assert.equal(x.idAdvanceBeforeInnerPlacementValidation,true);
  assert.equal(x.idAdvanceEquatesSuccessfulPlacement,false);
  assert.equal(x.failedResultCounterRollbackVerified,false);
  assert.equal(x.sourceEventIdWrittenIntoGridObject,false);
  assert.equal(x.fromFieldProvenToBePopulated,false);
  assert.equal(x.directW1CallToThisConcreteImplementationVerified,false);
  assert.equal(x.runtimeSuccessfulPlacementObserved,false);
  assert.equal(x.postSavePersistenceVerified,false);
});


test('ItemSpawning directly updates an owner-keyed dictionary, not scene-global ObjectCount',()=>{
  const c=native.native.itemOwnerGroupedCount;
  assert.equal(c.helperRVA,'0x057BF720');
  assert.deepEqual(c.directCallsites,['0x057BC0EC','0x057BC5EC']);
  assert.equal(decodeBL(0x057BC0EC,0x94000D8D),0x057BF720);
  assert.equal(decodeBL(0x057BC5EC,0x94000C4D),0x057BF720);
  assert.equal(c.argumentType,'Nullable<int> playerId');
  assert.equal(c.closureField,'numberOfItemsOnValidGrid');
  assert.equal(c.closureType,'Dictionary<int,int>');
  assert.equal(decodeBL(0x057BF82C,0x978E5CC1),0x03B56B30);
  assert.equal(0x11000529&0x1f,9);
  assert.equal((0x11000529>>>10)&0xfff,1);
  assert.equal(decodeBL(0x057BF878,0x978E4932),0x03B51D40);
  assert.equal(c.amountWithStateAssignedPlayerRVA,'0x057BC5C4');
  assert.equal(c.recordedValueNotProofOfTotalGridObjects,true);
  assert.equal(c.runtimeGroupPopulationUnverified,true);
  assert.equal(c.activeConditionalEventAttributionUnverified,true);
});
test('WildCrops existing-object enumerator counts only up to closure maximum, not all area objects',()=>{
  const c=native.native.wildCropsBoundedExistingCount;
  assert.equal(c.helperRVA,'0x057C49A0');
  assert.equal(c.inputType,'Item seedItem');
  assert.equal(c.closureMaxField,'maximumAmount');
  assert.equal(c.closureMaxFieldOffset,'0x10');
  assert.equal(c.gridEnumerationSelectorRVA,'0x057C4810');
  assert.equal(c.gridSelectorInterfaceSlot,6);
  assert.equal(c.enumeratorCountInitRVA,'0x057C4D10');
  assert.equal(c.countIncrementRVA,'0x057C4E0C');
  assert.equal(c.countVsMaximumCompareRVA,'0x057C4E10');
  assert.equal(c.repeatIfBelowMaximumRVA,'0x057C4E14');
  assert.equal(c.returnCountRVA,'0x057C4E84');
  assert.equal(0x11000694&0x1f,20);
  assert.equal((0x11000694>>>10)&0xfff,1);
  assert.equal((0x6B08029F>>>16)&0x1f,8);
  assert.equal(c.exactPerItemFilterAndEffectiveGridCompleteness,'UNKNOWN');
  assert.equal(c.isCappedEnumeratorNotNativeIntervalMax,true);
  assert.equal(c.successfulGardenSpawnObserved,false);
});
test('Client has a separate recurring-event reschedule notification consumer, not fish-removal handler',()=>{
  const c=native.native.clientRecurringRescheduleNotification;
  assert.equal(c.dispatcherInterface,'IWorldEventDispatcher.RaiseRecurringEventRescheduled');
  assert.equal(c.dispatcherInterfaceSlot,62);
  assert.equal(c.profileDispatcherMethodRVA,'0x05A8EC10');
  assert.equal(c.profileDispatcherDelegateFieldOffset,'0x208');
  assert.equal(c.clientHandlerRVA,'0x0604E9B0');
  assert.equal(decodeBL(0x0604EB9C,0x976F1629),0x03C14440);
  assert.equal(decodeBL(0x0604EBF8,0x97EA9116),0x05AF3050);
  assert.equal(decodeBL(0x0604EC0C,0x97EA9111),0x05AF3050);
  assert.equal(decodeBL(0x0604EC7C,0x97FFFEBD),0x0604E770);
  assert.equal(c.fishRemovedDispatcherInterfaceSlot,39);
  assert.notEqual(c.dispatcherInterfaceSlot,c.fishRemovedDispatcherInterfaceSlot);
  assert.equal(c.clientHandlerDirectRescheduleCall,false);
  assert.equal(c.notificationFiredByEverySetterVerified,false);
  assert.equal(c.handlerSubscriptionRuntimeVerified,false);
  assert.equal(c.eventIdToConcreteSaveVariantVerified,false);
  assert.equal(c.normalSaveTimingVerified,false);
});


test('Profile.AddRecurringEvent has explicit slot62 reschedule notification edge; not every setter',()=>{
  const c=native.native.clientRecurringRescheduleNotification;
  assert.equal(c.profileAddRecurringEventRVA,'0x05A29920');
  assert.equal(c.profileAddNotificationSlotRVA,'0x05A2A0F0');
  assert.equal(c.profileAddNotificationSlotOpcode,'0x528007C2');
  const mov=0x528007C2;
  assert.equal(mov&31,2); // W2
  assert.equal((mov>>>5)&0xffff,62);
  assert.equal(c.profileAddNotificationVirtualCallRVA,'0x05A2A118');
  assert.equal(c.profileAddNotificationConditionalOnDispatcher,true);
  assert.equal(c.endDatePreventsClientWaitOnMatchedRecordByStaticBranch,true);
  assert.equal(c.actualizeRaisesRescheduleNotificationVerified,false);
  assert.equal(c.notificationFiredByEverySetterVerified,false);
  assert.equal(c.handlerSubscriptionRuntimeVerified,false);
  assert.equal(native.native.reschedule.setterDispatchIsStaticOnly,true);
  assert.equal(native.native.fieldLayout.directSavePersistenceVerified,false);
});


test('all four W1 NextOccurrence setters only store +0x20 and GC-write-barrier, not slot62',()=>{
  const n=native.native.nextOccurrenceSetterCallGraph;
  const expected=[
    ['ItemSpawning','0x057B8AA0','0x057B8AA8'],
    ['WildCropsSpawningInVillage','0x057C1CC0','0x057C1CC8'],
    ['FlowerSpawningInVillage','0x057C8AE0','0x057C8AE8'],
    ['FishSpawningInVillage','0x057C58B0','0x057C58B8']
  ];
  assert.deepEqual(n.setters.map(x=>[x.kind,x.entryRVA,x.writeRVA]),expected);
  const word=Number.parseInt(n.writeInstructionWord,16);
  assert.equal(word,0xF8020C01);
  assert.equal(word&31,1); // Timestamp X1
  assert.equal((word>>>5)&31,0); // this X0
  assert.equal((word>>>12)&0x1ff,0x20); // preindex +0x20
  assert.equal(n.eachSetterWindowBytes,0x50);
  assert.equal(n.eachSetterDirectBLCalls,0);
  assert.equal(n.eachSetterIndirectBLRCalls,0);
  assert.equal(n.setterDirectlyEmitsSlot62,false);
  assert.equal(n.callerCanEmitSeparateNotification,true);
  assert.equal(n.anySetterCausesClientWaitRearmVerified,false);
});
test('slot62 emitter opcode scoped to AddRecurringEvent; absence in other paths does not rule out indirect dispatch',()=>{
  const a=native.native.slot62EmissionSiteAudit;
  assert.equal(a.slotRegisterWord,'0x528007C2');
  assert.equal(a.checkedWindows.length,7);
  assert.deepEqual(a.checkedWindows[0].movW2Slot62Rvas,['0x05A2A0F0']);
  assert.equal(a.checkedWindows[0].method,'Profile.AddRecurringEvent');
  assert(a.checkedWindows.slice(1).every(w=>w.movW2Slot62Rvas.length===0));
  const op=Number.parseInt(a.slotRegisterWord,16);
  assert.equal(op&31,2);
  assert.equal((op>>>5)&0xffff,62);
  assert.equal(a.absenceOfInstructionDoesNotExcludeVirtualOrIndirectNotification,true);
  assert.equal(a.actualizeClientNotificationVerified,false);
  assert.equal(a.executeClientNotificationVerified,false);
  assert.equal(native.native.clientRecurringRescheduleNotification.notificationFiredByEverySetterVerified,false);
});
test('Client wait lifecycle creates per EventID linked cancellation and Clock.Appointment from timestamp',()=>{
  const c=native.native.clientNextOccurrenceWaitLifecycle;
  assert.equal(c.waitEntryRVA,'0x0604E770');
  assert.equal(c.waitStateMachineRVA,'0x060B4D80');
  assert.equal(decodeBL(0x0604E65C,0x94000045),0x0604E770);
  assert.equal(decodeBL(0x0604EC7C,0x97FFFEBD),0x0604E770);
  assert.equal(c.clientRecurringEventCTSOffset,'0xE8');
  assert.equal(c.profileCTSOffset,'0xC0');
  assert.equal(c.perEventSourceType,'Dictionary<uint,CancellationTokenSource>');
  assert.equal(c.stateMachineSavedSourceOffset,'0x48');
  assert.equal(c.stateMachineLinkedSourceOffset,'0x50');
  assert.equal(c.eventDataOneofLoadRVA,'0x060B51B0');
  assert.equal(decodeBL(0x060B5388,0x977373BE),0x03D92280);
  assert.equal(decodeBL(0x060B53F0,0x97EBFD58),0x05BB4950);
  assert.equal(decodeBL(0x060B57EC,0x976A84D1),0x03B56B30);
  assert.equal(decodeBL(0x060B5838,0x94119EAE),0x0651D2F0);
  assert.equal(decodeBL(0x060B59FC,0x976A70D1),0x03B51D40);
  assert.equal(decodeBL(0x060B5AA4,0x9411A6C3),0x0651F5B0);
  assert.equal(c.exactWaiterCancellationRaceResolved,false);
  assert.equal(c.automaticSavedTimestampChangeNotification,false);
  assert.equal(c.sceneSpawnAfterWaitVerified,false);
  assert.equal(c.gameRestartRestorationVerified,false);
});
test('Client.OnRecurringEventRemoved cancels, disposes and removes matching CTS, independent of bare timestamp setter',()=>{
  const r=native.native.clientRecurringEventRemovalLifecycle;
  assert.equal(r.callbackRVA,'0x0604ECF0');
  assert.equal(r.dictionaryLoadRVA,'0x0604ED48');
  assert.equal(decodeBL(0x0604ED68,0x976C1F72),0x03B56B30);
  assert.equal(decodeBL(0x0604ED88,0x9413395A),0x0651D2F0);
  assert.equal(decodeBL(0x0604ED98,0x94133B22),0x0651DA20);
  assert.equal(decodeBL(0x0604EDB4,0x976C1B17),0x03B55A10);
  assert.equal(r.cancellationConditionalOnMatchingSource,true);
  assert.equal(r.invocationOnTimestampEditVerified,false);
  assert.equal(r.gameRuntimeObserved,false);
  for(const [id,kind] of [[2010000003,'ItemSpawning'],[2010000021,'ItemSpawning'],
    [2010400001,'WildCropsSpawningInVillage'],[2010500008,'FlowerSpawningInVillage']]){
    const row=native.query(id,kind);
    assert.equal(row.nativePerEventEvidence,'UNKNOWN');
    assert.equal(row.operationEvidence,'BLOCKED');
    assert.equal(row.writerAuthorized,false);
    assert.equal(row.editedExportAuthorized,false);
    assert.equal(row.gridDeletionAuthorized,false);
  }
});


const decodeBranchImmediate26=(rva,word)=>{
  assert.equal((word>>>26)&0x3f,0x05); // B, not BL
  let imm=word&0x03ffffff;if(imm&0x02000000)imm-=0x04000000;
  return rva+4*imm;
};
const decodeConditionalBranch19=(rva,word)=>{
  assert.equal((word&0xff000010)>>>0,0x54000000);
  let imm=(word>>>5)&0x7ffff;if(imm&0x40000)imm-=0x80000;
  return rva+4*imm;
};
test('Clock.Update polls currentTimeProvider and requires appointment date strictly before now',()=>{
  const c=native.native.clockAppointmentEvaluation;
  assert.equal(c.clockUpdateRVA,'0x05BB4D30');
  assert.equal(c.clockPausedFieldOffset,'0x28');
  assert.equal(c.clockPausedLoadRVA,'0x05BB4E08');
  assert.equal(c.clockAppointmentsFieldOffset,'0x10');
  assert.equal(c.currentTimeProviderFieldOffset,'0x18');
  assert.equal(c.timeZoneOffsetProviderFieldOffset,'0x20');
  assert.equal(c.currentTimeProviderLoadRVA,'0x05BB4E30');
  assert.equal(c.currentTimeProviderInvokeRVA,'0x05BB4E48');
  assert.equal(c.appointmentDateTimeFieldOffset,'0x10');
  assert.equal(c.appointmentCancellationTokenOffset,'0x18');
  assert.equal(c.appointmentTaskCompletionSourceOffset,'0x20');
  assert.equal(c.nowTicksMaskRVA,'0x05BB4E70');
  assert.equal(c.appointmentDateTimeMaskRVA,'0x05BB4F68');
  assert.equal(c.deadlineCompareRVA,'0x05BB4F6C');
  assert.equal(c.deadlineSkipBranchRVA,'0x05BB4F70');
  assert.equal(decodeConditionalBranch19(0x05BB4F70,0x54FFF8A2),0x05BB4E84);
  assert.equal(0x54FFF8A2&15,2); // B.HS means appointment >= now skips result
  assert.equal(c.strictDueCondition,'appointmentMaskedDateTime < currentProviderMaskedNow');
  assert.equal(c.deadlineEqualsNowTriggersCompletion,false);
  assert.equal(c.providerInvokedAtEachNonPausedClockUpdate,true);
  assert.equal(c.existingAppointmentReReadsRecurringEventTimestamp,false);
  assert.equal(c.timezoneOffsetReadWithinUpdate,false);
  assert.equal(c.directOSClockTimeSourceConfirmed,false);
  assert.equal(c.timezoneAndDSTBehaviorConfirmed,false);
  assert.equal(c.consoleClockJumpResultConfirmed,false);
});
test('Clock.Update has disjoint cancellation and completed-result calls with list removal',()=>{
  const c=native.native.clockAppointmentEvaluation;
  assert.equal(decodeBL(0x05BB4F18,0x977711C6),0x03979630);
  assert.equal(decodeBL(0x05BB4F90,0x977710E8),0x03979330);
  assert.equal(decodeBL(0x05BB4FA4,0x97814EEB),0x03C08B50);
  assert.equal(c.cancellationTrySetCanceledTargetRVA,'0x03979630');
  assert.equal(c.completionTrySetResultTargetRVA,'0x03979330');
  assert.equal(c.listRemoveAtTargetRVA,'0x03C08B50');
  assert.notEqual(c.cancellationTrySetCanceledCallRVA,c.completionTrySetResultCallRVA);
});
test('Client.Update invokes Clock.Update for three independently constructed clocks',()=>{
  const c=native.native.clockClientPolling;
  assert.equal(c.clientUpdateRVA,'0x0604C460');
  assert.equal(c.profilePresentGuardRVA,'0x0604C4F0');
  assert.deepEqual(c.clockCtorRvas,['0x0604A7EC','0x0604A980','0x0604AB20']);
  assert.deepEqual(c.clocks.map(x=>x.offset),['0xF0','0xF8','0x100']);
  assert.deepEqual(c.clocks.map(x=>x.clientField),['Clock','ClockOnline','ClockPortal']);
  assert.equal(decodeBL(0x0604C500,0x97EDA20C),0x05BB4D30);
  assert.equal(decodeBL(0x0604C510,0x97EDA208),0x05BB4D30);
  assert.equal(decodeBranchImmediate26(0x0604C52C,0x17EDA201),0x05BB4D30);
  assert.equal(c.constructorCreatesThreeDistinctClockObjects,true);
  assert.equal(c.worldRecurringEventUsesMainClockConfirmed,false);
  assert.equal(c.clientUpdateEntryCalledInRuntimeVerified,false);
  assert.equal(c.updateLoopDoesNotRearmAppointments,true);
});
test('Client.OnRecurringEventRescheduled early-returns while explicit block flag is set',()=>{
  const c=native.native.recurringEventClientDispatchGuards;
  assert.equal(c.handlerRVA,'0x0604E9B0');
  assert.equal(c.blockFlagField,'blockRecurringEventReschedule');
  assert.equal(c.blockFlagOffset,'0x1D0');
  assert.equal(c.flagLoadRVA,'0x0604EA34');
  assert.equal(c.earlyReturnBranchRVA,'0x0604EA3C');
  assert.equal(c.branchTargetRVA,'0x0604EA58');
  assert.equal((0x39474268>>>10)&0xfff,0x1D0);
  assert.equal(0x39474268&31,8);
  assert.equal(c.earlyReturnWhenBlockFlagNonzero,true);
  assert.equal(c.isWorldAuthoritativeCallRVA,'0x0604EA5C');
  assert.equal(decodeBL(0x0604EA5C,0x97FFE499),0x06047CC0);
  assert.equal(c.handlerContainsDirectSetterCall,false);
  assert.equal(c.handlerIsNotProofOfSubscription,true);
});
test('profile-set and debug-time-skip paths each re-enumerate recurring waits, debug guard remains distinct',()=>{
  const c=native.native.recurringWaitRecreationCallsites;
  assert.equal(c.startOrProfileSet.stateMachineRVA,'0x060A9B70');
  assert.equal(decodeBL(0x060AA13C,0x97FE8E25),0x0604D9D0);
  assert.equal(c.debugTimeSkip.stateMachineRVA,'0x060911E0');
  assert.equal(c.debugTimeSkip.blockFlagSetRVA,'0x060912B8');
  assert.equal(c.debugTimeSkip.blockFlagClearRVA,'0x06091580');
  assert.equal(decodeBL(0x060915E0,0x97FEF0FC),0x0604D9D0);
  assert.equal((0x39074288>>>10)&0xfff,0x1D0);
  assert.equal((0x390742DF>>>10)&0xfff,0x1D0);
  assert.equal(c.debugTimeSkip.debugOnlyPathNotAuthorizedProductFlow,true);
  assert.equal(c.newProfileWaitEnumeratesCandidates,true);
  assert.equal(c.existingCTSGenerationAndCleanupAcrossReloadVerified,false);
  assert.equal(c.coldLoadAndRestartRuntimeVerified,false);
  assert.equal(c.noMutationOfOwnersActualSave,true);
});


test('WaitForNextOccurrence loads Client.Clock +0xF0, not ClockOnline or ClockPortal',()=>{
  const c=native.native.recurringAppointmentToTransaction;
  assert.equal(c.stateMachineRVA,'0x060B4D80');
  assert.equal(c.clientClock,'Client.Clock');
  assert.equal(c.clientClockFieldOffset,'0xF0');
  const ldr=0xF9407A7A;
  assert.equal(ldr&31,26);
  assert.equal((ldr>>>5)&31,19);
  assert.equal(((ldr>>>10)&0xfff)*8,0xF0);
  assert.equal(c.clockLoadWord,'0xF9407A7A');
  assert.equal(decodeBL(0x0604A7EC,0x97EDA7A1),0x05BB4670);
  assert.equal(c.clientClockStoreRVA,'0x0604A7F8');
  assert.equal(c.transactionServerConsumerToW1SubtypeVerified,false);
});
test('the Clock appointment is constructed and added to the same Clock list used by Clock.WaitUntil',()=>{
  const c=native.native.recurringAppointmentToTransaction;
  assert.equal(decodeBL(0x060B53F0,0x97EBFD58),0x05BB4950);
  assert.equal(c.appointmentListFieldOffset,'0x10');
  assert.equal(c.appointmentListLoadRVA,'0x060B53F4');
  assert.equal(decodeBL(0x060B5408,0x97095A72),0x0230BDD0);
  assert.equal(decodeBL(0x05BB48FC,0x971D5D35),0x0230BDD0);
  assert.equal(c.waitTaskCompletionIsNotTransactionSuccess,true);
  assert.equal(c.consoleCallbackRuntimeVerified,false);
});
test('appointment continuation builds typed ExecuteRecurringEvent transaction with event ID, not direct subtype Execute',()=>{
  const c=native.native.recurringAppointmentToTransaction;
  assert.equal(c.transactionRequestType,'ExecuteRecurringEvent.Types.Request');
  assert.equal(c.transactionRequestField,'RecurringEventID');
  assert.equal(c.transactionRequestFieldNumber,1);
  assert.equal(c.transactionRequestFieldOffset,'0x20');
  const store=0xB9002288;
  assert.equal(store&31,8);
  assert.equal((store>>>5)&31,20);
  assert.equal(((store>>>10)&0xfff)*4,0x20);
  assert.equal(c.transactionRequestIdStoreWord,'0xB9002288');
  assert.equal(decodeBL(0x060B5F30,0x97D6A3D8),0x0565EE90);
  assert.equal(c.awaiterType,'TaskAwaiter<ExecuteRecurringEvent.Types.Response>');
  assert.equal(c.awaiterFieldOffset,'0x68');
  assert.equal(decodeBL(0x060B4FDC,0x97FE4B39),0x06047CC0);
  assert.equal(c.transactionRpcCanBeSkippedByBranches,true);
  assert.equal(c.transactionIsNotDirectW1SubtypeExecute,true);
  assert.equal(c.actualGridMutationAndPersistenceVerified,false);
});
test('subscriber direct BL scan cannot disprove delegate/virtual subscription or certify slot62 runtime',()=>{
  const s=native.native.recurringEventSubscriptionDirectCallAudit;
  assert.equal(s.scope.includes('direct AArch64 BL'),true);
  assert.equal(s.eventDispatcherAddRescheduledRVA,'0x05A8E990');
  assert.equal(s.eventDispatcherRemoveRescheduledRVA,'0x05A8EAD0');
  assert.equal(s.eventDispatcherAddRemovedRVA,'0x05A8EE40');
  assert.equal(s.eventDispatcherRemoveRemovedRVA,'0x05A8EF80');
  assert.deepEqual(s.matchingDirectBLCounts,{addRescheduled:0,removeRescheduled:0,addRemoved:0,removeRemoved:0});
  assert.equal(s.interfaceOrDelegateSubscriptionDisproved,false);
  assert.equal(s.profileCallbackAndDispatcherRegistrationResolved,false);
  assert.deepEqual(s.waitForRecurringEventsDirectBLRvas,['0x0091C620','0x060915E0','0x060AA13C']);
  assert.equal(s.additionalCallerAt0091C620Resolved,false);
  assert.equal(s.runtimeSubscriptionConfirmed,false);
  const row=native.query(2010000003,'ItemSpawning');
  assert.equal(row.nativePerEventEvidence,'UNKNOWN');
  assert.equal(row.operationEvidence,'BLOCKED');
  assert.equal(row.writerAuthorized,false);
  assert.equal(row.editedExportAuthorized,false);
});
