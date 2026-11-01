import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {APP_ICON_SOURCES,APP_SVG_SIZE,LUCIDE_PINNED_COMMIT,renderAppUiIconSvg} from '../src/app-ui-icon-design.mjs';

export const sourceSha=data=>createHash('sha256').update(data).digest('hex');
export async function buildAppIcons(outRoot){
  const root=resolve(outRoot);
  const upstreamRoot=fileURLToPath(new URL('../vendor/lucide/icons/',import.meta.url));
  const icons={};
  for(const [key,name] of Object.entries(APP_ICON_SOURCES)){
    const original=await readFile(join(upstreamRoot,name+'.svg'),'utf8');
    const svg=renderAppUiIconSvg(key,original);
    const path='assets/app/ui/'+key.replace('.','/')+'.svg';
    const location=join(root,path);
    await mkdir(dirname(location),{recursive:true});
    await writeFile(location,svg,'utf8');
    icons[key]={kind:'app_ui',verified:true,path,
      sha256:sourceSha(svg),sourceSha256:sourceSha(original),
      sourceAsset:'vendor/lucide/icons/'+name+'.svg',upstreamIcon:name,
      mappingEvidence:'Official Lucide '+name+' icon at pinned upstream commit '+LUCIDE_PINNED_COMMIT+'; locally styled without structural edits',
      width:APP_SVG_SIZE,height:APP_SVG_SIZE};
  }
  const manifest={kind:'app_ui',source:{platform:'Dreamlight Timekeeper',revision:3,
    assetFormat:'SVG',iconSet:'Lucide',upstreamRepository:'lucide-icons/lucide',
    upstreamCommit:LUCIDE_PINNED_COMMIT,status:'VERIFIED_ASSETS',writerAuthorization:false},icons};
  await mkdir(join(root,'data'),{recursive:true});
  await writeFile(join(root,'data','app-ui-icons.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await buildAppIcons(process.argv[2]||fileURLToPath(new URL('../',import.meta.url)));
