import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
import {projectW1RustAdapterOracle} from '../src/w1-rust-adapter-oracle.mjs';
import {assessBoundW1IntentResearch} from '../src/w1-bound-intent-research.mjs';

const data=async p=>JSON.parse(await readFile(new URL('../data/'+p,import.meta.url),'utf8'));
const registry=await data('events-v1253.json');
const native=compileW1NativeSemantics(registry,{woodTagPack:await data('wand-iswood-crosswalk-v1253.json')});
const index=indexEvents(registry);
const rules=indexTimingReviewRules(await data('timing-review-rules-v1253.json'));
const OLD='2126-08-20T00:00:00Z';
const NEW='2022-09-06T00:00:00Z';
const CURRENT='2127-02-01T00:00:00Z';
const mainEvent=2010000021, flowerEvent=2010500008;
const source=()=>({
 sessionId:'core-owned-synthetic-session',revision:7,
 buildId:'9A239D3DB569756D',schema:626,
 encryptedP1gSha256:'a'.repeat(64),decodedJsonSha256:'b'.repeat(64),
 registrySha256:native.source.recurringSourceSHA256
});
const fixture=()=>({
 GameInfo:{Version:626},
 Player:{Inventory:{'A':[1,2,3]}},
 World:{
  RecurringEvents:{
   '155':{ItemSpawning:{RecurringEventItemID:mainEvent,NextOccurrence:OLD,
     LastOccurrence:'2025-01-01T00:00:00Z',EndDate:null}},
   '156':{FlowerSpawningInVillage:{RecurringEventItemID:flowerEvent,
     NextOccurrence:OLD,EndDate:null}}
  },
  GridObjects:{'7':{Objects:[{ItemID:31700014,State:{Unknown:{opaque:'keep'}}}]}},
  QuestState:{'41':{CurrentStage:'unchanged'}}
 },
 Unknown:{nested:{preserve:true}}
});
const review=p=>assessTimingSnapshot(projectProfile(p,index,{now:Date.parse('2026-11-03T00:00:00Z')}),rules);
const selection=(snapshot,eventId,target=NEW)=>{
 const row=snapshot.rows.find(x=>x.id===eventId);
 assert(row);
 return {pointer:row.pointer,originalTime:row.time,targetTime:target};
};
const projection=(p,plan)=>projectW1RustAdapterOracle({
 profile:p,snapshot:review(p),plan,registry,ledger:native
});
const request=(eventId=mainEvent,indexNo=155,oneof='ItemSpawning',target=NEW)=>({
 eventId,savedIndex:indexNo,oneof,
 pointer:'/World/RecurringEvents/'+indexNo+'/'+oneof+'/NextOccurrence',
 oldUtc:OLD,newUtc:target,
 rawOldJson:JSON.stringify(OLD),
 sessionId:'core-owned-synthetic-session',revision:7,
 encryptedP1gSha256:'a'.repeat(64),decodedJsonSha256:'b'.repeat(64),
 registrySha256:native.source.recurringSourceSHA256,
 buildId:'9A239D3DB569756D',schema:626
});
const tokens=()=>[
 {eventId:mainEvent,savedIndex:155,oneof:'ItemSpawning',pointer:request().pointer,
  rawOldJson:JSON.stringify(OLD),decodedOldUtc:OLD},
 {eventId:flowerEvent,savedIndex:156,oneof:'FlowerSpawningInVillage',
  pointer:request(flowerEvent,156,'FlowerSpawningInVillage').pointer,
  rawOldJson:JSON.stringify(OLD),decodedOldUtc:OLD}
];
const current=()=>({authenticatedByCore:true,source:source(),tokens:tokens()});
const assess=(p,intents,plan)=>assessBoundW1IntentResearch({
 projection:projection(p,plan),coreWitness:current(),intents
});
const deny=(result,reason)=>{assert.equal(result.status,'RESEARCH_DENIED');assert.equal(result.reason,reason);assert.deepEqual(result.operations,[]);assert.equal(result.capabilityGranted,false)};

test('real-save-derived ItemSpawning ID2010000021/index155 is still synthetic here: exact all-field intent binding, no write',()=>{
 const p=fixture(),before=JSON.stringify(p),r=request();
 const output=assess(p,[r],[selection(review(p),mainEvent)]);
 assert.equal(output.status,'RESEARCH_BOUND_CANDIDATES_ONLY');
 assert.deepEqual(output.operations.map(x=>[x.eventId,x.savedIndex,x.oneof,x.pointer,x.oldUtc,x.newUtc]),
 [[mainEvent,155,'ItemSpawning',r.pointer,OLD,NEW]]);
 assert.equal(output.operations[0].requiredCapability,'ENCODE_COPY');
 assert.equal(output.operations[0].capabilityGranted,false);
 assert.equal(output.writerAuthorized,false);
 assert.equal(output.productSemanticCommandAuthorized,false);
 assert.equal(output.operationReferencesComplete,false);
 assert.equal(JSON.stringify(p),before);
 assert.equal(p.World.RecurringEvents[155].ItemSpawning.LastOccurrence,'2025-01-01T00:00:00Z');
 assert.equal(p.World.GridObjects[7].Objects[0].State.Unknown.opaque,'keep');
});

test('pointer-only JS selection can switch to other valid W1 row, explicit EventID CAS then denies',()=>{
 const p=fixture();
 const plan=[selection(review(p),flowerEvent)];
 assert.equal(projection(p,plan).status,'STRUCTURAL_CANDIDATE_ONLY');
 // The caller intended ItemSpawning but maliciously supplied the valid Flower pointer.
 const wrong={...request(mainEvent,156,'FlowerSpawningInVillage')};
 deny(assess(p,[wrong],plan),'INTENDED_EVENT_IDENTITY_CAS_FAILED');
 const right=request(flowerEvent,156,'FlowerSpawningInVillage');
 assert.equal(assess(p,[right],plan).status,'RESEARCH_BOUND_CANDIDATES_ONLY');
 deny(assess(p,[{...request(),pointer:plan[0].pointer}],
     [selection(review(p),mainEvent)]),'INTENDED_IDENTITY_POINTER_MISMATCH');
});

