// 02 TIME / research-only identity + lexical-token CAS fence.
// Existing 508-source/native JS oracle owns W1 eligibility. The Wand common
// SaveSession owns all real source/session/revision trust and atomic mutation.
// Caller MUST use CORE-owned read witnesses, never UI-supplied "trusted" data.
const SHA=/^[0-9a-f]{64}$/;
const INDEX=/^(0|[1-9][0-9]*)$/;
const VARIANTS=new Set(['ItemSpawning','WildCropsSpawningInVillage',
  'FlowerSpawningInVillage','FishSpawningInVillage']);
const deny=(reason)=>Object.freeze({
  status:'RESEARCH_DENIED',reason,
  operations:Object.freeze([]),capabilityGranted:false,
  writerAuthorized:false,productSemanticCommandAuthorized:false
});
const validSHA=s=>typeof s==='string'&&SHA.test(s);
const scalarRow=(r)=>r&&typeof r==='object'&&!Array.isArray(r);

export function assessBoundW1IntentResearch({projection,coreWitness,intents}={}){
  if(!projection||projection.interfaceId!=='dreamlight-timekeeper.w1-rust-semantic-adapter.v1'||
    projection.writerAuthorized!==false||projection.capabilityGranted!==false)
    return deny('UNTRUSTED_W1_ORACLE');
  if(!scalarRow(coreWitness)||!scalarRow(coreWitness.source)||
    !Array.isArray(coreWitness.tokens)||!Array.isArray(intents)||
    intents.length===0||intents.length>100)
    return deny('CORE_SOURCE_OR_INTENT_REQUIRED');
  const src=coreWitness.source;
  if(![src.encryptedP1gSha256,src.decodedJsonSha256,src.registrySha256].every(validSHA)||
    typeof src.sessionId!=='string'||!src.sessionId||
    !Number.isSafeInteger(src.revision)||src.revision<0||
    src.buildId!=='9A239D3DB569756D'||src.schema!==626||
    coreWitness.authenticatedByCore!==true)
    return deny('CORE_SOURCE_PROVENANCE_NOT_CONFIRMED');
  if(projection.source.recurringSourceSha256!==src.registrySha256||
    projection.source.buildId!==src.buildId||
    projection.source.saveSchema!==src.schema)
    return deny('REGISTRY_OR_BUILD_DIFFERENT');
  if(projection.status!=='STRUCTURAL_CANDIDATE_ONLY'||
    projection.operations.length!==intents.length)
    return deny('W1_ORACLE_DENIED');
  const observed=new Map();
  for(const row of coreWitness.tokens){
    if(!scalarRow(row)||typeof row.pointer!=='string'||observed.has(row.pointer))
      return deny('AMBIGUOUS_CORE_TOKEN_WITNESS');
    observed.set(row.pointer,row);
  }
  const operations=new Map(projection.operations.map(row=>[row.jsonPointer,row]));
  if(operations.size!==projection.operations.length)return deny('DUPLICATE_ORACLE_TARGET');
  const checked=[];
  const seenEvent=new Set();
  for(const intent of intents){
    if(!scalarRow(intent)||!Number.isSafeInteger(intent.eventId)||intent.eventId<=0||
      !Number.isSafeInteger(intent.savedIndex)||intent.savedIndex<0||
      !VARIANTS.has(intent.oneof)||!INDEX.test(String(intent.savedIndex))||
      typeof intent.pointer!=='string')
      return deny('INVALID_EXPLICIT_EVENT_IDENTITY');
    const canonical='/World/RecurringEvents/'+intent.savedIndex+'/'+intent.oneof+'/NextOccurrence';
    if(intent.pointer!==canonical)return deny('INTENDED_IDENTITY_POINTER_MISMATCH');
    if(seenEvent.has(intent.eventId))return deny('DUPLICATE_INTENDED_EVENT_ID');
    seenEvent.add(intent.eventId);
    if(intent.sessionId!==src.sessionId||intent.revision!==src.revision||
      intent.encryptedP1gSha256!==src.encryptedP1gSha256||
      intent.decodedJsonSha256!==src.decodedJsonSha256||
      intent.registrySha256!==src.registrySha256||
      intent.buildId!==src.buildId||intent.schema!==src.schema)
      return deny('STAGED_SOURCE_OR_REVISION_CAS_FAILED');
    const candidate=operations.get(intent.pointer),witness=observed.get(intent.pointer);
    if(!candidate||!witness||
      candidate.sourceEventId!==intent.eventId||
      candidate.savedIndex!==intent.savedIndex||
      candidate.savedOneofVariant!==intent.oneof||
      witness.eventId!==intent.eventId||
      witness.savedIndex!==intent.savedIndex||
      witness.oneof!==intent.oneof)
      return deny('INTENDED_EVENT_IDENTITY_CAS_FAILED');
    if(typeof intent.oldUtc!=='string'||typeof intent.newUtc!=='string'||
      intent.oldUtc!==candidate.oldValueUtc||intent.newUtc!==candidate.newValueUtc||
      intent.oldUtc!==witness.decodedOldUtc||
      typeof intent.rawOldJson!=='string'||intent.rawOldJson!==witness.rawOldJson)
      return deny('OLD_OR_NEW_TIMESTAMP_CAS_FAILED');
    // This checks semantic equivalence of the trusted token witness only.
    // CORE alone must extract the *exact* raw lexical bytes from the source.
    let decoded;
    try { decoded=JSON.parse(witness.rawOldJson); }catch{return deny('INVALID_RAW_JSON_TOKEN');}
    if(typeof decoded!=='string'||decoded!==intent.oldUtc)
      return deny('RAW_JSON_VS_UTC_CAS_FAILED');
    if(candidate.oldValueUtc===candidate.newValueUtc)
      return deny('NOOP_W1_INTENT');
    checked.push(Object.freeze({
      eventId:intent.eventId,savedIndex:intent.savedIndex,oneof:intent.oneof,
      pointer:intent.pointer,rawOldJson:intent.rawOldJson,
      oldUtc:intent.oldUtc,newUtc:intent.newUtc,
      requiredCapability:'ENCODE_COPY',capabilityGranted:false
    }));
  }
  // Caller-controlled witness cannot authenticate source or references.
  // This code never stages SemanticCommand, writes JSON, or enables Writer.
  return Object.freeze({
    status:'RESEARCH_BOUND_CANDIDATES_ONLY',reason:null,
    sourceRevision:src.revision,sourceSession:src.sessionId,
    operations:Object.freeze(checked),
    evidence:'SYNTHETIC_CONTRACT_ONLY',
    nativeConsumerSuccessVerified:false,operationReferencesComplete:false,
    capabilityGranted:false,writerAuthorized:false,
    productSemanticCommandAuthorized:false
  });
}
