import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {auditTimingSnapshot} from '../src/timing-audit.mjs';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';

const registry=indexEvents(JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8')));
const review=indexTimingReviewRules(JSON.parse(await readFile(new URL('../data/timing-review-rules-v1253.json',import.meta.url),'utf8')));
const NOW=Date.parse('2026-11-02T00:00:00Z');
const event=(id,type,time)=>({[type]:{RecurringEventItemID:id,NextOccurrence:time}});
const shared='2126-08-20T00:00:00Z';
function fixture(){
 return {GameInfo:{Version:626},Player:{Name:'Test'},World:{RecurringEvents:{
  '0':event(2010000003,'ItemSpawning',shared),
  '1':event(2010500008,'FlowerSpawningInVillage',shared),
  '2':event(2010400001,'WildCropsSpawningInVillage',shared),
  '3':event(2010200014,'FishSpawningInVillage','2026-11-02T12:00:00Z'),
  '4':event(2010000064,'ItemSpawning','2029-01-01T00:00:00Z'),
  '5':event(999999999,'ItemSpawning','invalid'),
  '6':event(2010000008,'ItemSpawning','2026-10-31T23:59:00Z')
 },Stores:[{LastRefresh:'2019-01-01T00:00:00Z'}]}};}
const snapshot=profile=>assessTimingSnapshot(projectProfile(profile,registry,{now:NOW}),review);

test('read-only full-save audit counts a shared 2126 pattern without declaring corruption',()=>{
 const p=fixture(),original=JSON.stringify(p),s=snapshot(p),prior=JSON.stringify(s);
 const a=auditTimingSnapshot(s,{now:NOW});
 assert.equal(a.total,8);
 assert.equal(a.recurringCount,7);
 assert.equal(a.statuses.SPECIAL_2126_UNRESOLVED,3);
 assert.equal(a.statuses.FUTURE,1);
 assert.equal(a.statuses.DISTANT_FUTURE_UNVERIFIED,1);
 assert.equal(a.statuses.INVALID,1);
 assert.equal(a.statuses.PAST,2);
 assert.equal(a.shared2126.typeCount,3);
 assert.equal(a.shared2126.multiTypePattern,true);
 assert.equal(a.shared2126.recurringCount,3);
 assert.equal(a.shared2126.originVerified,false);
 assert.equal(a.shared2126.releaseMechanismVerified,false);
 assert.equal(a.shared2126.autoRepairAllowed,false);
 assert.equal(a.ordinaryFutureIsCorruption,false);
 assert.equal(a.writerAuthorized,false);
 assert.equal(a.autoRepairAllowed,false);
 assert.equal(a.observedAt,'2026-11-02T00:00:00.000Z');
 assert.equal(JSON.stringify(p),original);
 assert.equal(JSON.stringify(s),prior);
});

test('future schedule alone does not raise shared sentinel and remains an observation',()=>{
 const p=fixture();
 p.World.RecurringEvents={'0':event(2010000003,'ItemSpawning','2026-11-03T00:00:00Z')};
 const a=auditTimingSnapshot(snapshot(p),{now:NOW});
 assert.equal(a.shared2126.count,0);
 assert.equal(a.shared2126.multiTypePattern,false);
 assert.equal(a.statuses.FUTURE,1);
 assert.equal(a.autoRepairAllowed,false);
});

test('schema mismatch does not silently authorize interpreting timer values',()=>{
 const p=fixture();p.GameInfo.Version=624;
 const a=auditTimingSnapshot(snapshot(p),{now:NOW});
 assert.equal(a.saveSchema,624);
 assert.equal(a.sourceBuildVerified,false);
 assert.equal(a.writerAuthorized,false);
});

test('invalid or injected audit rows fail closed before producing a misleading summary',()=>{
 const s=snapshot(fixture());
 const row=s.rows[0];
 for(const bad of [
  {...s,rows:[...s.rows,{...row}]},
  {...s,rows:[{...row,writeAuthorized:true}]},
  {...s,rows:[{...row,tab:'unrecognized'}]},
  {...s,rows:[{...row,status:'REPAIRED'}]},
  {...s,rows:[{...row,pointer:'../outside'}]}
 ])assert.throws(()=>auditTimingSnapshot(bad,{now:NOW}));
 assert.throws(()=>auditTimingSnapshot(s,{now:NaN}));
});
