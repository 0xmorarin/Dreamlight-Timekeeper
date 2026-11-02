import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;probe.close();await once(probe,'close');
const url='http://127.0.0.1:'+port+'/';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const folder=await mkdtemp(join(tmpdir(),'timekeeper-web-'));
let browser;
try{
 let started=false;
 for(let i=0;i<80;i++){
  try{const response=await fetch(url);if(response.ok){started=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,125));
 }
 assert(started,'Static local server did not start.');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900},timezoneId:'America/New_York'});
 const page=await context.newPage(),errors=[],downloads=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('download',download=>downloads.push(download));
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;window.__backupHeld=false;
  window.Worker=class {
   constructor(...args){
    this.inner=new NativeWorker(...args);this.onmessage=null;this.onerror=null;this.onmessageerror=null;
    this.inner.onmessage=event=>{
     if(event.data?.type==='backup'&&event.data.name==='first.json'){
      window.__backupHeld=true;window.__releaseOldBackup=()=>this.onmessage?.(event);return;
     }
     this.onmessage?.(event);
    };
    this.inner.onerror=event=>this.onerror?.(event);
    this.inner.onmessageerror=event=>this.onmessageerror?.(event);
   }
   postMessage(...args){return this.inner.postMessage(...args);}
   terminate(){return this.inner.terminate();}
  };
 });
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:20000});
 const profile=(name,date)=>JSON.stringify({GameInfo:{Version:626},Player:{Name:name},World:{RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:date}}}}});
 const first=profile('First','2126-08-20T00:00:00Z'),second=profile('Second','2026-10-01T00:00:00Z');
 await page.locator('#save-file').setInputFiles({name:'first.json',mimeType:'application/json',buffer:Buffer.from(first)});
 await page.locator('#workspace').waitFor({state:'visible',timeout:20000});
 await page.locator('#session-name').getByText('First').waitFor();
 assert.equal(await page.locator('#tabs button').count(),4);
 await page.locator('#download-backup').click();
 await page.waitForFunction(()=>window.__backupHeld===true);
 await page.locator('#save-file').setInputFiles({name:'second.json',mimeType:'application/json',buffer:Buffer.from(second)});
 await page.locator('#session-name').getByText('Second').waitFor();
 await page.evaluate(()=>window.__releaseOldBackup());
 await page.waitForTimeout(250);
 assert.equal(downloads.length,0,'Stale first-session backup must not be downloaded.');
 const downloaded=page.waitForEvent('download');
 await page.locator('#download-backup').click();
 const latest=await downloaded;assert.equal(latest.suggestedFilename(),'original_second.json');
 const path=join(folder,'backup.json');await latest.saveAs(path);
 assert.equal(await readFile(path,'utf8'),second,'Original download must preserve bytes.');
 assert.equal(await page.locator('#export-edited').count(),0,'No edited-save export allowed.');
 await page.locator('#records input[type="checkbox"]').first().check();
 await page.selectOption('#time-mode','custom');
 await page.locator('#custom-time').fill('2026-11-01T01:30');
 await page.locator('#custom-time').dispatchEvent('change');
 assert.match(await page.locator('#preview').innerText(),/Invalid local time/i);
 await page.locator('#stage-preview').click();
 assert.match(await page.locator('#workspace-status').innerText(),/Cannot stage|failed/i);
 await page.locator('#custom-time').fill('2026-11-01T03:30');
 await page.locator('#custom-time').dispatchEvent('change');
 assert.match(await page.locator('#preview').innerText(),/2026/);
 await page.locator('#stage-preview').click();
 await page.locator('#undo-plan').click();
 assert.equal(await page.locator('#redo-plan').isEnabled(),true);
 await page.locator('#redo-plan').click();
 await page.locator('#clear-plan').click();
 await page.setViewportSize({width:390,height:800});
 assert.equal(await page.locator('#download-backup').isVisible(),true);
 await page.locator('#open-again').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'open-again');
 assert.deepEqual(errors,[]);
 console.log('Chromium 03 WEB session/backup/DST/Undo/mobile smoke PASS');
}finally{if(browser)await browser.close();server.kill();await rm(folder,{recursive:true,force:true});}
