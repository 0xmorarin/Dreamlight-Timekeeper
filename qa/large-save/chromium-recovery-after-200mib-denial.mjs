// Independent failure-recovery test for an over-limit synthetic encrypted P1G in the real App Worker.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from '../../tests/fixture.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const MiB=1024*1024;
const root=()=>({
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:'QR Recovery'},
  World:{RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000021,
    NextOccurrence:'2126-08-20T00:00:00Z',LastOccurrence:'2024-01-01T00:00:00Z'}}},
    UnknownOpaque:{marker:'must survive unchanged',pad:''}}
});
const huge=root(),small=root();
const fixed=Buffer.byteLength(JSON.stringify(huge),'utf8');
huge.World.UnknownOpaque.pad='Q'.repeat(200*MiB-fixed);
assert.equal(Buffer.byteLength(JSON.stringify(huge),'utf8'),200*MiB);
const tooBig=makeSyntheticP1gProfile(huge);
const valid=makeSyntheticP1gProfile(small);
assert(tooBig.byteLength<128*MiB);
let browser,server,folder;
const metrics={evidence:'SYNTHETIC_CHROMIUM_FAILURE_RECOVERY',expandedBytes:200*MiB,
  inputBytes:tooBig.byteLength,limitBytes:128*MiB,sourceSha256:hash(tooBig),
  outcome:'NOT_RUN',errors:[]};
try{
  folder=await mkdtemp(join(tmpdir(),'qr-worker-recover-'));
  const oversize=join(folder,'oversize-200MiB.p1g');
  await writeFile(oversize,tooBig);
  const p=createServer();
  p.listen(0,'127.0.0.1');await once(p,'listening');
  const port=p.address().port;p.close();await once(p,'close');
  server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],
    {cwd:fileURLToPath(new URL('../../',import.meta.url)),stdio:'ignore'});
  const address='http://127.0.0.1:'+port+'/';
  let ready=false;
  for(let i=0;i<80;i++){try{if((await fetch(address)).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,125));}
  assert(ready,'HTTP_READY_FAILED');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:900}});
  const page=await context.newPage();
  page.on('pageerror',e=>metrics.errors.push('PAGE_ERROR:'+e.message));
  await page.addInitScript(()=>{
    const N=window.Worker;
    window.__qaWorkerMessages=[];
    window.Worker=class{
      constructor(...args){
        this.inner=new N(...args);
        this.onmessage=null;this.onerror=null;this.onmessageerror=null;
        this.inner.onmessage=e=>{
          window.__qaWorkerMessages.push({type:e.data?.type||null,ok:e.data?.ok===true,
            error:e.data?.error||null,id:e.data?.id??null});
          this.onmessage?.(e);
        };
        this.inner.onerror=e=>this.onerror?.(e);
        this.inner.onmessageerror=e=>this.onmessageerror?.(e);
      }
      postMessage(...args){return this.inner.postMessage(...args);}
      terminate(){this.inner.terminate();}
    };
  });
  await page.goto(address,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__dreamlightBooted===true,null,{timeout:30000});
  await page.locator('#save-file').setInputFiles(oversize);
  await page.waitForFunction(()=>window.__qaWorkerMessages.some(x=>x.ok===false),null,{timeout:120000});
  const error=await page.evaluate(()=>window.__qaWorkerMessages.find(x=>x.ok===false)?.error);
  metrics.expectedDenial=error;
  assert.match(error,/PROFILE_ENTRY_TOO_LARGE|size limit|LARGE/i);
  assert(await page.locator('#workspace').isHidden(),'Invalid input cannot enter Workspace');
  assert(await page.locator('#welcome').isVisible(),'Open should remain recoverable');
  assert(await page.locator('#save-file').isEnabled(),'File chooser must recover');
  metrics.failClosedWorkspace=true;
  // Same session process must accept a subsequent well-formed P1G; no reload.
  await page.locator('#save-file').setInputFiles({name:'recovered.p1g',
    mimeType:'application/octet-stream',buffer:Buffer.from(valid)});
  await page.locator('#workspace').waitFor({state:'visible',timeout:30000});
  await page.locator('#session-name').getByText('QR Recovery').waitFor({timeout:10000});
  assert.equal(await page.locator('#tabs button').count(),4);
  assert(await page.locator('#download-backup').isEnabled());
  const download=page.waitForEvent('download');
  await page.locator('#download-backup').click();
  const d=await download;
  const saved=join(folder,'verified-backup.p1g');
  await d.saveAs(saved);
  assert.equal(hash(await readFile(saved)),hash(valid),'Byte-for-byte source backup');
  const messages=await page.evaluate(()=>window.__qaWorkerMessages);
  metrics.successfulLaterOpen=messages.some(x=>x.type==='opened'&&x.ok);
  assert(metrics.successfulLaterOpen,'Later Worker open must succeed');
  metrics.backupSha256=hash(valid);metrics.backupByteIdentical=true;
  metrics.uiTabs=4;metrics.outcome='RECOVERED_AFTER_EXPECTED_DENIAL';
  assert.deepEqual(metrics.errors,[]);
  console.log('QA_200MIB_RECOVERY '+JSON.stringify(metrics));
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(server)server.kill();
  if(folder)await rm(folder,{recursive:true,force:true});
}
