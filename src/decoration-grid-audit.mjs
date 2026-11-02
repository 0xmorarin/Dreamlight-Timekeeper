import {inspectWandGridObjectReferences} from './wand-grid-reference-index.mjs';
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
  source.source?.deleteAuthorization!==false||
  source.source?.version!=='1.25.3'||source.source?.buildId!=='9A239D3DB569756D'||
  source.source?.rawEventSHA256!=='028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea'||
  source.rows?.length!==508||!Array.isArray(source.rows))
  throw new Error('Unrecognized read-only Grid audit input.');
 // Wand 01A source uses exact address references and distinguishes ACTIVE
 // operational ownership, UNKNOWN system location, HISTORICAL bookkeeping.
 // Missing source roots mean UNKNOWN coverage; NEVER use absence as clearance.
 const refs=isObject(profile.Player)
  ?inspectWandGridObjectReferences(profile)
  :null;
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
   const referenced=refs?.byAddress({gridId,gridObjectId:objectId})??[];
   const active=referenced.filter(x=>x.activity==='ACTIVE');
   const unknown=referenced.filter(x=>x.activity==='UNKNOWN');
   const historical=referenced.filter(x=>x.activity==='HISTORICAL');
   matches.push(Object.freeze({
    gridId,gridObjectId:objectId,itemId,sourceMatchLevel:'ITEM_ID_ONLY',
    possibleEventIds:Object.freeze([...new Set(sources.map(x=>x.eventId))].sort((a,b)=>a-b)),
    possibleFamilies:Object.freeze([...new Set(sources.map(x=>x.family))].sort()),
    directAreaOwnership:owners.length===1?Object.freeze({...owners[0]}):null,
    ownerAreaAmbiguous:owners.length!==1,
    sourceObjectStatePresent:isObject(obj.State),
    // No authoritative semantics for GridObject.From have been accepted yet.
    sourceFromRawPresent:Object.hasOwn(obj,'From'),
    referenceAssessment:refs===null?'NOT_EVALUATED':
     !refs.result.activeEventContainerPresent||refs.result.invalidReferenceCount>0?
      'INCOMPLETE_REFERENCE_GRAPH':
     active.length?'ACTIVE_IDENTITY_REFERENCE':
     unknown.length?'UNKNOWN_SYSTEM_REFERENCE':
     historical.length?'HISTORICAL_ONLY_REQUIRES_OTHER_GATES':'NO_MATCHED_KNOWN_REFERENCE_OTHER_GATES_OPEN',
    activeConditionalEventIds:Object.freeze([...new Set(active.map(x=>x.contextId))]),
    unknownSystemReferenceCount:unknown.length,
    historicalReferenceCount:historical.length,
    sourceProvenanceVerified:false,
    nativeRemovalVerified:false,bulkDeletionAuthorized:false,
    timestampEditAuthorized:false
   }));
  }
 }
 matches.sort((a,b)=>a.gridId-b.gridId||a.gridObjectId-b.gridObjectId);

 // Wand 01A resolves active addresses in both Grids and DiffGrids.ModifiedObjects.
 // DiffGrids are NOT equivalent to direct, freely removable world roots.
 const diffModifiedMatches=[];
 let diffModifiedObjectsInspected=0,diffGridsInspected=0;
 const diffGrids=world.GridCollection.DiffGrids;
 const diffSourceComplete=diffGrids===undefined||isObject(diffGrids);
 if(!diffSourceComplete)diagnostics.push({code:'DIFF_GRIDS_STRUCTURE_UNREVIEWED'});
 if(isObject(diffGrids)){
  if(Object.keys(diffGrids).length>maxGrids)throw new Error('Diff Grid research limit exceeded.');
  for(const [key,grid] of Object.entries(diffGrids)){
   const gridId=id(key);
   if(gridId===null||!isObject(grid)||id(grid.ID)!==gridId){
    diagnostics.push({code:'DIFF_GRID_IDENTITY_MISMATCH'});continue;
   }
   const modified=grid.ModifiedObjects;
   if(modified===undefined||modified===null)continue;
   if(!isObject(modified)){
    diagnostics.push({gridId,code:'DIFF_MODIFIED_OBJECTS_STRUCTURE_UNREVIEWED'});continue;
   }
   diffGridsInspected++;
   for(const [objectKey,obj] of Object.entries(modified)){
    if(++objectsInspected>maxObjects)throw new Error('Grid object research budget exceeded.');
    diffModifiedObjectsInspected++;
    const objectId=id(objectKey);
    if(objectId===null||!isObject(obj)||id(obj.ID)!==objectId){
     diagnostics.push({gridId,code:'DIFF_MODIFIED_OBJECT_ID_MISMATCH'});continue;
    }
    const itemId=id(obj.ItemID);
    if(itemId===null||!byItem.has(itemId))continue;
    const sources=byItem.get(itemId);
    const addressed=refs?.byAddress({gridId,gridObjectId:objectId})??[];
    const active=addressed.filter(x=>x.activity==='ACTIVE');
    const unknown=addressed.filter(x=>x.activity==='UNKNOWN');
    const historical=addressed.filter(x=>x.activity==='HISTORICAL');
    const saved=savedGrids[String(gridId)]?.Objects?.[String(objectId)];
    const activeSourceReady=refs!==null&&refs.result.activeEventContainerPresent&&
     refs.result.invalidReferenceCount===0;
    diffModifiedMatches.push(Object.freeze({
     gridId,gridObjectId:objectId,itemId,
     sourceMatchLevel:'ITEM_ID_ONLY_DIFF_MODIFIED',
     possibleEventIds:Object.freeze([...new Set(sources.map(x=>x.eventId))].sort((a,b)=>a-b)),
     possibleFamilies:Object.freeze([...new Set(sources.map(x=>x.family))].sort()),
     exactDirectAreaLinked:direct.has(gridId),
     savedGridObjectAlsoPresent:isObject(saved),
     sourceFromRawPresent:Object.hasOwn(obj,'From'),
     sourceFromSemanticsVerified:false,
     referenceAssessment:!activeSourceReady?'INCOMPLETE_REFERENCE_GRAPH':
      active.length?'ACTIVE_IDENTITY_REFERENCE':
      unknown.length?'UNKNOWN_SYSTEM_REFERENCE':
      historical.length?'HISTORICAL_ONLY_REQUIRES_OTHER_GATES':
      'NO_MATCHED_KNOWN_REFERENCE_OTHER_GATES_OPEN',
     activeConditionalEventIds:Object.freeze([...new Set(active.map(x=>x.contextId))]),
     unknownSystemReferenceCount:unknown.length,historicalReferenceCount:historical.length,
     locationRoleVerified:false,sourceProvenanceVerified:false,
     nativeRemovalVerified:false,bulkDeletionAuthorized:false,timestampEditAuthorized:false
    }));
   }
  }
 }
 diffModifiedMatches.sort((x,y)=>x.gridId-y.gridId||x.gridObjectId-y.gridObjectId);

 return Object.freeze({
  source:'SAVE_LOCAL_READ_ONLY_GRID_ITEM_MATCH',gridObjectsInspected:objectsInspected,
  directGridsInspected:gridsInspected,missingDirectGrids,
  diffGridsInspected,diffModifiedObjectsInspected,
  diffModifiedGridsAreNotDirectAreaRoots:true,
  diffSourceStructureRecognized:diffSourceComplete,
  diffModifiedMatches:Object.freeze(diffModifiedMatches),
  indirectAndTechnicalGridsNotAnalyzed:true,
  sourceMatchIsNotSpawnProof:true,writerAuthorized:false,bulkDeletionAuthorized:false,
  wandReferenceIndexSource:'ddv.progression-reference-index@1 (subset)',
  wandReferenceSnapshot:refs?.result??null,
  sameVersionWandReferenceSemanticsProven:false,
  // Never treats a zero reference count as an arbitrary-removal allowance.
  absenceOfReferenceIsNotRemovalAuthorization:true,
  matches:Object.freeze(matches),diagnostics:Object.freeze(diagnostics)
 });
}
