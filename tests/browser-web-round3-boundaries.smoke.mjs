import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from './fixture.mjs';

const target=process.env.TIMEKEEPER_ROUND3_TARGET;
assert(target,'TIMEKEEPER_ROUND3_TARGET must point to fixed integration checkout.');
const root=fileURLToPath(new URL('../',import.meta.url));
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;probe.close();await once(probe,'close');
const url='http://127.0.0.1:'+port+'/';
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:target,stdio:'ignore'});
const folder=await mkdtemp(join(tmpdir(),'timekeeper-round3-'));
const profile=(name,date)=>JSON.stringify({GameInfo:{Version:626},Player:{Name:name},World:{RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:date}}}}});
const a=profile('A','2126-08-20T00:00:00Z'),b=profile('B','2026-10-01T00:00:00Z'),c=profile('C','2025-10-01T00:00:00Z');
let browser;
try{
 let ready=false;
 for(let i=0;i<80;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,125));}
 assert(ready,'Pinned PR11 target server did not start.');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'America/New_York',acceptDownloads:true});
 const page=await context.newPage(),errors=[],downloads=[];
 page.on('pageerror',err=>errors.push(err.message));
 page.on('download',download=>downloads.push(download));
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;window.__NativeWorker=NativeWorker;
  window.__held=[];window.__ops=[];window.__lastWorker=null;
  window.__deliver=(index,observed)=>{
   const entry=window.__held.splice(index,1)[0];
   if(!entry)throw new Error('No held Worker response at '+index);
   const data=entry.event.data;
   if(observed!==undefined&&data.type==='preflight')
    entry.owner.onmessage?.({data:{...data,report:{...data.report,summary:{...data.report.summary,structuralShapeObserved:observed}}}});
   else entry.owner.onmessage?.(entry.event);
  };
  window.Worker=class {
   constructor(...args){
    this.inner=new NativeWorker(...args);window.__lastWorker=this;
    this.onmessage=null;this.onerror=null;this.onmessageerror=null;
    this.inner.onmessage=event=>{
     const data=event.data;
     if(data?.ok&&['preflight','backup'].includes(data.type)){
      window.__held.push({owner:this,event});return;
     }
     if(data?.ok&&data.type==='opened'&&data.view?.identity?.name==='B'){
      window.__held.push({owner:this,event});return;
     }
     this.onmessage?.(event);
    };
    this.inner.onerror=event=>this.onerror?.(event);
    this.inner.onmessageerror=event=>this.onmessageerror?.(event);
   }
   postMessage(...args){window.__ops.push({type:args[0]?.type,sessionId:args[0]?.sessionId});return this.inner.postMessage(...args);}
   terminate(){this.inner.terminate();}
  };
 });
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true,{timeout:20000});
 const open=async(name,buffer)=>page.locator('#save-file').setInputFiles({
  name,mimeType:name.endsWith('.json')?'application/json':'application/octet-stream',buffer:Buffer.from(buffer)});
 const held=type=>page.evaluate(type=>window.__held.filter(x=>x.event.data.type===type).length,type);
 const deliver=async(type,sessionId,observed)=>{
  await page.evaluate(({type,sessionId,observed})=>{
   const idx=window.__held.findIndex(x=>x.event.data.type===type&&(sessionId===undefined||x.event.data.sessionId===sessionId));
   if(idx<0)throw Error('missing held '+type+' session '+sessionId);
   window.__deliver(idx,observed);
  },{type,sessionId,observed});
 };
 await open('a.json',a);
 await page.locator('#session-name').getByText('A',{exact:true}).waitFor();
 assert.equal(await page.locator('#tabs button').count(),4);
 await page.locator('#records input[type="checkbox"]').first().check();
 await page.locator('#stage-preview').click();
 await page.waitForFunction(()=>window.__held.some(x=>x.event.data.type==='preflight'));
 // A preflight is held. Undo must invalidate its state; redo starts a newer request.
 await page.locator('#undo-plan').click();
 assert.equal(await page.locator('#redo-plan').isEnabled(),true);
 await page.locator('#redo-plan').click();
 await page.waitForFunction(()=>window.__held.filter(x=>x.event.data.type==='preflight').length===2);
 const firstIds=await page.evaluate(()=>window.__held.filter(x=>x.event.data.type==='preflight').map(x=>x.event.data.id));
 assert(firstIds[0]<firstIds[1]);
 // Deliver latest first, then stale response; stale number must not overwrite latest.
 await page.evaluate(()=>{const idx=window.__held.findIndex(x=>x.event.data.id===window.__held.filter(y=>y.event.data.type==='preflight')[1].event.data.id);window.__deliver(idx,222);});
 await page.locator('#draft-plan').getByText(/222/).waitFor();
 await deliver('preflight',1,111);
 assert.match(await page.locator('#draft-plan').innerText(),/222/);
 assert.doesNotMatch(await page.locator('#draft-plan').innerText(),/111/);
 await page.locator('#download-backup').click();
 await page.waitForFunction(()=>window.__held.some(x=>x.event.data.type==='backup'&&x.event.data.name==='a.json'));
 // Hold B's successful open acknowledgement, then race a C file selection during B loading.
 await open('b.json',b);
 await page.waitForFunction(()=>window.__held.some(x=>x.event.data.type==='opened'&&x.event.data.view.identity.name==='B'));
 await open('c.json',c);
 assert.equal(await page.evaluate(()=>window.__ops.filter(x=>x.type==='open').length),2,'File C while B is loading must not race the Worker');
 await deliver('opened');
 await page.locator('#session-name').getByText('B',{exact:true}).waitFor();
 assert.equal(await page.locator('#undo-plan').isEnabled(),false);
 await page.locator('#records input[type="checkbox"]').first().check();
 await page.locator('#stage-preview').click();
 await page.waitForFunction(()=>window.__held.some(x=>x.event.data.type==='preflight'&&x.event.data.sessionId===2));
 await page.locator('#download-backup').click();
 await page.waitForFunction(()=>window.__held.some(x=>x.event.data.type==='backup'&&x.event.data.name==='b.json'));
 // As soon as B commits, select C again. Old preflight and backups arrive after C.
 await open('c.json',c);
 await page.locator('#session-name').getByText('C',{exact:true}).waitFor();
 assert.equal(await page.locator('#undo-plan').isEnabled(),false);
 await deliver('backup',2);
 await deliver('preflight',2,333);
 await deliver('backup',1);
 assert.equal(downloads.length,0,'A/B responses must never download after C is active.');
 assert.equal(await page.locator('#undo-plan').isEnabled(),false);
 assert.doesNotMatch(await page.locator('#draft-plan').innerText(),/333/);
 assert.equal(await page.evaluate(()=>window.__ops.filter(x=>x.type==='open').length),3);

 // Rejected malformed file and strict >128 MiB file cannot destroy C's original.
 await open('broken.json','{');
 await page.locator('#workspace-status').getByText(/Unable to open|読み込み失敗|invalid/i).waitFor({timeout:20000});
 assert.equal(await page.locator('#session-name').innerText(),'C');
 // Round 5: strict JSON rejects unsafe integral precision even when encoded as decimal/exponent.
 // These are synthetic source defects, not a user-save rewrite or Worker capability grant.
 for(const [index,literal] of ['9007199254740993.0','9.007199254740993e15'].entries()){
  const source=profile('Unsafe','2026-10-01T00:00:00Z')
   .replace('"Name":"Unsafe"',`"Name":"Unsafe","UnsafeNumeric":${literal}`);
  await open('unsafe-numeric-'+index+'.json',source);
  await page.locator('#workspace-status').getByText(/Unsafe JSON integer/i).waitFor({timeout:20000});
  assert.equal(await page.locator('#session-name').innerText(),'C',
   'Strict JSON rejection must preserve the prior active backup session.');
 }
 const tooLargePath=join(folder,'oversized.json');
 await writeFile(tooLargePath,Buffer.alloc(128*1024*1024+1,0x41));
 await page.locator('#save-file').setInputFiles(tooLargePath);
 await page.locator('#workspace-status').getByText(/Unable to open|読み込み失敗|128MiB/i).waitFor({timeout:45000});
 assert.equal(await page.locator('#session-name').innerText(),'C');
 assert.equal(await page.locator('#download-backup').isEnabled(),true);
 assert.equal(await page.locator('#tabs button').count(),4);

 // A separate never-opened native Worker represents a closed/uninitialized session.
 const closed=await page.evaluate(async()=>{
  const w=new window.__NativeWorker('./src/worker.mjs',{type:'module'}),received=[];
  try{
   const responses=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('closed session response timeout')),15000);
    w.onmessage=e=>{received.push(e.data);if(received.length===2){clearTimeout(timeout);resolve(received)}};
    w.onerror=e=>{clearTimeout(timeout);reject(Error('worker error '+e.message))};
    w.postMessage({id:201,type:'backup',sessionId:1});
    w.postMessage({id:202,type:'preflight',sessionId:1,entries:[]});
   });
   return responses.map(x=>({ok:x.ok,error:x.error,id:x.id}));
  }finally{w.terminate();}
 });
 assert.deepEqual(closed.map(x=>x.ok),[false,false]);
 assert(closed.every(x=>/session|セーブ/.test(x.error)));
 const dl=page.waitForEvent('download');
 await page.locator('#download-backup').click();
 await page.waitForFunction(()=>window.__held.some(x=>x.event.data.type==='backup'&&x.event.data.name==='c.json'));
 await deliver('backup',3);
 const original=await dl,originalPath=join(folder,'original-c.json');
 await original.saveAs(originalPath);
 assert.equal(await readFile(originalPath,'utf8'),c);
 assert.equal(downloads.length,1);

 // Synthetic P1G original preservation after previous JSON failures. No P1G editing is attempted.
 const packaged=new Uint8Array(makeSyntheticP1gProfile({GameInfo:{InitialVersion:518,Version:626,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},
  Created:'2025-01-01T00:00:00Z',Modified:'2026-11-01T00:00:00Z'},
  Player:{Name:'P1G'},World:{RecurringEvents:{'0':{FlowerSpawningInVillage:{
   RecurringEventItemID:2010500008,NextOccurrence:'2126-08-20T00:00:00Z'}}}}}));
 await open('fixture.p1g',packaged);
 await page.locator('#session-name').getByText('P1G',{exact:true}).waitFor({timeout:20000});
 const dlP1g=page.waitForEvent('download');
 await page.locator('#download-backup').click();
 await page.waitForFunction(()=>window.__held.some(x=>x.event.data.type==='backup'&&x.event.data.name==='fixture.p1g'));
 await deliver('backup',4);
 const p1g=await dlP1g,p1gPath=join(folder,'original-p1g');
 await p1g.saveAs(p1gPath);
 assert.deepEqual(await readFile(p1gPath),Buffer.from(packaged));
 assert.equal(await page.locator('#export-edited').count(),0);
 assert.deepEqual(errors,[],'Page JS exception list');
 console.log('ROUND3 pinned PR11 Chromium PASS: A→B→C, reordered preflight/backup, Undo/Redo, invalid+128MiB recovery, closed Worker, exact JSON/P1G originals.');
}finally{if(browser)await browser.close();server.kill();await rm(folder,{recursive:true,force:true});}
