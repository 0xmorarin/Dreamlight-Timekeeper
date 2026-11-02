import {resolveIconAsset,validateIconManifest} from './icon-assets.mjs';

export const ITEM_IMAGE_CONTRACT = 'timekeeper.item-image-coverage.v1';
export const BASELINE = Object.freeze({
  gameVersion:'1.25.3',
  saveSchema:626,
  buildId:'9A239D3DB569756D',
  eventDefinitionCount:508,
  recurringItemIdCount:244,
  eventSourceSha256:'028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea'
});
const validId=x=>Number.isSafeInteger(x)&&x>0;
const sortedIds=ids=>[...ids].sort((a,b)=>a-b);
const uniqueSorted=items=>[...new Set(items)].sort();
const safeName=value=>typeof value==='string'?value.trim():'';

/**
 * Event definition IDs and source references are never interchangeable with
 * ItemID. A repeated ItemID across multiple events is one thumbnail target,
 * not a collision; its source event list is retained for audit.
 */
export function recurringImageTargets(registry,{strictBaseline=false}={}){
  if(registry?.source?.version!==BASELINE.gameVersion ||
      registry.source.rawEventSHA256!==BASELINE.eventSourceSha256 ||
      !Array.isArray(registry.events))
    throw new Error('Untrusted event registry for ItemID image coverage.');
  const items=new Map(),eventIds=new Set(),invalid=[];
  for(const [index,event] of registry.events.entries()){
    if(!Number.isSafeInteger(event?.id)||eventIds.has(event.id))
      throw new Error('Duplicate or invalid RecurringEvent definition ID.');
    eventIds.add(event.id);
    if(!Array.isArray(event.items))throw new Error('Event has no items array.');
    for(const [position,item] of event.items.entries()){
      if(!validId(item?.id)){invalid.push({eventId:event.id,index,position});continue;}
      let target=items.get(item.id);
      if(!target){target={itemId:item.id,eventIds:[],enNames:new Set(),jaNames:new Set(),references:0};items.set(item.id,target);}
      if(!target.eventIds.includes(event.id))target.eventIds.push(event.id);
      if(safeName(item.en))target.enNames.add(safeName(item.en));
      if(safeName(item.ja))target.jaNames.add(safeName(item.ja));
      target.references++;
    }
  }
  if(strictBaseline&&(eventIds.size!==BASELINE.eventDefinitionCount||items.size!==BASELINE.recurringItemIdCount||invalid.length))
    throw new Error('508/244 v1.25.3 ItemID baseline drift: source review required.');
  return {
    eventDefinitionCount:eventIds.size,
    itemIdCount:items.size,
    invalidReferences:invalid,
    items:sortedIds(items.keys()).map(id=>{
      const entry=items.get(id);
      return {itemId:id,eventIds:sortedIds(entry.eventIds),references:entry.references,
        enNames:uniqueSorted(entry.enNames),jaNames:uniqueSorted(entry.jaNames)};
    })
  };
}

/** Snapshot rows may originate from private saves. Use ephemeral in-memory IDs
 * only: do not serialize/save/upload the snapshot or user-specific pointers.
 * A row's 'id' is NOT an ItemID for recurring event rows (it is an EventID).
 * Grid/Store rows may visibly label row.id as an ItemID even if row.items is
 * empty due to missing localization data.
 */
export function snapshotVisibleItemIds(snapshot){
  if(snapshot==null)return {ids:[],rowCount:null,source:'NOT_PROVIDED'};
  if(!Array.isArray(snapshot.rows))throw new Error('Snapshot has no rows array.');
  const ids=new Set();
  for(const row of snapshot.rows){
    for(const item of Array.isArray(row?.items)?row.items:[])
      if(validId(item?.id))ids.add(item.id);
    if((row?.source==='World.GridCollection'||row?.source==='World.Stores')&&validId(row.id))
      ids.add(row.id);
  }
  return {ids:sortedIds(ids),rowCount:snapshot.rows.length,source:'SESSION_EPHEMERAL'};
}

