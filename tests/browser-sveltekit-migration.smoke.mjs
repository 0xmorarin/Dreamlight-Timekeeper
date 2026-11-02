// Native Playwright Chromium on new SvelteKit route; bytes never leave loopback.
// Synthetic P1G only. 05 QR independent Writer acceptance remains separate.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
const port=listener.address().port;listener.close();await once(listener,'close');
const base='http://127.0.0.1:'+port+'/Dreamlight-Timekeeper/';
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{
 cwd:process.cwd(),env:{...process.env,BASE_PATH:'/Dreamlight-Timekeeper'},stdio:'ignore'
});
const temp=await mkdtemp(join(tmpdir(),'timekeeper-svelte-'));
let browser;
try{
 let started=false;
 for(let n=0;n<120;n++){
  try{if((await fetch(base)).ok){started=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 assert(started,'SvelteKit preview base path unavailable');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900},timezoneId:'UTC'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const profile={
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:'SvelteKit Fixture'},
  World:{RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000021,
   NextOccurrence:'2126-08-20T00:00:00Z',LastOccurrence:'2024-01-01T00:00:00Z'}}},
   Other:{marker:['keep',{largeText:'9007199254740993'},false]}}
 };
 const original=Buffer.from(makeSyntheticP1gProfile(profile));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByText('Dreamlight Timekeeper').first().waitFor();
 assert.equal(await page.locator('#tk-language option').count(),8);
 assert.equal(await page.locator('#tk-save-file').count(),1);
 await page.locator('#tk-language').selectOption('ja');
 assert.equal(await page.locator('html').getAttribute('lang'),'ja');
 await page.reload();
 assert.equal(await page.locator('#tk-language').inputValue(),'ja','manual locale persisted');
 await page.locator('#tk-language').selectOption('en');
 await page.locator('#tk-save-file').setInputFiles({name:'synthetic.p1g',mimeType:'application/octet-stream',buffer:original});
 await page.getByText('SvelteKit Fixture').waitFor({timeout:25000});
 assert.equal(await page.locator('.tabs button').count(),4,'four tabs');
 assert.equal(await page.locator('.event-row').count(),1);
 assert.equal(await page.locator('button').filter({hasText:'Original backup'}).count(),1);
 const originalDownload=page.waitForEvent('download');
 await page.getByRole('button',{name:'Original backup'}).click();
 const first=await originalDownload;
 assert.equal(first.suggestedFilename(),'original_synthetic.p1g');
 const out=join(temp,'original.p1g');await first.saveAs(out);
 assert.deepEqual(await readFile(out),original);
 assert.equal(await page.locator('.verified-pair').isHidden(),true);
 await page.locator('.event-row input[type=checkbox]').first().check();
 await page.locator('#tk-time-mode').selectOption('custom');
 await page.locator('#tk-custom-time').fill('2026-11-02T10:15');
 await page.getByRole('button',{name:'Stage preview'}).click();
 await page.getByText('staged').first().waitFor();
 await page.locator('.write-controls input[type=checkbox]').check();
 const prepare=page.getByRole('button',{name:'Prepare verified edited P1G'});
 await prepare.waitFor({state:'visible'});
 await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Prepare verified edited P1G'))?.disabled,{timeout:15000});
 await prepare.click();
 await page.locator('.verified-pair').waitFor({state:'visible',timeout:30000});
 const downloads=[];
 page.on('download',d=>downloads.push(d));
 await page.getByRole('button',{name:'Request original, then edited copy'}).click();
 await page.waitForFunction(()=>document.querySelector('.verified-pair')?.textContent?.includes('Requested'),{timeout:10000});
 await page.waitForTimeout(300);
 assert(downloads.length>=1,'original must be requested first');
 assert.equal(downloads[0].suggestedFilename(),'original_synthetic.p1g');
 let edited=downloads.find(d=>d.suggestedFilename()==='edited_synthetic.p1g');
 if(!edited){const next=page.waitForEvent('download');await page.getByRole('button',{name:'Retry edited copy'}).click();edited=await next;}
 const editedPath=join(temp,'edited.p1g');await edited.saveAs(editedPath);
 const changed=parseSafeJson((await p1gPackagedProfileCodec.loadProfile(await readFile(editedPath))).jsonText);
 assert.deepEqual(diffPaths(profile,changed),['/World/RecurringEvents/0/ItemSpawning/NextOccurrence']);
 assert.equal(changed.World.RecurringEvents['0'].ItemSpawning.NextOccurrence,'2026-11-02T10:15:00.000Z');
 assert.deepEqual(changed.World.Other,profile.World.Other);
 await page.getByRole('button',{name:'Undo'}).click();
 assert.equal(await page.locator('.verified-pair').isHidden(),true);
 await page.setViewportSize({width:320,height:720});
 assert.equal(await page.locator('.tabs button').count(),4);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+3);
 assert.equal(overflow,false,'mobile horizontal overflow');
 await page.reload();
 assert.equal(await page.locator('#tk-language option').count(),8);
 assert.deepEqual(errors,[]);
 console.log('SVELTEKIT MIGRATION CHROMIUM PASS: base-path, locale8/manual, real Worker original byte exact, encrypted edited P1G independent reopen, undo stale, 4 tabs 320px');
}finally{await browser?.close();server.kill();await rm(temp,{recursive:true,force:true});}
