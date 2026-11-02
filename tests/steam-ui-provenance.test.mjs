import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditSteamUiPublicationLedger,auditSteamUiPrivatePixelEvidence,auditSteamUiConsumerLinks,auditExistingGameUiPublicationRights,auditGameUiPublicationOptions} from '../src/steam-ui-provenance.mjs';

const catalog=JSON.parse(await readFile(new URL('../data/steam-ui-candidates-v1253.json',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../data/steam-ui-icons-v1253.json',import.meta.url),'utf8'));
const pixelEvidence=JSON.parse(await readFile(new URL('../data/steam-ui-private-pixel-evidence-v1253.json',import.meta.url),'utf8'));
const consumerEvidence=JSON.parse(await readFile(new URL('../data/steam-ui-consumer-links-v1253.json',import.meta.url),'utf8'));
const publicRightsReview=JSON.parse(await readFile(new URL('../data/steam-ui-existing-rights-review-v1253.json',import.meta.url),'utf8'));
const publicationOptions=JSON.parse(await readFile(new URL('../data/steam-ui-publication-options-v1253.json',import.meta.url),'utf8'));
const copy=x=>structuredClone(x);
const run=(c=catalog,m=manifest)=>auditSteamUiPublicationLedger(c,m);
const publishedKey='skill.mining';

test('static source ledger matches four shipped UI images; all HOLD candidates unpublished',()=>{
  const result=run();
  assert.equal(result.verificationLevel,'STATIC_LEDGER_CROSSCHECK_ONLY');
  assert.equal(result.candidateCount,21);
  assert.equal(result.publishedCount,4);
  assert.equal(result.unpublishedCount,17);
  assert.deepEqual(result.heldKeys,['tab.shops','tab.daily','world.hgw']);
  assert.equal(Object.hasOwn(manifest.icons,'world.hgw'),false);
});

test('cross-version or changed Steam UnityFS/CAB identity fails closed',()=>{
  for(const field of ['gameVersion','fullVersion','bundle','bundleBytes','bundleSHA256','cabSHA256','unity','writerAuthorization']){
    const c=copy(catalog);c.source[field]='DRIFT';
    assert.throws(()=>run(c),/source ledger identity/);
  }
  for(const field of ['sourceBundle','sourceBundleSha256']){
    const m=copy(manifest);m.source[field]=field==='sourceBundle'?'different.bundle':'0'.repeat(64);
    assert.throws(()=>run(catalog,m),/different source bundle|manifest/);
  }
});

test('Sprite path, Texture path, source name or dimensions drift rejects publication',()=>{
  for(const field of ['spritePathId','texturePathId','spriteName','width','height']){
    const c=copy(catalog);const row=c.candidates.find(x=>x.key===publishedKey);
    row[field]=field==='width'||field==='height'?row[field]+1:'garbled';
    assert.throws(()=>run(c),/drift|Malformed/);
  }
});

test('HOLD candidates cannot be promoted by a copied manifest or by changing catalog status',()=>{
  const c=copy(catalog),m=copy(manifest),row=c.candidates.find(x=>x.key==='world.hgw');
  const cloned=copy(m.icons['world.valley']);
  cloned.path='assets/steam/v1253/ui/world/hgw.webp';
  cloned.sourceAsset='CAB-fe2bbf4dc0b20d2a3f3b5ff35a49ffe8|'+row.spriteName;
  cloned.spritePathId=row.spritePathId;cloned.texturePathId=row.texturePathId;
  cloned.width=row.width;cloned.height=row.height;
  m.icons['world.hgw']=cloned;
  assert.throws(()=>run(c,m),/Unreviewed game UI deployment/);
  row.reviewState='STATIC_REFERENCE_VERIFIED';
  row.pixelTrial='NOT_TESTED';
  assert.throws(()=>run(c,m),/Unreviewed game UI deployment/);
  row.pixelTrial='PASS_PRIVATE_2026-11-01';
  assert.throws(()=>run(c,m),/Unreviewed game UI deployment/);
});

test('missing, duplicate or unregistered candidate records fail closed',()=>{
  const c=copy(catalog);c.candidates=c.candidates.filter(x=>x.key!==publishedKey);
  assert.throws(()=>run(c),/missing from source candidate ledger/);
  const duplicate=copy(catalog);duplicate.candidates.push(copy(duplicate.candidates[0]));
  assert.throws(()=>run(duplicate),/duplicated/);
  const unknown=copy(catalog);unknown.candidates[0].key='unknown.fictional';
  assert.throws(()=>run(unknown),/Malformed/);
});

test('HOLD evidence must remain explicit and cannot imply consumer semantics',()=>{
  const missing=copy(catalog);
  missing.candidates.find(x=>x.key==='tab.shops').holdEvidence='';
  assert.throws(()=>run(missing),/Malformed/);
  const promotion=copy(catalog);
  promotion.candidates.find(x=>x.key==='tab.daily').semanticUseProof='CONFIRMED';
  assert.throws(()=>run(promotion),/Malformed/);
});

test('a static ledger result cannot be misreported as pixel or release approval',()=>{
  const result=run();
  assert.ok(!('pixelVerified' in result));
  assert.ok(!('releaseApproved' in result));
});

test('three real-source hash records remain non-publishable and linked to HOLD rows',()=>{
  const result=auditSteamUiPrivatePixelEvidence(catalog,pixelEvidence);
  assert.equal(result.verifiedHashRecords,3);
  assert.equal(result.releaseApproved,false);
  assert.equal(result.verificationLevel,'PRIVATE_REAL_SOURCE_PIXEL_HASH_RECORD_CROSSCHECK_ONLY');
  assert.equal(run().publishedCount,4);
  for(const key of ['world.hgw','tab.shops','tab.daily'])
    assert.equal(Object.hasOwn(manifest.icons,key),false);
});

test('private pixel provenance source, dimensions, alpha, PPtr or release promotion fails closed',()=>{
  const runPixel=(c=catalog,e=pixelEvidence)=>auditSteamUiPrivatePixelEvidence(c,e);
  const modifications=[
    e=>{e.source.bundleSha256='0'.repeat(64);},
    e=>{e.source.cabSha256='a'.repeat(64);},
    e=>{e.method.pptr='TYPED_PPTR_CONFIRMED';},
    e=>{e.method.alphaZeroRgbIncluded=false;},
    e=>{e.releaseApproved=true;},
    e=>{e.publicManifestChanged=true;},
    e=>{e.heldCandidates['tab.shops'].compressedSha256='x';},
    e=>{e.heldCandidates['tab.daily'].decodedRgbaSha256='x';},
    e=>{e.heldCandidates['world.hgw'].trialVp8lSha256='x';},
    e=>{e.heldCandidates['world.hgw'].trialVp8lBytes=0;},
    e=>{e.heldCandidates['tab.daily'].compressedLength=0;},
    e=>{e.heldCandidates['tab.daily'].alphaZeroPixels=100000;},
    e=>{e.heldCandidates['tab.shops'].file0PathIdOffset=133;},
    e=>{e.heldCandidates['tab.shops'].sourceRgbaMatched=false;},
    e=>{e.heldCandidates['tab.shops'].semanticConsumer='CONFIRMED';},
    e=>{e.heldCandidates['world.hgw'].distributionAuthorization='GRANTED';},
    e=>{e.heldCandidates['world.hgw'].published=true;},
    e=>{delete e.heldCandidates['tab.daily'];}
  ];
  for(const mutate of modifications){
    const evidence=copy(pixelEvidence);mutate(evidence);
    assert.throws(()=>runPixel(catalog,evidence));
  }
  const c=copy(catalog);
  c.candidates.find(x=>x.key==='tab.daily').reviewState='STATIC_REFERENCE_VERIFIED';
  assert.throws(()=>runPixel(c));
  const c2=copy(catalog);
  c2.candidates.find(x=>x.key==='tab.shops').width++;
  assert.throws(()=>runPixel(c2));
  const c3=copy(catalog);
  c3.candidates.find(x=>x.key==='world.hgw').pixelTrial='NOT_TESTED';
  assert.throws(()=>runPixel(c3));
});

test('real Steam HUD source reference evidence is bounded and no HOLD image is publishable',()=>{
  const r=auditSteamUiConsumerLinks(catalog,consumerEvidence);
  assert.deepEqual(r.sourceLinkedKeys,['world.hgw']);
  assert.deepEqual(r.boundedNegativeKeys,['tab.shops','tab.daily']);
  assert.equal(r.verificationLevel,'REAL_MENU_HUD_SERIALIZED_REFERENCE_RECORD_ONLY');
  assert.equal(r.releaseApproved,false);
  for(const key of ['world.hgw','tab.shops','tab.daily'])
    assert.equal(Object.hasOwn(manifest.icons,key),false);
});

test('consumer linking, game-specific semantic or redistribution claims require independent evidence',()=>{
  const reject=next=>assert.throws(()=>auditSteamUiConsumerLinks(catalog,next));
  const changes=[
    x=>{x.source.menuBundleSha256='0'.repeat(64);},
    x=>{x.source.menuCabSha256='0'.repeat(64);},
    x=>{x.source.externalFileID=1;},
    x=>{x.source.externalCab='CAB-other';},
    x=>{x.source.serializedObjects=0;},
    x=>{x.source.targetAtlasBundleSha256='0'.repeat(64);},
    x=>{x.scope.bundlesInspected.push('menu-collection');},
    x=>{x.scope.runtimeUIObserved=true;},
    x=>{x.scope.componentFieldLayout='NATIVE_TYPED_PPTR';},
    x=>{x.candidates['world.hgw'].gameObjectName='WrongMap';},
    x=>{x.candidates['world.hgw'].ownerPathId='1';},
    x=>{x.candidates['world.hgw'].spriteReferenceOffsets=[780,796,812,836];},
    x=>{x.candidates['world.hgw'].uiRole='WORLD_MAP_CATEGORY_CONFIRMED';},
    x=>{x.candidates['world.hgw'].confirmedMenuTab='world.hgw';},
    x=>{x.candidates['tab.shops'].state='SOURCE_CONFIRMED';},
    x=>{x.candidates['tab.daily'].spriteReferenceOffsets=[12];},
    x=>{x.candidates['tab.daily'].visualRuntimeVerified=true;},
    x=>{x.candidates['tab.daily'].releaseApproved=true;},
    x=>{x.legal.explicitPermissionToRedistributeExtractedGameSprites='GRANTED';},
    x=>{x.legal.newImagePublicDeployment='APPROVED';},
    x=>{x.legal.existingFourPublishedImages='AUTOMATICALLY_APPROVED';},
    x=>{x.publicAssetsUnchanged=false;},
    x=>{delete x.candidates['tab.daily'];}
  ];
  for(const change of changes){const next=copy(consumerEvidence);change(next);reject(next);}
  const altered=copy(catalog);
  altered.candidates.find(x=>x.key==='world.hgw').reviewState='STATIC_REFERENCE_VERIFIED';
  assert.throws(()=>auditSteamUiConsumerLinks(altered,consumerEvidence));
});

test('four already deployed game sprites each require separate rights review despite verified source hashes',()=>{
  const result=auditExistingGameUiPublicationRights(manifest,publicRightsReview);
  assert.equal(result.existingDeployedCount,4);
  assert.equal(result.rightsConfirmedCount,0);
  assert.equal(result.rightsReviewRequiredCount,4);
  assert.equal(result.publicationPermissionGranted,false);
  assert.equal(result.verificationLevel,'STATIC_EXISTING_DEPLOYMENT_RIGHTS_RECORD_ONLY');
  for(const key of ['skill.mining','status.warning','world.valley','world.exp1'])
    assert.equal(publicRightsReview.reviewedItems[key].copyrightRedistributionPermission,'NOT_ESTABLISHED');
});

test('published image rights metadata fails closed on changed source or false permission',()=>{
  const verify=(m=manifest,r=publicRightsReview)=>auditExistingGameUiPublicationRights(m,r);
  const mutations=[
    e=>{e.rightsApproval=true;},
    e=>{e.releasePermissionFromPixelEquality=true;},
    e=>{e.originalMediaBytesIncluded=true;},
    e=>{e.terms.url='https://invalid.example';},
    e=>{e.terms.sections=[];},
    e=>{e.terms.specificExtractedSpritesPublicReusePermission='GRANTED';},
    e=>{e.status='RELEASE_APPROVED';},
    e=>{e.sourceBundleSha256='0'.repeat(64);},
    e=>{delete e.reviewedItems['world.exp1'];},
    e=>{e.reviewedItems['tab.daily']=copy(e.reviewedItems['world.exp1']);},
    e=>{e.reviewedItems['world.valley'].rightsReviewRequired=false;},
    e=>{e.reviewedItems['world.valley'].releaseRightsApproved=true;},
    e=>{e.reviewedItems['world.valley'].nativeGameConsumer='RUNTIME_CONFIRMED';},
    e=>{e.reviewedItems['skill.mining'].copyrightRedistributionPermission='GRANTED';},
    e=>{e.reviewedItems['status.warning'].publicSha256='x';},
    e=>{e.reviewedItems['status.warning'].sourceAsset='WRONG';},
    e=>{e.reviewedItems['world.exp1'].timekeeperUse='SHOP_CATEGORY';}
  ];
  for(const modify of mutations){const r=copy(publicRightsReview);modify(r);assert.throws(()=>verify(manifest,r));}
  const altered=copy(manifest);
  altered.icons['world.valley'].spritePathId='1';
  assert.throws(()=>verify(altered));
});

test('four already-shipped and three held game images remain Owner-only publication decisions',()=>{
  const result=auditGameUiPublicationOptions(manifest,publicRightsReview,catalog,publicationOptions);
  assert.deepEqual(result,{gameRasterCount:4,heldCount:3,choicesForOwnerOnly:4,
    rightsApproved:0,deploymentsChanged:false,
    verificationLevel:'STATIC_PUBLICATION_DECISION_RECORD_ONLY'});
});

test('publication decision never auto-approves original sprite distribution or silently deletes deployed files',()=>{
  const verify=o=>auditGameUiPublicationOptions(manifest,publicRightsReview,catalog,o);
  const changes=[
    x=>{x.decisionTaken=true;},
    x=>{x.appliedToDeployment=true;},
    x=>{x.privateSourceBytesIncluded=true;},
    x=>{x.status='PERMISSION_GRANTED';},
    x=>{x.terms.ddvSpecificAssetLicense='UNRESTRICTED';},
    x=>{x.terms.disneyDirectApplicabilityToDdv='YES';},
    x=>{x.terms.thirdPartyWikiPolicyIsNotPublisherPermission=false;},
    x=>{x.existing['skill.mining'].redistributionPermission='YES';},
    x=>{x.existing['status.warning'].sha256='0'.repeat(64);},
    x=>{x.existing['world.valley'].nativeConsumer='VERIFIED';},
    x=>{x.existing['world.exp1'].newPublicationAllowed=true;},
    x=>{delete x.existing['skill.mining'];},
    x=>{x.held['world.hgw'].publish=true;},
    x=>{x.held['tab.shops'].semantic='GENERAL_SHOPS_CONFIRMED';},
    x=>{x.held['tab.daily'].permission='ALLOWED';},
    x=>{delete x.held['tab.daily'];},
    x=>{x.choices[0].state='APPROVED';},
    x=>{x.choices[1].rightsResolved=true;},
    x=>{x.choices[2].requires=[];},
    x=>{x.choices[3].assetChanges=false;},
    x=>{x.choices.push({...x.choices[0]});}
  ];
  for(const change of changes){
    const record=copy(publicationOptions);change(record);
    assert.throws(()=>verify(record));
  }
});
