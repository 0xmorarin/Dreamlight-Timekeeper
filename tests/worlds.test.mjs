import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {indexEvents,worldForEventName,projectProfile,previewScope,WORLD_ORDER} from '../src/reader.mjs';
const data=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const registry=indexEvents(data);
const item=(id,variant='ItemSpawning')=>({[variant]:{RecurringEventItemID:id,NextOccurrence:'2026-11-01T12:00:00Z'}});
const profile=events=>({GameInfo:{Version:626,LastCustomIdOwner:'Synthetic'},Player:{Name:'Fixture'},World:{RecurringEvents:Object.fromEntries(events.map((e,i)=>[i,e]))}});
test('all three DLC and embedded-prefix event IDs map to their source region',()=>{
  const counts={exp1:0,exp2:0,exp3:0};
  for(const event of data.events){const m=event.name.match(/Expansion0([1-3])/);if(m){const world=worldForEventName(event.name);assert.equal(world,`exp${m[1]}`);counts[world]++;}}
  assert.deepEqual(counts,{exp1:89,exp2:78,exp3:99});
  assert.equal(worldForEventName(registry.get(2010000164).name),'exp1');
  assert.equal(worldForEventName(registry.get(2010000174).name),'exp2');
});
test('only worlds with saved events are offered and ownership flags are ignored',()=>{
  const p=profile([item(2010000003),item(2010000164),item(2011300000,'SnippetSpawning'),item(2010000064)]);
  p.GameInfo.ExpansionOwnership={Expansion01:false,Expansion02:false,Expansion03:true};
  const out=projectProfile(p,registry);
  assert.deepEqual(out.worlds.map(x=>x.id),['valley','exp1','exp2']);
  assert.equal(out.worlds.some(x=>x.id==='exp3'),false);
  assert.equal(out.rows.find(x=>x.id===2010000164).world,'exp1');
  assert.equal(out.rows.find(x=>x.id===2011300000).world,'exp2');
  assert(out.rows.every(x=>x.writeAuthorized===false));
});
test('all three expansions show up when their native event data is saved',()=>{
  const ids=[2010000003,2010000164,2011300000,registry.get(2010000174).id, data.events.find(e=>e.name.startsWith('Expansion03!')).id];
  const types=['ItemSpawning','ItemSpawning','SnippetSpawning','ItemSpawning','ItemSpawning'];
  const snapshot=projectProfile(profile(ids.map((x,i)=>item(x,types[i]))),registry);
  assert.deepEqual(snapshot.worlds.map(x=>x.id),['valley','exp1','exp2','exp3']);
  assert.equal(snapshot.rows.length,5);
});
test('per-world and visible-row subset previews never include other DLCs or modify input',()=>{
  const p=profile([item(2010000003),item(2010000164),item(2011300000,'SnippetSpawning')]);
  const before=JSON.stringify(p);const snapshot=projectProfile(p,registry);
  const result=previewScope(snapshot,{tab:'spawn',world:'exp2',mode:'now',now:Date.parse('2026-11-01T15:00:00Z')});
  assert.equal(result.affected.length,1);
  assert.equal(result.affected[0].id,2011300000);
  const none=previewScope(snapshot,{tab:'spawn',world:'exp2',pointers:[],mode:'now'});
  assert.equal(none.affected.length,0);
  assert.equal(JSON.stringify(p),before);
});
test('unregistered event stays read-only with unknown world',()=>{
  const out=projectProfile(profile([item(999777111)]),registry);
  assert.deepEqual(out.worlds.map(x=>x.id),['unknown']);
  assert.equal(out.rows[0].policy,'HOLD');
  assert.equal(out.rows[0].writeAuthorized,false);
  assert.equal(WORLD_ORDER.length,6);
});
