import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {auditWandWoodTagsInEvents} from '../src/wand-wood-tag-evidence.mjs';
const source=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const tagPack=JSON.parse(await readFile(new URL('../data/wand-iswood-crosswalk-v1253.json',import.meta.url),'utf8'));
test('v1.25.3 byte-preserved isWood tags classify 40 of 52 forage event definitions',()=>{
 const beforeSource=JSON.stringify(source),beforePack=JSON.stringify(tagPack);
 const a=auditWandWoodTagsInEvents(source,tagPack);
 assert.equal(a.eventCount,52);
 assert.equal(a.tagged,40);
 assert.equal(a.untagged,12);
 assert.equal(a.unresolved,0);
 assert.equal(a.writeAuthorized,false);
 assert.equal(a.deleteAuthorized,false);
 for(const x of a.rows){
  assert.equal(x.writeAuthorized,false);
  assert.equal(x.deleteAuthorized,false);
  assert.equal(x.storedGridObjectVerified,false);
 }
 const row=id=>a.rows.find(x=>x.eventId===id);
 assert.equal(row(2010000021).status,'IS_WOOD_TAG'); // softwood
 assert.equal(row(2010000140).status,'IS_WOOD_TAG'); // pine cone
 assert.equal(row(2010000196).status,'IS_WOOD_TAG'); // copter seeds
 assert.equal(row(2010000207).status,'IS_WOOD_TAG'); // oak leaves
 assert.equal(row(2010000113).status,'NOT_WOOD_TAG'); // cinnamon
 assert.equal(row(2010000137).status,'NOT_WOOD_TAG'); // moss
 assert.equal(JSON.stringify(source),beforeSource);
 assert.equal(JSON.stringify(tagPack),beforePack);
});
test('incomplete, altered or unreviewed crosswalk fails closed',()=>{
 const x=structuredClone(tagPack);
 x.sourceTagSha256BothVersions='0'.repeat(64);
 assert.throws(()=>auditWandWoodTagsInEvents(source,x));
 const y=structuredClone(tagPack);
 y.items[0].payloadSha256='invalid';
 assert.throws(()=>auditWandWoodTagsInEvents(source,y));
 const z=structuredClone(tagPack);
 z.items[1].id=z.items[0].id;
 assert.throws(()=>auditWandWoodTagsInEvents(source,z));
 const s=structuredClone(source);
 s.source.rawEventSHA256='0'.repeat(64);
 assert.throws(()=>auditWandWoodTagsInEvents(s,tagPack));
});
test('unknown new item IDs do not inherit wood status from numeric subtype',()=>{
 const s=structuredClone(source);
 const event=s.events.find(x=>x.id===2010000021);
 event.items=[{id:31799999}];
 const a=auditWandWoodTagsInEvents(s,tagPack);
 assert.equal(a.unresolved,1);
 assert.equal(a.tagged,39);
 assert.equal(a.rows.find(x=>x.eventId===2010000021).status,'UNKNOWN_ITEM_TAG');
 assert.equal(a.deleteAuthorized,false);
});
