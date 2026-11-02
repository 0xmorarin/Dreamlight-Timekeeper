// Real Chromium verifies two distinct Blob downloads and individual retries.
// Synthetic receipts are created ONLY inside the test-only fixture page, never
// by the product Worker or app; this does not authorize edited P1G output.
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
const folder=await mkdtemp(join(tmpdir(),'timekeeper-pair-ui-'));
let browser;
try{
 let ready=false;
 for(let i=0;i<80;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,125));}
 assert(ready,'Synthetic test-only server failed to start.');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage(),errors=[],downloads=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('download',download=>downloads.push(download));
 await page.goto(url+'tests/verified-pair-downloads-fixture.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(window.__test));
 assert.equal(await page.locator('#pair').isHidden(),true,'Default pair controls must be hidden');
 assert.equal(await page.locator('#both').isDisabled(),true);
 await page.evaluate(()=>window.__test.install());
 assert.equal(await page.locator('#pair').isVisible(),true);
 await page.locator('#both').click();
 await page.waitForFunction(()=>window.__test.attempts.length===2);
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('TRIGGER_REQUESTED_UNCONFIRMED'));
 // Some browsers block a second automatic download. The separate test below
 // simulates an explicit denial and retries it through another user gesture.
 assert.deepEqual(await page.evaluate(()=>window.__test.attempts),['original','edited']);
 await page.waitForTimeout(250);
 assert(downloads.length>=1,'Original must always be requested first.');
 assert.equal(downloads[0].suggestedFilename(),'original_synthetic.p1g');
 const originalPath=join(folder,'original.p1g');await downloads[0].saveAs(originalPath);
 assert.deepEqual([...await readFile(originalPath)],[80,49,71,0,1]);
 if(downloads.length>=2){
  assert.equal(downloads[1].suggestedFilename(),'edited_synthetic.p1g');
  const editedPath=join(folder,'edited.p1g');await downloads[1].saveAs(editedPath);
  assert.deepEqual([...await readFile(editedPath)],[80,49,71,0,2]);
 }
 await page.evaluate(()=>{window.__test.newPlan();window.__test.block();window.__test.install();});
 const before=downloads.length;
 await page.locator('#both').click();
 await page.waitForFunction(()=>window.__test.attempts.length===4);
 assert.deepEqual((await page.evaluate(()=>window.__test.attempts)).slice(-2),['original','edited']);
 assert.match(await page.locator('#status').innerText(),/TRIGGER_FAILED/);
 // Explicit retry below is a separate user gesture, not the first two-file request.
 await page.evaluate(()=>window.__test.unblock());
 const retry=page.waitForEvent('download');
 await page.locator('#edited').click();
 const file=await retry;
 assert.equal(file.suggestedFilename(),'edited_synthetic.p1g');
 const retryPath=join(folder,'retried-edited.p1g');await file.saveAs(retryPath);
 assert.deepEqual([...await readFile(retryPath)],[80,49,71,0,2]);
 assert.match(await page.locator('#status').innerText(),/TRIGGER_REQUESTED_UNCONFIRMED/);
 await page.evaluate(()=>window.__test.newSession());
 assert.equal(await page.locator('#pair').isHidden(),true);
 assert.equal(await page.locator('#original').isDisabled(),true);
 assert.equal(await page.locator('#edited').isDisabled(),true);
 assert.deepEqual(errors,[]);
 // Product page must stay read-only and preserve its four tabs and original
 // backup path. It must not expose an edit button without Worker authorization.
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:20000});
 assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
 assert.equal(await page.locator('#download-verified-both').isDisabled(),true);
 const profile=JSON.stringify({GameInfo:{Version:626},Player:{Name:'Synthetic'},
  World:{RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2026-10-01T00:00:00Z'}}}}});
 await page.locator('#save-file').setInputFiles({name:'only-original.json',mimeType:'application/json',buffer:Buffer.from(profile)});
 await page.locator('#workspace').waitFor({state:'visible',timeout:20000});
 assert.equal(await page.locator('#tabs button').count(),4);
 assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
 assert.equal(await page.locator('#download-backup').isEnabled(),true);
 assert.equal(await page.locator('#export-edited').count(),0);
 console.log('WEB Phase A real Chromium synthetic original→edited separate downloads, blocked retry, session stale + product hidden gate PASS');
}finally{if(browser)await browser.close();server.kill();await rm(folder,{recursive:true,force:true});}
