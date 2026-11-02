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
