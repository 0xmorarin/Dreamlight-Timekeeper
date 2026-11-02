import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {auditItemImageCoverage,recurringImageTargets,BASELINE} from '../src/item-image-coverage.mjs';

const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const registry=await json('data/events-v1253.json');
const manifest=await json('data/steam-icons-v1253.json');
const pinned=await json('data/item-image-coverage-v1253.json');

function fail(message){throw new Error('Item-image baseline: '+message);}
const observed=auditItemImageCoverage(registry,manifest);
if(pinned.schema!=='TIMEKEEPER_ITEM_IMAGE_BASELINE_AUDIT_V1'||pinned.source.eventRawSHA256!==BASELINE.eventSourceSha256)
 fail('wrong baseline evidence or version');
if(pinned.scope.recurringDistinctItemIDs!==observed.scope.recurringItemIdCount||
 pinned.scope.recurringEventDefinitions!==BASELINE.eventDefinitionCount||
 pinned.summary.publishedVerifiedItemImages!==observed.totals.verifiedPublished||
 pinned.summary.publishedMissingRecurringItemIDs!==observed.totals.missingPublished)
 fail('published image coverage changed without updating audit');
const targets=recurringImageTargets(registry,{strictBaseline:true});
if(pinned.items.length!==targets.items.length)fail('target inventory length');
const normalized=a=>JSON.stringify(a);
for(let i=0;i<targets.items.length;i++){
 const source=targets.items[i],record=pinned.items[i];
 if(record.itemId!==source.itemId||
  normalized(record.eventIds)!==normalized(source.eventIds)||
  normalized(record.enNames)!==normalized(source.enNames)||
  normalized(record.jaNames)!==normalized(source.jaNames)||
  record.references!==source.references)fail('misidentified EventID/ItemID source record at '+source.itemId);
 const published=observed.entries[i];
 if(record.publishedImage!== (published.state==='VERIFIED_PUBLISHED'?'VERIFIED':'MISSING'))
  fail('ItemID '+record.itemId+' has stale published-image state');
 if(record.publishedImage==='MISSING'&&
    (record.spritePathId!==null||record.texturePathId!==null))
  fail('false verified game Sprite/Texture reference in public audit');
}
if(new Set(pinned.items.map(x=>x.itemId)).size!==targets.items.length)fail('duplicate ItemIDs');
const tally=new Map();
for(const row of pinned.items)tally.set(row.sourceCrosswalk,(tally.get(row.sourceCrosswalk)||0)+1);
if(tally.get('SOURCE_LINKED_CANDIDATE_PRIVATE_SOURCE')!==pinned.summary.recurringStaticSourceLinkedCandidateIDs||
 tally.get('NO_STATIC_LINK_IN_SEVEN_CATEGORY_SOURCES')!==pinned.summary.recurringNotLinkedByThoseSourceBundles)
 fail('source reference research counts drift');
const privatePassed=pinned.items.filter(row=>row.rgbaVerifiedForThisItem==='PRIVATE_PROTO_VP8L_RGBA_MATCH_NOT_PUBLISHED');
const untested=pinned.items.filter(row=>row.rgbaVerifiedForThisItem==='NOT_ATTESTED_IN_PUBLIC_RELEASE_RECORD');
if(privatePassed.length!==138||untested.length!==106||
 pinned.summary.recurringPrivatePrototypeRgbaChecked!==138||
 pinned.summary.recurringPrivatePrototypeRgbaPassed!==138||
 pinned.summary.fullyDecodedItemImageVP8LInProduct!==0||
 privatePassed.some(row=>row.sourceCrosswalk!=='SOURCE_LINKED_CANDIDATE_PRIVATE_SOURCE')||
 untested.some(row=>row.sourceCrosswalk!=='NO_STATIC_LINK_IN_SEVEN_CATEGORY_SOURCES'))
 fail('unreviewed promotion of private pixel parity to public image');
if(pinned.policy.permissionState!=='NOT_ESTABLISHED'||pinned.policy.allowGameImagePublication!==false||
  pinned.policy.manifestUnmodified!==true||pinned.scope.additionalRealSaveItemIDs!=='UNKNOWN_NOT_ENUMERATED_ON_THIS_STATIC_BASELINE')
 fail('unreviewed copyright or dynamic-save capability upgrade');
