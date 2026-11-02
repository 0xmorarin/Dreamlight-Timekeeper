// 05 QR Round9 pre-integration CORE scope. Checks what a future real browser run actually proves.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {p1gPackagedProfileCodec as codec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson} from '../src/core/safe-edit-session.mjs';
const source=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('R9 real browser Worker imports the SAME P1G codec and session; opaque origin staging is JSON-only',async()=>{
 const [worker,page,runner,staging]=await Promise.all([
  source('tests/browser-memory/p1g-read-worker.mjs'),
  source('tests/browser-memory/index.html'),
  source('tests/browser-memory/run_browsers.py'),
  source('tests/browser-memory/opaque-origin-staging.py')]);
 assert.match(worker,/import\s*\{p1gPackagedProfileCodec\}\s*from/);
 assert.match(worker,/await\s+p1gPackagedProfileCodec\.loadProfile\(source\)/);
 assert.match(worker,/SafeProfileEditSession\.open\(/);
 assert.match(page,/new Worker\('\/tests\/browser-memory\/p1g-read-worker\.mjs'/);
 assert.match(runner,/"SYNTHETIC_BROWSER_READ_PASS"/);
 assert.match(runner,/\"127\.0\.0\.1\"/);
 assert.match(runner,/"SAMPLED_NOT_EXACT_PEAK"/);
 assert.doesNotMatch(worker,/\.createEncodedProfile\(|\.exportVerifiedCopy\(/);
 assert.match(staging,/JSON\.parse\(e\.data\)/);
 assert.match(staging,/exactCodecExecuted":False/);
 assert.match(staging,/browserCodecAccepted":False/);
 assert.match(staging,/OPAQUE_ORIGIN_SYNTHETIC_WORKER_STAGING_ONLY/);
 assert.equal(worker.includes('browserMemoryAccepted:false'),true);
 assert.equal(page.includes('browserPeakAccepted:false'),true);
});
test('R9 isolated synthetic fixture is a decryptable encrypted P1G, not JSON-only bytes',async()=>{
 const cli=new URL('../tests/browser-memory/synthetic-fixture.mjs',import.meta.url).pathname;
 const made=spawnSync(process.execPath,[cli,'1'],{maxBuffer:2*1024*1024});
 assert.equal(made.status,0,made.stderr.toString());
 const original=new Uint8Array(made.stdout);
 const snapshot=Uint8Array.from(original);
 const loaded=await codec.loadProfile(original);
 const root=parseSafeJson(loaded.jsonText);
 assert.equal(loaded.metadata.profileVersion,626);
 assert.equal(root.Player.Name,'Synthetic');
 assert.equal(root.World.SyntheticOpaque.text.length,1024*1024);
 assert.deepEqual(original,snapshot);
 for(const invalid of ['0','25','128','-1','1.5','NaN']){
  const r=spawnSync(process.execPath,[cli,invalid],{maxBuffer:100000});
  assert.equal(r.status,2,invalid);
  assert.equal(r.stdout.length,0,invalid);
 }
});
test('R9 source contains no browser peak or production save acceptance flag',async()=>{
 const [page,runner,worker]=await Promise.all([source('tests/browser-memory/index.html'),source('tests/browser-memory/run_browsers.py'),source('tests/browser-memory/p1g-read-worker.mjs')]);
 for(const code of [page,runner,worker]){
  assert.doesNotMatch(code,/browserPeakMemoryAccepted":True|browserMemoryAccepted:true|writerAuthorized:true|editedCopyAuthorized:true/);
 }
 assert.match(worker,/workerPeakBytes:null/);
 assert.match(runner,/sharedPagesMayBeDoubleCounted/);
 assert.match(runner,/SAMPLED_30MS_NOT_EXACT_PEAK/);
 assert.match(page,/codecCancellationSignalSupported:false/);
});
