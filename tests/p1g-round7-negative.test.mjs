// CORE Round 7: synthetic-only negative boundaries, never a writer assertion.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createCipheriv,createDecipheriv} from 'node:crypto';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {inspectTimingPlan} from '../src/core/timing-plan-preflight.mjs';
import {auditTimingDeltaIsolated} from '../src/core/timing-delta-audit.mjs';
import {readFile} from 'node:fs/promises';

const KEY=Buffer.from('62357168683873614a38556c444a557a545a5864325467366d626f3857386e35','hex');
const registry=indexEvents(JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8')));
const T0='2126-08-20T00:00:00Z', T1='2026-11-02T00:00:00Z';
const root=()=>({GameInfo:{Version:626,InitialVersion:518},Player:{Name:'Synthetic'},World:{
 RecurringEvents:{
  '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:T0,Opaque:{array:[1,null,'keep']}}},
  '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:T1}}
 },UnrecognizedFuture:{array:[null,false,{'2':'a','10':'b'}]}}});
const snapshot=r=>projectProfile(r,registry,{now:Date.parse('2026-11-02T00:00:00Z')});
function plan(s){
 const a=s.rows.find(r=>r.id===2010000021),b=s.rows.find(r=>r.id===2010500008);
 assert(a&&b);
 return [
  {pointer:a.pointer,originalTime:a.time,targetTime:'2127-01-02T03:04:05.000Z'},
  {pointer:b.pointer,originalTime:b.time,targetTime:'2022-09-06T00:00:00.000Z'}
 ];
}
test('multi-row CAS refuses one stale, invalid, no-op, missing or duplicate pointer without mutating source',()=>{
 const p=root(),original=JSON.stringify(p),s=snapshot(p),rows=plan(s);
 const variants=[
  [{...rows[0]},{...rows[1],originalTime:T0}],
  [{...rows[0]},{...rows[1],targetTime:'not-a-date'}],
  [{...rows[0]},{...rows[1],targetTime:rows[1].originalTime}],
  [{...rows[0]},{...rows[1],pointer:'/World/RecurringEvents/999/FlowerSpawningInVillage/NextOccurrence'}]
 ];
 for(const candidate of variants){
  const check=inspectTimingPlan(p,s,candidate);
  assert.equal(check.summary.structuralShapeObserved,1);
  assert.equal(check.editedCopyAuthorized,false);
  const isolated=auditTimingDeltaIsolated(p,s,candidate);
  assert.equal(isolated.status,'HOLD_PREFLIGHT');
  assert.equal(isolated.checked,0);
  assert.equal(isolated.writerAuthorized,false);
 }
 for(const candidate of [[rows[0],rows[0]],[
  {...rows[0],pointer:'/World/__proto__/evil'},rows[1]]]){
  assert.throws(()=>inspectTimingPlan(p,s,candidate),/invalid|duplicate/i);
  assert.throws(()=>auditTimingDeltaIsolated(p,s,candidate),/invalid|duplicate/i);
 }
 const sDrift=snapshot({...p,GameInfo:{Version:700}});
 assert.throws(()=>inspectTimingPlan(p,sDrift,rows),/schema snapshot identity mismatch/i);
 assert.equal(JSON.stringify(p),original);
});
test('two valid CAS rows cannot authorize a third opaque mutation; exact diff is semantic only',()=>{
 const p=root(),s=snapshot(p),rows=plan(s),base=JSON.stringify(p);
 const checked=inspectTimingPlan(p,s,rows);
 assert.equal(checked.summary.structuralShapeObserved,2);
 const audit=auditTimingDeltaIsolated(p,s,rows);
 assert.equal(audit.status,'READ_ONLY_ISOLATED_JSON_DIFF_PASS');
 const candidate=structuredClone(p);
 candidate.World.RecurringEvents['0'].ItemSpawning.NextOccurrence=rows[0].targetTime;
 candidate.World.RecurringEvents['1'].FlowerSpawningInVillage.NextOccurrence=rows[1].targetTime;
 candidate.World.UnrecognizedFuture.array[2]['2']='altered';
 assert.deepEqual(diffPaths(p,candidate).sort(),[
  rows[0].pointer,rows[1].pointer,'/World/UnrecognizedFuture/array/2/2'
 ].sort());
 assert.equal(new Set(audit.plannedPaths).has('/World/UnrecognizedFuture/array/2/2'),false);
 assert.equal(JSON.stringify(p),base);
});
function physicalZip(source,modify){
 const decipher=createDecipheriv('aes-256-ecb',KEY,null);
 const zip=Buffer.concat([decipher.update(source),decipher.final()]);
 const result=modify(zip);
 const cipher=createCipheriv('aes-256-ecb',KEY,null);
 return new Uint8Array(Buffer.concat([cipher.update(result),cipher.final()]));
}
test('physically present ZIP archive and member comments can be decoded but cannot enter synthetic repacker',async()=>{
 const source=makeSyntheticP1gProfile(root()),sourceCopy=Buffer.from(source);
 const modifications=[
  {name:'archive comment',expected:/ZIP_UNSUPPORTED_ARCHIVE_COMMENT_FOR_MODIFIED_ENCODE/,
   mutate(zip){const e=zip.length-22;const comment=Buffer.from([0xaa,0xbb,0xcc]);const modified=Buffer.concat([zip,comment]);modified.writeUInt16LE(comment.length,e+20);return modified;}},
  {name:'entry comment',expected:/ZIP_SOURCE_ENVELOPE_REBUILD_UNVERIFIED/,
   mutate(zip){const e=zip.length-22,c=zip.readUInt32LE(e+16),newComment=Buffer.from([0x43,0x4d,0x54]);
    const centralEnd=c+46+zip.readUInt16LE(c+28)+zip.readUInt16LE(c+30);
    const modified=Buffer.concat([zip.subarray(0,centralEnd),newComment,zip.subarray(centralEnd)]);
    modified.writeUInt16LE(newComment.length,c+32);
    modified.writeUInt32LE(zip.readUInt32LE(e+12)+newComment.length,e+newComment.length+12);
    return modified;}}
 ];
 for(const m of modifications){
  const bytes=physicalZip(source,m.mutate),unchanged=Buffer.from(bytes);
  const decoded=await p1gPackagedProfileCodec.loadProfile(bytes);
  assert.deepEqual(parseSafeJson(decoded.jsonText),root(),m.name);
  const report=auditP1gEnvelope({format:'packaged',metadata:decoded.metadata});
  assert.equal(report.repackageShapeObserved,false,m.name);
  assert.equal(report.editedCopyAuthorized,false,m.name);
  await assert.rejects(p1gPackagedProfileCodec.createEncodedProfile(
    JSON.stringify({...root(),ExtraSynthetic:1}),decoded.metadata),m.expected,m.name);
  assert.deepEqual(Buffer.from(bytes),unchanged,m.name);
 }
 assert.deepEqual(Buffer.from(source),sourceCopy);
});

test('real matching unknown local/central ZIP extra records remain read-only and unrepackable',async()=>{
 const baseline=makeSyntheticP1gProfile(root()),original=Buffer.from(baseline);
 const tag=Buffer.from([0x34,0x12,0x00,0x00]); // valid unknown zero-length ZIP extra record
 const bytes=physicalZip(baseline,zip=>{
  const oldEocd=zip.length-22,oldCentral=zip.readUInt32LE(oldEocd+16);
  const oldCentralSize=zip.readUInt32LE(oldEocd+12);
  const localEnd=30+zip.readUInt16LE(26);
  const withLocal=Buffer.concat([zip.subarray(0,localEnd),tag,zip.subarray(localEnd)]);
  const newCentral=oldCentral+tag.length;
  const centralNameEnd=newCentral+46+withLocal.readUInt16LE(newCentral+28);
  const both=Buffer.concat([withLocal.subarray(0,centralNameEnd),tag,withLocal.subarray(centralNameEnd)]);
  const newEocd=oldEocd+tag.length*2;
  both.writeUInt16LE(tag.length,28);
  both.writeUInt16LE(tag.length,newCentral+30);
  both.writeUInt32LE(newCentral,newEocd+16);
  both.writeUInt32LE(oldCentralSize+tag.length,newEocd+12);
  return both;
 });
 const sourceCopy=Buffer.from(bytes);
 const loaded=await p1gPackagedProfileCodec.loadProfile(bytes);
 assert.deepEqual(parseSafeJson(loaded.jsonText),root());
 assert.deepEqual(Buffer.from(loaded.metadata.zip.profileEntry.extra),tag);
 assert.deepEqual(Buffer.from(loaded.metadata.zip.profileEntry.localHeader.extra),tag);
 const report=auditP1gEnvelope({format:'packaged',metadata:loaded.metadata});
 assert.equal(report.localHeaderFieldsMatchCentral,true);
 assert.equal(report.localExtraMatchesCentral,true);
 assert(report.findings.includes('ZIP_EXTRA_FIELDS_REBUILD_SEMANTICS_UNVERIFIED'));
 assert.equal(report.repackageShapeObserved,false);
 assert.equal(report.writerAuthorized,false);
 await assert.rejects(p1gPackagedProfileCodec.createEncodedProfile(
  JSON.stringify({...root(),FutureSynthetic:1}),loaded.metadata),
  /ZIP_SOURCE_ENVELOPE_REBUILD_UNVERIFIED/);
 assert.deepEqual(Buffer.from(bytes),sourceCopy);
 assert.deepEqual(Buffer.from(baseline),original);
});
