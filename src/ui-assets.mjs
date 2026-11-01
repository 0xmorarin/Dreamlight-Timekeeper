import {inspectLosslessWebP} from './icon-assets.mjs';

export const GAME_UI_KEYS = Object.freeze([
  'currency.star-coin','currency.moonstone','currency.dreamlight','currency.mist','status.energy',
  'skill.fishing','skill.mining','skill.gardening','skill.foraging','skill.timebending',
  'skill.cooking','skill.crafting','category.furniture','category.clothing',
  'tab.spawn','tab.resources','tab.shops','tab.daily'
]);
export const APP_UI_KEYS = Object.freeze([
  'action.open-save','action.backup','action.open-another','status.warning',
  'status.error','status.success','action.search','action.filter',
  'action.expand','action.collapse','action.calendar','action.clock',
  'action.utc','action.local-time','action.technical-details','status.missing-asset'
]);

const SHA = /^[a-f0-9]{64}$/;
const KEY = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const GAME_PATH = /^assets\/steam\/v1253\/ui\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.webp$/;
const APP_PATH = /^assets\/app\/ui\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.webp$/;
const isRecord = v => v!==null&&typeof v==='object'&&!Array.isArray(v);
const isInt = v => Number.isInteger(v)&&v>=1&&v<=16384;

export function validateUiManifest(manifest,kind){
  if(!['game_ui','app_ui'].includes(kind)||!isRecord(manifest)||manifest.kind!==kind||
     !isRecord(manifest.source)||!isRecord(manifest.icons)||
     manifest.source.writerAuthorization!==false)throw new Error('Invalid UI asset manifest.');
  const src=manifest.source;
  if(kind==='game_ui'&&(src.platform!=='Steam/Windows'||src.gameVersion!=='1.25.3'||
     !SHA.test(src.sourceBundleSha256)||typeof src.sourceBundle!=='string'||!src.sourceBundle))
    throw new Error('Steam UI asset provenance mismatch.');
  if(kind==='app_ui'&&(src.platform!=='Dreamlight Timekeeper'||!Number.isSafeInteger(src.revision)||src.revision<1))
    throw new Error('App UI asset version mismatch.');
  const records=Object.entries(manifest.icons);
  if(src.status!==(records.length?'VERIFIED_ASSETS':'NO_ASSETS_VERIFIED'))
    throw new Error('UI asset manifest availability status mismatch.');
  const paths=new Set();
  for(const [key,item] of records){
    if(!KEY.test(key)||!isRecord(item)||item.verified!==true||
       item.kind!==kind||!isInt(item.width)||!isInt(item.height)||
       !SHA.test(item.sha256)||!SHA.test(item.sourceSha256)||
       !(kind==='game_ui'?GAME_PATH:APP_PATH).test(item.path)||
       typeof item.sourceAsset!=='string'||!item.sourceAsset.trim()||
       typeof item.mappingEvidence!=='string'||!item.mappingEvidence.trim())
      throw new Error('UI icon entry lacks verified source, path or metadata: '+key);
    if(kind==='game_ui'&&(!/^[0-9]+$/.test(item.spritePathId||'')||
      !/^[0-9]+$/.test(item.texturePathId||'')||
      item.platform!=='Steam'||item.gameVersion!=='1.25.3'))
      throw new Error('UI icon lacks exact Steam Sprite/Texture reference: '+key);
    if(paths.has(item.path))throw new Error('Duplicate UI image output path.');
    paths.add(item.path);
  }
  return true;
}

export function resolveUiIcon(manifest,kind,semanticKey){
  if(typeof semanticKey!=='string'||!KEY.test(semanticKey))return null;
  try{validateUiManifest(manifest,kind);}catch{return null;}
  return manifest.icons[semanticKey]||null;
}
export const resolveGameUiIcon=(manifest,semanticKey)=>resolveUiIcon(manifest,'game_ui',semanticKey);
export const resolveAppUiIcon=(manifest,semanticKey)=>resolveUiIcon(manifest,'app_ui',semanticKey);

export function verifyUiAssetBytes(entry,bytes){
  if(!isRecord(entry)||!(bytes instanceof Uint8Array)||bytes.byteLength>6*1024*1024)
    throw new Error('Invalid UI asset bytes.');
  const dimensions=inspectLosslessWebP(bytes);
  if(dimensions.width!==entry.width||dimensions.height!==entry.height)
    throw new Error('UI icon pixel dimensions mismatch.');
  return true;
}