export function auditItemImageCoverage(registry,manifest,{snapshot=null,strictBaseline=true}={}){
  const baseline=recurringImageTargets(registry,{strictBaseline});
  validateIconManifest(manifest);
  const observed=snapshotVisibleItemIds(snapshot);
  const targets=new Set(baseline.items.map(x=>x.itemId));
  const dynamic=observed.ids.filter(id=>!targets.has(id));
  for(const id of observed.ids)targets.add(id);
  const owners=new Map(),byId=new Map(baseline.items.map(x=>[x.itemId,x]));
  const entries=[];
  let verified=0;
  for(const itemId of sortedIds(targets)){
    const mapped=resolveIconAsset(manifest,itemId);
    const state=mapped?'VERIFIED_PUBLISHED':'MISSING_PUBLISHED_IMAGE';
    if(mapped){
      verified++;
      const key=mapped.path;
      if(owners.has(key))throw new Error('Same public path assigned to distinct ItemIDs.');
      owners.set(key,itemId);
    }
    entries.push({itemId,origin:byId.has(itemId)?'RECURRING_EVENT_DEFINITION':'SAVE_DERIVED_VISIBLE_ROW',
      eventIds:byId.get(itemId)?.eventIds||[],
      state,path:mapped?.path||null,webpSha256:mapped?.sha256||null,
      sourceAsset:mapped?.sourceAsset||null});
  }
  return {
    contract:ITEM_IMAGE_CONTRACT,source:{...BASELINE,manifestStatus:manifest.source.status},
    scope:{recurringItemIdCount:baseline.itemIdCount,
      dynamicVisibleItemIdCount:dynamic.length,dynamicScopeObserved:observed.source==='SESSION_EPHEMERAL',
      distinctDisplayedItemIdCount:entries.length,snapshotRows:observed.rowCount},
    totals:{verifiedPublished:verified,missingPublished:entries.length-verified,
      pathCollisions:0,invalidRecurringReferences:baseline.invalidReferences.length},
    dynamicAdditionalItemIds:dynamic,entries
  };
}

/** Non-UI data contract for 03 WEB's SvelteKit migration. The URL is relative
 * to the app's own static root; do not use item names or guessed image paths. */
export function resolveItemImageView(manifest,item,{basePath='./',coverageAudit=null}={}){
  const itemId=item?.id;
  const mapped=resolveIconAsset(manifest,itemId);
  const en=safeName(item?.en)||safeName(item?.name)||'Item '+String(itemId??'unknown');
  const ja=safeName(item?.ja);
  if(!mapped){
    // Research-side ambiguity can suppress misleading thumbnails, never grant one.
    // Neither a declared IconAddress GUID nor private-pixel proof supplies a URL.
    const trustedBaseline=coverageAudit?.schema==='TIMEKEEPER_ITEM_IMAGE_BASELINE_AUDIT_V1'&&
      coverageAudit?.source?.eventRawSHA256===BASELINE.eventSourceSha256&&
      coverageAudit?.readOnlyResolutionContract?.schema==='timekeeper.item-image-resolution.v1'&&
      Array.isArray(coverageAudit.items)&&coverageAudit.items.length===BASELINE.recurringItemIdCount;
    const sourceRow=trustedBaseline?
      coverageAudit.items.find(x=>x.itemId===itemId):null;
    const ambiguous=sourceRow?.readOnlyImageResolution?.status==='AMBIGUOUS'&&
      sourceRow.readOnlyImageResolution.url===null;
    return {itemId:validId(itemId)?itemId:null,
      status:ambiguous?'AMBIGUOUS':'MISSING',
      url:null,alt:{en,ja:ja||en},fallback:'text',lazy:true};
  }
  if(typeof basePath!=='string'||basePath.includes('..')||basePath.startsWith('//'))
    throw new Error('Invalid static image URL base.');
  return {itemId,status:'VERIFIED',url:basePath+mapped.path,
    alt:{en,ja:ja||en},fallback:'text',lazy:true,
    width:mapped.width,height:mapped.height,webpSha256:mapped.sha256};
}


/**
 * 03 WEB / November RC: accessible, explicitly text-first ItemID row.
 * Only the already approved static image manifest may authorize a thumbnail;
 * private source hashes, the generic placeholder, and field5 world Prefabs
 * are NEVER item image URLs. This view authorizes no release or Writer.
 * Render output with textContent / Svelte text expressions, NEVER {@html}.
 */
export const RC_ITEM_TEXT_CONTRACT='timekeeper.rc-item-text-fallback.v1';
const sourceCategories=Object.freeze({
  'ActivityItem.json':Object.freeze({code:'ACTIVITY_ITEM',en:'Activity item',ja:'アクティビティ項目'}),
  'Furniture.json':Object.freeze({code:'FURNITURE_SOURCE',en:'Furniture / world object',ja:'家具・配置物'}),
  'Companion.json':Object.freeze({code:'COMPANION',en:'Companion',ja:'コンパニオン'})
});
const unclassifiedCategory=Object.freeze({code:'UNCLASSIFIED',en:'Unclassified item',ja:'種類未確認'});
const originalTypeHashes=Object.freeze({
  'ActivityItem.json':'20e4f190fc4481325cb4311a4a3f3e6fc57d3f1ca7a67acffd9c9008394ba5d4',
  'Furniture.json':'823316081efe513c3920ff5a870fae03b68fa5f6ff6be2de5c5eb87aaa674',
  'Companion.json':'26534a8ea7f94212ea6a7cc03818ecb632cca60d9789175a80eb1b5ba384abea'
});
const textSafe=value=>safeName(value)
  .replace(/<[^>]*>/g,'')
  .replace(/[\u200b\u200c\u200d\u2060\u202a-\u202e\u2066-\u2069]/g,'')
  .replace(/\s+/g,' ')
  .trim();
