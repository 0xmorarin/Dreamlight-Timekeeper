// Only synthetic P1G in a dedicated browser Worker. Read-only, no Writer/export calls.
import {p1gPackagedProfileCodec} from '../../src/core/p1g-packaged-profile-codec.mjs';
import {SafeProfileEditSession,parseSafeJson} from '../../src/core/safe-edit-session.mjs';
import {auditP1gEnvelope} from '../../src/core/p1g-envelope-audit.mjs';
import {PlatformFamily} from '../../src/core/versioning.mjs';

const samples=()=>({
  elapsedMs:performance.now(),
  chromiumNonstandardHeapUsed:typeof performance.memory?.usedJSHeapSize==='number'?
    performance.memory.usedJSHeapSize:null,
  // Browser worker has no portable accurate per-worker heap/RSS API.
  workerPeakBytes:null
});
self.onmessage=async({data})=>{
  if(data?.type!=='READ_SYNTHETIC'||!(data.source instanceof Uint8Array)||
     !Number.isSafeInteger(data.sessionId)){
    self.postMessage({type:'ERROR',sessionId:data?.sessionId??null,code:'INVALID_SYNTHETIC_WORKER_MESSAGE'});
    return;
  }
  const sessionId=data.sessionId,checks=[],start=performance.now();
  const report=(phase,extra={})=>{
    const measurement={phase,elapsedMs:performance.now()-start,...samples(),...extra};
    checks.push(measurement);
    self.postMessage({type:'PHASE',sessionId,measurement});
  };
  try {
    const source=data.source;
    report('received',{encryptedBytes:source.byteLength});
    const loaded=await p1gPackagedProfileCodec.loadProfile(source);
    report('loaded',{inflatedBytes:loaded.metadata.zip.profileEntry.uncompressedSize,
      schema:loaded.metadata.profileVersion});
    const root=parseSafeJson(loaded.jsonText);
    report('parsed',{topLevelKeys:Object.keys(root).length});
    const clone=structuredClone(root);
    report('cloned',{clonedTopLevelKeys:Object.keys(clone).length});
    const json=JSON.stringify(clone);
    report('serialized',{serializedUtf16Chars:json.length});
    const session=await SafeProfileEditSession.open({
      sourceBytes:source,sourcePlatform:PlatformFamily.Switch,codec:p1gPackagedProfileCodec
    });
    report('session-open',{sessionSchema:session.getSaveIdentity().profileGameInfoVersion});
    const audit=auditP1gEnvelope({format:'packaged',metadata:loaded.metadata});
    if(!checks.every(x=>x.workerPeakBytes===null)||audit.writerAuthorized||audit.editedCopyAuthorized)
      throw Error('WRITER_OR_MEMORY_EVIDENCE_INVARIANT');
    self.postMessage({type:'DONE',sessionId,
      readOnly:true,writerAuthorized:false,editedCopyAuthorized:false,
      codecVersion:loaded.metadata.codecVersion,codecContract:p1gPackagedProfileCodec.contract,
      inputBytes:source.byteLength,inflatedBytes:loaded.metadata.zip.profileEntry.uncompressedSize,
      auditStatus:audit.status,schema:loaded.metadata.profileVersion,
      checks,measurementsArePeak:false,browserMemoryAccepted:false,
      editedSaveProduced:false});
  }catch(e){self.postMessage({type:'ERROR',sessionId,code:String(e?.message??e)});}
};
