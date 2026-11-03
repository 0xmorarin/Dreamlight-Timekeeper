/**
 * 04 ASSET / Issue #17: metadata-only, per-ItemID image and rights ledger.
 *
 * This is NOT a product image resolver, licence issuer, game-pixel verifier or
 * Save reader. It derives a conservative read-only ledger from the existing
 * pinned ItemDB/source audit; no private asset/save bytes are accepted.
 */
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export const ITEM_IMAGE_RIGHTS_LEDGER='timekeeper.item-image-rights-ledger.v1';
const EVENT_SHA='028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea';
const STREAMS=Object.freeze({
 'ActivityItem.json':'20e4f190fc4481325cb4311a4a3f3e6fc57d3f1ca7a67acffd9c9008394ba5d4',
 'Furniture.json':'823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674',
 'Companion.json':'26534a8ea7f94212ea6a7cc03818ecb632cca60d9789175a80eb1b5ba384abea'
});
const GENERIC_GUID='04495f960b1edba4181ec51efa5e07d9';
const GENERIC_SPRITE='13192077654445607906';
const GENERIC_TEXTURE='15528772250824494050';
const PRIVATE_81_DIGEST='6d6d397b527736ade58d472d4693563f9484fd61f4cfe1e912d525a48f3f7057';
const fail=reason=>{throw new Error('IMAGE_RIGHTS_LEDGER_FAIL_CLOSED:'+reason);};
const validId=x=>Number.isSafeInteger(x)&&x>0;

/**
 * RIGHTS_APPROVED is deliberately unreachable in this audit: no source image
 * redistribution permission was provided. Future approval requires a separate
 * versioned, item/asset-specific rights record, independent QA and release gate.
 */
