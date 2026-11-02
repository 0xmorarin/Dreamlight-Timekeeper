// Narrow copy-only writer contract for an authoritative Worker caller.
// The Worker MUST derive registry, W1 contracts, active session and source SHA
// from its own loaded state. Never deserialize those from a UI message.
// No original overwrite, download, file-system operation, or Writer release.
import {SafeProfileEditSession,diffPaths} from './safe-edit-session.mjs';
import {p1gPackagedProfileCodec} from './p1g-packaged-profile-codec.mjs';
import {inspectTimingPlan} from './timing-plan-preflight.mjs';
import {auditP1gEnvelope} from './p1g-envelope-audit.mjs';
import {projectProfile,validTime} from '../reader.mjs';
import {BuildIdentityKind,PlatformFamily,RuntimeGateStatus} from './versioning.mjs';

const BID='9A239D3DB569756D';
const TYPES=new Set(['ItemSpawning','WildCropsSpawningInVillage',
  'FlowerSpawningInVillage','FishSpawningInVillage']);
const EXPECTED_BUILD=Object.freeze({
 platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:BID
});
const PTR=/^\/World\/RecurringEvents\/(0|[1-9][0-9]*)\/([A-Za-z]+)\/NextOccurrence$/;
const SHA=/^[a-f0-9]{64}$/;
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const distinct=xs=>new Set(xs).size===xs.length;

function validateAllowlist(contracts,registry){
 if(!Array.isArray(contracts)||contracts.length===0||contracts.length>508)
  throw Error('W1_CONTRACTS_REQUIRED');
 const pairs=new Set();
 for(const item of contracts){
  if(!record(item)||!Number.isSafeInteger(item.eventId)||!TYPES.has(item.kind)||
     Object.keys(item).some(k=>!['eventId','kind'].includes(k)))
   throw Error('W1_CONTRACT_INVALID');
  const definition=registry.get(item.eventId);
  if(!definition||definition.id!==item.eventId||definition.eventPolicy!=='W1'||
     definition.active!==true||item.eventId===2010000064)
   throw Error('W1_CONTRACT_NOT_ACTIVE_W1');
  const key=item.eventId+':'+item.kind;
  if(pairs.has(key))throw Error('W1_CONTRACT_DUPLICATE');
  pairs.add(key);
 }
 return pairs;
}

function checkPlan(snapshot,plan,allowedPairs){
 if(!Array.isArray(plan)||plan.length===0||plan.length>100)
  throw Error('W1_EMPTY_OR_OVERSIZED_PLAN');
 if(!plan.every(record))throw Error('W1_PLAN_ENTRY_INVALID');
 const byPtr=new Map(snapshot.rows.map(row=>[row.pointer,row]));
 const paths=[];
 for(const entry of plan){
  if(Object.keys(entry).some(k=>!['pointer','eventId','kind','originalTime','targetTime'].includes(k)))
   throw Error('W1_PLAN_UNEXPECTED_FIELD');
  const m=typeof entry.pointer==='string'?PTR.exec(entry.pointer):null;
  if(!m||!TYPES.has(m[2])||!Number.isSafeInteger(entry.eventId)||
     !allowedPairs.has(entry.eventId+':'+entry.kind)||m[2]!==entry.kind)
   throw Error('W1_EVENT_PATH_OR_KIND_DENIED');
  const row=byPtr.get(entry.pointer);
  if(!row||row.source!=='World.RecurringEvents'||row.id!==entry.eventId||
     row.kind!==entry.kind||row.policy!=='W1'||row.eventActive!==true||
     row.structureValid!==true||typeof row.eventName!=='string'||!row.eventName)
   throw Error('W1_EVENT_DEFINITION_OR_SESSION_MISMATCH');
  if(typeof entry.originalTime!=='string'||typeof entry.targetTime!=='string'||
     row.time!==entry.originalTime||!validTime(entry.originalTime)||
     !validTime(entry.targetTime))
   throw Error('W1_TIMESTAMP_OR_ORIGINAL_CAS_INVALID');
  if(entry.originalTime===entry.targetTime)throw Error('W1_NO_OP_DENIED');
  paths.push(entry.pointer);
 }
 if(!distinct(paths))throw Error('W1_DUPLICATE_POINTER');
 return paths;
}

function ownParent(root,pointer){
 const parts=pointer.slice(1).split('/');
 let parent=root;
 for(const part of parts.slice(0,-1)){
  if(!record(parent)||!Object.hasOwn(parent,part))
   throw Error('W1_POINTER_PARENT_CHANGED');
  parent=parent[part];
 }
 const field=parts.at(-1);
 if(!record(parent)||!Object.hasOwn(parent,field))
  throw Error('W1_POINTER_FIELD_CHANGED');
 return {parent,field};
}

/**
 * Worker-only call:
 * - sourceBytes: originally selected encrypted P1G, not uploaded anywhere.
 * - activeSessionId / sourceSessionId: from Worker and request respectively.
 * - expectedSourceSha256: SHA of source at initial Worker open.
 * - eventRegistry: indexEvents(verified local data/events-v1253.json).
 * - w1Contracts: trusted 02 TIME ID+saved-variant bindings, NOT UI input.
 * - entries: UI selected proposed pointers+IDs+old/new timestamps (untrusted).
 * - targetBuild: explicit user-provided/Worker-validated Switch BID.
 *
 * Return only an in-memory verified original/edited byte pair; caller must
 * enforce original-backup-first separate-download UX. No transfer in this module.
 */
