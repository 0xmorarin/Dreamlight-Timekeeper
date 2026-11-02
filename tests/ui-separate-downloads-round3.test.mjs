import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeparateDownloadCoordinator} from '../src/ui-separate-downloads.mjs';
const packet=(name)=>({name,buffer:new Uint8Array([10,20,30]).buffer});
const receipt=sessionId=>({status:'WORKER_VERIFIED_PAIR',sessionId,original:packet('original.p1g'),edited:packet('edited.p1g')});

test('synthetic browser second-download rejection does not claim delivery; independent retry stays available',()=>{
 const events=[],state={session:31,secondAllowed:false};
 const c=createSeparateDownloadCoordinator({
  currentSession:()=>state.session,
  triggerDownload:(type,body)=>{
   events.push({type,bytes:body.buffer.byteLength});
   if(type==='edited'&&!state.secondAllowed)throw new Error('browser denied multiple downloads');
  }
 });
 c.install(receipt(31));
 assert.deepEqual(c.downloadBoth(),{
  original:'TRIGGER_REQUESTED_UNCONFIRMED',edited:'TRIGGER_FAILED',multipleDownloadsMayBeBlocked:true
 });
 assert.equal(events.length,2);
 state.secondAllowed=true;
 assert.equal(c.retryEdited(),'TRIGGER_REQUESTED_UNCONFIRMED');
 assert.equal(events.length,3);
 assert.equal(c.retryOriginal(),'TRIGGER_REQUESTED_UNCONFIRMED');
 assert.equal(events[3].type,'original');
});

test('explicit file switch and closed session invalidate both synthetic file retry paths',()=>{
 let session=4;const calls=[];
 const c=createSeparateDownloadCoordinator({currentSession:()=>session,triggerDownload:(name)=>calls.push(name)});
 c.install(receipt(4));session=5;
 assert.throws(()=>c.retryOriginal(),/session changed/);
 assert.throws(()=>c.retryEdited(),/session changed/);
 session=null;
 assert.throws(()=>c.downloadBoth(),/session changed/);
 c.invalidate();session=4;
 assert.throws(()=>c.retryOriginal(),/session changed/);
 assert.deepEqual(calls,[]);
});

test('no edited output is generated unless an independent synthetic receipt is explicitly installed',()=>{
 const calls=[];
 const c=createSeparateDownloadCoordinator({currentSession:()=>10,triggerDownload:x=>calls.push(x)});
 for(const invalid of [null,{},receipt(9),{...receipt(10),status:'STATIC_ONLY'},
  {...receipt(10),original:null},{...receipt(10),edited:packet('original.p1g')}])
  assert.throws(()=>c.install(invalid));
 assert.throws(()=>c.retryEdited());
 assert.deepEqual(calls,[]);
});
