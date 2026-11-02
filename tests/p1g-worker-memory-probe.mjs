// Synthetic, opt-in Node worker memory PROBE (not a browser peak-memory acceptance).
// Usage: node tests/p1g-worker-memory-probe.mjs 8
// This program neither reads private saves nor encodes/exports modified data.
import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson} from '../src/core/safe-edit-session.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';

const MAX_SYNTHETIC_MIB=24;
function assertMiB(mib) {
 if(!Number.isSafeInteger(mib)||mib<1||mib>MAX_SYNTHETIC_MIB)
  throw new Error('Synthetic MiB must be an integer in [1,24].');
}
function snap() {
 const m=process.memoryUsage();
 return {heapUsed:m.heapUsed,external:m.external,arrayBuffers:m.arrayBuffers,rssProcessWide:m.rss};
}
if(!isMainThread){
 parentPort.on('message',async message=>{
  try{
   if(!message||!(message.source instanceof Uint8Array))
    throw new Error('SYNTHETIC_WORKER_PAYLOAD_INVALID');
   const readings={received:snap()},started=performance.now();
   const loaded=await p1gPackagedProfileCodec.loadProfile(message.source);
   readings.afterCodecLoad=snap();
   const parsed=parseSafeJson(loaded.jsonText);
   readings.afterJsonParse=snap();
   const copy=structuredClone(parsed);
   readings.afterClone=snap();
   const json=JSON.stringify(copy);
   readings.afterSerialize=snap();
   const audit=auditP1gEnvelope({format:'packaged',metadata:loaded.metadata});
   parentPort.postMessage({
    readOnly:true,
    workerNoEncode:true,
    sourceBytes:message.source.byteLength,
    inflatedBytes:loaded.metadata.zip.profileEntry.uncompressedSize,
    jsonChars:json.length,
    schema:loaded.metadata.profileVersion,
    auditStatus:audit.status,
    writerAuthorized:audit.writerAuthorized,
    editedCopyAuthorized:audit.editedCopyAuthorized,
    workerMs:performance.now()-started,
    workerReadings:readings
   });
  }catch(error){parentPort.postMessage({error:String(error?.message||error)});}
 });
}
export async function runSyntheticWorkerProbe(mib=8){
 assertMiB(mib);
 const root={
  GameInfo:{Version:626,InitialVersion:518},
  Player:{Name:'Synthetic'},
  World:{RecurringEvents:{},UnknownPayload:{
   // Highly compressible value inflates beyond ciphertext size.
   text:'W'.repeat(mib*1024*1024),
   ordered:[null,false,'keep',{future:'unchanged'}]
  }}
 };
 const source=makeSyntheticP1gProfile(root);
 const before=Buffer.from(source),mainBefore=snap();
 const worker=new Worker(new URL(import.meta.url),{type:'module'});
 try{
  const result=await new Promise((res,rej)=>{
   worker.once('message',res);worker.once('error',rej);
   // Deliberately structured-clone, not transfer; source remains immutable.
   worker.postMessage({source});
  });
  if(result.error)throw new Error(result.error);
  if(result.writerAuthorized||result.editedCopyAuthorized||!result.workerNoEncode)
   throw new Error('WORKER_CAPABILITY_INVARIANT');
  if(!Buffer.from(source).equals(before))
   throw new Error('SYNTHETIC_SOURCE_MUTATED');
  return {
   ...result,
   environment:'NODE_WORKER_THREADS_NOT_BROWSER_WORKER',
   mib,
   mainBefore,
   mainAfter:snap(),
   memoryEvidence:'SNAPSHOTS_NOT_PEAK',
   browserWorkerPeakAccepted:false,
   runtimeSaveAccepted:false
  };
 }finally{await worker.terminate();}
}
if(isMainThread&&process.argv[1]&&
 resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const value=process.argv[2]===undefined?8:Number(process.argv[2]);
 runSyntheticWorkerProbe(value).then(report=>{
  process.stdout.write(JSON.stringify(report)+'\n');
 }).catch(error=>{
  process.stderr.write('P1G_SYNTHETIC_WORKER_PROBE_FAILED: '+error.message+'\n');
  process.exitCode=1;
 });
}
