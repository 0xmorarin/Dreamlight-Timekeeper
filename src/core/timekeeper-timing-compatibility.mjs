// Timekeeper field-level RESEARCH classification, independent of Wand's exact
// build writer registry. Never produces an allowlist or authorizes edited export.
import {inspectTimingPlan} from './timing-plan-preflight.mjs';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const SOURCE=Object.freeze({gameVersion:'1.25.3',platform:'Nintendo Switch',
 buildId:'9A239D3DB569756D',schema:626,evidenceLevel:'STATIC_ONLY'});
const W1=new Set(['ItemSpawning','WildCropsSpawningInVillage',
 'FlowerSpawningInVillage','FishSpawningInVillage']);
const PROTECTED=new Set(['ChooseItem','ChooseVillageArea']);
export function assessTimekeeperTimingCompatibility(profile,snapshot,plan){
 const preflight=inspectTimingPlan(profile,snapshot,plan);
 if(!obj(snapshot?.timingReview)||snapshot.timingReview.gameVersion!==SOURCE.gameVersion||
    snapshot.timingReview.evidenceBuildId!==SOURCE.buildId||
    snapshot.timingReview.schema!==SOURCE.schema||
    snapshot.timingReview.evidenceLevel!==SOURCE.evidenceLevel||
    snapshot.timingReview.writerAuthorization!==false)
  throw new Error('Source timing-review research provenance missing or invalid.');
 const rows=new Map(snapshot.rows.map(row=>[row.pointer,row]));
 let researchCandidate=0,versionReview=0,excluded=0;
 const results=preflight.rows.map(p=>{
  const row=rows.get(p.pointer);
  let code;
  if(!p.structuralShapeObserved)code='PREFLIGHT_NOT_STRUCTURALLY_OBSERVED';
  else if(!row||row.source!=='World.RecurringEvents'||!W1.has(row.kind))
   code=PROTECTED.has(row?.kind)?'CONTROL_EVENT_PROTECTED':'FIELD_FAMILY_OUT_OF_SCOPE';
  else if(row.id===2010000064)code='MOONSTONE_CHEST_SEPARATE_STATE';
  else if(row.review?.semantic!=='nextOccurrence'||!row.review.nativeEvidence)
   code='NATIVE_EVIDENCE_RULE_MISSING';
  else if(row.policy!=='W1')code='EVENT_POLICY_NOT_W1';
  else if(row.eventActive!==true)code=row.eventActive===false?'DEFINITION_MARKED_INACTIVE':'DEFINITION_ACTIVITY_UNKNOWN';
  else if(row.structureValid!==true)code='EVENT_SERIALIZATION_AMBIGUOUS';
  else if(preflight.schema!==SOURCE.schema)code='SCHEMA_VERSION_DRIFT_REVIEW';
  else code='STATIC_W1_RESEARCH_CANDIDATE';
  if(code==='STATIC_W1_RESEARCH_CANDIDATE')researchCandidate++;
  else if(code==='SCHEMA_VERSION_DRIFT_REVIEW')versionReview++;
  else excluded++;
  return Object.freeze({
   pointer:p.pointer,eventId:p.eventId,kind:p.kind,
   sourceSchema:preflight.schema,sourceResearchBuild:SOURCE.buildId,
   code,structuralShapeObserved:p.structuralShapeObserved,
   staticResearchCandidate:code==='STATIC_W1_RESEARCH_CANDIDATE',
   futureDateAllowedAsResearchInput:true,
   originalFutureDateIsCorruption:false,
   sourceBuildVerified:false,sourceNativeSemanticsVerified:false,
   fieldSerializationAccepted:false,consoleColdLoadAccepted:false,
   operationAllowlisted:false,writerAuthorized:false,editedCopyAuthorized:false
  });
 });
 return Object.freeze({
  status:'TIMEKEEPER_FIELD_COMPATIBILITY_RESEARCH_ONLY',
  sourceResearch:Object.freeze({...SOURCE}),
  observedSchema:preflight.schema,sourceBuildVerified:false,
  newerVersionReadMayProceed:true,
  saveWriterAllowed:false,editedCopyAuthorized:false,exportAvailable:false,
  summary:Object.freeze({requested:results.length,researchCandidate,
   versionReview,excluded}),
  rows:Object.freeze(results),
  preflightSummary:preflight.summary
 });
}
