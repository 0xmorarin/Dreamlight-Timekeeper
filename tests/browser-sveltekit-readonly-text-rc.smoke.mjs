// Exact build-time text-only RC: synthetic save, local loopback, no deploy.
// A direct separately created bundled Worker must refuse prepareEdited.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {readdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from './fixture.mjs';
const listeners=createServer();listeners.listen(0,'127.0.0.1');
await once(listeners,'listening');
const port=listeners.address().port;listeners.close();await once(listeners,'close');
const base='http://127.0.0.1:'+port+'/Dreamlight-Timekeeper/';
const workerDir='build/_app/immutable/workers';
const workerFiles=(await readdir(workerDir)).filter(x=>/^worker-[\w-]+\.js$/.test(x));
assert.equal(workerFiles.length,1,'Expected exactly one compiled Worker entry');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{
 cwd:process.cwd(),env:{...process.env,BASE_PATH:'/Dreamlight-Timekeeper'},stdio:'ignore'
});
let browser;
try{
 let ready=false;
 for(let i=0;i<120;i++){
  try{if((await fetch(base)).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 assert(ready,'Read-only text build not reachable locally');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:320,height:720},timezoneId:'UTC'});
 const remoteRequests=[],remoteSockets=[];
 context.on('request',req=>{
  if(!req.url().startsWith('http://127.0.0.1:'+port+'/'))
   remoteRequests.push(req.url());
 });
 const page=await context.newPage();
 page.on('websocket',socket=>{if(!socket.url().startsWith('ws://127.0.0.1:'+port+'/'))remoteSockets.push(socket.url());});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const original=Buffer.from(makeSyntheticP1gProfile({
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:'RC Text Only'},World:{RecurringEvents:{
   '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z'}},
   '1':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:'2126-08-20T00:00:00Z'}}
  }}
 }));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#tk-language option').count(),8);
 await page.locator('#tk-save-file').setInputFiles({name:'rc.p1g',mimeType:'application/octet-stream',buffer:original});
 await page.getByRole('heading',{name:'RC Text Only'}).waitFor({timeout:20000});
 assert.equal(await page.locator('.tabs button').count(),4);
 assert.equal(await page.locator('.write-controls').isHidden(),true);
 assert.equal(await page.locator('.output-bottom').isHidden(),true);
 assert.equal(await page.getByText('READ-only text RC candidate',{exact:false}).count()>0,true);
 const label=await page.locator('.event-row .item-type').first().textContent();
 assert.match(label,/ItemID/);
 assert.match(label,/Image unavailable/);
 assert.match(label,/Activity item|Furniture|Companion/);
 // 41 source events have >1 ItemID. The second fixture event links four
 // distinct obstacle ItemIDs, three of which never occur first in source.
 const thorn=page.locator('.event-row').filter({hasText:'EventID 2010000003'});
 assert.equal(await thorn.count(),1);
 assert.equal(await thorn.locator('.linked-items [role="listitem"]').count(),4);
 for(const id of [31300003,31300004,31300005,31300006]){
  assert.equal(await thorn.getByText('ItemID '+id,{exact:false}).count(),1);
 }
 const linked=await thorn.locator('.linked-items').getAttribute('aria-label');
 assert(linked&&linked.length>0);
 assert.equal(await thorn.locator('.linked-items img').count(),0);

 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+3),false);
 const p=page.waitForEvent('download');
 await page.getByRole('button',{name:'Original backup'}).click();
 assert.equal((await p).suggestedFilename(),'original_rc.p1g');
 // Dispatch directly to compiled Worker, bypassing the hidden Svelte buttons.
 const answer=await page.evaluate(workerFile=>new Promise((resolve,reject)=>{
  const worker=new Worker('/Dreamlight-Timekeeper/_app/immutable/workers/'+workerFile,{type:'module'});
  const timeout=setTimeout(()=>{worker.terminate();reject(Error('No response from RC Worker'));},10000);
  worker.onmessage=e=>{clearTimeout(timeout);worker.terminate();resolve(e.data);};
  worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(Error(e.message));};
  worker.postMessage({id:191,type:'prepareEdited',sessionId:1,planRevision:0,entries:[]});
 }),workerFiles[0]);
 assert.equal(answer.ok,false);
 assert.equal(answer.error,'RC_READ_ONLY_WRITER_DISABLED');
 // The shipped Worker MUST reject fake source/Session/Cursor/Complete claims:
 // a Svelte-hidden control is never the actual security boundary.
 for(const query of [
  {id:192,type:'queryPage',domain:'timing',view:'summary',limit:200,cursor:'forged',
   sourceSha256:'a'.repeat(64),revision:0,indexGeneration:0,complete:true},
  {id:193,type:'queryPage',domain:'world-grid',view:'all',limit:201,cursor:null,
   capabilities:{READ:'AVAILABLE'},referenceGraph:{verified:true}}
 ]){
  const rejected=await page.evaluate(({workerFile,query})=>new Promise((resolve,reject)=>{
   const worker=new Worker('/Dreamlight-Timekeeper/_app/immutable/workers/'+workerFile,{type:'module'});
   const timeout=setTimeout(()=>{worker.terminate();reject(Error('READ denial timeout'));},10000);
   worker.onmessage=e=>{clearTimeout(timeout);worker.terminate();resolve(e.data);};
   worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(Error(e.message));};
   worker.postMessage(query);
  }),{workerFile:workerFiles[0],query});
  assert.equal(rejected.ok,false);
  assert.equal(rejected.error,'CORE_READ_ABI_NOT_ACCEPTED');
 }
 // New file replacement must invalidate old output and ensure backup is
 // emitted from the NEW worker session, even when IDs recycle after restart.
 const second=Buffer.from(makeSyntheticP1gProfile({
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:'RC Text Only B'},World:{RecurringEvents:{
   '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2026-11-03T00:00:00Z'}}
  }}
 }));
 await page.locator('#tk-save-file').setInputFiles({name:'rc-b.p1g',mimeType:'application/octet-stream',buffer:second});
 await page.getByRole('heading',{name:'RC Text Only B'}).waitFor({timeout:20000});
 assert.equal(await page.locator('.event-row').filter({hasText:'EventID 2010000003'}).count(),0);
 const nextBackup=page.waitForEvent('download');
 await page.getByRole('button',{name:'Original backup'}).click();
 assert.equal((await nextBackup).suggestedFilename(),'original_rc-b.p1g');
 // Corrupt replacement must fail closed with no stale snapshot; reselecting a
 // legitimate local file remains possible without refreshing the browser.
 await page.locator('#tk-save-file').setInputFiles({
  name:'corrupt.p1g',mimeType:'application/octet-stream',buffer:Buffer.from([0,1,2,3])
 });
 await page.locator('main [role="alert"]').waitFor({timeout:20000});
 assert.equal(await page.locator('.event-row').count(),0);
 assert.equal(await page.locator('.landing button.primary').count(),1);
 await page.locator('#tk-save-file').setInputFiles({name:'rc-b.p1g',mimeType:'application/octet-stream',buffer:second});
 await page.getByRole('heading',{name:'RC Text Only B'}).waitFor({timeout:20000});
 assert.equal(await page.locator('main [role="alert"]').count(),0);
 assert.deepEqual(remoteRequests,[],'Compiled UI/Worker requested external network URL');
 assert.deepEqual(remoteSockets,[],'Compiled UI opened external WebSocket');
 assert.deepEqual(errors,[]);
 console.log('WEB READONLY TEXT RC CHROMIUM PASS: 244-type multi-item source text, A-to-B and corrupt-file recovery, backup original, four tabs, eight locales, 320px, Worker direct prepareEdited + untrusted READ DENY; network local-only');
}finally{await browser?.close();server.kill();}
