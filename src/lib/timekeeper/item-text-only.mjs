// 03 WEB: read-only text view over ASSET-owned, SOURCE-ONLY ItemID categories.
// No ItemID/Name/Prefab->image URL inference, no original-save or Worker access.
export const WEB_TEXT_ITEM_CONTRACT='timekeeper.web-text-item.v1';
const SHA='028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea';
const ASSET_BLOB='9d8941c6c28d6d12b0a1bcd82422bd32792e1ff5';
// Source types are verified against the pinned ASSET byte evidence; localized
// descriptions are *presentation only*, never a new type or media authority.
const TEXT_BY_LOCALE=Object.freeze({
 en:{activity:'Activity item',furniture:'Furniture / world object',companion:'Companion',unknown:'Unclassified item',image:'Image unavailable',list:'Linked ItemIDs'},
 fr:{activity:'Objet d’activité',furniture:'Meuble / objet du monde',companion:'Compagnon',unknown:'Objet non classé',image:'Image indisponible',list:'ItemID associés'},
 it:{activity:'Oggetto attività',furniture:'Arredo / oggetto del mondo',companion:'Compagno',unknown:'Oggetto non classificato',image:'Immagine non disponibile',list:'ItemID collegati'},
 de:{activity:'Aktivitätsgegenstand',furniture:'Möbel / Weltobjekt',companion:'Begleiter',unknown:'Nicht klassifizierter Gegenstand',image:'Bild nicht verfügbar',list:'Verknüpfte ItemIDs'},
 'es-ES':{activity:'Objeto de actividad',furniture:'Mueble / objeto del mundo',companion:'Compañero',unknown:'Objeto sin clasificar',image:'Imagen no disponible',list:'ItemID vinculados'},
 ja:{activity:'アクティビティ項目',furniture:'家具・配置物',companion:'コンパニオン',unknown:'種類未確認',image:'画像未提供',list:'関連ItemID'},
 'zh-CN':{activity:'活动道具',furniture:'家具／场景物件',companion:'伙伴',unknown:'未分类物品',image:'暂无图片',list:'关联ItemID'},
 'pt-BR':{activity:'Item de atividade',furniture:'Móvel / objeto do mundo',companion:'Companheiro',unknown:'Item não classificado',image:'Imagem indisponível',list:'ItemIDs associados'}
});
const STREAM_KEY=Object.freeze({'ActivityItem.json':'activity','Furniture.json':'furniture','Companion.json':'companion'});
const NAME_LOCALE=Object.freeze({en:['en-US','en'],fr:['fr','fr-FR'],it:['it','it-IT'],de:['de','de-DE'],'es-ES':['es','es-ES'],ja:['ja','ja-JP'],'zh-CN':['zh-CN','zh'], 'pt-BR':['pt-BR','pt']});
const resolvedLocale=code=>Object.hasOwn(TEXT_BY_LOCALE,code)?code:
  code==='ja-JP'?'ja':code==='en-US'?'en':'en';
export function rcLinkedItemListLabel(code){return TEXT_BY_LOCALE[resolvedLocale(code)].list;}
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
 const language=resolvedLocale(localeCode);
 const words=TEXT_BY_LOCALE[language];
 const id=validId(item?.id)?item.id:null;
 const stream=id===null?null:(map.get(id)??null);
 const itemIdText=id===null?'ItemID unknown':'ItemID '+id;
 const categoryText=stream===null?words.unknown:words[STREAM_KEY[stream]];
 const imageStatus=words.image;
 const displayLine=itemIdText+' · '+categoryText+' · '+imageStatus;
 const localNames=NAME_LOCALE[language]??NAME_LOCALE.en;
 const name=plainText(localNames.map(k=>item?.names?.[k]).find(v=>typeof v==='string'&&v.trim())??
  item?.names?.['en-US']??item?.name)||
  (language==='ja'?'項目':'Item')+(id===null?'':' '+id);
 return Object.freeze({
  contract:WEB_TEXT_ITEM_CONTRACT,
  itemId:id,itemIdText,sourceCategory:stream===null?'UNCLASSIFIED':stream,
  sourceTypeVerified:stream!==null,displayLine,imageStatus,
  // An image fallback is always visible, even if ASSET later supplies a URL.
  displayTextFirst:true,mediaUrl:null,mediaRightsGranted:false,
  ariaLabel:displayLine,
  name
 });
}

/** Projection-only. Never truncate a verified multi-ItemID source event to
 * items[0] or infer EventID from the item links. Keeps input order, duplicates,
 * and any unclassified dynamic item as safe text (no images or URL).
 */
export function rcTextOnlyEventItems(items,localeCode,audit){
 checkedTextItemTypes(audit);
 if(!Array.isArray(items))return Object.freeze([]);
 return Object.freeze(items.map((item,linkIndex)=>Object.freeze({
  ...rcTextOnlyItem(item,localeCode,audit),linkIndex
 })));
}
