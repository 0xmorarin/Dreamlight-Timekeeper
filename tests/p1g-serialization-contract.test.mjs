// 01 CORE synthetic-only serializer and operation-delta contract.
// No private data, product edited export, or Write capability is used here.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createCipheriv,createDecipheriv} from 'node:crypto';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';
import {SafeProfileEditSession,parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
import {PlatformFamily} from '../src/core/versioning.mjs';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {inspectTimingPlan} from '../src/core/timing-plan-preflight.mjs';
import {auditTimingDeltaIsolated} from '../src/core/timing-delta-audit.mjs';

const registry=indexEvents(JSON.parse(await readFile(
 new URL('../data/events-v1253.json',import.meta.url),'utf8')));
const TIME='2126-08-20T00:00:00Z';
const KEY=Buffer.from('62357168683873614a38556c444a557a545a5864325467366d626f3857386e35','hex');
function profile(schema=626){
 return {GameInfo:{Version:schema,InitialVersion:518,Unrecognized:{keep:true}},
  Player:{Name:'Synthetic'},World:{RecurringEvents:{
   '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:TIME,
    UnknownPerEvent:{n:12,list:[null,'2026-01-01T00:00:00Z',false]}}},
   '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,
    NextOccurrence:'2026-11-02T00:00:00Z'}}},
   UnknownGrid:{grids:[{id:91,state:{owner:'untouched'}},null,7],
    integerLookingKeys:{'13':'thirteen','2':'two'},tombstone:false}},
  FutureOpaque:{nullable:null,numberAsText:'9007199254740993',
   fractional:0.125,emoji:'🌼',nested:[{v:1},true,'keep']}}
}
const snapshot=p=>projectProfile(p,registry,{now:Date.parse('2026-11-02T00:00:00Z')});
function planned(s){
 return [
  {pointer:s.rows.find(r=>r.id===2010000021).pointer,originalTime:TIME,
   targetTime:'2127-03-01T12:00:00.000Z'},
  {pointer:s.rows.find(r=>r.id===2010500008).pointer,
   originalTime:'2026-11-02T00:00:00Z',targetTime:'2022-09-06T00:00:00.000Z'}
 ];
}
test('synthetic two-row exact-pointer plan survives one encode/reopen; all unknown values and arrays survive',async()=>{
 const original=profile(),ciphertext=makeSyntheticP1gProfile(original),backup=Buffer.from(ciphertext);
 const loaded=await p1gPackagedProfileCodec.loadProfile(ciphertext);
 const root=parseSafeJson(loaded.jsonText),s=snapshot(root),plan=planned(s);
 const preflight=inspectTimingPlan(root,s,plan);
 assert.equal(preflight.summary.structuralShapeObserved,2);
 const audit=auditTimingDeltaIsolated(root,s,plan);
 assert.equal(audit.status,'READ_ONLY_ISOLATED_JSON_DIFF_PASS');
 const expected=[...plan.map(p=>p.pointer)].sort();
 assert.deepEqual([...audit.plannedPaths].sort(),expected);
 const clone=structuredClone(root);
 for(const row of plan){
  const parts=row.pointer.slice(1).split('/').map(x=>x.replaceAll('~1','/').replaceAll('~0','~'));
  let target=clone;
  for(const part of parts.slice(0,-1))target=target[part];
  assert.equal(target[parts.at(-1)],row.originalTime);
  target[parts.at(-1)]=row.targetTime;
 }
 assert.deepEqual(diffPaths(root,clone).sort(),expected);
 const encoded=await p1gPackagedProfileCodec.createEncodedProfile(JSON.stringify(clone),loaded.metadata);
 const reopened=await p1gPackagedProfileCodec.loadProfile(encoded);
 const reopenedRoot=parseSafeJson(reopened.jsonText);
 assert.deepEqual(diffPaths(root,reopenedRoot).sort(),expected);
 assert.deepEqual(reopenedRoot,clone);
 for(const key of ['GameInfo','Player','FutureOpaque'])
  assert.deepEqual(reopenedRoot[key],root[key],key);
 assert.deepEqual(reopenedRoot.World.UnknownGrid,root.World.UnknownGrid);
 assert.deepEqual(reopenedRoot.World.RecurringEvents['0'].ItemSpawning.UnknownPerEvent,
  root.World.RecurringEvents['0'].ItemSpawning.UnknownPerEvent);
 assert.deepEqual(Buffer.from(ciphertext),backup);
 assert.equal(audit.sourceSerializationVerified,false);
 assert.equal(audit.editedCopyAuthorized,false);
 assert.equal(audit.writerAuthorized,false);
 const envelope=auditP1gEnvelope({format:'packaged',metadata:reopened.metadata});
 assert.equal(envelope.repackageShapeObserved,true);
 assert.equal(envelope.writerAuthorized,false);
});
test('stale original, event-ID drift, unknown changes and schema drift cannot be promoted to a write',()=>{
 const root=profile(),s=snapshot(root),plan=planned(s);
 const original=JSON.stringify(root);
 const stale=[{...plan[0],originalTime:'2026-01-01T00:00:00Z'}];
 assert.equal(inspectTimingPlan(root,s,stale).rows[0].code,'ORIGINAL_VALUE_MISMATCH');
 assert.equal(auditTimingDeltaIsolated(root,s,stale).status,'HOLD_PREFLIGHT');
 const mismatch=structuredClone(root);
 mismatch.World.RecurringEvents['0'].ItemSpawning.RecurringEventItemID=2010000073;
 assert.equal(inspectTimingPlan(mismatch,s,[plan[0]]).rows[0].code,'RECURRING_EVENT_ID_MISMATCH');
 assert.equal(auditTimingDeltaIsolated(mismatch,s,[plan[0]]).status,'HOLD_PREFLIGHT');
 const extra=structuredClone(root);
 extra.FutureOpaque.nested[0].v=900;
 extra.World.RecurringEvents['0'].ItemSpawning.NextOccurrence=plan[0].targetTime;
 assert.deepEqual(diffPaths(root,extra).sort(),
  [plan[0].pointer,'/FutureOpaque/nested/0/v'].sort());
 const drift=profile(700),ds=snapshot(drift),dp=planned(ds);
 const out=inspectTimingPlan(drift,ds,dp);
 assert.equal(out.newVersionReadAllowed,true);
 assert.equal(out.editedCopyAuthorized,false);
 assert.equal(auditTimingDeltaIsolated(drift,ds,dp).editedCopyAuthorized,false);
 assert.equal(JSON.stringify(root),original);
});
function corruptSyntheticArchive(source,mutator){
 const dec=createDecipheriv('aes-256-ecb',KEY,null);
 const zip=Buffer.concat([dec.update(source),dec.final()]);
 const eocd=zip.length-22;
 assert.equal(zip.readUInt32LE(eocd),0x06054b50);
 const central=zip.readUInt32LE(eocd+16);
 mutator(zip,central,eocd);
 const enc=createCipheriv('aes-256-ecb',KEY,null);
 return new Uint8Array(Buffer.concat([enc.update(zip),enc.final()]));
}
test('synthetic P1G checksum, declared size, EOCD and ciphertext truncation fail closed without source mutation',async()=>{
 const source=makeSyntheticP1gProfile(profile()),before=Buffer.from(source);
 const cases=[
  [zip=>zip.writeUInt32LE((zip.readUInt32LE(zip.length-22-0)+1)>>>0,0),/ZIP_LOCAL_HEADER_INVALID/],
  [(zip,central)=>zip.writeUInt32LE((zip.readUInt32LE(central+16)^1)>>>0,central+16),/ZIP_PROFILE_CRC_INVALID/],
  [(zip,central)=>zip.writeUInt32LE(zip.readUInt32LE(central+20)+4096,central+20),/ZIP_PROFILE_DATA_TRUNCATED/],
  [(zip,central,eocd)=>zip.writeUInt32LE(0,eocd),/ZIP_ARCHIVE_INVALID/]
 ];
 for(const [mutate,code] of cases){
  const altered=corruptSyntheticArchive(source,mutate),untouched=Buffer.from(altered);
  await assert.rejects(p1gPackagedProfileCodec.loadProfile(altered),code);
  assert.deepEqual(Buffer.from(altered),untouched);
 }
 const truncated=source.subarray(0,source.length-1);
 await assert.rejects(p1gPackagedProfileCodec.loadProfile(truncated),/INVALID_ENCRYPTED_PROFILE_LENGTH/);
 assert.deepEqual(Buffer.from(source),before);
});
test('unmodified original encrypted bytes are stable across multiple independent synthetic reads',async()=>{
 const source=makeSyntheticP1gProfile(profile()),copy=Buffer.from(source);
 const a=await p1gPackagedProfileCodec.loadProfile(source);
 const b=await p1gPackagedProfileCodec.loadProfile(source);
 assert.equal(a.jsonText,b.jsonText);
 assert.equal(a.metadata.profileVersion,b.metadata.profileVersion);
 assert.deepEqual(Buffer.from(source),copy);
 assert.equal(auditP1gEnvelope({format:'packaged',metadata:a.metadata}).writerAuthorized,false);
});


