// CI-smoke only: memory numbers are diagnostic Node snapshots, NEVER browser acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import {runSyntheticWorkerProbe} from './p1g-worker-memory-probe.mjs';

test('1MiB synthetic profile crosses a Node Worker clone boundary without granting Writer',async()=>{
 const r=await runSyntheticWorkerProbe(1);
 assert.equal(r.environment,'NODE_WORKER_THREADS_NOT_BROWSER_WORKER');
 assert.equal(r.memoryEvidence,'SNAPSHOTS_NOT_PEAK');
 assert.equal(r.browserWorkerPeakAccepted,false);
 assert.equal(r.runtimeSaveAccepted,false);
 assert.equal(r.workerNoEncode,true);
 assert.equal(r.readOnly,true);
 assert.equal(r.schema,626);
 assert.equal(r.writerAuthorized,false);
 assert.equal(r.editedCopyAuthorized,false);
 assert.equal(r.inflatedBytes>1024*1024,true);
 assert.equal(r.sourceBytes>0,true);
 assert.equal(r.workerReadings.received.heapUsed>0,true);
 assert.equal(r.workerReadings.afterCodecLoad.rssProcessWide>0,true);
});
test('memory probe refuses oversized/invalid synthetic allocations before generating a save',async()=>{
 for(const mib of [0,-1,25,128,1.5,NaN,Infinity]){
  await assert.rejects(runSyntheticWorkerProbe(mib),/Synthetic MiB/);
 }
});
