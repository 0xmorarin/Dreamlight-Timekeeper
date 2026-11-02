import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateIconManifest,inspectLosslessWebP} from '../src/icon-assets.mjs';
import {validateUiManifest,verifyUiAssetBytes} from '../src/ui-assets.mjs';
import {auditSteamUiPublicationLedger,auditSteamUiPrivatePixelEvidence,auditSteamUiConsumerLinks,auditExistingGameUiPublicationRights} from '../src/steam-ui-provenance.mjs';

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

const catalog=JSON.parse(await readFile(join(root,'data','steam-ui-candidates-v1253.json'),'utf8'));
const gameManifest=JSON.parse(await readFile(join(root,'data','steam-ui-icons-v1253.json'),'utf8'));
const ledger=auditSteamUiPublicationLedger(catalog,gameManifest);
const rightsReview=JSON.parse(await readFile(join(root,'data','steam-ui-existing-rights-review-v1253.json'),'utf8'));
const rightsAudit=auditExistingGameUiPublicationRights(gameManifest,rightsReview);
console.log('Shipped Steam UI game-raster rights: '+rightsAudit.rightsReviewRequiredCount+
  '/4 require independent permission review; zero permissions established by static metadata.');

console.log('Steam UI source ledger STATIC crosscheck: '+ledger.publishedCount+'/'+ledger.candidateCount+
  ' deployed; HOLD '+ledger.heldKeys.join(', ')+' (not release-verified).');
const privateEvidence=JSON.parse(await readFile(join(root,'data','steam-ui-private-pixel-evidence-v1253.json'),'utf8'));
const privateCheck=auditSteamUiPrivatePixelEvidence(catalog,privateEvidence);
const consumerEvidence=JSON.parse(await readFile(join(root,'data','steam-ui-consumer-links-v1253.json'),'utf8'));
const consumerCheck=auditSteamUiConsumerLinks(catalog,consumerEvidence);
console.log('Steam UI source consumers: '+consumerCheck.sourceLinkedKeys.join(', ')+
  ' linked to bounded VillageAreaDisplay; '+consumerCheck.boundedNegativeKeys.join(', ')+
  ' not in scanned menu-hud only; no public approval.');

console.log('HOLD Steam UI real-source pixel SHA records: '+privateCheck.verifiedHashRecords+
  '/3 metadata crosschecked; no source bytes shipped, publication remains disabled.');


for(const [path,kind] of [['data/steam-ui-icons-v1253.json','game_ui'],['data/app-ui-icons.json','app_ui']]){
  const manifest=JSON.parse(await readFile(join(root,path),'utf8'));
  validateUiManifest(manifest,kind);
  let checked=0;
  for(const [key,entry] of Object.entries(manifest.icons)){
    const bytes=await readFile(resolve(root,entry.path));
    const sha=createHash('sha256').update(bytes).digest('hex');
    if(sha!==entry.sha256)throw new Error('UI icon hash mismatch: '+kind+':'+key);
    verifyUiAssetBytes(entry,bytes,kind);
    checked++;
  }
  console.log('Verified '+kind+' UI icons ('+(kind==='app_ui'?'safe SVG':'lossless VP8L')+'): '+checked);
}
