// Independent 05 QR actual Chromium flow using local-only synthetic saves.
// This test is NOT Switch game or edited-save acceptance.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from './fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const listener=createServer();
listener.listen(0,'127.0.0.1');
await once(listener,'listening');
const port=listener.address().port;
listener.close();
await once(listener,'close');
const address=`http://127.0.0.1:${port}/`;
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
let browser;
const makeProfile=(name,date)=>({
 GameInfo:{InitialVersion:518,Version:626,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},
  Created:'2025-01-01T00:00:00Z',Modified:'2026-11-01T00:00:00Z'},
 Player:{Name:name},Settings:{Language:''},
 World:{RecurringEvents:{
  '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:date}},
  '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:'2026-11-02T00:00:00Z'}}
 }},
 Opaque:{future:{shouldRemain:true}}
});
try {
 let ready=false;
 for(let i=0;i<60;i++){
  try {if((await fetch(address)).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,150));
 }
 assert(ready,'Local server must be available');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(address,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:15000});
 assert.equal(await page.locator('#open-welcome').isEnabled(),true);
 const first=Buffer.from(JSON.stringify(makeProfile('QA First','2126-08-20T00:00:00Z')));
 await page.locator('#save-file').setInputFiles({name:'qa-first.json',mimeType:'application/json',buffer:first});
 await page.locator('#workspace').waitFor({state:'visible',timeout:20000});
 const tabs=page.locator('#tabs button');
 assert.equal(await tabs.count(),4,'Product must preserve four tabs');
 for(let i=0;i<4;i++){
  await tabs.nth(i).click();
  assert.equal(await tabs.nth(i).getAttribute('aria-current'),'true');
  assert.equal(await tabs.nth(i).getAttribute('type'),'button');
 }
 await tabs.first().click();
 const checks=page.locator('#records input[type="checkbox"]');
 assert((await checks.count())>=1,'Expected synthetic spawn record');
 await checks.first().check();
 await page.selectOption('#time-mode','release');
 await page.locator('#preview .preview-summary').waitFor();
 assert((await page.locator('#preview').innerText()).includes('2022'),'Date preset should preview the Early Access year');
 await page.locator('#stage-preview').click();
 await page.locator('#draft-plan .draft-plan-item').first().waitFor();
 assert.equal(await page.locator('#undo-plan').isEnabled(),true);
 await page.locator('#undo-plan').click();
 assert.equal(await page.locator('#draft-plan .draft-plan-item').count(),0);
 await page.locator('#redo-plan').click();
 assert.equal(await page.locator('#draft-plan .draft-plan-item').count(),1);
 await page.selectOption('#time-mode','century');
 assert((await page.locator('#preview').innerText()).includes('2126'),'100-year preset should preview a future year');
 const oldStatus=await page.locator('#session-name').innerText();
 assert(oldStatus.length>0);
 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:15000}),
  page.locator('#download-backup').click()
 ]);
 assert.match(download.suggestedFilename(),/^original_qa-first\.json$/);
 const backing=await readFile(await download.path());
 assert.deepEqual(backing,first,'Original backup must be byte-identical to browser input');
 assert.equal(await page.locator('#export-edited').count(),0);
 assert.equal(await page.locator('#save-file').getAttribute('aria-label'),'Choose a save file');
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('#download-backup').isVisible(),true);
 const second=Buffer.from(makeSyntheticP1gProfile(makeProfile('QA Second','2030-02-01T00:00:00Z')));
 await page.locator('#save-file').setInputFiles({name:'qa-second.p1g',mimeType:'application/octet-stream',buffer:second});
 await page.waitForFunction(before=>document.getElementById('session-name')?.textContent!==before,oldStatus,{timeout:20000});
 assert.equal(await page.locator('#draft-plan .draft-plan-item').count(),0,'New file must not retain stale planned edits');
 assert.equal(await page.locator('#undo-plan').isEnabled(),false);
 assert.equal(await page.locator('#redo-plan').isEnabled(),false);
 const [secondDownload]=await Promise.all([
  page.waitForEvent('download',{timeout:15000}),
  page.locator('#download-backup').click()
 ]);
 assert.equal(secondDownload.suggestedFilename(),'original_qa-second.p1g');
 assert.deepEqual(await readFile(await secondDownload.path()),second,'P1G backup must match new source exactly');
 assert.equal(errors.length,0,errors.join('; '));
 console.log('05 QR Chromium PASS: 4 tabs, time presets, Undo/Redo, original-byte backups, file switch, mobile and basic aria');
} finally {
 if(browser)await browser.close();
 server.kill();
}
