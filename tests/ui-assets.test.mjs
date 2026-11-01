import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GAME_UI_KEYS,APP_UI_KEYS,validateUiManifest,resolveGameUiIcon,resolveAppUiIcon,verifyUiAssetBytes} from '../src/ui-assets.mjs';

const game=JSON.parse(await readFile(new URL('../data/steam-ui-icons-v1253.json',import.meta.url),'utf8'));
const app=JSON.parse(await readFile(new URL('../data/app-ui-icons.json',import.meta.url),'utf8'));
const hash='a'.repeat(64);
const gameEntry={kind:'game_ui',verified:true,platform:'Steam',gameVersion:'1.25.3',
  path:'assets/steam/v1253/ui/currency/moonstone.webp',sha256:hash,sourceSha256:hash,
  sourceAsset:'ui-imagesatlas_assets_all.bundle|Texture2D',mappingEvidence:'Sprite-to-texture linkage observed',
  spritePathId:'9511052423844503179',texturePathId:'5643049798835674763',width:64,height:64};
const appEntry={kind:'app_ui',verified:true,path:'assets/app/ui/action/open-save.webp',
  sha256:hash,sourceSha256:hash,sourceAsset:'Original tool artwork',
  mappingEvidence:'Direct owner-authored action.open-save symbol',width:64,height:64};
const withIcon=(base,key,entry)=>({...structuredClone(base),
  source:{...base.source,status:'VERIFIED_ASSETS'},icons:{[key]:entry}});
test('empty UI manifests validate independently of item image manifest',()=>{
 assert.equal(validateUiManifest(game,'game_ui'),true);
 assert.equal(validateUiManifest(app,'app_ui'),true);
 assert.equal(resolveGameUiIcon(game,'currency.moonstone'),null);
 assert.equal(resolveAppUiIcon(app,'action.open-save'),null);
 assert.ok(GAME_UI_KEYS.includes('tab.spawn')&&APP_UI_KEYS.includes('action.backup'));
});
test('verified semantic keys resolve only for their own type',()=>{
 const g=withIcon(game,'currency.moonstone',gameEntry),a=withIcon(app,'action.open-save',appEntry);
 assert.equal(validateUiManifest(g,'game_ui'),true);
 assert.equal(validateUiManifest(a,'app_ui'),true);
 assert.equal(resolveGameUiIcon(g,'currency.moonstone'),g.icons['currency.moonstone']);
 assert.equal(resolveAppUiIcon(a,'action.open-save'),a.icons['action.open-save']);
 assert.equal(resolveGameUiIcon(a,'action.open-save'),null);
 assert.equal(resolveAppUiIcon(g,'currency.moonstone'),null);
});
test('Steam UI claims fail closed for Switch label, file traversal, missing asset identity and lossy format',()=>{
 for(const bad of [
  {platform:'Switch'},{path:'../out.webp'},{path:'assets/steam/v1253/ui/../../bad.webp'},
  {path:'assets/steam/v1253/ui/image.png'},{path:'assets/steam/v1253/ui/image.svg'},
  {mappingEvidence:''},{sourceAsset:''},{sha256:'nope'},{spritePathId:'bad'}
 ]){
  const g=withIcon(game,'currency.moonstone',{...gameEntry,...bad});
  assert.throws(()=>validateUiManifest(g,'game_ui'));
  assert.equal(resolveGameUiIcon(g,'currency.moonstone'),null);
 }
 const g=withIcon(game,'currency.moonstone',gameEntry);
 g.source.gameVersion='1.25.0';
 assert.throws(()=>validateUiManifest(g,'game_ui'));
});
test('semantic names cannot escape their assigned namespace or appear twice under one output',()=>{
 for(const key of ['../foo','A','', 'tab/shops','tab..spawn']){
  assert.throws(()=>validateUiManifest(withIcon(app,key,appEntry),'app_ui'));
 }
 const a=withIcon(app,'action.open-save',appEntry);
 a.icons['action.backup']={...appEntry};
 assert.throws(()=>validateUiManifest(a,'app_ui'),/Duplicate/);
 assert.equal(resolveAppUiIcon(a,'action.open-save'),null);
});
test('verified UI icons are still presentation assets and never authorize save writes',()=>{
 assert.equal(game.source.writerAuthorization,false);
 assert.equal(app.source.writerAuthorization,false);
 assert.throws(()=>validateUiManifest({...game,source:{...game.source,writerAuthorization:true}},'game_ui'));
 assert.throws(()=>validateUiManifest({...app,source:{...app.source,writerAuthorization:true}},'app_ui'));
});
test('WebP contract requires correct dimensions and VP8L header',()=>{
 const bytes=new Uint8Array(26);bytes.set([...Buffer.from('RIFF')],0);
 new DataView(bytes.buffer).setUint32(4,18,true);
 bytes.set([...Buffer.from('WEBPVP8L')],8);
 new DataView(bytes.buffer).setUint32(16,5,true);
 bytes[20]=0x2f;
 const dims=((2-1)&0x3fff)|(((3-1)&0x3fff)<<14);
 new DataView(bytes.buffer).setUint32(21,dims,true);
 assert.equal(verifyUiAssetBytes({width:2,height:3},bytes),true);
 assert.throws(()=>verifyUiAssetBytes({width:1,height:3},bytes),/dimensions/);
 bytes[12]=0;
 assert.throws(()=>verifyUiAssetBytes({width:2,height:3},bytes),/VP8L/);
});
