import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{const bytes=await readFile(fileURLToPath(url));return new Response(bytes,{status:200,headers:{'content-type':String(url).endsWith('.gz')?'application/octet-stream':'application/json'}})};
let reply;
globalThis.self={postMessage:data=>{reply?.(data);}};
await import('../src/worker.mjs');
function send(type,contents,name='profile.json'){
  const source=Buffer.from(contents,'utf8');
  const buffer=source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength);
  return new Promise((resolve,reject)=>{
    const fail=setTimeout(()=>reject(new Error('Worker did not respond')),3000);
    reply=data=>{clearTimeout(fail);resolve(data)};
    self.onmessage({data:{id:2,type,name,buffer}});
  });
}
const profile={GameInfo:{Version:626},Player:{Name:'TEST'},World:{RecurringEvents:{}}};
test('UTF-8 BOM profile.json is handled and acknowledged',async()=>{
  const result=await send('open','\uFEFF'+JSON.stringify(profile));
  assert.equal(result.ok,true);
  assert.equal(result.format,'json');
  assert.equal(result.view.identity.name,'TEST');
});
test('Worker provides non-mutating read-only shared-date diagnostics for uploaded save',async()=>{
 const special='2126-08-20T00:00:00.000Z';
 const source={GameInfo:{Version:626},Player:{Name:'Fixture'},World:{RecurringEvents:{
  '0':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:special}},
  '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:special}},
  '2':{FishSpawningInVillage:{RecurringEventItemID:2010200014,NextOccurrence:'2028-01-01T00:00:00Z'}}
 }}};
 const sourceText=JSON.stringify(source);
 const result=await send('open',sourceText);
 assert.equal(result.ok,true);
 assert.equal(result.view.timingAudit.statuses.SPECIAL_2126_UNRESOLVED,2);
 assert.equal(result.view.timingAudit.shared2126.multiTypePattern,true);
 assert.equal(result.view.timingAudit.shared2126.originVerified,false);
 assert.equal(result.view.timingAudit.autoRepairAllowed,false);
 assert.equal(result.view.timingAudit.writerAuthorized,false);
 assert.equal(result.view.capabilities.editingAllowed,false);
 assert.equal(JSON.stringify(source),sourceText);
});
test('malformed profile.json returns a visible error result',async()=>{
  const result=await send('open','{invalid');
  assert.equal(result.ok,false);
  assert.equal(typeof result.error,'string');
  assert(result.error.length>0);
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.self;});
