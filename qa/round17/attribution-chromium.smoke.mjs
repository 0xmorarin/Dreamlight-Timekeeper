// 05 QR Round17 attribution ONLY: actual Chromium 200% native tab zoom + mobile + semantics.
// No Writer preparation or edited P1G output; prior exact Writer acceptance is reused.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const temp=await mkdtemp(join(tmpdir(),'qr-round17-attribution-'));
const ext=join(temp,'zoom-ext');await mkdir(ext);
await writeFile(join(ext,'manifest.json'),JSON.stringify({
 manifest_version:3,name:'05 QR Notice Native Zoom',version:'1.0.0',permissions:['tabs'],
 host_permissions:['http://127.0.0.1/*'],background:{service_worker:'background.js'}
}));
await writeFile(join(ext,'background.js'),'// QA only, local actual native Chrome zoom.\n');
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;probe.close();await once(probe,'close');
const site='http://127.0.0.1:'+port+'/';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const copyEN='Unofficial fan-made tool. Not affiliated with, sponsored, endorsed, or approved by Disney or Gameloft. Disney Dreamlight Valley and game-derived images, characters, logos, and other materials are the property of Disney, Gameloft, and their respective rights holders.';
const copyJA='非公式のファン制作ツールです。DisneyおよびGameloftとは提携・後援関係になく、承認・推奨も受けていません。『ディズニー ドリームライトバレー』およびゲーム由来の画像・キャラクター・ロゴ等の権利は、Disney、Gameloftおよび各権利者に帰属します。';
let ctx;
async function assertNotice(page,id){
 const loc=page.locator('#'+id+' .release-notice');
 assert.equal(await loc.count(),1,id+' one disclaimer');
 assert.equal(await loc.getAttribute('role'),'note');
 assert.equal(await loc.getAttribute('aria-label'),'Unofficial tool notice');
 const en=loc.locator('p[lang="en"]'),ja=loc.locator('p[lang="ja"]');
 assert.equal(await en.count(),1);assert.equal(await ja.count(),1);
 assert.equal(await en.textContent(),copyEN);
 assert.equal(await ja.textContent(),copyJA);
 assert.equal(await en.isVisible(),true,id+' English visible');
 assert.equal(await ja.isVisible(),true,id+' Japanese visible');
 const box=await loc.boundingBox();
 assert(box&&box.width>150);
 const viewport=await page.evaluate(()=>innerWidth);
 assert(box.x>=-2&&box.x+box.width<=viewport+2,
  id+' notice must fit CSS viewport '+viewport+' vs '+JSON.stringify(box));
 assert.equal(await loc.evaluate(el=>getComputedStyle(el).pointerEvents),'auto');
 assert.equal(await loc.evaluate(el=>getComputedStyle(el).visibility),'visible');
 assert.equal(await en.evaluate(el=>getComputedStyle(el).display!=='none'),true);
 assert.equal(await ja.evaluate(el=>getComputedStyle(el).display!=='none'),true);
 // Rendering may scroll: notice must not obscure the operative controls.
 const target=id==='welcome'?'#open-welcome':'#download-backup';
 const control=page.locator(target);
 if(await control.isVisible()){
  const box2=await control.boundingBox();
  assert(box2,'missing usable control geometry '+target);
  assert(box.y>=box2.y+box2.height-2||box2.y>=box.y+box.height-2,
   'Attribution note must not overlap interactive control '+target+' '+JSON.stringify({note:box,control:box2}));
 }
}
const profile=Buffer.from(JSON.stringify({GameInfo:{Version:626,InitialVersion:518},
 Player:{Name:'QR Notice'},World:{RecurringEvents:{
 '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z'}}
 }}}));