test('source/session/revision cross-domain transaction preconditions are indivisible',()=>{
 const p=fixture(),plan=[selection(review(p),mainEvent)];
 for(const changed of [
  {revision:8},{sessionId:'different'},{encryptedP1gSha256:'f'.repeat(64)},
  {decodedJsonSha256:'f'.repeat(64)},{registrySha256:'f'.repeat(64)},
  {buildId:'WRONG'},{schema:627}
 ]){
  deny(assess(p,[{...request(),...changed}],plan),'STAGED_SOURCE_OR_REVISION_CAS_FAILED');
 }
 let projectionCurrent=projection(p,plan),w=current();
 w.source.revision=8;
 deny(assessBoundW1IntentResearch({projection:projectionCurrent,coreWitness:w,intents:[request()]}),
 'STAGED_SOURCE_OR_REVISION_CAS_FAILED');
 w=current();w.authenticatedByCore=false;
 deny(assessBoundW1IntentResearch({projection:projectionCurrent,coreWitness:w,intents:[request()]}),
 'CORE_SOURCE_PROVENANCE_NOT_CONFIRMED');
});

test('raw lexical source witness is a separate CAS from decoded 2126 UTC',()=>{
 const p=fixture(),pr=projection(p,[selection(review(p),mainEvent)]),w=current();
 w.tokens[0].rawOldJson='"\\u0032126-08-20T00:00:00Z"';
 assert.equal(JSON.parse(w.tokens[0].rawOldJson),OLD);
 let correct={...request(),rawOldJson:w.tokens[0].rawOldJson};
 const ok=assessBoundW1IntentResearch({projection:pr,coreWitness:w,intents:[correct]});
 assert.equal(ok.status,'RESEARCH_BOUND_CANDIDATES_ONLY');
 deny(assessBoundW1IntentResearch({projection:pr,coreWitness:w,intents:[request()]}),
 'OLD_OR_NEW_TIMESTAMP_CAS_FAILED');
 w.tokens[0].rawOldJson='"2024-01-01T00:00:00Z"';
 deny(assessBoundW1IntentResearch({projection:pr,coreWitness:w,intents:[{...correct,rawOldJson:w.tokens[0].rawOldJson}]}),
 'RAW_JSON_VS_UTC_CAS_FAILED');
});

test('two independent W1 choices share revision, but reused intended EventID and stale pointer abort entire batch',()=>{
 const p=fixture(),s=review(p);
 const plans=[selection(s,mainEvent),selection(s,flowerEvent)];
 let ok=assess(p,[request(),request(flowerEvent,156,'FlowerSpawningInVillage')],plans);
 assert.equal(ok.operations.length,2);
 assert.equal(ok.capabilityGranted,false);
 deny(assess(p,[request(),request()],plans),'DUPLICATE_INTENDED_EVENT_ID');
 deny(assess(p,[request(),{...request(flowerEvent,156,'FlowerSpawningInVillage'),revision:6}],plans),
 'STAGED_SOURCE_OR_REVISION_CAS_FAILED');
 assert.deepEqual(p.Player.Inventory.A,[1,2,3]);
 assert.equal(p.World.QuestState[41].CurrentStage,'unchanged');
});

test('future 2127 and past 2022 choices structurally valid; no-op and blocked family never advance',()=>{
 const p=fixture();
 for(const time of [NEW,CURRENT]){
  const s=review(p);
  assert.equal(assess(p,[request(mainEvent,155,'ItemSpawning',time)],[selection(s,mainEvent,time)]).status,
   'RESEARCH_BOUND_CANDIDATES_ONLY');
 }
 const noOp=projection(p,[selection(review(p),mainEvent,OLD)]);
 assert.notEqual(noOp.status,'STRUCTURAL_CANDIDATE_ONLY');
 deny(assessBoundW1IntentResearch({projection:noOp,coreWitness:current(),intents:[request(mainEvent,155,'ItemSpawning',OLD)]}),'W1_ORACLE_DENIED');
 const protectedSave=fixture();
 protectedSave.World.RecurringEvents[157]={ItemSpawning:{RecurringEventItemID:2010000064,NextOccurrence:OLD}};
 const s=review(protectedSave);
 deny(assess(protectedSave,[request(mainEvent,155,'ItemSpawning'),request(2010000064,157,'ItemSpawning')],
 [selection(s,mainEvent),selection(s,2010000064)]),'W1_ORACLE_DENIED');
});

test('bad Core raw token, duplicate source pointers, and unrecognized registry fail closed',()=>{
 const p=fixture(),pr=projection(p,[selection(review(p),mainEvent)]);
 const a=current();a.tokens[0].rawOldJson='{broken';
 const invalid={...request(),rawOldJson:'{broken'};
 deny(assessBoundW1IntentResearch({projection:pr,coreWitness:a,intents:[invalid]}),
 'INVALID_RAW_JSON_TOKEN');
 const b=current();b.tokens.push({...b.tokens[0]});
 deny(assessBoundW1IntentResearch({projection:pr,coreWitness:b,intents:[request()]}),
 'AMBIGUOUS_CORE_TOKEN_WITNESS');
 const c=current();c.source.registrySha256='f'.repeat(64);
 deny(assessBoundW1IntentResearch({projection:pr,coreWitness:c,intents:[request()]}),
 'REGISTRY_OR_BUILD_DIFFERENT');
});
