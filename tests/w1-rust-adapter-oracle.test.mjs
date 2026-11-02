import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
import {assessMinimalW1WriteTargets} from '../src/w1-minimal-write-contract.mjs';
import {projectW1RustAdapterOracle} from '../src/w1-rust-adapter-oracle.mjs';

const json=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const registry=await json('events-v1253.json');
const woodTagPack=await json('wand-iswood-crosswalk-v1253.json');
const rules=indexTimingReviewRules(await json('timing-review-rules-v1253.json'));
const index=indexEvents(registry);
const ledger=compileW1NativeSemantics(registry,{woodTagPack});
const FUTURE='2126-08-20T00:00:00Z',NOW='2026-11-02T02:00:00Z';
const fixture=()=>({GameInfo:{Version:626},Player:{Name:'Synthetic'},World:{RecurringEvents:{
  '7':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:FUTURE}},
  '8':{WildCropsSpawningInVillage:{RecurringEventItemID:2010400001,NextOccurrence:FUTURE}},
  '9':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:FUTURE}},
  '10':{FishSpawningInVillage:{RecurringEventItemID:2010200014,NextOccurrence:FUTURE}},
  '11':{ItemSpawning:{RecurringEventItemID:2010000064,NextOccurrence:FUTURE}},
  '12':{ItemSpawning:{RecurringEventItemID:2010000093,NextOccurrence:FUTURE}},
  '13':{ItemSpawning:{RecurringEventItemID:2010000120,NextOccurrence:FUTURE}},
  '14':{SnippetSpawning:{RecurringEventItemID:2011300000,NextOccurrence:FUTURE}}
}}});
const snapshot=p=>assessTimingSnapshot(projectProfile(p,index,{now:Date.parse('2026-11-02T00:00:00Z')}),rules);
const selected=(snapshot,ids,target=NOW)=>ids.map(eventId=>{
  const row=snapshot.rows.find(r=>r.id===eventId);
  assert(row,'No synthetic saved EventID '+eventId);
  return {pointer:row.pointer,originalTime:row.time,targetTime:target};
});
const project=(p,s,plan,reg=registry,native=ledger)=>projectW1RustAdapterOracle({
  profile:p,snapshot:s,plan,registry:reg,ledger:native
});

test('Rust adapter projection and existing JS W1 oracle have exact all-or-nothing candidate parity',()=>{
 const p=fixture(),s=snapshot(p),plan=selected(s,[2010000021,2010400001,2010500008]);
 const before=JSON.stringify(p);
 const js=assessMinimalW1WriteTargets(p,s,plan,registry,ledger);
 const result=project(p,s,plan);
 assert.equal(result.status,'STRUCTURAL_CANDIDATE_ONLY');
 assert.equal(js.status,'STRUCTURAL_W1_TARGETS_ONLY');
 assert.deepEqual(result.operations.map(x=>[x.sourceEventId,x.savedIndex,x.savedOneofVariant,
   x.jsonPointer,x.oldValueUtc,x.newValueUtc]),
   js.candidateTargets.map(x=>[x.eventId,x.savedIndex,x.variant,
     x.pointer,x.originalTime,x.targetTime]));
 assert.deepEqual(result.operations.map(x=>x.jsonPointer),[
  '/World/RecurringEvents/7/ItemSpawning/NextOccurrence',
  '/World/RecurringEvents/8/WildCropsSpawningInVillage/NextOccurrence',
  '/World/RecurringEvents/9/FlowerSpawningInVillage/NextOccurrence'
 ]);
 assert.equal(result.source.definitionsCount,508);
 assert.equal(result.source.buildId,'9A239D3DB569756D');
 assert.equal(result.source.saveSchema,626);
 assert.equal(result.source.mainSha256,'16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a');
 assert(result.requiredCommonEngineGates.includes('STRICT_JSON_SPAN'));
 assert(result.requiredCommonEngineGates.includes('SINGLE_ENCODE_AND_INDEPENDENT_REOPEN'));
 assert.equal(result.capabilityGranted,false);
 assert.equal(result.writerAuthorized,false);
 assert.equal(result.persistentReplaceAuthorized,false);
 assert.equal(result.originalSourceOverwriteAllowed,false);
 assert.equal(result.runtimePerEventIdConfirmed,false);
 assert.equal(result.ownerFutureDateIsCorruption,false);
 assert.equal(JSON.stringify(p),before);
 assert.throws(()=>result.operations.push({}),TypeError);
 assert.throws(()=>result.operations[0].linkedItemIds.push(1),TypeError);
});

