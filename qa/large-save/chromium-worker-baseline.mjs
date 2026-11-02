// 05 QR isolated pre-Rust performance baseline. Actual unmodified production App + dedicated Worker.
// Synthetic only. This diagnostic reports failures/limits; it is NOT a release gate PASS.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from '../../tests/fixture.mjs';
import {p1gPackagedProfileCodec} from '../../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson} from '../../src/core/safe-edit-session.mjs';

const cases={
  '16':{mib:16,grid:1000,entropy:0.08},
  '64':{mib:64,grid:5000,entropy:0.30},
  '100':{mib:100,grid:12000,entropy:0.54},
  '200':{mib:200,grid:16000,entropy:0.30},
  'gridcap':{mib:null,grid:221000,entropy:0}
};
const scenario=process.env.DDV_QA_CASE||'16';
if(!Object.hasOwn(cases,scenario))throw new Error('Unknown QA scenario');
const spec=cases[scenario];
const MiB=1024*1024;
const hash=b=>createHash('sha256').update(b).digest('hex');
function pseudoAscii(length){
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const b=Buffer.allocUnsafe(length);let x=0x9a239d3d;
  for(let i=0;i<length;i++){
    x^=x<<13;x^=x>>>17;x^=x<<5;
    b[i]=chars.charCodeAt(x&63);
  }
  return b.toString('ascii');
}
function profileFixture(){
  const objects=[];
  for(let i=0;i<spec.grid;i++){
    const obj={ID:i+1,ItemID:31700014,X:i%128,Y:Math.floor(i/128),Orientation:i%4};
    if(i%256===0)obj.State={TreeAndBushData:{EndOfGrowth:'2027-01-01T00:00:00Z'}};
    objects.push(obj);
  }
  const root={
    GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
    Player:{Name:'QR synthetic '+scenario},
    World:{
      RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000021,
        NextOccurrence:'2126-08-20T00:00:00Z',LastOccurrence:'2024-01-01T00:00:00Z'}}},
      GridCollection:{Grids:{'0':{Objects:objects}}},
      Other:{preserve:[null,false,'Ñ',{numberAsString:'9007199254740993'}]},
      UnknownOpaque:{objectVersion:424242,extraOneof:{next:'unaltered'},pad:''}
    }
  };
  let fixed=Buffer.byteLength(JSON.stringify(root),'utf8');
  if(spec.mib!==null){
    const pad=spec.mib*MiB-fixed;
    if(pad<=0)throw Error('Fixture grid exceeds target profile MiB');
    const entropy=Math.floor(pad*spec.entropy);
    root.World.UnknownOpaque.pad='W'.repeat(pad-entropy)+pseudoAscii(entropy);
  }
  const expanded=Buffer.byteLength(JSON.stringify(root),'utf8');
  if(spec.mib!==null)assert.equal(expanded,spec.mib*MiB,'Exact expanded bytes');
  const encrypted=makeSyntheticP1gProfile(root);
  return {root,encrypted,expanded,compressed:encrypted.byteLength,sourceSha256:hash(encrypted)};
}
const report={
  evidence:'CHROMIUM_PRODUCT_WORKER_SYNTHETIC_BASELINE_ONLY',
  benchmarkCase:scenario,
  sourceHead:'393222e7832461ef5fea847b6fff475fedc45017',
  sampleClass:'SYNTHETIC_SCHEMA626_NO_PRIVATE_SAVE',
  gridObjectCount:spec.grid,
  entropyFraction:spec.entropy,
  maxProfileBytes:128*MiB,
  maxEncryptedInputBytes:128*MiB,
  maxGridScanNodes:220000,
  browserWorkerHeapMethod:'UNAVAILABLE_UNLESS_EXPOSED_BY_RUNTIME',
  browserProcessMemoryMethod:'sum RSS of chromium-named processes; shared pages double-counted; sampled not exact peak',
  verdict:'MEASUREMENT_INCOMPLETE',
  phases:{},
  errors:[]
};
let server,browser,interval,folder,page,context,cdp,workerRef;
const t0=performance.now();
function processMemory(){
  const m=process.memoryUsage();
  let chromeRss=0,chromeProcesses=0;
  try{
    const stdout=execFileSync('ps',['-eo','rss=,comm='],{encoding:'utf8',timeout:1500});
    for(const line of stdout.trim().split('\n')){
      const match=line.trim().match(/^(\d+)\s+(\S+)$/);
      if(match&&/(chromium|chrome|headless)/i.test(match[2])){
        chromeRss+=Number(match[1])*1024;chromeProcesses++;
      }
    }
  }catch{}
  return {nodeRss:m.rss,nodeHeapUsed:m.heapUsed,nodeExternal:m.external,
    chromiumRssSum:chromeRss,chromiumProcessCount:chromeProcesses};
}
const maxima={nodeRss:0,nodeHeapUsed:0,nodeExternal:0,chromiumRssSum:0,chromiumProcessCount:0};
function sample(){
  const m=processMemory();
  for(const [k,v] of Object.entries(m))maxima[k]=Math.max(maxima[k],v);
  return m;
}
async function getBrowserMetrics(){
  const res={};
  if(page&&!page.isClosed()){
    try{
      res.ui=await page.evaluate(()=>({
        maxRafGapMs:window.__qa?.maxRafGapMs??null,
        frameCount:window.__qa?.frames??null,
        jsHeapUsedSize:performance.memory?.usedJSHeapSize??null
      }));
    }catch(e){res.uiError=String(e.message).slice(0,180);}
  }
  if(cdp){
    try{
      const heap=await cdp.send('Runtime.getHeapUsage');
      res.rendererHeapUsedBytes=heap.usedSize;
      res.rendererHeapTotalBytes=heap.totalSize;
    }catch(e){res.rendererHeapError=String(e.message).slice(0,160);}
  }
  if(workerRef){
    try{
      res.workerHeap=await Promise.race([
        workerRef.evaluate(()=>({jsHeapUsedBytes:performance.memory?.usedJSHeapSize??null})),
        new Promise(resolve=>setTimeout(()=>resolve({timedOut:true}),3000))
      ]);
    }catch(e){res.workerHeapError=String(e.message).slice(0,160);}
  }
  return res;
}
async function nextResponse(requestType,timeout){
  await page.waitForFunction(type=>
    Array.isArray(window.__qa?.responses)&&window.__qa.responses.some(r=>r.requestType===type),
    requestType,{timeout});
  return page.evaluate(type=>window.__qa.responses.find(r=>r.requestType===type),requestType);
}
try{
  folder=await mkdtemp(join(tmpdir(),'ddv-qr-large-'));
  const fixtureStart=performance.now();
  const fixture=profileFixture();
  const fixtureMs=performance.now()-fixtureStart;
  report.fixture={expandedBytes:fixture.expanded,encryptedBytes:fixture.compressed,
    ratioEncryptedToExpanded:fixture.compressed/fixture.expanded,
    sourceSha256:fixture.sourceSha256,buildMs:fixtureMs};
  assert(fixture.compressed<128*MiB,'Fixture must exercise expanded-profile limit, not input cap');
  const filename=join(folder,'qr-'+scenario+'.p1g');
  await writeFile(filename,fixture.encrypted);
  report.processBeforeBrowser=sample();

  const probe=createServer();
  probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const port=probe.address().port;
  probe.close();await once(probe,'close');
  const root=fileURLToPath(new URL('../../',import.meta.url));
  server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
  const url='http://127.0.0.1:'+port+'/';
  let ready=false;
  for(let n=0;n<80;n++){
    try{if((await fetch(url)).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,125));
  }
  assert(ready,'Static server failed');
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-precise-memory-info']});
  context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900},timezoneId:'UTC'});
  page=await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('worker',w=>{workerRef=w;});
  page.on('pageerror',e=>report.errors.push('PAGE_ERROR:'+e.message.slice(0,240)));
  page.on('crash',()=>report.errors.push('RENDERER_CRASH'));
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;
    const q=window.__qa={requests:[],responses:[],types:new Map(),frames:0,maxRafGapMs:0,lastFrame:null};
    function frame(ts){
      if(q.lastFrame!==null)q.maxRafGapMs=Math.max(q.maxRafGapMs,ts-q.lastFrame);
      q.lastFrame=ts;q.frames++;requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.Worker=class{
      constructor(...args){
        this.inner=new NativeWorker(...args);
        this.onmessage=null;this.onerror=null;this.onmessageerror=null;
        this.inner.onmessage=e=>{
          const type=q.types.get(e.data?.id)||'unknown';
          const request=q.requests.find(x=>x.id===e.data?.id);
          q.responses.push({id:e.data?.id,requestType:type,responseType:e.data?.type||null,
            ok:e.data?.ok===true,error:e.data?.error||null,
            elapsedMs:request?performance.now()-request.sentAt:null,
            rowCount:e.data?.view?.rows?.length??null,
            diagnostics:Array.isArray(e.data?.view?.diagnostics)?e.data.view.diagnostics.slice(0,8):[],
            hasReceipt:e.data?.receipt?.status==='WORKER_VERIFIED_PAIR'});
          this.onmessage?.(e);
        };
        this.inner.onerror=e=>this.onerror?.(e);
        this.inner.onmessageerror=e=>this.onmessageerror?.(e);
      }
      postMessage(message,transfer){
        q.types.set(message.id,message.type);
        q.requests.push({id:message.id,type:message.type,sentAt:performance.now()});
        return this.inner.postMessage(message,transfer);
      }
      terminate(){this.inner.terminate();}
    };
  });
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__dreamlightBooted===true,null,{timeout:30000});
  cdp=await context.newCDPSession(page);
  await cdp.send('Runtime.enable');
  sample();interval=setInterval(sample,500);
  const started=performance.now();
  try{
    await page.locator('#save-file').setInputFiles(filename,{timeout:120000});
    const opened=await nextResponse('open',scenario==='100'?180000:scenario==='200'?120000:120000);
    report.phases.open={...opened,endToEndMs:performance.now()-started,process:sample(),
      browser:await getBrowserMetrics()};
    if(!opened.ok){
      report.verdict=scenario==='200'&&/PROFILE_ENTRY_TOO_LARGE|PROFILE.*LARGE|size limit/i.test(opened.error||'')?
        'EXPECTED_128MIB_EXPANDED_PROFILE_DENIAL':'OPEN_REJECTED_OR_RESOURCE_LIMIT';
    }else if(scenario==='200'){
      report.verdict='FAIL_200MIB_OPENED_BEYOND_128MIB_CAP';
      throw Error('200 MiB expanded profile unexpectedly passed');
    }else{
      await page.locator('#workspace').waitFor({state:'visible',timeout:30000});
      if(scenario==='gridcap'){
        report.verdict=opened.diagnostics?.some(d=>d.includes('途中で停止'))?
          'GRID_220000_SCAN_BOUND_DIAGNOSTIC_CONFIRMED':'GRID_220000_SCAN_BOUND_NOT_OBSERVED';
      }else{
        const originalEvent=fixture.root.World.RecurringEvents['0'].ItemSpawning.NextOccurrence;
        await page.locator('#records input[type=checkbox]').first().check({timeout:20000});
        await page.locator('#time-mode').selectOption('custom');
        await page.locator('#custom-time').fill('2026-11-02T10:15');
        await page.locator('#custom-time').dispatchEvent('change');
        const stageStart=performance.now();
        await page.locator('#stage-preview').click();
        const pf=await nextResponse('preflight',60000);
        report.phases.planPreflight={...pf,endToEndMs:performance.now()-stageStart,
          process:sample(),browser:await getBrowserMetrics()};
        if(!pf.ok)throw Error('Preflight rejected: '+pf.error);
        await page.locator('#confirm-switch-build').check();
        await page.waitForFunction(()=>!document.querySelector('#prepare-edited').disabled,null,{timeout:30000});
        const editStart=performance.now();
        await page.locator('#prepare-edited').click();
        const prepared=await nextResponse('prepareEdited',scenario==='100'?180000:180000);
        report.phases.casEncodeInternalReopen={...prepared,
          endToEndMs:performance.now()-editStart,
          process:sample(),browser:await getBrowserMetrics()};
        if(!prepared.ok){
          report.verdict='ENCODE_FAILED_OR_RESOURCE_LIMIT';
        }else{
          assert(prepared.hasReceipt,'Product Worker must produce an authenticated pair');
          await page.locator('#verified-pair-downloads').waitFor({state:'visible',timeout:30000});
          const dl=[];
          page.on('download',d=>dl.push(d));
          await page.locator('#download-verified-both').click();
          await page.waitForTimeout(1200);
          let original=dl.find(d=>d.suggestedFilename()==='original_qr-'+scenario+'.p1g');
          let edited=dl.find(d=>d.suggestedFilename()==='edited_qr-'+scenario+'.p1g');
          if(!original){
            const wait=page.waitForEvent('download',{timeout:20000});
            await page.locator('#retry-verified-original').click();original=await wait;
          }
          if(!edited){
            const wait=page.waitForEvent('download',{timeout:20000});
            await page.locator('#retry-verified-edited').click();edited=await wait;
          }
          const origPath=join(folder,'original-result.p1g'),editPath=join(folder,'edited-result.p1g');
          await original.saveAs(origPath);await edited.saveAs(editPath);
          assert.equal(hash(await readFile(origPath)),fixture.sourceSha256,'Original must be immutable');
          const reopenStart=performance.now();
          const editedBytes=await readFile(editPath);
          const openedCopy=await p1gPackagedProfileCodec.loadProfile(editedBytes);
          const parsed=parseSafeJson(openedCopy.jsonText);
          assert.equal(parsed.World.RecurringEvents['0'].ItemSpawning.NextOccurrence,
            '2026-11-02T10:15:00.000Z');
          assert.equal(originalEvent,'2126-08-20T00:00:00Z');
          assert.deepEqual(parsed.World.Other,fixture.root.World.Other);
          assert.equal(parsed.World.UnknownOpaque.pad,fixture.root.World.UnknownOpaque.pad);
          report.phases.independentReopen={
            elapsedMs:performance.now()-reopenStart,editedBytes:editedBytes.byteLength,
            changedSourceSha:hash(editedBytes)!==fixture.sourceSha256,
            unrelatedUnknownPadByteExact:true,process:sample()};
          report.verdict='SYNTHETIC_BROWSER_PATH_COMPLETED_NOT_RELEASE_ACCEPTED';
        }
      }
    }
  }catch(e){
    report.errors.push('SCENARIO_RUNTIME:'+String(e.message).slice(0,300));
    if(!report.verdict.startsWith('FAIL_'))report.verdict='BLOCKED_BY_RUNTIME_ERROR_OR_TIMEOUT';
  }
  report.browserEnd=await getBrowserMetrics();
  report.workerMessages=await page.evaluate(()=>window.__qa?.responses??[]).catch(()=>[]);
}finally{
  if(interval)clearInterval(interval);
  report.peakSampledMemory=maxima;
  report.nodeEnd=sample();
  report.elapsedTotalMs=performance.now()-t0;
  if(browser)await browser.close().catch(()=>{});
  if(server)server.kill();
  if(folder)await rm(folder,{recursive:true,force:true});
  report.evidenceLimits=[
    'Product Worker open combines decrypt/inflate/strict JSON parse/projection; these subphases cannot be timed separately without product instrumentation.',
    'Plan preflight is timed separately; old-value CAS and encode/internal reopen are currently coupled in prepareEdited.',
    'Chromium RSS is the aggregate sampled RSS, not PSS or exact peak; JS heap from renderer does not equal dedicated Worker heap.',
    'No real save, physical Switch, Svelte, Rust, rights, or production writer release acceptance.',
    'Source initial fixture generation and Playwright file upload memory are separate from browser Worker memory.'
  ];
  const out=join(process.cwd(),'qa-large-save-'+scenario+'.json');
  await writeFile(out,JSON.stringify(report,null,2)+'\n');
  console.log('QA_LARGE_SAVE_REPORT '+JSON.stringify({case:scenario,verdict:report.verdict,
    expanded:report.fixture?.expandedBytes,encrypted:report.fixture?.encryptedBytes,
    openMs:report.phases.open?.elapsedMs,planMs:report.phases.planPreflight?.elapsedMs,
    prepareMs:report.phases.casEncodeInternalReopen?.elapsedMs,
    reopenMs:report.phases.independentReopen?.elapsedMs,rendererHeap:report.browserEnd?.rendererHeapUsedBytes,ui:report.browserEnd?.ui,workerHeap:report.browserEnd?.workerHeap,peak:report.peakSampledMemory,
    errors:report.errors}));
}
if(report.verdict.startsWith('FAIL_'))process.exitCode=1;
