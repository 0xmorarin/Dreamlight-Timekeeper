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

// Original v1.25.3 itemlist files were inspected off-repository; this derived
// metadata verifies definition identity only, never an actual Sprite or WebP.
const audit=pinned.unresolvedDefinitionAudit;
const expectedStreams={
 'ActivityItem.json':'20e4f190fc4481325cb4311a4a3f3e6fc57d3f1ca7a67acffd9c9008394ba5d4',
 'Furniture.json':'823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de0de5c5eb87aaa674'
};
const exceptionalGuid=new Map(Object.entries({
 30000072:'202f205f8ad0fd94daddf84fe6862586',
 31300003:'838a1cf8fac848d46b1f2b5843326baf',
 31300083:'eb3483344601e374480bce50a60de07c',
 31300128:'6a16e4ccb94256f4a8c808f189cb4c1f',
 31300210:'042b02d3a1339664f917f00df79d0bee',
 31400000:'c2d8a0bf85476b545b2a322f99c2bcff',
 31400039:'ff56d467e029f7643ba98059c63e2332'
}).map(([id,guid])=>[Number(id),guid]));
const defaultGuid='04495f960b1edba4181ec51efa5e07d9';
if(audit?.evidence!=='FRAMED_ITEMLIST_PROTOBUF_DIRECT_SOURCE_READ_ONLY'||
  JSON.stringify(audit.sourceHashes)!==JSON.stringify(expectedStreams)||
  audit.unlinkedTotal!==106||audit.typedSourceRecordsConfirmed!==87||
  audit.activityItemRecords!==35||audit.furnitureRecords!==52||
  audit.sourceRecordsNotFoundInTheseTwoStreams!==19||
  audit.commonGuid!==defaultGuid||audit.commonGuidCountInGaps!==80||
  audit.otherGuidCountInGaps!==7||audit.commonGuidOccurrencesInCompleteTwoStreams!==1794||
  audit.sourceGuidOnly!==true||audit.spriteTextureProof!==0||
  audit.publicImageProof!==0||audit.rights!=='NOT_ESTABLISHED')
 fail('unreviewed 106-gap source definition evidence promotion or count drift');
const deficit=pinned.items.filter(row=>row.sourceCrosswalk==='NO_STATIC_LINK_IN_SEVEN_CATEGORY_SOURCES');
let activity=0,furniture=0,snippets=0,shared=0,specific=0;
for(const row of deficit){
 const x=row.definitionAudit;
 if(!x||x.spriteResolved!==false||x.textureResolved!==false||
    x.webpDecodedRgbaMatched!==false||row.publishedImage!=='MISSING')fail('false image proof '+row.itemId);
 if(row.itemId>=120000000){
   snippets++;
   if(x.status!=='TYPED_SOURCE_NOT_FOUND_IN_TWO_ITEMLIST_STREAMS'||
      x.sourceStream!==null||x.sourceSha256!==null||x.declaredIconAddressGuid!==null)
     fail('false snippet source '+row.itemId);
 }else{
   const stream=row.itemId>=40000000?'Furniture.json':'ActivityItem.json';
   if(stream==='Furniture.json')furniture++;else activity++;
   const guid=exceptionalGuid.get(row.itemId)||defaultGuid;
   if(guid===defaultGuid)shared++;else specific++;
   if(x.sourceStream!==stream||x.sourceSha256!==expectedStreams[stream]||
      x.declaredIconAddressGuid!==guid||
      x.status!==(guid===defaultGuid?'SHARED_ICON_ADDRESS_NOT_ITEM_SPECIFIC':'DECLARED_ICON_ADDRESS_UNRESOLVED'))
     fail('mismatched per-item original IconAddress provenance '+row.itemId);
 }
}
if(deficit.length!==106||activity!==35||furniture!==52||snippets!==19||
   shared!==80||specific!==7||exceptionalGuid.size!==7)
 fail('ItemID gap source family census changed');
console.log('Gap definition source audit PASS: ActivityItem 35, Furniture 52, untyped Snippet 19; shared IconAddress 80, distinct GUID 7; resolved Sprite/Texture 0');
