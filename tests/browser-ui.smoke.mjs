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
 assert.equal(await open.locator('img.semantic-icon').evaluate(img=>img.complete&&img.naturalWidth===24),true);
 assert.match(await open.innerText(),/Open save/);
 await page.selectOption('#welcome-language','ja');
 assert.match(await open.innerText(),/セーブを開く/);
 await open.locator('img.semantic-icon').waitFor();
 assert.equal(await open.locator('img.semantic-icon').evaluate(img=>img.complete&&img.naturalWidth===24),true);
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
  assert.equal(await icon.evaluate(img=>img.complete&&img.naturalWidth===24),true);
 }
 assert.match(await page.locator('.readonly-flag').innerText(),/読取り専用/);
 const sourceWorld=page.locator('#regions img.semantic-icon');
 await sourceWorld.first().waitFor({state:'visible'});
 assert.equal(await sourceWorld.first().evaluate(async img=>{
  await img.decode();
  return img.naturalWidth===176&&img.getAttribute('alt')===''&&img.getAttribute('aria-hidden')==='true';
 }),true,'Expected original Steam Dreamlight Valley world icon with decorative accessibility.');
 const sourceBadge=await sourceWorld.first().evaluate(img=>img.closest('button')?.innerText);
 assert.ok(sourceBadge.includes('ドリームライト'));
 const primaryBox=await page.locator('#open-again').boundingBox();
 assert.ok(primaryBox.height>=44,'File operation touch target too small.');
 const warning=await page.evaluate(async()=>{
  const image=new Image();image.src='./assets/steam/v1253/ui/status/warning.webp';
  await image.decode();return [image.naturalWidth,image.naturalHeight];
 });
 assert.deepEqual(warning,[32,32]);
 let warningInLiveRecord=false;
 const tabs=page.locator('#tabs button');
 for(let n=0;n<await tabs.count();n++){
  await tabs.nth(n).click();
  const icons=page.locator('.record-warning .semantic-icon');
  if(await icons.count()){
   await icons.first().evaluate(async img=>{await img.decode();});
   warningInLiveRecord=true;
   break;
  }
 }
 assert.equal(warningInLiveRecord,true,'Expected anomalous synthetic timestamp to use the actual warning asset.');
 assert.equal(pageErrors.length,0,'Unexpected browser script exceptions: '+pageErrors.join('; '));
 await page.setViewportSize({width:390,height:844});
 assert.equal(await backup.isVisible(),true);
 const fallback=await browser.newPage({viewport:{width:390,height:844}});
 let blocked=0;
 await fallback.route('**/assets/app/ui/action/open-save.svg',route=>{
  blocked++;
  return route.abort();
 });
 await fallback.goto(site,{waitUntil:'domcontentloaded'});
 await fallback.waitForFunction(()=>window.__dreamlightBooted===true);
 await fallback.waitForTimeout(700);
 assert.ok(blocked>0,'Expected app UI icon request to be blocked.');
 assert.equal(await fallback.locator('#open-welcome img.semantic-icon').count(),0);
 assert.match(await fallback.locator('#open-welcome').innerText(),/Open save/);
 const [chooser]=await Promise.all([fallback.waitForEvent('filechooser'),fallback.locator('#open-welcome').click()]);
 assert.equal(chooser.isMultiple(),false);
 await fallback.close();
 console.log('Chromium UI smoke PASS: three decoded app UI icons, Steam warning VP8L, locale switch, synthetic read-only save, mobile layout.');
}finally{
 if(browser)await browser.close();
 server.kill();
}
