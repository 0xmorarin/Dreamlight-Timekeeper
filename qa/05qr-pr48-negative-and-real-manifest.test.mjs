// Independent 05 QR / PR48: negative authority matrix + built bytes independent hash.
// Source QA is pinned to b4450e0e847fd93670c3461312c5911387e483fb,
// and does NOT rerun unrelated old WEB44 UI/QR45 tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyReadOnlyRcCandidate} from '../scripts/verify-readonly-rc-candidate.mjs';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const release=await read('contracts/web-readonly-rc-release-v1.json');
const core=await read('contracts/web-readonly-core-worker-v1.json');
const types=await read('data/web-text-item-types-v1253.json');
const good=()=>({release:structuredClone(release),core:structuredClone(core),
  types:structuredClone(types),buildFlag:'1',inventory:{
  contract:'timekeeper.sveltekit-build-audit@1',totalFiles:21,totalBytes:21,
  ownerSvgCount:16,workerDataCount:3,basePath:'/Dreamlight-Timekeeper',
  deployAuthorized:false,writerReleaseAuthorized:false,
  itemImageRightsAccepted:false,sourceTreeAllowed:false,
  files:Array.from({length:21},(_,i)=>({path:'_app/immutable/chunks/'+i+'.js',
     bytes:1,sha256:'b'.repeat(64),class:'COMPILED_STATIC'}))}});
const bad=[
 ['release Writer',x=>x.release.product.writerEnabled=true],
 ['edited copy',x=>x.release.product.editedCopyOutputEnabled=true],
 ['direct overwrite',x=>x.release.product.directOverwriteEnabled=true],
 ['product Rust READ',x=>x.release.product.productRustReadEnabled=true],
 ['release preview',x=>x.release.releaseGates.publicPreviewApproved=true],
 ['release public',x=>x.release.releaseGates.publicReleaseApproved=true],
 ['Core trusted READ',x=>x.core.actualReadWorkerEnabled=true],
 ['Core Rust WASM installed',x=>x.core.rustReadWasmInstalled=true],
 ['Core producer egress',x=>x.core.transport.productProducerEgressEnforced=true],
 ['Core Writer ENCODE_COPY',x=>x.core.permissions.ENCODE_COPY=true],
 ['image redistribution',x=>x.types.policy.mediaRedistributionPermission='APPROVED'],
 ['image URL authority',x=>x.types.policy.imageUrlAuthority=true],
 ['duplicate ItemID',x=>x.types.items[1][0]=x.types.items[0][0]],
 ['unsorted ItemIDs',x=>x.types.items[6][0]=x.types.items[5][0]-1],
 ['unknown ItemDB family',x=>x.types.items[3][1]='Quest.json'],
 ['forged source Registry SHA',x=>x.types.assetSource.eventRegistrySha256='z'.repeat(64)],
 ['mismatched ItemDB family counts',x=>x.types.counts.Companion=20],
 ['misdeclared inventory bytes',x=>x.inventory.totalBytes=22],
 ['duplicate distribution path',x=>x.inventory.files[1].path=x.inventory.files[0].path],
 ['forged SHA for file',x=>x.inventory.files[1].sha256='0xBAD'],
 ['protected encrypted save',x=>x.inventory.files[2].path='profile.p1g'],
 ['unaccepted wasm payload',x=>x.inventory.files[3].path='worker.wasm'],
 ['disguised nested source directory',x=>x.inventory.files[4].path='../../../private.secret'],
 ['runtime-disabled RC build flag',x=>x.buildFlag='0'],
 ['wrong Owner SVG count',x=>x.inventory.ownerSvgCount=15],
 ['missing Worker source data',x=>x.inventory.workerDataCount=2],
 ['accidental deploy permission',x=>x.inventory.deployAuthorized=true],
 ['wrong distribution root',x=>x.inventory.basePath='/']
];
test('QR48 positive candidate generates only review receipt and ZERO authority',()=>{
 const r=verifyReadOnlyRcCandidate(good());
 assert.equal(r.reviewOnly,true);
 assert.equal(r.sourceTypeCount,244);
 for(const k of ['productionRustReadAccepted','realSaveWriterEnabled','assetRightsApproved',
   'publicReleaseApproved','independentCumulativeQrAccepted'])assert.equal(r[k],false);
});
for(const [name,mutate] of bad)test('QR48 independent negative: '+name,()=>{
 const candidate=good();mutate(candidate);
 assert.throws(()=>verifyReadOnlyRcCandidate(candidate),/RC_CANDIDATE_REJECTED/);
});
test('QR48 CI source changes exactly THREE files from WEB44, no Writer product code',()=>{
 const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
 const from='25bf1c9f8c49932127a21e9b2035fb1bd4664e22';
 const to='b4450e0e847fd93670c3461312c5911387e483fb';
 const changed=git('diff','--name-only',from,to).split('\n').sort();
 assert.deepEqual(changed,['.github/workflows/00ctrl-rc-composite-review.yml',
   'scripts/verify-readonly-rc-candidate.mjs','tests/ctrl-readonly-rc-candidate.test.mjs'].sort());
 for(const f of ['src/worker.mjs','src/lib/timekeeper/core-read-worker-bridge.mjs',
  'contracts/web-readonly-core-worker-v1.json','src/routes/+page.svelte'])
  assert.equal(git('rev-parse',from+':'+f),git('rev-parse',to+':'+f),f);
});
test('QR48 compiled inventory is independently complete AND hash-bound to real build tree',async t=>{
 const manifestPath=process.env.QR48_COMPILED_INVENTORY;
 const buildRoot=process.env.QR48_BUILD_ROOT;
 if(!manifestPath||!buildRoot){t.skip('Requires isolated VITE_WEB_READONLY_RC=1 compiled build; no public authorization');return;}
 const inv=JSON.parse(await readFile(manifestPath,'utf8'));
 const receipt=verifyReadOnlyRcCandidate({release,core,types,inventory:inv,buildFlag:'1'});
 assert.equal(receipt.publicReleaseApproved,false);
 const actual=[];
 async function walk(dir){
  for(const e of await readdir(dir,{withFileTypes:true})){
   const f=join(dir,e.name),s=await lstat(f);
   assert(!s.isSymbolicLink(),'compiled symlink '+f);
   if(s.isDirectory())await walk(f);
   else {assert(s.isFile());actual.push(relative(buildRoot,f).replaceAll('\\','/'));}
  }
 }
 await walk(buildRoot);actual.sort();
 assert.deepEqual(actual,inv.files.map(f=>f.path).slice().sort());
 let sum=0;
 for(const f of inv.files){
  const bytes=await readFile(join(buildRoot,f.path));
  const hash=createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash,f.sha256,'actual bytes SHA differ: '+f.path);
  assert.equal(bytes.length,f.bytes,'actual file length differ: '+f.path);
  sum+=bytes.length;
 }
 assert.equal(sum,inv.totalBytes);
 assert.equal(inv.ownerSvgCount,16);
 assert.equal(inv.workerDataCount,3);
 assert.equal(inv.deployAuthorized,false);
 assert.equal(inv.writerReleaseAuthorized,false);
});