test('Native source consumers and bounded catchup observations come only from existing verified ledger',()=>{
 const p=fixture(),s=snapshot(p);
 const r=project(p,s,selected(s,[2010000021,2010400001,2010500008]));
 const expected=[
  ['0x057B9BC0','0x057BF0C4','intervalTicks * trunc(GetMaximumAmount / MinNumberOfSpawn)'],
  ['0x057C2BC0','0x057C4260','intervalTicks * trunc(GetMaximumAmount / NumberOfGardensToSpawn)'],
  ['0x057C99E0','0x057CAE58','intervalTicks * trunc(MaximumAmount / NumberOfFlowersToSpawn)']
 ];
 assert.deepEqual(r.decisions.map(x=>[
   x.nativeEvidence.nativeExecuteRVA,x.nativeEvidence.nativeRescheduleCallRVA,
   x.nativeEvidence.nativeMaxIntervalFormula]),expected);
 for(const row of r.decisions){
  assert.equal(row.nativeEvidence.level,'STATIC_ONLY');
  assert.equal(row.nativeEvidence.nativeAreaGridResult,'UNKNOWN');
  assert.equal(row.nativeEvidence.nativePickupRemoveReschedules,'UNKNOWN');
  assert.equal(row.nativeEvidence.nativeSpawnSuccess,'UNKNOWN');
  assert.equal(row.nativeEvidence.nativeEventIdSpecificExecution,'UNKNOWN');
  assert.equal(row.nativeEvidence.independentRuntimeAcceptance,false);
 }
});

test('future and overdue are user-selectable timestamps, not automatic damage or reschedule proof',()=>{
 const p=fixture(),s=snapshot(p);
 for(const target of ['2127-02-01T00:00:00Z','2022-09-06T00:00:00Z',NOW]){
  const r=project(p,s,selected(s,[2010000021],target));
  assert.equal(r.status,'STRUCTURAL_CANDIDATE_ONLY');
  assert.equal(r.operations[0].oldValueUtc,FUTURE);
  assert.equal(r.operations[0].newValueUtc,target);
  assert.equal(r.ownerFutureDateIsCorruption,false);
  assert.equal(r.operations[0].capabilityGranted,false);
 }
});

test('inactive Fish, Moonstone, both TimeBending, W2, unknown oneof all deny adapter operations',()=>{
 const p=fixture(),s=snapshot(p);
 for(const eventId of [2010200014,2010000064,2010000093,2010000120,2011300000]){
  const r=project(p,s,selected(s,[eventId]));
  assert.equal(r.status,'DENIED');
  assert.deepEqual(r.operations,[]);
  assert.equal(r.decisions.length,1);
  assert.equal(r.decisions[0].verdict,'DENY');
  assert.equal(r.decisions[0].requiredCapability,'NONE');
  assert.equal(r.capabilityGranted,false);
 }
 assert.equal(registry.events.filter(e=>e.group==='釣り'&&e.subgroup==='波紋の生成').length,46);
 assert(registry.events.filter(e=>e.group==='釣り'&&e.subgroup==='波紋の生成').every(e=>e.active===false));
});

test('mixed eligible and protected proposals deny whole Rust operation batch',()=>{
 const p=fixture(),s=snapshot(p);
 const r=project(p,s,selected(s,[2010000021,2010000064]));
 assert.equal(r.status,'DENIED');
 assert.deepEqual(r.operations,[]);
 assert.deepEqual(r.decisions.map(x=>x.verdict),['STRUCTURAL_CANDIDATE','DENY']);
 assert.equal(r.requiredCommonEngineGates.length>0,true);
 assert.equal(r.gridDeletionAllowed,false);
 assert.equal(r.moonstoneRelocationAllowed,false);
});

test('oneof, EventID, stored index and original value drift are rejected by the same JS oracle',()=>{
 const p=fixture(),s=snapshot(p),original=selected(s,[2010000021]);
 p.World.RecurringEvents['7'].FlowerSpawningInVillage={RecurringEventItemID:2010500008,NextOccurrence:FUTURE};
 assert.equal(project(p,s,original).status,'DENIED');
 delete p.World.RecurringEvents['7'].FlowerSpawningInVillage;
 p.World.RecurringEvents['7'].ItemSpawning.RecurringEventItemID=2010500008;
 assert.equal(project(p,s,original).status,'DENIED');
 p.World.RecurringEvents['7'].ItemSpawning.RecurringEventItemID=2010000021;
 p.World.RecurringEvents['7'].ItemSpawning.NextOccurrence='2026-01-01T00:00:00Z';
 assert.equal(project(p,s,original).status,'DENIED');
});

test('untrusted registry or Native ledger mismatch fail closed before Rust plan emission',()=>{
 const p=fixture(),s=snapshot(p),plan=selected(s,[2010000021]);
 assert.throws(()=>project(p,s,plan,{...registry,events:registry.events.slice(1)}),/registry/);
 assert.throws(()=>project(p,s,plan,registry,{
  ...ledger,source:{...ledger.source,buildId:'UNKNOWN'}
 }),/ledger/);
 assert.throws(()=>project({...p,GameInfo:{Version:627}},s,plan),/preflight|identity/i);
});
