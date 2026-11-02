import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,lstat,mkdtemp,mkdir,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stageSveltekitReviewOnly} from '../scripts/stage-sveltekit-review-only.mjs';
import {auditSveltekitBuild} from '../scripts/audit-sveltekit-build.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const build=join(repo,'build');
async function sandbox(fn){
 const base=await mkdtemp(join(tmpdir(),'timekeeper-00ctrl-review-'));
 try{return await fn(base);}finally{await rm(base,{recursive:true,force:true});}
}
test('00 CTRL stages only byte-identical audited SvelteKit output, without grant',async()=>{
 await sandbox(async base=>{
  const target=join(base,'review');
  const before=await auditSveltekitBuild(build,{sourceRoot:repo});
  const receipt=await stageSveltekitReviewOnly({sourceRoot:repo,buildRoot:build,outputRoot:target});
  const after=await auditSveltekitBuild(target,{sourceRoot:repo});
  assert.equal(receipt.contract,'timekeeper.sveltekit-review-stage@1');
  assert.equal(receipt.releaseProfile,'OWNER_SVG_TEXT_ONLY_REVIEW');
  for(const name of ['deployAuthorized','publicReleaseApproved','mediaRedistributionApproved',
   'writerAuthorityChanged','sourceTreeCopied'])assert.equal(receipt[name],false,name);
  assert.equal(receipt.fileCount,before.totalFiles);
  assert.deepEqual(after.files,before.files);
  assert.ok(receipt.fileCount>20);
  assert.ok(!after.files.some(x=>/\.(?:webp|p1g|nsp|zip|wasm)$/i.test(x.path)));
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:repo,buildRoot:build,outputRoot:target
  }),/EEXIST/);
 });
});

test('00 CTRL refuses source/output overlap and symlinked parent',async()=>{
 await sandbox(async base=>{
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:repo,buildRoot:build,outputRoot:join(repo,'dist','review')
  }),/OVERLAP/);
  const link=join(base,'link');
  await symlink(repo,link,'dir');
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:repo,buildRoot:build,outputRoot:join(link,'review')
  }),/SYMLINK|OVERLAP/);
 });
});

test('00 CTRL refuses symlinked compiled buildRoot and sourceRoot before realpath',async()=>{
 await sandbox(async base=>{
  const buildAlias=join(base,'build-alias');
  await symlink(build,buildAlias,'dir');
  const target=join(base,'blocked-build-alias');
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:repo,buildRoot:buildAlias,outputRoot:target
  }),/REVIEW_STAGE_SYMLINK_OR_INVALID_BUILD_ROOT/);
  await assert.rejects(lstat(target),{code:'ENOENT'});
  const sourceAlias=join(base,'source-alias');
  await symlink(repo,sourceAlias,'dir');
  const target2=join(base,'blocked-source-alias');
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:sourceAlias,buildRoot:build,outputRoot:target2
  }),/REVIEW_STAGE_SYMLINK_OR_INVALID_SOURCE_ROOT/);
  await assert.rejects(lstat(target2),{code:'ENOENT'});
 });
});

test('00 CTRL refuses unexpected media or executable files in compiled stage',async()=>{
 await sandbox(async base=>{
  const source=join(base,'source'),altered=join(source,'build');
  await mkdir(source);
  await cp(join(repo,'data'),join(source,'data'),{recursive:true});
  await cp(build,altered,{recursive:true});
  await writeFile(join(altered,'unapproved-game.webp'),Buffer.from('fake'));
  const target=join(base,'should-not-exist');
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:source,buildRoot:altered,outputRoot:target
  }),/UNAPPROVED_DISTRIBUTION_PATH/);
  await assert.rejects(lstat(target),{code:'ENOENT'});
 });
});

test('00 CTRL denies independently changed Owner SVG bytes',async()=>{
 await sandbox(async base=>{
  const source=join(base,'source'),altered=join(source,'build');
  await mkdir(source);
  await cp(join(repo,'data'),join(source,'data'),{recursive:true});
  await cp(build,altered,{recursive:true});
  const inventory=await auditSveltekitBuild(build,{sourceRoot:repo});
  const svg=inventory.files.find(x=>x.class==='OWNER_ORIGINAL_PROVISIONAL_SVG');
  assert.ok(svg);
  const path=join(altered,svg.path);
  const bytes=await readFile(path);
  await writeFile(path,Buffer.concat([bytes,Buffer.from('<!--mutation-->')]));
  const target=join(base,'should-not-exist');
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:source,buildRoot:altered,outputRoot:target
  }),/OWNER_SVG_HASH_DRIFT/);
  await assert.rejects(lstat(target),{code:'ENOENT'});
 });
});
