import {p1gPackagedProfileCodec} from './core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson} from './core/safe-edit-session.mjs';
import {indexEvents,projectProfile} from './reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from './timing-review.mjs';
import {auditTimingSnapshot} from './timing-audit.mjs';
import {inspectTimingPlan} from './core/timing-plan-preflight.mjs';
import {auditP1gEnvelope} from './core/p1g-envelope-audit.mjs';
import {assessTimekeeperTimingCompatibility} from './core/timekeeper-timing-compatibility.mjs';
import {compileW1NativeSemantics} from './timing-native-semantics.mjs';
import {assessMinimalW1WriteTargets} from './w1-minimal-write-contract.mjs';
import {createW1EditedP1gCopy} from './core/w1-edited-p1g-copy.mjs';
import {BuildIdentityKind,PlatformFamily} from './core/versioning.mjs';
import {READONLY_TEXT_RC_BUILD} from './lib/timekeeper/read-only-rc-mode.mjs';
const decoder=new TextDecoder('utf-8',{fatal:true});
let indexPromise;
let namesPromise;
let rulesPromise;
let original=null;
let originalName=null;
let activeProfile=null;
let activeReview=null;
let activeSessionId=0;
let openGeneration=0,prepareInFlight=false;
let activeSourceFormat=null,activeSourceSha256=null;
let verifiedEvents=null,verifiedWoodTags=null,verifiedLedger=null;
const TARGET_BID='9A239D3DB569756D';
const sha256=async bytes=>{
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
};
function safeP1gNames(name){
 const base=String(name||'profile.p1g').replace(/\.p1g$/i,'')
  .replace(/[^A-Za-z0-9_.-]/g,'_').replace(/^\.+/,'').slice(0,120)||'profile';
 return {original:'original_'+base+'.p1g',edited:'edited_'+base+'.p1g'};
}
const getIndex=()=>indexPromise??=Promise.all([
 fetch(new URL('../data/events-v1253.json',import.meta.url)),
 fetch(new URL('../data/wand-iswood-crosswalk-v1253.json',import.meta.url))
]).then(async([events,woodTags])=>{
 if(!events.ok||!woodTags.ok)throw new Error('Verified event metadata unavailable');
 verifiedEvents=await events.json();verifiedWoodTags=await woodTags.json();
 return indexEvents(verifiedEvents,verifiedWoodTags);
});
const getRules=()=>rulesPromise??=fetch(new URL('../data/timing-review-rules-v1253.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Timing review rules unavailable');return r.json()}).then(indexTimingReviewRules);
const getNames=()=>namesPromise??=fetch(new URL('../data/item-names-v1250.json.gz',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Item names unavailable');return r.body.pipeThrough(new DecompressionStream('gzip'));}).then(async stream=>JSON.parse(await new Response(stream).text()).items);
self.onmessage=async({data})=>{
  const id=data?.id;
  if(!Number.isSafeInteger(id))return;
  try{
    if(data.type==='queryPage'){
      // No accepted Wand Rust READ-only ABI is installed. A forged UI-issued
      // source/session/revision/cursor/complete/reference claim cannot become
      // a trusted CORE projection. This is denied in ALL builds, including
      // normal developer JS-Codec comparison builds.
      throw Error('CORE_READ_ABI_NOT_ACCEPTED');
    }
    if(data.type==='open'){
      // Fence every pending Writer before starting another asynchronous file load.
      const generation=++openGeneration;
      const bytes=new Uint8Array(data.buffer);
      if(bytes.length===0||bytes.length>128*1024*1024)throw new Error('セーブファイルが空、または128MiBを超えています');
      let text,format,decodedMetadata=null;
      if(bytes[0]===123||bytes[0]===32||bytes[0]===10||bytes[0]===13||bytes[0]===9||bytes[0]===0xef){text=decoder.decode(bytes).replace(/^\uFEFF/,'');format='json'}
      else {const loaded=await p1gPackagedProfileCodec.loadProfile(bytes);text=loaded.jsonText;format='packaged';decodedMetadata=loaded.metadata}
      const profile=parseSafeJson(text);
      const sourceHash=await sha256(bytes);
      const [registry,names,rules]=await Promise.all([getIndex(),getNames(),getRules()]);
       const observedAt=Date.now();
      const reviewed=assessTimingSnapshot(projectProfile(profile,registry,{itemNames:names,now:observedAt}),rules);
      const view={...reviewed,timingAudit:auditTimingSnapshot(reviewed,{now:observedAt}),
       containerAudit:auditP1gEnvelope({format,metadata:decodedMetadata})};
      if(openGeneration!==generation)throw new Error('Superseded file open.');
      original=bytes.slice();originalName=String(data.name||'profile.json').slice(0,180);
      activeSourceSha256=sourceHash;activeSourceFormat=format;
      activeProfile=profile;activeReview=reviewed;activeSessionId++;

      self.postMessage({id,ok:true,type:'opened',format,view,sessionId:activeSessionId});
      return;
    }
    if(data.type==='backup'){
      if(!original||data.sessionId!==activeSessionId)throw new Error('セーブの読み込みセッションが一致しません');
      const payload=original.slice().buffer;
      self.postMessage({id,ok:true,type:'backup',sessionId:activeSessionId,name:originalName,buffer:payload},[payload]);
      return;
    }
    if(data.type==='preflight'){
      if(!activeProfile||!activeReview||data.sessionId!==activeSessionId)
       throw new Error('Timing preflight session is stale or missing.');
      const report=inspectTimingPlan(activeProfile,activeReview,data.entries);
      const compatibility=assessTimekeeperTimingCompatibility(activeProfile,activeReview,data.entries);
      self.postMessage({id,ok:true,type:'preflight',sessionId:activeSessionId,report,compatibility});
      return;
    }

    if(data.type==='prepareEdited'){
      if(READONLY_TEXT_RC_BUILD)throw Error('RC_READ_ONLY_WRITER_DISABLED');
      if(prepareInFlight)throw Error('W1_PREPARATION_ALREADY_IN_PROGRESS');
      if(!original||!activeProfile||!activeReview||data.sessionId!==activeSessionId||
         activeSourceFormat!=='packaged'||!activeSourceSha256)
        throw Error('W1_ACTIVE_PACKAGED_SESSION_REQUIRED');
      if(data.targetBuildId!==TARGET_BID||data.confirmedSwitchTarget!==true)
        throw Error('W1_EXPLICIT_SWITCH_BID_REQUIRED');
      if(!Number.isSafeInteger(data.planRevision)||data.planRevision<0||
         !Array.isArray(data.entries)||data.entries.length<1||data.entries.length>100)
        throw Error('W1_INVALID_PLAN_REVISION_OR_SIZE');
      // The UI supplies only an untrusted proposal. All snapshot, registry,
      // event/variant and source hash evidence is derived in this Worker.
      const generation=openGeneration,sessionId=activeSessionId;
      const sourceBytes=original,sourceHash=activeSourceSha256;
      const ensureCurrent=()=>generation===openGeneration&&
       sessionId===activeSessionId&&sourceBytes===original&&
       sourceHash===activeSourceSha256&&activeSourceFormat==='packaged';
      if(!ensureCurrent())throw Error('W1_STALE_SESSION_BEFORE_PREPARATION');
      prepareInFlight=true;
      try{
        const registry=await getIndex();
        if(!verifiedEvents||!verifiedWoodTags||!ensureCurrent())
          throw Error('W1_SOURCE_REGISTRY_OR_SESSION_CHANGED');
        verifiedLedger??=compileW1NativeSemantics(verifiedEvents,{woodTagPack:verifiedWoodTags});
        const candidate=assessMinimalW1WriteTargets(
          activeProfile,activeReview,data.entries,verifiedEvents,verifiedLedger);
        if(candidate.status!=='STRUCTURAL_W1_TARGETS_ONLY'||
           candidate.candidateTargets.length!==data.entries.length)
          throw Error('W1_TIME_TARGETS_NOT_ELIGIBLE');
        const proposal=data.entries.map(entry=>({
          pointer:entry.pointer,eventId:entry.eventId,kind:entry.kind,
          originalTime:entry.originalTime,targetTime:entry.targetTime
        }));
        if(!ensureCurrent())throw Error('W1_STALE_SESSION_AFTER_TIME_CHECK');
        const edited=await createW1EditedP1gCopy({
          sourceBytes,sourceSessionId:sessionId,activeSessionId:sessionId,
          getActiveSessionId:()=>ensureCurrent()?activeSessionId:-1,
          expectedSourceSha256:sourceHash,eventRegistry:registry,
          w1TargetReview:candidate,entries:proposal,
          targetBuild:{platform:PlatformFamily.Switch,
            kind:BuildIdentityKind.SwitchBid,value:TARGET_BID}
        });
        if(!ensureCurrent()||edited.status!=='WORKER_VERIFIED_EDITED_P1G_COPY'||
           edited.sourceSessionId!==sessionId||
           edited.sourceRawSha256!==sourceHash||
           edited.encodeCopyAuthorized!==true||
           edited.persistentReplaceAuthorized!==false||
           edited.originalOverwritePerformed!==false||
           !Array.isArray(edited.changedPaths)||
           edited.changedPaths.length!==proposal.length)
          throw Error('W1_VERIFIED_COPY_OR_SESSION_MISMATCH');
        const originalOut=new Uint8Array(edited.backupOriginalBytes);
        const editedOut=new Uint8Array(edited.editedBytes);
        if(!originalOut.length||!editedOut.length||
           await sha256(originalOut)!==sourceHash||
           await sha256(editedOut)!==edited.editedRawSha256||
           !ensureCurrent())throw Error('W1_FINAL_OUTPUT_HASH_OR_SESSION_MISMATCH');
        const names=safeP1gNames(originalName);
        const originalBuffer=originalOut.slice().buffer;
        const editedBuffer=editedOut.slice().buffer;
        const receipt={status:'WORKER_VERIFIED_PAIR',sessionId,
          sourceRawSha256:sourceHash,editedRawSha256:edited.editedRawSha256,
          changedPaths:edited.changedPaths,
          original:{name:names.original,buffer:originalBuffer},
          edited:{name:names.edited,buffer:editedBuffer}};
        if(!ensureCurrent())throw Error('W1_STALE_SESSION_BEFORE_RESPONSE');
        self.postMessage({id,ok:true,type:'preparedEdited',sessionId,
          planRevision:data.planRevision,receipt},[originalBuffer,editedBuffer]);
      }finally{prepareInFlight=false;}
      return;
    }
    if(data.type==='check'){
      await Promise.all([getIndex(),getNames(),getRules()]);self.postMessage({id,ok:true,type:'ready'});return;
    }
    throw new Error('未対応の操作です');
  }catch(err){self.postMessage({id,ok:false,error:err instanceof Error?err.message:String(err)})}
};
