// 05 QR: only PR25 HEAD e2fdcad -> 2822aea symlink security delta.
// No prior 38-file stage tests re-run. No release or Writer authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,lstat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stageSveltekitReviewOnly} from '../scripts/stage-sveltekit-review-only.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url)),build=join(repo,'build');
async function probe(fn){
 const base=await mkdtemp(join(tmpdir(),'tk-qr-symlink-delta-'));
 try{await fn(base);}finally{await rm(base,{recursive:true,force:true});}
}
test('independent fixed PR25: symlink buildRoot denied BEFORE realpath and output absent',async()=>{
 await probe(async base=>{
  const alias=join(base,'alias');
  await symlink(build,alias,'dir');
  const dest=join(base,'uncreated');
  await assert.rejects(stageSveltekitReviewOnly({sourceRoot:repo,buildRoot:alias,outputRoot:dest}),
   e=>e.message==='REVIEW_STAGE_SYMLINK_OR_INVALID_BUILD_ROOT');
  await assert.rejects(lstat(dest),{code:'ENOENT'});
 });
});
test('independent fixed PR25: symlink sourceRoot denied BEFORE realpath and output absent',async()=>{
 await probe(async base=>{
  const alias=join(base,'alias');
  await symlink(repo,alias,'dir');
  const dest=join(base,'uncreated');
  await assert.rejects(stageSveltekitReviewOnly({sourceRoot:alias,buildRoot:build,outputRoot:dest}),
   e=>e.message==='REVIEW_STAGE_SYMLINK_OR_INVALID_SOURCE_ROOT');
  await assert.rejects(lstat(dest),{code:'ENOENT'});
 });
});
test('independent fixed PR25: invalid input leaf refuses before any output created',async()=>{
 await probe(async base=>{
  const dest=join(base,'uncreated');
  await mkdir(join(base,'empty'));
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:repo,buildRoot:join(base,'empty','missing'),outputRoot:dest
  }),{code:'ENOENT'});
  await assert.rejects(lstat(dest),{code:'ENOENT'});
 });
});
test('independent observation: ancestor symlink remains a different unresolved boundary',async()=>{
 await probe(async base=>{
  // This test does not assert that the current code rejects *ancestors*.
  // Source leaf is a directory, but its parent can be a symlink.
  const alias=join(base,'checkout');
  await symlink(repo,alias,'dir');
  const sourceSubdir=join(alias,'data');
  const dest=join(base,'uncreated');
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:sourceSubdir,buildRoot:build,outputRoot:dest
  }),/REVIEW_STAGE_COMPILED_BUILD_REQUIRED/);
  await assert.rejects(lstat(dest),{code:'ENOENT'});
 });
});