console.log('P0 ItemID coverage baseline PASS: events='+BASELINE.eventDefinitionCount+
 ' distinctIDs='+targets.items.length+
 ' privateStaticCandidates='+pinned.summary.recurringStaticSourceLinkedCandidateIDs+
 ' notLinkedInSevenSources='+pinned.summary.recurringNotLinkedByThoseSourceBundles+
 ' publishedVerified='+observed.totals.verifiedPublished+
 ' publishedMissing='+observed.totals.missingPublished+
 ' dynamicSave=NOT_OBSERVED, permissions=NOT_ESTABLISHED');

// Source GUID evidence is metadata-only; no source Unity Bundle or game pixels
// are included in the repository or permitted for release by this check.
const audit=pinned.unresolvedDefinitionAudit;
const expectedStreams={
 'ActivityItem.json':'20e4f190fc4481325cb4311a4a3f3e6fc57d3f1ca7a67acffd9c9008394ba5d4',
 'Furniture.json':'823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674',
 'Companion.json':'26534a8ea7f94212ea6a7cc03818ecb632cca60d9789175a80eb1b5ba384abea'
};
const exceptionalGuid=new Map(Object.entries({
 30000072:'202f205f8ad0fd94daddf84fe6862586',
 31300003:'838a1cf8fac848d46b1f2b5843326baf',
 31300083:'eb3483344601e374480bce50a60de07c',
 31300128:'6a16e4ccb94256f4a8c808f189cb4c1f',
 31300210:'042b02d3a1339664f917f00df79d0bee',
 31400000:'c2d8a0bf85476b545b2a322f99c2bcff',
 31400039:'ff56d467e029f7643ba98059c63e2332',
 120200000:'fae01c1f6435960469d3a732e16efcee',
 120200001:'40b0d5635c0c38546bf2fabf5e89829b',
 120200002:'641b2b54dfaeb904390e69758d74dba6',
 120200003:'c19d982a7abc5814e98721cd7e32e672',
 120200004:'d50c69cb2009eba41bad38889fb84620',
 120200005:'3bf980814e35609418f98243615dfd21',
 120200006:'116140f426394314c86c635b281fac1b',
 120200007:'d14e8bb65a3e3424094f6b66f66046de',
 120200008:'03af512ae744ade48b5f3dd8c07e5503',
 120200009:'a74986a1cf3a28c488254a10f41c02b3',
 120200010:'d39cbee3b273b664d8c00f0ff8c45bc2',
 120200011:'b56521a8fa9904c419f856b5df830298',
 120200012:'0243ca5583384e846b11145c2243350a',
 120200013:'4e5d2c8f467f0d54dadd733797dbd5fa',
 120200016:'4e5d2c8f467f0d54dadd733797dbd5fa',
 120200022:'b458e8ee6d0368149abe6de8b65a47fc',
 120200023:'eb27800f72c6f354a9498434681d15f3',
 120200024:'15d2f864db647d84c90a737e06ec6c2b'
}).map(([id,guid])=>[Number(id),guid]));
const defaultGuid='04495f960b1edba4181ec51efa5e07d9';
if(audit?.evidence!=='FRAMED_ITEMLIST_PROTOBUF_THREE_SOURCE_DIRECT_READ_ONLY'||
  JSON.stringify(audit.sourceHashes)!==JSON.stringify(expectedStreams)||
  audit.unlinkedTotal!==106||audit.typedSourceRecordsConfirmed!==106||
  audit.activityItemRecords!==35||audit.furnitureRecords!==52||audit.companionRecords!==19||
  audit.sourceRecordsNotFoundInTheseTwoStreams!==0||
  audit.commonGuid!==defaultGuid||audit.commonGuidCountInGaps!==81||
  audit.otherGuidCountInGaps!==25||audit.commonGuidOccurrencesInCompleteThreeStreams!==1798||
  audit.distinctSourceIconAddressGuidsInGaps!==25||
  audit.sourceGuidOnly!==true||audit.spriteTextureProof!==25||
  audit.privatePrototypeRgbaMatched!==25||audit.privatePrototypeWebpBytes!==1719548||
  audit.privateCompanionPixelRecords!==18||audit.privateCompanionDistinctSprites!==17||
  JSON.stringify(audit.privateCompanionDuplicatedSourceSpriteItemIDs)!==JSON.stringify([120200013,120200016])||
  audit.privateCompanionWebpBytes!==617802||
  audit.privateCompanionEvidenceJsonSha256!=='25c73f727a4a0e248aeeba25f6134034177413229ef89da86f89c9a9aea63667'||
  audit.catalogPlaceholderItemIDs!==81||
  audit.additionalFourEvidenceSha256!=='7b10a20060e25bcc38821b86dfba38f55a7840d1954f53cf187a3a37dd10a710'||
  audit.remainingUnverifiedSpriteTexture!==81||audit.privatePixelsNotPublished!==true||
  audit.privatePixelEvidenceJsonSha256!=='59e2e920570f83812210f4eebcf2013935322ed21dcf43dae4c8eaba48b5c0b8'||
  audit.publicImageProof!==0||audit.rights!=='NOT_ESTABLISHED')
 fail('unreviewed 106-gap source definition evidence promotion or count drift');
