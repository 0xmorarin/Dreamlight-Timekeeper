import {decodeStructuredItemId} from './item-id-structure.mjs';

// Consumer for a verified Wand 01D query projection. This module does not
// duplicate the original Game DB and never confers any write/delete authority.
const fullString=s=>typeof s==='string'&&s.length>0;
const named=s=>s===null||fullString(s);
const key=(type,subtype)=>`${type}:${subtype}`;
const validatedMaps=new WeakMap();
export function buildWandItemTaxonomy(query,{expectedVersion,expectedBuildId,expectedItems}={}){
 if(!query||query.artifact!=='DDV_GAME_QUERY_INDEX'||query.platform!=='Nintendo Switch'||
    !fullString(query.gameVersion)||!fullString(query.buildID)||
    (expectedVersion!==undefined&&expectedVersion!==query.gameVersion)||
    (expectedBuildId!==undefined&&expectedBuildId!==query.buildID)||
    !Array.isArray(query.items)||!Number.isSafeInteger(query.coverage?.items)||
    query.coverage.items!==query.items.length||
    (expectedItems!==undefined&&expectedItems!==query.items.length))
   throw new Error('Wand Game DB provenance or coverage mismatched.');
 const itemsById=new Map(),familiesByKey=new Map();
 for(const item of query.items){
  const numeric=decodeStructuredItemId(item?.itemID);
  if(item.itemType!==numeric.itemType||item.subtype!==numeric.subtype||
    !fullString(item.itemTypeName)||!named(item.subtypeName)||
    !fullString(item.concreteType)||
    !fullString(item.sourceCategory)||
    !fullString(item.rawPayloadSha256)||
    !/^[0-9a-f]{64}$/.test(item.rawPayloadSha256)||
    itemsById.has(numeric.itemId))
   throw new Error('Unverified or duplicate Wand item definition.');
  const k=key(numeric.itemType,numeric.subtype);
  const existing=familiesByKey.get(k);
  const descriptor={itemType:numeric.itemType,subtype:numeric.subtype,
    itemTypeName:item.itemTypeName,subtypeName:item.subtypeName,
    concreteType:item.concreteType};
  if(existing&&(existing.itemTypeName!==descriptor.itemTypeName||
    existing.subtypeName!==descriptor.subtypeName||
    existing.concreteType!==descriptor.concreteType))
   throw new Error('Same numeric namespace has conflicting type metadata.');
  if(!existing)familiesByKey.set(k,Object.freeze(descriptor));
  itemsById.set(numeric.itemId,Object.freeze({
   ...descriptor,itemId:numeric.itemId,index:numeric.index,
   itemRawSha256:item.rawPayloadSha256,internalName:fullString(item.internalName)?item.internalName:null
  }));
 }
 // Do not expose mutable Maps as public API or a forged source descriptor.
 const catalog=Object.freeze({version:query.gameVersion,buildId:query.buildID,
  definitionCount:itemsById.size,numericFamilyCount:familiesByKey.size});
 validatedMaps.set(catalog,{itemsById,familiesByKey});
 return catalog;
}
export function resolveWandItemTaxonomy(value,catalog,{saveGameVersion=null}={}){
 const maps=catalog&&validatedMaps.get(catalog);
 if(!maps||!fullString(catalog.version))throw new Error('Wand taxonomy has not been validated.');
 const numeric=decodeStructuredItemId(value);
 const family=maps.familiesByKey.get(key(numeric.itemType,numeric.subtype));
 const record=maps.itemsById.get(numeric.itemId);
 const exact=saveGameVersion===catalog.version;
 const basis=record?(exact?'EXACT_VERSION_ITEM_DEFINITION':'HISTORICAL_ITEM_DEFINITION'):
    family?'NUMERIC_FAMILY_ONLY':'UNKNOWN_NUMERIC_FAMILY';
 return Object.freeze({
  ...numeric,basis,sourceVersion:catalog.version,sourceBuildId:catalog.buildId,
  itemTypeName:family?.itemTypeName??null,
  subtypeName:family?.subtypeName??null,
  concreteItemDataType:record?.concreteType??null,
  internalName:record?.internalName??null,
  definitionSha256:record?.itemRawSha256??null,
  sameVersionDefinitionConfirmed:exact&&!!record,
  individualItemDefinitionConfirmed:!!record,
  // An older-version definition / exact typed match never proves source, native
  // spawn lifecycle, object placement, or an eligible save writer transaction.
  spawnedGridObjectVerified:false,writeAuthorized:false,deleteAuthorized:false
 });
}
