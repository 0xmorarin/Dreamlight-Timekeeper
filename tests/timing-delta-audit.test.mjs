import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {auditTimingDeltaIsolated} from '../src/core/timing-delta-audit.mjs';

const events=indexEvents(JSON.parse(await readFile(new URL(
 '../data/events-v1253.json',import.meta.url),'utf8')));
const ORIGINAL='2126-08-20T00:00:00Z';
function profile(version=626){
 return {
  GameInfo:{Version:version,InitialVersion:518,UnknownFutureField:'untouched'},
  Player:{Name:'Synthetic'},
  World:{RecurringEvents:{
   '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:ORIGINAL,NewField:{value:'preserve'}}},
   '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:'2026-11-02T00:00:00Z'}}
  }},
  FutureFlags:{keep:['unchanged',17,{nested:'data'}]}
 };
}
const projected=p=>projectProfile(p,events,{now:Date.parse('2026-11-02T00:00:00Z')});
function entry(row,target){return {pointer:row.pointer,originalTime:row.time,targetTime:target}}
function plan(s){
 return [entry(s.rows.find(r=>r.id===2010000021),'2127-02-28T12:00:00.000Z'),
         entry(s.rows.find(r=>r.id===2010500008),'2022-09-06T00:00:00.000Z')];
}

test('isolated semantic-diff proof preserves source and unknown keys without providing edited bytes',()=>{
 const p=profile(),snapshot=projected(p),before=JSON.stringify(p);
 const result=auditTimingDeltaIsolated(p,snapshot,plan(snapshot));
 assert.equal(result.status,'READ_ONLY_ISOLATED_JSON_DIFF_PASS');
 assert.equal(result.checked,2);
 assert.equal(result.requested,2);
 assert.deepEqual(result.plannedPaths,[...plan(snapshot).map(e=>e.pointer)].sort());
 assert.equal(JSON.stringify(p),before);
 assert.equal(p.World.RecurringEvents['0'].ItemSpawning.NextOccurrence,ORIGINAL);
 assert.deepEqual(Object.keys(result).sort(),[
  'checked','editedCopyAuthorized','exportAvailable','nativeSemanticsVerified',
  'plannedPaths','preflight','profileContainerRoundTripVerified','requested',
  'sourceBuildVerified','sourceMutationPerformed','sourceSerializationVerified',
  'status','writerAuthorized'
 ].sort());
 for(const key of ['sourceBuildVerified','sourceMutationPerformed','sourceSerializationVerified',
  'profileContainerRoundTripVerified','nativeSemanticsVerified','writerAuthorized','editedCopyAuthorized','exportAvailable'])
  assert.equal(result[key],false);
 assert.throws(()=>result.plannedPaths.push('injected'),TypeError);
});
test('newer schema may match JSON path without granting write or runtime semantics',()=>{
 const p=profile(650),s=projected(p);
 const result=auditTimingDeltaIsolated(p,s,plan(s));
 assert.equal(result.status,'READ_ONLY_ISOLATED_JSON_DIFF_PASS');
 assert.equal(result.sourceBuildVerified,false);
 assert.equal(result.editedCopyAuthorized,false);
});
test('oneof and old-value drift cannot yield an isolated-diff pass',()=>{
 const p=profile(),s=projected(p),targets=plan(s);
 p.World.RecurringEvents['0'].ItemSpawning.RecurringEventItemID=999999999;
 const blocked=auditTimingDeltaIsolated(p,s,targets);
 assert.equal(blocked.status,'HOLD_PREFLIGHT');
 assert.equal(blocked.checked,0);
 assert.equal(blocked.preflight.rejected,1);
 assert.equal(blocked.writerAuthorized,false);
 assert.equal(blocked.plannedPaths.length,0);
});
test('unreviewed and malformed input does not create any proposed edit output',()=>{
 const p=profile(),s=projected(p);
 const wrong=[{...plan(s)[0],targetTime:'2026-02-30T00:00:00Z'}];
 assert.equal(auditTimingDeltaIsolated(p,s,wrong).status,'HOLD_PREFLIGHT');
 assert.equal(auditTimingDeltaIsolated(p,s,[]).status,'HOLD_PREFLIGHT');
 assert.throws(()=>auditTimingDeltaIsolated(p,s,plan(s),{maxChanges:1}),/preflight input/);
 assert.throws(()=>auditTimingDeltaIsolated(p,s,[plan(s)[0],plan(s)[0]]),/duplicate/);
});
test('lossy unrelated JSON values are detected instead of silently erased',()=>{
 const p=profile(),s=projected(p),one=[plan(s)[0]];
 p.FutureFlags.keep.push(undefined);
 assert.throws(()=>auditTimingDeltaIsolated(p,s,one),/JSON reparse|unplanned/);
});
test('unexpected numeric non-json data is rejected, not normalized',()=>{
 const p=profile(),s=projected(p);
 p.FutureFlags.weird=Infinity;
 assert.throws(()=>auditTimingDeltaIsolated(p,s,[plan(s)[0]]),/JSON reparse|unplanned/);
});
