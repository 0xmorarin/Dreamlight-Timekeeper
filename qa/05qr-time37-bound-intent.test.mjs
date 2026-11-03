// 05 QR TIME37 new EventID-intent/CAS delta; prior actual Wand Rust structural bridge QA40 is reused.
// A fake coreWitness with authenticatedByCore=true can be manufactured by JS caller:
// positive candidate is research-only, never a product Writer authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {assessBoundW1IntentResearch} from '../src/w1-bound-intent-research.mjs';
const old='2126-08-20T00:00:00Z',future='2127-03-01T00:00:00Z';
const pointer=i=>'/World/RecurringEvents/'+i+'/ItemSpawning/NextOccurrence';
const source=()=>({sessionId:'owner-session',revision:2,
 encryptedP1gSha256:'a'.repeat(64),decodedJsonSha256:'b'.repeat(64),
 registrySha256:'c'.repeat(64),buildId:'9A239D3DB569756D',schema:626});
const entry=(i,id)=>({sourceEventId:id,savedIndex:i,savedOneofVariant:'ItemSpawning',
 jsonPointer:pointer(i),oldValueUtc:old,newValueUtc:future});
const projection=()=>({interfaceId:'dreamlight-timekeeper.w1-rust-semantic-adapter.v1',
 writerAuthorized:false,capabilityGranted:false,status:'STRUCTURAL_CANDIDATE_ONLY',
 source:{recurringSourceSha256:'c'.repeat(64),buildId:'9A239D3DB569756D',saveSchema:626},
 operations:[entry(155,2010000021),entry(156,2010000022)]});
const token=(i,id)=>({pointer:pointer(i),eventId:id,savedIndex:i,oneof:'ItemSpawning',
 rawOldJson:JSON.stringify(old),decodedOldUtc:old});
const witness=()=>({authenticatedByCore:true,source:source(),
 tokens:[token(155,2010000021),token(156,2010000022)]});
const intent=(i,id)=>({...source(),eventId:id,savedIndex:i,oneof:'ItemSpawning',
 pointer:pointer(i),oldUtc:old,newUtc:future,rawOldJson:JSON.stringify(old)});
const run=(p,w,it)=>assessBoundW1IntentResearch({projection:p,coreWitness:w,intents:it});
test('QR TIME37 two source-bound intents yield only research candidates, no legitimate product capability',()=>{
 const p=projection(),w=witness(),intentions=[intent(155,2010000021),intent(156,2010000022)];
 const out=run(p,w,intentions);
 assert.equal(out.status,'RESEARCH_BOUND_CANDIDATES_ONLY');
 assert.equal(out.operations.length,2);
 assert.equal(out.capabilityGranted,false);
 assert.equal(out.writerAuthorized,false);
 assert.equal(out.productSemanticCommandAuthorized,false);
 assert.equal(out.operationReferencesComplete,false);
 assert.equal(out.nativeConsumerSuccessVerified,false);
 assert.equal(out.evidence,'SYNTHETIC_CONTRACT_ONLY');
});
test('QR TIME37 valid second saved pointer cannot impersonate intended EventID; entire batch refused',()=>{
 const p=projection(),w=witness(),ints=[intent(155,2010000021),intent(156,2010000021)];
 const bad=run(p,w,ints);
 assert.equal(bad.status,'RESEARCH_DENIED');
 assert.equal(bad.reason,'DUPLICATE_INTENDED_EVENT_ID');
 assert.equal(bad.operations.length,0);
 const swapped=run(p,w,[intent(155,2010000022),intent(156,2010000021)]);
 assert.equal(swapped.status,'RESEARCH_DENIED');
 assert.equal(swapped.reason,'INTENDED_EVENT_IDENTITY_CAS_FAILED');
 assert.equal(swapped.operations.length,0);
});
test('QR TIME37 stale revision/registry, lexical raw UTC mismatch fail closed',()=>{
 const p=projection();
 for(const i of [
  {...intent(155,2010000021),revision:1},
  {...intent(155,2010000021),registrySha256:'f'.repeat(64)},
  {...intent(155,2010000021),rawOldJson:'"\\u0032126-08-20T00:00:00Z"'}
 ]){
  const out=run({...p,operations:[p.operations[0]]},witness(),[i]);
  assert.equal(out.status,'RESEARCH_DENIED');
  assert.equal(out.capabilityGranted,false);
 }
 const w=witness();w.authenticatedByCore=false;
 assert.equal(run({...p,operations:[p.operations[0]]},w,[intent(155,2010000021)]).reason,'CORE_SOURCE_PROVENANCE_NOT_CONFIRMED');
});
test('QR TIME37 positive spoofed authenticatedByCore is NOT proof of Core issuance (design residual)',()=>{
 const p=projection(),fake={...witness(),authenticatedByCore:true};
 // Deliberately forged in-process JSON has no MAC or Worker-issued object identity.
 const out=run({...p,operations:[p.operations[0]]},fake,[intent(155,2010000021)]);
 assert.equal(out.status,'RESEARCH_BOUND_CANDIDATES_ONLY');
 assert.equal(out.capabilityGranted,false);
 assert.equal(out.productSemanticCommandAuthorized,false);
 // The actual Rust SaveSession issuer must supply the trust root, not this flag.
});
