// 05 QR — independent two-profile packaging and hostile-path QA on fixed RC HEAD.
// Test synthetic copies of the repository for malicious inputs; do NOT change checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm,cp,symlink,mkdir,writeFile,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {checkReleaseAssetScope,stageReleaseAssetProfile} from '../scripts/stage-release-asset-profile.mjs';

const base=fileURLToPath(new URL('../',import.meta.url));
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const getFiles=async(root,prefix='')=>{
 const out=[];
 for(const e of await readdir(root,{withFileTypes:true})){
  const p=prefix?prefix+'/'+e.name:e.name;
  if(e.isSymbolicLink())throw new Error('Unexpected symlink in stage: '+p);
  if(e.isDirectory())out.push(...await getFiles(join(root,e.name),p));
  else if(e.isFile())out.push(p);
  else throw Error('Unexpected stage node '+p);
 }
 return out.sort();
};
const fixtures=async()=>{
 const d=await mkdtemp(join(tmpdir(),'05qr-rc-scope-'));
 const root=join(d,'source');await mkdir(root);
 for(const name of ['src','data','assets'])await cp(join(base,name),join(root,name),{recursive:true});
 for(const name of ['index.html','styles.css'])await cp(join(base,name),join(root,name));
 return {dir:d,root};
};
const independentSourcePaths=['index.html','styles.css','src/worker.mjs','src/app.mjs',
 'src/core/w1-edited-p1g-copy.mjs','data/steam-ui-icons-v1253.json',
 'data/release-asset-scope-v1.json','assets/app/release-notice.css'];
const fingerprint=async(root)=>Object.fromEntries(await Promise.all(independentSourcePaths.map(async p=>
 [p,sha(await readFile(join(root,p)))])));
