// Research-only exact ItemID matching. A matching world object is not proof of spawn provenance.
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>{
 const raw=typeof value==='number'?String(value):value;
 if(typeof raw!=='string'||!/^[1-9]\d*$/.test(raw))return null;
 const n=Number(raw);return Number.isSafeInteger(n)?n:null;
};
export function auditDecorationGridItemMatches(profile,source,{maxGrids=10000,maxObjects=250000}={}){
 const world=profile?.World;
 if(!isObject(world)||!isObject(world.GridCollection?.Grids)||!Array.isArray(world.Villages)||
  !source||source.source?.writeAuthorization!==false||
  source.source?.deleteAuthorization!==false||!Array.isArray(source.rows))
  throw new Error('Unrecognized read-only Grid audit input.');
 const byItem=new Map();
 for(const row of source.rows){
  if(row.writerAuthorized!==false||row.bulkDeletionAuthorized!==false||!Array.isArray(row.linkedItemIds))
   throw new Error('Grid audit source unexpectedly claims write authority.');
  if(!row.primaryDecorationResearch)continue;
  for(const itemId of row.linkedItemIds){
   if(!id(itemId))throw new Error('Invalid linked ItemID.');
   if(!byItem.has(itemId))byItem.set(itemId,[]);
   byItem.get(itemId).push(Object.freeze({eventId:row.eventId,
    family:row.family,definitionActive:row.definitionActive}));
  }
 }
 const direct=new Map();
 for(const [villageIndex,village] of world.Villages.entries()){
  if(!isObject(village)||!isObject(village.Areas))continue;
  for(const [areaId,area] of Object.entries(village.Areas)){
   if(!isObject(area)||!Array.isArray(area.GridIDs))continue;
   for(const rawId of area.GridIDs){
    const gridId=id(rawId);if(gridId===null)continue;
    if(!direct.has(gridId))direct.set(gridId,[]);
    direct.get(gridId).push({villageIndex,areaId});
   }
  }
 }
 if(direct.size>maxGrids)throw new Error('Area Grid reference limit exceeded.');
 const savedGrids=world.GridCollection.Grids;
 const matches=[],diagnostics=[];
 let objectsInspected=0,gridsInspected=0,missingDirectGrids=0;
 for(const [gridId,owners] of direct){
  const grid=savedGrids[String(gridId)];
  if(!isObject(grid)){missingDirectGrids++;continue;}
  if(id(grid.ID)!==gridId||!isObject(grid.Objects)){
   diagnostics.push({gridId,code:'GRID_IDENTITY_OR_OBJECT_STRUCTURE_UNKNOWN'});
   continue;
  }
  gridsInspected++;
  for(const [key,obj] of Object.entries(grid.Objects)){
   if(++objectsInspected>maxObjects)throw new Error('Grid object research budget exceeded.');
   const objectId=id(key);
   if(objectId===null||!isObject(obj)||id(obj.ID)!==objectId){
    diagnostics.push({gridId,code:'GRID_OBJECT_ID_MISMATCH'});
    continue;
   }
   const itemId=id(obj.ItemID);
   if(itemId===null||!byItem.has(itemId))continue;
   const sources=byItem.get(itemId);
   matches.push(Object.freeze({
    gridId,gridObjectId:objectId,itemId,sourceMatchLevel:'ITEM_ID_ONLY',
    possibleEventIds:Object.freeze([...new Set(sources.map(x=>x.eventId))].sort((a,b)=>a-b)),
    possibleFamilies:Object.freeze([...new Set(sources.map(x=>x.family))].sort()),
    directAreaOwnership:owners.length===1?Object.freeze({...owners[0]}):null,
    ownerAreaAmbiguous:owners.length!==1,
    sourceObjectStatePresent:isObject(obj.State),sourceProvenanceVerified:false,
    nativeRemovalVerified:false,bulkDeletionAuthorized:false,
    timestampEditAuthorized:false
   }));
  }
 }
 matches.sort((a,b)=>a.gridId-b.gridId||a.gridObjectId-b.gridObjectId);
 return Object.freeze({
  source:'SAVE_LOCAL_READ_ONLY_GRID_ITEM_MATCH',gridObjectsInspected:objectsInspected,
  directGridsInspected:gridsInspected,missingDirectGrids,
  indirectAndTechnicalGridsNotAnalyzed:true,
  sourceMatchIsNotSpawnProof:true,writerAuthorized:false,bulkDeletionAuthorized:false,
  matches:Object.freeze(matches),diagnostics:Object.freeze(diagnostics)
 });
}
