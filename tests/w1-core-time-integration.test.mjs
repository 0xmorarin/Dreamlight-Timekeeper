// 00 CTRL cross-stream contract test; synthetic P1G only, no user save or downloads.
// Exercises the actual 02 TIME structural assessor + 01 CORE bounded edited-copy writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
import {assessMinimalW1WriteTargets} from '../src/w1-minimal-write-contract.mjs';
import {createW1EditedP1gCopy} from '../src/core/w1-edited-p1g-copy.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
import {BuildIdentityKind,PlatformFamily} from '../src/core/versioning.mjs';

const fixture=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const definitions=await fixture('events-v1253.json');
const registry=indexEvents(definitions);
const ledger=compileW1NativeSemantics(definitions,{woodTagPack:await fixture('wand-iswood-crosswalk-v1253.json')});
const rules=indexTimingReviewRules(await fixture('timing-review-rules-v1253.json'));
const OLD='2126-08-20T00:00:00Z',NEW='2127-08-20T00:00:00Z';
const BID={platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'9A239D3DB569756D'};
const root=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{Name:'Synthetic'},World:{RecurringEvents:{
  '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:OLD,Other:{a:1}}},
  '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:OLD}},
  '2':{ItemSpawning:{RecurringEventItemID:2010000064,NextOccurrence:OLD}}
 },Other:{unknown:[true,null,{value:'unchanged'}]}}
});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function prepare(original,ids=[2010000021,2010500008]){
 const snapshot=assessTimingSnapshot(projectProfile(original,registry,{now:Date.parse('2026-11-02T01:00:00Z')}),rules);
 const plan=ids.map(id=>{
  const row=snapshot.rows.find(x=>x.id===id);assert(row,'missing synthetic event '+id);
  return {pointer:row.pointer,originalTime:row.time,targetTime:NEW};
 });
 const review=assessMinimalW1WriteTargets(original,snapshot,plan,definitions,ledger);
 const entries=review.candidateTargets.map(row=>({
  pointer:row.pointer,eventId:row.eventId,kind:row.variant,
  originalTime:row.originalTime,targetTime:row.targetTime
 }));
 const bytes=makeSyntheticP1gProfile(original);
 return {review,entries,bytes,args:{
  sourceBytes:bytes,sourceSessionId:17,activeSessionId:17,
  getActiveSessionId:()=>17,expectedSourceSha256:sha(bytes),targetBuild:BID,
  eventRegistry:registry,w1TargetReview:review,entries
 }};
}
test('actual TIME assessor feeds CORE copy writer: only selected W1 dates change',async()=>{
 const original=root(),before=structuredClone(original),c=prepare(original);
 assert.equal(c.review.status,'STRUCTURAL_W1_TARGETS_ONLY');
 assert.equal(c.review.writerAuthorized,false);
 assert.deepEqual(c.entries.map(x=>x.kind),['ItemSpawning','FlowerSpawningInVillage']);
 const beforeBytes=Buffer.from(c.bytes);
 const result=await createW1EditedP1gCopy(c.args);
 assert.equal(result.status,'WORKER_VERIFIED_EDITED_P1G_COPY');
 assert.equal(result.persistentReplaceAuthorized,false);
 assert.equal(result.originalOverwritePerformed,false);
 assert.equal(result.deviceLoadVerified,false);
 assert.deepEqual(Buffer.from(result.backupOriginalBytes),beforeBytes);
 assert.deepEqual(Buffer.from(c.bytes),beforeBytes);
 const reopened=parseSafeJson((await p1gPackagedProfileCodec.loadProfile(result.editedBytes)).jsonText);
 const expected=c.entries.map(x=>x.pointer).sort();
 assert.deepEqual(diffPaths(before,reopened).sort(),expected);
 assert.deepEqual(result.changedPaths.slice().sort(),expected);
 assert.equal(reopened.World.RecurringEvents['0'].ItemSpawning.NextOccurrence,NEW);
 assert.equal(reopened.World.RecurringEvents['1'].FlowerSpawningInVillage.NextOccurrence,NEW);
 assert.equal(reopened.World.RecurringEvents['2'].ItemSpawning.NextOccurrence,OLD);
 assert.deepEqual(reopened.World.Other,before.World.Other);
 assert.equal(sha(result.editedBytes),result.editedRawSha256);
});
test('TIME mixed protected batch cannot furnish a CORE writer capability',async()=>{
 const c=prepare(root(),[2010000021,2010000064]);
 assert.equal(c.review.status,'BLOCKED_W1_WRITE_TARGETS');
 assert.deepEqual(c.review.candidateTargets,[]);
 await assert.rejects(()=>createW1EditedP1gCopy({...c.args,entries:[
 {pointer:'/World/RecurringEvents/0/ItemSpawning/NextOccurrence',
  eventId:2010000021,kind:'ItemSpawning',originalTime:OLD,targetTime:NEW}
 ]}),/W1_TIME_STRUCTURAL_REVIEW_REQUIRED/);
});
