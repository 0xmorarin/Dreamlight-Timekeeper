// 05 QR: exact PR43 cumulative composition and integration gates.
// Do not rerun previously accepted PR39 staging/WEB42 browser test matrices.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const BASE='1a466847a1ab6a174a4dbbc9ad863346fff0542d';
const SOURCE='352c1f9b8af6549cf244b04c134051846b07eb8b';
const PR43='20ed2f4a6e90453eb7d63652955bf34c69e8c3ef';
const WEB31='302e877456c35ab4de46e409d59e6b6ebae60e46';
const web=[
 '.github/workflows/web-readonly-rc-validate-v1.yml',
 'contracts/web-readonly-core-worker-v1.json',
 'contracts/web-readonly-rc-release-v1.json',
 'data/web-text-item-types-v1253.json',
 'src/lib/timekeeper/item-text-only.mjs',
 'src/lib/timekeeper/read-only-rc-mode.mjs',
 'src/lib/timekeeper/save-session-contract.ts',
 'src/lib/timekeeper/session-response-fence.mjs',
 'src/lib/timekeeper/worker-projection-bounds.mjs',
 'src/routes/+page.svelte',
 'src/worker.mjs',
 'tests/browser-sveltekit-readonly-text-rc.smoke.mjs',
 'tests/web-readonly-rc-contract.test.mjs'
];
const ci='.github/workflows/00ctrl-rc-composite-review.yml';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
test('QR43 has EXACT 13 WEB42 source Git blobs plus ONLY one CTRL integration workflow',()=>{
 const changed=git('diff','--name-only',BASE,PR43).split('\n').sort();
 assert.deepEqual(changed,[...web,ci].sort());
 for(const path of web){
  assert.equal(git('rev-parse',PR43+':'+path),git('rev-parse',SOURCE+':'+path),'different from WEB42 '+path);
 }
 for(const path of ['scripts/stage-sveltekit-review-only.mjs',
 'tests/ctrl-sveltekit-review-stage.test.mjs',
 '.github/workflows/00ctrl-sveltekit-review-stage.yml']){
  assert.equal(git('rev-parse',PR43+':'+path),git('rev-parse',BASE+':'+path),'modified CTRL38 accepted stage '+path);
 }
});
test('QR43 no source overlap and no injected functional edit or producer beyond original WEB42',()=>{
 for(const path of ['src/lib/timekeeper/item-text-only.mjs',
 'src/lib/timekeeper/read-only-rc-mode.mjs','src/worker.mjs']){
  // All changes are precisely WEB42, so no integration-specific Worker hooks.
  assert.equal(git('rev-parse',PR43+':'+path),git('rev-parse',SOURCE+':'+path));
 }
 const worker=await readFile(new URL('../src/worker.mjs',import.meta.url),'utf8');
 const flag=await readFile(new URL('../src/lib/timekeeper/read-only-rc-mode.mjs',import.meta.url),'utf8');
 const release=JSON.parse(await readFile(new URL('../contracts/web-readonly-rc-release-v1.json',import.meta.url)));
 assert.match(worker,/if\(data.type==='prepareEdited'\)\{\s*if\(READONLY_TEXT_RC_BUILD\)throw Error\('RC_READ_ONLY_WRITER_DISABLED'\)/);
 assert(flag.includes("VITE_WEB_READONLY_RC==='1'"));
 assert.equal(release.product.writerEnabled,false);
 assert.equal(release.product.editedCopyOutputEnabled,false);
 assert.equal(release.product.productRustReadEnabled,false);
 assert.equal(release.product.originalJsWorkerKeptForComparison,true);
 assert.equal(release.status,'DRAFT_NEVER_DEPLOY');
 assert.equal(release.releaseGates.publicReleaseApproved,false);
 assert.equal(release.releaseGates.workerSideBuildModeBehaviorVerified,false);
});
test('QR43 review workflow has build BEFORE stage, bound reviewed source, no upload/deploy',async()=>{
 const wf=await readFile(new URL('../.github/workflows/00ctrl-rc-composite-review.yml',import.meta.url),'utf8');
 const webWf=await readFile(new URL('../.github/workflows/web-readonly-rc-validate-v1.yml',import.meta.url),'utf8');
 const stage=wf.indexOf('node scripts/stage-sveltekit-review-only.mjs build');
 const build=wf.indexOf('npm run build');
 const stageTests=wf.indexOf('node --test tests/ctrl-sveltekit-review-stage.test.mjs');
 assert(build>=0 && stageTests>build && stage>stageTests);
 assert(wf.includes("VITE_WEB_READONLY_RC: '1'"));
 assert(wf.includes('NODE_')===false || !wf.includes('NODE_OPTIONS: --inspect'));
 assert(!/^\s*(?:run:\s*)?(?:gh release|npm publish|deploy-pages|upload-pages-artifact|actions\/upload-artifact|git push)\b/m.test(wf));
 assert(!wf.includes('upload-artifact@'));
 assert(wf.includes('RUNNER_TEMP'));
 assert(!webWf.includes('deploy-pages'));
 assert(wf.includes('permissions:\n  contents: read'));

});
