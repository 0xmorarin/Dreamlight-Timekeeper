import assert from 'node:assert/strict';
import {cp,mkdir,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=resolve(fileURLToPath(new URL('..',import.meta.url)));
const asset=resolve(process.argv[2]||'');
const output=resolve(process.argv[3]||'');
assert(asset!==repo&&output!==repo&&output!==asset&&output.startsWith(repo+'/'));
const read=(where,path)=>readFile(join(where,path),'utf8');
const replace=(source,oldValue,newValue)=>{
 assert.equal(source.split(oldValue).length,2,'Integration anchor drift: '+oldValue.slice(0,90));
 return source.replace(oldValue,newValue);
};
const part=(source,start,end)=>{
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Missing or ambiguous PR3 integration anchor: '+start);
 assert.equal(source.indexOf(start,a+1),-1,'Duplicated integration anchor');
 return source.slice(a,b);
};
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const entry of await readdir(repo)){
 if(['.git','node_modules','_asset_reference','.integration-preview'].includes(entry))continue;
 await cp(join(repo,entry),join(output,entry),{recursive:true});
}
for(const name of ['assets','src/ui-assets.mjs','src/icon-assets.mjs',
 'data/steam-icons-v1253.json','data/app-ui-icons.json','data/steam-ui-icons-v1253.json']){
 await mkdir(dirname(join(output,name)),{recursive:true});
 await cp(join(asset,name),join(output,name),{recursive:true,force:true});
}
const base=await read(repo,'src/app.mjs');
const iconApp=await read(asset,'src/app.mjs');
assert(base.includes("createOriginalBackupCoordinator")&&base.includes("refreshPreflight()"));
assert(iconApp.includes("resolveGameUiIcon")&&iconApp.includes("resolveAppUiIcon"));
let merged=replace(base,"import {createOriginalBackupCoordinator} from './ui-backup-coordinator.mjs';",
 "import {createOriginalBackupCoordinator} from './ui-backup-coordinator.mjs';\n"+
 "import {validateIconManifest,resolveIconAsset} from './icon-assets.mjs';\n"+
 "import {validateUiManifest,resolveGameUiIcon,resolveAppUiIcon} from './ui-assets.mjs';");
merged=replace(merged,'iconManifest=null,preflightSequence=0;','iconManifest=null,gameUiManifest=null,appUiManifest=null,preflightSequence=0;');
merged=replace(merged,'function renderTabs(){',part(iconApp,'function semanticIcon(','function renderTabs(){')+'function renderTabs(){');
const swapFunction=(name,next)=>{merged=replace(merged,part(merged,'function '+name+'(',next),part(iconApp,'function '+name+'(',next));};
swapFunction('renderTabs','const tabRows=');
swapFunction('filterButton','function renderFilters(){');
swapFunction('renderFilters','function iconFor(');
swapFunction('iconFor','function imageCluster(');
swapFunction('makeRecord','function renderSelectionLabel()');
merged=replace(merged," $('filter-input').placeholder=t('search');"," $('filter-input').placeholder=t('search');\n refreshActionIcons();");
merged=replace(merged,part(merged,'async function loadIcons(){','function boot(){'),part(iconApp,'async function loadIcons(){','function boot(){'));
merged=replace(merged," loadIcons().then(()=>{if(state.snapshot)renderList();});"," loadIcons();");
assert(merged.includes("backupCoordinator.download(state.sessionId)")&&merged.includes("request('preflight',{sessionId,entries})"));
assert(merged.includes("renderAudit();renderTabs();renderFilters();renderList();renderDetails();"));
assert(!merged.includes("const data=await request('backup')"));
assert(!merged.includes("request('export'"));
await writeFile(join(output,'src/app.mjs'),merged);
const webCss=await read(repo,'styles.css'),assetCss=await read(asset,'styles.css');
const cssOffset=assetCss.indexOf('\n.semantic-icon');
assert(cssOffset>0);
await writeFile(join(output,'styles.css'),webCss+'\n'+assetCss.slice(cssOffset+1));
const audit={assetReference:process.env.ASSET_FIXED_SHA||'b9b5823827fe7b2f530e14736c6a4bdae263ff27',
 previewOnly:true,originalWriterEnabled:false,appIconSource:'04 ASSET PR3',workerAuthority:'03 WEB PR10',
 originalBackupCoordinatorPreserved:true};
await writeFile(join(output,'integration-rehearsal.json'),JSON.stringify(audit,null,2)+'\n');
console.log('Integration rehearsal prepared: PR10 Worker/Session retained; PR3 icon presentation only.');
