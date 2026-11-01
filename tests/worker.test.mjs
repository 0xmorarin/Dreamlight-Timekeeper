import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await readFile(fileURLToPath(url),'utf8'))});
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
test('malformed profile.json returns a visible error result',async()=>{
  const result=await send('open','{invalid');
  assert.equal(result.ok,false);
  assert.equal(typeof result.error,'string');
  assert(result.error.length>0);
});
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.self;});
