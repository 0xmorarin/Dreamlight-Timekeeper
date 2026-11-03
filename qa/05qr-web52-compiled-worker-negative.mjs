// 05 QR WEB52 frozen compiled-worker negative acceptance; no user P1G is loaded.
// Only synthetic profile(s) are used with 127.0.0.1 SvelteKit preview.
// Browser network attempts are captured/blocked; success does not prove all paths safe.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {readdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {makeSyntheticP1gProfile} from '../tests/fixture.mjs';
const l=createServer();l.listen(0,'127.0.0.1');await once(l,'listening');
const port=l.address().port;l.close();await once(l,'close');
const origin='http://127.0.0.1:'+port;
const base=origin+'/Dreamlight-Timekeeper/';
const workerNames=(await readdir('build/_app/immutable/workers')).filter(x=>/^worker-[\w-]+\.js$/.test(x));
assert.equal(workerNames.length,1,'Expected one compiled WEB52 Worker entry');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{
 cwd:process.cwd(),env:{...process.env,BASE_PATH:'/Dreamlight-Timekeeper'},stdio:'ignore'
});
let browser;
try{
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  try{if((await fetch(base)).ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 assert(ready,'Isolated preview server unavailable');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:320,height:720}});
 const remote=[],sockets=[],pages=[],routeDenied=[];
 context.on('request',r=>{if(!r.url().startsWith(origin+'/'))remote.push(r.url());});
 await context.route('**/*',async route=>{
  const u=route.request().url();
  if(!u.startsWith(origin+'/')){routeDenied.push(u);await route.abort('blockedbyclient');return;}
  await route.continue();
 });
 const page=await context.newPage();
 page.on('websocket',socket=>{if(!socket.url().startsWith('ws://127.0.0.1:'+port+'/'))sockets.push(socket.url());});
 page.on('pageerror',e=>pages.push(e.message));
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 cdp.on('Network.webSocketCreated',({url})=>{
  if(!url.startsWith('ws://127.0.0.1:'+port+'/'))sockets.push(url);
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const A=Array.from(Buffer.from(makeSyntheticP1gProfile({
  GameInfo:{Version:626,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:'Independent-QA-A'},World:{RecurringEvents:{'0':{ItemSpawning:{
    RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z'
  }}}}
 })));
 const B=Array.from(Buffer.from(makeSyntheticP1gProfile({
  GameInfo:{Version:626,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Name:'Independent-QA-B'},World:{RecurringEvents:{'0':{ItemSpawning:{
    RecurringEventItemID:2010000021,NextOccurrence:'2022-09-06T00:00:00Z'
  }}}}
 })));
 const outcomes=await page.evaluate(async({name,A,B})=>{
  const worker=new Worker('/Dreamlight-Timekeeper/_app/immutable/workers/'+name,{type:'module'});
  let serial=400;
  const handlers=new Map();
  worker.onmessage=e=>{const cb=handlers.get(e.data.id);if(cb){handlers.delete(e.data.id);cb(e.data);}};
  async function ask(type,rest={}){
   const id=++serial;
   return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{handlers.delete(id);reject(Error('compiled Worker response timeout '+type));},15000);
    handlers.set(id,msg=>{clearTimeout(timer);resolve(msg);});
    worker.postMessage({id,type,...rest});
   });
  }
  const out={};
  const queryCases=[
   {domain:'timing',view:'summary',limit:2,cursor:null},
   {domain:'timing',view:'summary',limit:2,cursor:'forged-opaque-abc'},
   {domain:'timing',view:'summary',limit:2,cursor:'expired-opaque',
    sessionId:100,revision:20,indexGeneration:20,sourceSha256:'a'.repeat(64)},
   {domain:'timing',view:'summary',limit:2,complete:true,
    capability:{READ:true,ENCODE_COPY:true},references:[],coreVerified:true},
   {domain:'timing',view:'summary',limit:200,cursor:'replay-same-token'},
   {domain:'timing',view:'changed-scope',limit:201,cursor:'replay-same-token'},
   {domain:'inventory',view:'all',limit:100,filters:{area:'other'},cursor:'other-scope'},
   {domain:'timing',view:'summary',limit:2,cursor:null,rows:[{payload:'x'.repeat(1024*65)}]},
   {domain:'timing',view:'summary',limit:201,cursor:null,complete:true},
   {domain:'world-grid',view:'all',limit:200,cursor:null,referenceGraph:{complete:true}},
   {domain:'timing',view:'summary',limit:2,cursor:null,sourceFile:'B',sessionKey:'A',
    revision:999,complete:true,capabilities:{READ:'AVAILABLE'}}
  ];
  const requireReject=(r,message)=>{if(r.ok!==false||r.error!==message)
    throw Error('Expected '+message+', got '+JSON.stringify(r));return r.error;};
  out.preOpenQueries=[];
  for(const c of queryCases)out.preOpenQueries.push(requireReject(await ask('queryPage',c),'CORE_READ_ABI_NOT_ACCEPTED'));
  out.preOpenWriter=requireReject(await ask('prepareEdited',{sessionId:1,planRevision:0,
   entries:[{eventId:2010000021,originalTime:'2126-08-20T00:00:00Z',
    targetTime:'2022-09-06T00:00:00Z'}],targetBuildId:'9A239D3DB569756D',
   confirmedSwitchTarget:true,writerAuthorized:true,capabilities:{ENCODE_COPY:true}}),
   'RC_READ_ONLY_WRITER_DISABLED');
  const aa=await ask('open',{buffer:new Uint8Array(A).buffer,name:'A.p1g'});
  if(!aa.ok||aa.type!=='opened')throw Error('Synthetic A open failed '+JSON.stringify(aa));
  out.sessionA=aa.sessionId;
  const ab=await ask('open',{buffer:new Uint8Array(B).buffer,name:'B.p1g'});
  if(!ab.ok||ab.type!=='opened')throw Error('Synthetic B open failed '+JSON.stringify(ab));
  out.sessionB=ab.sessionId;
  out.staleBackup=(await ask('backup',{sessionId:out.sessionA})).ok;
  out.bBackup=(await ask('backup',{sessionId:out.sessionB})).ok;
  out.postSwitchQuery=requireReject(await ask('queryPage',{domain:'timing',view:'summary',
   limit:1,cursor:'A-old',sessionId:out.sessionA,sourceSha256:'b'.repeat(64),
   revision:0,complete:true}),'CORE_READ_ABI_NOT_ACCEPTED');
  out.postSwitchWriter=requireReject(await ask('prepareEdited',{sessionId:out.sessionB,
   confirmedSwitchTarget:true,targetBuildId:'9A239D3DB569756D',planRevision:0,
   entries:[{pointer:'/World/RecurringEvents/0/ItemSpawning/NextOccurrence',
     eventId:2010000021,originalTime:'2022-09-06T00:00:00Z',
     targetTime:'2126-08-20T00:00:00Z'}]}),'RC_READ_ONLY_WRITER_DISABLED');
  worker.terminate();
  return out;
 },{name:workerNames[0],A,B});
 assert.equal(outcomes.preOpenQueries.length,11);
 assert(outcomes.sessionB>outcomes.sessionA);
 assert.equal(outcomes.preOpenWriter,'RC_READ_ONLY_WRITER_DISABLED');
 assert.equal(outcomes.postSwitchWriter,'RC_READ_ONLY_WRITER_DISABLED');
 assert.equal(outcomes.postSwitchQuery,'CORE_READ_ABI_NOT_ACCEPTED');
 assert.equal(outcomes.staleBackup,false);
 assert.equal(outcomes.bBackup,true);
 assert.deepEqual(remote,[],'Network attempted off-loopback HTTP');
 assert.deepEqual(routeDenied,[],'Off-loopback request was attempted (and blocked)');
 assert.deepEqual(sockets,[],'Browser WebSocket emitted nonlocal URL');
 assert.deepEqual(pages,[],'Page errors');
 console.log(JSON.stringify({contract:'05qr.web52.compiled-worker-negative@1',
  compiledWorker:workerNames[0],forgedPageDenials:outcomes.preOpenQueries.length,
  preOpenWriterDenied:true,postFileSwitchWriterDenied:true,staleBackupDenied:true,
  remoteHttpAttempts:remote.length,remoteWsPageAttempts:sockets.length,
  browserScope:'isolated navigated UI and direct compiled Worker requests only; not all possible runtime paths',
  productCoreReadAccepted:false,productWriterAuthorized:false,publicReleaseApproved:false}));
}finally{await browser?.close();server.kill();}
