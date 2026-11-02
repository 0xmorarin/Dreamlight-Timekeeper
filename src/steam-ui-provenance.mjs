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
       !['PASS_PRIVATE_2026-11-01','PASS_PRIVATE_REAL_SOURCE_2026-11-02','NOT_TESTED'].includes(row.pixelTrial)||
       (row.reviewState.startsWith('HOLD_')&&
        (typeof row.holdEvidence!=='string'||!row.holdEvidence.trim()||row.semanticUseProof!=='UNKNOWN'))||
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


const EVIDENCE_HASH=/^[0-9a-f]{64}$/;
const HELD_TRIAL_KEYS=Object.freeze(['tab.shops','tab.daily','world.hgw']);

/**
 * Cross-check a source-derived private review HASH RECORD against the public
 * provenance catalog. This does not contain the Steam source, private pixels,
 * released WebP images, native-typed PPtr field identity or publication rights.
 * A CI pass verifies metadata consistency only, not actual GPU image parity.
 */
export function auditSteamUiPrivatePixelEvidence(catalog,evidence){
  if(!object(evidence)||evidence.kind!=='PRIVATE_RESEARCH_PROVENANCE_HASHES_ONLY'||
     evidence.verificationLevel!=='REAL_STEAM_ORIGINAL_BYTES_DUAL_DECODER_RGBA_EQUAL_NON_RELEASE'||
     !object(evidence.source)||!object(evidence.method)||!object(evidence.heldCandidates)||
     evidence.releaseApproved!==false||evidence.publicManifestChanged!==false||
     evidence.gameWriterEnabled!==false)
    throw new Error('Private Steam source pixel evidence is missing or promoted beyond non-release scope.');
  const source=evidence.source,original=catalog?.source;
  if(!object(original)||source.platform!==original.platform||
     source.gameVersion!==original.gameVersion||source.fullVersion!==original.fullVersion||
     source.bundle!==original.bundle||source.bundleBytes!==original.bundleBytes||
     source.bundleSha256!==original.bundleSHA256||source.cabSha256!==original.cabSHA256||
     source.unity!==original.unity||
     source.objectCounts?.Sprite!==catalog.objectCounts?.Sprite||
     source.objectCounts?.Texture2D!==catalog.objectCounts?.Texture2D||
     !EVIDENCE_HASH.test(source.bundleSha256)||!EVIDENCE_HASH.test(source.cabSha256))
    throw new Error('Private Steam pixel source identity does not match pinned original UnityFS source.');
  if(evidence.method.rgbaParity!=='DDS_PILLOW_EQUALS_DDS_IMAGEMAGICK_EQUALS_PNG_PILLOW_EQUALS_PNG_IMAGEMAGICK_EQUALS_WEBP_PILLOW_EQUALS_WEBP_IMAGEMAGICK'||
     evidence.method.alphaZeroRgbIncluded!==true||
     evidence.method.pptr!=='ONE_ALIGNED_fileID0_pathID_PATTERN_NOT_NATIVE_TYPED_FIELD'||
     evidence.method.privateTrialBytesNotPublished!==true||
     !Array.isArray(evidence.method.decoders)||evidence.method.decoders.length!==4)
    throw new Error('Private Steam pixel evidence decoder or PPtr scope differs.');
  const keys=Object.keys(evidence.heldCandidates);
  if(keys.length!==HELD_TRIAL_KEYS.length||keys.some(key=>!HELD_TRIAL_KEYS.includes(key)))
    throw new Error('Private source pixel evidence must cover exactly the three still-held candidates.');
  for(const key of HELD_TRIAL_KEYS){
    const row=catalog.candidates.find(x=>x.key===key),item=evidence.heldCandidates[key];
    if(!row||!object(item)||!row.reviewState.startsWith('HOLD_')||
       row.pixelTrial!=='PASS_PRIVATE_REAL_SOURCE_2026-11-02'||
       item.spriteName!==row.spriteName||item.spritePathId!==row.spritePathId||
       item.texturePathId!==row.texturePathId||item.width!==row.width||
       item.height!==row.height||item.textureFormat!==row.textureFormat||
       !EVIDENCE_HASH.test(item.compressedSha256)||
       !EVIDENCE_HASH.test(item.decodedRgbaSha256)||
       !EVIDENCE_HASH.test(item.trialVp8lSha256)||
       item.compressedLength!==Math.ceil(row.width/4)*Math.ceil(row.height/4)*(row.textureFormat===10?8:16)||
       !Number.isInteger(item.alphaZeroPixels)||item.alphaZeroPixels<0||
       item.alphaZeroPixels>row.width*row.height||
       !Number.isInteger(item.trialVp8lBytes)||item.trialVp8lBytes<25||
       !Number.isInteger(item.file0PathIdOffset)||item.file0PathIdOffset%4!==0||
       item.sourceRgbaMatched!==true||item.vp8lRgbaMatched!==true||
       item.semanticConsumer!=='UNKNOWN'||item.distributionAuthorization!=='NOT_ESTABLISHED'||
       item.releaseApproved!==false||item.published!==false)
      throw new Error('Held Steam source pixel record is inconsistent or erroneously promoted: '+key);
  }
  return {verifiedHashRecords:3,verificationLevel:'PRIVATE_REAL_SOURCE_PIXEL_HASH_RECORD_CROSSCHECK_ONLY',releaseApproved:false};
}


