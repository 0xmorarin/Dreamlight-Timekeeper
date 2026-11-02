// Independent 05 QR changed-scope CORE plan-revision contract. Node synthetic only.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
import {assessMinimalW1WriteTargets} from '../src/w1-minimal-write-contract.mjs';
import {createW1EditedP1gCopy} from '../src/core/w1-edited-p1g-copy.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
const load=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const source=await load('events-v1253.json'),registry=indexEvents(source);
const ledger=compileW1NativeSemantics(source,{woodTagPack:await load('wand-iswood-crosswalk-v1253.json')});
const rules=indexTimingReviewRules(await load('timing-review-rules-v1253.json'));
const OLD='2126-08-20T00:00:00Z',NEXT='2027-01-15T04:05:06.000Z';
const SHA=b=>createHash('sha256').update(b).digest('hex');
const save=()=>({GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
Player:{Name:'Independent QA'},World:{RecurringEvents:{
 '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:OLD}},
 '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:OLD}},
 '2':{ItemSpawning:{RecurringEventItemID:2010000064,NextOccurrence:OLD}}
 },unknown:{keep:['🐚',null,false]}}});
function setup(){
 const root=save(),snapshot=assessTimingSnapshot(projectProfile(root,registry,{now:Date.parse('2026-11-02T01:00:00Z')}),rules);
 const row=snapshot.rows.find(x=>x.id===2010000021);
 const plan=[{pointer:row.pointer,originalTime:OLD,targetTime:NEXT}];
 const review=assessMinimalW1WriteTargets(root,snapshot,plan,source,ledger);
 assert.equal(review.status,'STRUCTURAL_W1_TARGETS_ONLY');
 const bytes=makeSyntheticP1gProfile(root),session=44;
 return {root,bytes,session,args:{
  sourceBytes:bytes,sourceSessionId:session,activeSessionId:session,getActiveSessionId:()=>session,
  expectedSourceSha256:SHA(bytes),targetBuild:{platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'},
  eventRegistry:registry,w1TargetReview:review,
  entries:review.candidateTargets.map(x=>({pointer:x.pointer,eventId:x.eventId,kind:x.variant,originalTime:x.originalTime,targetTime:x.targetTime}))
 }};
}
test('QR-REV1 explicit Worker-owned plan revision accepted only when unchanged, and returned exact revision is audit evidence',async()=>{
 const c=setup(),original=Buffer.from(c.bytes);
 let revision=7,count=0;
 const r=await createW1EditedP1gCopy({...c.args,expectedPlanRevision:7,
  getActivePlanRevision:()=>{count++;return revision;}});
 assert(count>=3,'checked before opening, after opening and after encoding');
 assert.equal(r.planRevision,7);
 assert.equal(r.persistentReplaceAuthorized,false);
 assert.deepEqual(Buffer.from(c.bytes),original);
 assert.deepEqual(Buffer.from(r.backupOriginalBytes),original);
 const reopened=parseSafeJson((await p1gPackagedProfileCodec.loadProfile(r.editedBytes)).jsonText);
 assert.deepEqual(diffPaths(c.root,reopened),[c.args.entries[0].pointer]);
});
test('QR-REV2 absent or malformed paired plan revision rejects before edited bytes returned',async()=>{
 const c=setup(),original=Buffer.from(c.bytes);
 for(const args of [
  {...c.args,expectedPlanRevision:9},
  {...c.args,getActivePlanRevision:()=>9},
  {...c.args,expectedPlanRevision:-1,getActivePlanRevision:()=>-1},
  {...c.args,expectedPlanRevision:0.5,getActivePlanRevision:()=>0.5},
  {...c.args,expectedPlanRevision:9,getActivePlanRevision:9}
 ])await assert.rejects(createW1EditedP1gCopy(args),/W1_PLAN_REVISION_CONTRACT_INVALID/);
 assert.deepEqual(Buffer.from(c.bytes),original);
});
test('QR-REV3 changed plan before open, after decode or after Encode/Reopen yields no returned receipt',async()=>{
 for(const [caseName,validChecks] of [['before',0],['afterOpen',1],['afterEncode',2]]){
  const c=setup(),original=Buffer.from(c.bytes);let checks=0;
  const args={...c.args,expectedPlanRevision:13,getActivePlanRevision:()=>{
   checks++;return checks<=validChecks?13:14;
  }};
  await assert.rejects(createW1EditedP1gCopy(args),/W1_PLAN_REVISION_STALE/,caseName);
  assert(checks>=validChecks+1);
  assert.deepEqual(Buffer.from(c.bytes),original,caseName);
 }
});
test('QR-REV4 product Worker owns source and TIME review, UI additionally invalidates plan and rejects old replies',async()=>{
 const worker=await readFile(new URL('../src/worker.mjs',import.meta.url),'utf8');
 const app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
 assert.match(worker,/if\(data\.type==='prepareEdited'\)/);
 assert.match(worker,/assessMinimalW1WriteTargets\(/);
 assert.match(worker,/activeSourceSha256/);
 assert.match(worker,/getActiveSessionId:\(\)=>ensureCurrent\(\)\?activeSessionId:-1/);
 assert.match(worker,/planRevision:data\.planRevision,receipt/);
 assert.doesNotMatch(worker,/getActivePlanRevision:/);
 assert.match(app,/planRevision!==outputPlanRevision/);
 assert.match(app,/response\.planRevision!==planRevision/);
 assert.match(app,/invalidateVerifiedOutput\(\)/);
 // A stale plan revision is currently enforced on the UI receiving boundary;
 // product Worker does not currently use CORE's optional revision callback.
 // The preceding CORE tests check the optional callback in isolation only.
});
