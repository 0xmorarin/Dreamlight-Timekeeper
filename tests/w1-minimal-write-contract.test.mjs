import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
import {assessMinimalW1WriteTargets} from '../src/w1-minimal-write-contract.mjs';

const registry=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const woodTagPack=JSON.parse(await readFile(new URL('../data/wand-iswood-crosswalk-v1253.json',import.meta.url),'utf8'));
const rules=indexTimingReviewRules(JSON.parse(await readFile(new URL('../data/timing-review-rules-v1253.json',import.meta.url),'utf8')));
const native=compileW1NativeSemantics(registry,{woodTagPack});
const index=indexEvents(registry);
const FUTURE='2126-08-20T00:00:00Z',NEW_FUTURE='2127-01-31T12:00:00Z';
const makeSave=(schema=626)=>({GameInfo:{Version:schema},Player:{Name:'Synthetic'},World:{
  RecurringEvents:{
    '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:FUTURE,EndDate:null}},
    '1':{WildCropsSpawningInVillage:{RecurringEventItemID:2010400001,NextOccurrence:'2026-11-02T00:00:00Z'}},
    '2':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:'2026-11-02T00:00:00Z'}},
    '3':{FishSpawningInVillage:{RecurringEventItemID:2010200014,NextOccurrence:FUTURE}},
    '4':{ItemSpawning:{RecurringEventItemID:2010000064,NextOccurrence:FUTURE}},
    '5':{SnippetSpawning:{RecurringEventItemID:2011300000,NextOccurrence:FUTURE}},
    '6':{ItemSpawning:{RecurringEventItemID:2010000093,NextOccurrence:FUTURE}},
    '9':{ItemSpawning:{RecurringEventItemID:2010000120,NextOccurrence:FUTURE}},
    '7':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:FUTURE}},
    '8':{ItemSpawning:{RecurringEventItemID:999999999,NextOccurrence:FUTURE}}
  },
  Stores:[{LastRefresh:FUTURE}]
}});
const snapshot=p=>assessTimingSnapshot(projectProfile(p,index,{now:Date.parse('2026-11-02T01:00:00Z')}),rules);
const plan=(s,ids,target=NEW_FUTURE)=>ids.map(id=>{
  const row=s.rows.find(x=>x.id===id);
  assert(row,'fixture row missing for '+id);
  return {pointer:row.pointer,originalTime:row.time,targetTime:target};
});
const assess=(p,s,rows,raw=registry,ledger=native)=>
  assessMinimalW1WriteTargets(p,s,rows,raw,ledger);