const trustworthyAudit=a=>a?.schema==='TIMEKEEPER_ITEM_IMAGE_BASELINE_AUDIT_V1'&&
  a.source?.eventRawSHA256===BASELINE.eventSourceSha256&&
  a.scope?.recurringDistinctItemIDs===BASELINE.recurringItemIdCount&&
  a.readOnlyResolutionContract?.schema==='timekeeper.item-image-resolution.v1'&&
  Array.isArray(a.items)&&a.items.length===BASELINE.recurringItemIdCount;

/**
 * Required UI fields: visible ItemID, localized plain text name, honest
 * evidence-qualified source category, and an accessible no-image message.
 * Unsupported dynamic save rows are UNCLASSIFIED, not silently categorized
 * by ItemID digits, names, or EventID. No save paths are retained.
 */
export function resolveRcItemTextRow(manifest,item,{locale='ja',basePath='./',coverageAudit=null}={}){
  if(!['ja','en','ja-JP','en-US'].includes(locale))throw new Error('Unsupported RC text locale.');
  const language=locale.startsWith('ja')?'ja':'en';
  const itemId=validId(item?.id)?item.id:null;
  const pinned=trustworthyAudit(coverageAudit)&&itemId!==null?
    coverageAudit.items.find(row=>row.itemId===itemId):null;
  const enName=textSafe(pinned?.enNames?.[0])||textSafe(item?.en)||textSafe(item?.name)||
    (itemId===null?'Unknown item':'Item '+itemId);
  const jaName=textSafe(pinned?.jaNames?.[0])||textSafe(item?.ja)||enName;
  const name=language==='ja'?jaName:enName;
  const sourceWitness=pinned?.itemSourceType;
  const sourceCategory=sourceWitness?.status==='ORIGINAL_V1253_ITEMDB_FIELD1_VERIFIED'&&
    sourceWitness.itemIdField===1&&
    sourceWitness.sourceSha256===originalTypeHashes[sourceWitness.sourceStream]&&
    sourceWitness.itemSourceCategoryOnly===true&&sourceWitness.notImageProof===true?
      sourceWitness.sourceStream:null;
  const typed=sourceCategory?sourceCategories[sourceCategory]:null;
  const category=typed||unclassifiedCategory;
  const image=resolveItemImageView(manifest,{id:itemId,en:enName,ja:jaName},
    {basePath,coverageAudit});
  const hasImage=image.status==='VERIFIED'&&typeof image.url==='string';
  const idText=itemId===null?'unknown':String(itemId);
  const idLabel='ItemID '+idText;
  const categoryLabel=category[language];
  const imageStatusText=hasImage?(language==='ja'?'検証済み画像':'Verified image'):
    image.status==='AMBIGUOUS'?(language==='ja'?'画像の対応未確定':'Image mapping uncertain'):
      (language==='ja'?'画像未提供':'Image unavailable');
  const ariaLabel=language==='ja'?
    name+'。カテゴリ: '+categoryLabel+'。'+idLabel+'。'+imageStatusText+'。':
    name+'. Category: '+categoryLabel+'. '+idLabel+'. '+imageStatusText+'.';
  return {
    contract:RC_ITEM_TEXT_CONTRACT,
    itemId,locale:language,name,enName,jaName,
    idLabel,category:{code:category.code,label:categoryLabel,
      source:typed?'ORIGINAL_ITEMDB_STREAM':'NOT_VERIFIED',verified:!!typed},
    image:{status:image.status,url:hasImage?image.url:null,
      alt:name,loading:'lazy',width:hasImage?image.width:null,
      height:hasImage?image.height:null},
    textFallback:{required:true,visibleByDefault:!hasImage,onImageErrorMustShow:true,
      visibleName:name,visibleItemId:idLabel,
      visibleCategory:categoryLabel,visibleStatus:imageStatusText,
      ariaLabel,renderAsPlainText:true},
    evidence:{itemIdSource:pinned?'V1253_RECURRING_REGISTRY':'UNCLASSIFIED_DYNAMIC_OR_UNKNOWN',
      privatePixelDoesNotGrantImage:true,worldObjectPrefabDoesNotGrantImage:true,
      mediaRedistributionPermission:'NOT_ESTABLISHED'},
    rcTextDisplaySupported:true,
    fullItemImageReleaseAccepted:false
  };
}
