// 05 QR: actual product UI + real Worker independent Chromium acceptance on immutable PR11 SHA.
// Synthetic encrypted schema626 P1G ONLY. Never writes actual saves or claims Switch runtime PASS.
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
import {createHash,createDecipheriv,createCipheriv} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;probe.close();await once(probe,'close');
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const baseUrl='http://127.0.0.1:'+port+'/';
const work=await mkdtemp(join(tmpdir(),'qr-w1-product-'));
const OLD='2126-08-20T00:00:00Z',NEW='2026-11-02T10:15:00.000Z';
const HASH=b=>createHash('sha256').update(b).digest('hex');
const entries=[
 ['0','ItemSpawning',2010000021],
 ['1','FlowerSpawningInVillage',2010500008],
 ['2','ItemSpawning',2010000064],
 ['3','ItemSpawning',2010000093],
 ['4','SnippetSpawning',2011300000],
 ['5','FishSpawningInVillage',2010200014],
 ['6','ItemSpawning',999999999]
];
const profile=(name='QA Profile',schema=626)=>{
 const recurring=Object.fromEntries(entries.map(([slot,kind,id])=>[slot,{
  [kind]:{RecurringEventItemID:id,NextOccurrence:OLD,extra:{strings:['abc',null,'☁'],source:'keep'}}}]));
 return {GameInfo:{Version:schema,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{Name:name},World:{RecurringEvents:recurring,Opaque:{items:[1,2,{untouched:true}],key:'9007199254740993'}}};
};
const initial=profile(),source=Buffer.from(makeSyntheticP1gProfile(initial));
const zipKey=Buffer.from('62357168683873614a38556c444a557a545a5864325467366d626f3857386e35','hex');
function addPhysicalArchiveComment(input){
 const dc=createDecipheriv('aes-256-ecb',zipKey,null);
 const zip=Buffer.concat([dc.update(input),dc.final()]);
 const trailer=Buffer.from([1,2,3,4]);
 const out=Buffer.concat([zip,trailer]);out.writeUInt16LE(trailer.length,zip.length-22+20);
 const en=createCipheriv('aes-256-ecb',zipKey,null);
 return Buffer.concat([en.update(out),en.final()]);
}
let browser;
try{
 let started=false;
 for(let i=0;i<80;i++){try{if((await fetch(baseUrl)).ok){started=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,125));}
 assert(started,'local synthetic-only test server missing');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900},timezoneId:'UTC'});
 const page=await ctx.newPage(),downloaded=[],errors=[];
 page.on('download',d=>downloaded.push(d));
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const BaseWorker=window.Worker;
  window.__qrTraffic=[];
  window.__qrHold=false;window.__qrHeld=false;
  window.Worker=class{
   constructor(...args){
    this.inner=new BaseWorker(...args);this.onmessage=null;this.onerror=null;this.onmessageerror=null;
    this.inner.onmessage=e=>{
     window.__qrTraffic.push({direction:'in',type:e.data?.type,ok:e.data?.ok,
      planRevision:e.data?.planRevision,sessionId:e.data?.sessionId,
      receiptStatus:e.data?.receipt?.status});
     if(e.data?.type==='preparedEdited'&&window.__qrHold){
      window.__qrHeld=true;window.__qrHold=false;window.__qrDeliverHeld=()=>this.onmessage?.(e);
      return;
     }
     this.onmessage?.(e);
    };
    this.inner.onerror=e=>this.onerror?.(e);
    this.inner.onmessageerror=e=>this.onmessageerror?.(e);
   }
   postMessage(data,...rest){
    window.__qrTraffic.push({direction:'out',type:data?.type,id:data?.id,
     planRevision:data?.planRevision,sessionId:data?.sessionId,
     entries:data?.entries?.map(x=>({pointer:x.pointer,eventId:x.eventId,kind:x.kind,originalTime:x.originalTime,targetTime:x.targetTime})),
     providedReview:Object.hasOwn(data,'w1TargetReview'),providedRegistry:Object.hasOwn(data,'eventRegistry'),
     providedSourceHash:Object.hasOwn(data,'expectedSourceSha256')});
    return this.inner.postMessage(data,...rest);
   }
   terminate(){this.inner.terminate();}
  };
 });
 await page.goto(baseUrl,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__dreamlightBooted===true);
 assert.equal(await page.locator('#tabs button').count(),4);
 assert.equal(await page.locator('#prepare-edited-panel').isHidden(),true);
 await page.locator('#save-file').setInputFiles({name:'qa-first.p1g',mimeType:'application/octet-stream',buffer:source});
 await page.locator('#session-name').getByText('QA Profile').waitFor({timeout:20000});
 assert.equal(await page.locator('#prepare-edited').isDisabled(),true);
 // Explicit plan and BID confirmation are required; default disabled.
 await page.locator('#records input[type=checkbox]').first().check();
 await page.locator('#time-mode').selectOption('custom');
 await page.locator('#custom-time').fill('2026-11-02T10:15');
 await page.locator('#custom-time').dispatchEvent('change');
 await page.locator('#stage-preview').click();
 assert.equal(await page.locator('#prepare-edited').isDisabled(),true,'explicit BID confirmation required');
 await page.locator('#confirm-switch-build').check();
 await page.waitForFunction(()=>!document.querySelector('#prepare-edited').disabled,{timeout:20000});
 await page.locator('#prepare-edited').click();
 await page.locator('#verified-pair-downloads').waitFor({state:'visible',timeout:30000});
 assert.equal(await page.locator('#retry-verified-edited').isDisabled(),true);
 const traffic=await page.evaluate(()=>window.__qrTraffic);
 const proposal=traffic.find(x=>x.direction==='out'&&x.type==='prepareEdited');
 const prepared=traffic.find(x=>x.direction==='in'&&x.type==='preparedEdited'&&x.ok);
 assert(proposal&&prepared,'real Worker prepareEdited request and response required');
 assert.equal(proposal.providedReview,false,'UI must not supply trusted TIME review');
 assert.equal(proposal.providedRegistry,false,'UI must not supply event registry');
 assert.equal(proposal.providedSourceHash,false,'UI must not supply source sha');
 assert.equal(proposal.entries.length,1);
 assert.equal(prepared.receiptStatus,'WORKER_VERIFIED_PAIR');
 assert.equal(proposal.planRevision,prepared.planRevision);
 // Simulate browser blocking only second automatic download; first must be real bytes.
 await page.evaluate(()=>{
  const click=HTMLAnchorElement.prototype.click;
  window.__qrClicks=[];window.__qrRestoreAnchor=()=>{HTMLAnchorElement.prototype.click=click;};
  HTMLAnchorElement.prototype.click=function(){
   window.__qrClicks.push(this.download);
   if(this.download.startsWith('edited_'))throw Error('QR browser denied second automatic download');
   return click.call(this);
  };
 });
 const downloadEvent=page.waitForEvent('download',{timeout:10000});
 await page.locator('#download-verified-both').click();
 const first=await downloadEvent;
 assert.equal(first.suggestedFilename(),'original_qa-first.p1g');
 const originalOnDisk=join(work,'original.p1g');await first.saveAs(originalOnDisk);
 assert.deepEqual(await readFile(originalOnDisk),source,'downloaded encrypted original must be byte-for-byte');
 const attempts=await page.evaluate(()=>window.__qrClicks);
 assert.deepEqual(attempts,['original_qa-first.p1g','edited_qa-first.p1g']);
 assert.equal(await page.locator('#retry-verified-edited').isEnabled(),true);
 await page.evaluate(()=>window.__qrRestoreAnchor());
 const editEvent=page.waitForEvent('download',{timeout:10000});
 await page.locator('#retry-verified-edited').click();
 const second=await editEvent;
 assert.equal(second.suggestedFilename(),'edited_qa-first.p1g');
 const editedOnDisk=join(work,'edited.p1g');await second.saveAs(editedOnDisk);
 const edited=await readFile(editedOnDisk);
 assert.notDeepEqual(edited,source);
 const reopened=parseSafeJson((await p1gPackagedProfileCodec.loadProfile(edited)).jsonText);
 assert.deepEqual(diffPaths(initial,reopened),['/World/RecurringEvents/0/ItemSpawning/NextOccurrence']);
 assert.equal(reopened.World.RecurringEvents['0'].ItemSpawning.NextOccurrence,NEW);
 assert.deepEqual(reopened.World.Opaque,initial.World.Opaque);
 assert.deepEqual(reopened.World.RecurringEvents['2'],initial.World.RecurringEvents['2']);
 assert.equal(HASH(await readFile(originalOnDisk)),HASH(source));
 const retry=page.waitForEvent('download',{timeout:10000});
 await page.locator('#retry-verified-original').click();
 const retryDownloaded=await retry;assert.equal(retryDownloaded.suggestedFilename(),'original_qa-first.p1g');
 const retryPath=join(work,'retry-original.p1g');await retryDownloaded.saveAs(retryPath);
 assert.deepEqual(await readFile(retryPath),source);
 // Plan change & Undo/Redo invalidate the receipt and disable both triggers.
 await page.locator('#custom-time').fill('2026-11-03T10:15');
 await page.locator('#custom-time').dispatchEvent('change');
 assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
 await page.locator('#undo-plan').click();
 assert.equal(await page.locator('#download-verified-both').isDisabled(),true);
 await page.locator('#redo-plan').click();
 await page.waitForFunction(()=>!document.querySelector('#prepare-edited').disabled,{timeout:20000});
 // Stale prepared response after file switch must be discarded.
 await page.evaluate(()=>window.__qrHold=true);
 await page.locator('#prepare-edited').click();
 await page.waitForFunction(()=>window.__qrHeld,{timeout:30000});
 const fresh=Buffer.from(makeSyntheticP1gProfile(profile('Second Profile')));
 await page.locator('#save-file').setInputFiles({name:'qa-second.p1g',mimeType:'application/octet-stream',buffer:fresh});
 await page.locator('#session-name').getByText('Second Profile').waitFor({timeout:20000});
 await page.evaluate(()=>window.__qrDeliverHeld());
 assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
 assert.equal(await page.locator('#download-verified-both').isDisabled(),true);
 // Raw JSON can be read, but cannot prepare a verified edited P1G.
 await page.locator('#save-file').setInputFiles({name:'read-only.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(profile('JSON Only')))});
 await page.locator('#session-name').getByText('JSON Only').waitFor({timeout:20000});
 assert.equal(await page.locator('#prepare-edited-panel').isHidden(),true);
 assert.equal(await page.locator('#verified-pair-downloads').isHidden(),true);
 assert.deepEqual(errors,[]);
 console.log('QA PRODUCT-WORKER UI CHROMIUM PASS: actual synthetic encrypted P1G, Worker-internal TIME provenance, user-selected W1 change, first-original second-browser-denied individual edited retry, bytes and independent reopen, stale plan/session/JSON refusal');
 // Direct native Worker command negatives on separately created browser Worker;
 // bypasses UI to prove product Worker does NOT trust forged UI-origin review.
 const cases=await page.evaluate(async ({buffer,comment,old})=>{
  const results=[];
  const run=async (input,selectedSchema=626)=>{
   const worker=new Worker('/src/worker.mjs',{type:'module'});
   let n=0;const send=(type,payload={})=>new Promise((resolve,reject)=>{
    const id=++n;const onMessage=e=>{
     if(e.data.id!==id)return;worker.removeEventListener('message',onMessage);
     resolve(e.data);
    };worker.addEventListener('message',onMessage);
    worker.postMessage({id,type,...payload});
   });
   try{
    const opened=await send('open',{buffer:input,name:'direct-worker.p1g'});
    if(!opened.ok)return [{name:'open',ok:false,error:opened.error}];
    const row=opened.view.rows.find(x=>x.id===2010000021);
    const chest=opened.view.rows.find(x=>x.id===2010000064);
    const entry=r=>({pointer:r.pointer,eventId:r.id,kind:r.kind,originalTime:r.time,targetTime:'2127-01-01T00:00:00Z'});
    const allowed=entry(row);
    const ctx={sessionId:opened.sessionId,planRevision:3,entries:[allowed],
     targetBuildId:'9A239D3DB569756D',confirmedSwitchTarget:true,
     w1TargetReview:{status:'STRUCTURAL_W1_TARGETS_ONLY',candidateTargets:[{eventId:2010000021}]},
     eventRegistry:new Map(),expectedSourceSha256:'0'.repeat(64)};
    for(const [label,change] of [
     ['no-confirmation',{confirmedSwitchTarget:false}],
     ['wrong-bid',{targetBuildId:'BAD_BID'}],
     ['stale-session',{sessionId:opened.sessionId+10}],
     ['no-op',{entries:[{...allowed,targetTime:allowed.originalTime}]}],
     ['stale-cas',{entries:[{...allowed,originalTime:'2025-01-01T00:00:00Z'}]}],
     ['invalid-time',{entries:[{...allowed,targetTime:'2026-02-30T00:00:00Z'}]}],
     ['protected-chest',{entries:[entry(chest)]}],
     ['duplicate-plan',{entries:[allowed,allowed]}],
     ['unsafe-pointer',{entries:[{...allowed,pointer:'/World/__proto__/foo'}]}]
    ]){
     const res=await send('prepareEdited',{...ctx,...change});results.push({name:label,ok:res.ok,type:res.type,hasReceipt:!!res.receipt,error:res.error});
    }
    const good=await send('prepareEdited',ctx);
    results.push({name:'forged-authorization-ignored',ok:good.ok,type:good.type,
     receiptStatus:good.receipt?.status,originalByteLength:good.receipt?.original?.buffer?.byteLength,
     editedByteLength:good.receipt?.edited?.buffer?.byteLength});
    return results;
   }finally{worker.terminate();}
  };
  const a=await run(new Uint8Array(buffer));
  const b=await run(new Uint8Array(comment));
  return {valid:a,comment:b};
 },{buffer:Array.from(source),comment:Array.from(addPhysicalArchiveComment(source)),old:OLD});
 for(const row of cases.valid.filter(x=>x.name!=='forged-authorization-ignored')){
  assert.equal(row.ok,false,row.name);assert.equal(row.hasReceipt,false,row.name);
 }
 const positive=cases.valid.find(x=>x.name==='forged-authorization-ignored');
 assert.equal(positive.ok,true,'valid plan must succeed despite forged ignored UI props');
 assert.equal(positive.receiptStatus,'WORKER_VERIFIED_PAIR');
 assert(positive.editedByteLength>0&&positive.originalByteLength>0);
 // Physically present unsupported archive comment may decode for read; Writer must fail.
 if(cases.comment[0]?.name==='open'){
  assert.equal(cases.comment[0].ok,false,'Unreadable archive may not prepare output');
 }else{
  const rejected=cases.comment.find(x=>x.name==='forged-authorization-ignored');
  assert(rejected,'Comment source Worker must be checked');
  assert.equal(rejected.ok,false);
  assert(!rejected.receiptStatus);
 }
 console.log('QA PRODUCT WORKER DIRECT COMMAND NEGATIVES: '+JSON.stringify(cases.valid.map(x=>({name:x.name,ok:x.ok,error:x.error}))));
}finally{
 if(browser)await browser.close();
 server.kill();
 await rm(work,{recursive:true,force:true});
}
