import test from 'node:test';
import assert from 'node:assert/strict';
import {createVerifiedPairDownloadUi} from '../src/ui-verified-pair-downloads.mjs';

const controls=()=>Object.fromEntries(['panel','both','original','edited'].map(k=>[k,{
 hidden:false,disabled:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},
 click(){this.handlers.click?.();}
}]));
const receipt=sessionId=>({status:'WORKER_VERIFIED_PAIR',sessionId,
 original:{name:'original_synthetic.p1g',buffer:new Uint8Array([1,2]).buffer},
 edited:{name:'edited_synthetic.p1g',buffer:new Uint8Array([1,3]).buffer}});
test('controls remain hidden until a worker pair for active session/plan is installed',()=>{
 let session=1,revision=0;const ui=controls(),triggers=[];
 const c=createVerifiedPairDownloadUi({controls:ui,currentSession:()=>session,currentPlanRevision:()=>revision,
  triggerDownload:(kind)=>triggers.push(kind)});
 assert.equal(ui.panel.hidden,true);assert.equal(ui.both.disabled,true);
 assert.throws(()=>c.acceptWorkerPair({...receipt(1),status:'STATIC_ONLY'},{sessionId:1,planRevision:0}),/Worker-verified/);
 assert.throws(()=>c.acceptWorkerPair(receipt(1),{sessionId:2,planRevision:0}),/inactive/);
 c.acceptWorkerPair(receipt(1),{sessionId:1,planRevision:0});
 assert.equal(ui.panel.hidden,false);
 assert.deepEqual(c.downloadBoth(),{original:'TRIGGER_REQUESTED_UNCONFIRMED',edited:'TRIGGER_REQUESTED_UNCONFIRMED',multipleDownloadsMayBeBlocked:true});
 assert.deepEqual(triggers,['original','edited']);
 revision++;assert.throws(()=>c.retryEdited(),/no longer current/);
 assert.equal(ui.panel.hidden,true);assert.equal(ui.edited.disabled,true);
 c.acceptWorkerPair(receipt(1),{sessionId:1,planRevision:1});
 session=2;assert.throws(()=>c.retryOriginal(),/no longer current/);
 assert.deepEqual(triggers,['original','edited']);
});
test('blocked browser second download returns uncertainty and permits individual retries',()=>{
 let blocked=true;const ui=controls(),reported=[],attempts=[];
 const c=createVerifiedPairDownloadUi({controls:ui,currentSession:()=>8,currentPlanRevision:()=>4,
  onStatus:(...args)=>reported.push(args),
  triggerDownload:kind=>{attempts.push(kind);if(kind==='edited'&&blocked)throw Error('Browser suppressed download');}});
 c.acceptWorkerPair(receipt(8),{sessionId:8,planRevision:4});
 assert.deepEqual(c.downloadBoth(),{original:'TRIGGER_REQUESTED_UNCONFIRMED',edited:'TRIGGER_FAILED',multipleDownloadsMayBeBlocked:true});
 blocked=false;ui.edited.click();ui.original.click();
 assert.deepEqual(attempts,['original','edited','edited','original']);
 assert.equal(reported[0][1].edited,'TRIGGER_FAILED');
 assert.equal(reported[1][1],'TRIGGER_REQUESTED_UNCONFIRMED');
 c.invalidate();assert.equal(ui.both.disabled,true);
});
test('invalid or incomplete paired receipt never enables downloads',()=>{
 const ui=controls(),requests=[];
 const c=createVerifiedPairDownloadUi({controls:ui,currentSession:()=>1,currentPlanRevision:()=>0,
  triggerDownload:x=>requests.push(x)});
 for(const bad of [
  {...receipt(1),status:'SYNTHETIC_TESTED'},
  {...receipt(1),edited:null},
  {...receipt(1),edited:{...receipt(1).edited,name:'original_synthetic.p1g'}}
 ]){
  assert.throws(()=>c.acceptWorkerPair(bad,{sessionId:1,planRevision:0}));
  assert.equal(ui.panel.hidden,true);
 }
 assert.deepEqual(requests,[]);
});

test('individual edited retry cannot precede a requested original',()=>{
 const ui=controls(),attempts=[];
 const c=createVerifiedPairDownloadUi({controls:ui,currentSession:()=>1,currentPlanRevision:()=>0,
  triggerDownload:kind=>attempts.push(kind)});
 c.acceptWorkerPair(receipt(1),{sessionId:1,planRevision:0});
 assert.equal(ui.edited.disabled,true);
 assert.throws(()=>c.retryEdited(),/Original download must be requested first/);
 assert.deepEqual(attempts,[]);
 c.retryOriginal();assert.deepEqual(attempts,['original']);
 assert.equal(ui.edited.disabled,false);
 c.retryEdited();assert.deepEqual(attempts,['original','edited']);
});
