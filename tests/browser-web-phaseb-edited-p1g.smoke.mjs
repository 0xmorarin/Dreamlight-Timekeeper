// Real Chromium production UI+Worker → TIME→CORE encrypted P1G encode/reopen.
// Input is strictly synthetic. No private save or release-grade device claim.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;probe.close();await once(probe,'close');
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const url='http://127.0.0.1:'+port+'/';
const folder=await mkdtemp(join(tmpdir(),'timekeeper-real-p1g-'));
const old='2126-08-20T00:00:00Z',newTime='2026-11-02T10:15:00.000Z';
const profile=(name='Test')=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{Name:name},
 World:{RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000021,
 NextOccurrence:old,LastOccurrence:'2024-01-01T00:00:00Z'}}},
 Other:{keep:['Ñ',{numericText:'9007199254740993'},false]}}
});
const originalProfile=profile();
const bytes=makeSyntheticP1gProfile(originalProfile);
let browser;
try{
 let started=false;
 for(let i=0;i<80;i++){try{if((await fetch(url)).ok){started=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,125));}
 assert(started,'Local static server did not start');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900},timezoneId:'UTC'});
 const page=await context.newPage(),downloads=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('download',d=>downloads.push(d));
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;
  window.__holdNextPrepared=false;window.__heldPrepared=false;
  window.Worker=class{
   constructor(...args){
    this.inner=new NativeWorker(...args);
    this.onmessage=null;this.onerror=null;this.onmessageerror=null;
    this.inner.onmessage=e=>{
     if(e.data?.type==='preparedEdited'&&window.__holdNextPrepared){
      window.__holdNextPrepared=false;window.__heldPrepared=true;
      window.__releaseOldPrepared=()=>this.onmessage?.(e);
      return;
     }
     this.onmessage?.(e);
    };
    this.inner.onerror=e=>this.onerror?.(e);
    this.inner.onmessageerror=e=>this.onmessageerror?.(e);
   }
   postMessage(...args){return this.inner.postMessage(...args);}
   terminate(){this.inner.terminate();}
  };
 });
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:20000});
 await page.locator('#save-file').setInputFiles({name:'test-save.p1g',
  mimeType:'application/octet-stream',buffer:Buffer.from(bytes)});
 await page.locator('#workspace').waitFor({state:'visible',timeout:20000});
 await page.locator('#session-name').getByText('Test').waitFor();
 assert.equal(await page.locator('#tabs button').count(),4);
 await page.locator('#prepare-edited-panel').waitFor({state:'visible'});
 assert.equal(await page.locator('#prepare-edited').isDisabled(),true,'Must require a selected plan and explicit BID');
 await page.locator('#records input[type=checkbox]').first().check();
 await page.locator('#time-mode').selectOption('custom');
 await page.locator('#custom-time').fill('2026-11-02T10:15');
 await page.locator('#custom-time').dispatchEvent('change');
 await page.locator('#stage-preview').click();
 await page.locator('#confirm-switch-build').check();
 await page.locator('#prepare-edited').waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('#prepare-edited').disabled,{timeout:20000});
 await page.locator('#prepare-edited').click();
 await page.locator('#verified-pair-downloads').waitFor({state:'visible',timeout:30000});
 assert.equal(await page.locator('#download-verified-both').isEnabled(),true);
 assert.equal(await page.locator('#retry-verified-edited').isDisabled(),true,'Edited retry is prohibited before original request');
 await page.locator('#download-verified-both').click();
 await page.waitForFunction(()=>document.querySelector('#verified-pair-status')?.textContent?.includes('save unconfirmed'),{timeout:15000});
 await page.waitForTimeout(500);
 assert(downloads.length>=1,'At least original requested first');
 assert.equal(downloads[0].suggestedFilename(),'original_test-save.p1g');
 const originalPath=join(folder,'original.p1g');
 await downloads[0].saveAs(originalPath);
 assert.deepEqual(await readFile(originalPath),Buffer.from(bytes),'Original ciphertext must be byte identical');
 let editedFile=downloads.find(d=>d.suggestedFilename()==='edited_test-save.p1g');
 if(!editedFile){
  const event=page.waitForEvent('download');
  await page.locator('#retry-verified-edited').click();editedFile=await event;
 }
 const editedPath=join(folder,'edited.p1g');await editedFile.saveAs(editedPath);
 const editedBytes=await readFile(editedPath);
 assert.notDeepEqual(editedBytes,Buffer.from(bytes),'Real encoded ciphertext must be changed');
 const opened=await p1gPackagedProfileCodec.loadProfile(editedBytes);
 const reopened=parseSafeJson(opened.jsonText);
 assert.deepEqual(diffPaths(originalProfile,reopened),['/World/RecurringEvents/0/ItemSpawning/NextOccurrence']);
 assert.equal(reopened.World.RecurringEvents['0'].ItemSpawning.NextOccurrence,newTime);
 assert.deepEqual(reopened.World.Other,originalProfile.World.Other);
 const retryOriginalEvent=page.waitForEvent('download');
 await page.locator('#retry-verified-original').click();
 const originalAgain=await retryOriginalEvent;
 const retryOriginalPath=join(folder,'original-again.p1g');
 await originalAgain.saveAs(retryOriginalPath);
 assert.deepEqual(await readFile(retryOriginalPath),Buffer.from(bytes));
 // Changing the date controls invalidates both prepared outputs.
 await page.locator('#custom-time').fill('2026-11-03T10:15');
 await page.locator('#custom-time').dispatchEvent('change');
 assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
 // Plan change invalidates both prepared outputs as well.
 await page.locator('#undo-plan').click();
 assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
 assert.equal(await page.locator('#download-verified-both').isDisabled(),true);
 await page.locator('#redo-plan').click();
 await page.waitForFunction(()=>!document.querySelector('#prepare-edited').disabled,{timeout:20000});
 // After a new verified pair response is withheld, a new file supersedes it.
 await page.evaluate(()=>window.__holdNextPrepared=true);
 await page.locator('#prepare-edited').click();
 await page.waitForFunction(()=>window.__heldPrepared===true,{timeout:30000});
 const next=makeSyntheticP1gProfile(profile('Other'));
 await page.locator('#save-file').setInputFiles({name:'other.p1g',
  mimeType:'application/octet-stream',buffer:Buffer.from(next)});
 await page.locator('#session-name').getByText('Other').waitFor({timeout:20000});
 await page.evaluate(()=>window.__releaseOldPrepared());
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true,
  'Stale Worker encoded output must not be exposed after file switch');
 assert.equal(await page.locator('#download-verified-both').isDisabled(),true);
 // JSON remains strictly read-only; no edited pair on a non-P1G source.
 await page.locator('#save-file').setInputFiles({name:'profile.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(profile('JSON source')))});
 await page.locator('#session-name').getByText('JSON source').waitFor({timeout:20000});
 assert.equal(await page.locator('#prepare-edited-panel').isHidden(),true);
 assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
 assert.deepEqual(errors,[]);
 console.log('WEB PHASE B ACTUAL CHROMIUM PASS: synthetic encrypted P1G Worker TIME+CORE Encode/Reopen, exact bytes original, one-pointer edited diff, separate downloads/retry, stale Worker rejection, JSON denial');
}finally{if(browser)await browser.close();server.kill();await rm(folder,{recursive:true,force:true});}