/**
 * Bound the meaning of source-only external Sprite references to the one
 * Steam v1.25.3 HUD bundle actually inspected. Not evidence of rendering,
 * live Native consumer semantics, copyright permission, or release approval.
 */
export function auditSteamUiConsumerLinks(catalog,record){
  if(!object(record)||record.kind!=='STEAM_UI_CONSUMER_SOURCE_EVIDENCE_NON_RELEASE'||
     record.verification!=='REAL_STEAM_V1253_MENU_HUD_SERIALIZED_OBJECT_SCAN_NOT_RUNTIME'||
     !object(record.source)||!object(record.scope)||!object(record.candidates)||
     !object(record.legal)||record.publicAssetsUnchanged!==true||
     record.writerAuthorization!==false)
    throw new Error('UI consumer record missing or incorrectly authorized.');
  const source=record.source,catalogSource=catalog?.source;
  if(!object(catalogSource)||source.platform!==catalogSource.platform||
     source.gameVersion!==catalogSource.gameVersion||
     source.fullVersion!==catalogSource.fullVersion||
     source.targetAtlasBundleSha256!==catalogSource.bundleSHA256||
     source.menuBundle!=='menu-hud_assets_all.bundle'||source.menuBundleBytes!==665041||
     source.menuBundleSha256!=='9d24816c940159ae96020373ef0422ccea27560ddab070c26a847fa03a76425c'||
     source.menuCab!=='CAB-fba8a0306b5d2dd3c06e808dc8e96887'||
     source.menuCabSha256!=='6151b026636b138672ab3acb1cc503b487c16de8b368d74b338e0c82baf18337'||
     source.externalFileID!==2||
     source.externalCab!=='CAB-fe2bbf4dc0b20d2a3f3b5ff35a49ffe8'||
     source.serializedObjects!==12364)
    throw new Error('Menu-HUD serialized consumer source drift.');
  if(record.scope.bundlesInspected?.length!==1||
     record.scope.bundlesInspected[0]!==source.menuBundle||
     record.scope.otherBundlesNotChecked!==true||
     record.scope.componentFieldLayout!=='UNTYPED_SERIALIZED_PPTR_PATTERN'||
     record.scope.runtimeUIObserved!==false||
     record.scope.semanticTabMatchConfirmed!==false)
    throw new Error('Menu-HUD scan scope was overstated.');
  const keys=Object.keys(record.candidates);
  if(keys.length!==3||['world.hgw','tab.shops','tab.daily'].some(k=>!keys.includes(k)))
    throw new Error('Incomplete held candidate consumer audit.');
  for(const key of keys){
    const candidate=record.candidates[key],row=catalog.candidates.find(x=>x.key===key);
    if(!object(candidate)||!row||!row.reviewState.startsWith('HOLD_')||
       candidate.spritePathId!==row.spritePathId||
       candidate.texturePathId!==row.texturePathId||
       candidate.externalFileID!==2||!Array.isArray(candidate.spriteReferenceOffsets)||
       candidate.confirmedMenuTab!=='UNKNOWN'||candidate.visualRuntimeVerified!==false||
       candidate.sourcePixelEquality!==true||
       candidate.published!==false||candidate.releaseApproved!==false||
       typeof candidate.scopeNote!=='string'||!candidate.scopeNote.trim())
      throw new Error('Held consumer evidence fails closed: '+key);
    if(key==='world.hgw'){
      if(candidate.state!=='SOURCE_HUD_VILLAGE_AREA_DISPLAY_REF_CONFIRMED'||
         candidate.ownerClassId!==114||candidate.ownerPathId!=='13373502458456674114'||
         candidate.ownerByteLength!==1080||candidate.gameObjectClassId!==1||
         candidate.gameObjectPathId!=='7519985283486682946'||
         candidate.gameObjectName!=='VillageAreaDisplay'||
         candidate.uiRole!=='HUD_VILLAGE_AREA_DISPLAY_REFERENCE_ONLY'||
         JSON.stringify(candidate.spriteReferenceOffsets)!=='[780,796,812,828]')
        throw new Error('World HGW source HUD reference changed without independent evidence.');
    }else if(candidate.state!=='NOT_FOUND_IN_MENU_HUD_ONLY'||
             candidate.uiRole!=='UNKNOWN'||candidate.spriteReferenceOffsets.length!==0)
      throw new Error('Other menu consumer identities are unverified: '+key);
  }
  const rights=record.legal;
  if(rights.publisher!=='Gameloft'||
     rights.termsUrl!=='https://www.gameloft.com/en/conditions-of-use'||
     rights.explicitPermissionToRedistributeExtractedGameSprites!=='NOT_VERIFIED'||
     rights.legalConclusion!=='NOT_A_LEGAL_OPINION'||
     rights.newImagePublicDeployment!=='HOLD'||
     rights.existingFourPublishedImages!=='EXISTING_BASELINE_SEPARATE_RIGHTS_REVIEW'||
     rights.releaseApproved!==false)
    throw new Error('Game image distribution authorization cannot be inferred from source provenance.');
  return {
    sourceLinkedKeys:['world.hgw'],
    boundedNegativeKeys:['tab.shops','tab.daily'],
    verificationLevel:'REAL_MENU_HUD_SERIALIZED_REFERENCE_RECORD_ONLY',
    releaseApproved:false
  };
}