const deficit=pinned.items.filter(row=>row.sourceCrosswalk==='NO_STATIC_LINK_IN_SEVEN_CATEGORY_SOURCES');
let activity=0,furniture=0,companion=0,shared=0,specific=0;
const reviewedProto=new Map([
 [30000072,['202f205f8ad0fd94daddf84fe6862586','acb7b4da1b360e37a9dc7b1b0781199d64c5269a37524335c68f4050e89161b7','17931729342756677081','18223675087384405465','625c099f45597453abc802a65f85d24d849e9c22d4ab5aee6b6cea6faed15f47','de221ff74dd28451ef580aad2da3f11bbbd10759ce81658d28012c212f0b662c',42492]],
 [31400000,['c2d8a0bf85476b545b2a322f99c2bcff','15056b25a79bf546131625d3dc87c50bbb56b153dee5e1af5f2d7a40d5718cc9','12235514117036361459','3735864404189103859','4cc6cc0b77b017a41c0ecec80db924fe915225b00d9df17fd895edab9662b529','8b0cfba58f29ea9b4d489c36e0293591a0aaa51fd0f6537a80e19b57f98f6266',396534]],
 [31400039,['ff56d467e029f7643ba98059c63e2332','15056b25a79bf546131625d3dc87c50bbb56b153dee5e1af5f2d7a40d5718cc9','5390452463298091721','8430391546967694025','7401fca7a415ba7736324c3d101e3f1ff100b61ef53c9878f864d4e13f5afc6e','93a1399ba7f0fb2db3ca72684f4d8a9308d9edac2035eef56e6f8a66a61388be',387988]],
 [31300003,['838a1cf8fac848d46b1f2b5843326baf','a30f6f48634f9fbf11123528054c14ca5bdc7b0392fd546988bdc38d603a24fa','14966761252799059766','11691139849580189494','a772a2a79332d347333eaffd354f55931837682fe0db9a579776b4390835136f','9113fb9e1f836daf51ccdaf9a46ddae16ea9de82a546048a31ca65fc87aea209',89876]],
 [31300083,['eb3483344601e374480bce50a60de07c','a30f6f48634f9fbf11123528054c14ca5bdc7b0392fd546988bdc38d603a24fa','4121661351448327022','15645414128663311214','53cd9e456b7db39e12ea207966831fa08779087eb93eebbf1caa391b65e05815','7c71d09f30a4f20cf09006b0b0283c495f64237818f31db60622959aa589021f',98158]],
 [31300128,['6a16e4ccb94256f4a8c808f189cb4c1f','a30f6f48634f9fbf11123528054c14ca5bdc7b0392fd546988bdc38d603a24fa','13521612063694381670','9812015709117080166','6a04e61ef03fa9b6d0fb99b57e571eee5e22f23961bec0cc5170ec82a4acdad4','9ca5e8a0e19ecb8ebe5a22aaaa3aa8030ee2c794be00fb62239a507cf9191692',50486]],
 [31300210,['042b02d3a1339664f917f00df79d0bee','a30f6f48634f9fbf11123528054c14ca5bdc7b0392fd546988bdc38d603a24fa','5506874613869679538','16880184784457667506','0faa2fa8246a473c39c1f78c70d87f9831a5c51fa689ec7d49a30d0e3f820e71','a3cf3763cb2e958adf30df6b2ec4ccdea2d50a08f88e9ebd0aee33dfed355c8f',36212]]
]);
for(const row of deficit){
 const x=row.definitionAudit,expected=reviewedProto.get(row.itemId);
 if(!x||row.publishedImage!=='MISSING')fail('false published image '+row.itemId);
 const companionTarget=row.itemId>=120200000&&row.itemId<=120200024&&x.sourceStream==='Companion.json'&&
    x.declaredIconAddressGuid!==defaultGuid;
 const hasProof=!!expected||companionTarget;
 if(x.spriteResolved!==hasProof||x.textureResolved!==hasProof||
    x.webpDecodedRgbaMatched!==hasProof)fail('false pixel proof status '+row.itemId);
 if(expected){
   const v=x.privatePixelProof;
   if(!v||v.status!=='PRIVATE_SOURCE_VP8L_RGBA_EQUAL_NOT_RELEASED'||
     v.encoder!=='Pillow/libwebp lossless=true method=6 exact=true'||
     v.bundleSha256!==expected[1]||v.spritePathId!==expected[2]||
     v.texturePathId!==expected[3]||v.decodedRgbaSha256!==expected[4]||
     v.prototypeWebpSha256!==expected[5]||v.prototypeWebpBytes!==expected[6]||
     x.declaredIconAddressGuid!==expected[0])
     fail('private per-item VP8L proof drift '+row.itemId);
 } else if(companionTarget){
   const v=x.privatePixelProof;
   if(!v||v.sourceBundle!=='craftingmaterial_a01be543.bundle'||
      v.bundleSha256!=='85255ade497a5fcf9945d569624286d518c7d07d874f32b84ad612173436137c'||
      v.unityCab!=='CAB-dc96f4e2a160bea829b0dccdd5e870ad'||
      !/^[1-9][0-9]*$/.test(v.spritePathId)||!/^[1-9][0-9]*$/.test(v.texturePathId)||
      !/^[0-9a-f]{64}$/.test(v.decodedRgbaSha256)||
      !/^[0-9a-f]{64}$/.test(v.prototypeWebpSha256)||
      v.width!==256||v.height!==256||v.compression!=='BC7'||
      !(v.prototypeWebpBytes>=19000&&v.prototypeWebpBytes<=46000)||
      v.encoder!=='Pillow/libwebp lossless=true method=6 exact=true'||
      v.status!=='PRIVATE_SOURCE_VP8L_RGBA_EQUAL_NOT_RELEASED')
      fail('unreviewed private Companion image '+row.itemId);
 } else if('privatePixelProof' in x)fail('unsupported pixel claim '+row.itemId);
 const stream=row.itemId>=120000000?'Companion.json':
   row.itemId>=40000000?'Furniture.json':'ActivityItem.json';
 if(stream==='Companion.json')companion++;
 else if(stream==='Furniture.json')furniture++;
 else activity++;
 const guid=exceptionalGuid.get(row.itemId)||defaultGuid;
 if(guid===defaultGuid)shared++;else specific++;
 if(x.sourceStream!==stream||x.sourceSha256!==expectedStreams[stream]||
    x.declaredIconAddressGuid!==guid||
    x.status!==(guid===defaultGuid?'SHARED_ICON_ADDRESS_NOT_ITEM_SPECIFIC':
       companionTarget?'DECLARED_ICON_ADDRESS_RESOLVED_PRIVATE_SOURCE':'DECLARED_ICON_ADDRESS_UNRESOLVED'))
   fail('mismatched per-item original IconAddress provenance '+row.itemId);
}
if(deficit.length!==106||activity!==35||furniture!==52||companion!==19||
   shared!==81||specific!==25||exceptionalGuid.size!==25)
 fail('ItemID gap source family census changed');

