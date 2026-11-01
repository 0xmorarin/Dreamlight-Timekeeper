import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from './fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const probe=createServer();
probe.listen(0,'127.0.0.1');
await once(probe,'listening');
const port=probe.address().port;
probe.close();
await once(probe,'close');
const site='http://127.0.0.1:'+port+'/';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
let browser=null;
try{
 let ready=false;
 for(let attempt=0;attempt<60;attempt++){
  try{const r=await fetch(site);if(r.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 assert.equal(ready,true,'Local site failed to respond.');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1366,height:900},deviceScaleFactor:1});
 const pageErrors=[];
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.goto(site,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:15000});
 const open=page.locator('#open-welcome');
 await open.locator('img.semantic-icon').waitFor({state:'visible'});
 assert.equal(await open.locator('img.semantic-icon').evaluate(img=>img.complete&&img.naturalWidth===48),true);
 assert.match(await open.innerText(),/Open save/);
 await page.selectOption('#welcome-language','ja');
 assert.match(await open.innerText(),/セーブを開く/);
 await open.locator('img.semantic-icon').waitFor();
 assert.equal(await open.locator('img.semantic-icon').evaluate(img=>img.complete&&img.naturalWidth===48),true);
 const src=new Uint8Array(makeSyntheticP1gProfile({
  GameInfo:{InitialVersion:518,Version:626,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},
    Created:'2025-01-01T00:00:00Z',Modified:'2026-11-01T00:00:00Z'},
  Player:{Name:'Synthetic'},
  World:{RecurringEvents:{'0':{FlowerSpawningInVillage:{
   RecurringEventItemID:2010500008,NextOccurrence:'2126-08-20T00:00:00Z'}}}}
 }));
 await page.locator('#save-file').setInputFiles({name:'synthetic.p1g',mimeType:'application/octet-stream',buffer:Buffer.from(src)});
 await page.locator('#workspace').waitFor({state:'visible',timeout:20000});
 const backup=page.locator('#download-backup');
 assert.equal(await backup.isEnabled(),true);
 for(const id of ['open-again','download-backup']){
  const icon=page.locator('#'+id+' img.semantic-icon');
  await icon.waitFor({state:'visible'});
  assert.equal(await icon.evaluate(img=>img.complete&&img.naturalWidth===48),true);
 }
 assert.match(await page.locator('.readonly-flag').innerText(),/読取り専用/);
 const warning=await page.evaluate(async()=>{
  const image=new Image();image.src='./assets/steam/v1253/ui/status/warning.webp';
  await image.decode();return [image.naturalWidth,image.naturalHeight];
 });
 assert.deepEqual(warning,[32,32]);
 assert.equal(pageErrors.length,0,'Unexpected browser script exceptions: '+pageErrors.join('; '));
 await page.setViewportSize({width:390,height:844});
 assert.equal(await backup.isVisible(),true);
 console.log('Chromium UI smoke PASS: three decoded app UI icons, Steam warning VP8L, locale switch, synthetic read-only save, mobile layout.');
}finally{
 if(browser)await browser.close();
 server.kill();
}
