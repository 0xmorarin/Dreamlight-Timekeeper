// 03 WEB: read-only text view over ASSET-owned, SOURCE-ONLY ItemID categories.
// No ItemID/Name/Prefab->image URL inference, no original-save or Worker access.
export const WEB_TEXT_ITEM_CONTRACT='timekeeper.web-text-item.v1';
const SHA='028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea';
const ASSET_BLOB='9d8941c6c28d6d12b0a1bcd82422bd32792e1ff5';
const LABELS=Object.freeze({
 'ActivityItem.json':Object.freeze({en:'Activity item',ja:'アクティビティ項目'}),
 'Furniture.json':Object.freeze({en:'Furniture / world object',ja:'家具・配置物'}),
 'Companion.json':Object.freeze({en:'Companion',ja:'コンパニオン'})
});
const UNKNOWN=Object.freeze({en:'Unclassified item',ja:'種類未確認'});
const NO_IMAGE=Object.freeze({en:'Image unavailable',ja:'画像未提供'});
const caches=new WeakMap();
const validId=id=>Number.isSafeInteger(id)&&id>0;
const plainText=x=>typeof x==='string'?x
 .replace(/<[^>]*>/g,'')
 .replace(/[\u200b-\u200d\u2060\u202a-\u202e\u2066-\u2069]/g,'')
 .replace(/\s+/g,' ').trim().slice(0,160):'';
/** A type witness is not permission to serve any game image. No save row data
 * is retained in this index; a new local File does not need to mutate it. */
export function checkedTextItemTypes(audit){
 if(!audit||typeof audit!=='object'||audit.schema!=='TIMEKEEPER_WEB_TEXT_SOURCE_TYPE_V1'||
    audit.status!=='STATIC_SOURCE_ONLY'||audit.assetSource?.pr!==23||
    audit.assetSource?.blobSha!==ASSET_BLOB||
    audit.assetSource?.eventRegistrySha256!==SHA||
    audit.assetSource?.sourceCategoryOnly!==true||
    audit.policy?.imageUrlAuthority!==false||
    audit.policy?.workerSessionAuthority!==false||
    audit.policy?.writerAuthority!==false||
    audit.policy?.mediaRedistributionPermission!=='NOT_ESTABLISHED'||
    !Array.isArray(audit.items)||audit.items.length!==244||
    audit.counts?.total!==244||audit.counts?.ActivityItem!==173||
    audit.counts?.Furniture!==52||audit.counts?.Companion!==19)
  throw Error('UNVERIFIED_ITEM_SOURCE_TYPE_AUDIT');
 let map=caches.get(audit);
 if(map)return map;
 map=new Map();const counters={'ActivityItem.json':0,'Furniture.json':0,'Companion.json':0};
 let prev=0;
 for(const row of audit.items){
  if(!Array.isArray(row)||row.length!==2||!validId(row[0])||
     row[0]<=prev||!Object.hasOwn(counters,row[1]))
   throw Error('UNVERIFIED_ITEM_SOURCE_TYPE_ROW');
  map.set(row[0],row[1]);prev=row[0];counters[row[1]]++;
 }
 if(counters['ActivityItem.json']!==173||counters['Furniture.json']!==52||
    counters['Companion.json']!==19)
  throw Error('UNVERIFIED_ITEM_SOURCE_TYPE_COUNTS');
 caches.set(audit,map);
 return map;
}
/** Svelte uses its native escaped text expressions; never render this as HTML. */
export function rcTextOnlyItem(item,localeCode,audit){
 const map=checkedTextItemTypes(audit);
 const language=localeCode==='ja'||localeCode==='ja-JP'?'ja':'en';
 const id=validId(item?.id)?item.id:null;
 const stream=id===null?null:(map.get(id)??null);
 const category=stream===null?UNKNOWN:LABELS[stream];
 const itemIdText=id===null?'ItemID unknown':'ItemID '+id;
 const categoryText=category[language];
 const imageStatus=NO_IMAGE[language];
 const displayLine=itemIdText+' · '+categoryText+' · '+imageStatus;
 return Object.freeze({
  contract:WEB_TEXT_ITEM_CONTRACT,
  itemId:id,itemIdText,sourceCategory:stream===null?'UNCLASSIFIED':stream,
  sourceTypeVerified:stream!==null,displayLine,imageStatus,
  // An image fallback is always visible, even if ASSET later supplies a URL.
  displayTextFirst:true,mediaUrl:null,mediaRightsGranted:false,
  ariaLabel:displayLine,
  name:plainText(item?.names?.[language==='ja'?'ja-JP':'en-US']??item?.name)||
    (language==='ja'?'項目':'Item')+(id===null?'':' '+id)
 });
}
