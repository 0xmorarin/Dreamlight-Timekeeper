// 05 QR / November RC: negative acceptance for ONLY PR25 ancestor symlink delta.
// This does not execute the old 38-file staging inventory audit or issue release authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,symlink,lstat,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stageSveltekitReviewOnly} from '../scripts/stage-sveltekit-review-only.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
async function withTemp(fn){
 const base=await mkdtemp(join(tmpdir(),'tk-qr-nov-pr25-'));
 try{await fn(base);}finally{await rm(base,{recursive:true,force:true});}
}
async function rejectedBeforeOutput(base,{sourceRoot,buildRoot},label){
 const output=join(base,'must-not-exist');
 await assert.rejects(stageSveltekitReviewOnly({sourceRoot,buildRoot,outputRoot:output}),new RegExp('REVIEW_STAGE_SYMLINK_OR_INVALID_'+label));
 await assert.rejects(lstat(output),{code:'ENOENT'});
}
test('05QR fixed PR25: symlink sourceRoot ANCESTOR denied before realpath',async()=>{
 await withTemp(async base=>{
  const parent=join(base,'linked-parent');
  await symlink(dirname(root),parent,'dir');
  const sourceRoot=join(parent,basename(root));
  await rejectedBeforeOutput(base,{sourceRoot,buildRoot:join(root,'scripts')},'SOURCE_ROOT');
 });
});
test('05QR fixed PR25: symlink buildRoot ANCESTOR denied before realpath',async()=>{
 await withTemp(async base=>{
  const parent=join(base,'linked-parent');
  await symlink(dirname(root),parent,'dir');
  const buildRoot=join(parent,basename(root),'scripts');
  await rejectedBeforeOutput(base,{sourceRoot:root,buildRoot},'BUILD_ROOT');
 });
});
test('05QR fixed PR25: nested symlink two levels above sourceRoot and buildRoot denied',async()=>{
 await withTemp(async base=>{
  const canonical=join(base,'canonical-parent');
  await mkdir(join(canonical,'source','nested'),{recursive:true});
  const alias=join(base,'linked');
  await symlink(canonical,alias,'dir');
  await rejectedBeforeOutput(base,{
   sourceRoot:join(alias,'source','nested'),buildRoot:join(root,'scripts')
  },'SOURCE_ROOT');
  const output=join(base,'must-not-exist');
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:root,buildRoot:join(alias,'source','nested'),outputRoot:output
  }),/REVIEW_STAGE_SYMLINK_OR_INVALID_BUILD_ROOT/);
  await assert.rejects(lstat(output),{code:'ENOENT'});
 });
});
test('05QR fixed PR25: prior leaf symlink remains denied, no output',async()=>{
 await withTemp(async base=>{
  const alias=join(base,'leaf-link');
  await symlink(root,alias,'dir');
  await rejectedBeforeOutput(base,{sourceRoot:alias,buildRoot:join(root,'scripts')},'SOURCE_ROOT');
 });
});
