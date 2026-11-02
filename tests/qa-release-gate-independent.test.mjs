// Independent 05 QR negative acceptance at the fixed PR #2 parent.
// Synthetic/read-only only. Never encode or expose edited profile bytes.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {createTimingDraft} from '../src/core/timing-draft.mjs';
import {inspectTimingPlan} from '../src/core/timing-plan-preflight.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {makeSyntheticP1gProfile,corruptSyntheticP1gCentralHeader} from './fixture.mjs';

const events=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const registry=indexEvents(events);
const parked='2126-08-20T00:00:00Z';
const target='2022-09-06T00:00:00Z';
const input=(schema=626)=>({
 GameInfo:{Version:schema},
 Player:{Name:'Synthetic'},
 World:{RecurringEvents:{'0':{ItemSpawning:{
  RecurringEventItemID:2010000021,NextOccurrence:parked,
  UnknownFutureField:{retain:[7,8,9]}
 }}}},
 Opaque:{unknownNested:{preserve:true}}
});
const snapshot=p=>projectProfile(p,registry,{now:Date.parse('2026-11-02T01:00:00Z')});
const failClosed=report=>{
 assert.equal(report.writerAuthorized,false);
 assert.equal(report.editedCopyAuthorized,false);
 assert.equal(report.exportAvailable,false);
 for(const r of report.rows) {
  assert.equal(r.writerAuthorized,false);
  assert.equal(r.editedCopyAuthorized,false);
 }
};

test('QR: future scheduled time is a valid manual preview input, not corruption or authorization',()=>{
 const p=input(),original=JSON.stringify(p),s=snapshot(p);
 const row=s.rows.find(x=>x.id===2010000021);
 assert(row && row.pointer);
 assert.equal(row.time,parked);
 const d=createTimingDraft(s);
 assert.equal(d.stage([row.pointer],target).count,1);
 assert.equal(d.undo().count,0);
 assert.equal(d.redo().count,1);
 const report=inspectTimingPlan(p,s,d.view().entries);
 assert.equal(report.rows[0].code,'STRUCTURE_OBSERVED');
 failClosed(report);
 assert.equal(JSON.stringify(p),original);
 assert.deepEqual(p.Opaque.unknownNested,{preserve:true});
});

test('QR: stale original, event-ID change, unknown parallel variant and forged pointer fail closed',()=>{
 const p=input(),s=snapshot(p),row=s.rows.find(x=>x.id===2010000021);
 const plan=[{pointer:row.pointer,originalTime:row.time,targetTime:target}];
 p.World.RecurringEvents['0'].ItemSpawning.NextOccurrence='2027-01-01T00:00:00Z';
 let result=inspectTimingPlan(p,s,plan);
 assert.equal(result.rows[0].code,'ORIGINAL_VALUE_MISMATCH');
 failClosed(result);
 p.World.RecurringEvents['0'].ItemSpawning.NextOccurrence=parked;
 p.World.RecurringEvents['0'].ItemSpawning.RecurringEventItemID=2010000073;
 result=inspectTimingPlan(p,s,plan);
 assert.equal(result.rows[0].code,'RECURRING_EVENT_ID_MISMATCH');
 failClosed(result);
 p.World.RecurringEvents['0'].ItemSpawning.RecurringEventItemID=2010000021;
 p.World.RecurringEvents['0'].UnrecognizedFutureKind={NextOccurrence:parked};
 result=inspectTimingPlan(p,s,plan);
 assert.equal(result.rows[0].code,'UNKNOWN_PARALLEL_EVENT_VARIANT');
 failClosed(result);
 assert.throws(()=>inspectTimingPlan(p,s,[{...plan[0],pointer:'/World/__proto__/x'}]));
 assert.throws(()=>inspectTimingPlan(p,s,[...plan,...plan]));
});

test('QR: newer save schema may be inspected but cannot inherit a writer permission',()=>{
 const p=input(700),s=snapshot(p),row=s.rows.find(x=>x.id===2010000021);
 const report=inspectTimingPlan(p,s,[{pointer:row.pointer,originalTime:parked,targetTime:target}]);
 assert.equal(report.schema,700);
 assert.equal(report.newVersionReadAllowed,true);
 assert.equal(report.sourceBuildVerified,false);
 assert.equal(report.exactFieldSemanticsVerified,false);
 failClosed(report);
});

