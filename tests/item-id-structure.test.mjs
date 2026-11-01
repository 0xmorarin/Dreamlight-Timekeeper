import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {decodeStructuredItemId,verifyItemDefinitionIdentity} from '../src/item-id-structure.mjs';

const eventPack=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
test('01D ItemID arithmetic encodes item type, subtype and local index separately',()=>{
 assert.deepEqual(
  Object.fromEntries(Object.entries(decodeStructuredItemId(31700014)).filter(([k])=>
   ['itemId','itemType','index','subtype','subtypeIndex'].includes(k))),
  {itemId:31700014,itemType:3,index:1700014,subtype:17,subtypeIndex:14});
 assert.equal(decodeStructuredItemId('31700014').itemId,31700014);
 assert.equal(decodeStructuredItemId(30400121).subtype,4);
 assert.equal(decodeStructuredItemId(30800139).subtype,8);
 assert.equal(decodeStructuredItemId(31300003).subtype,13);
 assert.equal(decodeStructuredItemId(40600448).itemType,4);
 assert.equal(decodeStructuredItemId(2050500023).itemType,205);
 assert.equal(decodeStructuredItemId(2050500023).subtype,5);
});
test('matching numeric subtype alone cannot distinguish wood from pinecones or moss',()=>{
 for(const itemId of [31700014,31700131,31700121]){
  const shape=decodeStructuredItemId(itemId);
  assert.equal(shape.itemType,3);
  assert.equal(shape.subtype,17);
  assert.equal(shape.classification,'NUMERIC_ONLY');
  assert.equal(shape.semanticVerified,false);
  assert.equal(shape.writerAuthorized,false);
 }
});
test('validated same-version definitions must agree on all numeric identity components',()=>{
 const definition={itemId:31700014,itemType:3,index:1700014,subtype:17,
  concreteItemDataType:'SyntheticItemData'};
 assert.equal(verifyItemDefinitionIdentity(31700014,definition).classification,
  'VERSIONED_DEFINITION_MATCH');
 for(const bad of [
  {...definition,itemId:31700015},
  {...definition,itemType:4},
  {...definition,index:1700013},
  {...definition,subtype:18},
  {...definition,concreteItemDataType:''},
  {...definition,concreteItemDataType:null}
 ])assert.throws(()=>verifyItemDefinitionIdentity(31700014,bad));
});
test('invalid or ambiguous numeric IDs are refused without signed overflow or truncation',()=>{
 for(const id of [0,-1,1.25,NaN,Infinity,'001','1e8','31.7','','0',
  9007199254740992,'9007199254740992',null,{},true]){
  assert.throws(()=>decodeStructuredItemId(id));
 }
});
test('all v1.25.3 event-pack item links are structurally decomposable without false labels',()=>{
 const ids=[...new Set(eventPack.events.flatMap(x=>x.items.map(y=>y.id)))];
 assert.equal(eventPack.events.length,508);
 assert.equal(ids.length,244);
 for(const itemId of ids){
  const shape=decodeStructuredItemId(itemId);
  assert.equal(shape.itemId,itemId);
  assert.equal(shape.itemType*10000000+shape.index,itemId);
  assert.equal(shape.subtype*100000+shape.subtypeIndex,shape.index);
  assert.equal(shape.semanticVerified,false);
 }
});