/**
 * Review the four *already shipped* Steam sprites independently of their
 * pixel provenance and runtime UI placement. A passing review is evidence of
 * an unresolved distribution-rights gate, NEVER a licence or deployment grant.
 */
export function auditExistingGameUiPublicationRights(manifest,review){
  validateUiManifest(manifest,'game_ui');
  if(!object(review)||review.kind!=='GAME_UI_EXISTING_PUBLICATION_RIGHTS_REVIEW_ONLY'||
     review.gameVersion!=='1.25.3'||review.platform!=='Steam/Windows'||
     review.sourceBundleSha256!==manifest.source.sourceBundleSha256||
     !object(review.terms)||!object(review.reviewedItems)||
     review.terms.url!=='https://www.gameloft.com/en/conditions-of-use'||
     JSON.stringify(review.terms.sections)!==
       JSON.stringify(['V.A Proprietary Rights','V.E Disney User Content conditional authorization'])||
     review.terms.specificExtractedSpritesPublicReusePermission!=='NOT_ESTABLISHED'||
     review.status!=='EXISTING_SHIPMENT_NOT_RIGHTS_APPROVAL'||
     review.rightsApproval!==false||review.releasePermissionFromPixelEquality!==false||
     review.originalMediaBytesIncluded!==false)
    throw new Error('Existing Steam UI rights status is missing or overstated.');
  const keys=Object.keys(review.reviewedItems);
  if(keys.length!==baselinePublishedKeys.length||
     keys.some(key=>!baselinePublishedKeys.includes(key))||
     Object.keys(manifest.icons).length!==baselinePublishedKeys.length)
    throw new Error('Existing Steam UI rights review must cover exactly the four shipped keys.');
  for(const key of baselinePublishedKeys){
    const entry=manifest.icons[key],item=review.reviewedItems[key];
    const role=key==='skill.mining'?'MINING_ACTIVITY_DECORATIVE_ICON':
      key==='status.warning'?'ANOMALOUS_TIMER_DECORATIVE_STATUS':
      key==='world.valley'?'MAIN_VALLEY_WORLD_FILTER':'ETERNITY_ISLE_WORLD_FILTER';
    if(!entry||!object(item)||item.publicPath!==entry.path||
       item.publicSha256!==entry.sha256||
       item.originalDecodedSourceSha256!==entry.sourceSha256||
       item.sourceAsset!==entry.sourceAsset||
       item.spritePathId!==entry.spritePathId||
       item.texturePathId!==entry.texturePathId||
       item.width!==entry.width||item.height!==entry.height||
       item.pixelProof!=='PRIOR_SOURCE_RECORDED_NOT_RERUN_ROUND9'||
       item.nativeGameConsumer!=='UNKNOWN_NOT_TYPED_OR_RUNTIME_CONFIRMED'||
       item.timekeeperUse!==role||
       item.currentDeployment!=='PUBLISHED_PREEXISTING'||
       item.copyrightRedistributionPermission!=='NOT_ESTABLISHED'||
       item.rightsReviewRequired!==true||item.releaseRightsApproved!==false)
      throw new Error('Existing Steam UI sprite rights or source evidence drift: '+key);
  }
  return {existingDeployedCount:baselinePublishedKeys.length,
    rightsConfirmedCount:0,rightsReviewRequiredCount:baselinePublishedKeys.length,
    verificationLevel:'STATIC_EXISTING_DEPLOYMENT_RIGHTS_RECORD_ONLY',
    publicationPermissionGranted:false};
}

