// 05 QR independent WEB acceptance; copied into immutable PR #10 checkout.
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {createOriginalBackupCoordinator} from '../src/ui-backup-coordinator.mjs';
import {createSeparateDownloadCoordinator} from '../src/ui-separate-downloads.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {resolve,reject,promise};};
const source=(sessionId,name='synthetic.json',data=[0,255,23,10])=>({
 sessionId,name,buffer:new Uint8Array(data).buffer
});
test('QR-R2 WEB delayed A backup plus second click cannot leak source A into session B',async()=>{
 let session=10,loading=false,requests=0;
 const first=deferred(),second=deferred(),downloaded=[];
 const c=createOriginalBackupCoordinator({
  requestBackup:id=>{requests++;return id===10?first.promise:second.promise;},
  isCurrentSession:id=>!loading&&id===session,
  saveOriginal:r=>downloaded.push({name:r.name,bytes:Array.from(new Uint8Array(r.buffer))})
 });
 const stale=c.download(10);
 await assert.rejects(c.download(10),/in progress/);
 assert.equal(requests,1);
 loading=true;c.invalidate();session=11;loading=false;
 const current=c.download(11);
 first.resolve(source(10,'a.json'));
 await assert.rejects(stale,/inactive/);
 assert.deepEqual(downloaded,[]);
 second.resolve(source(11,'b.json'));
 await current;
 assert.deepEqual(downloaded,[{name:'b.json',bytes:[0,255,23,10]}]);
 assert.equal(requests,2);
});
test('QR-R2 WEB forged session, malformed buffer and failure retry fail closed',async()=>{
 let session=3,generate=async()=>source(4),saved=[];
 const c=createOriginalBackupCoordinator({
  requestBackup:()=>generate(),saveOriginal:r=>saved.push(r.name),isCurrentSession:s=>session===s
 });
 await assert.rejects(c.download(3),/inactive save/);
 generate=async()=>({sessionId:3,name:'b.json',buffer:new Uint8Array(3)});
 await assert.rejects(c.download(3),/incomplete/);
 generate=async()=>{throw Error('transport down');};
 await assert.rejects(c.download(3),/transport down/);
 generate=async()=>source(3,'recovered.json');
 await c.download(3);
 assert.deepEqual(saved,['recovered.json']);
 await assert.rejects(c.download(2),/not active/);
 session=4;c.invalidate();
 await assert.rejects(c.download(3),/not active/);
});
test('QR-R2 WEB future separate download helper remains receipt-gated and reports trigger uncertainty',()=>{
 let active=1,downloads=[];
 const c=createSeparateDownloadCoordinator({
  currentSession:()=>active,triggerDownload:(which)=>{downloads.push(which);if(which==='edited')throw Error('blocked');}
 });
 assert.throws(()=>c.downloadBoth());
 const file=name=>({name,buffer:new Uint8Array([3,5,7]).buffer});
 const pair={status:'WORKER_VERIFIED_PAIR',sessionId:1,original:file('original.p1g'),edited:file('edited.p1g')};
 assert.throws(()=>c.install({...pair,edited:{name:'edited.p1g',buffer:new Uint8Array(2)}}));
 assert.throws(()=>c.install({...pair,status:'STATIC_ONLY'}));
 assert.deepEqual(downloads,[]);
 c.install(pair);
 const out=c.downloadBoth();
 assert.deepEqual(out,{original:'TRIGGER_REQUESTED_UNCONFIRMED',edited:'TRIGGER_FAILED',multipleDownloadsMayBeBlocked:true});
 active=2;
 assert.throws(()=>c.retryOriginal(),/session/);
 assert.throws(()=>c.retryEdited(),/session/);
 c.invalidate();active=1;
 assert.throws(()=>c.retryOriginal(),/session/);
 assert.deepEqual(downloads,['original','edited']);
});
test('QR-R2 WEB malformed and DST-ambiguous local timestamps reject while deterministic UTC conversion survives',()=>{
 const moduleUrl=new URL('../src/i18n.mjs',import.meta.url).href;
 const local=(zone,wall)=>{
  const script='import {parseLocalDateTime} from '+JSON.stringify(moduleUrl)+';process.stdout.write(JSON.stringify(parseLocalDateTime('+JSON.stringify(wall)+')))';
  return JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:zone},encoding:'utf8'}));
 };
 for(const wall of ['2026-11-01T01:30','2026-03-08T02:30'])assert.equal(local('America/New_York',wall),null);
 assert.equal(local('Australia/Lord_Howe','2026-04-05T01:45'),null);
 assert.equal(local('Asia/Tokyo','2026-02-30T10:00'),null);
 assert.equal(local('Asia/Tokyo','2026-11-02T10:15'),'2026-11-02T01:15:00.000Z');
 assert.equal(local('America/New_York','2026-11-01T03:30'),'2026-11-01T08:30:00.000Z');
});
test('QR-R2 WEB production Worker remains backup-only with no edited export route',async()=>{
 const {readFile}=await import('node:fs/promises');
 const worker=await readFile(new URL('../src/worker.mjs',import.meta.url),'utf8');
 const app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
 const staged=await readFile(new URL('../src/ui-separate-downloads.mjs',import.meta.url),'utf8');
 assert.match(worker,/type:'backup',sessionId:activeSessionId/);
 assert.match(app,/backupCoordinator\.invalidate\(\)/);
 assert.match(app,/backupCoordinator\.download\(state\.sessionId\)/);
 assert.doesNotMatch(worker,/data\.type===['"](?:export|encode|overwrite|write)['"]/);
 assert.doesNotMatch(app,/createSeparateDownloadCoordinator\(/);
 assert.doesNotMatch(app,/request\(['"](?:export|encode|overwrite|write)['"]/);
 assert.match(staged,/WORKER_VERIFIED_PAIR/);
});