const readOnly=pinned.readOnlyResolutionContract;
if(readOnly?.schema!=='timekeeper.item-image-resolution.v1'||
 JSON.stringify(readOnly.allowedStatuses)!==JSON.stringify(['VERIFIED','MISSING','AMBIGUOUS'])||
 readOnly.recurringTotal!==244||readOnly.verifiedPublished!==0||
 readOnly.ambiguousWithoutUrl!==81||readOnly.missingWithoutUrl!==163||
 readOnly.privatePixelProofsNotPublished!==25||readOnly.unverifiedSourceSpriteTargets!==81||
 readOnly.unapprovedMediaPublishable!==false||
 readOnly.additionalRealSaveVisibleItemIDs!=='UNKNOWN_SESSION_NOT_PROVIDED')
 fail('read-only status and release permission drift');

const catalog=pinned.addressablesCatalogAudit;
if(catalog?.platform!=='Steam/Windows'||catalog.gameVersion!=='1.25.3'||
 catalog.buildResultHash!=='45e494c1968542bb73ff51e4e727271e'||
 catalog.catalogJsonSha256!=='69351845e0b99db577ff70af2512de780f815d561027ceccab9f8ff19d081c562'||
 catalog.entryDataSha256!=='807fd38db08a107dada03cc207a1eecc5c41bc157b060091377fefce577d1619'||
 catalog.keyDataSha256!=='cef9d3431ca327b560ed30e045a908615c31d7628c3d8c83acd85c69b8aded1a'||
 catalog.bucketDataSha256!=='c8a4b215b07988e988b34085f77e4d616ca7f5b0cc13bee13763e36c0ebdf4e6'||
 catalog.internalIdsSha256!=='1822422bcf53e31b2b5653d28b36059bf591ec163a5721a8eecd630e4f8ec5ad'||
 catalog.catalogItemIDs!==106||catalog.distinctGUIDs!==25||
 JSON.stringify(catalog.componentBundles)!==JSON.stringify({default:1,ephemeral:4,lootpresent:2,craftingmaterial:18,sharedPlaceholders:81})||
 catalog.status!=='EXACT_CATALOG_DEPENDENCY_ONLY_NOT_RENDERED_ITEM_VARIATION_PROOF')
 fail('v1.25.3 Addressables source/catalog provenance drift');
