// 05 QR ASSET23 changed only 2 docs/test paths, preserve QA47 accepted product fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolveRcItemTextRow,resolveItemImageView} from '../src/item-image-coverage.mjs';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const load=async path=>JSON.parse(await readFile(new URL('../data/'+path,import.meta.url)));
const audit=await load('item-image-coverage-v1253.json');
const manifest=await load('steam-icons-v1253.json');
test('post QA47 delta modifies ONLY evidence doc and test; unchanged product image resolver',()=>{
 assert.deepEqual(git('diff','--name-only',
  '302e11e739d41d46920047e36a692bab390e530f',
  '9e826bf6788602a0fe181ef4864923ff1ca9946e').split('\n').sort(),
 ['docs/ITEM_IMAGE_ISSUE17_COVERAGE.md','tests/item-image-coverage.test.mjs']);
 assert.equal(git('rev-parse','302e11e739d41d46920047e36a692bab390e530f:src/item-image-coverage.mjs'),
  git('rev-parse','9e826bf6788602a0fe181ef4864923ff1ca9946e:src/item-image-coverage.mjs'));
});
test('new negative documentation and tests do not confer pixel rights',async()=>{
 const doc=await readFile(new URL('../docs/ITEM_IMAGE_ISSUE17_COVERAGE.md',import.meta.url),'utf8');
 const tests=await readFile(new URL('../tests/item-image-coverage.test.mjs',import.meta.url),'utf8');
 assert(doc.includes('244'));
 assert(tests.includes('RC row'));
 assert.equal(audit.policy.permissionState,'NOT_ESTABLISHED');
 assert.equal(audit.readOnlyResolutionContract.verifiedPublished,0);
 assert.equal(Object.keys(manifest.icons).length,0);
});
test('typed fallback still null URL on ambiguous, missing and unsupported dynamic ItemIDs',()=>{
 for(const id of [31300004,120200013,99912348,2010000021]){
  const row=resolveRcItemTextRow(manifest,{id,name:'<img onerror=alert(1)>unsafe'},{locale:'ja',coverageAudit:audit});
  assert.equal(row.image.url,null);
  assert.equal(row.textFallback.renderAsPlainText,true);
  assert.equal(row.fullItemImageReleaseAccepted,false);
 }
 assert.equal(resolveItemImageView(manifest,{id:31300004},{coverageAudit:audit}).status,'AMBIGUOUS');
});
