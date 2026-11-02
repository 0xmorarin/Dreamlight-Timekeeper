// 05 QR Round 6 independent synthetic-only new-integrated-HEAD negative acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {makeSyntheticP1gProfile} from '../tests/fixture.mjs';
import {p1gPackagedProfileCodec as codec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {inspectTimingPlan} from '../src/core/timing-plan-preflight.mjs';
import {auditTimingDeltaIsolated} from '../src/core/timing-delta-audit.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
const data=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const source=()=>({GameInfo:{Version:626,OwnerUnknown:'keep'},Player:{Name:'QR synthetic'},
  World:{RecurringEvents:{
   '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z',Unrecognized:[null,{timestampAsText:'000000'}]}},
   '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:'2026-11-02T00:00:00Z'}}
  },UnknownGrid:{tiles:[null,{code:'001'},'hold']}},
  Additional:{opaque:{array:[null,0,false,'\\u006b',{'13':'last','2':'first'}],numericLooking:'9007199254740993'}}});
test('R6 CORE independent two-event synthetic exact-pointer Encode/Reopen keeps arrays, unknowns, source bytes',async()=>{
 const input=makeSyntheticP1gProfile(source()),untouched=Buffer.from(input);
 const decoder=await codec.loadProfile(input),original=parseSafeJson(decoder.jsonText);
 const events=indexEvents(await data('data/events-v1253.json'));
 const view=projectProfile(original,events,{now:Date.parse('2026-11-02T00:00:00Z')});
 const updates=[
  [2010000021,'2126-08-20T00:00:00Z','2128-04-01T00:00:00.000Z'],
  [2010500008,'2026-11-02T00:00:00Z','2022-09-06T00:00:00.000Z']
 ].map(([id,originalTime,targetTime])=>({pointer:view.rows.find(row=>row.id===id).pointer,originalTime,targetTime}));
 const p=inspectTimingPlan(original,view,updates);
 assert.equal(p.summary.structuralShapeObserved,2);
 const audit=auditTimingDeltaIsolated(original,view,updates);
 assert.equal(audit.status,'READ_ONLY_ISOLATED_JSON_DIFF_PASS');
 const clone=structuredClone(original);
 for(const change of updates){
  const parts=change.pointer.slice(1).split('/').map(x=>x.replaceAll('~1','/').replaceAll('~0','~'));
  let item=clone;
  for(const part of parts.slice(0,-1))item=item[part];
  assert.equal(item[parts.at(-1)],change.originalTime);
  item[parts.at(-1)]=change.targetTime;
 }
 const expected=updates.map(x=>x.pointer).sort();
 assert.deepEqual(diffPaths(original,clone).sort(),expected);
 const encoded=await codec.createEncodedProfile(JSON.stringify(clone),decoder.metadata);
 const independentlyOpened=await codec.loadProfile(encoded);
 const decoded=parseSafeJson(independentlyOpened.jsonText);
 assert.deepEqual(decoded,clone);
 assert.deepEqual(diffPaths(original,decoded).sort(),expected);
 assert.deepEqual(decoded.Additional,original.Additional);
 assert.deepEqual(decoded.World.UnknownGrid,original.World.UnknownGrid);
 assert.deepEqual(decoded.World.RecurringEvents['0'].ItemSpawning.Unrecognized,original.World.RecurringEvents['0'].ItemSpawning.Unrecognized);
 assert.deepEqual(Buffer.from(input),untouched);
 assert.equal(audit.editedCopyAuthorized,false);
 assert.equal(audit.writerAuthorized,false);
 assert.equal(auditP1gEnvelope({format:'packaged',metadata:independentlyOpened.metadata}).writerAuthorized,false);
});
test('R6 CORE stale expected timestamp, wrong source ID and newer schema all fail closed',async()=>{
 const events=indexEvents(await data('data/events-v1253.json'));
 const original=source(),view=projectProfile(original,events);
 const row=view.rows.find(r=>r.id===2010000021);
 const change={pointer:row.pointer,originalTime:'2126-08-20T00:00:00Z',targetTime:'2022-09-06T00:00:00.000Z'};
 assert.equal(inspectTimingPlan(original,view,[{...change,originalTime:'2011-01-01T00:00:00Z'}]).rows[0].code,'ORIGINAL_VALUE_MISMATCH');
 assert.equal(auditTimingDeltaIsolated(original,view,[{...change,originalTime:'2011-01-01T00:00:00Z'}]).editedCopyAuthorized,false);
 const changed=structuredClone(original);
 changed.World.RecurringEvents['0'].ItemSpawning.RecurringEventItemID=2010000017;
 assert.equal(inspectTimingPlan(changed,view,[change]).rows[0].code,'RECURRING_EVENT_ID_MISMATCH');
 const newer={...original,GameInfo:{...original.GameInfo,Version:700}};
 const newView=projectProfile(newer,events);
 const result=inspectTimingPlan(newer,newView,[{...change}]);
 assert.equal(result.editedCopyAuthorized,false);
});
test('R6 TIME static creation candidates do not prove object lifecycle, variant or runtime',async()=>{
 const registry=await data('data/events-v1253.json'),wood=await data('data/wand-iswood-crosswalk-v1253.json');
 const ledger=compileW1NativeSemantics(registry,{woodTagPack:wood});
 assert.equal(ledger.sourceEventCount,508);
 assert.equal(ledger.source.buildId,'9A239D3DB569756D');
 assert.notEqual(ledger.source.buildId,ledger.native.primaryBinary.mainSHA256);
 assert.equal(ledger.native.primaryBinary.runtimeVerified,false);
 const candidates=ledger.native.w1GenerationConsumers;
 assert.equal(candidates.ItemSpawning.executeRVA,ledger.traces.ItemSpawning.executeRVA);
 assert.equal(candidates.ItemSpawning.findValidPositionRVA,'0x057BE080');
 assert.equal(candidates.ItemSpawning.requestConstructRVA,'0x057BE6F8');
 assert.equal(candidates.ItemSpawning.placedGridObjectIdProven,false);
 assert.equal(candidates.WildCropsSpawningInVillage.gridObjectIdLoadRVA,'0x057C41A8');
 assert.equal(candidates.WildCropsSpawningInVillage.placedGridObjectIdProvenForRuntime,false);
 assert.equal(candidates.FlowerSpawningInVillage.indirectAddObjectTargetResolved,false);
 assert.equal(candidates.FlowerSpawningInVillage.liveObjectSpawnObserved,false);
 assert.equal(candidates.FishSpawningInVillage.gridObjectIdProven,false);
 const fish=registry.events.filter(e=>e.group==='釣り'&&e.subgroup==='波紋の生成');
 assert.equal(fish.length,46);
 assert(fish.every(x=>x.active===false));
 for(const e of fish)assert.equal(ledger.query(e.id,'FishSpawningInVillage').operationEvidence,'BLOCKED');
 for(const [id,kind] of [[2010000021,'ItemSpawning'],[2010400001,'WildCropsSpawningInVillage'],[2010500008,'FlowerSpawningInVillage'],[2010000064,'ItemSpawning']]){
  const r=ledger.query(id,kind);
  assert.equal(r.nativePerEventEvidence,id===2010000064?'BLOCKED':'UNKNOWN');
  assert.equal(r.writerAuthorized,false);
  assert.equal(r.editedExportAuthorized,false);
  assert.equal(r.gridDeletionAuthorized,false);
  assert.equal(r.actualAppearanceEvidence,'UNKNOWN');
 }
 assert.equal(ledger.query(2010500008,'FishSpawningInVillage').status,'SOURCE_VARIANT_HINT_CONFLICT');
});
test('R6 TIME dispatcher slot is not Reschedule, hardware plan contains only unpassed read-only cases',async()=>{
 const registry=await data('data/events-v1253.json'),wood=await data('data/wand-iswood-crosswalk-v1253.json');
 const n=compileW1NativeSemantics(registry,{woodTagPack:wood});
 const p=n.native.pendingFishDispatchConsumer;
 assert.equal(p.interfaceSlot,39);
 assert.equal(p.worldEventInterface,'IWorldEventDispatcher.RaisePendingFishRemoved');
 assert.equal(p.profileDispatcherImplementationRVA,'0x05A8DB40');
 assert.equal(p.fishingSystemHandlerRVA,'0x033FDB20');
 assert.equal(p.handlerDirectRescheduleCall,false);
 assert.equal(p.bodyOfWaterDirectRescheduleCall,false);
 assert.equal(p.indirectReschedulePathVerified,false);
 assert.equal(p.gameRuntimeObserved,false);
 assert.equal(n.native.pendingFishRemoval.indirectRescheduleViaDispatcherVerified,false);
 assert.equal(n.native.runtimeAcceptanceCases.length,8);
 for(const c of n.native.runtimeAcceptanceCases){
  assert.equal(c.passed,false);
  assert.equal(c.originalOwnerSaveMutationAllowed,false);
  assert.equal(c.requiresSeparateHardwareAcceptance,true);
 }
 assert.equal(n.native.runtimeAcceptanceCases.filter(x=>x.variant==='FishSpawningInVillage')[0].eligibility,'INACTIVE_SOURCE_ONLY');
});
