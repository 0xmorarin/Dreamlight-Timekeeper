// 05 QR independently exercises delayed Worker messages on the fixed PR #10.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url));
const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');
const port=s.address().port;s.close();await once(s,'close');
const url='http://127.0.0.1:'+port+'/';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
let browser;
try{
 let ok=false;
 for(let n=0;n<80;n++){try{if((await fetch(url)).ok){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,150));}
 assert(ok);
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true,timezoneId:'America/New_York'});
 const page=await context.newPage(),errors=[],downloads=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('download',d=>downloads.push(d));
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;
  window.__held=[];
  window.Worker=class {
   constructor(...args){
    this.inner=new NativeWorker(...args);this.onmessage=null;this.onerror=null;this.onmessageerror=null;
    this.inner.onmessage=e=>{
     if(['backup','preflight'].includes(e.data?.type)&&window.__holdOld===true){
      window.__held.push(e);return;
     }
     this.onmessage?.(e);
    };
    this.inner.onerror=e=>this.onerror?.(e);this.inner.onmessageerror=e=>this.onmessageerror?.(e);
   }
   postMessage(...args){return this.inner.postMessage(...args);}
   terminate(){return this.inner.terminate();}
  };
  window.__releaseHeld=()=>{
   const old=window.__held.splice(0);
   for(const e of old)window.__qrWorkerProxy?.onmessage?.(e);
  };
  // A proxy constructor records its instance for deterministic delayed responses.
  const Decorated=window.Worker;
  window.Worker=class extends Decorated{
   constructor(...args){super(...args);window.__qrWorkerProxy=this;}
  };
 });
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:20000});
 const make=(name,time)=>Buffer.from(JSON.stringify({
  GameInfo:{Version:626},Player:{Name:name},
  World:{RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:time}}}},
  Unknown:{mustStay:true}
 }));
 const a=make('First QA','2126-08-20T00:00:00Z');
 const b=make('Second QA','2030-03-03T00:00:00Z');
 await page.locator('#save-file').setInputFiles({name:'first.json',mimeType:'application/json',buffer:a});
 await page.locator('#session-name').getByText('First QA').waitFor({timeout:20000});
 assert.equal(await page.locator('#tabs button').count(),4);
 await page.locator('#records input[type="checkbox"]').first().check();
 await page.selectOption('#time-mode','release');
 await page.evaluate(()=>window.__holdOld=true);
 await page.locator('#stage-preview').click();
 await page.waitForFunction(()=>window.__held.some(e=>e.data?.type==='preflight'),{timeout:10000});
 await page.locator('#download-backup').click();
 await page.waitForFunction(()=>window.__held.some(e=>e.data?.type==='backup'),{timeout:10000});
 await page.locator('#download-backup').click();
 await page.locator('#save-file').setInputFiles({name:'second.json',mimeType:'application/json',buffer:b});
 await page.locator('#session-name').getByText('Second QA').waitFor({timeout:20000});
 await page.evaluate(()=>{window.__holdOld=false;window.__releaseHeld();});
 await page.waitForTimeout(350);
 assert.equal(downloads.length,0,'Delayed A backup may never download after switching to B');
 assert.equal(await page.locator('#draft-plan .draft-plan-item').count(),0,'Old preflight and draft may never attach to B');
 assert.equal(await page.locator('#undo-plan').isEnabled(),false);
 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:15000}),
  page.locator('#download-backup').click()
 ]);
 assert.equal(download.suggestedFilename(),'original_second.json');
 assert.deepEqual(await readFile(await download.path()),b);
 await page.selectOption('#workspace-language','ja');
 assert.match(await page.locator('.readonly-flag').innerText(),/読取り専用/);
 await page.selectOption('#workspace-language','en-US');
 assert.match(await page.locator('.readonly-flag').innerText(),/Read-only/);
 await page.locator('#records input[type="checkbox"]').first().check();
 await page.selectOption('#time-mode','custom');
 await page.locator('#custom-time').fill('2026-11-01T01:30');
 await page.locator('#custom-time').dispatchEvent('change');
 assert.match(await page.locator('#preview').innerText(),/Invalid local time/);
 await page.locator('#stage-preview').click();
 assert.equal(await page.locator('#draft-plan .draft-plan-item').count(),0);
 await page.locator('#custom-time').fill('2026-11-01T03:30');
 await page.locator('#custom-time').dispatchEvent('change');
 await page.locator('#stage-preview').click();
 await page.locator('#draft-plan .draft-plan-item').first().waitFor();
 await page.locator('#undo-plan').click();
 assert.equal(await page.locator('#redo-plan').isEnabled(),true);
 await page.locator('#redo-plan').click();
 await page.locator('#clear-plan').click();
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('#download-backup').isVisible(),true);
 await page.locator('#open-again').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'open-again');
 assert.equal(await page.locator('#open-again').isEnabled(),true);
 const [chooser]=await Promise.all([page.waitForEvent('filechooser',{timeout:8000}),page.locator('#open-again').press('Enter')]);
 assert.equal(chooser.isMultiple(),false);
 assert.equal(await page.locator('#export-edited').count(),0);
 assert.deepEqual(errors,[]);
 console.log('05 QR Round2 Chromium PASS: stale A backup/preflight, B original bytes, duplicate click, DST, JA/EN, Undo/Redo, mobile/keyboard');
}finally{if(browser)await browser.close();server.kill();}
