import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
import {projectW1RustAdapterOracle} from '../src/w1-rust-adapter-oracle.mjs';

const executable=process.env.WAND_W1_RESEARCH_BINARY;
// Ordinary JS CI without the separately compiled Wand crate skips this integration suite.
// Dedicated 02 TIME CI MUST supply the real compiled pinned Wand binary.
const testWand=executable?test:test.skip;
const fromData=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const registry=await fromData('events-v1253.json');
const wood=await fromData('wand-iswood-crosswalk-v1253.json');
const rules=indexTimingReviewRules(await fromData('timing-review-rules-v1253.json'));
const index=indexEvents(registry);
const ledger=compileW1NativeSemantics(registry,{woodTagPack:wood});
const OLD='2126-08-20T00:00:00Z',NEW='2022-09-06T00:00:00Z';
const variants=[
 {id:2010000021,kind:'ItemSpawning',execute:'0x057B9BC0',sourceAllow:true},
 {id:2010400001,kind:'WildCropsSpawningInVillage',execute:'0x057C2BC0',sourceAllow:true},
 {id:2010500008,kind:'FlowerSpawningInVillage',execute:'0x057C99E0',sourceAllow:true},
 {id:2010200014,kind:'FishSpawningInVillage',execute:'0x057C6890',sourceAllow:false}
];
const make=(id,kind,idx=7)=>({
 GameInfo:{Version:626},Player:{Name:'Synthetic',ListInventories:{'0':[{'ItemID':2,Quantity:1}]}},
 World:{RecurringEvents:{[idx]:{[kind]:{RecurringEventItemID:id,NextOccurrence:OLD}}},
  GridObjects:{'5':[{'ItemID':31700014,State:{Opaque:{keep:true}}}]},QuestState:{'X':{Active:false}}},
 Unknown:{nested:{keep:'\\u00e9',number:1.00}}
});
const clone=o=>structuredClone(o);
const snapshot=p=>assessTimingSnapshot(projectProfile(p,index,{now:Date.parse('2026-11-03T00:00:00Z')}),rules);
const select=(s,id,target=NEW)=>{
 const r=s.rows.find(x=>x.id===id);
 assert(r,'Expected one saved EventID '+id);
 return {pointer:r.pointer,originalTime:r.time,targetTime:target};
};
const js=(profile,s,rows)=>projectW1RustAdapterOracle({profile,snapshot:s,plan:rows,registry,ledger});
function rust(raw,id,idx,kind,old=OLD,target=NEW,mode='normal') {
 const p=spawnSync(executable,[String(id),String(idx),kind,old,target,mode],{
   input:raw,encoding:'utf8',maxBuffer:1024*1024
 });
 assert.equal(p.status,0,'Wand research process: '+String(p.stderr).slice(0,800));
 assert.equal(p.stderr.trim(),'','No Rust warnings/private source diagnostics to stdout');
 return JSON.parse(p.stdout);
}
const raw=p=>JSON.stringify(p);

testWand('all four W1: actual Wand Rust structural witness vs JS source-and-Native meaning oracle',()=>{
 for(const {id,kind,execute,sourceAllow} of variants) {
  const p=make(id,kind),s=snapshot(p),out=js(p,s,[select(s,id)]);
  const witness=rust(raw(p),id,7,kind);
  assert.equal(witness.status,'RUST_STRUCTURAL_WITNESS_ONLY');
  assert.equal(witness.eventId,id);
  assert.equal(witness.savedIndex,7);
  assert.equal(witness.oneof,kind);
  assert.equal(witness.pointer,`/World/RecurringEvents/7/${kind}/NextOccurrence`);
  assert.equal(witness.oldUtc,OLD);
  assert.equal(witness.newUtc,NEW);
  assert.equal(witness.rawOldJson,JSON.stringify(OLD));
  assert.equal(witness.saveSchema,626);
  assert.equal(witness.externalBuildId,'9A239D3DB569756D');
  assert.equal(witness.registryDigestMatched,true);
  assert.equal(witness.buildBoundToSave,false);
  assert.equal(witness.registryEventSemanticsVerified,false);
  assert.equal(witness.nativeSemanticsVerified,false);
  assert.equal(witness.referenceClosureComplete,false);
  assert.equal(witness.encodeCopyAuthorized,false);
  assert.equal(new Set([witness.encryptedP1gSha256,witness.decodedJsonSha256,witness.registrySha256]).size,3);
  assert.equal(out.decisions.length,1);
  assert.equal(out.decisions[0].selector.sourceEventId,id);
  assert.equal(out.decisions[0].selector.savedIndex,7);
  assert.equal(out.decisions[0].selector.savedOneofVariant,kind);
  assert.equal(out.decisions[0].nativeEvidence.nativeExecuteRVA,execute);
  assert.equal(out.decisions[0].nativeEvidence.nativeSpawnSuccess,'UNKNOWN');
  assert.equal(out.capabilityGranted,false);
  assert.equal(out.status,sourceAllow?'STRUCTURAL_CANDIDATE_ONLY':'DENIED');
  if(sourceAllow) {
   assert.deepEqual(out.operations.map(o=>[o.jsonPointer,o.oldValueUtc,o.newValueUtc]),
    [[witness.pointer,witness.oldUtc,witness.newUtc]]);
  } else {
   assert.deepEqual(out.operations,[],'All 46 inactive fish definitions must deny even when structural Rust witness passes');
  }
 }
});

