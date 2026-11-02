import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=process.env.TIMEKEEPER_ROUND3_TARGET;
assert(root,'Pinned PR11 checkout required.');
const temp=await mkdtemp(join(tmpdir(),'timekeeper-browser-zoom-'));
const extension=join(temp,'zoom-extension');
const {mkdir}=await import('node:fs/promises');
await mkdir(extension);
await writeFile(join(extension,'manifest.json'),JSON.stringify({
 manifest_version:3,name:'Timekeeper Zoom Acceptance Test',version:'1.0.0',
 permissions:['tabs'],host_permissions:['http://127.0.0.1/*'],
 background:{service_worker:'background.js'}
}));
await writeFile(join(extension,'background.js'),`chrome.tabs.onUpdated.addListener((tabId,change,tab)=>{
 if(change.status==='complete'&&tab.url?.startsWith('http://127.0.0.1:'))
  chrome.tabs.setZoom(tabId,2,()=>{});
});`);
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;probe.close();await once(probe,'close');
const url='http://127.0.0.1:'+port+'/';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
let context;
try{
 let ready=false;
 for(let i=0;i<80;i++){
  try{if((await fetch(url)).ok){ready=true;break;}}catch{}
  await new Promise(done=>setTimeout(done,125));
 }
 assert(ready,'Local site did not start');
 context=await chromium.launchPersistentContext(join(temp,'chrome-profile'),{
  channel:'chromium',headless:true,viewport:{width:1280,height:900},
  acceptDownloads:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-sandbox']
 });
 const page=context.pages()[0]||await context.newPage();
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 // Both icon manifest validations fail closed, and every visual asset request is blocked.
 await page.route('**/data/app-ui-icons.json',route=>route.fulfill({status:200,contentType:'application/json',body:'{"kind":"app_ui","source":{"writerAuthorization":true},"icons":{}}'}));
 await page.route('**/data/steam-ui-icons-v1253.json',route=>route.fulfill({status:200,contentType:'application/json',body:'{"kind":"game_ui","source":{"writerAuthorization":true},"icons":{}}'}));
 await page.route('**/assets/**',route=>route.abort());
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true);
 try{
  const extensionWorker=context.serviceWorkers().find(w=>w.url().startsWith('chrome-extension://'));
  assert(extensionWorker,'Expected loaded isolated test extension service worker');
  const result=await extensionWorker.evaluate(async()=>{
   const tabs=await chrome.tabs.query({});
   const page=tabs.find(t=>t.url?.startsWith('http://127.0.0.1:'));
   if(!page)throw new Error('No test site tab available for native zoom: '+JSON.stringify(tabs.map(t=>({id:t.id,url:t.url}))));
   await chrome.tabs.setZoom(page.id,2);
   return {tabId:page.id,actualZoom:await chrome.tabs.getZoom(page.id)};
  });
  assert.equal(result.actualZoom,2,'Chrome tab zoom API must confirm 200%.');
  await page.waitForFunction(()=>window.devicePixelRatio>1.9&&window.devicePixelRatio<2.1,null,{timeout:12000});
 }catch(e){
  const diagnostics=await page.evaluate(()=>({dpr:window.devicePixelRatio,width:window.innerWidth,cssWidth:document.documentElement.clientWidth}));
  throw new Error('Browser zoom extension did not set native 200%: '+JSON.stringify(diagnostics)+' workers='+context.serviceWorkers().length,{cause:e});
 }
 const geometry=await page.evaluate(()=>({dpr:devicePixelRatio,width:innerWidth}));
 assert(geometry.width<=650,'Browser zoom must reduce CSS viewport width; DPR-only emulation is not acceptable');
 assert.equal(await page.locator('#open-welcome').isVisible(),true);
 const profile=JSON.stringify({GameInfo:{Version:626},Player:{Name:'超長いセーブ名'.repeat(36)+' Long Save Name'.repeat(18)},World:{RecurringEvents:{
  '0':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:'2126-08-20T00:00:00Z'}}
 }}});
 await page.locator('#save-file').setInputFiles({name:'zoom.json',mimeType:'application/json',buffer:Buffer.from(profile)});
 await page.locator('#workspace').waitFor({state:'visible'});
 assert.equal(await page.locator('#tabs button').count(),4);
 await page.waitForTimeout(300);
 assert.equal(await page.locator('.semantic-icon').count(),0,'Invalid manifests or missing assets cannot leave decorative icons.');
 for(const locale of ['en-US','ja']){
  await page.selectOption('#workspace-language',locale);
  const tabs=page.locator('#tabs button');
  assert.equal(await tabs.count(),4);
  const text=(await tabs.allTextContents()).join('|');
  if(locale==='en-US')assert.match(text,/Spawns|Gathering/);
  else assert.match(text,/自動発生|採集/);
  for(const index of [0,1,2,3]){
   await tabs.nth(index).focus();
   await tabs.nth(index).press('Enter');
   assert.equal(await tabs.nth(index).getAttribute('aria-current'),'true');
  }
  await tabs.first().click();
  const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,
   actions:document.querySelector('.workspace-actions')?.getBoundingClientRect().width}));
  assert(sizes.scroll<=sizes.client+4,'Actual native 200% layout must avoid document-wide horizontal overflow: '+JSON.stringify({locale,sizes}));
  assert.equal(await page.locator('#download-backup').isVisible(),true);
  assert.equal(await page.locator('#download-backup').isEnabled(),true);
 }
 await page.locator('#records input[type="checkbox"]').first().check();
 await page.locator('#stage-preview').click();
 await page.locator('#undo-plan').click();
 assert.equal(await page.locator('#redo-plan').isEnabled(),true);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download-backup').click()]);
 const file=join(temp,'zoom-copy.json');await download.saveAs(file);
 assert.equal(await readFile(file,'utf8'),profile);
 await page.locator('#open-again').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'open-again');
 assert.deepEqual(errors,[]);
 console.log('Round 3 native Chromium 200% + EN/JA + long labels + invalid manifests + keyboard + original bytes PASS; viewport='+JSON.stringify(geometry));
}finally{if(context)await context.close();server.kill();await rm(temp,{recursive:true,force:true});}
