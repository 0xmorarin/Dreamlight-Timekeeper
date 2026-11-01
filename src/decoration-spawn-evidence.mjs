import {auditWandWoodTagsInEvents} from './wand-wood-tag-evidence.mjs';
import {decodeStructuredItemId} from './item-id-structure.mjs';
// Version-scoped research projection. This is not a runtime spawn GridObject classifier.
const SOURCE=Object.freeze({
 version:'1.25.3', buildId:'9A239D3DB569756D',schema:626,
 rawEventSHA256:'028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea'
});
const WOOD_MATERIAL_ITEM_IDS=new Set([
 31700002, // Dark Wood
 31700003, // Dry Wood
 31700008, // Hardwood
 31700014, // Softwood
 31700038, // Tropical Wood
 31700156  // Reclaimed Barn Wood
]);
const FAMILY=Object.freeze({
 OBSTACLE:'OBSTACLE_EVENT',
 WILD_PLANT:'WILD_PLANT_EVENT',
 FLOWER:'FLOWER_EVENT',
 WOOD:'WOOD_MATERIAL_EVENT',
 OTHER_FORAGE:'OTHER_FORAGE_EVENT',
 EXCLUDED:'NOT_PRIMARY_DECORATION_EVENT'
});
const idOK=id=>Number.isSafeInteger(id)&&id>0;
const tryShape=value=>{try{return decodeStructuredItemId(value);}catch{return null;}};
const linked=rec=>Array.isArray(rec.items)&&rec.items.length>0&&
 rec.items.every(x=>x&&idOK(x.id)&&tryShape(x.id)!==null);
const allShape=(records,predicate)=>records.every(x=>{const shape=tryShape(x.id);return shape!==null&&predicate(shape);});
const activity=(type,subtype)=>x=>x.itemType===type&&x.subtype===subtype;

export function classifyDecorationSpawnEvent(record,woodTagStatus=null){
 if(!record||!idOK(record.id)||typeof record.name!=='string')throw new Error('Unrecognized event record.');
 let family=FAMILY.EXCLUDED;
 // W1 is a *static review tag only*, not proof of writable or removable state.
 if(record.tab==='spawn'&&record.eventPolicy==='W1'&&linked(record)){
  if(record.group==='障害物'&&['闇のトゲ','障害物（種類別）'].includes(record.subgroup)&&
   allShape(record.items,x=>(x.itemType===3&&x.subtype===13)||(x.itemType===4&&x.subtype===6)))family=FAMILY.OBSTACLE;
  else if(record.group==='野生植物'&&record.subgroup==='ハーブ・スパイス・野生作物'&&
   allShape(record.items,activity(3,4)))family=FAMILY.WILD_PLANT;
  else if(record.group==='花'&&record.subgroup==='花の生成'&&
   allShape(record.items,activity(3,8)))family=FAMILY.FLOWER;
  else if(record.group==='自然資源'&&record.subgroup==='木材・落下素材'){
   // Explicit source-byte-verified Gameplay isWood evidence supersedes a
   // historical hand-curated material list; unknown IDs remain protected.
   const supported=woodTagStatus==='IS_WOOD_TAG'||woodTagStatus==='NOT_WOOD_TAG';
   const legacy=record.items.every(item=>WOOD_MATERIAL_ITEM_IDS.has(item.id))&&
    allShape(record.items,activity(3,17));
   family=woodTagStatus==='UNKNOWN_ITEM_TAG'?FAMILY.EXCLUDED:
    supported?(woodTagStatus==='IS_WOOD_TAG'?FAMILY.WOOD:FAMILY.OTHER_FORAGE):
    (legacy?FAMILY.WOOD:FAMILY.OTHER_FORAGE);
  }
 }
 const primary=[FAMILY.OBSTACLE,FAMILY.WILD_PLANT,FAMILY.FLOWER,FAMILY.WOOD].includes(family);
 return Object.freeze({
  eventId:record.id,eventName:record.name,family,primaryDecorationResearch:primary,
  definitionActive:record.active===true,activeSourceReviewCandidate:primary&&record.active===true,
  sourceEventPolicy:record.eventPolicy??'UNKNOWN',
  linkedItemIds:Object.freeze((record.items||[]).filter(x=>idOK(x.id)).map(x=>x.id)),
  linkedItemNumericKinds:Object.freeze((record.items||[]).filter(x=>idOK(x.id)).map(x=>{
   const d=tryShape(x.id);return Object.freeze({itemType:d?.itemType??null,subtype:d?.subtype??null,
    numericStructureVerified:d!==null});
  })),
  linkedItemIsPlacedGridObjectVerified:false,
  runtimeSpawnAndRemovalVerified:false,writerAuthorized:false,bulkDeletionAuthorized:false
 });
}
export function compileDecorationSpawnEvidence(document,{woodTagPack=null}={}){
 if(!document?.source||!Array.isArray(document.events)||
   document.source.writerAuthorization!==false||
   document.source.version!==SOURCE.version||
   document.source.buildId!==SOURCE.buildId||
   document.source.schema!==SOURCE.schema||
   document.source.rawEventSHA256!==SOURCE.rawEventSHA256||
   document.events.length!==508)throw new Error('Source or event denominator differs from v1.25.3 research.');
 const woodStatuses=woodTagPack===null?null:new Map(
  auditWandWoodTagsInEvents(document,woodTagPack).rows.map(x=>[x.eventId,x.status]));
 const rows=document.events.map(r=>classifyDecorationSpawnEvent(r,woodStatuses?.get(r.id)));
 if(new Set(rows.map(r=>r.eventId)).size!==508)throw new Error('Duplicate event identity.');
 const counts=Object.fromEntries(Object.values(FAMILY).map(x=>[x,0]));
 const activeCounts=Object.fromEntries(Object.values(FAMILY).map(x=>[x,0]));
 for(const r of rows){counts[r.family]++;if(r.definitionActive)activeCounts[r.family]++;}
 return Object.freeze({
  source:Object.freeze({...SOURCE,sourceRecordCount:508,
   status:woodTagPack===null?'STATIC_SOURCE_PROJECTION':'BYTE_VERIFIED_WOOD_TAG_PROJECTION',
   writeAuthorization:false,deleteAuthorization:false}),
  counts:Object.freeze(counts),activeCounts:Object.freeze(activeCounts),
  rows:Object.freeze(rows.sort((a,b)=>a.eventId-b.eventId))
 });
}
