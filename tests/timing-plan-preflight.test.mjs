import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {inspectTimingPlan} from '../src/core/timing-plan-preflight.mjs';
import {createTimingDraft} from '../src/core/timing-draft.mjs';

const registry=indexEvents(JSON.parse(await readFile(
 new URL('../data/events-v1253.json',import.meta.url),'utf8')));
const ORIGINAL='2126-08-20T00:00:00Z';
const TARGET='2126-11-02T09:05:00.000Z';
const makeProfile=(schema=626)=>({GameInfo:{Version:schema},Player:{Name:'Synthetic'},
 World:{RecurringEvents:{
  '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:ORIGINAL}},
  '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:'2026-11-02T00:00:00Z'}},
  '2':{ItemSpawning:{RecurringEventItemID:999999999,NextOccurrence:ORIGINAL}}
 },Stores:[{LastRefresh:'2026-11-02T00:00:00Z'}]}});
const snapshot=p=>projectProfile(p,registry,{now:Date.parse('2026-11-02T01:00:00Z')});
const stage=(p,s,id=2010000021,target=TARGET)=>{
 const row=s.rows.find(x=>x.id===id);
 return [{pointer:row.pointer,originalTime:row.time,targetTime:target}];
};

test('original profile remains untouched; future-year and shared-2126 schedule are not declared corruption',()=>{
 const p=makeProfile(),s=snapshot(p),original=JSON.stringify(p);
 const staged=createTimingDraft(s).stage([stage(p,s)[0].pointer],TARGET);
 const out=inspectTimingPlan(p,s,staged.entries);
 assert.equal(out.status,'READ_ONLY_PLAN_PREFLIGHT');
 assert.equal(out.summary.structuralShapeObserved,1);
 assert.equal(out.rows[0].code,'STRUCTURE_OBSERVED');
 assert.equal(out.rows[0].structuralShapeObserved,true);
 for(const key of ['sourceBuildVerified','writerAuthorized','editedCopyAuthorized','exportAvailable'])
  assert.equal(out[key],false);
 assert.equal(out.rows[0].writerAuthorized,false);
 assert.equal(JSON.stringify(p),original);
 assert.throws(()=>out.rows.push({}),TypeError);
});

test('new save schema is structurally inspected but never granted source-build or edit authorization',()=>{
 const p=makeProfile(647),s=snapshot(p);
 const out=inspectTimingPlan(p,s,stage(p,s));
 assert.equal(out.schema,647);
 assert.equal(out.newVersionReadAllowed,true);
 assert.equal(out.rows[0].code,'STRUCTURE_OBSERVED');
 assert.equal(out.sourceBuildVerified,false);
 assert.equal(out.editedCopyAuthorized,false);
 assert.equal(out.exactFieldSemanticsVerified,false);
});
test('stale source value, different plan baseline and invalid target cannot pass',()=>{
 const p=makeProfile(),s=snapshot(p),entries=stage(p,s);
 p.World.RecurringEvents['0'].ItemSpawning.NextOccurrence='2027-01-01T00:00:00Z';
 assert.equal(inspectTimingPlan(p,s,entries).rows[0].code,'ORIGINAL_VALUE_MISMATCH');
 const p2=makeProfile(),s2=snapshot(p2);
 assert.equal(inspectTimingPlan(p2,s2,[{...stage(p2,s2)[0],originalTime:'2025-01-01T00:00:00Z'}]).rows[0].code,'ORIGINAL_VALUE_MISMATCH');
 assert.equal(inspectTimingPlan(p2,s2,stage(p2,s2,2010000021,'2026-02-30T00:00:00Z')).rows[0].code,'TARGET_TIME_INVALID');
 assert.equal(inspectTimingPlan(p2,s2,stage(p2,s2,2010000021,ORIGINAL)).rows[0].code,'NO_CHANGE');
});
test('oneof ambiguity, unrecognized parallel variant and event-identity drift block structural observation',()=>{
 const p=makeProfile(),s=snapshot(p),entry=stage(p,s);
 p.World.RecurringEvents['0'].FishSpawningInVillage={RecurringEventItemID:2010200014,NextOccurrence:ORIGINAL};
 assert.equal(inspectTimingPlan(p,s,entry).rows[0].code,'AMBIGUOUS_RECURRING_VARIANT');
 delete p.World.RecurringEvents['0'].FishSpawningInVillage;
 p.World.RecurringEvents['0'].UnrecognizedNewVariant={NextOccurrence:ORIGINAL};
 assert.equal(inspectTimingPlan(p,s,entry).rows[0].code,'UNKNOWN_PARALLEL_EVENT_VARIANT');
 delete p.World.RecurringEvents['0'].UnrecognizedNewVariant;
 p.World.RecurringEvents['0'].ItemSpawning.RecurringEventItemID=2010000073;
 assert.equal(inspectTimingPlan(p,s,entry).rows[0].code,'RECURRING_EVENT_ID_MISMATCH');
});
test('unknown events and shop history remain held; unrelated profile fields never become editable',()=>{
 const p=makeProfile(),s=snapshot(p);
 const unknown=inspectTimingPlan(p,s,stage(p,s,999999999));
 assert.equal(unknown.rows[0].code,'EVENT_DEFINITION_UNKNOWN');
 assert.equal(unknown.summary.heldForReview,1);
 const store=s.rows.find(x=>x.source==='World.Stores');
 const out=inspectTimingPlan(p,s,[{pointer:store.pointer,originalTime:store.time,targetTime:TARGET}]);
 assert.equal(out.rows[0].code,'FIELD_KIND_NOT_YET_REVIEWED');
 assert.equal(out.summary.heldForReview,1);
 assert.equal(out.writerAuthorized,false);
});
test('forged pointer, duplicate plan, missing field, unsafe key and schema drift fail closed',()=>{
 const p=makeProfile(),s=snapshot(p),entry=stage(p,s)[0];
 assert.throws(()=>inspectTimingPlan(p,s,[entry,entry]),/duplicate/);
 assert.throws(()=>inspectTimingPlan(p,s,[{...entry,pointer:'/World/__proto__/x'}]));
 assert.throws(()=>inspectTimingPlan(p,s,[{...entry,pointer:'/World/RecurringEvents/~2/ItemSpawning/NextOccurrence'}]));
 assert.equal(inspectTimingPlan(p,s,[{...entry,pointer:'/World/RecurringEvents/77/ItemSpawning/NextOccurrence'}]).rows[0].code,'SOURCE_ROW_NOT_FOUND');
 const changed={...p,GameInfo:{Version:627}};
 assert.throws(()=>inspectTimingPlan(changed,s,[entry]),/identity/);
 assert.throws(()=>inspectTimingPlan(p,{...s,capabilities:{editingAllowed:true,exportEditedAllowed:false}},[entry]));
});
