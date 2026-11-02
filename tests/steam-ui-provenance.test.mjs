import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditSteamUiPublicationLedger} from '../src/steam-ui-provenance.mjs';

const catalog=JSON.parse(await readFile(new URL('../data/steam-ui-candidates-v1253.json',import.meta.url),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../data/steam-ui-icons-v1253.json',import.meta.url),'utf8'));
const copy=x=>structuredClone(x);
const run=(c=catalog,m=manifest)=>auditSteamUiPublicationLedger(c,m);
const publishedKey='skill.mining';

test('static source ledger matches four shipped UI images; all HOLD candidates unpublished',()=>{
  const result=run();
  assert.equal(result.verificationLevel,'STATIC_LEDGER_CROSSCHECK_ONLY');
  assert.equal(result.candidateCount,21);
  assert.equal(result.publishedCount,4);
  assert.equal(result.unpublishedCount,17);
  assert.deepEqual(result.heldKeys,['tab.shops','tab.daily','world.hgw']);
  assert.equal(Object.hasOwn(manifest.icons,'world.hgw'),false);
});

test('cross-version or changed Steam UnityFS/CAB identity fails closed',()=>{
  for(const field of ['gameVersion','fullVersion','bundle','bundleBytes','bundleSHA256','cabSHA256','unity','writerAuthorization']){
    const c=copy(catalog);c.source[field]='DRIFT';
    assert.throws(()=>run(c),/source ledger identity/);
  }
  for(const field of ['sourceBundle','sourceBundleSha256']){
    const m=copy(manifest);m.source[field]=field==='sourceBundle'?'different.bundle':'0'.repeat(64);
    assert.throws(()=>run(catalog,m),/different source bundle|manifest/);
  }
});

test('Sprite path, Texture path, source name or dimensions drift rejects publication',()=>{
  for(const field of ['spritePathId','texturePathId','spriteName','width','height']){
    const c=copy(catalog);const row=c.candidates.find(x=>x.key===publishedKey);
    row[field]=field==='width'||field==='height'?row[field]+1:'garbled';
    assert.throws(()=>run(c),/drift|Malformed/);
  }
});

test('HOLD candidates cannot be promoted by a copied manifest or by changing catalog status',()=>{
  const c=copy(catalog),m=copy(manifest),row=c.candidates.find(x=>x.key==='world.hgw');
  const cloned=copy(m.icons['world.valley']);
  cloned.path='assets/steam/v1253/ui/world/hgw.webp';
  cloned.sourceAsset='CAB-fe2bbf4dc0b20d2a3f3b5ff35a49ffe8|'+row.spriteName;
  cloned.spritePathId=row.spritePathId;cloned.texturePathId=row.texturePathId;
  cloned.width=row.width;cloned.height=row.height;
  m.icons['world.hgw']=cloned;
  assert.throws(()=>run(c,m),/Unreviewed game UI deployment/);
  row.reviewState='STATIC_REFERENCE_VERIFIED';
  row.pixelTrial='NOT_TESTED';
  assert.throws(()=>run(c,m),/Unreviewed game UI deployment/);
  row.pixelTrial='PASS_PRIVATE_2026-11-01';
  assert.throws(()=>run(c,m),/Unreviewed game UI deployment/);
});

test('missing, duplicate or unregistered candidate records fail closed',()=>{
  const c=copy(catalog);c.candidates=c.candidates.filter(x=>x.key!==publishedKey);
  assert.throws(()=>run(c),/missing from source candidate ledger/);
  const duplicate=copy(catalog);duplicate.candidates.push(copy(duplicate.candidates[0]));
  assert.throws(()=>run(duplicate),/duplicated/);
  const unknown=copy(catalog);unknown.candidates[0].key='unknown.fictional';
  assert.throws(()=>run(unknown),/Malformed/);
});

test('a static ledger result cannot be misreported as pixel or release approval',()=>{
  const result=run();
  assert.ok(!('pixelVerified' in result));
  assert.ok(!('releaseApproved' in result));
});