export function buildItemImageRightsLedger(audit,manifest){
 if(audit?.schema!=='TIMEKEEPER_ITEM_IMAGE_BASELINE_AUDIT_V1'||
    audit.source?.eventRawSHA256!==EVENT_SHA||
    audit.scope?.recurringEventDefinitions!==508||
    audit.scope?.recurringDistinctItemIDs!==244||
    audit.scope?.additionalRealSaveItemIDs!=='UNKNOWN_NOT_ENUMERATED_ON_THIS_STATIC_BASELINE'||
    audit.policy?.allowGameImagePublication!==false||
    audit.policy?.permissionState!=='NOT_ESTABLISHED'||
    audit.originalItemTypeCensus?.matchedByItemDbField1!==244||
    !Array.isArray(audit.items)||audit.items.length!==244)
  fail('SOURCE_SCOPE_OR_AUTHORITY');
 if(manifest?.source?.platform!=='Steam/Windows'||
    manifest.source?.gameVersion!=='1.25.3'||
    manifest.source?.status!=='NO_STEAM_ASSET_BYTES_VERIFIED'||
    !manifest.icons||typeof manifest.icons!=='object'||
    Array.isArray(manifest.icons)||Object.keys(manifest.icons).length!==0)
  fail('PUBLIC_MANIFEST_NOT_EMPTY_OR_UNVERIFIED');
 const privateCatalog=audit.field5WorldObjectCatalogAudit;
 if(privateCatalog?.sourceItemCount!==81||
    privateCatalog?.distinctField5Guids!==81||
    privateCatalog?.gameObjectCatalogEntries!==81||
    privateCatalog?.uniquePrimaryBundleCount!==32||
    privateCatalog?.privateCanonical81RouteMetadataSha256!==PRIVATE_81_DIGEST||
    privateCatalog?.field5NativeUsageVerified!==false||
    privateCatalog?.actualRuntimeVariantVerified!==false||
    privateCatalog?.renderedThumbsMatched!==0||
    privateCatalog?.publicImageUrlsGranted!==0||
    privateCatalog?.rights!=='NOT_ESTABLISHED')
  fail('PRIVATE_CATALOG_SCOPE_OR_VARIANT');
 const records=[];
 const counts={VERIFIED:0,AMBIGUOUS:0,MISSING:0,RIGHTS_APPROVED:0,REVIEW_REQUIRED:0,OFF:0};
 const sourceTypes={'ActivityItem.json':0,'Furniture.json':0,'Companion.json':0};
 let prev=0,exactPublicPrefabs=0,placeholderOccurrences=0;
 for(const row of audit.items){
  const id=row?.itemId,typed=row?.itemSourceType;
  if(!validId(id)||id<=prev||typed?.status!=='ORIGINAL_V1253_ITEMDB_FIELD1_VERIFIED'||
      typed?.sourceSha256!==STREAMS[typed.sourceStream]||
      typed?.itemIdField!==1||typed?.itemSourceCategoryOnly!==true||
      typed?.notRuntimeGameCategory!==true||typed?.notImageProof!==true)
   fail('ITEM_ID_OR_SOURCE_TYPE');
  prev=id;sourceTypes[typed.sourceStream]++;
  const status=row.readOnlyImageResolution?.status;
  if(!['AMBIGUOUS','MISSING'].includes(status)||
     row.readOnlyImageResolution.url!==null||row.publishedImage!=='MISSING'||
     row.spritePathId!==null||row.texturePathId!==null)
   fail('UNREVIEWED_IMAGE_PROMOTION');
  const source=row.definitionAudit;
  let candidateEvidence='NO_RELEASED_SOURCE_IMAGE';
  if(status==='AMBIGUOUS'){
   const generic=source?.catalogDependency,world=source?.worldObjectSource;
   if(source?.status!=='SHARED_ICON_ADDRESS_NOT_ITEM_SPECIFIC'||
      source.declaredIconAddressGuid!==GENERIC_GUID||
      source.spriteResolved!==false||source.textureResolved!==false||
      source.webpDecodedRgbaMatched!==false||
      generic?.genericSourceSpritePathId!==GENERIC_SPRITE||
      generic?.genericSourceTexturePathId!==GENERIC_TEXTURE||
      generic?.perItemSpritePathId!==null||generic?.perItemTexturePathId!==null||
      generic?.variantStatus!=='UNKNOWN_NOT_RUNTIME_OR_ITEM_SPECIFIC'||
      world?.catalogResourceType!=='UnityEngine.GameObject'||
      world?.doesNotResolve2DThumbnail!==true||
      world?.candidateRenderingStrategy!=='UNKNOWN_RUNTIME')
    fail('PLACEHOLDER_IS_NOT_PER_ITEM_2D');
   placeholderOccurrences+=row.references;
   const hasPublicExact=typeof world.gameObjectGuid==='string';
   if(hasPublicExact){
    if(!/^[0-9a-f]{32}$/.test(world.gameObjectGuid)||
       typeof world.primaryDependencyBundle!=='string'||
       !world.primaryDependencyBundle.endsWith('.bundle')||
       row.unresolvedVariantPriority?.tier!=='P0'||
       world.additionalSourcePathProof!=='EXACT_FIELD5_AND_CATALOG_DEPENDENCY')
     fail('UNPINNED_PUBLIC_PREFAB');
    exactPublicPrefabs++;
   }else if(world.additionalSourcePathProof!=='SOURCE_CENSUS_ONLY')
    fail('UNPROVEN_PRIVATE_ROUTE');
   candidateEvidence=hasPublicExact?'FIELD5_GAMEOBJECT_PUBLIC_REFERENCE_ONLY':
      'FIELD5_GAMEOBJECT_PRIVATE_CENSUS_ONLY';
  }else if(row.rgbaVerifiedForThisItem==='PRIVATE_PROTO_VP8L_RGBA_MATCH_NOT_PUBLISHED'){
   candidateEvidence='PRIVATE_PIXEL_PROTOTYPE_METADATA_NOT_INDEPENDENT_RELEASE_PROOF';
  }else if(source?.privatePixelProof?.status==='PRIVATE_SOURCE_VP8L_RGBA_EQUAL_NOT_RELEASED'){
   candidateEvidence='PRIVATE_ITEM_PIXEL_METADATA_NOT_INDEPENDENT_RELEASE_PROOF';
  }
  // Independent per-item statuses. "OFF" is an output decision; it cannot
  // become RIGHTS_APPROVED merely because a private hash or prefab exists.
  const record={
   itemId:id,sourceRecordType:typed.sourceStream,sourceRecordSha256:typed.sourceSha256,
   image:{status,publicUrl:null,originalItemSpritePathId:null,
    originalItemTexturePathId:null,runtimeVariant:'UNKNOWN_NOT_PROVEN',
    sourceRgbaSha256:null,losslessWebpSha256:null,losslessWebpBytes:null,
    independentPixelParity:'NOT_RUN',evidence:candidateEvidence},
   rights:{status:'REVIEW_REQUIRED',assetRedistributionPermission:'NOT_ESTABLISHED',
    scope:'EXTRACTED_DDV_ITEM_IMAGE_PUBLIC_STATIC_WEB_DISTRIBUTION',
    release:'OFF',attribution:'Disney/Gameloft and applicable rights holders; unaffiliated fan tool'}
  };
  records.push(record);
  counts[status]++;counts[record.rights.status]++;
  counts.OFF++;
 }
 if(counts.AMBIGUOUS!==81||counts.MISSING!==163||counts.VERIFIED!==0||
    counts.REVIEW_REQUIRED!==244||counts.RIGHTS_APPROVED!==0||
    exactPublicPrefabs!==9||placeholderOccurrences!==173||
    JSON.stringify(sourceTypes)!==JSON.stringify({
      'ActivityItem.json':173,'Furniture.json':52,'Companion.json':19}))
  fail('UNEXPECTED_COVERAGE_OR_PERMISSIONS');
 if(audit.readOnlyResolutionContract?.ambiguousWithoutUrl!==81||
    audit.readOnlyResolutionContract?.missingWithoutUrl!==163||
    audit.readOnlyResolutionContract?.verifiedPublished!==0)
  fail('STATUS_BASELINE_MISMATCH');
 return {
  schema:ITEM_IMAGE_RIGHTS_LEDGER,
  platform:'Steam/Windows',gameVersion:'1.25.3',
  sourceEventSha256:EVENT_SHA,sourceCategoryOnly:true,
  fullUserSaveVisibleItemIDDenominator:'UNKNOWN_NOT_OBSERVED',
  summary:{...counts,publicExactPrefabRouteMetadata:exactPublicPrefabs,
   privateAggregateOnlyPrefabRoutes:72,originalPerItemUiVariantsVerified:0,
   independentLosslessWebpPixelReopens:0},
  rightsBasis:{providerTerms:'https://www.gameloft.com/en/conditions-of-use',
   permissionForExtractedStaticGameSprites:'NOT_ESTABLISHED',
   propertyAttributionDoesNotGrantDistribution:true,
   technicalAuthenticityDoesNotGrantRights:true},
  records
 };
}

const cli=process.argv[1]&&fileURLToPath(import.meta.url)===fileURLToPath(new URL('file://'+process.argv[1]));
if(cli){
 const args=process.argv.slice(2);
 if(args.length>1||(args[0]&&args[0]!=='--json'))fail('UNKNOWN_CLI_ARGUMENT');
 const from=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const ledger=buildItemImageRightsLedger(await from('data/item-image-coverage-v1253.json'),
  await from('data/steam-icons-v1253.json'));
 // --json prints static provenance/rights IDs only. No Save or raster bytes.
 console.log(JSON.stringify(args[0]==='--json'?ledger:ledger.summary));
}
