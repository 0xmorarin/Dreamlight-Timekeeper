import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {classifyDecorationSpawnEvent,compileDecorationSpawnEvidence} from '../src/decoration-spawn-evidence.mjs';

const raw=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const result=compileDecorationSpawnEvidence(raw);
const byId=id=>result.rows.find(x=>x.eventId===id);

test('508 native-source events have bounded, read-only decorating classifications',()=>{
 assert.equal(result.rows.length,508);
 assert.equal(result.counts.OBSTACLE_EVENT,76);
 assert.equal(result.counts.WILD_PLANT_EVENT,38);
 assert.equal(result.counts.FLOWER_EVENT,157);
 assert.equal(result.counts.WOOD_MATERIAL_EVENT,31);
 assert.equal(result.counts.OTHER_FORAGE_EVENT,21);
 assert.equal(result.counts.NOT_PRIMARY_DECORATION_EVENT,185);
 assert.equal(result.rows.filter(r=>r.primaryDecorationResearch).length,302);
 assert.equal(result.source.writeAuthorization,false);
 assert.equal(result.source.deleteAuthorization,false);
 for(const r of result.rows){
  assert.equal(r.writerAuthorized,false);assert.equal(r.bulkDeletionAuthorized,false);
  assert.equal(r.linkedItemIsPlacedGridObjectVerified,false);
  assert.equal(r.runtimeSpawnAndRemovalVerified,false);
 }
});
test('exact source event IDs and linked item IDs belong to different namespaces',()=>{
 assert.deepEqual(byId(2010000003).linkedItemIds,[31300003,31300004,31300005,31300006]);
 assert.equal(byId(2010000003).family,'OBSTACLE_EVENT');
 assert.equal(byId(2010400001).family,'WILD_PLANT_EVENT');
 assert.deepEqual(byId(2010400001).linkedItemIds,[30400121]);
 assert.equal(byId(2010500008).family,'FLOWER_EVENT');
});
test('wood and branch research isolates actual wood material source events from other forage',()=>{
 assert.equal(byId(2010000021).family,'WOOD_MATERIAL_EVENT');
 assert.deepEqual(byId(2010000021).linkedItemIds,[31700014]);
 assert.equal(byId(2010000079).family,'WOOD_MATERIAL_EVENT');
 assert.deepEqual(byId(2010000079).linkedItemIds,[31700002]);
 assert.equal(byId(2010000180).family,'WOOD_MATERIAL_EVENT');
 assert.deepEqual(byId(2010000180).linkedItemIds,[31700156]);
 assert.equal(byId(2010000113).family,'OTHER_FORAGE_EVENT'); // cinnamon despite Wood! name
 assert.deepEqual(byId(2010000113).linkedItemIds,[30200147]);
 assert.equal(byId(2010000138).family,'OTHER_FORAGE_EVENT'); // mussel
 assert.equal(byId(2010000140).family,'OTHER_FORAGE_EVENT'); // pinecone
});
test('excluded controls and Moonstone Chest cannot inherit bulk deletion permission',()=>{
 assert.equal(byId(2010000064).family,'NOT_PRIMARY_DECORATION_EVENT');
 assert.equal(byId(2010000064).bulkDeletionAuthorized,false);
 assert.equal(byId(2010600000).family,'NOT_PRIMARY_DECORATION_EVENT');
 assert.equal(byId(2010700000).family,'NOT_PRIMARY_DECORATION_EVENT');
});
test('unknown inactive or evidence-regressed source does not gain decoration classification',()=>{
 const datum={...raw.events.find(e=>e.id===2010000021)};
 assert.equal(classifyDecorationSpawnEvent({...datum,active:false}).primaryDecorationResearch,false);
 assert.equal(classifyDecorationSpawnEvent({...datum,eventPolicy:'W2'}).primaryDecorationResearch,false);
 assert.equal(classifyDecorationSpawnEvent({...datum,items:[]}).primaryDecorationResearch,false);
 assert.equal(classifyDecorationSpawnEvent({...datum,items:[{id:99999}]}).family,'OTHER_FORAGE_EVENT');
 for(const invalid of [
  {...raw,source:{...raw.source,buildId:'OTHER'}},
  {...raw,source:{...raw.source,rawEventSHA256:'unrecognized'}},
  {...raw,events:raw.events.slice(1)},
  {...raw,events:[...raw.events.slice(0,-1),raw.events[0]]}
 ])assert.throws(()=>compileDecorationSpawnEvidence(invalid));
});
