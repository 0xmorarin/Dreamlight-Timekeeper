import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {APP_ICON_GLYPHS,APP_SVG_SIZE,renderAppUiIconSvg} from '../src/app-ui-icon-design.mjs';

export const sourceSha=data=>createHash('sha256').update(data).digest('hex');
export async function buildAppIcons(outRoot){
  const root=resolve(outRoot);
  const icons={};
  for(const [key,geometry] of Object.entries(APP_ICON_GLYPHS)){
    const path='assets/app/ui/'+key.replace('.','/')+'.svg';
    const svg=renderAppUiIconSvg(key);
    const location=join(root,path);
    await mkdir(dirname(location),{recursive:true});
    await writeFile(location,svg,'utf8');
    icons[key]={kind:'app_ui',verified:true,path,
      sha256:sourceSha(svg),sourceSha256:sourceSha(geometry),
      sourceAsset:'src/app-ui-icon-design.mjs',
      mappingEvidence:'Original 24px universally legible line icon: '+key,
      width:APP_SVG_SIZE,height:APP_SVG_SIZE};
  }
  const manifest={kind:'app_ui',source:{platform:'Dreamlight Timekeeper',revision:2,
    assetFormat:'SVG',status:'VERIFIED_ASSETS',writerAuthorization:false},icons};
  await mkdir(join(root,'data'),{recursive:true});
  await writeFile(join(root,'data','app-ui-icons.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await buildAppIcons(process.argv[2]||fileURLToPath(new URL('../',import.meta.url)));
