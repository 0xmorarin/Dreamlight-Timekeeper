// Read-only subset of Wand 01A ddv.progression-reference-index@1 and 01B World/Grid
// contracts. Original 01A v1.0 validated schema624; applying exact path shapes
// to schema626 is a research projection, NOT a reacceptance of the full contract.
// Source SHA256 of original Wand adapter ZIP:
// 340fcab446a0f2e7db31604a927d90e1664398652285e325da2b1bcb092d480b
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const positive=v=>Number.isSafeInteger(v)&&v>=0;
const ident=v=>positive(v)?v:null;
const esc=x=>String(x).replaceAll('~','~0').replaceAll('/','~1');
const values=v=>Array.isArray(v)?v:record(v)?Object.values(v):[];
const addrKey=(g,o)=>`${g}:${o}`;
const savedObject=(grids,g,o,field)=>{
 const grid=record(grids)?grids[String(g)]:null;
 if(!record(grid)||grid.ID!==g||!record(grid[field]))return null;
 const object=grid[field][String(o)];
 return record(object)&&object.ID===o?object:null;
};
const targetResolution=(profile,g,o)=>{
 const collection=profile.World.GridCollection;
 const grids=record(collection)?collection.Grids:null;
 const diffs=record(collection)?collection.DiffGrids:null;
 const present=savedObject(grids,g,o,'Objects');
 if(present)return {status:'GRID_OBJECT_PRESENT',itemId:ident(present.ItemID)};
 const modified=savedObject(diffs,g,o,'ModifiedObjects');
 if(modified)return {status:'DIFF_MODIFIED_OBJECT_PRESENT',itemId:ident(modified.ItemID)};
 const dg=record(diffs)?diffs[String(g)]:null;
 const removed=record(dg)&&dg.ID===g?dg.RemovedObjects:null;
 if(Array.isArray(removed)&&removed.some(x=>x===o||(record(x)&&x.ID===o)))
  return {status:'DIFF_REMOVED_OBJECT',itemId:null};
 return {status:'SAVE_LOCAL_OBJECT_NOT_MATERIALIZED',itemId:null};
};
const freezeRows=rows=>Object.freeze(rows.map(x=>Object.freeze(x)));
export function inspectWandGridObjectReferences(profile,{
 maxActiveEvents=100000,maxAddresses=250000,maxHistoricalRecords=250000
}={}){
 if(!record(profile)||!record(profile.World)||!record(profile.Player))throw new Error('Invalid save reference roots.');
 if(![maxActiveEvents,maxAddresses,maxHistoricalRecords].every(v=>Number.isSafeInteger(v)&&v>0))
  throw new Error('Invalid reference budget.');
 const references=[],invalid=[];
 const addressIndex=new Map(),sourceCounts=new Map();
 let scanned=0,activeEventsInspected=0,historicalInspected=0;
 const issue=(path,reason)=>{
  if(invalid.length<100)invalid.push(Object.freeze({path,reason}));
 };
 const push=(path,value,sourceType,activity,contextId=null)=>{
  if(++scanned>maxAddresses)throw new Error('Wand reference scan address budget exceeded.');
  if(!record(value)||!positive(value.GridID)||!positive(value.GridObjectID)){
   issue(path,'INVALID_GRID_OBJECT_ADDRESS');return;
  }
  const found=targetResolution(profile,value.GridID,value.GridObjectID);
  const row=Object.freeze({path,gridId:value.GridID,gridObjectId:value.GridObjectID,
   itemId:found.itemId,targetResolution:found.status,
   sourceType,activity,contextId,terminality:'UNKNOWN',
   activeOwnershipVeto:activity!=='HISTORICAL',
   writerAuthorized:false,deleteAuthorized:false});
  references.push(row);
  const key=addrKey(row.gridId,row.gridObjectId);
  if(!addressIndex.has(key))addressIndex.set(key,[]);
  addressIndex.get(key).push(row);
  sourceCounts.set(sourceType,(sourceCounts.get(sourceType)||0)+1);
 };
 const history=profile.ConditionalEventHistory;
 const activeEvents=record(history)?history.ActiveEvents:null;
 const activeSourcePresent=record(activeEvents);
 if(history!==undefined&&history!==null&&!record(history))issue('/ConditionalEventHistory','INVALID_EVENT_HISTORY');
 if(record(history)&&!activeSourcePresent&&activeEvents!==undefined)
  issue('/ConditionalEventHistory/ActiveEvents','INVALID_ACTIVE_EVENTS');
 if(activeSourcePresent){
  for(const [eventId,state] of Object.entries(activeEvents)){
   if(++activeEventsInspected>maxActiveEvents)throw new Error('Wand active event scan limit exceeded.');
   const root=`/ConditionalEventHistory/ActiveEvents/${esc(eventId)}`;
   if(!record(state)){issue(root,'INVALID_EVENT_STATE');continue;}
   if(state.SpawnState===undefined||state.SpawnState===null)continue;
   if(!record(state.SpawnState)){issue(root+'/SpawnState','INVALID_SPAWN_STATE');continue;}
   const spawned=state.SpawnState.SpawnedObjects;
   if(!Array.isArray(spawned)){
    issue(root+'/SpawnState/SpawnedObjects','INVALID_SPAWNED_OBJECTS');continue;
   }
   for(let i=0;i<spawned.length;i++)
    push(`${root}/SpawnState/SpawnedObjects/${i}`,spawned[i],
     'CONDITIONAL_EVENT_ACTIVE_SPAWNED_OBJECT','ACTIVE',eventId);
  }
 }
 const linked=profile.Player.LastUsedLinkedEnvironmentEnter;
 if(linked!==undefined&&linked!==null){
  if(!record(linked))issue('/Player/LastUsedLinkedEnvironmentEnter','INVALID_LINKED_ENTER');
  else for(const [key,entry] of Object.entries(linked)){
   push(`/Player/LastUsedLinkedEnvironmentEnter/${esc(key)}`,entry,
    'LAST_USED_LINKED_ENVIRONMENT_ENTER','UNKNOWN',key);
  }
 }
 const historical=(base,addresses,sourceType)=>{
  if(addresses===undefined||addresses===null)return;
  if(!Array.isArray(addresses)){issue(base,'INVALID_HISTORICAL_ADDRESS_LIST');return;}
  for(let i=0;i<addresses.length;i++){
   if(++historicalInspected>maxHistoricalRecords)throw new Error('Wand historical reference limit exceeded.');
   push(`${base}/${i}`,addresses[i],sourceType,'HISTORICAL');
  }
 };
 for(const [i,achievement] of values(profile.Player.AchievementsData).entries())
  if(record(achievement)&&record(achievement.GridObjectsCollected))
   historical(`/Player/AchievementsData/${i}/GridObjectsCollected/GridObjectAddresses`,
    achievement.GridObjectsCollected.GridObjectAddresses,'ACHIEVEMENT_COLLECTED_GRID_OBJECT');
 const duty=profile.Player.DutySlots;
 if(record(duty))for(const [groupId,group] of Object.entries(duty)){
  if(!record(group))continue;
  for(const [slotId,slot] of Object.entries(record(group.Slots)?group.Slots:{})){
   if(!record(slot)||!record(slot.StepData?.GridObjectsCollected))continue;
   historical(`/Player/DutySlots/${esc(groupId)}/Slots/${esc(slotId)}/StepData/GridObjectsCollected/GridObjectAddresses`,
    slot.StepData.GridObjectsCollected.GridObjectAddresses,'DUTY_COLLECTED_GRID_OBJECT');
  }
 }
 const frozenMap=new Map([...addressIndex].map(([k,rows])=>[k,Object.freeze(rows.slice())]));
 const result=Object.freeze({
  source:'WAND_01A_V125_EXACT_REFERENCE_PATH_SUBSET',
  sourceValidatedSchema:624,observedSchema:profile.GameInfo?.Version??null,
  // A schema626 read is provisional even if paths remain present.
  schema626Revalidated:false,
  activeEventContainerPresent:activeSourcePresent,
  activeEventsInspected,addressesInspected:scanned,historicalInspected,
  activeReferenceCount:references.filter(x=>x.activity==='ACTIVE').length,
  unknownReferenceCount:references.filter(x=>x.activity==='UNKNOWN').length,
  historicalReferenceCount:references.filter(x=>x.activity==='HISTORICAL').length,
  activeMaterializedCount:references.filter(x=>x.activity==='ACTIVE'&&
   ['GRID_OBJECT_PRESENT','DIFF_MODIFIED_OBJECT_PRESENT'].includes(x.targetResolution)).length,
  activeUnmaterializedCount:references.filter(x=>x.activity==='ACTIVE'&&
   x.targetResolution==='SAVE_LOCAL_OBJECT_NOT_MATERIALIZED').length,
  activeDiffRemovedCount:references.filter(x=>x.activity==='ACTIVE'&&
   x.targetResolution==='DIFF_REMOVED_OBJECT').length,
  invalidReferenceCount:invalid.length,
  sourceCounts:Object.freeze(Object.fromEntries(sourceCounts)),
  references:freezeRows(references),invalid:Object.freeze(invalid),
  // A zero matching reference is NEVER proof that deletion is safe.
  otherIdentityAndGridLayersUnreviewed:true,
  bulkDeletionAuthorized:false,writerAuthorized:false
 });
 // Avoid exposing a mutable Map; the caller may resolve exact references via
 // a private lookup method but can never obtain a deletion permission.
 const byAddress=({gridId,gridObjectId})=>{
  if(!positive(gridId)||!positive(gridObjectId))return Object.freeze([]);
  return frozenMap.get(addrKey(gridId,gridObjectId))??Object.freeze([]);
 };
 return Object.freeze({result,byAddress});
}