try{
 let ready=false;
 for(let i=0;i<80;i++){try{if((await fetch(site)).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,125));}
 assert(ready,'Local synthetic HTTP server unavailable');
 ctx=await chromium.launchPersistentContext(join(temp,'profile'),{
  channel:'chromium',headless:true,viewport:{width:1280,height:900},
  args:['--no-sandbox','--disable-extensions-except='+ext,'--load-extension='+ext]
 });
 const extension=ctx.serviceWorkers()[0]??await ctx.waitForEvent('serviceworker',{timeout:15000});
 assert(extension.url().startsWith('chrome-extension://'));
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(site,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:20000});
 await assertNotice(page,'welcome');
 assert.equal(await page.locator('#workspace').isHidden(),true);
 assert.equal(await page.locator('#welcome .support-title').innerText(),'Version details / 対応バージョン');
 assert.equal(await page.locator('#welcome .support-title').getAttribute('data-i18n'),null);
 const baseline=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio}));
 const z=await extension.evaluate(async url=>{
  const tabs=await chrome.tabs.query({});
  const tab=tabs.find(t=>t.url===url);if(!tab)throw Error('Missing exact local test tab');
  await chrome.tabs.setZoom(tab.id,2);
  return {tabId:tab.id,actualZoom:await chrome.tabs.getZoom(tab.id)};
 },page.url());
 assert.equal(z.actualZoom,2,'real native Chrome tab zoom 200%');
 await page.waitForFunction(v=>innerWidth<v.width&&devicePixelRatio>v.dpr,baseline,{timeout:12000});
 const native=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio}));
 assert(native.width<=650,'native zoom CSS width <=650px');
 await assertNotice(page,'welcome');
 // Keyboard-only focus and Enter on Open Save must continue to dispatch a user-activation file input.
 await page.evaluate(()=>{
  window.__qrNoticeSaveClicks=0;
  document.querySelector('#save-file').addEventListener('click',()=>window.__qrNoticeSaveClicks++,{capture:true});
 });
 await page.locator('#open-welcome').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'open-welcome');
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.__qrNoticeSaveClicks>=1,{timeout:7000});
 await page.locator('#save-file').setInputFiles({name:'notice-only.json',mimeType:'application/json',buffer:profile});
 await page.locator('#session-name').getByText('QR Notice').waitFor({timeout:20000});
 assert.equal(await page.locator('#tabs button').count(),4,'four tabs at real 200% Chrome zoom');
 assert.equal(await page.locator('#download-backup').isEnabled(),true);
 assert.equal(await page.locator('#prepare-edited-panel').isHidden(),true,'JSON has no writer privilege');
 assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
 await assertNotice(page,'workspace');
 assert.equal(await page.locator('#welcome').isHidden(),true);
 for(const lang of ['ja','en-US']){
  await page.locator('#workspace-language').selectOption(lang);
  await assertNotice(page,'workspace');
 }
 const zoomStill=await extension.evaluate(tabId=>chrome.tabs.getZoom(tabId),z.tabId);
 assert.equal(zoomStill,2);
 // Mobile layout must keep both notices legible, not introduce horizontal
 // overflow via new notice styling or move/overlap existing controls.
 await extension.evaluate(async id=>chrome.tabs.setZoom(id,1),z.tabId);
 await page.setViewportSize({width:390,height:844});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:20000});
 await assertNotice(page,'welcome');
 assert.equal(await page.locator('#open-welcome').isEnabled(),true);
 await page.locator('#save-file').setInputFiles({name:'notice-mobile.json',mimeType:'application/json',buffer:profile});
 await page.locator('#session-name').getByText('QR Notice').waitFor({timeout:20000});
 assert.equal(await page.locator('#tabs button').count(),4);
 await assertNotice(page,'workspace');
 assert.equal(await page.locator('#download-backup').isEnabled(),true);
 assert.equal(await page.locator('#prepare-edited-panel').isHidden(),true);
 const mobile=await page.evaluate(()=>({width:innerWidth,
  doc:document.documentElement.scrollWidth,
  notice:Array.from(document.querySelectorAll('.release-notice'))
    .map(el=>({width:el.getBoundingClientRect().width,
      right:el.getBoundingClientRect().right}))}));
 assert(mobile.notice[1].right<=mobile.width+2);
 assert.deepEqual(errors,[]);
 console.log('05 QR R17 ATTRIBUTION-ONLY ACTUAL CHROMIUM PASS: welcome+workspace bilingual ARIA notes, native 200% zoom '+baseline.width+'→'+native.width+', trusted keyboard Enter, mobile '+mobile.width+', four tabs and original backup intact, JSON Writer disabled');
}finally{if(ctx)await ctx.close();server.kill();await rm(temp,{recursive:true,force:true});}
