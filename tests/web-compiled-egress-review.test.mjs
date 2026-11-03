import test from 'node:test';
import assert from 'node:assert/strict';
import {scanJsEgressIndicators,compareCompiledInventories,COMPILED_EGRESS_AUDIT} from '../scripts/audit-web-compiled-egress.mjs';
const manifest=(entries)=>({contract:'timekeeper.sveltekit-build-audit@1',
 files:entries.map(([path,bytes,sha256])=>({path,bytes,sha256}))});
test('Compiled JS review inventory is diagnostic; reporting an indicator never claims safe egress',()=>{
 assert.equal(COMPILED_EGRESS_AUDIT,'timekeeper.web.compiled-egress-review/1');
 const result=scanJsEgressIndicators('fetch("/local"); new WebSocket("wss://example.invalid");new Worker("/bundle.js");navigator.sendBeacon("https://remote.invalid");');
 assert.equal(result.counts.fetch,1);
 assert.equal(result.counts.websocket,1);
 assert.equal(result.counts.worker,1);
 assert.equal(result.counts.beacon,1);
 assert.ok(result.urlLiteralExamples.some(x=>x.includes('https://remote.invalid')));
});
test('Compiled reproducibility only reports byte-identical file SHA/size/path; no public authorization',()=>{
 const a=manifest([['index.html',50,'a'.repeat(64)],['worker.js',20,'b'.repeat(64)]]);
 const b=manifest([['index.html',50,'a'.repeat(64)],['worker.js',20,'b'.repeat(64)]]);
 assert.equal(compareCompiledInventories(a,b).match,true);
 assert.equal(compareCompiledInventories(a,b).releaseApproved,false);
 b.files[1].sha256='c'.repeat(64);
 assert.equal(compareCompiledInventories(a,b).match,false);
 b.files[1].sha256='b'.repeat(64);
 b.files.reverse();assert.equal(compareCompiledInventories(a,b).match,false);
 b.files.reverse();b.files[1].bytes=21;
 assert.equal(compareCompiledInventories(a,b).match,false);
 assert.throws(()=>compareCompiledInventories({files:[]},b),/COMPILED_REPRO_INVENTORY_INVALID/);
});
