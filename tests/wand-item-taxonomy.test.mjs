import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWandItemTaxonomy,resolveWandItemTaxonomy} from '../src/wand-item-taxonomy.mjs';

const entries=[
 [31700014,3,17,'ActivityItem','CraftingMaterial','ActivityItemData','ActivityItem','Basic!SoftWood','68555b8075d75593208f2bfaed5bacfac688519e337164a023342169aca753d2'],
 [31700131,3,17,'ActivityItem','CraftingMaterial','ActivityItemData','ActivityItem','Basic!Expansion02!Pinecone','e252390a9673d752a205fb3483e139585536abbe432b7ce8369aacb03d296703'],
 [31700121,3,17,'ActivityItem','CraftingMaterial','ActivityItemData','ActivityItem','Basic!Expansion02!Moss','c7e53e35f92397932800d72f95f9f0d41b402f149d493ce8c8c706ccad0b3f43'],
 [30400121,3,4,'ActivityItem','Seed','SeedItemData','ActivityItem','WildCrop!Oregano_Seed','d3a725b0841717e820e1b1a66ba75a92c38bba6bad0caeaa99cbec6a7c03ea2c'],
 [30800059,3,8,'ActivityItem','Flower','FlowerItemData','ActivityItem','Dandelion!DandelionYellow','f2378a3767fa5644ab5ae2d6b2119eb16e02919e6921265a509c40478b1f28ab'],
 [31300003,3,13,'ActivityItem','Ephemeral','EphemeralItemData','ActivityItem','Generic!NightThorn_Small1','1c4af09b2d5ff46165052a6d58af001968a010474ba304134810f04df92188f6'],
 [40600010,4,6,'Furniture','Blocker','FurnitureBlockerItemData','Furniture','Pickaxe!Coral_Big','d1d1043df1a519b4c77f1bea50427a8743c473417d5b30bc0916561358e194a1'],
 [31400039,3,14,'ActivityItem','LootPresent','LootPresentItemData','ActivityItem','LootPresentForagingOnline','6339f09d98e00d75e1c87223220c917f2a18ac94755a5bc1e3284b7e330654e5'],
 [120200000,12,2,'Companion','Snippet','SnippetItemData','Companion','Bird!SnippetBird01','6f91ec6aea816c3e4c04eeeaa8fd10531c93a7435a9e0bcb08ec570e3ce0615c']
];
const items=entries.map(([itemID,itemType,subtype,itemTypeName,subtypeName,concreteType,sourceCategory,internalName,rawPayloadSha256])=>({
 itemID,itemType,subtype,itemTypeName,subtypeName,concreteType,
 sourceCategory,internalName,rawPayloadSha256
}));
const fixture=()=>({artifact:'DDV_GAME_QUERY_INDEX',platform:'Nintendo Switch',
 gameVersion:'1.25.0',buildID:'52BD625D9B4E0053',
 coverage:{items:items.length},items:structuredClone(items)});
const catalog=()=>buildWandItemTaxonomy(fixture(),{
 expectedVersion:'1.25.0',expectedBuildId:'52BD625D9B4E0053',expectedItems:9
});
test('typed 01D records resolve by ItemID and concrete subtype but not source provenance',()=>{
 const c=catalog();
 assert.equal(c.definitionCount,9);assert.equal(c.numericFamilyCount,7);
 assert.equal(Object.isFrozen(c),true);
 assert.equal('itemsById' in c,false);
 const wood=resolveWandItemTaxonomy(31700014,c,{saveGameVersion:'1.25.0'});
 assert.equal(wood.basis,'EXACT_VERSION_ITEM_DEFINITION');
 assert.equal(wood.subtypeName,'CraftingMaterial');
 assert.equal(wood.concreteItemDataType,'ActivityItemData');
 assert.equal(wood.sameVersionDefinitionConfirmed,true);
 assert.equal(wood.writeAuthorized,false);assert.equal(wood.deleteAuthorized,false);
 assert.equal(wood.spawnedGridObjectVerified,false);
 for(const id of [31700131,31700121]){
  const result=resolveWandItemTaxonomy(id,c,{saveGameVersion:'1.25.0'});
  assert.equal(result.subtypeName,wood.subtypeName);
  assert.equal(result.concreteItemDataType,wood.concreteItemDataType);
  assert.notEqual(result.internalName,wood.internalName);
  assert.equal(result.deleteAuthorized,false);
 }
 assert.equal(resolveWandItemTaxonomy(40600010,c,{saveGameVersion:'1.25.0'}).concreteItemDataType,
  'FurnitureBlockerItemData');
});
test('newer save uses old definition only as historical evidence, never an edit grant',()=>{
 const c=catalog();
 const known=resolveWandItemTaxonomy(31700014,c,{saveGameVersion:'1.25.3'});
 assert.equal(known.basis,'HISTORICAL_ITEM_DEFINITION');
 assert.equal(known.sameVersionDefinitionConfirmed,false);
 const newInKnown=resolveWandItemTaxonomy(31709999,c,{saveGameVersion:'1.25.3'});
 assert.equal(newInKnown.basis,'NUMERIC_FAMILY_ONLY');
 assert.equal(newInKnown.itemTypeName,'ActivityItem');
 assert.equal(newInKnown.subtypeName,'CraftingMaterial');
 assert.equal(newInKnown.concreteItemDataType,null);
 assert.equal(newInKnown.individualItemDefinitionConfirmed,false);
 assert.equal(newInKnown.writeAuthorized,false);
 const newFamily=resolveWandItemTaxonomy(90999999,c,{saveGameVersion:'1.25.3'});
 assert.equal(newFamily.basis,'UNKNOWN_NUMERIC_FAMILY');
 assert.equal(newFamily.itemTypeName,null);
 assert.equal(newFamily.deleteAuthorized,false);
});
test('source shape, duplicates and numeric namespace conflicts fail closed',()=>{
 assert.throws(()=>buildWandItemTaxonomy({...fixture(),buildID:'unexpected'},
  {expectedBuildId:'52BD625D9B4E0053'}));
 assert.throws(()=>buildWandItemTaxonomy({...fixture(),coverage:{items:2}}));
 assert.throws(()=>buildWandItemTaxonomy({...fixture(),items:[...items,items[0]],
  coverage:{items:10}}));
 const malformed=fixture();malformed.items[0].subtype=16;
 assert.throws(()=>buildWandItemTaxonomy(malformed));
 const conflicting=fixture();conflicting.items[1].concreteType='UnknownNewKind';
 assert.throws(()=>buildWandItemTaxonomy(conflicting));
 const forged=Object.freeze({version:'1.25.0',itemsById:new Map()});
 assert.throws(()=>resolveWandItemTaxonomy(31700014,forged));
});
