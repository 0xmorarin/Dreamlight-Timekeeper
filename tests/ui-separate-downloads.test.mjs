import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeparateDownloadCoordinator} from '../src/ui-separate-downloads.mjs';
const file=name=>({name,buffer:new Uint8Array([1,2,3]).buffer});
const receipt=sessionId=>({status:'WORKER_VERIFIED_PAIR',sessionId,original:file('original.p1g'),edited:file('edited.p1g')});
test('unprepared or incomplete Worker pair never initiates either download',()=>{
 const calls=[],c=createSeparateDownloadCoordinator({currentSession:()=>1,triggerDownload:name=>calls.push(name)});
 assert.throws(()=>c.downloadBoth(),/session/);
 assert.throws(()=>c.install({...receipt(1),edited:null}),/Both output/);
 assert.throws(()=>c.install({...receipt(1),status:'STATIC_ONLY'}),/Worker/);
 assert.throws(()=>c.install({...receipt(1),edited:file('original.p1g')}),/distinct/);
 assert.deepEqual(calls,[]);
});
test('original-first and independent retries retain browser-trigger uncertainty',()=>{
 let blocked=true;const calls=[];
 const c=createSeparateDownloadCoordinator({currentSession:()=>1,triggerDownload:name=>{
  calls.push(name);if(name==='edited'&&blocked)throw Error('Browser blocked second download');
 }});
 c.install(receipt(1));
 assert.deepEqual(c.downloadBoth(),{original:'TRIGGER_REQUESTED_UNCONFIRMED',edited:'TRIGGER_FAILED',multipleDownloadsMayBeBlocked:true});
 blocked=false;
 assert.equal(c.retryEdited(),'TRIGGER_REQUESTED_UNCONFIRMED');
 assert.equal(c.retryOriginal(),'TRIGGER_REQUESTED_UNCONFIRMED');
 assert.deepEqual(calls,['original','edited','edited','original']);
});
test('explicit original trigger failure stops automatic edited attempt, retries remain separate',()=>{
 const calls=[];let blocked=true;
 const c=createSeparateDownloadCoordinator({currentSession:()=>1,triggerDownload:name=>{
  calls.push(name);if(name==='original'&&blocked)throw Error('blocked');
 }});
 c.install(receipt(1));
 assert.deepEqual(c.downloadBoth(),{original:'TRIGGER_FAILED',edited:'NOT_ATTEMPTED',multipleDownloadsMayBeBlocked:true});
 blocked=false;c.retryOriginal();c.retryEdited();
 assert.deepEqual(calls,['original','original','edited']);
});
test('file switch invalidates both retries including stale same-number receipt',()=>{
 let session=1;const calls=[];
 const c=createSeparateDownloadCoordinator({currentSession:()=>session,triggerDownload:name=>calls.push(name)});
 c.install(receipt(1));session=2;
 assert.throws(()=>c.retryOriginal(),/session changed/);
 assert.throws(()=>c.retryEdited(),/session changed/);
 c.invalidate();session=1;
 assert.throws(()=>c.retryOriginal(),/session changed/);
 assert.deepEqual(calls,[]);
});
