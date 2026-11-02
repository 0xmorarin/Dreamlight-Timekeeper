import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm,cp,mkdir,symlink,writeFile,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkReleaseAssetScope,stageReleaseAssetProfile} from '../scripts/stage-release-asset-profile.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const json=async path=>JSON.parse(await readFile(path,'utf8'));

test('release media inventory pins all shipped game sprites and 16 original SVGs without granting rights',async()=>{
 const {scope,game}=await checkReleaseAssetScope(root);
 assert.deepEqual(scope.gameUi.map(x=>x.key),
  ['skill.mining','status.warning','world.exp1','world.valley']);
 assert.equal(scope.ownerSvg.length,16);
 assert.equal(scope.itemImageCount,0);
 assert.equal(scope.decision,'OWNER_00_CTRL_PENDING');
 assert.equal(scope.permissionFromNotice,false);
 assert.equal(Object.keys(game.icons).length,4);
 for(const g of scope.gameUi)assert.equal(g.rights,'NOT_ESTABLISHED');
 assert.deepEqual(scope.excludedHeldCandidates,['world.hgw','tab.shops','tab.daily']);
});

test('two release variants are staged outside source, with exact file counts and no orphaned game bytes',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'timekeeper-release-scope-'));
 try{
  const gameDir=join(parent,'with-game'),textDir=join(parent,'svg-only');
  const orig=await readFile(join(root,'data/steam-ui-icons-v1253.json'));
  const a=await stageReleaseAssetProfile({sourceRoot:root,outputRoot:gameDir,profile:'current_repo_game_ui'});
  const b=await stageReleaseAssetProfile({sourceRoot:root,outputRoot:textDir,profile:'owner_svg_text_only'});
  assert.equal(a.gameWebp,4);assert.equal(b.gameWebp,0);
  assert.equal(a.ownerSvg,16);assert.equal(b.ownerSvg,16);
  assert.equal(a.itemImages,0);assert.equal(b.itemImages,0);
  assert.equal(a.publicReleaseApproved,false);assert.equal(b.publicReleaseApproved,false);
  const [aManifest,bManifest]=await Promise.all([
   json(join(gameDir,'data/steam-ui-icons-v1253.json')),
   json(join(textDir,'data/steam-ui-icons-v1253.json'))]);
  assert.equal(aManifest.source.status,'VERIFIED_ASSETS');
  assert.equal(Object.keys(aManifest.icons).length,4);
  assert.equal(bManifest.source.status,'NO_ASSETS_VERIFIED');
  assert.equal(Object.keys(bManifest.icons).length,0);
  assert.deepEqual(await readFile(join(root,'data/steam-ui-icons-v1253.json')),orig,
   'Never overwrite repository source game manifest.');
  const checkAssets=async(dir,expectGame)=>{
   const names=[];const walk=async(dir,prefix='')=>{
    for(const e of await readdir(dir,{withFileTypes:true})){
     const sub=prefix?prefix+'/'+e.name:e.name;
     if(e.isDirectory())await walk(join(dir,e.name),sub);
     else names.push(sub);
    }
   };await walk(dir);
   assert.equal(names.filter(x=>x.endsWith('.svg')).length,16);
   assert.equal(names.filter(x=>x.endsWith('.webp')).length,expectGame);
   for(const p of ['index.html','styles.css','src/app.mjs','src/worker.mjs',
    'src/core/w1-edited-p1g-copy.mjs','data/events-v1253.json',
    'data/item-names-v1250.json.gz','assets/app/release-notice.css']){
    assert.ok(names.includes(p),'Missing production app dependency: '+p);
   }
   assert.equal(names.filter(x=>x.startsWith('tests/')).length,0);
   assert.equal(names.filter(x=>x.startsWith('.github/')).length,0);
   return names;
  };
  await checkAssets(gameDir,4);await checkAssets(textDir,0);
  const html=await readFile(join(textDir,'index.html'),'utf8');
  assert.match(html,/Unofficial fan-made tool/);
  assert.match(html,/非公式のファン制作ツール/);
  for(const id of ['tabs','open-welcome','save-file','stage-preview','undo-plan','redo-plan',
   'prepare-edited','verified-pair-downloads','download-verified-both',
   'retry-verified-original','retry-verified-edited'])
   assert.ok(html.includes('id="'+id+'"'),'Lost Writer, plan or two-download UI: '+id);
  await assert.rejects(stageReleaseAssetProfile({
   sourceRoot:root,outputRoot:textDir,profile:'owner_svg_text_only'}),/EEXIST/);
 }finally{await rm(parent,{recursive:true,force:true});}
});

test('release staging rejects unknown profiles and source-overwriting destinations',async()=>{
 await assert.rejects(stageReleaseAssetProfile({sourceRoot:root,outputRoot:'/tmp/ignored',profile:'AUTO_RELEASE'}),/Explicit/);
 await assert.rejects(stageReleaseAssetProfile({sourceRoot:root,outputRoot:root,profile:'owner_svg_text_only'}),/overlap/);
 await assert.rejects(stageReleaseAssetProfile({sourceRoot:root,outputRoot:join(root,'dist'),profile:'owner_svg_text_only'}),/overlap/);
});

const isolatedReleaseFixture=async()=>{
 const folder=await mkdtemp(join(tmpdir(),'timekeeper-release-negative-'));
 const source=join(folder,'source');await mkdir(source);
 for(const name of ['src','data','assets'])await cp(join(root,name),join(source,name),{recursive:true});
 for(const name of ['index.html','styles.css'])await cp(join(root,name),join(source,name));
 return {folder,source};
};

test('release staging refuses added unapproved executable source modules before output creation',async()=>{
 const {folder,source}=await isolatedReleaseFixture();
 try{
  await writeFile(join(source,'src','unapproved-plugin.mjs'),'// unreviewed release module\n');
  const output=join(folder,'rejected-extra');
  await assert.rejects(stageReleaseAssetProfile({sourceRoot:source,outputRoot:output,
   profile:'owner_svg_text_only'}),/Unknown|unapproved/);
  await assert.rejects(lstat(output),{code:'ENOENT'});
 }finally{await rm(folder,{recursive:true,force:true});}
});

test('stage output cannot use symlinked parent resolving into source checkout',async()=>{
 const {folder,source}=await isolatedReleaseFixture();
 try{
  const link=join(folder,'outside-alias');
  await symlink(source,link,'dir');
  const unsafe=join(link,'would-overwrite-source');
  await assert.rejects(stageReleaseAssetProfile({sourceRoot:source,outputRoot:unsafe,
   profile:'owner_svg_text_only'}),/Symlink|overlap|realpath/i);
  await assert.rejects(lstat(join(source,'would-overwrite-source')),{code:'ENOENT'});
 }finally{await rm(folder,{recursive:true,force:true});}
});
