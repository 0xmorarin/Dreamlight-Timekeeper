import {inspectLosslessWebP} from './icon-assets.mjs';

export const GAME_UI_KEYS = Object.freeze([
  'currency.star-coin','currency.moonstone','currency.dreamlight','currency.mist','status.energy',
  'skill.fishing','skill.mining','skill.gardening','skill.foraging','skill.timebending',
  'skill.cooking','skill.crafting','category.furniture','category.clothing',
  'tab.spawn','tab.resources','tab.shops','tab.daily',
  'world.valley','world.exp1','world.exp2','world.exp3','world.hgw'
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
const APP_PATH = /^assets\/app\/ui\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.svg$/;
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
  if(kind==='app_ui'&&(src.platform!=='Dreamlight Timekeeper'||!Number.isSafeInteger(src.revision)||src.revision<3||src.assetFormat!=='SVG'||src.iconSet!=='Lucide'||src.upstreamRepository!=='lucide-icons/lucide'||src.upstreamCommit!=='a630cec77eac6568b989e87e4947a8bfe45caacd'))
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

export function inspectAppSvg(bytes){
  if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>16384)
    throw new Error('Invalid SVG asset byte size.');
  const svg=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const start='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f2f6f6" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">';
  if(!svg.startsWith(start)||!svg.endsWith('</svg>\n'))
    throw new Error('App SVG must use the fixed universal-design contract.');
  const shapes=svg.slice(start.length,-7);
  if(!shapes||shapes.includes('<!')||shapes.includes('<?')||shapes.includes('&')||
    /(?:script|foreignObject|image|href|url\(|onload|onclick|style|animate)/i.test(shapes))
    throw new Error('Unsupported or unsafe app SVG content.');
  const tags=shapes.match(/<(?:path|rect|circle|line|polyline|polygon|ellipse)\s[^<>]*\/>/g);
  if(!tags?.length||tags.join('')!==shapes)
    throw new Error('Only path, rect and circle geometry are allowed.');
  for(const tag of tags){
    const names=[...tag.matchAll(/\s([a-z][a-z0-9-]*)="([^"]*)"/g)];
    const attrs=new Set();
    for(const [,name,value] of names){
      if(!['d','cx','cy','r','x','y','x1','x2','y1','y2','width','height','rx','ry','points','stroke','fill'].includes(name)||
         attrs.has(name)||!/^[-0-9. MmLlHhVvCcSsQqTtAaZz,]+$/.test(value)&&
         !(name==='fill'&&value==='#f2f6f6')&&!(name==='stroke'&&value==='none'))
        throw new Error('Invalid SVG geometry attribute.');
      attrs.add(name);
    }
    const tagName=tag.match(/^<([a-z]+)/)?.[1];
    if(!attrs.size||tag.replace(/\s[a-z][a-z0-9-]*="[^"]*"/g,'')!==`<${tagName}/>`)
      throw new Error('App SVG has unrecognized shape attributes.');
  }
  return {width:24,height:24};
}
export function verifyUiAssetBytes(entry,bytes,kind='game_ui'){
  if(!isRecord(entry)||!(bytes instanceof Uint8Array)||bytes.byteLength>6*1024*1024)
    throw new Error('Invalid UI asset bytes.');
  const dimensions=kind==='app_ui'?inspectAppSvg(bytes):kind==='game_ui'?inspectLosslessWebP(bytes):null;
  if(!dimensions||dimensions.width!==entry.width||dimensions.height!==entry.height)
    throw new Error('UI icon dimensions mismatch.');
  return true;
}
