import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_ICON_SOURCES,LUCIDE_PINNED_COMMIT,renderAppUiIconSvg} from '../src/app-ui-icon-design.mjs';
import {buildAppIcons} from '../scripts/build-app-ui-icons.mjs';
import {inspectAppSvg,verifyUiAssetBytes,validateUiManifest} from '../src/ui-assets.mjs';

const sum=buffer=>createHash('sha256').update(buffer).digest('hex');
test('16 vetted Lucide SVGs match exact pinned original sources, styled bytes and attribution',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../data/app-ui-icons.json',import.meta.url),'utf8'));
 assert.equal(manifest.source.assetFormat,'SVG');
 assert.equal(manifest.source.iconSet,'Lucide');
 assert.equal(manifest.source.upstreamCommit,LUCIDE_PINNED_COMMIT);
 assert.equal(validateUiManifest(manifest,'app_ui'),true);
 assert.equal(Object.keys(manifest.icons).length,16);
 assert.deepEqual(Object.keys(manifest.icons).sort(),Object.keys(APP_ICON_SOURCES).sort());
 const license=await readFile(new URL('../vendor/lucide/LICENSE',import.meta.url),'utf8');
 assert.match(license,/ISC License/);
 assert.match(license,/MIT License/);
 assert.match(license,/Lucide Icons and Contributors/);
 assert.match(license,/Cole Bemis/);
 for(const [key,entry] of Object.entries(manifest.icons)){
  const raw=await readFile(new URL('../'+entry.path,import.meta.url));
  const original=await readFile(new URL('../'+entry.sourceAsset,import.meta.url),'utf8');
  assert.equal(entry.upstreamIcon,APP_ICON_SOURCES[key]);
  assert.equal(entry.sha256,sum(raw));
  assert.equal(entry.sourceSha256,sum(original));
  assert.equal(raw.toString('utf8'),renderAppUiIconSvg(key,original));
  assert.equal(verifyUiAssetBytes(entry,new Uint8Array(raw),'app_ui'),true);
  assert.deepEqual(inspectAppSvg(new Uint8Array(raw)),{width:24,height:24});
  assert.match(raw.toString('utf8'),/stroke-width="2.25"/);
  assert.doesNotMatch(raw.toString('utf8'),/<(?:script|foreignObject|image|use|style)\\b/i);
 }
});
test('regeneration matches shipped Lucide output and manifest byte-for-byte',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'timekeeper-lucide-svg-'));
 try{
  await buildAppIcons(temp);
  const expected=JSON.parse(await readFile(new URL('../data/app-ui-icons.json',import.meta.url),'utf8'));
  const actual=JSON.parse(await readFile(join(temp,'data','app-ui-icons.json'),'utf8'));
  assert.deepEqual(actual,expected);
  for(const [key,entry] of Object.entries(actual.icons)){
   const sample=await readFile(join(temp,entry.path));
   const published=await readFile(new URL('../'+entry.path,import.meta.url));
   assert.deepEqual(sample,published,key);
  }
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('unsafe SVG event handlers, external assets and scripts are refused',async()=>{
 const original=await readFile(new URL('../vendor/lucide/icons/folder-open.svg',import.meta.url),'utf8');
 const base=renderAppUiIconSvg('action.open-save',original);
 for(const unsafe of [
  base.replace('</svg>','<script>alert(1)</script></svg>'),
  base.replace('<path','<path onclick="x()"'),
  base.replace('</svg>','<image href="https://example.com/a.svg"/></svg>'),
  base.replace('viewBox="0 0 24 24"','viewBox="0 0 1 1"'),
  base.replace('<path','<path id="surprise"')
 ])assert.throws(()=>inspectAppSvg(new TextEncoder().encode(unsafe)));
});
