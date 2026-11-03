// 05 QR / PR43: cumulative composition is the ONLY new scope vs QR39 and WEB42.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const BASE='1a466847a1ab6a174a4dbbc9ad863346fff0542d';
const WEB42='352c1f9b8af6549cf244b04c134051846b07eb8b';
const FIXED='20ed2f4a6e90453eb7d63652955bf34c69e8c3ef';
const imported=[
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
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
test('QR43: exactly 13 WEB42 source Git blobs and one CTRL workflow (no overlapping edits)',()=>{
 const actual=git('diff','--name-only',BASE,FIXED).split('\n').filter(Boolean).sort();
 assert.deepEqual(actual,[...imported,'.github/workflows/00ctrl-rc-composite-review.yml'].sort());
 for(const path of imported){
  assert.equal(git('rev-parse',FIXED+':'+path),git('rev-parse',WEB42+':'+path),path);
 }
 for(const path of ['scripts/stage-sveltekit-review-only.mjs',
  'tests/ctrl-sveltekit-review-stage.test.mjs','.github/workflows/00ctrl-sveltekit-review-stage.yml']){
   assert.equal(git('rev-parse',FIXED+':'+path),git('rev-parse',BASE+':'+path),path);
 }
});
test('QR43: Worker read-only build explicitly rejects direct prepareEdited and retains backup',async()=>{
 const worker=await readFile(new URL('../src/worker.mjs',import.meta.url),'utf8');
 const flag=await readFile(new URL('../src/lib/timekeeper/read-only-rc-mode.mjs',import.meta.url),'utf8');
 const release=JSON.parse(await readFile(new URL('../contracts/web-readonly-rc-release-v1.json',import.meta.url)));
 const core=JSON.parse(await readFile(new URL('../contracts/web-readonly-core-worker-v1.json',import.meta.url)));
 assert.match(worker,/if\(data.type==='prepareEdited'\)\{\s*if\(READONLY_TEXT_RC_BUILD\)throw Error\('RC_READ_ONLY_WRITER_DISABLED'\)/);
 assert.match(worker,/if\(data.type==='backup'\)\{/);
 assert(flag.includes("VITE_WEB_READONLY_RC==='1'"));
 assert.equal(release.status,'DRAFT_NEVER_DEPLOY');
 assert.equal(release.product.writerEnabled,false);
 assert.equal(release.product.editedCopyOutputEnabled,false);
 assert.equal(release.product.productRustReadEnabled,false);
 assert.equal(release.product.assetRasterImagesApproved,0);
 assert.equal(release.releaseGates.workerSideBuildModeBehaviorVerified,false);
 assert.equal(release.releaseGates.publicReleaseApproved,false);
 assert.equal(core.actualReadWorkerEnabled,false);
 assert.equal(core.transport.workerHelperWiredToRealCore,false);
 assert.equal(core.permissions.ENCODE_COPY,false);
 assert.equal(core.permissions.PERSISTENT_REPLACE,false);
});
test('QR43: cumulative CI builds and audits before staged copy; no publish/upload permissions',async()=>{
 const wf=await readFile(new URL('../.github/workflows/00ctrl-rc-composite-review.yml',import.meta.url),'utf8');
 const build=wf.indexOf('npm run build');
 const audit=wf.indexOf('node scripts/audit-sveltekit-build.mjs');
 const stageTests=wf.indexOf('node --test tests/ctrl-sveltekit-review-stage.test.mjs');
 const stage=wf.indexOf('node scripts/stage-sveltekit-review-only.mjs build');
 assert(build>0&&audit>build&&stageTests>audit&&stage>stageTests);
 assert(wf.includes("VITE_WEB_READONLY_RC: '1'"));
 assert(wf.includes('RUNNER_TEMP'));
 assert(wf.includes('permissions:\n  contents: read'));
 assert(!/actions\/upload-artifact|upload-pages-artifact|deploy-pages|npm publish|gh release|git push/i.test(wf));
 assert(!/DDV_PRIVATE_P1G_PATH|DDV_PRIVATE_CODEC_KEY_HEX/.test(wf));
});
