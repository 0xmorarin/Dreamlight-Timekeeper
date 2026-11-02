// Independent 05 QR Round 3: actual Chromium tab zoom, never a CSS viewport approximation.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const temporary=await mkdtemp(join(tmpdir(),'qr-round3-native-zoom-'));
const ext=join(temporary,'zoom-extension');
await mkdir(ext);
await writeFile(join(ext,'manifest.json'),JSON.stringify({
 manifest_version:3,name:'05 QR Native Tab Zoom',version:'1.0.0',
 permissions:['tabs'],host_permissions:['http://127.0.0.1/*'],
 background:{service_worker:'background.js'}
}));
await writeFile(join(ext,'background.js'),'// 05 QR strictly local synthetic-browser acceptance.\n');
const portProbe=createServer();portProbe.listen(0,'127.0.0.1');await once(portProbe,'listening');
const port=portProbe.address().port;portProbe.close();await once(portProbe,'close');
const site='http://127.0.0.1:'+port+'/';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
let context;
try{
 let ready=false;
 for(let n=0;n<100;n++){try{if((await fetch(site)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,125));}
 assert(ready,'Local static test server unavailable');
 context=await chromium.launchPersistentContext(join(temporary,'profile'),{
  channel:'chromium',headless:true,viewport:{width:1280,height:900},acceptDownloads:true,
  args:['--no-sandbox','--disable-extensions-except='+ext,'--load-extension='+ext]
 });
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:15000});
 assert(worker.url().startsWith('chrome-extension://'),'The native tab zoom extension must be loaded');
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.goto(site,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true);
 const baseline=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio}));
 const actual=await worker.evaluate(async url=>{
  const tabs=await chrome.tabs.query({});
  const tab=tabs.find(t=>t.url===url);
  if(!tab)throw new Error('Missing exact local test tab');
  await chrome.tabs.setZoom(tab.id,2);
  return {tabId:tab.id,zoom:await chrome.tabs.getZoom(tab.id)};
 },page.url());
 assert.equal(actual.zoom,2,'Must verify actual Chrome tab zoom through chrome.tabs.getZoom');
 await page.waitForFunction(d=>innerWidth<d.width&&devicePixelRatio>d.dpr,baseline,{timeout:12000});
 const geometry=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,scroll:document.documentElement.scrollWidth}));
 assert(geometry.width<=650,'Actual 200% zoom should halve the 1280 CSS viewport');
 const icon=page.locator('#open-welcome img.semantic-icon');
 await icon.waitFor({state:'visible',timeout:15000});
 assert.equal(await icon.evaluate(el=>el.alt===''&&el.getAttribute('aria-hidden')==='true'&&el.naturalWidth===24),true);
 const profile=Buffer.from(JSON.stringify({GameInfo:{Version:626},Player:{Name:'Round3 200%'},
  World:{RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z'}}}},
  Unknown:{preserve:'original'}}));
 await page.locator('#save-file').setInputFiles({name:'zoom-round3.json',mimeType:'application/json',buffer:profile});
 await page.locator('#session-name').getByText('Round3 200%').waitFor();
 assert.equal(await page.locator('#tabs button').count(),4);
 assert.equal(await page.locator('#download-backup img.semantic-icon').count(),1);
 const backup=page.waitForEvent('download',{timeout:10000});
 await page.locator('#download-backup').click();
 const file=await backup;
 assert.equal(file.suggestedFilename(),'original_zoom-round3.json');
 assert.deepEqual(await readFile(await file.path()),profile);
 await page.locator('#records input[type="checkbox"]').first().check();
 await page.selectOption('#time-mode','century');
 await page.locator('#stage-preview').click();
 await page.locator('#undo-plan').click();
 assert.equal(await page.locator('#redo-plan').isEnabled(),true);
 await page.locator('#redo-plan').click();
 await page.locator('#clear-plan').click();
 assert.equal(await page.locator('#export-edited').count(),0);
 await page.selectOption('#workspace-language','ja');
 assert.match(await page.locator('.readonly-flag').innerText(),/読取り専用/);
 await page.selectOption('#workspace-language','en-US');
 assert.match(await page.locator('.readonly-flag').innerText(),/Read-only/);
 await page.locator('#open-again').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'open-again');
 // Genuine keyboard activation, not programmatic input.click().
 const chooser=page.waitForEvent('filechooser',{timeout:8000});
 await page.locator('#open-again').press('Enter');
 const chosen=await chooser;
 assert.equal(chosen.isMultiple(),false);
 // An unavailable or corrupted icon must never remove the accessible text control.
 await page.route('**/assets/app/ui/action/open-save.svg',route=>route.abort());
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true);
 await page.waitForFunction(()=>document.querySelector('#open-welcome img.semantic-icon')===null,{timeout:10000});
 assert.match(await page.locator('#open-welcome').innerText(),/Open save/);
 const currentZoom=await worker.evaluate(async tabId=>chrome.tabs.getZoom(tabId),actual.tabId);
 assert.equal(currentZoom,2,'Browser zoom must stay 200% after reload');
 assert.deepEqual(errors,[]);
 console.log('05 QR R3 actual Chrome tab 200% PASS: native getZoom=2, '+baseline.width+' -> '+geometry.width+
  ', semantic SVG fallback, keyboard, four tabs, Undo/Redo, JA/EN, unmodified backup byte parity');
}finally{if(context)await context.close();server.kill();await rm(temporary,{recursive:true,force:true});}