testWand('2126 source future, earlier 2022, later 2127 remain manual timestamps without automatic corruption inference',()=>{
 const p=make(2010000021,'ItemSpawning'),s=snapshot(p);
 for(const target of ['2022-09-06T00:00:00Z','2127-01-01T00:00:00Z']) {
  const out=js(p,s,[select(s,2010000021,target)]);
  const witness=rust(raw(p),2010000021,7,'ItemSpawning',OLD,target);
  assert.equal(out.status,'STRUCTURAL_CANDIDATE_ONLY');
  assert.equal(witness.newUtc,target);
  assert.equal(out.ownerFutureDateIsCorruption,false);
  assert.equal(witness.encodeCopyAuthorized,false);
 }
});

testWand('Wand raw JSON lexical CAS differs from decoded UTC, no unrelated nested token rewrite or output permission',()=>{
 const p=make(2010000021,'ItemSpawning'),s=snapshot(p);
 const encoded=raw(p).replace(JSON.stringify(OLD),'"\\u0032126-08-20T00:00:00Z"');
 assert.notEqual(encoded,raw(p));
 assert.equal(JSON.parse(encoded).World.RecurringEvents[7].ItemSpawning.NextOccurrence,OLD);
 const out=js(p,s,[select(s,2010000021)]);
 const witness=rust(encoded,2010000021,7,'ItemSpawning');
 assert.equal(out.status,'STRUCTURAL_CANDIDATE_ONLY');
 assert.equal(witness.rawOldJson,'"\\u0032126-08-20T00:00:00Z"');
 assert.equal(witness.oldUtc,OLD);
 assert.equal(witness.nativeSemanticsVerified,false);
 assert.equal(witness.referenceClosureComplete,false);
 assert.equal(witness.encodeCopyAuthorized,false);
});

testWand('Moonstone/TimeBending proof is structural-only; TIME source policy denies protected Event IDs',()=>{
 for(const id of [2010000064,2010000093,2010000120]) {
  const p=make(id,'ItemSpawning'),s=snapshot(p);
  const out=js(p,s,[select(s,id)]);
  const witness=rust(raw(p),id,7,'ItemSpawning');
  assert.equal(witness.status,'RUST_STRUCTURAL_WITNESS_ONLY');
  assert.equal(witness.registryEventSemanticsVerified,false);
  assert.equal(out.status,'DENIED');
  assert.deepEqual(out.operations,[]);
 }
 const p=make(2011300000,'SnippetSpawning'),s=snapshot(p);
 const out=js(p,s,[select(s,2011300000)]);
 assert.equal(out.status,'DENIED');
 assert.equal(rust(raw(p),2011300000,7,'SnippetSpawning').reason,'RESEARCH_UNKNOWN_W1_VARIANT');
});

testWand('wrong EventID, saved Index, oneof, duplicate oneof and old-time CAS fail in Rust, not merely JS',()=>{
 const original=make(2010000021,'ItemSpawning'),s=snapshot(original),plan=select(s,2010000021);
 const wrongId=clone(original);
 wrongId.World.RecurringEvents[7].ItemSpawning.RecurringEventItemID=2010500008;
 assert.equal(js(wrongId,s,[plan]).status,'DENIED');
 assert.equal(rust(raw(wrongId),2010000021,7,'ItemSpawning').reason,'W1_SAVED_EVENT_ID_CAS_FAILED');
 assert.equal(rust(raw(original),2010000021,8,'ItemSpawning').reason,'W1_POINTER_MISSING');
 assert.equal(rust(raw(original),2010000021,7,'FlowerSpawningInVillage').reason,'W1_POINTER_MISSING');
 const twice=clone(original);
 twice.World.RecurringEvents[7].FlowerSpawningInVillage={RecurringEventItemID:2010500008,NextOccurrence:OLD};
 assert.equal(js(twice,s,[plan]).status,'DENIED');
 assert.equal(rust(raw(twice),2010000021,7,'ItemSpawning').reason,'W1_NOT_SINGLE_SAVED_ONEOF');
 const changed=clone(original);
 changed.World.RecurringEvents[7].ItemSpawning.NextOccurrence='2025-01-01T00:00:00Z';
 assert.equal(js(changed,s,[plan]).status,'DENIED');
 assert.equal(rust(raw(changed),2010000021,7,'ItemSpawning').reason,'W1_DECODED_TIMESTAMP_CAS_FAILED');
});

