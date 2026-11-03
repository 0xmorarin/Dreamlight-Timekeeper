import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rcTextOnlyEventItems,rcTextOnlyItem,rcLinkedItemListLabel,checkedTextItemTypes} from '../src/lib/timekeeper/item-text-only.mjs';
const raw=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const registry=await raw('data/events-v1253.json');
const audit=await raw('data/web-text-item-types-v1253.json');
const all=registry.events.filter(e=>e.items?.length);
const multi=all.filter(e=>e.items.length>1);
const ids=new Set(all.flatMap(e=>e.items.map(item=>item.id)));
const first=new Set(all.map(e=>e.items[0].id));
const later=[...ids].filter(id=>!first.has(id));
test('all 508 source definitions: 41 multi-item events, exactly 30 of 244 ItemIDs never occur first',()=>{
 assert.equal(registry.events.length,508);
 assert.equal(multi.length,41);
 assert.equal(Math.max(...multi.map(e=>e.items.length)),4);
 assert.equal(ids.size,244);
 assert.equal(first.size,214);
 assert.equal(later.length,30);
 assert.equal(checkedTextItemTypes(audit).size,244);
 assert.equal(later.every(id=>checkedTextItemTypes(audit).has(id)),true);
});
test('all 489 source links are represented, including the 30 non-leading ItemIDs, with no images or EventID substitution',()=>{
 let links=0;
 const represented=new Set();
 for(const record of registry.events){
  const output=rcTextOnlyEventItems(record.items,'en',audit);
  assert.equal(output.length,record.items.length);
  assert.equal(Object.isFrozen(output),true);
  assert.deepEqual(output.map(x=>x.linkIndex),record.items.map((_,i)=>i));
  for(const [index,entry] of output.entries()){
   const source=record.items[index];
   assert.equal(entry.itemId,source.id);
   assert.equal(entry.itemIdText,'ItemID '+source.id);
   assert.equal(entry.sourceTypeVerified,true);
   assert.equal(entry.mediaUrl,null);
   assert.equal(entry.mediaRightsGranted,false);
   assert.equal(entry.displayTextFirst,true);
   assert.match(entry.displayLine,/Image unavailable/);
   assert(!entry.displayLine.includes('EventID '+record.id));
   represented.add(entry.itemId);links++;
  }
 }
 assert.equal(links,489);
 assert.equal(represented.size,244);
 assert(later.every(id=>represented.has(id)));
});
test('every linked Night Thorn item has distinct visible ItemID, no first-entry truncation',()=>{
 const thorn=registry.events.find(e=>e.id===2010000003);
 const entries=rcTextOnlyEventItems(thorn.items,'ja',audit);
 assert.deepEqual(entries.map(e=>e.itemId),[31300003,31300004,31300005,31300006]);
 assert.deepEqual(entries.map(e=>e.linkIndex),[0,1,2,3]);
 for(const entry of entries){
  assert.match(entry.displayLine,/画像未提供/);
  assert(!/<nobr>/.test(entry.name));
 }
});
test('eight supported locales preserve source category, alt-safe name, no media URL or authority',()=>{
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const code of locales){
  const labels=rcTextOnlyEventItems([{id:31300003,names:{'en-US':'Small Night Thorn',ja:'小さな闇のトゲ'}}],code,audit);
  assert.equal(labels.length,1);
  assert.equal(labels[0].sourceTypeVerified,true);
  assert.equal(labels[0].mediaUrl,null);
  assert.equal(labels[0].mediaRightsGranted,false);
  assert.equal(typeof labels[0].displayLine,'string');
  assert(labels[0].displayLine.includes('ItemID 31300003'));
  assert(labels[0].displayLine.length>22);
  assert.equal(typeof rcLinkedItemListLabel(code),'string');
  assert(rcLinkedItemListLabel(code).length>0);
 }
 assert.match(rcLinkedItemListLabel('ja-JP'),/ItemID/);
});
test('safe unclassified and HTML-looking item names still render text-only without inheriting any EventID capability',()=>{
 const list=rcTextOnlyEventItems([
  {id:777777777,name:'<img src=x onerror=alert(1)>'},
  {id:31300003,name:'<script>steal</script>Visible'},
  {id:31300003,name:'Duplicate retained'}
 ],'fr',audit);
 assert.equal(list.length,3);
 assert.equal(list[0].sourceTypeVerified,false);
 assert.equal(list[0].mediaUrl,null);
 assert.equal(list[0].name,'Item 777777777');
 assert.equal(list[1].name,'stealVisible');
 assert.equal(list[1].mediaUrl,null);
 assert.deepEqual(list.map(e=>e.linkIndex),[0,1,2]);
 assert.equal(rcTextOnlyEventItems(null,'en',audit).length,0);
 const data=rcTextOnlyItem({id:2010000021},'en',audit);
 assert.equal(data.sourceTypeVerified,false,'event identity must not imply item identity');
});
test('Svelte event markup enumerates every linked ItemID and fences stale A-to-B sessions',async()=>{
 const markup=await readFile(new URL('../src/routes/+page.svelte',import.meta.url),'utf8');
 assert.match(markup,/rcTextOnlyEventItems\(r\.items,localeCode,itemTypeAudit\)/);
 assert.match(markup,/aria-label=\{rcLinkedItemListLabel\(localeCode\)\}/);
 assert.match(markup,/role="listitem"/);
 assert.match(markup,/EventID \{r\.id\}/);
 assert.match(markup,/\+\+openToken/);
 assert.match(markup,/\+\+preflightSerial/);
 assert.match(markup,/if\(myOpen!==openToken\)return/);
 assert.doesNotMatch(markup,/rcTextOnlyItem\(r\.items\[0\]/);
});
