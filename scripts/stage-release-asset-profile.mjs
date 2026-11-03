import {readFile,writeFile,copyFile,mkdir,readdir,lstat,rm,realpath} from 'node:fs/promises';
import {resolve,relative,join,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateUiManifest} from '../src/ui-assets.mjs';

const sourceDefault=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const dataFiles=['events-v1253.json','item-names-v1250.json.gz','wand-iswood-crosswalk-v1253.json',
 'timing-review-rules-v1253.json','steam-icons-v1253.json','app-ui-icons.json'];
const inside=(parent,child)=>{const rel=relative(parent,child);return rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!rel.startsWith(sep));};
// Reviewed release module inventory for the fixed v1 source. Any new module requires
// a deliberate source-and-tests update; globbing executable src modules is unsafe.
const approvedRuntimeModules=Object.freeze([
  "src/app-ui-icon-design.mjs",
  "src/app.mjs",
  "src/core/p1g-envelope-audit.mjs",
  "src/core/p1g-packaged-profile-codec.mjs",
  "src/core/safe-edit-session.mjs",
  "src/core/timekeeper-timing-compatibility.mjs",
  "src/core/timing-delta-audit.mjs",
  "src/core/timing-draft.mjs",
  "src/core/timing-plan-preflight.mjs",
  "src/core/versioning.mjs",
  "src/core/w1-edited-p1g-copy.mjs",
  "src/decoration-grid-audit.mjs",
  "src/decoration-spawn-evidence.mjs",
  "src/i18n.mjs",
  "src/icon-assets.mjs",
  "src/icon-import-plan.mjs",
  "src/item-id-structure.mjs",
  "src/lib/timekeeper/read-only-rc-mode.mjs",
  "src/reader.mjs",
  "src/steam-ui-provenance.mjs",
  "src/time-presets.mjs",
  "src/timing-audit.mjs",
  "src/timing-native-semantics.mjs",
  "src/timing-review.mjs",
  "src/ui-assets.mjs",
  "src/ui-backup-coordinator.mjs",
  "src/ui-separate-downloads.mjs",
  "src/ui-verified-pair-downloads.mjs",
  "src/w1-minimal-write-contract.mjs",
  "src/wand-grid-reference-index.mjs",
  "src/wand-item-taxonomy.mjs",
  "src/wand-wood-tag-evidence.mjs",
  "src/worker.mjs"
]);
// SvelteKit-only inputs are review-audited and shipped via the separate
// 00 CTRL compiled SvelteKit artifact route, NEVER by the historical HTML
// source-tree release. This explicit inventory is NOT a wildcard waiver.
// New/renamed executable code still fails closed until explicitly reviewed.
const excludedSvelteKitOnlyModules=Object.freeze([
  "src/app.html",
  "src/lib/timekeeper/ItemThumb.svelte",
  "src/lib/timekeeper/item-text-only.mjs",
  "src/lib/timekeeper/locale.ts",
  "src/lib/timekeeper/model.ts",
  "src/lib/timekeeper/save-session-contract.ts",
  "src/lib/timekeeper/session-response-fence.mjs",
  "src/lib/timekeeper/worker-adapter.ts",
  "src/lib/timekeeper/worker-projection-bounds.mjs",
  "src/lib/wand-a11y/LiveRegion.svelte",
  "src/lib/wand-a11y/VisuallyHidden.svelte",
  "src/lib/wand-i18n/catalog-schema.js",
  "src/lib/wand-i18n/messages/index.js",
  "src/lib/wand-i18n/preference.js",
  "src/lib/wand-i18n/registry.js",
  "src/lib/wand-i18n/runtime.js",
  "src/lib/wand-ui/ResponsiveFrame.svelte",
  "src/lib/wand-ui/SegmentedControl.svelte",
  "src/routes/+layout.ts",
  "src/routes/+page.svelte"
]);
// The common worker imports this build-flag module, so it MUST be included
// in the older HTML source stage as a concrete runtime dependency.
const exactSourceInventory=Object.freeze([...approvedRuntimeModules,...excludedSvelteKitOnlyModules].sort());
if(new Set(exactSourceInventory).size!==exactSourceInventory.length)
 throw new Error('Duplicate reviewed source inventory entry.');

async function assertSafeNewStageDestination(sourceRoot,outputRoot){
 const canonicalSource=await realpath(sourceRoot);
 if(inside(sourceRoot,outputRoot)||inside(outputRoot,sourceRoot))
  throw new Error('Stage directory cannot overlap the source checkout.');
 // Check EVERY pre-existing ancestor, including aliases that lexically appear
 // outside sourceRoot but resolve to a directory within it.
 let cursor=outputRoot,closestExisting=null;
 for(;;){
  try{
   const stat=await lstat(cursor);
   if(stat.isSymbolicLink())throw new Error('Symlink in stage output path: '+cursor);
   if(!stat.isDirectory())throw new Error('Unexpected non-directory stage ancestor: '+cursor);
   if(closestExisting===null)closestExisting=cursor;
  }catch(err){if(err?.code!=='ENOENT')throw err;}
  const parent=dirname(cursor);
  if(parent===cursor)break;
  cursor=parent;
 }
 if(closestExisting===null)throw new Error('No existing stage output ancestor.');
 const canonicalAncestor=await realpath(closestExisting);
 const canonicalTarget=resolve(canonicalAncestor,relative(closestExisting,outputRoot));
 if(inside(canonicalSource,canonicalTarget)||inside(canonicalTarget,canonicalSource))
  throw new Error('Stage realpath overlaps the source checkout.');
}
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
 await assertSafeNewStageDestination(base,output);
 const {scope,game}=await checkReleaseAssetScope(base);
 const observed=(await filesIn(join(base,'src'))).map(p=>'src/'+p).sort();
 // Full inventory must match exactly, INCLUDING the excluded Svelte files.
 // Missing or added files cannot hide in a broad ignored directory.
 if(JSON.stringify(observed)!==JSON.stringify(exactSourceInventory))
  throw new Error('Unknown or unapproved source module in release staging.');
 const modules=approvedRuntimeModules;
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
