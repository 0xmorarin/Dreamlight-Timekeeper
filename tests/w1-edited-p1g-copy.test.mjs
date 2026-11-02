import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {indexEvents} from '../src/reader.mjs';
import {diffPaths,parseSafeJson} from '../src/core/safe-edit-session.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {createW1EditedP1gCopy} from '../src/core/w1-edited-p1g-copy.mjs';
import {BuildIdentityKind,PlatformFamily,CURRENT_V125_BUILD_CONTRACTS,
 matchSupportedBuild,evaluateWriterAuthorization,RuntimeGateStatus} from '../src/core/versioning.mjs';

const registry=indexEvents(JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8')));
const BID={platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'9A239D3DB569756D'};
const OLD='2126-08-20T00:00:00Z',TARGET='2026-11-02T01:00:00.000Z';
const allowed=[
 {eventId:2010000021,kind:'ItemSpawning'},
 {eventId:2010500008,kind:'FlowerSpawningInVillage'},
 {eventId:2010400001,kind:'WildCropsSpawningInVillage'}
];
const root=(schema=626)=>({
 GameInfo:{Version:schema,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{Name:'Synthetic'},World:{RecurringEvents:{
  '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:OLD,LastOccurrence:'2024-01-01T00:00:00Z'}},
  '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:OLD}},
  '2':{WildCropsSpawningInVillage:{RecurringEventItemID:2010400001,NextOccurrence:OLD}}
 },Other:{untouched:['Ñ',false,null,{numericText:'9007199254740993'}]}}});
const path=(i,k)=>'/World/RecurringEvents/'+i+'/'+k+'/NextOccurrence';
const edits=()=>[
 {pointer:path(0,'ItemSpawning'),eventId:2010000021,kind:'ItemSpawning',originalTime:OLD,targetTime:TARGET},
 {pointer:path(1,'FlowerSpawningInVillage'),eventId:2010500008,kind:'FlowerSpawningInVillage',originalTime:OLD,targetTime:'2127-08-20T00:00:00Z'}
];
const sha=b=>createHash('sha256').update(b).digest('hex');
const timeReview=plan=>({
 status:'STRUCTURAL_W1_TARGETS_ONLY',contractVersion:'minimal-w1-target-v1',
 targetScopeVerified:true,writerAuthorized:false,editedExportAuthorized:false,
 source:{buildId:'9A239D3DB569756D',saveSchema:626,definitionCount:508,
  rawEventSHA256:'028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea'},
 candidateTargets:plan.map(e=>({
  pointer:e.pointer,eventId:e.eventId,variant:e.kind,
  savedIndex:Number(e.pointer.split('/')[3]),originalTime:e.originalTime,
  targetTime:e.targetTime,writerAuthorized:false
 }))
});
// Synthetic stand-in for 02 TIME's production assessMinimalW1WriteTargets()
// until 00 CTRL integrates PR7. The product Worker MUST invoke actual 02 TIME.
function ctx({profile=root(),plan=edits(),review=timeReview(plan),build=BID,sessionId=12}={}){
 const sourceBytes=makeSyntheticP1gProfile(profile);
 return {sourceBytes,sourceSessionId:sessionId,activeSessionId:sessionId,
  getActiveSessionId:()=>sessionId,
  expectedSourceSha256:sha(sourceBytes),targetBuild:build,eventRegistry:registry,
  w1TargetReview:review,entries:plan};
}
test('exact Switch v1.25.3 BID/schema626 authorizes copy only',()=>{
 const contract=CURRENT_V125_BUILD_CONTRACTS.find(x=>x.profileGameInfoVersion===626);
 assert.equal(contract?.buildIdentity.value,BID.value);
 assert.equal(contract?.persistentWriteAuthorized,false);
 assert.equal(matchSupportedBuild({profileGameInfoVersion:626},BID).status,'EXACT');
 assert.equal(matchSupportedBuild({profileGameInfoVersion:647},BID).status,'SCHEMA_MISMATCH');
 const auth=evaluateWriterAuthorization({
  saveIdentity:{profileGameInfoVersion:626},targetBuild:BID,
  codec:{readSupported:true,encodeSupported:true,roundTripVerified:true,contract:'p1g-v0'},
  operation:{structuralCapabilitiesSupported:true,planSupported:true,validationPassed:true,runtimeGate:RuntimeGateStatus.NotRequired},
  persistence:{backupReady:true,atomicReplaceReady:true,postCommitVerifyReady:true}
 });
 assert.equal(auth.capabilities.encodeCopy,true);
 assert.equal(auth.capabilities.persistentReplace,false);
});
test('synthetic schema626 P1G really encodes modified copy, reopens and changes only selected pointers',async()=>{
 const initial=root(),args=ctx({profile:initial}),original=Buffer.from(args.sourceBytes);
 const result=await createW1EditedP1gCopy(args);
 assert.equal(result.status,'WORKER_VERIFIED_EDITED_P1G_COPY');
 assert.equal(result.encodeCopyAuthorized,true);
 assert.equal(result.persistentReplaceAuthorized,false);
 assert.equal(result.originalOverwritePerformed,false);
 assert.equal(result.userDownloadPerformed,false);
 assert.notDeepEqual(Buffer.from(result.editedBytes),original);
 assert.deepEqual(Buffer.from(result.backupOriginalBytes),original);
 assert.deepEqual(Buffer.from(args.sourceBytes),original);
 assert.equal(sha(result.editedBytes),result.editedRawSha256);
 assert.equal(result.sourceRawSha256,sha(original));
 assert.deepEqual(result.changedPaths.slice().sort(),edits().map(x=>x.pointer).sort());
 const reopened=await p1gPackagedProfileCodec.loadProfile(result.editedBytes);
 const changed=parseSafeJson(reopened.jsonText);
 assert.deepEqual(diffPaths(initial,changed).sort(),edits().map(x=>x.pointer).sort());
 assert.equal(changed.World.RecurringEvents['0'].ItemSpawning.NextOccurrence,TARGET);
 assert.equal(changed.World.RecurringEvents['1'].FlowerSpawningInVillage.NextOccurrence,'2127-08-20T00:00:00Z');
 assert.equal(changed.World.RecurringEvents['2'].WildCropsSpawningInVillage.NextOccurrence,OLD);
 assert.deepEqual(changed.World.Other,initial.World.Other);
 assert.equal(changed.GameInfo.Version,626);
});
test('stale session, wrong hash/BID, plan replay, wrong kind, no-op and old-value CAS rejected',async()=>{
 const initial=ctx();
 const bad=[
  {...initial,activeSessionId:13},
  {...initial,expectedSourceSha256:'a'.repeat(64)},
  {...initial,targetBuild:{...BID,value:'UNKNOWN'}},
  {...initial,targetBuild:{...BID,kind:'steam-full-version'}},
  {...initial,w1TargetReview:null},
  {...initial,entries:[{...edits()[0],targetTime:OLD}]},
  {...initial,entries:[{...edits()[0],originalTime:'2025-01-01T00:00:00Z'}]},
  {...initial,entries:[edits()[0],edits()[0]]},
  {...initial,entries:[]},
  {...initial,entries:[{...edits()[0],eventId:2010500008}]},
  {...initial,entries:[{...edits()[0],kind:'FishSpawningInVillage'}]},
  {...initial,entries:[{...edits()[0],pointer:path(1,'ItemSpawning')}]},
  {...initial,entries:[{...edits()[0],pointer:'/World/RecurringEvents/0/ItemSpawning/LastOccurrence'}]},
  {...initial,entries:[{...edits()[0],targetTime:'2026-02-30T00:00:00Z'}]}
 ];
 for(let i=0;i<bad.length;i++)await assert.rejects(createW1EditedP1gCopy(bad[i]),undefined,'case '+i);
});
test('unknown schema, inactive fish, Moonstone, ambiguous oneof and parallel unrecognized variant refused',async()=>{
 await assert.rejects(createW1EditedP1gCopy(ctx({profile:root(647)})),/SCHEMA/);
 const fish=root();fish.World.RecurringEvents['3']={
  FishSpawningInVillage:{RecurringEventItemID:2010200014,NextOccurrence:OLD}};
 const fishPlan=[{pointer:path(3,'FishSpawningInVillage'),eventId:2010200014,kind:'FishSpawningInVillage',originalTime:OLD,targetTime:TARGET}];
 await assert.rejects(createW1EditedP1gCopy(ctx({profile:fish,plan:fishPlan})),/NOT_ACTIVE/);
 const moon=root();moon.World.RecurringEvents['3']={ItemSpawning:{RecurringEventItemID:2010000064,NextOccurrence:OLD}};
 await assert.rejects(createW1EditedP1gCopy(ctx({profile:moon,plan:[{pointer:path(3,'ItemSpawning'),eventId:2010000064,kind:'ItemSpawning',originalTime:OLD,targetTime:TARGET}]})),/NOT_ACTIVE/);
 const ambiguous=root();ambiguous.World.RecurringEvents['0'].FlowerSpawningInVillage={
  RecurringEventItemID:2010500008,NextOccurrence:OLD};
 await assert.rejects(createW1EditedP1gCopy(ctx({profile:ambiguous,plan:[edits()[0]]})),/MISMATCH|PREFLIGHT/);
 const unknown=root();unknown.World.RecurringEvents['0'].OpaqueFutureVariant={NextOccurrence:OLD};
 await assert.rejects(createW1EditedP1gCopy(ctx({profile:unknown,plan:[edits()[0]]})),/PREFLIGHT/);
});

test('live Worker session getter rejects an old session after awaited Encode, without returning edited bytes',async()=>{
 const context=ctx({plan:[edits()[0]]});
 let checkCount=0;
 context.getActiveSessionId=()=>++checkCount<3?context.sourceSessionId:context.sourceSessionId+1;
 const original=Buffer.from(context.sourceBytes);
 await assert.rejects(createW1EditedP1gCopy(context),/W1_STALE_SESSION_AFTER_ENCODE/);
 assert.equal(checkCount>=3,true);
 assert.deepEqual(Buffer.from(context.sourceBytes),original);
});
