// 05 QR independent tests of the exact integrated PR25 staging code.
// Synthetic probes only. This file does NOT deploy, publish, or approve the stage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditSveltekitBuild} from '../scripts/audit-sveltekit-build.mjs';
import {stageSveltekitReviewOnly} from '../scripts/stage-sveltekit-review-only.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const built=join(root,'build');
const hash=v=>createHash('sha256').update(v).digest('hex');
async function sandbox(run){
 const base=await fs.mkdtemp(join(tmpdir(),'qr-stage-independent-'));
 try {return await run(base);} finally{await fs.rm(base,{recursive:true,force:true});}
}
async function fakeSource(base){
 const src=join(base,'source'),output=join(src,'build');
 await fs.mkdir(src);
 await fs.cp(join(root,'data'),join(src,'data'),{recursive:true});
 await fs.cp(built,output,{recursive:true});
 return {src,output};
}
test('05QR: actual built review artifact 38 paths have independent per-file source SHA and no forbidden media',async()=>{
 const a=await auditSveltekitBuild(built,{sourceRoot:root});
 assert.equal(a.totalFiles,38,'changed compiled list requires re-review');
 assert.equal(a.ownerSvgCount,16);
 assert.equal(a.workerDataCount,3);
 assert.equal(a.totalBytes,1659643,'compiled reproducibility against reviewed runner bytes');
 const expectedClasses=new Set(['OWNER_ORIGINAL_PROVISIONAL_SVG','INFORMATIONAL_NOTICE','WORKER_DATA_REVIEW_REQUIRED','HTML_ENTRY','COMPILED_STATIC']);
 assert(a.files.every(x=>expectedClasses.has(x.class)));
 assert.equal(new Set(a.files.map(x=>x.path)).size,38);
 assert.equal(a.files.filter(x=>x.class==='OWNER_ORIGINAL_PROVISIONAL_SVG').length,16);
 assert.equal(a.files.filter(x=>x.class==='WORKER_DATA_REVIEW_REQUIRED').length,3);
 assert.equal(a.files.filter(x=>x.class==='HTML_ENTRY').length,2);
 assert(a.files.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
 for(const x of a.files){
  const bytes=await fs.readFile(join(built,x.path));
  assert.equal(bytes.byteLength,x.bytes);
  assert.equal(hash(bytes),x.sha256,x.path);
  assert(!/\.(?:webp|png|jpg|jpeg|zip|p1g|nca|nsp|wasm|map|key)$/i.test(x.path));
 }
 const report=await stageSveltekitReviewOnly({sourceRoot:root,buildRoot:built,
  outputRoot:join(await fs.mkdtemp(join(tmpdir(),'qr-stage-output-')),'review')});
 assert.equal(report.fileCount,38);
 assert.equal(report.totalBytes,1659643);
 assert.equal(report.inventorySha256,'26f97588d604ae69f8f2fa0ba81e85550684d79de8c9733ad6c997c1bfaffe79',
  'full inventory SHA differs from exact previous fixed-HEAD stage run');
 assert.equal(report.deployAuthorized,false);
 assert.equal(report.publicReleaseApproved,false);
 assert.equal(report.mediaRedistributionApproved,false);
 assert.equal(report.writerAuthorityChanged,false);
});
test('05QR: duplicate output, checkout overlap and parent symlink fail closed',async()=>{
 await sandbox(async base=>{
  const destination=join(base,'review');
  await fs.mkdir(destination);
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:root,buildRoot:built,outputRoot:destination}),/EEXIST/);
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:root,buildRoot:built,outputRoot:join(root,'qa','under-checkout')}),/OVERLAP/);
  const link=join(base,'alias');await fs.symlink(root,link,'dir');
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:root,buildRoot:built,outputRoot:join(link,'out')}),/SYMLINK|OVERLAP/);
 });
});
test('05QR: unexpected game raster and leaf symlink are rejected before destination creation',async()=>{
 await sandbox(async base=>{
  const {src,output}=await fakeSource(base);
  const destination=join(base,'uncreated');
  await fs.writeFile(join(output,'fake-game.webp'),'synthetic');
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:src,buildRoot:output,outputRoot:destination}),/UNAPPROVED_DISTRIBUTION_PATH/);
  await fs.rm(join(output,'fake-game.webp'));
  await fs.symlink(join(output,'index.html'),join(output,'evil-entry.js'));
  await assert.rejects(stageSveltekitReviewOnly({
   sourceRoot:src,buildRoot:output,outputRoot:destination}),/SYMLINK_FORBIDDEN/);
  await assert.rejects(fs.lstat(destination),{code:'ENOENT'});
 });
});
test('05QR: interruption during copying triggers cleanup and no partial review folder',async()=>{
 await sandbox(async base=>{
  const dest=join(base,'review');
  const original=fs.writeFile;
  let copied=0;
  fs.writeFile=async(...args)=>{
   const out=await original(...args);
   copied++;
   throw Error('QR_INJECTED_AFTER_FIRST_COPY');
  };
  syncBuiltinESMExports();
  try{
   await assert.rejects(stageSveltekitReviewOnly({
    sourceRoot:root,buildRoot:built,outputRoot:dest}),/QR_INJECTED_AFTER_FIRST_COPY/);
  }finally{
   fs.writeFile=original;
   syncBuiltinESMExports();
  }
  assert.equal(copied,1);
  await assert.rejects(fs.lstat(dest),{code:'ENOENT'});
 });
});
test('05QR: allowed JS path is NOT a content-level secret/publication proof',async()=>{
 // This test deliberately establishes the LIMIT of the current audit.
 // No genuine secret or game data is used. It must NOT grant distribution.
 await sandbox(async base=>{
  const {src,output}=await fakeSource(base);
  const inventory=await auditSveltekitBuild(output,{sourceRoot:src});
  const chunk=inventory.files.find(x=>x.path.startsWith('_app/immutable/chunks/')&&x.path.endsWith('.js'));
  assert(chunk);
  const marker='QR_SYNTHETIC_SECRET_MARKER_NOT_REAL';
  await fs.appendFile(join(output,chunk.path),'\n/*'+marker+'*/\n');
  const audited=await auditSveltekitBuild(output,{sourceRoot:src});
  assert.notEqual(audited.files.find(x=>x.path===chunk.path).sha256,
                  inventory.files.find(x=>x.path===chunk.path).sha256);
  const dest=join(base,'review');
  const receipt=await stageSveltekitReviewOnly({sourceRoot:src,buildRoot:output,outputRoot:dest});
  assert.equal(receipt.fileCount,38);
  assert((await fs.readFile(join(dest,chunk.path),'utf8')).includes(marker));
  assert.equal(receipt.deployAuthorized,false);
  // REVIEW FINDING: generic compiled JS content is not verified against a
  // frozen trusted binary manifest; the compiled stage is NOT public-safe.
 });
});
test('05QR: buildRoot symlink resolves through realpath (documented gap, not a rejection PASS)',async()=>{
 await sandbox(async base=>{
  const link=join(root,'build');
  const alias=join(base,'build-alias');
  await fs.symlink(link,alias,'dir');
  const target=join(base,'review');
  // Current implementation follows the buildRoot symlink BEFORE lstat.
  // This is an observed bypass of a broad "all symlinks refused" assertion,
  // though the resulting real target is still constrained under sourceRoot.
  const receipt=await stageSveltekitReviewOnly({sourceRoot:root,buildRoot:alias,outputRoot:target});
  assert.equal(receipt.fileCount,38);
  assert.equal(receipt.publicReleaseApproved,false);
 });
});