test('SYNTHETIC ONLY: no-op backup is original bytes, while non-noop unsupported build rejects before first Encode',async()=>{
 const original=profile(),source=makeSyntheticP1gProfile(original),backup=Buffer.from(source);
 let encodes=0,opens=0;
 const trackingCodec={
  ...p1gPackagedProfileCodec,
  async loadProfile(input){opens++;return p1gPackagedProfileCodec.loadProfile(input);},
  async createEncodedProfile(text,meta){encodes++;return p1gPackagedProfileCodec.createEncodedProfile(text,meta);}
 };
 const session=await SafeProfileEditSession.open({
  sourceBytes:source,sourcePlatform:PlatformFamily.Switch,codec:trackingCodec
 });
 assert.equal(opens,1);
 const noOp=await session.exportVerifiedCopy({
  exactAllowedPaths:[],edit:()=>{},targetBuild:null,operation:null
 });
 assert.equal(noOp.noOp,true);
 assert.equal(noOp.authorization,null);
 assert.deepEqual(noOp.changedPaths,[]);
 assert.deepEqual(Buffer.from(noOp.backupOriginalBytes),backup);
 assert.deepEqual(Buffer.from(noOp.editedBytes),backup);
 assert.notEqual(noOp.backupOriginalBytes,source,'backup is a copy');
 assert.equal(encodes,0);
 const row=snapshot(session.getSnapshot()).rows.find(x=>x.id===2010000021);
 await assert.rejects(session.exportVerifiedCopy({
  exactAllowedPaths:[row.pointer],
  edit(draft){draft.World.RecurringEvents['0'].ItemSpawning.NextOccurrence='2127-03-01T12:00:00.000Z';},
  targetBuild:{platform:'switch',kind:'switch-bid',value:'INVALID_SYNTHETIC_BID'},
  operation:{id:'NO_WRITER',owner:'test',runtimeGate:'UNKNOWN'}
 }),/Writer build gate failed/);
 assert.equal(encodes,0,'unsupported build must not invoke encode');
 assert.equal(opens,1,'unsupported build must not invoke independent reopen');
 assert.equal(session.getSnapshot().World.RecurringEvents['0'].ItemSpawning.NextOccurrence,TIME);
 assert.deepEqual(Buffer.from(source),backup);
});

