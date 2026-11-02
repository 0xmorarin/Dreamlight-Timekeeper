import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bytesEqual} from './browser-memory/source-integrity.mjs';
const sha=async bytes=>Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');

test('same-length mutated synthetic copy is rejected by exact-byte comparison and SHA-256',async()=>{
 const original=Uint8Array.of(0,2,6,8,255,99);
 const same=original.slice();assert.equal(bytesEqual(original,same),true);
 const mutated=same.slice();mutated[2]^=0x40;
 assert.equal(mutated.byteLength,original.byteLength);
 assert.equal(bytesEqual(original,mutated),false);
 assert.notEqual(await sha(original),await sha(mutated));
 const last=original.slice();last[last.length-1]^=1;
 assert.equal(bytesEqual(original,last),false);
 assert.deepEqual([...original],[0,2,6,8,255,99]);
});
test('transfer detachment is NOT proof of post-send byte identity',async()=>{
 const original=Uint8Array.of(1,3,5,7,9),input=original.slice();
 const beforeHash=await sha(original);
 assert.equal(bytesEqual(original,input),true);
 const received=structuredClone(input,{transfer:[input.buffer]});
 assert.equal(input.byteLength,0);
 assert.equal(bytesEqual(original,input),false);
 assert.equal(bytesEqual(original,received),true);
 assert.equal(await sha(original),beforeHash);
 assert.equal(await sha(received),beforeHash);
});
test('helper rejects invalid shapes and detects all changed byte positions',()=>{
 const bytes=Uint8Array.from({length:256},(_,i)=>i);
 for(let i=0;i<bytes.length;i++){
  const modified=bytes.slice();modified[i]^=1;
  assert.equal(bytesEqual(bytes,modified),false,`offset ${i}`);
 }
 assert.equal(bytesEqual(bytes,bytes.slice()),true);
 assert.equal(bytesEqual(bytes,[]),false);
 assert.equal(bytesEqual(bytes,new Uint8Array(0)),false);
});
test('browser harness never presents length-only and transfer shortcut as preserved source evidence',async()=>{
 const base=new URL('./browser-memory/',import.meta.url);
 const page=await readFile(new URL('index.html',base),'utf8');
 const worker=await readFile(new URL('p1g-read-worker.mjs',base),'utf8');
 const runner=await readFile(new URL('run_browsers.py',base),'utf8');
 assert.match(page,/bytesEqual\(original,input\)/);
 assert.match(page,/digest\(original\)/);
 assert.match(page,/digest\(input\)/);
 assert.match(page,/done\.workerReceivedSourceSha256!==originalHash/);
 assert.match(worker,/workerReceivedSourceSha256/);
 assert.match(page,/NOT_POSSIBLE_DETACHED/);
 assert.doesNotMatch(page,/sourceCopyPreserved\s*:/);
 assert.doesNotMatch(page,/original\.byteLength===input\.byteLength\s*\|\|/);
 for(const f of ['preSendExactByteMatch','preSendSha256Match','originalSourceSha256Unchanged','workerReceivedSourceSha256Match']){
  assert(page.includes(f)&&runner.includes(f),f);
 }
 assert(runner.includes('NO_VALID_RSS_SAMPLES'));
 assert(runner.includes('rssPeakAccepted'));
 assert(runner.includes('sharedPagesMayBeDoubleCounted'));
 assert(runner.includes('shortLivedSpikesMayBeMissed'));
});
