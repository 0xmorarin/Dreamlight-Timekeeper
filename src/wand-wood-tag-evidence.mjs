// Evidence-only versioned source crosswalk. Does not grant write or world-object permissions.
const E='028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea';
const A='20e4f190fc4481325cb4311a4a3a3e6fc57d3f1ca7a67acffd9c9008394ba5d4';
const T='1208fc88a6b6b47346a6e8680db831b6a6751115adef34c4baf4ff7abdae9f3f';
export function auditWandWoodTagsInEvents(eventSource,tagPack){
 if(eventSource?.source?.rawEventSHA256!==E||
    eventSource?.source?.version!=='1.25.3'||
    eventSource?.source?.writerAuthorization!==false||
    !Array.isArray(eventSource.events)||eventSource.events.length!==508||
    tagPack?.artifact!=='DDV_WAND_ISWOOD_CROSS_VERSION_V1253'||
    tagPack.version!=='1.25.3'||tagPack.buildId!=='9A239D3DB569756D'||
    tagPack.sourceActivityItemSha256!==A||
    tagPack.sourceTagSha256BothVersions!==T||
    tagPack.sourceEventSha256!==E||
    tagPack.gameplayTag?.id!==2001200062||
    tagPack.gameplayTag?.name!=='isWood'||
    tagPack.writeAuthorized!==false||tagPack.deleteAuthorized!==false||
    !Array.isArray(tagPack.items)||tagPack.items.length!==14)
  throw new Error('Unsupported item tag evidence source.');
 const tags=new Map();
 for(const x of tagPack.items){
  if(!Number.isSafeInteger(x.id)||x.id<1||typeof x.isWood!=='boolean'||
     !/^[0-9a-f]{64}$/.test(x.payloadSha256)||tags.has(x.id))
   throw new Error('Invalid tag-linked ItemID record.');
  tags.set(x.id,x.isWood);
 }
 let tagged=0,untagged=0,unresolved=0;
 const rows=[];
 for(const e of eventSource.events){
  if(e.group!=='自然資源'||e.subgroup!=='木材・落下素材'||e.tab!=='spawn')continue;
  if(!Array.isArray(e.items)||!e.items.length)throw new Error('Missing linked ItemID.');
  const states=e.items.map(x=>tags.get(x.id));
  const status=states.every(x=>x===true)?'IS_WOOD_TAG':
   states.some(x=>x===undefined)?'UNKNOWN_ITEM_TAG':'NOT_WOOD_TAG';
  if(status==='IS_WOOD_TAG')tagged++;
  else if(status==='NOT_WOOD_TAG')untagged++;
  else unresolved++;
  rows.push(Object.freeze({
   eventId:e.id,linkedItemIds:Object.freeze(e.items.map(x=>x.id)),status,
   evidence:'V1253_IDENTICAL_ITEM_AND_TAG_SOURCE_BYTES',
   storedGridObjectVerified:false,writeAuthorized:false,deleteAuthorized:false
  }));
 }
 return Object.freeze({eventCount:rows.length,tagged,untagged,unresolved,
  sourceVersion:'1.25.3',tagVersion:'1.25.3',
  writeAuthorized:false,deleteAuthorized:false,rows:Object.freeze(rows)});
}