test('SYNTHETIC ONLY: forged source ZIP timestamps may pass shape audit but are not provenance or writer authority',async()=>{
 const source=makeSyntheticP1gProfile(profile()),backup=Buffer.from(source);
 const loaded=await p1gPackagedProfileCodec.loadProfile(source);
 const zip=loaded.metadata.zip,entry=zip.profileEntry;
 const forgedEntry={
  ...entry,
  dosDate:0x1234,dosTime:0x2468,
  localHeader:{...entry.localHeader,dosDate:0x1234,dosTime:0x2468}
 };
 const forged={...loaded.metadata,zip:{...zip,profileEntry:forgedEntry}};
 const audit=auditP1gEnvelope({format:'packaged',metadata:forged});
 assert.equal(audit.repackageShapeObserved,true,'shape audit does not authenticate metadata');
 assert.equal(audit.bytePreservationVerified,false);
 assert.equal(audit.metadataPreservationVerified,false);
 assert.equal(audit.writerAuthorized,false);
 assert.equal(audit.editedCopyAuthorized,false);
 // The research codec only proves its output follows supplied synthetic metadata.
 const edited=await p1gPackagedProfileCodec.createEncodedProfile(
  JSON.stringify({...profile(),FutureSyntheticField:1}),forged);
 const reopened=await p1gPackagedProfileCodec.loadProfile(edited);
 assert.equal(reopened.metadata.zip.profileEntry.dosDate,forgedEntry.dosDate);
 assert.equal(reopened.metadata.zip.profileEntry.dosTime,forgedEntry.dosTime);
 assert.notEqual(reopened.metadata.zip.profileEntry.dosDate,entry.dosDate);
 assert.deepEqual(Buffer.from(source),backup);
});

test('SYNTHETIC ONLY: extremely compressible 12 MiB profile read remains bounded by declared inflation, not compressed length',async()=>{
 const root=profile();
 root.FutureOpaque.large='R'.repeat(12*1024*1024);
 const source=makeSyntheticP1gProfile(root),original=Buffer.from(source);
 const loaded=await p1gPackagedProfileCodec.loadProfile(source);
 const z=loaded.metadata.zip.profileEntry;
 assert.equal(z.uncompressedSize>12*1024*1024,true);
 assert.equal(z.uncompressedSize/z.compressedSize>100,true);
 assert.equal(parseSafeJson(loaded.jsonText).FutureOpaque.large.length,12*1024*1024);
 assert.equal(auditP1gEnvelope({format:'packaged',metadata:loaded.metadata}).writerAuthorized,false);
 assert.deepEqual(Buffer.from(source),original);
});
