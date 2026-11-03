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
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const original=Buffer.from(makeSyntheticP1gProfile({
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:'RC Text Only'},World:{RecurringEvents:{'0':{ItemSpawning:{
   RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z'}}}}
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
 assert.deepEqual(errors,[]);
 console.log('WEB READONLY TEXT RC CHROMIUM PASS: 244-type source text, backup original, four tabs, eight locales, 320px, Worker direct prepareEdited DENY');
}finally{await browser?.close();server.kill();}
