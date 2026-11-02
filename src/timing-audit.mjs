// Read-only, save-local distribution audit. No timestamps are inferred to be corrupt,
// and no observation can grant permission to rewrite a saved value.
const STATUS_KEYS=Object.freeze([
 'PAST','FUTURE','SPECIAL_2126_UNRESOLVED','DISTANT_FUTURE_UNVERIFIED','INVALID'
]);
const STATUS_SET=new Set(STATUS_KEYS);
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const SATURN='2126-08-20T00:00:00Z';
const SAFE_WORLDS=new Set(['valley','exp1','exp2','exp3','hgw','unknown']);
const SAFE_TABS=new Set(['spawn','resources','shops','daily']);

export function auditTimingSnapshot(snapshot,{now=Date.now()}={}){
 if(!isObj(snapshot)||!Array.isArray(snapshot.rows)||!isObj(snapshot.identity)||
   !Number.isFinite(now)||now<0||!Number.isSafeInteger(snapshot.identity.schema))
   throw new Error('Invalid read-only timing audit input.');
 const counts=Object.fromEntries(STATUS_KEYS.map(x=>[x,0]));
 const byTab=Object.fromEntries([...SAFE_TABS].map(x=>[x,0]));
 const sharedTypes=new Map(),sharedWorlds=new Map();
 let recurring=0,invalidStructure=0,unknownEvents=0,sharedRecurring=0;
 const pointers=new Set();
 for(const r of snapshot.rows){
  if(!isObj(r)||typeof r.pointer!=='string'||!r.pointer.startsWith('/')||
     pointers.has(r.pointer)||!STATUS_SET.has(r.status)||!SAFE_TABS.has(r.tab)||
     r.writeAuthorized!==false)
    throw new Error('Invalid or duplicate timing audit row.');
  pointers.add(r.pointer);
  counts[r.status]++;byTab[r.tab]++;
  if(r.source==='World.RecurringEvents'){
   recurring++;
   if(r.structureValid===false)invalidStructure++;
   if(!r.eventName)unknownEvents++;
   if(r.status==='SPECIAL_2126_UNRESOLVED'){
    sharedRecurring++;
    const type=String(r.kind??'unknown');
    const world=SAFE_WORLDS.has(r.world)?r.world:'unknown';
    sharedTypes.set(type,(sharedTypes.get(type)||0)+1);
    sharedWorlds.set(world,(sharedWorlds.get(world)||0)+1);
   }
  }
 }
 const sorted=map=>[...map].map(([key,count])=>({key,count}))
   .sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key));
 const shared={timestamp:SATURN,count:counts.SPECIAL_2126_UNRESOLVED,
  recurringCount:sharedRecurring,typeCount:sharedTypes.size,
  regionCount:sharedWorlds.size,byType:sorted(sharedTypes),byRegion:sorted(sharedWorlds),
  multiTypePattern:sharedRecurring>=2&&sharedTypes.size>=2,
  originVerified:false,releaseMechanismVerified:false,autoRepairAllowed:false};
 return {
  source:'LOCAL_SAVE_OBSERVATION',observedAt:new Date(now).toISOString(),
  saveSchema:snapshot.identity.schema,sourceBuildVerified:false,writerAuthorized:false,
  autoRepairAllowed:false,total: snapshot.rows.length,recurringCount:recurring,
  statuses:counts,byTab,shared2126:shared,
  structuralConflicts:invalidStructure,unknownEventDefinitions:unknownEvents,
  ordinaryFutureIsCorruption:false,
  diagnosticOnly:true
 };
}
