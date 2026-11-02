// 05 QR / TIME37: independent new Rust-vs-JS structural provenance negatives.
// Real Wand Rust binary is compiled from fixed PR312 and is *not* a Native game consumer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
import {projectW1RustAdapterOracle} from '../src/w1-rust-adapter-oracle.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';
const BIN=process.env.WAND_W1_RESEARCH_BINARY;
assert(BIN,'WAND_W1_RESEARCH_BINARY must be compiled from exact frozen Wand PR312');
const registry=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url)));
const wood=JSON.parse(await readFile(new URL('../data/wand-iswood-crosswalk-v1253.json',import.meta.url)));
const rules=indexTimingReviewRules(JSON.parse(await readFile(new URL('../data/timing-review-rules-v1253.json',import.meta.url))));
const led=compileW1NativeSemantics(registry,{woodTagPack:wood});
const ix=indexEvents(registry);
const old='2126-08-20T00:00:00Z',next='2022-09-06T00:00:00Z';
const profile=(kind='ItemSpawning',eventId=2010000021)=>({
 GameInfo:{Version:626},Player:{Name:'Synthetic',ListInventories:{'0':[{'ItemID':2,Quantity:1}]}},World:{RecurringEvents:{'4':{[kind]:{RecurringEventItemID:eventId,NextOccurrence:old}}}},Unknown:{opaque:{utf8:'é',number:1.00}}
});
const run=(p,id,kind,extra='normal',raw)=>{const r=spawnSync(BIN,[String(id),'4',kind,old,next,extra],{
 input:raw??JSON.stringify(p),encoding:'utf8',maxBuffer:300000,timeout:5000});
 assert.equal(r.status,0,String(r.stderr).slice(-400));
 assert.equal(r.stderr.trim(),'');
 return JSON.parse(r.stdout);
};
const js=(p,eventId)=>{
 const s=assessTimingSnapshot(projectProfile(p,ix,{now:Date.parse('2026-11-03T00:00:00Z')}),rules);
 const row=s.rows.find(x=>x.id===eventId);
 assert(row);
 return projectW1RustAdapterOracle({profile:p,snapshot:s,plan:[{
  pointer:row.pointer,originalTime:row.time,targetTime:next
 }],registry,ledger:led});
};
test('05QR native claims cannot derive from Rust synthetic witness or externally asserted BID alone',()=>{
 const p=profile(),w=run(p,2010000021,'ItemSpawning'),j=js(p,2010000021);
 assert.equal(w.status,'RUST_STRUCTURAL_WITNESS_ONLY');
 assert.equal(w.externalBuildId,'9A239D3DB569756D');
 assert.equal(w.buildBoundToSave,false);
 assert.equal(w.externalBuildSelectionOnly,true);
 assert.equal(w.registryEventSemanticsVerified,false);
 assert.equal(w.nativeSemanticsVerified,false);
 assert.equal(w.referenceClosureComplete,false);
 assert.equal(w.encodeCopyAuthorized,false);
 assert.equal(j.capabilityGranted,false);
 assert.equal(j.operations.length,1);
 assert.equal(j.operations[0].jsonPointer,w.pointer);
});
test('05QR RAW-token vs decoded UTC proof, with nested opaque source still unmodified',()=>{
 const p=profile();
 const raw=JSON.stringify(p).replace('"2126-08-20T00:00:00Z"','"\\u0032126-08-20T00:00:00Z"');
 const before=raw;
 const w=run(p,2010000021,'ItemSpawning','normal',raw);
 assert.equal(w.rawOldJson,'"\\u0032126-08-20T00:00:00Z"');
 assert.equal(w.oldUtc,old);
 assert.equal(w.pointer,'/World/RecurringEvents/4/ItemSpawning/NextOccurrence');
 assert.equal(raw,before);
 assert.equal(w.encodeCopyAuthorized,false);
});
test('05QR explicit EventID mismatches do not use alternate valid saved event as target',()=>{
 const p=profile('ItemSpawning',2010000021);
 p.World.RecurringEvents[5]={FlowerSpawningInVillage:{
  RecurringEventItemID:2010500008,NextOccurrence:old}};
 assert.equal(run(p,2010500008,'ItemSpawning').reason,'W1_SAVED_EVENT_ID_CAS_FAILED');
 assert.equal(run(p,2010000021,'FlowerSpawningInVillage').reason,'W1_POINTER_MISSING');
 assert.equal(run(p,2010000021,'ItemSpawning','wrong-build').reason,'W1_EXPLICIT_BUILD_MISMATCH');
 assert.equal(run(p,2010000021,'ItemSpawning','wrong-registry-sha').reason,'W1_REGISTRY_SHA_MISMATCH');
});
test('05QR denied W1 policy cannot be promoted by well-formed Rust structure',()=>{
 for(const id of [2010000064,2010000093,2010000120]){
  const p=profile('ItemSpawning',id);
  const w=run(p,id,'ItemSpawning');
  const j=js(p,id);
  assert.equal(w.status,'RUST_STRUCTURAL_WITNESS_ONLY');
  assert.equal(w.encodeCopyAuthorized,false);
  assert.equal(j.status,'DENIED');
  assert.deepEqual(j.operations,[]);
 }
});
