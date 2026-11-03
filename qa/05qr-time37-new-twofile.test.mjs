// 05 QR TIME37 only docs/tests delta after independently accepted QA46.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {assessBoundW1IntentResearch} from '../src/w1-bound-intent-research.mjs';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
test('QR46 to new TIME37 modifies only tests and Native evidence doc, no product Rust/UI authority',()=>{
 assert.deepEqual(git('diff','--name-only',
  '6dc938f86847e98ba2c997f1407f4ae8a68b4f29',
  'd85fc89d3ed4a317396790ad881fcffc4dcdf83d').split('\n').sort(),
 ['docs/W1_OFFLINE_NATIVE_EVIDENCE_V1253.md','tests/w1-bound-intent-research.test.mjs']);
 assert.equal(git('rev-parse','6dc938f86847e98ba2c997f1407f4ae8a68b4f29:src/w1-bound-intent-research.mjs'),
  git('rev-parse','d85fc89d3ed4a317396790ad881fcffc4dcdf83d:src/w1-bound-intent-research.mjs'));
});
test('spoofed Core witness does not grant any Writer or Native semantics',()=>{
 const out=assessBoundW1IntentResearch({projection:{},coreWitness:{authenticatedByCore:true},intents:[]});
 assert.equal(out.status,'RESEARCH_DENIED');
 assert.equal(out.writerAuthorized,false);
 assert.equal(out.capabilityGranted,false);
 assert.equal(out.productSemanticCommandAuthorized,false);
 assert.deepEqual(out.operations,[]);
});
test('new test delta records spoofing/identity drift and fails closed for protected targets',async()=>{
 const src=await readFile(new URL('../tests/w1-bound-intent-research.test.mjs',import.meta.url),'utf8');
 const old=git('show','6dc938f86847e98ba2c997f1407f4ae8a68b4f29:tests/w1-bound-intent-research.test.mjs');
 assert(src.length>old.length);
 for(const pattern of ['authenticatedByCore','Core token witness identity drift','protected Moonstone','operationReferencesComplete','nativeConsumerSuccessVerified'])
  assert(src.includes(pattern),pattern);
 const doc=await readFile(new URL('../docs/W1_OFFLINE_NATIVE_EVIDENCE_V1253.md',import.meta.url),'utf8');
 assert(/Native|Client.Clock/.test(doc));
 assert(!/PRODUCT_OPERATION_ENABLED\s*=\s*true/.test(doc));
});
