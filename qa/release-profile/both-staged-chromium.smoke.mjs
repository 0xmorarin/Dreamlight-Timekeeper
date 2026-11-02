// 05 QR independent actual Chromium on TWO isolated release roots, new RC staging changes only.
// No prior Worker test suite rerun. Synthetic schema626 encrypted P1G only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {stageReleaseAssetProfile} from '../scripts/stage-release-asset-profile.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base=new URL('../',import.meta.url).pathname;
const tmp=await mkdtemp(join(tmpdir(),'qa-release-both-chrome-'));
const data={GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{Name:'Release QA'},World:{RecurringEvents:{
 '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z',
  LastOccurrence:'2024-01-01T00:00:00Z'}}},Other:{keep:[1,false,'note']}}};
const original=Buffer.from(makeSyntheticP1gProfile(data));
let browser;
async function testProfile(profileName,root){
 const serverProbe=createServer();serverProbe.listen(0,'127.0.0.1');await once(serverProbe,'listening');
 const port=serverProbe.address().port;serverProbe.close();await once(serverProbe,'close');
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 const url='http://127.0.0.1:'+port+'/';
 let page;
 try{
  let ready=false;
  for(let i=0;i<80;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,125));}
  assert(ready,'Isolated candidate preview unavailable: '+profileName);
  page=await browser.newPage({acceptDownloads:true,viewport:{width:1280,height:900},timezoneId:'UTC'});
  const errors=[],gameRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/assets\/steam\/.*\.webp(?:\?|$)/.test(r.url()))gameRequests.push(r.url());});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:20000});
  assert.equal(await page.locator('#welcome .release-notice [lang="en"]').isVisible(),true);
  assert.equal(await page.locator('#welcome .release-notice [lang="ja"]').isVisible(),true);
  const manifest=await page.evaluate(async()=>{
   const r=await fetch('./data/steam-ui-icons-v1253.json');
   if(!r.ok)throw new Error('HTTP runtime manifest unavailable');return r.json();
  });
  const expected=profileName==='owner_svg_text_only'?0:4;
  assert.equal(Object.keys(manifest.icons).length,expected);
  assert.equal(manifest.source.status,expected===0?'NO_ASSETS_VERIFIED':'VERIFIED_ASSETS');
  await page.locator('#save-file').setInputFiles({name:'release-qa.p1g',mimeType:'application/octet-stream',buffer:original});
  await page.locator('#session-name').getByText('Release QA').waitFor({timeout:20000});
  assert.equal(await page.locator('#tabs button').count(),4,profileName+' tabs');
  assert.equal(await page.locator('#download-backup').isEnabled(),true);
  assert.equal(await page.locator('#prepare-edited').isDisabled(),true);
  await page.locator('#records input[type=checkbox]').first().check();
  await page.locator('#time-mode').selectOption('custom');
  await page.locator('#custom-time').fill('2026-11-02T10:15');
  await page.locator('#custom-time').dispatchEvent('change');
  await page.locator('#stage-preview').click();
  assert.equal(await page.locator('#prepare-edited').isDisabled(),true,'Switch BID not confirmed');
  await page.locator('#confirm-switch-build').check();
  await page.waitForFunction(()=>!document.querySelector('#prepare-edited').disabled,{timeout:20000});
  await page.locator('#prepare-edited').click();
  await page.locator('#verified-pair-downloads').waitFor({state:'visible',timeout:30000});
  assert.equal(await page.locator('#retry-verified-edited').isDisabled(),true,'no pre-original edited download');
  const downloaded=[];
  page.on('download',d=>downloaded.push(d));
  await page.locator('#download-verified-both').click();
  await page.waitForFunction(()=>document.querySelector('#verified-pair-status')?.textContent?.includes('save unconfirmed'),{timeout:15000});
  await page.waitForTimeout(350);
  assert(downloaded.length>=1,'original downloaded');
  assert.equal(downloaded[0].suggestedFilename(),'original_release-qa.p1g');
  const first=join(tmp,profileName+'-original.p1g');await downloaded[0].saveAs(first);
  assert.deepEqual(await readFile(first),original);
  let edited=downloaded.find(d=>d.suggestedFilename()==='edited_release-qa.p1g');
  if(!edited){const pending=page.waitForEvent('download');await page.locator('#retry-verified-edited').click();edited=await pending;}
  const editedPath=join(tmp,profileName+'-edited.p1g');await edited.saveAs(editedPath);
  const bytes=await readFile(editedPath);
  assert.notEqual(sha(bytes),sha(original));
  const reopened=parseSafeJson((await p1gPackagedProfileCodec.loadProfile(bytes)).jsonText);
  assert.deepEqual(diffPaths(data,reopened),['/World/RecurringEvents/0/ItemSpawning/NextOccurrence']);
  assert.equal(reopened.World.RecurringEvents['0'].ItemSpawning.NextOccurrence,'2026-11-02T10:15:00.000Z');
  assert.deepEqual(reopened.World.Other,data.World.Other);
  const p=page.waitForEvent('download');await page.locator('#retry-verified-original').click();
  const retry=await p;assert.equal(retry.suggestedFilename(),'original_release-qa.p1g');
  const retryPath=join(tmp,profileName+'-retry.p1g');await retry.saveAs(retryPath);
  assert.equal(sha(await readFile(retryPath)),sha(original));
  await page.locator('#undo-plan').click();
  assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
  await page.locator('#redo-plan').click();
  assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
  if(expected===0)assert.deepEqual(gameRequests,[],'No game raster requested from SVG profile');
  assert.deepEqual(errors,[]);
  console.log('QA PROFILE ACTUAL CHROMIUM PASS '+profileName+': '+expected+' game WebP, 16 SVG, 4 tabs, source-first distinct downloads/retry and independently reopened one-pointer edited P1G');
 }finally{if(page)await page.close();server.kill();}
}
try{
 const roots=[['current_repo_game_ui',join(tmp,'with-game')],['owner_svg_text_only',join(tmp,'svg-text')]];
 for(const [profile,outputRoot] of roots)await stageReleaseAssetProfile({profile,outputRoot});
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [profile,outputRoot] of roots)await testProfile(profile,outputRoot);
}finally{if(browser)await browser.close();await rm(tmp,{recursive:true,force:true});}