testWand('Wand witness denies tampered P1G SHA, registry digest, external BID or no-op; JS retains independent meaning checks',()=>{
 const p=make(2010000021,'ItemSpawning'),s=snapshot(p);
 assert.equal(js(p,s,[select(s,2010000021)]).status,'STRUCTURAL_CANDIDATE_ONLY');
 assert.equal(rust(raw(p),2010000021,7,'ItemSpawning',OLD,NEW,'wrong-encrypted-sha').reason,'W1_ENCRYPTED_SOURCE_SHA_MISMATCH');
 assert.equal(rust(raw(p),2010000021,7,'ItemSpawning',OLD,NEW,'wrong-registry-sha').reason,'W1_REGISTRY_SHA_MISMATCH');
 assert.equal(rust(raw(p),2010000021,7,'ItemSpawning',OLD,NEW,'wrong-build').reason,'W1_EXPLICIT_BUILD_MISMATCH');
 assert.equal(rust(raw(p),2010000021,7,'ItemSpawning',OLD,OLD).reason,'W1_UTC_CAS_INVALID');
});

testWand('separate Inventory/Grid/Quest data do not become W1 permissions or complete cross-domain reference proof',()=>{
 const p=make(2010000021,'ItemSpawning'),s=snapshot(p);
 const before=raw(p);
 const out=js(p,s,[select(s,2010000021)]);
 const witnessed=rust(before,2010000021,7,'ItemSpawning');
 assert.equal(raw(p),before);
 assert.equal(out.operations.length,1);
 assert.equal(out.operations[0].jsonPointer,witnessed.pointer);
 assert.equal(out.operations[0].allowedMutation,'REPLACE_EXISTING_TIMESTAMP_TOKEN_ONLY');
 assert.equal(out.gridDeletionAllowed,false);
 assert.equal(witnessed.referenceClosureComplete,false);
 assert.equal(witnessed.encodeCopyAuthorized,false);
 assert.equal(p.World.GridObjects[5][0].State.Opaque.keep,true);
 assert.equal(p.Player.ListInventories[0][0].Quantity,1);
 assert.equal(p.World.QuestState.X.Active,false);
});


testWand('legacy pointer-only JS plan does NOT bind intended EventID: Rust trusted identity must deny swapped selector',()=>{
 const p=make(2010000021,'ItemSpawning');
 p.World.RecurringEvents[8]={FlowerSpawningInVillage:{
   RecurringEventItemID:2010500008,NextOccurrence:OLD
 }};
 const s=snapshot(p);
 const wanted=select(s,2010000021);
 const wrong=select(s,2010500008);
 assert.notEqual(wanted.pointer,wrong.pointer);
 // The existing low-level planner only sees an independently valid pointer,
 // and cannot know that a caller INTENDED the other EventID.
 const pointerOnly=js(p,s,[wrong]);
 assert.equal(pointerOnly.status,'STRUCTURAL_CANDIDATE_ONLY');
 assert.equal(pointerOnly.operations[0].sourceEventId,2010500008);
 assert.equal(pointerOnly.operations[0].savedIndex,8);
 // The actual Rust research witness binds eventId+savedIndex+oneof explicitly.
 assert.equal(rust(raw(p),2010000021,8,'FlowerSpawningInVillage').reason,
   'W1_SAVED_EVENT_ID_CAS_FAILED');
 const correct=rust(raw(p),2010500008,8,'FlowerSpawningInVillage');
 assert.equal(correct.eventId,2010500008);
 assert.equal(correct.encodeCopyAuthorized,false);
 // Product command MUST carry independently trusted desired EventID in addition
 // to a pointer; the JS lower-level API never granted Writer permission.
 assert.equal(pointerOnly.writerAuthorized,false);
});
