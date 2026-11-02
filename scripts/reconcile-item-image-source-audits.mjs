import {readFile,readdir,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {recurringImageTargets} from '../src/item-image-coverage.mjs';

export const PRIVATE_SOURCE_BUNDLES=Object.freeze({
 'ingredient_1c1bf99b':'3cd8bec46facd9c4caa128982d08265dd3be18cd2ca4244841f96a6c34f76252',
 'flower_584a9f69':'e7cbd3f2c08f13bcca84e58ec96cf519ef566cb2061c5ae6fe3d65a612b97770',
 'fish_3f084647':'cfb844919e844124ba390730ec95d6dd0e4fabfaf409f25227e5ef09beb551a6',
 'seed_8c733f88':'3650906d8318350dd35944ddbcf67f4616e11c37e544ab379a48faa059514e3f',
 'craftingmaterial_a01be543':'85255ade497a5fcf9945d569624286d518c7d07d874f32b84ad612173436137c',
 'crop_7563a03a':'c7301948d3d58315da07330245e1c58857492069b9007c79ad6a9344fcd7a3e9',
 'mineral_6fc39434':'0e530e5bed94c8c840c9506cec8be46f61a2615651f5ced8d842033f97734b3e'
});
const ACTIVITY_SHA='20e4f190fc4481325cb4311a4a3f3e6fc57d3f1ca7a67acffd9c9008394ba5d4';
const idOk=id=>typeof id==='string'&&/^[1-9][0-9]*$/.test(id)&&Number.isSafeInteger(Number(id));
const guidOk=v=>typeof v==='string'&&/^[0-9a-f]{32}$/.test(v);
const pathIdOk=v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v);
const sourceOk=s=>s?.gameVersion==='1.25.3'&&s?.platform==='Steam/Windows'&&
 s.activityItemSHA256===ACTIVITY_SHA&&
 Object.values(PRIVATE_SOURCE_BUNDLES).includes(s.bundleSHA256);

/** Read-only reconciliation; no texture decoding and no assumed SpriteID from
 * English labels. Outputs references, not publishable images or permissions. */
export function reconcileReviewedIconAudits(events,bundles,{requireAllSeven=true}={}){
 const targets=recurringImageTargets(events,{strictBaseline:true});
 const expectedHashes=new Set(Object.values(PRIVATE_SOURCE_BUNDLES));
 const visited=new Set(),map=new Map(),imageAssets=new Map(),duplicates=[],invalid=[];
 let totalCandidates=0;
 for(const bundle of bundles){
  if(!sourceOk(bundle?.source)||!Array.isArray(bundle.candidates))throw new Error('Unverified Steam bundle source.');
  const source=bundle.source.bundleSHA256;
  if(visited.has(source))throw new Error('Duplicate source bundle audit.');
  visited.add(source);
  for(const row of bundle.candidates){
   if(!idOk(row.itemId)||!guidOk(row.guid)||!pathIdOk(row.spritePathId)||
      !pathIdOk(row.texturePathId)||!Number.isInteger(row.width)||row.width<1||
      !Number.isInteger(row.height)||row.height<1||row.width>1024||row.height>1024||
      !['BC7','DXT5'].includes(row.textureFormat)){
    invalid.push({itemId:String(row?.itemId??'?'),reason:'INVALID_SPRITE_TEXTURE_PROVENANCE'});
    continue;
   }
   totalCandidates++;
   if(map.has(row.itemId)){
    duplicates.push({itemId:row.itemId,
      originalSource:map.get(row.itemId).sourceBundleSha256,newSource:source});
    continue;
   }
   const identity=[source,row.guid,row.spritePathId,row.texturePathId].join(':');
   const previous=imageAssets.get(identity)||[];
   previous.push(row.itemId);imageAssets.set(identity,previous);
   map.set(row.itemId,{
    itemId:Number(row.itemId),sourceBundleSha256:source,
    guid:row.guid,spritePathId:row.spritePathId,texturePathId:row.texturePathId,
    width:row.width,height:row.height,textureFormat:row.textureFormat,
    state:'STATIC_SOURCE_LINK_ONLY_NO_PUBLIC_IMAGE'
   });
  }
 }
 if(requireAllSeven&&(visited.size!==expectedHashes.size||
  [...expectedHashes].some(x=>!visited.has(x))))throw new Error('Unreviewed or missing one of seven source bundles.');
 if(invalid.length||duplicates.length)throw new Error('Malformed or conflicting per-ItemID static crosswalk.');
 const covered=targets.items.filter(x=>map.has(String(x.itemId)));
 const missing=targets.items.filter(x=>!map.has(String(x.itemId)));
 return {
  sourceBundleCount:visited.size,candidateItemIDs:map.size,sourceRows:totalCandidates,
  recurringItemIDs:targets.itemIdCount,recurringStaticLinked:covered.length,
  recurringUnlinked:missing.length,sharedSourceSpriteAliases:[...imageAssets.values()].filter(x=>x.length>1).length,
  duplicateItemIdConflicts:duplicates.length,invalidProvenance:invalid.length,
  covered:covered.map(x=>map.get(String(x.itemId))),
  missing:missing.map(x=>x.itemId)
 };
}

const cli=resolve(process.argv[1]||'')===fileURLToPath(import.meta.url);
if(cli){
 const dir=process.argv[2];
 if(!dir||process.argv.length!==3)throw new Error(
  'Usage: node scripts/reconcile-item-image-source-audits.mjs <private-directory-with-seven-audits>');
 const folder=await realpath(resolve(dir)),entries=await readdir(folder);
 const json=async p=>JSON.parse(await readFile(p,'utf8'));
 const expected=Object.keys(PRIVATE_SOURCE_BUNDLES).sort().map(x=>x+'.json');
 if(JSON.stringify(entries.sort())!==JSON.stringify(expected))
  throw new Error('Private source-audit directory must have seven exact JSON inputs; no raw assets.');
 const bundleAudits=await Promise.all(expected.map(x=>json(join(folder,x))));
 const events=await json(fileURLToPath(new URL('../data/events-v1253.json',import.meta.url)));
 const report=reconcileReviewedIconAudits(events,bundleAudits);
 // Explicitly print only aggregate counts; do not disclose private source rows or image pixels.
 console.log(JSON.stringify({
  sourceBundles:report.sourceBundleCount,candidateItemIDs:report.candidateItemIDs,
  recurringItemIDs:report.recurringItemIDs,recurringStaticLinked:report.recurringStaticLinked,
  recurringUnlinked:report.recurringUnlinked,
  sharedSourceSpriteAliases:report.sharedSourceSpriteAliases,
  verifiedEncodedWebp:0,publishedImagePermission:'NOT_ESTABLISHED'
 }));
}
