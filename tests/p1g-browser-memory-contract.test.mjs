// CI validates harness-only safety; it does NOT execute a graphical browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';

const file=fileURLToPath(new URL('./browser-memory/synthetic-fixture.mjs',import.meta.url));
test('browser fixture generator emits decryptable synthetic schema626 P1G and never accepts a save path',async()=>{
 const made=spawnSync(process.execPath,[file,'1'],{maxBuffer:2*1024*1024});
 assert.equal(made.status,0, made.stderr.toString());
 assert(made.stdout.length>0);
 const loaded=await p1gPackagedProfileCodec.loadProfile(new Uint8Array(made.stdout));
 assert.equal(loaded.metadata.profileVersion,626);
 assert(loaded.metadata.zip.profileEntry.uncompressedSize>1024*1024);
 const obj=JSON.parse(loaded.jsonText);
 assert.equal(obj.Player.Name,'Synthetic');
 assert.equal(obj.World.SyntheticOpaque.text.length,1024*1024);
});
test('browser fixture rejects oversized requests and browser worker contains no encode or export entrypoint',async()=>{
 for(const n of ['0','25','128','-1','1.5','NaN']){
  const bad=spawnSync(process.execPath,[file,n],{maxBuffer:200000});
  assert.equal(bad.status,2,n);
  assert.equal(bad.stdout.length,0,n);
 }
 const worker=await readFile(new URL('./browser-memory/p1g-read-worker.mjs',import.meta.url),'utf8');
 const page=await readFile(new URL('./browser-memory/index.html',import.meta.url),'utf8');
 const runner=await readFile(new URL('./browser-memory/run_browsers.py',import.meta.url),'utf8');
 assert(!/createEncodedProfile|exportVerifiedCopy/.test(worker));
 assert(!/createEncodedProfile|exportVerifiedCopy/.test(page));
 assert(runner.includes('browserPeakMemoryAccepted'));
 assert(runner.includes('SAMPLED_NOT_EXACT_PEAK'));
 assert(page.includes("stopActive('session-switch')"));
 assert(worker.includes("performance.memory"));
});
