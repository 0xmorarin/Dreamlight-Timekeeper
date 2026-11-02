import {GAME_UI_KEYS,validateUiManifest} from './ui-assets.mjs';

const PATH_ID=/^[1-9][0-9]*$/;
const SEMANTIC=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exactBuild='releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22';
const bundleSha='8fb0c3dbc4f937bee5d2918dfd2b9bef115dd6626e15af712f3669becc102b3d';
const cabSha='f9454de68620f0dd15a0e1cb216f6ee86566a34672a63b706eb4c3f9292f3408';
// The four existing shipped images are the pinned byte-reviewed deployment baseline.
// Changing this list requires fresh source, deployment-byte, pixel and rights review.
const baselinePublishedKeys=Object.freeze(['skill.mining','status.warning','world.valley','world.exp1']);

/**
 * Cross-check public UI entries against the versioned STATIC source ledger.
 * Does not read the private Steam UnityFS bundle, establish independent pixel
 * equality, or grant permission to publish copyrighted original game images.
 */
export function auditSteamUiPublicationLedger(catalog,manifest){
  if(!object(catalog)||!object(catalog.source)||!object(catalog.objectCounts)||
     !Array.isArray(catalog.candidates))throw new Error('Missing Steam UI candidate source ledger.');
  const source=catalog.source;
  if(source.platform!=='Steam/Windows'||source.gameVersion!=='1.25.3'||
     source.fullVersion!==exactBuild||source.bundle!=='ui-imagesatlas_assets_all.bundle'||
     source.bundleBytes!==158399415||source.bundleSHA256!==bundleSha||
     source.cabSHA256!==cabSha||source.unity!=='6000.0.62f1'||source.writerAuthorization!==false||
     source.evidence!=='STATIC_PPTR_AND_FULL_SPRITE_RECT_VERIFIED'||
     catalog.objectCounts.Sprite!==2428||catalog.objectCounts.Texture2D!==2330)
    throw new Error('Steam UI source ledger identity or structure differs from audited v1.25.3 source.');
  validateUiManifest(manifest,'game_ui');
  if(manifest.source.sourceBundle!=='ddv_Data/StreamingAssets/aa/win/'+source.bundle||
     manifest.source.sourceBundleSha256!==source.bundleSHA256)
    throw new Error('Public Steam UI manifest references a different source bundle.');

  const keys=new Set(),sprites=new Set(),textures=new Set(),index=new Map();
  for(const row of catalog.candidates){
    if(!object(row)||!SEMANTIC.test(row.key)||!GAME_UI_KEYS.includes(row.key)||
       !PATH_ID.test(row.spritePathId)||!PATH_ID.test(row.texturePathId)||
       typeof row.spriteName!=='string'||!row.spriteName.trim()||
       !Number.isInteger(row.width)||!Number.isInteger(row.height)||
       row.width<1||row.height<1||row.width>1024||row.height>1024||
       ![10,12,25].includes(row.textureFormat)||
       !Number.isInteger(row.alternativeCount)||row.alternativeCount<1||
       !['STATIC_REFERENCE_VERIFIED','HOLD_DEPLOYMENT','HOLD_SEMANTIC_REVIEW'].includes(row.reviewState)||
       !['PASS_PRIVATE_2026-11-01','NOT_TESTED'].includes(row.pixelTrial)||
       keys.has(row.key)||sprites.has(row.spritePathId)||textures.has(row.texturePathId))
      throw new Error('Malformed, ambiguous or duplicated Steam UI source candidate: '+row?.key);
    keys.add(row.key);sprites.add(row.spritePathId);textures.add(row.texturePathId);index.set(row.key,row);
  }
  const published=Object.entries(manifest.icons);
  for(const [key,entry] of published){
    const row=index.get(key);
    if(!baselinePublishedKeys.includes(key))
      throw new Error('Unreviewed game UI deployment outside pinned four-image baseline: '+key);
    if(!row)throw new Error('Published game UI image missing from source candidate ledger: '+key);
    if(row.reviewState!=='STATIC_REFERENCE_VERIFIED'||row.pixelTrial!=='PASS_PRIVATE_2026-11-01')
      throw new Error('Publication refused for held or untested Steam UI candidate: '+key);
    if(row.spritePathId!==entry.spritePathId||row.texturePathId!==entry.texturePathId||
       row.width!==entry.width||row.height!==entry.height||
       !entry.sourceAsset.endsWith('|'+row.spriteName))
      throw new Error('Public Steam UI Sprite/Texture/name/dimensions drift: '+key);
  }
  return {
    candidateCount:index.size,publishedCount:published.length,
    heldKeys:catalog.candidates.filter(x=>x.reviewState.startsWith('HOLD_')).map(x=>x.key),
    unpublishedCount:index.size-published.length,
    verificationLevel:'STATIC_LEDGER_CROSSCHECK_ONLY'
  };
}
