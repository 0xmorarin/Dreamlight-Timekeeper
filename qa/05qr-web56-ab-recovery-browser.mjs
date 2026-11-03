// Independent 05 QR Phase B: WEB56 changed UI: multi-linked ItemIDs, immutable
// actual A/B original backup bytes, corrupt-file recovery. Synthetic only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from '../tests/fixture.mjs';
const l=createServer();l.listen(0,'127.0.0.1');await once(l,'listening');
const port=l.address().port;l.close();await once(l,'close');
const host='http://127.0.0.1:'+port;
const url=host+'/Dreamlight-Timekeeper/';
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{
 cwd:process.cwd(),env:{...process.env,BASE_PATH:'/Dreamlight-Timekeeper'},stdio:'ignore'});
let browser;
try{
 let ready=false;
 for(let tries=0;tries<100;tries++){
  try{if((await fetch(url)).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert(ready,'WEB56 browser preview unavailable');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:320,height:720}});
 const outbound=[],socket=[];
 ctx.on('request',r=>{if(!r.url().startsWith(host+'/'))outbound.push(r.url())});
 await ctx.route('**/*',route=>route.request().url().startsWith(host+'/')?
   route.continue():route.abort('blockedbyclient'));
 const page=await ctx.newPage();page.on('websocket',w=>{
  if(!w.url().startsWith('ws://127.0.0.1:'+port+'/'))socket.push(w.url());
 });
 const profile=(name,second)=>Buffer.from(makeSyntheticP1gProfile({
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:name},
  World:{RecurringEvents:second?{
   '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2026-11-03T00:00:00Z'}}
  }:{
   '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z'}},
   '1':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:'2126-08-20T00:00:00Z'}}
  }}
 }));
 const a=profile('Independent QA A',false),b=profile('Independent QA B',true);
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('#tk-save-file').setInputFiles({name:'a.p1g',mimeType:'application/octet-stream',buffer:a});
 await page.getByRole('heading',{name:'Independent QA A'}).waitFor({timeout:20000});
 const thorn=page.locator('.event-row').filter({hasText:'EventID 2010000003'});
 assert.equal(await thorn.count(),1);
 assert.equal(await thorn.locator('.linked-items [role="listitem"]').count(),4);
 for(const id of [31300003,31300004,31300005,31300006]){
  assert.equal(await thorn.getByText('ItemID '+id,{exact:false}).count(),1,'Missing ItemID '+id);
 }
 assert.equal(await thorn.locator('.linked-items img').count(),0,'No game-derived images in linked ItemID list');
 const dlA=page.waitForEvent('download');
 await page.getByRole('button',{name:'Original backup'}).click();
 const da=await dlA;assert.equal(da.suggestedFilename(),'original_a.p1g');
 assert((await readFile(await da.path())).equals(a),'File A backup lost original bytes');
 await page.locator('#tk-save-file').setInputFiles({name:'b.p1g',mimeType:'application/octet-stream',buffer:b});
 await page.getByRole('heading',{name:'Independent QA B'}).waitFor({timeout:20000});
 assert.equal(await page.locator('.event-row').filter({hasText:'EventID 2010000003'}).count(),0);
 const dlB=page.waitForEvent('download');
 await page.getByRole('button',{name:'Original backup'}).click();
 const db=await dlB;assert.equal(db.suggestedFilename(),'original_b.p1g');
 assert((await readFile(await db.path())).equals(b),'File B backup leaked A bytes');
 await page.locator('#tk-save-file').setInputFiles({name:'corrupt.p1g',
  mimeType:'application/octet-stream',buffer:Buffer.from([0,1,2,3])});
 await page.locator('main [role="alert"]').waitFor({timeout:20000});
 assert.equal(await page.locator('.event-row').count(),0);
 await page.locator('#tk-save-file').setInputFiles({name:'b.p1g',mimeType:'application/octet-stream',buffer:b});
 await page.getByRole('heading',{name:'Independent QA B'}).waitFor({timeout:20000});
 assert.equal(await page.locator('main [role="alert"]').count(),0);
 assert.deepEqual(outbound,[]);
 assert.deepEqual(socket,[]);
 console.log(JSON.stringify({contract:'05qr.web56.multi-item-and-recovery@1',
  displayLinkedItemIDs:4,originalAByteExact:true,originalBByteExact:true,
  corruptFileFailsClosed:true,recoveryAccepted:true,offhostHttpObserved:outbound.length,
  browserWebsocketObserved:socket.length,mediaRightsApproved:false,writerAuthorized:false}));
}finally{await browser?.close();server.kill();}
