import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,copyFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {auditSveltekitBuild} from '../scripts/audit-sveltekit-build.mjs';
const sourceRoot=new URL('../',import.meta.url).pathname;
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'tk-static-review-'));
 const put=async(path,source)=>{
  const name=join(root,path);await mkdir(dirname(name),{recursive:true});
  if(source)await copyFile(join(sourceRoot,source),name);else await writeFile(name,'synthetic');
 };
 await put('index.html');await put('404.html');
 await put('_app/immutable/entry/start.abc.js');await put('_app/immutable/workers/worker.abc.js');
 await put('assets/app/release-notice.css');
 const manifest=JSON.parse(await readFile(join(sourceRoot,'data/app-ui-icons.json'),'utf8'));
 for(const icon of Object.values(manifest.icons).filter(x=>x.verified&&x.kind==='app_ui'))
  await put(icon.path,icon.path);
 await put('_app/immutable/workers/assets/events-v1253-abc.json','data/events-v1253.json');
 await put('_app/immutable/workers/assets/timing-review-rules-v1253-def.json','data/timing-review-rules-v1253.json');
 await put('_app/immutable/workers/assets/item-names-v1250.json-ghi.bin','data/item-names-v1250.json.gz');
 return {root,put};
}
test('review-only inventory enumerates exact bytes and owner original svg16',async()=>{
 const {root}=await fixture();
 try{
  const report=await auditSveltekitBuild(root,{sourceRoot});
  assert.equal(report.deployAuthorized,false);
  assert.equal(report.writerReleaseAuthorized,false);
  assert.equal(report.ownerSvgCount,16);
  assert.equal(report.workerDataCount,3);
  assert.equal(report.workerCode.length,1);
  assert(report.files.every(f=>/^[a-f0-9]{64}$/.test(f.sha256)));
  assert(report.files.every(f=>!f.path.endsWith('.webp')));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('unapproved game WebP, unknown file, metadata drift fail closed',async()=>{
 const {root,put}=await fixture();
 try{
  await put('assets/steam/v1253/ui/skill/mining.webp');
  await assert.rejects(auditSveltekitBuild(root,{sourceRoot}),/UNAPPROVED_DISTRIBUTION_PATH/);
  await rm(join(root,'assets/steam'),{recursive:true,force:true});
  await put('docs/README.md');
  await assert.rejects(auditSveltekitBuild(root,{sourceRoot}),/UNAPPROVED_DISTRIBUTION_PATH/);
  await rm(join(root,'docs'),{recursive:true,force:true});
  await writeFile(join(root,'_app/immutable/workers/assets/events-v1253-abc.json'),'not canonical');
  await assert.rejects(auditSveltekitBuild(root,{sourceRoot}),/WORKER_DATA_SOURCE_MISMATCH/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('missing required worker and SVG mismatch cannot stage',async()=>{
 const {root,put}=await fixture();
 try{
  await rm(join(root,'_app/immutable/workers/worker.abc.js'));
  await assert.rejects(auditSveltekitBuild(root,{sourceRoot}),/INCOMPLETE_SVELTEKIT_ARTIFACT/);
  await put('_app/immutable/workers/worker.abc.js');
  await writeFile(join(root,'assets/app/ui/action/clock.svg'),'modified');
  await assert.rejects(auditSveltekitBuild(root,{sourceRoot}),/OWNER_SVG_HASH_DRIFT/);
 }finally{await rm(root,{recursive:true,force:true});}
});
