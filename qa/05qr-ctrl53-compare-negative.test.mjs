// Independent 05 QR CTRL53: fail-closed compare job semantics are exercised,
// without re-running 2 full independent builds already successful on fixed PR53.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
const path=new URL('../.github/workflows/00ctrl-rc-independent-runner-digest.yml',import.meta.url);
const wf=await readFile(path,'utf8');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const head='8b8c1ed90c604b1e3d41df8031806570612ced62';
const origin='907e7cd4ac36c1166d974d46e0da39e3bee360de';
const sha='6bc183045bd7db09e53a7fa196371ccafbd10f2e6137d2ed55ceadeaed935ce1';
test('QR CTRL53 exact one-file workflow delta on unchanged frozen WEB52 product blobs',()=>{
 assert.deepEqual(git('diff','--name-only',origin,head).split('\n'),
 ['.github/workflows/00ctrl-rc-independent-runner-digest.yml']);
 for(const file of ['src/worker.mjs','src/lib/timekeeper/core-read-worker-bridge.mjs',
  'scripts/audit-sveltekit-build.mjs','scripts/verify-readonly-rc-candidate.mjs',
  'svelte.config.js','contracts/web-readonly-core-worker-v1.json']){
   assert.equal(git('rev-parse',origin+':'+file),git('rev-parse',head+':'+file));
 }
});
test('QR CTRL53 jobs use SAME explicit immutable requested commit on separate fresh Ubuntu runners',()=>{
 assert.match(wf,/permissions:\s*\n\s*contents: read/);
 assert.match(wf,/runner_a:\s*\n\s*runs-on: ubuntu-24\.04/);
 assert.match(wf,/runner_b:\s*\n\s*runs-on: ubuntu-24\.04/);
 assert.match(wf,/needs: \[runner_a, runner_b\]/);
 assert.equal((wf.match(/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/g)||[]).length,2);
 assert.equal((wf.match(/EXPECTED_COMMIT: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/g)||[]).length,1);
 assert.equal((wf.match(/node-version: '22'/g)||[]).length,2);
 assert.equal((wf.match(/npm install --no-audit --no-fund/g)||[]).length,2);
 assert.equal((wf.match(/VITE_WEB_READONLY_RC: '1'/g)||[]).length,2);
 assert.equal((wf.match(/scripts\/audit-sveltekit-build\.mjs build/g)||[]).length,2);
 assert.equal((wf.match(/scripts\/verify-readonly-rc-candidate\.mjs/g)||[]).length,2);
 assert(!/actions\/upload-artifact|deploy-pages|gh release|npm publish|git push/i.test(wf));
 assert(wf.includes('unpinned package registry'));
});
const marker='      - name: Reject mismatched or missing manifest outputs, no release grant';
const start=wf.indexOf(marker);
assert(start>=0,'fixed compare step missing');
const run=wf.indexOf('        run: |\n',start);
assert(run>0);
const bash=wf.slice(run+'        run: |\n'.length).split('\n')
 .map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
const outputs=()=>({A_DIGEST:sha,B_DIGEST:sha,A_COMMIT:head,B_COMMIT:head,
 A_FILES:'38',B_FILES:'38',A_BYTES:'1670597',B_BYTES:'1670597',
 EXPECTED_COMMIT:head});
const cmp=overrides=>spawnSync('bash',['-e','-o','pipefail','-c',bash],
 {encoding:'utf8',timeout:5000,env:{...process.env,...outputs(),...overrides}});
test('QR CTRL53 reproduces positive identical digest/byte count/HEAD receipt (never release grant)',()=>{
 const r=cmp({});assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/RC_REVIEW_CROSS_RUNNER_SAME_IMAGE_MANIFEST_MATCH/);
 assert.match(r.stdout,/REVIEW_ONLY/);
 assert(r.stdout.includes(sha));
});
for(const [label,bad] of [
 ['different HEAD A',{A_COMMIT:'f'.repeat(40)}],
 ['different HEAD B',{B_COMMIT:'f'.repeat(40)}],
 ['both malicious same wrong HEAD',{A_COMMIT:'f'.repeat(40),B_COMMIT:'f'.repeat(40)}],
 ['expected source changed',{EXPECTED_COMMIT:'f'.repeat(40)}],
 ['B digest differs',{B_DIGEST:'a'.repeat(64)}],
 ['both digest absent',{A_DIGEST:'',B_DIGEST:''}],
 ['malformed A digest',{A_DIGEST:'unknown'}],
 ['mismatched file count',{B_FILES:'37'}],
 ['fewer than 20 files',{A_FILES:'19',B_FILES:'19'}],
 ['mismatched total byte size',{B_BYTES:'1670598'}],
 ['empty artifact',{A_BYTES:'0',B_BYTES:'0'}],
 ['missing B commit',{B_COMMIT:''}],
 ['missing B digest',{B_DIGEST:''}],
 ['missing B files',{B_FILES:''}]
])test('QR CTRL53 independent compare must fail closed: '+label,()=>{
 const r=cmp(bad);
 assert.notEqual(r.status,0,'Unexpected successful comparison for '+label);
 assert(!r.stdout.includes('RC_REVIEW_CROSS_RUNNER_SAME_IMAGE_MANIFEST_MATCH'));
});
test('QR CTRL53 source describes honest limitations: same OS image, unpinned npm registry, no cross-OS/public Writer',()=>{
 for(const s of ['same Ubuntu image','unpinned package registry','no cross-OS claim',
  'no binary upload/deploy','no Writer/public release authorization']){
   assert(wf.includes(s),s);
 }
});
