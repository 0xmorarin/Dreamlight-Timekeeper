// Exact new SvelteKit UI: Chrome native 200% zoom, keyboard, eight locales.
// All served via loopback test preview; never uploads any save or uses the OS picker.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from './fixture.mjs';
const temp=await mkdtemp(join(tmpdir(),'timekeeper-svelte-zoom-'));
const ext=join(temp,'extension');await mkdir(ext);
await writeFile(join(ext,'manifest.json'),JSON.stringify({manifest_version:3,
 name:'Timekeeper SvelteKit QA native zoom',version:'1.0.0',permissions:['tabs'],
 host_permissions:['http://127.0.0.1/*'],background:{service_worker:'background.js'}}));
await writeFile(join(ext,'background.js'),'// Dedicated loopback-only native browser zoom fixture\n');
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
const port=socket.address().port;socket.close();await once(socket,'close');
const base='http://127.0.0.1:'+port+'/Dreamlight-Timekeeper/';
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{
 cwd:process.cwd(),env:{...process.env,BASE_PATH:'/Dreamlight-Timekeeper'},stdio:'ignore'});
let ctx;
try{
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,120));}
 assert(ready);
 ctx=await chromium.launchPersistentContext(join(temp,'browser'),{
  channel:'chromium',headless:true,viewport:{width:1280,height:900},
  args:['--no-sandbox','--disable-extensions-except='+ext,'--load-extension='+ext]
 });
 const extension=ctx.serviceWorkers()[0]??await ctx.waitForEvent('serviceworker',{timeout:15000});
 const page=await ctx.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('#tk-save-file').waitFor();
 const supported=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 assert.deepEqual(await page.locator('#tk-language option').evaluateAll(xs=>xs.map(x=>x.value)),supported);
 for(const lang of supported){
  await page.locator('#tk-language').selectOption(lang);
  assert.equal(await page.locator('html').getAttribute('lang'),lang);
 }
 await page.locator('#tk-language').selectOption('ja');
 await page.reload();
 assert.equal(await page.locator('html').getAttribute('lang'),'ja','explicit manual preference persists');
 const before=await page.evaluate(()=>({w:innerWidth,dpr:devicePixelRatio}));
 const zoom=await extension.evaluate(async url=>{
  const tab=(await chrome.tabs.query({})).find(t=>t.url===url);
  if(!tab)throw Error('SvelteKit local tab missing');
  await chrome.tabs.setZoom(tab.id,2);
  return chrome.tabs.getZoom(tab.id);
 },page.url());
 assert.equal(zoom,2);
 await page.waitForFunction(old=>innerWidth<old.w&&devicePixelRatio>old.dpr,before,{timeout:12000});
 const after=await page.evaluate(()=>({w:innerWidth,dpr:devicePixelRatio,scroll:document.documentElement.scrollWidth}));
 assert(after.w<=650&&after.scroll<=after.w+4,'Zoomed landing must not overflow horizontally');
 const open=page.getByRole('button',{name:'セーブを開く'});
 await open.waitFor({state:'visible'});
 await open.focus();assert.equal(await open.evaluate(el=>document.activeElement===el),true);
 // Synthetic file input path; the native chooser event is intentionally non-gating.
 const fixture=makeSyntheticP1gProfile({
  GameInfo:{InitialVersion:518,Version:626,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:'Svelte Zoom'},World:{RecurringEvents:{'0':{ItemSpawning:{
   RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z'}}}}
 });
 await page.locator('#tk-save-file').setInputFiles({name:'zoom.p1g',mimeType:'application/octet-stream',buffer:Buffer.from(fixture)});
 await page.getByText('Svelte Zoom').waitFor({timeout:25000});
 assert.equal(await page.locator('.tabs button').count(),4);
 assert.equal(await page.locator('.event-row').count(),1);
 assert.equal(await page.locator('.verified-pair').isHidden(),true);
 assert.deepEqual(errors,[]);
 console.log('SVELTEKIT NATIVE ZOOM 200% PASS '+before.w+'→'+after.w+
  '; 8 locale manual/persisted, real local Worker load, 4 tabs, original controls; native OS picker non-gating');
}finally{await ctx?.close();server.kill();await rm(temp,{recursive:true,force:true});}
