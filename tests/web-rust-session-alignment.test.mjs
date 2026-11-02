import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const fixture=JSON.parse(await source('contracts/web-rust-save-session-alignment-v1.json'));
const byFeature=Object.fromEntries(fixture.mapping.map(x=>[x.feature,x]));
test('pinned common Rust research differs from production-ready SaveSession',()=>{
 assert.equal(fixture.reference.wand_pr312,'473acaab467051a03b40e39d92878d2ed8197d31');
 assert.equal(fixture.reference.rust_contract,'dreamwish.ddv.unified-save-session.research@1');
 assert.equal(fixture.reference.rust_session_blob_sha,'43951d777ccffb4c92418d7a3383512dae72da33');
 assert.equal(fixture.current.api,'ddv.common-save-session/1');
 assert.equal(fixture.current.mode,'TYPED_TARGET_ONLY');
 assert.equal(fixture.current.wasmInstalled,false);
 assert.equal(fixture.current.writerGranted,false);
 assert.equal(fixture.integration.phaseB,'BLOCKED');
 assert.deepEqual([...new Set(fixture.mapping.map(x=>x.feature))].sort(),
  ['openLocal','queryPage','indexInvalidation','planCAS','history','validate','backupOriginal','encodeCopy','permissionBoundary','workerTransport'].sort());
 for(const m of fixture.mapping)assert(!/PRODUCT_READY|RUNTIME_TESTED|ACCEPTED_WRITER/.test(m.state));
});
test('research API shape and limits do not silently become a typed product binding',async()=>{
 const port=await source('src/lib/timekeeper/save-session-contract.ts');
 const legacy=await source('src/lib/timekeeper/worker-adapter.ts');
 for(const api of ['openLocal','queryPage','planCAS','validate','history','backupOriginal','encodeCopy'])
  assert.match(port,new RegExp('\\b'+api+'(?:<[^>]+>)?\\('));
 assert.match(port,/RUST_SAVE_SESSION_INTEGRATION/);
 assert.match(port,/wasmInstalled:false, writerGranted:false/);
 assert.match(legacy,/timekeeper.save-worker@1/);
 assert.match(legacy,/new Worker\(new URL\('\.\.\/\.\.\/worker\.mjs'/);
 assert.match(byFeature.openLocal.research,/open_decoded_research/);
 assert.match(byFeature.openLocal.gap,/decoded/);
 assert.match(byFeature.queryPage.research,/query_paged/);
 assert.match(byFeature.queryPage.gap,/MAX_PAGE=64/);
 assert.match(byFeature.planCAS.gap,/post_references MUST NOT come from UI/);
 assert.match(byFeature.encodeCopy.research,/PRODUCT_P1G_ENCODE_COPY_NOT_AUTHORIZED/);
 assert.match(byFeature.permissionBoundary.research,/encode_copy_authorized=false,persistent_replace_authorized=false/);
});
test('research read-only status cannot grant a Writer capability or fake a verified pair',()=>{
 const forbidden=fixture.integration.forbiddenNow;
 for(const name of ['ENABLE_ENCODE_COPY','ENABLE_PERSISTENT_REPLACE','TRUST_UI_REFERENCE_INDEX','REPLACE_JS_CODEC'])
  assert(forbidden.includes(name));
 for(const name of ['encodeCopy','backupOriginal','workerTransport']){
  assert.notEqual(byFeature[name].state,'RESEARCH_IMPLEMENTED_ONLY');
 }
 assert(fixture.integration.prerequisites.some(x=>x.includes('05 QR')));
 assert(fixture.integration.prerequisites.some(x=>x.includes('P1G')));
});

test('post-freeze Wand synthetic P1G and W1 witnesses do not grant product writer',()=>{
 const later=fixture.observedAfterFreeze;
 assert.equal(later.wandPr312Head,'c587f04855db0543896c51f3defa068ccf002b43');
 assert.equal(later.sourceBlobs.p1g,'c8cacdc5fa6afc7a60f388af561522e2867f5c9b');
 assert(later.additions.some(x=>x.includes('create_p1g_copy_research')&&x.includes('product_encode_copy_authorized=false')));
 assert(later.additions.some(x=>x.includes('inspect_w1_source_research')&&x.includes('encode_copy_authorized=false')));
 assert(later.additions.some(x=>x.includes('cross_domain_reference_closure_complete=false')));
 for(const k of ['productP1gAccepted','completeDomainProjectionAccepted','stableWasmWorkerApiAccepted','writerGranted'])
  assert.equal(later[k],false,k);
 assert.equal(fixture.integration.phaseB,'BLOCKED');
});
