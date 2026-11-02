import assert from 'node:assert/strict';
import test from 'node:test';
import {createTimingDraft} from '../src/core/timing-draft.mjs';

const snapshot=()=>({capabilities:{editingAllowed:false,exportEditedAllowed:false},
 rows:[
  {pointer:'/World/RecurringEvents/1/ItemSpawning/NextOccurrence',time:'2126-08-20T00:00:00Z',kind:'ItemSpawning',source:'World.RecurringEvents',review:{status:'HOLD_2126_UNKNOWN'}},
  {pointer:'/World/RecurringEvents/2/FlowerSpawningInVillage/NextOccurrence',time:'2026-11-02T00:00:00Z',kind:'FlowerSpawningInVillage',source:'World.RecurringEvents',review:{status:'RESEARCH_CANDIDATE'}},
  {pointer:'/World/Stores/0/LastRefresh',time:null,kind:'StoreInfo.LastRefresh',source:'World.Stores'}
 ]});
test('read-only multi-field staging preserves snapshot and supports undo redo and restore-to-original',()=>{
 const s=snapshot(),before=JSON.stringify(s),p=s.rows.map(x=>x.pointer),draft=createTimingDraft(s);
 const v=draft.stage(p.slice(0,2),'2126-11-02T12:00:00.000Z');
 assert.equal(v.count,2);assert.equal(v.exportAvailable,false);
 assert.equal(v.writerAuthorized,false);assert.equal(v.entries[0].writerAuthorized,false);
 assert.equal(draft.undo().count,0);
 assert.equal(draft.redo().count,2);
 assert.equal(draft.stage([p[0]],s.rows[0].time).count,1);
 assert.equal(draft.undo().count,2);
 assert.equal(draft.clear().count,0);
 assert.equal(JSON.stringify(s),before);
 assert.throws(()=>v.entries.push({}),TypeError);
});
test('invalid time and unknown/duplicate selected paths fail without partial draft changes',()=>{
 const s=snapshot(),p=s.rows.map(x=>x.pointer),draft=createTimingDraft(s);
 draft.stage([p[0]],'2126-11-02T12:00:00Z');
 for(const [paths,time] of [
  [[p[0],p[0]],'2026-11-02T00:00:00Z'],
  [[p[1],'/unknown/path'],'2026-11-02T00:00:00Z'],
  [[p[1],p[2]],'2026-11-02T00:00:00Z'],
  [[p[1]],'2026-02-30T00:00:00Z'],
  [[p[1]],'2026-11-02T00:00:00+09:00']
 ])assert.throws(()=>draft.stage(paths,time));
 assert.equal(draft.view().count,1);
 assert.equal(draft.view().canRedo,false);
});
test('safe preview capacity, no-op and redo invalidation',()=>{
 const s=snapshot(),p=s.rows[0].pointer,draft=createTimingDraft(s,{maxHistory:1});
 assert.equal(draft.stage([p],s.rows[0].time).canUndo,false);
 draft.stage([p],'2127-01-01T00:00:00Z');
 draft.stage([p],'2128-01-01T00:00:00Z');
 assert.equal(draft.undo().entries[0].targetTime,'2127-01-01T00:00:00Z');
 draft.stage([p],'2129-01-01T00:00:00Z');
 assert.equal(draft.view().canRedo,false);
 assert.throws(()=>createTimingDraft(s,{maxEntries:2}));
 assert.throws(()=>createTimingDraft({...s,capabilities:{editingAllowed:true,exportEditedAllowed:false}}));
 assert.throws(()=>createTimingDraft({...s,rows:[...s.rows,s.rows[0]]}));
});
