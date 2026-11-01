const CLASSIFICATIONS = new Set(['RESEARCH_CANDIDATE','CONDITIONAL_REVIEW','DIAGNOSTIC_ONLY','PROTECTED']);
const SEMANTICS = new Set(['nextOccurrence','lastRefresh','lastCollect','endOfGrowth','endOfLife','resetHistory']);
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const key = (source,kind) => source+'\u0000'+kind;

export function indexTimingReviewRules(document) {
  const src=document?.source;
  if(!isObj(src) || src.gameVersion!=='1.25.3' || src.platform!=='Nintendo Switch' ||
    src.buildId!=='9A239D3DB569756D' || src.schema!==626 ||
    !Number.isSafeInteger(src.revision) || src.revision<1 ||
    src.writerAuthorization!==false || src.evidenceLevel!=='STATIC_ONLY' ||
    !Array.isArray(document.rules))throw new Error('Unrecognized or unauthorized timing review source.');
  const map=new Map();
  for(const rule of document.rules){
    if(!isObj(rule) || typeof rule.source!=='string' || !rule.source ||
       typeof rule.kind!=='string' || !rule.kind ||
       !CLASSIFICATIONS.has(rule.classification) || !SEMANTICS.has(rule.semantic) ||
       typeof rule.reason!=='string' || !rule.reason ||
       typeof rule.nativeEvidence!=='string' || !rule.nativeEvidence)
      throw new Error('Incomplete timing rule.');
    const id=key(rule.source,rule.kind);
    if(map.has(id))throw new Error('Ambiguous timing rule.');
    map.set(id,Object.freeze({...rule}));
  }
  return Object.freeze({source:Object.freeze({...src}),rules:map});
}

export function assessTimingRow(row,index,{schema=626}={}){
  if(!isObj(row) || !index || !(index.rules instanceof Map))throw new Error('Timing review input invalid.');
  const rule=index.rules.get(key(row.source,row.kind));
  let status=rule?.classification??'UNCLASSIFIED';
  let reason=rule?.reason??'No reviewed field rule for this source/kind.';
  if(schema!==index.source.schema){status='HOLD_SCHEMA';reason='Save schema differs from the read-only evidence snapshot.';}
  else if(row.status==='INVALID' || row.time===null){status='HOLD_INVALID_TIME';reason='Stored timestamp is not a valid supported UTC value.';}
  else if(row.status==='SPECIAL_2126_UNRESOLVED'){status='HOLD_2126_UNKNOWN';reason='Shared 2126 future value has no verified origin or release mechanism.';}
  else if(row.status==='DISTANT_FUTURE_UNVERIFIED'){status='HOLD_DISTANT_FUTURE';reason='Far-future timestamp is not automatically an error or an authorized fix.';}
  else if(row.structureValid===false){status='HOLD_STRUCTURE';reason='Serialized recurring oneof structure is ambiguous.';}
  else if(rule?.semantic==='lastRefresh' && /^(?:1970-|2019-01-01)/.test(row.time||'')){
    status='HOLD_INITIALIZATION_ORIGIN';reason='An old initialization value may not represent a broken refresh cycle.';
  }else if(row.source==='World.RecurringEvents' && !row.eventName){
    status='HOLD_UNKNOWN_EVENT';reason='Event ID has no verified definition.';
  }else if(row.source==='World.RecurringEvents' && row.eventActive===false){
    status='HOLD_INACTIVE_EVENT';reason='Registry marks the event inactive; operational meaning not proven.';
  }else if(row.source==='World.RecurringEvents' && rule?.classification==='RESEARCH_CANDIDATE' && row.policy!=='W1'){
    status='HOLD_EVENT_POLICY';reason='Event-specific static policy is not W1.';
  }else if(row.source==='World.RecurringEvents' && row.id===2010000064){
    status='CONDITIONAL_REVIEW';reason='Moonstone Chest local schedule is separate from server reward eligibility.';
  }
  return Object.freeze({status,semantic:rule?.semantic??null,reason,
    nativeEvidence:rule?.nativeEvidence??null,ruleRevision:index.source.revision,
    writerAuthorized:false,editedCopyAuthorized:false});
}

export function assessTimingSnapshot(snapshot,index){
  if(!isObj(snapshot) || !Array.isArray(snapshot.rows) || !isObj(snapshot.identity))
    throw new Error('Save snapshot is invalid.');
  const rows=snapshot.rows.map(row=>({...row,review:assessTimingRow(row,index,{schema:snapshot.identity.schema})}));
  return {...snapshot,rows,timingReview:{gameVersion:index.source.gameVersion,
    buildId:index.source.buildId,schema:index.source.schema,
    revision:index.source.revision,evidenceLevel:'STATIC_ONLY',writerAuthorization:false}};
}
