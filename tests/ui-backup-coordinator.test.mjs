import assert from 'node:assert/strict';
import test from 'node:test';
import {createOriginalBackupCoordinator} from '../src/ui-backup-coordinator.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};};
const response=(sessionId,name='profile.p1g')=>({sessionId,name,buffer:new Uint8Array([1,2,3]).buffer});
test('original backup is accepted only for the active Worker session',async()=>{
 let sessionId=3,loading=false;const delivered=[];
 const coordinator=createOriginalBackupCoordinator({
  requestBackup:async()=>response(3),saveOriginal:r=>delivered.push(r.name),
  isCurrentSession:id=>!loading&&id===sessionId
 });
 await coordinator.download(3);
 assert.deepEqual(delivered,['profile.p1g']);
 await assert.rejects(coordinator.download(2),/not active/);
 loading=true;
 await assert.rejects(coordinator.download(3),/not active/);
 assert.deepEqual(delivered,['profile.p1g']);
});
test('stale backup response after switching files never downloads; a new backup can proceed',async()=>{
 const old=deferred(),fresh=deferred(),delivered=[];
 let session=1;const coordinator=createOriginalBackupCoordinator({
  requestBackup:id=>id===1?old.promise:fresh.promise,
  saveOriginal:r=>delivered.push(r.name),isCurrentSession:id=>session===id
 });
 const outdated=coordinator.download(1);
 coordinator.invalidate();session=2;
 const current=coordinator.download(2);
 old.resolve(response(1,'old.p1g'));
 await assert.rejects(outdated,/inactive save/);
 fresh.resolve(response(2,'current.p1g'));
 await current;
 assert.deepEqual(delivered,['current.p1g']);
});
test('duplicate backup click, wrong reply session, malformed reply and transport error fail closed',async()=>{
 const delayed=deferred(),saved=[];
 let request=()=>delayed.promise;
 const coordinator=createOriginalBackupCoordinator({requestBackup:()=>request(),saveOriginal:r=>saved.push(r.name),isCurrentSession:id=>id===7});
 const a=coordinator.download(7);
 await assert.rejects(coordinator.download(7),/in progress/);
 delayed.resolve(response(8));
 await assert.rejects(a,/inactive save/);
 request=async()=>({sessionId:7,name:'missing-buffer'});
 await assert.rejects(coordinator.download(7),/incomplete/);
 request=async()=>{throw new Error('transfer failed')};
 await assert.rejects(coordinator.download(7),/transfer failed/);
 request=async()=>response(7,'retry.p1g');
 await coordinator.download(7);
 assert.deepEqual(saved,['retry.p1g']);
});
test('invalidate during load rejection makes old in-flight response inert even if session ID is restored',async()=>{
 const delayed=deferred(),saved=[];
 const coordinator=createOriginalBackupCoordinator({requestBackup:()=>delayed.promise,saveOriginal:r=>saved.push(r.name),isCurrentSession:id=>id===1});
 const task=coordinator.download(1);
 coordinator.invalidate();
 delayed.resolve(response(1,'from-previous-attempt.p1g'));
 await assert.rejects(task,/inactive save/);
 assert.deepEqual(saved,[]);
});