test('QR: decoded synthetic P1G preserves source input and nested unknown JSON on read',async()=>{
 const p=input(),f=makeSyntheticP1gProfile(p),before=Buffer.from(f);
 const result=await p1gPackagedProfileCodec.loadProfile(f);
 const parsed=JSON.parse(result.jsonText);
 assert.deepEqual(parsed.Opaque,p.Opaque);
 assert.deepEqual(parsed.World.RecurringEvents['0'].ItemSpawning.UnknownFutureField,{retain:[7,8,9]});
 assert.deepEqual(Buffer.from(f),before);
 const audit=auditP1gEnvelope({format:'packaged',metadata:result.metadata});
 assert.equal(audit.localHeaderFieldsMatchCentral,true);
 assert.equal(audit.repackageShapeObserved,true);
 assert.equal(audit.bytePreservationVerified,false);
 assert.equal(audit.metadataPreservationVerified,false);
 assert.equal(audit.localHeaderParityVerified,false);
 assert.equal(audit.writerAuthorized,false);
 assert.equal(audit.editedCopyAuthorized,false);
});

test('QR: descriptor, extension, archive comment and local/central mismatches never imply rebuild safety',async()=>{
 const f=makeSyntheticP1gProfile(input()),before=Buffer.from(f);
 const decoded=await p1gPackagedProfileCodec.loadProfile(f);
 const zip=decoded.metadata.zip;
 const audit=auditP1gEnvelope({format:'packaged',metadata:{zip:{
  ...zip,archiveComment:new Uint8Array([3]),
  profileEntry:{...zip.profileEntry,flagBits:0x0008,
   extra:new Uint8Array([1,2,3]),comment:new Uint8Array([4,5])}
 }}});
 for(const finding of [
  'ARCHIVE_COMMENT_PRESENT','ENTRY_COMMENT_PRESENT',
  'DATA_DESCRIPTOR_FLAG_WOULD_BE_REMOVED','LOCAL_CENTRAL_EXTRA_BYTES_DIFFER',
  'LOCAL_CENTRAL_FLAGS_DIFFER','REBUILT_ZIP_RAW_BYTE_PARITY_NOT_PROVEN'
 ])assert(audit.findings.includes(finding),finding);
 assert.equal(audit.status,'CONTAINER_REBUILD_REQUIRES_REVIEW');
 assert.equal(audit.localHeaderFieldsMatchCentral,false);
 assert.equal(audit.writerAuthorized,false);
 assert.equal(audit.editedCopyAuthorized,false);
 assert.deepEqual(Buffer.from(f),before);
});

test('QR: Worker public command surface remains open/backup/preflight/check only',async()=>{
 const worker=await readFile(new URL('../src/worker.mjs',import.meta.url),'utf8');
 const app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
 for(const action of ['open','backup','preflight','check'])
  assert(worker.includes(`data.type==='${action}'`),action);
 for(const action of ['export','encode','overwrite','write','delete'])
  assert(!worker.includes(`data.type==='${action}'`),action);
 assert(!/request\('(export|encode|overwrite|write|delete)'/.test(app));
 assert(/original=bytes.slice\(\)/.test(worker));
 assert(/original.slice\(\).buffer/.test(worker));
});

test('QR: encrypted P1G central CRC and size corruption are refused before any backup/export claim',async()=>{
 const original=Buffer.from(makeSyntheticP1gProfile(input()));
 const wrongCrc=corruptSyntheticP1gCentralHeader(original,16);
 const wrongSize=corruptSyntheticP1gCentralHeader(original,24);
 await assert.rejects(()=>p1gPackagedProfileCodec.loadProfile(wrongCrc));
 await assert.rejects(()=>p1gPackagedProfileCodec.loadProfile(wrongSize));
 assert.deepEqual(Buffer.from(original),Buffer.from(makeSyntheticP1gProfile(input())));
});
