import {readFile,writeFile,copyFile,mkdir,readdir,lstat,rm} from 'node:fs/promises';
import {resolve,relative,join,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateUiManifest} from '../src/ui-assets.mjs';

const sourceDefault=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const dataFiles=['events-v1253.json','item-names-v1250.json.gz','wand-iswood-crosswalk-v1253.json',
 'timing-review-rules-v1253.json','steam-icons-v1253.json','app-ui-icons.json'];
const inside=(parent,child)=>{const rel=relative(parent,child);return rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!rel.startsWith(sep));};
async function filesIn(root,prefix=''){
 const out=[];
 for(const item of await readdir(root,{withFileTypes:true})){
  const rel=prefix?prefix+'/'+item.name:item.name;
  if(item.isSymbolicLink())throw new Error('Symlink excluded: '+rel);
  if(item.isDirectory())out.push(...await filesIn(join(root,item.name),rel));
  else if(item.isFile())out.push(rel);
  else throw new Error('Unexpected source type: '+rel);
 }
 return out;
}
export async function checkReleaseAssetScope(sourceRoot=sourceDefault){
 const base=resolve(sourceRoot);
 const json=async path=>JSON.parse(await readFile(join(base,path),'utf8'));
 const [scope,game,app,item,rights]=await Promise.all([
  json('data/release-asset-scope-v1.json'),json('data/steam-ui-icons-v1253.json'),
  json('data/app-ui-icons.json'),json('data/steam-icons-v1253.json'),
  json('data/steam-ui-existing-rights-review-v1253.json')]);
 validateUiManifest(game,'game_ui');validateUiManifest(app,'app_ui');
 if(scope.kind!=='TIMEKEEPER_INITIAL_RELEASE_ASSET_SCOPE_V1'||
  scope.decision!=='OWNER_00_CTRL_PENDING'||scope.permissionFromNotice!==false||
  scope.writerAuthorizationUnchanged!==true||scope.itemImageCount!==0||
  Object.keys(item.icons).length!==0||
  JSON.stringify(scope.excludedHeldCandidates)!=='["world.hgw","tab.shops","tab.daily"]'||
  scope.profiles.current_repo_game_ui?.status!=='EXISTING_REPOSITORY_FILES_NOT_RELEASE_LICENSE'||
  scope.profiles.current_repo_game_ui?.shipOriginalGameWebp!==true||
  scope.profiles.owner_svg_text_only?.status!=='CANDIDATE_NOT_SELECTED_OR_RELEASED'||
  scope.profiles.owner_svg_text_only?.shipOriginalGameWebp!==false)
  throw new Error('Owner has not selected or licensed a release profile.');
 for(const [kind,entries,manifest,count] of [
  ['game',scope.gameUi,game,4],['app',scope.ownerSvg,app,16]]){
  const keys=Object.keys(manifest.icons).sort();
  if(entries.length!==count||keys.length!==count||
     JSON.stringify(entries.map(x=>x.key).sort())!==JSON.stringify(keys))
   throw new Error('Release media count/key mismatch: '+kind);
  for(const row of entries){
   const original=manifest.icons[row.key];
   if(row.path!==original.path||row.sha256!==original.sha256||
    (kind==='game'&&(row.rights!=='NOT_ESTABLISHED'||row.alreadyInRepo!==true||
     rights.reviewedItems[row.key]?.copyrightRedistributionPermission!=='NOT_ESTABLISHED'))||
    (kind==='app'&&row.source!=='OWNER_ORIGINAL_PROVISIONAL')||
    sha(await readFile(join(base,row.path)))!==row.sha256)
     throw new Error('Release media hash/rights mismatch: '+row.key);
  }
 }
 return {scope,game};
}
export async function stageReleaseAssetProfile({sourceRoot=sourceDefault,outputRoot,profile}){
 if(!['current_repo_game_ui','owner_svg_text_only'].includes(profile)||!outputRoot)
  throw new Error('Explicit release profile and new output path required.');
 const base=resolve(sourceRoot),output=resolve(outputRoot);
 if(inside(base,output)||inside(output,base))
  throw new Error('Stage directory cannot overlap the source checkout.');
 const {scope,game}=await checkReleaseAssetScope(base);
 const modules=(await filesIn(join(base,'src'))).map(p=>'src/'+p);
 if(modules.some(p=>!p.endsWith('.mjs')))throw new Error('Unexpected non-module source file.');
 const webp=profile==='current_repo_game_ui'?scope.gameUi.map(x=>x.path):[];
 const paths=['index.html','styles.css','assets/app/release-notice.css',...modules,
  ...dataFiles.map(p=>'data/'+p),...scope.ownerSvg.map(x=>x.path),...webp];
 if(new Set(paths).size!==paths.length)throw new Error('Duplicate paths.');
 await mkdir(output); // exclusive: refuse existing directory, never overwrite
 try{
  for(const p of paths){
   const from=join(base,p),to=join(output,p),st=await lstat(from);
   if(!st.isFile()||st.isSymbolicLink())throw new Error('Bad stage source: '+p);
   await mkdir(dirname(to),{recursive:true});
   await copyFile(from,to);
   if(sha(await readFile(from))!==sha(await readFile(to)))
    throw new Error('Copied bytes drifted: '+p);
  }
  const released=profile==='owner_svg_text_only'?
   {...game,source:{...game.source,status:'NO_ASSETS_VERIFIED'},icons:{}}:game;
  validateUiManifest(released,'game_ui');
  await writeFile(join(output,'data/steam-ui-icons-v1253.json'),JSON.stringify(released,null,2)+'\n',{flag:'wx'});
  const emitted=(await filesIn(output)).sort(),expected=[...paths,'data/steam-ui-icons-v1253.json'].sort();
  if(JSON.stringify(emitted)!==JSON.stringify(expected))
   throw new Error('Unexpected stage output');
  if(profile==='owner_svg_text_only'&&emitted.some(p=>/\.(?:webp|png|jpe?g|dds|bundle)$/i.test(p)))
   throw new Error('Game image bytes in owner-only candidate.');
  return {profile,gameWebp:webp.length,ownerSvg:scope.ownerSvg.length,itemImages:0,
   includedFiles:emitted.length,publicReleaseApproved:false,writerAuthorityChanged:false};
 }catch(err){await rm(output,{recursive:true,force:true});throw err;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==4)throw new Error(
  'Usage: node scripts/stage-release-asset-profile.mjs <current_repo_game_ui|owner_svg_text_only> <new-external-directory>');
 console.log(JSON.stringify(await stageReleaseAssetProfile({profile:process.argv[2],outputRoot:process.argv[3]})));
}
