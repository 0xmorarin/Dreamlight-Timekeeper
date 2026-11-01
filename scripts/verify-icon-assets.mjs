import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateIconManifest,inspectLosslessWebP} from '../src/icon-assets.mjs';
import {validateUiManifest,verifyUiAssetBytes} from '../src/ui-assets.mjs';

const root = resolve(process.argv[2]||fileURLToPath(new URL('../',import.meta.url)));
const manifest = JSON.parse(await readFile(join(root,'data','steam-icons-v1253.json'),'utf8'));
validateIconManifest(manifest);
let total=0;
for (const [id,entry] of Object.entries(manifest.icons)) {
  const file = resolve(root,entry.path);
  const bytes = await readFile(file);
  if (bytes.length > 6*1024*1024) throw new Error(`Icon ${id} exceeds 6 MiB.`);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== entry.sha256) throw new Error(`Icon SHA-256 mismatch: ${id}`);
  const dimensions = inspectLosslessWebP(bytes);
  if (dimensions.width !== entry.width || dimensions.height !== entry.height)
    throw new Error(`Icon dimensions mismatch: ${id}`);
  total++;
}
console.log(total ? `Verified ${total} lossless VP8L icon assets (SHA-256 + dimensions + provenance metadata).` :
  'No verified Steam assets yet. Empty manifest is valid; display placeholders remain.');

for(const [path,kind] of [['data/steam-ui-icons-v1253.json','game_ui'],['data/app-ui-icons.json','app_ui']]){
  const manifest=JSON.parse(await readFile(join(root,path),'utf8'));
  validateUiManifest(manifest,kind);
  let checked=0;
  for(const [key,entry] of Object.entries(manifest.icons)){
    const bytes=await readFile(resolve(root,entry.path));
    const sha=createHash('sha256').update(bytes).digest('hex');
    if(sha!==entry.sha256)throw new Error('UI icon hash mismatch: '+kind+':'+key);
    verifyUiAssetBytes(entry,bytes);
    checked++;
  }
  console.log('Verified '+kind+' VP8L UI icons: '+checked);
}