export async function createW1EditedP1gCopy({
 sourceBytes,sourceSessionId,activeSessionId,expectedSourceSha256,
 targetBuild,eventRegistry,w1Contracts,entries
}={}){
 if(!(sourceBytes instanceof Uint8Array)||sourceBytes.length===0)
  throw Error('W1_SOURCE_INVALID');
 if(!Number.isSafeInteger(activeSessionId)||activeSessionId<1||
    sourceSessionId!==activeSessionId)
  throw Error('W1_STALE_SESSION');
 if(typeof expectedSourceSha256!=='string'||!SHA.test(expectedSourceSha256))
  throw Error('W1_SOURCE_HASH_REQUIRED');
 if(!record(targetBuild)||targetBuild.platform!==EXPECTED_BUILD.platform||
    targetBuild.kind!==EXPECTED_BUILD.kind||targetBuild.value!==EXPECTED_BUILD.value)
  throw Error('W1_EXPLICIT_SWITCH_BID_REQUIRED');
 if(!(eventRegistry instanceof Map)||eventRegistry.size!==508)
  throw Error('W1_VERIFIED_REGISTRY_REQUIRED');
 const allowedPairs=validateAllowlist(w1Contracts,eventRegistry);
 // The existing SafeProfileEditSession is the ONLY Clone/Encode/Reopen writer.
 const session=await SafeProfileEditSession.open({
  sourceBytes,sourcePlatform:PlatformFamily.Switch,codec:p1gPackagedProfileCodec
 });
 const identity=session.getSaveIdentity();
 if(identity.profileGameInfoVersion!==626||
    identity.sourceRawSha256!==expectedSourceSha256)
  throw Error('W1_SOURCE_SCHEMA_OR_SHA_MISMATCH');
 if(session.getPreflightContext().inputFormat!=='packaged')
  throw Error('W1_P1G_REQUIRED');
 const envelope=auditP1gEnvelope({format:'packaged',metadata:session.originalMetadata});
 if(!envelope.repackageShapeObserved||envelope.writerAuthorized||
    envelope.editedCopyAuthorized)
  throw Error('W1_SOURCE_ZIP_REBUILD_UNSUPPORTED');
 const original=session.getSnapshot();
 const snapshot=projectProfile(original,eventRegistry);
 // Refuse duplicate saved EventIDs; row index is NOT event definition ID.
 const savedCounts=new Map();
 for(const container of Object.values(original.World.RecurringEvents??{})){
  if(!record(container))continue;
  for(const value of Object.values(container)){
   if(!record(value)||!Object.hasOwn(value,'RecurringEventItemID'))continue;
   const id=value.RecurringEventItemID;
   if(Number.isSafeInteger(id)||typeof id==='string'){
    const key=String(id);
    savedCounts.set(key,(savedCounts.get(key)??0)+1);
   }
  }
 }
 for(const entry of entries)if(savedCounts.get(String(entry.eventId))!==1)
  throw Error('W1_DUPLICATE_SAVED_EVENT_ID');
 const paths=checkPlan(snapshot,entries,allowedPairs);
 const report=inspectTimingPlan(original,snapshot,entries);
 if(report.summary.requested!==entries.length||
    report.summary.structuralShapeObserved!==entries.length||
    report.rows.some(row=>row.code!=='STRUCTURE_OBSERVED'))
  throw Error('W1_SOURCE_PREFLIGHT_DENIED');
 // Enforce exact old value again inside SafeSession's isolated clone callback.
 const changed=await session.exportVerifiedCopy({
  targetBuild,
  exactAllowedPaths:paths,
  operation:{
   id:'w1-selected-next-occurrence-copy-v1253',owner:'01_CORE',
   structuralCapabilitiesSupported:true,planSupported:true,
   validationPassed:true,runtimeGate:RuntimeGateStatus.NotRequired
  },
  edit:draft=>{
   for(const entry of entries){
    const {parent,field}=ownParent(draft,entry.pointer);
    if(typeof parent[field]!=='string'||parent[field]!==entry.originalTime||
       parent.RecurringEventItemID!==entry.eventId)
     throw Error('W1_EXACT_OLD_VALUE_CAS_FAILED');
    parent[field]=entry.targetTime;
   }
  }
 });
 if(changed.noOp||!changed.authorization?.capabilities?.encodeCopy||
    changed.authorization.capabilities.persistentReplace)
  throw Error('W1_COPY_AUTHORIZATION_FAILED');
 const expected=paths.slice().sort();
 if(changed.changedPaths.length!==expected.length||
    changed.changedPaths.slice().sort().some((p,i)=>p!==expected[i]))
  throw Error('W1_EDITED_DIFF_MISMATCH');
 // Independent reopen and semantic-only field verification are already done
 // by SafeProfileEditSession.exportVerifiedCopy; no second encoder exists here.
 return Object.freeze({
  status:'WORKER_VERIFIED_EDITED_P1G_COPY',sourceSessionId,
  sourceRawSha256:identity.sourceRawSha256,
  backupOriginalBytes:changed.backupOriginalBytes,
  editedBytes:changed.editedBytes,
  editedRawSha256:changed.editedRawSha256,
  changedPaths:changed.changedPaths,
  encodeCopyAuthorized:true,persistentReplaceAuthorized:false,
  browserRuntimeVerified:false,deviceLoadVerified:false,
  userDownloadPerformed:false,originalOverwritePerformed:false
 });
}