test('source 508 definition and Native W1 scope remain separate from write permission',()=>{
  assert.equal(registry.events.length,508);
  assert.equal(native.sourceEventCount,508);
  const p=makeSave(),s=snapshot(p),before=JSON.stringify(p);
  const r=assess(p,s,plan(s,[2010000021,2010400001,2010500008]));
  assert.equal(r.contractVersion,'minimal-w1-target-v1');
  assert.equal(r.status,'STRUCTURAL_W1_TARGETS_ONLY');
  assert.deepEqual(r.scope.allowedVariants,[
    'ItemSpawning','WildCropsSpawningInVillage',
    'FlowerSpawningInVillage','FishSpawningInVillage']);
  assert.equal(r.scope.jsonPointerTemplate,'/World/RecurringEvents/<index>/<Variant>/NextOccurrence');
  assert.equal(r.scope.dataPathTemplate,'World.RecurringEvents/<index>/<Variant>/NextOccurrence');
  assert.equal(r.scope.allowedProfileSchema,626);
  assert.equal(r.summary.candidates,3);
  assert.deepEqual(r.candidateTargets.map(x=>[x.eventId,x.savedIndex,x.variant,x.pointer]),[
    [2010000021,0,'ItemSpawning','/World/RecurringEvents/0/ItemSpawning/NextOccurrence'],
    [2010400001,1,'WildCropsSpawningInVillage','/World/RecurringEvents/1/WildCropsSpawningInVillage/NextOccurrence'],
    [2010500008,2,'FlowerSpawningInVillage','/World/RecurringEvents/2/FlowerSpawningInVillage/NextOccurrence']
  ]);
  assert.deepEqual(r.candidateTargets[0].linkedItemIds,[...new Set(registry.events.find(e=>e.id===2010000021).items.map(x=>x.id))].sort((a,b)=>a-b));
  assert.equal(r.candidateTargets[0].originalTime,FUTURE);
  assert.equal(r.ownerFutureDateIsCorruption,false);
  assert.equal(r.sourceMutationPerformed,false);
  assert.equal(r.encodedEditedFile,false);
  assert.equal(r.writerAuthorized,false);
  assert.equal(r.editedExportAuthorized,false);
  assert.equal(r.exportAvailable,false);
  assert.deepEqual(r.authorizedMutationPaths,[]);
  assert(r.rows.every(x=>x.targetStructurallyEligible&&x.writerAuthorized===false));
  assert.equal(JSON.stringify(p),before);
  assert.throws(()=>r.candidateTargets.push({}),TypeError);
  assert.throws(()=>r.candidateTargets[0].linkedItemIds.push(1),TypeError);
});
test('Owner reported suppression is explicitly not per-EventID proof or blanket W1 permission',()=>{
  const r=assess(makeSave(),snapshot(makeSave()),[],registry,native);
  assert.equal(r.ownerObservation.evidence,'OWNER_REPORTED_RUNTIME_CONFIRMED');
  assert.deepEqual(r.ownerObservation.exactEventIdsConfirmed,[]);
  assert.equal(r.ownerObservation.eventIdSpecificRuntimeAuthorization,false);
  assert.equal(r.ownerObservation.gameBuildAndSchemaIndependentlyVerifiedForObservation,false);
  assert.equal(r.ownerObservation.extensionToAllW1VariantsPermitted,false);
  assert.equal(r.ownerObservation.independentQRAcceptance,false);
  assert.equal(r.status,'BLOCKED_W1_WRITE_TARGETS');
  assert.deepEqual(r.candidateTargets,[]);
  assert.equal(r.writerAuthorized,false);
});
test('inactive Fish, protected Moonstone, W2 Snippet and TimeBending never create candidates',()=>{
  const p=makeSave(),s=snapshot(p);
  for(const [id,code] of [[2010200014,'INACTIVE_OR_UNKNOWN_SOURCE'],
    [2010000064,'PROTECTED_OR_NON_W1'],[2011300000,'PATH_OR_VARIANT_OUT_OF_SCOPE'],
    [2010000093,'PROTECTED_OR_NON_W1'],[2010000120,'PROTECTED_OR_NON_W1']]){
    const r=assess(p,s,plan(s,[id]));
    assert.equal(r.rows[0].code,code);
    assert.equal(r.summary.candidates,0);
    assert.deepEqual(r.candidateTargets,[]);
    assert.equal(r.writerAuthorized,false);
  }
  assert.equal(registry.events.filter(e=>e.group==='釣り'&&e.subgroup==='波紋の生成').length,46);
  assert(registry.events.filter(e=>e.group==='釣り'&&e.subgroup==='波紋の生成').every(e=>e.active===false));
});
test('no approval from a mixed batch when any candidate is blocked',()=>{
  const p=makeSave(),s=snapshot(p);
  const r=assess(p,s,plan(s,[2010000021,2010000064,2010500008]));
  assert.deepEqual(r.rows.map(x=>x.code),
    ['TARGET_STRUCTURALLY_ELIGIBLE','PROTECTED_OR_NON_W1','TARGET_STRUCTURALLY_ELIGIBLE']);
  assert.equal(r.status,'BLOCKED_W1_WRITE_TARGETS');
  assert.equal(r.summary.candidates,0);
  assert.deepEqual(r.candidateTargets,[]);
});
test('variant conflict, duplicate/unknown variants, event ID mismatch fail closed',()=>{
  const p=makeSave(),s=snapshot(p),entry=plan(s,[2010000021]);
  p.World.RecurringEvents['0'].FishSpawningInVillage={RecurringEventItemID:2010200014,NextOccurrence:FUTURE};
  assert.match(assess(p,s,entry).rows[0].code,/AMBIGUOUS|PREFLIGHT_/);
  delete p.World.RecurringEvents['0'].FishSpawningInVillage;
  p.World.RecurringEvents['0'].FutureUnknownVariant={};
  assert.equal(assess(p,s,entry).rows[0].code,'AMBIGUOUS_OR_UNKNOWN_VARIANT');
  delete p.World.RecurringEvents['0'].FutureUnknownVariant;
  p.World.RecurringEvents['0'].ItemSpawning.RecurringEventItemID=2010500008;
  assert.equal(assess(p,s,entry).rows[0].code,'PREFLIGHT_RECURRING_EVENT_ID_MISMATCH');
  const p2=makeSave();
  p2.World.RecurringEvents['1']={ItemSpawning:{
    RecurringEventItemID:2010400001,NextOccurrence:'2026-11-02T00:00:00Z'
  }};
  const s2=snapshot(p2);
  assert.equal(assess(p2,s2,plan(s2,[2010400001])).rows[0].code,
    'SOURCE_VARIANT_NOT_SUPPORTED');
});
test('duplicate saved Event ID, changed pointer index, and unrecognized source definition are blocked',()=>{
  const p=makeSave(),s=snapshot(p),entry=plan(s,[2010000021]);
  p.World.RecurringEvents['9']={ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:FUTURE}};
  assert.equal(assess(p,s,entry).rows[0].code,'DUPLICATE_SAVED_EVENT_ID');
  const p2=makeSave(),s2=snapshot(p2),e2=plan(s2,[2010000021])[0];
  assert.equal(assess(p2,s2,[{...e2,pointer:'/World/RecurringEvents/09/ItemSpawning/NextOccurrence'}]).rows[0].code,'PATH_OR_VARIANT_OUT_OF_SCOPE');
  assert.equal(assess(p2,s2,plan(s2,[999999999])).rows[0].code,'PREFLIGHT_EVENT_DEFINITION_UNKNOWN');
});
test('only exact schema 626 accepted, even when newer schema structurally parses',()=>{
  const p=makeSave(650),s=snapshot(p),r=assess(p,s,plan(s,[2010000021]));
  assert.equal(r.rows[0].code,'SCHEMA_MISMATCH');
  assert.equal(r.status,'BLOCKED_W1_WRITE_TARGETS');
  assert.equal(r.writerAuthorized,false);
  assert.deepEqual(r.candidateTargets,[]);
});
test('valid future and old date inputs are not reclassified as corruption',()=>{
  const p=makeSave(),s=snapshot(p);
  for(const target of [NEW_FUTURE,'2022-09-06T00:00:00Z','2026-11-02T01:00:00Z']){
    const r=assess(p,s,plan(s,[2010000021],target));
    assert.equal(r.rows[0].code,'TARGET_STRUCTURALLY_ELIGIBLE');
    assert.equal(r.rows[0].targetTime,target);
    assert.equal(r.ownerFutureDateIsCorruption,false);
    assert.equal(r.writerAuthorized,false);
  }
});
test('stale original and invalid UTC timestamps reject without a write',()=>{
  const p=makeSave(),s=snapshot(p),entry=plan(s,[2010000021]);
  p.World.RecurringEvents['0'].ItemSpawning.NextOccurrence='2025-01-01T00:00:00Z';
  assert.equal(assess(p,s,entry).rows[0].code,'PREFLIGHT_ORIGINAL_VALUE_MISMATCH');
  const p2=makeSave(),s2=snapshot(p2);
  assert.equal(assess(p2,s2,plan(s2,[2010000021],'2026-02-30T00:00:00Z')).rows[0].code,'PREFLIGHT_TARGET_TIME_INVALID');
  assert.equal(assess(p2,s2,plan(s2,[2010000021],FUTURE)).rows[0].code,'PREFLIGHT_NO_CHANGE');
});
test('tampered source policy, activity, linked Item IDs, and Native ledger divergence reject',()=>{
  const p=makeSave(),s=snapshot(p),entry=plan(s,[2010000021]);
  const changed=s.rows.map(r=>r.id===2010000021?{...r,items:[{id:777777}]}:r);
  assert.equal(assess(p,{...s,rows:changed},entry).rows[0].code,'LINKED_ITEM_ID_MISMATCH');
  const defs=registry.events.map(e=>e.id===2010000021?{...e,active:false}:e);
  assert.throws(()=>assess(p,s,entry,{...registry,events:defs},native),/diverge/);
  assert.throws(()=>assess(p,s,entry,registry,{...native,source:{...native.source,buildId:'WRONG'}}),/ledger/);
});
test('source checksum metadata and count are required; schema and review provenance cannot be spoofed',()=>{
  const p=makeSave(),s=snapshot(p),entry=plan(s,[2010000021]);
  assert.throws(()=>assess(p,s,entry,{...registry,source:{...registry.source,rawEventSHA256:'WRONG'}},native),/registry/);
  assert.throws(()=>assess(p,s,entry,{...registry,events:registry.events.slice(1)},native),/registry/);
  assert.throws(()=>assess(p,{...s,timingReview:{...s.timingReview,writerAuthorization:true}},entry),/provenance/);
  assert.throws(()=>assess({...p,GameInfo:{Version:627}},s,entry),/identity/);
});
test('non-target path, duplicate plan, unsafe key and unknown native variant never authorize mutations',()=>{
  const p=makeSave(),s=snapshot(p),entry=plan(s,[2010000021])[0];
  assert.throws(()=>assess(p,s,[entry,entry]),/duplicate/i);
  assert.throws(()=>assess(p,s,[{...entry,pointer:'/World/__proto__/x'}]),/invalid/i);
  const store=s.rows.find(x=>x.source==='World.Stores');
  assert(store);
  const r=assess(p,s,[{pointer:store.pointer,originalTime:store.time,targetTime:NEW_FUTURE}]);
  assert.equal(r.rows[0].code,'PATH_OR_VARIANT_OUT_OF_SCOPE');
  assert.equal(r.writerAuthorized,false);
});