/**
 * A release-decision inventory: NOT a switch that can delete media or grant
 * permission. Only 00 CTRL can authorize a packaging change after QR review.
 */
export function auditGameUiPublicationOptions(manifest,rights,catalog,options){
  auditExistingGameUiPublicationRights(manifest,rights);
  if(!object(options)||options.schema!=='STEAM_V1253_PUBLICATION_CONTROL_REVIEW_V1'||
     options.status!=='OWNER_00_CTRL_DECISION_REQUIRED'||
     options.decisionTaken!==false||options.appliedToDeployment!==false||
     options.gameUiOriginalCount!==4||options.originalSvgCount!==16||
     options.newItemIconCount!==0||options.privateSourceBytesIncluded!==false||
     !object(options.terms)||!object(options.existing)||!object(options.held)||
     !Array.isArray(options.choices))
    throw new Error('Game imagery publication options are missing or improperly authorized.');
  if(options.terms.gameloft!=='https://www.gameloft.com/en/conditions-of-use'||
     JSON.stringify(options.terms.gameloftSections)!=='["V.A","V.E"]'||
     options.terms.disneyGeneral!=='https://disneytermsofuse.com/english/'||
     options.terms.disneyDirectApplicabilityToDdv!=='NOT_EVALUATED'||
     options.terms.ddvSpecificAssetLicense!=='NOT_FOUND_IN_REVIEWED_PUBLIC_SOURCES'||
     options.terms.thirdPartyWikiPolicyIsNotPublisherPermission!==true)
    throw new Error('Official terms provenance or unverified license scope was promoted.');
  const expectedKeys=baselinePublishedKeys;
  if(Object.keys(options.existing).length!==4||
     Object.keys(options.existing).some(key=>!expectedKeys.includes(key)))
    throw new Error('Publication options must inventory the four deployed Steam assets.');
  for(const key of expectedKeys){
    const entry=manifest.icons[key],review=rights.reviewedItems[key],item=options.existing[key];
    if(!entry||!review||!object(item)||item.file!==entry.path||
       item.sha256!==entry.sha256||item.owner!=='GAMELOFT_OR_DISNEY_LICENSED_SOURCE'||
       item.basis!=='GAME_ASSET_EXTRACTED_FROM_PROPRIETARY_STEAM_UNITYFS'||
       item.pixelProof!=='PREVIOUSLY_RECORDED_NOT_RETESTED_ROUND10'||
       item.nativeConsumer!=='NOT_TYPED_OR_RUNTIME_VERIFIED'||
       item.redistributionPermission!=='NOT_DOCUMENTED'||
       item.sourceAttribution!=='STEAM_1_25_3_BUNDLE'||item.existingShip!==true||
       item.newPublicationAllowed!==false||
       review.copyrightRedistributionPermission!=='NOT_ESTABLISHED')
      throw new Error('Existing game image use, rights or deployment facts drifted: '+key);
  }
  const held=['world.hgw','tab.shops','tab.daily'];
  if(Object.keys(options.held).length!==3||Object.keys(options.held).some(k=>!held.includes(k)))
    throw new Error('All three held candidates must be represented.');
  for(const key of held){
    const item=options.held[key],row=catalog.candidates.find(x=>x.key===key);
    if(!object(item)||!row||!row.reviewState.startsWith('HOLD_')||
       row.pixelTrial!=='PASS_PRIVATE_REAL_SOURCE_2026-11-02'||
       item.pixelProof!=='REAL_STEAM_ORIGINAL_RGBA_CONFIRMED'||
       item.semantic!==(key==='world.hgw'?'HUD_VILLAGE_AREA_DISPLAY_UNTYPED_REFERENCE_ONLY':'UNKNOWN_ONLY_MENU_HUD_SCANNED')||
       item.permission!=='NOT_DOCUMENTED'||item.publish!==false)
      throw new Error('Held game image may not be deployed based solely on source pixels: '+key);
  }
  const expectedChoices=[
    ['retain_current_pending_rights_review','CONSIDERATION_ONLY',false,'EXISTING_4_ORIGINAL_GAME_IMAGES_STILL_SHIPPED',
     ['OWNER_DECISION','RIGHTS_BASIS_REVIEW','05_QR_SCOPED_ACCEPTANCE']],
    ['exclude_game_raster_files_from_distribution','CONSIDERATION_ONLY',true,'SHIP_NO_PROPRIETARY_RASTER',
     ['OWNER_DECISION','03_WEB_UI_FALLBACK_CONTRACT','00_CTRL_PACKAGING','05_QR_BROWSER_A11Y']],
    ['owner_authored_app_svg_or_plain_text','CONSIDERATION_ONLY',true,'ONLY_INDEPENDENT_OWNER_CREATED_UI_GRAPHICS_OR_TEXT',
     ['OWNER_SELECTS_APPROPRIATE_ARTWORK','03_WEB_MAPPING','04_ASSET_ORIGINALITY_VERIFICATION','05_QR_A11Y']],
    ['user_supplied_local_media_not_shipped','RESEARCH_ONLY',true,'USER_MANAGES_PRIVATE_LOCAL_INPUT_NON_UPLOADED',
     ['OWNER_PRODUCT_DECISION','01_CORE_03_WEB_SECURITY_CONTRACT','INDIVIDUAL_RIGHTS_REVIEW','05_QR']]
  ];
  if(options.choices.length!==expectedChoices.length)throw new Error('Missing Owner publication alternatives.');
  for(let i=0;i<expectedChoices.length;i++){
    const choice=options.choices[i],e=expectedChoices[i];
    if(!object(choice)||choice.id!==e[0]||choice.state!==e[1]||
       choice.assetChanges!==e[2]||choice.rightsResolved!==false||
       choice.exposure!==e[3]||JSON.stringify(choice.requires)!==JSON.stringify(e[4]))
      throw new Error('Owner-only publication alternative changed without review: '+e[0]);
  }
  return {gameRasterCount:4,heldCount:3,choicesForOwnerOnly:4,
    rightsApproved:0,deploymentsChanged:false,
    verificationLevel:'STATIC_PUBLICATION_DECISION_RECORD_ONLY'};
}
