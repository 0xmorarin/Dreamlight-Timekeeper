// Wand 01D/Phase1 verified DDV ItemID encoding (Switch v1.24.13/v1.25.0).
// Numeric structure can be decoded on newer saves, but enum names, concrete ItemData,
// provenance and any editor permission MUST come from a same-version definition pack.
export const DDV_ITEM_ID_LAYOUT=Object.freeze({
 typeMultiplier:10000000,subtypeMultiplier:100000,subtypeIndexLimit:100000
});
const positiveInteger=v=>{
 if(typeof v==='number')return Number.isSafeInteger(v)&&v>0?v:null;
 if(typeof v==='string'&&/^[1-9][0-9]*$/.test(v)){
  const n=Number(v);
  return Number.isSafeInteger(n)&&n>0?n:null;
 }
 return null;
};
export function decodeStructuredItemId(value){
 const itemId=positiveInteger(value);
 if(itemId===null)throw new Error('Invalid decimal ItemID.');
 const {typeMultiplier,subtypeMultiplier}=DDV_ITEM_ID_LAYOUT;
 const itemType=Math.floor(itemId/typeMultiplier);
 const index=itemId%typeMultiplier;
 if(itemType<1||index<0)throw new Error('Invalid structured ItemID domain.');
 return Object.freeze({
  itemId,itemType,index,subtype:Math.floor(index/subtypeMultiplier),
  subtypeIndex:index%subtypeMultiplier,
  classification:'NUMERIC_ONLY',semanticVerified:false,writerAuthorized:false
 });
}
// Source-typed resolver: supplied definitions come from Wand 01D verified same-version
// Game DB, never from a guessed prefix or an unchecked local dictionary.
export function verifyItemDefinitionIdentity(value,definition){
 const shape=decodeStructuredItemId(value);
 if(definition===null||typeof definition!=='object'||Array.isArray(definition)||
  !Number.isSafeInteger(definition.itemId)||
  !Number.isSafeInteger(definition.itemType)||
  !Number.isSafeInteger(definition.index)||
  !Number.isSafeInteger(definition.subtype)||
  typeof definition.concreteItemDataType!=='string'||!definition.concreteItemDataType.trim())
  throw new Error('Incomplete versioned item definition.');
 if(shape.itemId!==definition.itemId||shape.itemType!==definition.itemType||
   shape.index!==definition.index||shape.subtype!==definition.subtype)
  throw new Error('ItemID disagrees with versioned Game DB identity.');
 return Object.freeze({
  ...shape,classification:'VERSIONED_DEFINITION_MATCH',
  concreteItemDataType:definition.concreteItemDataType,
  // A matching definition does NOT establish in-save source, ownership or placement.
  semanticVerified:false,writerAuthorized:false
 });
}
