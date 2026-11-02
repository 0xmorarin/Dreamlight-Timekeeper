// 05 QR: independent synthetic P1G integration, exact PR #11 fixed product SHA pinned in CI.
// NO private saves, no UI export, no disk replacement, no Switch runtime assertion.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
import {assessMinimalW1WriteTargets} from '../src/w1-minimal-write-contract.mjs';
import {createW1EditedP1gCopy} from '../src/core/w1-edited-p1g-copy.mjs';
import {p1gPackagedProfileCodec as codec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
import {CURRENT_V125_BUILD_CONTRACTS,PlatformFamily,BuildIdentityKind,matchSupportedBuild} from '../src/core/versioning.mjs';

const readJson=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url),'utf8'));
const definitions=await readJson('events-v1253.json'),registry=indexEvents(definitions);
const ledger=compileW1NativeSemantics(definitions,{woodTagPack:await readJson('wand-iswood-crosswalk-v1253.json')});
const rules=indexTimingReviewRules(await readJson('timing-review-rules-v1253.json'));
const SHA=bytes=>createHash('sha256').update(bytes).digest('hex');
const key=Buffer.from('62357168683873614a38556c444a557a545a5864325467366d626f3857386e35','hex');
const OLD='2126-08-20T00:00:00Z';
const BID={platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'9A239D3DB569756D'};
const events=[
 [0,'ItemSpawning',2010000021],[1,'FlowerSpawningInVillage',2010500008],
 [2,'WildCropsSpawningInVillage',2010400001],[3,'ItemSpawning',2010000064],
 [4,'ItemSpawning',2010000093],[5,'SnippetSpawning',2011300000],
 [6,'FishSpawningInVillage',2010200014],[7,'ItemSpawning',999999999]
];
function profile(version=626){
 const recurring=Object.fromEntries(events.map(([i,variant,id])=>[String(i),{
   [variant]:{RecurringEventItemID:id,NextOccurrence:OLD,Opaque:{nullable:null,numbers:[1,2,3],idAsString:'9007199254740993'}}}]));
 return {GameInfo:{Version:version,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:'Independent Synthetic'},World:{RecurringEvents:recurring,
  OpaqueGrid:{survive:[{obj:true},null,'花'],ids:{'002':'text','1':'one'}}}};
}
function snapshot(p){return assessTimingSnapshot(projectProfile(p,registry,{now:Date.parse('2026-11-02T01:00:00Z')}),rules);}
function planFor(s,ids,targetTimes){
 return ids.map((id,i)=>{const row=s.rows.find(r=>r.id===id);assert(row,'row missing '+id);
  return {pointer:row.pointer,originalTime:row.time,targetTime:targetTimes?.[i]??'2127-02-03T04:05:06.000Z'};});
}
function makeContext(p=profile(),ids=[2010000021,2010500008],times,sessionId=31){
 const s=snapshot(p),plan=planFor(s,ids,times),review=assessMinimalW1WriteTargets(p,s,plan,definitions,ledger);
 const bytes=makeSyntheticP1gProfile(p),entries=review.candidateTargets.map(r=>({
  pointer:r.pointer,eventId:r.eventId,kind:r.variant,
  originalTime:r.originalTime,targetTime:r.targetTime}));
 const args={sourceBytes:bytes,sourceSessionId:sessionId,activeSessionId:sessionId,
   getActiveSessionId:()=>sessionId,expectedSourceSha256:SHA(bytes),targetBuild:BID,
   eventRegistry:registry,w1TargetReview:review,entries};
 return {p,s,plan,review,bytes,args};
}
function badEntry(c,id,target){
 const r=c.s.rows.find(x=>x.id===id);assert(r);
 return {pointer:r.pointer,eventId:r.id,kind:r.kind,originalTime:r.time,targetTime:target??'2127-02-03T04:05:06.000Z'};
}
function physicallyModify(encrypted,mutate){
 const decipher=createDecipheriv('aes-256-ecb',key,null),zip=Buffer.concat([decipher.update(encrypted),decipher.final()]);
 const modified=mutate(zip);
 const cipher=createCipheriv('aes-256-ecb',key,null);
 return new Uint8Array(Buffer.concat([cipher.update(modified),cipher.final()]));
}
const zipVariants={
 archiveComment(zip){
  const e=zip.length-22,extra=Buffer.from([0x71,0x72,0x73]);
  const out=Buffer.concat([zip,extra]);out.writeUInt16LE(extra.length,e+20);return out;
 },
 entryComment(zip){
  const e=zip.length-22,c=zip.readUInt32LE(e+16),comment=Buffer.from('QA!');
  const offset=c+46+zip.readUInt16LE(c+28)+zip.readUInt16LE(c+30);
  const out=Buffer.concat([zip.subarray(0,offset),comment,zip.subarray(offset)]);
  out.writeUInt16LE(comment.length,c+32);
  out.writeUInt32LE(zip.readUInt32LE(e+12)+comment.length,e+comment.length+12);
  return out;
 },
 localAndCentralExtra(zip){
  const e=zip.length-22,c=zip.readUInt32LE(e+16),sz=zip.readUInt32LE(e+12);
  const tag=Buffer.from([0xb1,0x71,0,0]); // physically present valid unknown ZIP extra
  const n=30+zip.readUInt16LE(26),a=Buffer.concat([zip.subarray(0,n),tag,zip.subarray(n)]);
  const nc=c+tag.length,cn=nc+46+a.readUInt16LE(nc+28);
  const b=Buffer.concat([a.subarray(0,cn),tag,a.subarray(cn)]);
  const ne=e+tag.length*2;b.writeUInt16LE(tag.length,28);b.writeUInt16LE(tag.length,nc+30);
  b.writeUInt32LE(nc,ne+16);b.writeUInt32LE(sz+tag.length,ne+12);return b;
 },
 physicalDescriptor(zip){
  const e=zip.length-22,c=zip.readUInt32LE(e+16),local=zip.readUInt32LE(c+42);
  const dataStart=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);
  const compressedSize=zip.readUInt32LE(c+20),offset=dataStart+compressedSize;
  const desc=Buffer.alloc(16);desc.writeUInt32LE(0x08074b50,0);
  desc.writeUInt32LE(zip.readUInt32LE(c+16),4);
  desc.writeUInt32LE(compressedSize,8);desc.writeUInt32LE(zip.readUInt32LE(c+24),12);
  const out=Buffer.concat([zip.subarray(0,offset),desc,zip.subarray(offset)]);
  out.writeUInt16LE(out.readUInt16LE(local+6)|8,local+6);
  out.writeUInt16LE(out.readUInt16LE(c+desc.length+8)|8,c+desc.length+8);
  out.writeUInt32LE(c+desc.length,e+desc.length+16);
  return out;
 }
};
test('W1-Q01 independent actual TIME assessor feeds CORE: three changes, unrelated and protected unchanged, one synthetic P1G reopen',async()=>{
 const c=makeContext(profile(),[2010000021,2010500008,2010400001],[
  '2127-01-05T00:00:00.000Z','2022-09-06T00:00:00.000Z','2128-03-01T12:30:00.000Z']);
 assert.equal(c.review.status,'STRUCTURAL_W1_TARGETS_ONLY');
 assert.equal(c.review.targetScopeVerified,true);
 assert.equal(c.review.writerAuthorized,false);
 const frozenRoot=structuredClone(c.p),originalBytes=Buffer.from(c.bytes);
 const result=await createW1EditedP1gCopy(c.args);
 assert.equal(result.status,'WORKER_VERIFIED_EDITED_P1G_COPY');
 assert.equal(result.encodeCopyAuthorized,true);assert.equal(result.persistentReplaceAuthorized,false);
 assert.equal(result.originalOverwritePerformed,false);
 assert.equal(result.browserRuntimeVerified,false);
 assert.equal(result.deviceLoadVerified,false);
 assert.equal(result.userDownloadPerformed,false);
 assert.equal(result.sourceRawSha256,SHA(originalBytes));
 assert.equal(result.editedRawSha256,SHA(result.editedBytes));
 assert.deepEqual(Buffer.from(result.backupOriginalBytes),originalBytes);
 assert.deepEqual(Buffer.from(c.bytes),originalBytes);
 assert.deepEqual(c.p,frozenRoot);
 assert.notDeepEqual(Buffer.from(result.editedBytes),originalBytes);
 const edited=parseSafeJson((await codec.loadProfile(result.editedBytes)).jsonText);
 const paths=c.args.entries.map(e=>e.pointer).sort();
 assert.deepEqual(diffPaths(frozenRoot,edited).sort(),paths);
 assert.deepEqual(result.changedPaths.slice().sort(),paths);
 for(let i=0;i<3;i++)assert.equal(edited.World.RecurringEvents[i][events[i][1]].NextOccurrence,c.args.entries[i].targetTime);
 for(const j of [3,4,5,6,7])assert.deepEqual(edited.World.RecurringEvents[j],frozenRoot.World.RecurringEvents[j]);
 assert.deepEqual(edited.World.OpaqueGrid,frozenRoot.World.OpaqueGrid);
 assert.deepEqual(edited.GameInfo,frozenRoot.GameInfo);
});
test('W1-Q02 exact BID/schema626 copy gate, different BID, platform, schema and source SHA reject without mutating encrypted original',async()=>{
 const c=makeContext();
 assert.equal(CURRENT_V125_BUILD_CONTRACTS.filter(x=>x.profileGameInfoVersion===626).length,1);
 assert.equal(matchSupportedBuild({profileGameInfoVersion:626},BID).status,'EXACT');
 assert.equal(matchSupportedBuild({profileGameInfoVersion:650},BID).status,'SCHEMA_MISMATCH');
 const original=Buffer.from(c.bytes);
 for(const bad of [
  {...c.args,targetBuild:{...BID,value:'BADBID'}},
  {...c.args,targetBuild:{...BID,kind:BuildIdentityKind.SteamFullVersion}},
  {...c.args,targetBuild:{...BID,platform:PlatformFamily.SteamWindows}},
  {...c.args,expectedSourceSha256:'0'.repeat(64)},
  {...c.args,sourceSessionId:c.args.sourceSessionId+1},
  {...c.args,getActiveSessionId:()=>c.args.sourceSessionId+1},
  {...c.args,sourceBytes:new Uint8Array([1,2,3])}
 ])await assert.rejects(createW1EditedP1gCopy(bad));
 const newer=makeContext(profile(655));
 assert.equal(newer.review.status,'BLOCKED_W1_WRITE_TARGETS');
 await assert.rejects(createW1EditedP1gCopy({...newer.args,w1TargetReview:c.review,entries:c.args.entries}));
 assert.deepEqual(Buffer.from(c.bytes),original);
});
test('W1-Q03 caller replay, no-op, stale original, forged pointer/index/kind, duplicate plan and invalid dates deny',async()=>{
 const c=makeContext(),e=c.args.entries[0];
 const invalid=[
  [{...e,originalTime:'2025-01-01T00:00:00Z'}],
  [{...e,targetTime:e.originalTime}],
  [{...e,targetTime:'2026-02-30T00:00:00Z'}],
  [{...e,targetTime:'NOT_A_DATE'}],
  [{...e,pointer:'/World/RecurringEvents/00/ItemSpawning/NextOccurrence'}],
  [{...e,pointer:'/World/RecurringEvents/0/ItemSpawning/LastOccurrence'}],
  [{...e,pointer:'/World/__proto__/x'}],
  [{...e,kind:'FishSpawningInVillage'}],
  [{...e,eventId:2010500008}],
  [e,e],
  []
 ];
 const original=Buffer.from(c.bytes);
 for(const entries of invalid)await assert.rejects(createW1EditedP1gCopy({...c.args,entries}));
 assert.deepEqual(Buffer.from(c.bytes),original);
});
test('W1-Q04 protection denies Moonstone, TimeBending, non-W1 Snippet, inactive Fish and unknown definition',async()=>{
 const p=profile(),c=makeContext(p);
 const original=Buffer.from(c.bytes);
 for(const id of [2010000064,2010000093,2011300000,2010200014,999999999]){
  const s=snapshot(p),plan=planFor(s,[id]);
  const review=assessMinimalW1WriteTargets(p,s,plan,definitions,ledger);
  assert.equal(review.status,'BLOCKED_W1_WRITE_TARGETS','blocked ID '+id);
  assert.equal(review.targetScopeVerified,false);
  const e=badEntry(c,id);
  await assert.rejects(createW1EditedP1gCopy({...c.args,w1TargetReview:review,entries:[e]}));
 }
 assert.deepEqual(Buffer.from(c.bytes),original);
});
test('W1-Q05 mixed valid + protected batch and duplicate saved EventID fail whole copy',async()=>{
 const c=makeContext();
 const s=c.s,plan=planFor(s,[2010000021,2010000064]);
 const rev=assessMinimalW1WriteTargets(c.p,s,plan,definitions,ledger);
 assert.equal(rev.status,'BLOCKED_W1_WRITE_TARGETS');
 assert.deepEqual(rev.candidateTargets,[]);
 await assert.rejects(createW1EditedP1gCopy({...c.args,w1TargetReview:rev,entries:[c.args.entries[0],badEntry(c,2010000064)]}));
 const p=profile();
 p.World.RecurringEvents['9']={ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:OLD}};
 const duplicated=makeContext(p);
 assert.equal(duplicated.review.status,'BLOCKED_W1_WRITE_TARGETS');
 await assert.rejects(createW1EditedP1gCopy({...duplicated.args,w1TargetReview:c.review,entries:c.args.entries}));
});
test('W1-Q06 unknown oneof branch or multiple recognized variants deny even when selected known W1 path is valid',async()=>{
 const original=makeContext();
 for(const modifier of [
  p=>{p.World.RecurringEvents['0'].FlowerSpawningInVillage={RecurringEventItemID:2010500008,NextOccurrence:OLD};},
  p=>{p.World.RecurringEvents['0'].UnrecognizedFutureVariant={NextOccurrence:OLD};},
  p=>{p.World.RecurringEvents['0'].FutureOpaque={RecurringEventItemID:2010000021};}
 ]){
  const p=profile();modifier(p);
  const c=makeContext(p,[2010000021]);
  assert.equal(c.review.status,'BLOCKED_W1_WRITE_TARGETS');
  await assert.rejects(createW1EditedP1gCopy({...c.args,w1TargetReview:original.review,entries:[original.args.entries[0]]}));
 }
});
test('W1-Q07 altered TIME review, false authority, candidate mutation, mismatching source fields reject',async()=>{
 const c=makeContext();
 const edits=[
  r=>{r.writerAuthorized=true;},
  r=>{r.editedExportAuthorized=true;},
  r=>{r.status='BLOCKED_W1_WRITE_TARGETS';},
  r=>{r.targetScopeVerified=false;},
  r=>{r.source.buildId='UNKNOWN';},
  r=>{r.source.rawEventSHA256='e'.repeat(64);},
  r=>{r.candidateTargets[0].targetTime='2099-01-01T00:00:00Z';},
  r=>{r.candidateTargets[0].eventId=2010000064;},
  r=>{r.candidateTargets.push({...r.candidateTargets[0],pointer:'/World/RecurringEvents/9/ItemSpawning/NextOccurrence'});}
 ];
 for(const mutate of edits){
  const review=structuredClone(c.review);mutate(review);
  await assert.rejects(createW1EditedP1gCopy({...c.args,w1TargetReview:review}));
 }
 // Valid TIME result is NOT proof a future Worker passed trusted state; WEB still needs its own source guards.
});
test('W1-Q08 physical ZIP comments, local+central extra and data descriptor never silently get normalized to edited output',async()=>{
 const c=makeContext(profile(),[2010000021]);
 const cases=Object.entries(zipVariants);
 for(const [name,fn] of cases){
  const bytes=physicallyModify(c.bytes,fn),untouched=Buffer.from(bytes);
  let readable=false;
  try{await codec.loadProfile(bytes);readable=true;}catch{}
  await assert.rejects(createW1EditedP1gCopy({...c.args,sourceBytes:bytes,expectedSourceSha256:SHA(bytes)}),undefined,name);
  assert.deepEqual(Buffer.from(bytes),untouched,name);
  if(name==='archiveComment'||name==='entryComment'||name==='localAndCentralExtra')assert.equal(readable,true,name+' must remain readable');
 }
});
test('W1-Q09 running session invalidates at start, after first decode or after Encode/Reopen (no returned partial output)',async()=>{
 const c=makeContext();
 for(const permitted of [0,1,2]){
  let checks=0;
  const args={...c.args,getActiveSessionId:()=>++checks<=permitted?c.args.sourceSessionId:c.args.sourceSessionId+99};
  const untouched=Buffer.from(c.bytes);
  await assert.rejects(createW1EditedP1gCopy(args),/W1_STALE_SESSION/);
  assert.deepEqual(Buffer.from(c.bytes),untouched);
 }
});
test('W1-Q10 no persistent write, no original overwrite, and only research-restricted direct API exists before WEB',async()=>{
 const c=makeContext();
 const result=await createW1EditedP1gCopy(c.args);
 assert.equal(result.persistentReplaceAuthorized,false);
 assert.equal(result.originalOverwritePerformed,false);
 assert.equal(result.userDownloadPerformed,false);
 assert.equal(result.browserRuntimeVerified,false);
 assert.equal(result.deviceLoadVerified,false);
 const worker=await readFile(new URL('../src/worker.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(worker,/createW1EditedP1gCopy/);
 assert.doesNotMatch(worker,/type\s*===\s*['"]exportEdited['"]/);
});