const privateCompanionRows=deficit.filter(row=>row.definitionAudit.sourceStream==='Companion.json'&&row.definitionAudit.webpDecodedRgbaMatched===true);
const uniqueCompanionSource=new Set(privateCompanionRows.map(row=>row.definitionAudit.privatePixelProof.spritePathId));
const uniqueCompanionTextures=new Set(privateCompanionRows.map(row=>row.definitionAudit.privatePixelProof.texturePathId));
if(privateCompanionRows.length!==18||uniqueCompanionSource.size!==17||uniqueCompanionTextures.size!==17||
 privateCompanionRows.reduce((n,row)=>n+row.definitionAudit.privatePixelProof.prototypeWebpBytes,0)!==617802)
 fail('Companion Sprite alias or VP8L source pixel inventory mismatch');
const sharedAlias=privateCompanionRows.filter(row=>row.itemId===120200013||row.itemId===120200016);
if(sharedAlias.length!==2||sharedAlias[0].definitionAudit.privatePixelProof.spritePathId!==sharedAlias[1].definitionAudit.privatePixelProof.spritePathId||
  sharedAlias[0].definitionAudit.privatePixelProof.decodedRgbaSha256!==sharedAlias[1].definitionAudit.privatePixelProof.decodedRgbaSha256)
 fail('unverified two-ItemID source Sprite alias');

let ambiguous=0,missing=0;
for(const row of pinned.items){
 const r=row.readOnlyImageResolution;
 const generic=row.definitionAudit?.declaredIconAddressGuid===defaultGuid;
 if(generic&&(
   row.definitionAudit?.catalogDependency?.state!=='CATALOG_SHARED_PLACEHOLDER_NO_ITEM_SPECIFIC_IMAGE'||
   row.definitionAudit?.catalogDependency?.primaryBundle!=='usedplaceholders_assets_all.bundle'||
   row.definitionAudit?.catalogDependency?.spriteResolved!==false))
   fail('generic IconAddress must remain placeholder only '+row.itemId);
 const companionAlias=false; // Exact original CAB binds both to the same verified Sprite/Texture.
 const reason=generic?'SHARED_CATALOG_PLACEHOLDER_81_ITEMIDS':
  companionAlias?'TWO_ITEMIDS_SHARE_UNVERIFIED_COMPANION_ICON_ADDRESS':'NO_APPROVED_PACKAGED_ITEM_IMAGE';
 const state=(generic||companionAlias)?'AMBIGUOUS':'MISSING';
 if(r?.status!==state||r.reason!==reason||r.url!==null)fail('unreviewed read-only ItemID mapping '+row.itemId);
 if(state==='AMBIGUOUS')ambiguous++;else missing++;
}
if(ambiguous!==81||missing!==163)fail('image resolution status counts drift');

console.log('Gap typed source PASS: 106/106 ItemID definitions (Activity35/Furniture52/Companion19), 81 common GUID; private Sprite/Texture 25, shared placeholder 81, published WebP 0');
