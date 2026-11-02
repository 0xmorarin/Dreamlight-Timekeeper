// 05 QR PR38 integrated fixed HEAD — structural composition only, no 38-file reacceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const fixedWeb='302e877456c35ab4de46e409d59e6b6ebae60e46';
const fixedStage='7d3285b5fd7ff5a6d13a41229b9ba12ae5bb5bd2';
const files=[
 '.github/workflows/00ctrl-sveltekit-review-stage.yml',
 'scripts/stage-sveltekit-review-only.mjs',
 'tests/ctrl-sveltekit-review-stage.test.mjs'
];
const cmd=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
test('QR38 exact incremental integration only 3 stage files against frozen WEB31',()=>{
 const observed=cmd('diff','--name-only',fixedWeb,'HEAD').split('\n').filter(x=>x&&!x.startsWith('qa/')&&!x.includes('/qa-pr38-integrated-rc.yml')).sort();
 assert.deepEqual(observed,files.slice().sort());
 for(const f of files){
  const fromPr25=cmd('rev-parse',fixedStage+':'+f);
  const integrated=cmd('rev-parse','HEAD:'+f);
  assert.match(integrated,/^[0-9a-f]{40}$/);
  assert.equal(integrated,fromPr25,'integrated Git blob differs from QA-accepted fixed PR25: '+f);
 }
});
test('QR38 inherited WEB31 corpus and proposal have exact original Git blob SHA, no new producer',()=>{
 for(const f of [
  'src/lib/timekeeper/session-response-fence.mjs',
  'contracts/web-core-projection-boundary-v1.json',
  'tests/web-projection-qr-fixtures.test.mjs',
  'tests/fixtures/web-projection-negative-corpus.mjs',
  'src/reader.mjs'
 ]){
  assert.equal(cmd('rev-parse','HEAD:'+f),cmd('rev-parse',fixedWeb+':'+f),f);
 }
});
test('QR38 never changes original source build or audit/publication rights',async()=>{
 const stage=await readFile(new URL('../scripts/stage-sveltekit-review-only.mjs',import.meta.url),'utf8');
 const proposal=JSON.parse(await readFile(new URL('../contracts/web-core-projection-boundary-v1.json',import.meta.url),'utf8'));
 const workflow=await readFile(new URL('../.github/workflows/00ctrl-sveltekit-review-stage.yml',import.meta.url),'utf8');
 assert(stage.includes('async function checkInputDirectoryComponents('));
 assert(stage.includes("if(stat.isSymbolicLink()||!stat.isDirectory())"));
 assert(stage.includes("if(reviewed.deployAuthorized!==false||reviewed.writerReleaseAuthorized!==false"));
 assert(stage.includes("publicReleaseApproved:false"));
 assert(stage.includes("mediaRedistributionApproved:false"));
 assert(stage.includes("writerAuthorityChanged:false"));
 assert.equal(proposal.status,'PROPOSED_NOT_IMPLEMENTED_NOT_ACCEPTED');
 assert.equal(proposal.wire.bindingInstalled,false);
 assert.equal(proposal.trust.capabilities.ENCODE_COPY,'DENIED');
 assert.equal(proposal.trust.capabilities.PERSISTENT_REPLACE,'DENIED');
 assert(!workflow.includes('upload-pages-artifact')&&!workflow.includes('deploy-pages'),
  'unexpected public GitHub Pages deploy action');
});
