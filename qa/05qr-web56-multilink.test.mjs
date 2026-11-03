// 05 QR Phase B: independent NEW WEB56 event-linked ItemID presentation acceptance.
// WEB52 compiled Worker/HTTP tests are already independently scoped in QA54.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {rcTextOnlyEventItems,checkedTextItemTypes} from '../src/lib/timekeeper/item-text-only.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const registry=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const audit=JSON.parse(await readFile(new URL('../data/web-text-item-types-v1253.json',import.meta.url),'utf8'));
test('QR WEB56 exactly five delta paths from CTRL53; compiled Worker/Core guard unchanged',()=>{
 assert.deepEqual(git('diff','--name-only',
  '8b8c1ed90c604b1e3d41df8031806570612ced62',
  '96425000ab0dc1d1d7dcbb68a27b2da0a23c3f15').split('\n').sort(),[
 '.github/workflows/web-readonly-rc-validate-v1.yml',
 'src/lib/timekeeper/item-text-only.mjs',
 'src/routes/+page.svelte',
 'tests/browser-sveltekit-readonly-text-rc.smoke.mjs',
 'tests/web-multi-item-text-coverage.test.mjs'
 ].sort());
 for(const path of ['src/worker.mjs','src/lib/timekeeper/core-read-worker-bridge.mjs',
  'contracts/web-readonly-core-worker-v1.json','contracts/web-readonly-rc-release-v1.json']){
  assert.equal(git('rev-parse','8b8c1ed90c604b1e3d41df8031806570612ced62:'+path),
   git('rev-parse','96425000ab0dc1d1d7dcbb68a27b2da0a23c3f15:'+path));
 }
});
test('QR WEB56 independently enumerate ALL linked item identities, preserving source order & duplicates',()=>{
 const types=checkedTextItemTypes(audit);
 assert.equal(types.size,244);
 const all=new Set(),leading=new Set();
 let edges=0,multi=0,nonleading=0;
 for(const e of registry.events){
  const values=e.items??[];
  const actual=rcTextOnlyEventItems(values,'ja',audit);
  assert.equal(actual.length,values.length);
  assert(Object.isFrozen(actual));
  if(values.length>1)multi++;
  if(values.length)leading.add(values[0].id);
  for(let i=0;i<values.length;i++){
   const original=values[i],row=actual[i];
   all.add(original.id);edges++;
   assert.equal(row.itemId,original.id,'changed ItemID from source EventID '+e.id);
   assert.equal(row.linkIndex,i,'link order altered EventID '+e.id);
   assert.equal(row.itemIdText,'ItemID '+original.id);
   assert.equal(row.mediaUrl,null);
   assert.equal(row.mediaRightsGranted,false);
   assert.equal(row.displayTextFirst,true);
   assert(!row.displayLine.includes('EventID '+e.id));
  }
 }
 for(const id of all)if(!leading.has(id))nonleading++;
 assert.equal(registry.events.length,508);
 assert.equal(multi,41);
 assert.equal(edges,489);
 assert.equal(all.size,244);
 assert.equal(nonleading,30);
});
test('QR WEB56 first linked ItemID never suppresses three trailing Night Thorn IDs and 8 locales never mint a URL',()=>{
 const ev=registry.events.find(x=>x.id===2010000003);
 assert(ev);
 const eight=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const locale of eight){
  const rows=rcTextOnlyEventItems(ev.items,locale,audit);
  assert.deepEqual(rows.map(x=>x.itemId),[31300003,31300004,31300005,31300006]);
  for(const row of rows){
   assert(row.displayLine.includes('ItemID '+row.itemId));
   assert.equal(row.sourceTypeVerified,true);
   assert.equal(row.mediaUrl,null);
   assert.equal(row.mediaRightsGranted,false);
  }
 }
});
test('QR WEB56 invalid/dynamic ItemID does not inherit authority from valid EventID or raw markup',()=>{
 const list=rcTextOnlyEventItems([
  {id:2010000021,name:'<script>alert(1)</script>'},
  {id:99912348,name:'<img src=x onerror=alert(2)>evil'},
  {id:31300003,name:'<b>valid</b>'},{id:31300003,name:'duplicate'}
 ],'ja',audit);
 assert.equal(list.length,4);
 assert.deepEqual(list.map(x=>x.linkIndex),[0,1,2,3]);
 assert.equal(list[0].sourceTypeVerified,false);
 assert.equal(list[1].sourceTypeVerified,false);
 assert.equal(list[2].sourceTypeVerified,true);
 for(const r of list){assert.equal(r.mediaUrl,null);assert.equal(r.mediaRightsGranted,false);assert(!/<[^>]*>/.test(r.name));}
});
test('QR WEB56 source uses text expressions and openToken fence, never untrusted html or Writer UI',async()=>{
 const html=await readFile(new URL('../src/routes/+page.svelte',import.meta.url),'utf8');
 assert(html.includes('rcTextOnlyEventItems(r.items,localeCode,itemTypeAudit)'));
 assert(html.includes('++openToken'));
 assert(html.includes('++preflightSerial'));
 assert(html.includes('if(myOpen!==openToken)return'));
 assert(html.includes('role="listitem"'));
 assert(!html.includes('rcTextOnlyItem(r.items[0]'));
 assert(!html.includes('{@html'));
});
