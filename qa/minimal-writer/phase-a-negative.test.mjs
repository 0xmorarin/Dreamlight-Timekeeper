// 05 QR Minimal Writer Phase A — new checks only on immutable last accepted READ-ONLY product.
// These tests DO NOT certify a Writer. Phase B must independently verify the new production export API.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {makeSyntheticP1gProfile} from '../tests/fixture.mjs';
import {p1gPackagedProfileCodec as codec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {SafeProfileEditSession,parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
import {PlatformFamily,BuildIdentityKind,matchSupportedBuild,BuildMatchStatus,CURRENT_V125_BUILD_CONTRACTS} from '../src/core/versioning.mjs';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {inspectTimingPlan} from '../src/core/timing-plan-preflight.mjs';
import {auditTimingDeltaIsolated} from '../src/core/timing-delta-audit.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';
import {createSeparateDownloadCoordinator} from '../src/ui-separate-downloads.mjs';

const registry=indexEvents(JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8')));
const base='2126-08-20T00:00:00Z',next='2127-01-01T00:00:00.000Z';
const bid={platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'9A239D3DB569756D'};
function root(schema=626){
 return {GameInfo:{Version:schema,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{Name:'Synthetic'},World:{RecurringEvents:{
  '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:base,Opaque:{b:true}}},
  '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:base}}},
  Extra:{unknown:{value:'9007199254740993'},flags:[false,null,17]}
 },Unrecognized:{nested:[0,{k:'untouched'},true]}}};
}
function planFor(profile){
 const view=projectProfile(profile,registry,{now:Date.parse('2026-11-02T00:00:00Z')});
 const row=view.rows.find(x=>x.id===2010000021);
 assert(row?.pointer);
 return {view,row,plan:[{pointer:row.pointer,originalTime:row.time,targetTime:next}]};
}
test('MW-A01 target Switch BID/schema626 still requires explicit writer contract (not inferred from reader)',()=>{
 const identity={profileGameInfoVersion:626,sourcePlatform:PlatformFamily.Switch};
 assert.equal(CURRENT_V125_BUILD_CONTRACTS.some(c=>c.profileGameInfoVersion===626&&c.buildIdentity.value===bid.value),false);
 assert.equal(matchSupportedBuild(identity,bid).status,BuildMatchStatus.UnsupportedBuild);
 assert.equal(matchSupportedBuild(identity,{...bid,value:'OTHER_BID'}).status,BuildMatchStatus.UnsupportedBuild);
 assert.equal(matchSupportedBuild(identity,{...bid,kind:BuildIdentityKind.SteamFullVersion}).status,BuildMatchStatus.InvalidTarget);
 const testOnly=[{id:'SYNTHETIC_QA_ONLY_NO_WRITER',platform:PlatformFamily.Switch,
  profileGameInfoVersion:626,buildIdentity:{kind:BuildIdentityKind.SwitchBid,value:bid.value},
  codecContract:'p1g-v0',persistentWriteAuthorized:false}];
 assert.equal(matchSupportedBuild(identity,bid,testOnly).status,BuildMatchStatus.Exact);
 assert.equal(matchSupportedBuild({...identity,profileGameInfoVersion:627},bid,testOnly).status,BuildMatchStatus.SchemaMismatch);
 assert.equal(testOnly[0].persistentWriteAuthorized,false);
});
test('MW-A02 pointer/CAS/event ID/oneof errors fail preflight, even though preflight is NOT writer approval',()=>{
 const p=root(),{view,row,plan}=planFor(p);
 assert.equal(inspectTimingPlan(p,view,plan).rows[0].code,'STRUCTURE_OBSERVED');
 const changed=structuredClone(p);changed.World.RecurringEvents['0'].ItemSpawning.RecurringEventItemID=2010000073;
 assert.equal(inspectTimingPlan(changed,view,plan).rows[0].code,'RECURRING_EVENT_ID_MISMATCH');
 assert.equal(inspectTimingPlan(p,view,[{...plan[0],originalTime:'2025-01-01T00:00:00Z'}]).rows[0].code,'ORIGINAL_VALUE_MISMATCH');
 assert.equal(inspectTimingPlan(p,view,[{...plan[0],targetTime:'invalid-time'}]).rows[0].code,'TARGET_TIME_INVALID');
 assert.equal(inspectTimingPlan(p,view,[{...plan[0],targetTime:row.time}]).rows[0].code,'NO_CHANGE');
 assert.throws(()=>inspectTimingPlan(p,view,[...plan,...plan]),/duplicate/i);
 assert.throws(()=>inspectTimingPlan(p,view,[{...plan[0],pointer:'/World/__proto__/x'}]));
 const ambiguous=structuredClone(p);ambiguous.World.RecurringEvents['0'].FlowerSpawningInVillage={RecurringEventItemID:2010500008,NextOccurrence:base};
 assert.equal(inspectTimingPlan(ambiguous,view,plan).rows[0].code,'AMBIGUOUS_RECURRING_VARIANT');
 const unknown=structuredClone(p);unknown.World.RecurringEvents['0'].UnexpectedFutureEvent={NextOccurrence:base};
 assert.equal(inspectTimingPlan(unknown,view,plan).rows[0].code,'UNKNOWN_PARALLEL_EVENT_VARIANT');
 assert.equal(inspectTimingPlan(p,view,plan).writerAuthorized,false);
});
test('MW-A03 synthetic isolated delta changes selected NextOccurrence only, keeps source and opaque fields',()=>{
 const p=root(),original=structuredClone(p),{view,plan}=planFor(p);
 const result=auditTimingDeltaIsolated(p,view,plan);
 assert.equal(result.status,'READ_ONLY_ISOLATED_JSON_DIFF_PASS');
 assert.deepEqual(result.plannedPaths,[plan[0].pointer]);
 assert.equal(result.writerAuthorized,false);
 assert.equal(result.editedCopyAuthorized,false);
 const modified=structuredClone(p);
 modified.World.RecurringEvents['0'].ItemSpawning.NextOccurrence=next;
 assert.deepEqual(diffPaths(p,modified),[plan[0].pointer]);
 assert.deepEqual(p,original);
 assert.deepEqual(modified.World.Unrecognized,p.World.Unrecognized);
 assert.deepEqual(modified.World.RecurringEvents.Extra,p.World.RecurringEvents.Extra);
 const unwanted=structuredClone(modified);unwanted.World.Unrecognized.nested[1].k='forbidden';
 assert.deepEqual(new Set(diffPaths(p,unwanted)),new Set([plan[0].pointer,'/World/Unrecognized/nested/1/k']));
});
test('MW-A04 original encrypted bytes preserved, one research encode and independent synthetic reopen; no release permission',async()=>{
 const p=root(),encrypted=makeSyntheticP1gProfile(p),baseline=Uint8Array.from(encrypted);
 const read=await codec.loadProfile(encrypted);
 assert.equal(read.metadata.profileVersion,626);
 const edited=structuredClone(parseSafeJson(read.jsonText));
 edited.World.RecurringEvents['0'].ItemSpawning.NextOccurrence=next;
 let count=0;
 const call=async()=>{count++;return codec.createEncodedProfile(JSON.stringify(edited),read.metadata);};
 const output=await call();
 assert.equal(count,1,'research encode invoked only once');
 const reopened=await codec.loadProfile(output);
 assert.deepEqual(diffPaths(p,parseSafeJson(reopened.jsonText)),[planFor(p).plan[0].pointer]);
 assert.deepEqual(encrypted,baseline,'caller original bytes never mutated');
 assert.notDeepEqual(output,encrypted);
 const check=auditP1gEnvelope({format:'packaged',metadata:read.metadata});
 assert.equal(check.writerAuthorized,false);
 assert.equal(check.editedCopyAuthorized,false);
});
test('MW-A05 unknown ZIP metadata is not silently normalized in synthetic research codec',async()=>{
 const source=makeSyntheticP1gProfile(root()),snapshot=Uint8Array.from(source);
 const loaded=await codec.loadProfile(source),zip=loaded.metadata.zip,entry=zip.profileEntry;
 // Inject a metadata value to test rejection, not proof of a physically present ZIP extension.
 const forced={...loaded.metadata,zip:{...zip,archiveComment:new Uint8Array([67,1])}};
 await assert.rejects(codec.createEncodedProfile(loaded.jsonText,forced));
 const changed={...loaded.metadata,zip:{...zip,profileEntry:{...entry,flagBits:entry.flagBits|8}}};
 await assert.rejects(codec.createEncodedProfile(loaded.jsonText,changed));
 assert.deepEqual(source,snapshot);
});
test('MW-A06 reject abnormal JSON, unsafe integers, duplicate keys before any writer trust',()=>{
 for(const raw of ['{"a":1,"a":2}','{"x":9007199254740993}','{"x":1e999}','{"x":1e-9999}','{"x":[1,2}', 'null'])
  assert.throws(()=>parseSafeJson(raw),raw);
 assert.equal(parseSafeJson('{"x":{"a":null},"flags":[true,false]}').flags[0],true);
});
test('MW-A07 baseline no-op copies must not be confused with future Writer export authorization',async()=>{
 const encrypted=makeSyntheticP1gProfile(root()),before=Uint8Array.from(encrypted);
 let encodes=0,reopens=0;
 const tracked={...codec,
  async loadProfile(b){reopens++;return codec.loadProfile(b);},
  async createEncodedProfile(text,metadata){encodes++;return codec.createEncodedProfile(text,metadata);}
 };
 const session=await SafeProfileEditSession.open({sourceBytes:encrypted,sourcePlatform:PlatformFamily.Switch,codec:tracked});
 const noOp=await session.exportVerifiedCopy({exactAllowedPaths:[],edit:()=>{},targetBuild:null,operation:null});
 assert.equal(noOp.noOp,true);
 assert.equal(noOp.authorization,null,'baseline no-op has no export capability authorization');
 assert.deepEqual(noOp.backupOriginalBytes,encrypted);
 assert.deepEqual(noOp.editedBytes,encrypted);
 assert.equal(encodes,0);assert.equal(reopens,1);
 const {plan}=planFor(root());
 await assert.rejects(session.exportVerifiedCopy({
  exactAllowedPaths:[plan[0].pointer],
  edit(draft){draft.World.RecurringEvents['0'].ItemSpawning.NextOccurrence=next;},
  targetBuild:bid,
  operation:{id:'MINIMAL_WRITER_NOT_ENABLED',owner:'QA',structuralCapabilitiesSupported:false,
    planSupported:false,validationPassed:false,runtimeGate:'PENDING'}
 }),/Writer build gate failed/);
 assert.equal(encodes,0);
 assert.deepEqual(encrypted,before);
});
test('MW-A08 original-first two independent downloads: prepared pair, stale, failed first, blocked second and retries',()=>{
 let session=1;let calls=[];let fail=null;
 const c=createSeparateDownloadCoordinator({currentSession:()=>session,
  triggerDownload:(name,file)=>{calls.push(name);if(name===fail)throw Error('blocked');assert(file.buffer instanceof ArrayBuffer);}});
 const file=name=>({name:name+'.p1g',buffer:new Uint8Array([1,2,3]).buffer});
 const receipt={status:'WORKER_VERIFIED_PAIR',sessionId:1,original:file('original'),edited:file('edited')};
 assert.throws(()=>c.downloadBoth());
 assert.throws(()=>c.install({...receipt,edited:null}));
 c.install(receipt);
 fail='original';assert.deepEqual(c.downloadBoth(),{original:'TRIGGER_FAILED',edited:'NOT_ATTEMPTED',multipleDownloadsMayBeBlocked:true});
 assert.deepEqual(calls,['original']);
 fail='edited';assert.deepEqual(c.downloadBoth(),{original:'TRIGGER_REQUESTED_UNCONFIRMED',edited:'TRIGGER_FAILED',multipleDownloadsMayBeBlocked:true});
 fail=null;assert.equal(c.retryEdited(),'TRIGGER_REQUESTED_UNCONFIRMED');
 assert.equal(c.retryOriginal(),'TRIGGER_REQUESTED_UNCONFIRMED');
 assert.deepEqual(calls,['original','original','edited','edited','original']);
 session=2;assert.throws(()=>c.retryOriginal(),/session changed/);
 assert.throws(()=>c.retryEdited(),/session changed/);
});