test('RSP-Q01 two NEW external staged candidates are truly independent, source immutable, exactly pinned media and no release permission',async()=>{
 const d=await mkdtemp(join(tmpdir(),'05qr-rc-two-'));
 try{
  const before=await fingerprint(base);
  const scope=(await checkReleaseAssetScope(base)).scope;
  assert.equal(scope.permissionFromNotice,false);
  assert.equal(scope.decision,'OWNER_00_CTRL_PENDING');
  assert.equal(scope.profiles.current_repo_game_ui.status,'EXISTING_REPOSITORY_FILES_NOT_RELEASE_LICENSE');
  assert.equal(scope.profiles.owner_svg_text_only.status,'CANDIDATE_NOT_SELECTED_OR_RELEASED');
  assert.deepEqual(scope.gameUi.map(x=>x.rights),Array(4).fill('NOT_ESTABLISHED'));
  assert.equal(scope.gameUi.length,4);assert.equal(scope.ownerSvg.length,16);
  const game=join(d,'game'),svg=join(d,'svg');
  const g=await stageReleaseAssetProfile({sourceRoot:base,outputRoot:game,profile:'current_repo_game_ui'});
  const s=await stageReleaseAssetProfile({sourceRoot:base,outputRoot:svg,profile:'owner_svg_text_only'});
  assert.equal(g.gameWebp,4);assert.equal(s.gameWebp,0);
  for(const receipt of [g,s]){
   assert.equal(receipt.publicReleaseApproved,false);
   assert.equal(receipt.writerAuthorityChanged,false);
   assert.equal(receipt.ownerSvg,16);
   assert.equal(receipt.itemImages,0);
  }
  const gf=await getFiles(game),sf=await getFiles(svg);
  assert.deepEqual(sf.filter(p=>/\.(?:webp|png|jpe?g|dds|bundle)$/i.test(p)),[]);
  assert.deepEqual(gf.filter(p=>p.endsWith('.webp')),scope.gameUi.map(x=>x.path).sort());
  assert.equal(gf.filter(p=>p.endsWith('.svg')).length,16);
  assert.equal(sf.filter(p=>p.endsWith('.svg')).length,16);
  assert.deepEqual(sf.filter(p=>p.startsWith('assets/')),scope.ownerSvg.map(x=>x.path).sort());
  assert.equal(gf.some(x=>x.startsWith('tests/')||x.startsWith('.github/')),false);
  assert.equal(sf.some(x=>x.startsWith('tests/')||x.startsWith('.github/')),false);
  const [gm,sm]=await Promise.all([
   json(join(game,'data/steam-ui-icons-v1253.json')),
   json(join(svg,'data/steam-ui-icons-v1253.json'))]);
  assert.equal(Object.keys(gm.icons).length,4);
  assert.equal(Object.keys(sm.icons).length,0);
  assert.equal(sm.source.status,'NO_ASSETS_VERIFIED');
  for(const entry of scope.gameUi)assert.equal(sha(await readFile(join(game,entry.path))),entry.sha256);
  for(const entry of scope.ownerSvg){
   assert.equal(sha(await readFile(join(game,entry.path))),entry.sha256);
   assert.equal(sha(await readFile(join(svg,entry.path))),entry.sha256);
  }
  const sharedPaths=sf.filter(x=>x!=='data/steam-ui-icons-v1253.json');
  for(const path of sharedPaths){
   assert.equal(sha(await readFile(join(game,path))),sha(await readFile(join(svg,path))),path);
   assert.equal(sha(await readFile(join(base,path))),sha(await readFile(join(svg,path))),path);
  }
  assert.deepEqual(await fingerprint(base),before,'Source repository modified by output staging');
 }finally{await rm(d,{recursive:true,force:true});}
});
test('RSP-Q02 unknown profile, in-tree source destination, output existing and malformed asset hash reject without overwriting',async()=>{
 const {dir,root}=await fixtures();
 try{
  for(const bad of [
   {profile:'unknown',outputRoot:join(dir,'unknown')},
   {profile:'owner_svg_text_only',outputRoot:root},
   {profile:'owner_svg_text_only',outputRoot:join(root,'dist')}
  ])await assert.rejects(stageReleaseAssetProfile({sourceRoot:root,...bad}));
  const occupied=join(dir,'occupied');await mkdir(occupied);
  await writeFile(join(occupied,'sentinel'),'NEVER_OVERWRITE');
  await assert.rejects(stageReleaseAssetProfile({sourceRoot:root,profile:'owner_svg_text_only',outputRoot:occupied}),/EEXIST/);
  assert.equal(await readFile(join(occupied,'sentinel'),'utf8'),'NEVER_OVERWRITE');
  const target=join(root,'assets/app/ui/action/backup.svg');
  await writeFile(target,'tampered protected media');
  await assert.rejects(stageReleaseAssetProfile({sourceRoot:root,profile:'owner_svg_text_only',outputRoot:join(dir,'bad-hash')}),/hash\/rights mismatch/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('RSP-Q03 actual symlink inside staged src must fail-closed, with no partial output retained',async()=>{
 const {dir,root}=await fixtures();
 try{
  await symlink(join(dir,'secret'),join(root,'src','unknown-link.mjs'));
  const out=join(dir,'stage');
  await assert.rejects(stageReleaseAssetProfile({sourceRoot:root,profile:'owner_svg_text_only',outputRoot:out}),/Symlink excluded/);
  await assert.rejects(lstat(out),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('RSP-Q04 unknown source module is not silently included in either release candidate',async()=>{
 const {dir,root}=await fixtures();
 try{
  const malicious=join(root,'src','unknown-qa-plugin.mjs');
  await writeFile(malicious,'// unknown synthetic source — should not be permitted in release artifact\n');
  const staged=join(dir,'reject-unknown');
  await assert.rejects(stageReleaseAssetProfile({sourceRoot:root,profile:'owner_svg_text_only',outputRoot:staged}),
    /Unknown|Unexpected|unapproved|allowlist|not permitted/i);
  await assert.rejects(lstat(staged),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('RSP-Q05 output path with symlinked parent resolving INSIDE source checkout rejects',async()=>{
 const {dir,root}=await fixtures();
 try{
  const alias=join(dir,'outside-looking-alias');
  await symlink(root,alias,'dir');
  const before=await fingerprint(root);
  const staged=join(alias,'unwanted-in-checkout');
  await assert.rejects(stageReleaseAssetProfile({sourceRoot:root,profile:'owner_svg_text_only',outputRoot:staged}),
    /overlap|symlink|source|outside|realpath/i);
  await assert.rejects(lstat(join(root,'unwanted-in-checkout')),{code:'ENOENT'});
  assert.deepEqual(await fingerprint(root),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
