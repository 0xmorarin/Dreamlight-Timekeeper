import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../data/steam-ui-candidates-v1253.json',import.meta.url),'utf8'));
test('Steam UI atlas catalog is source-specific and never itself a publishable icon manifest',()=>{
 assert.equal(data.source.gameVersion,'1.25.3');
 assert.equal(data.source.bundleSHA256.length,64);
 assert.equal(data.source.writerAuthorization,false);
 assert.equal(data.objectCounts.Sprite,2428);
 assert.equal(data.objectCounts.Texture2D,2330);
 assert.equal(data.candidates.length,21);
});
test('each UI semantic candidate has distinct Sprite and Texture references, dimensions and audit status',()=>{
 const keys=new Set(),spritePaths=new Set(),texturePaths=new Set();
 for(const r of data.candidates){
  assert.match(r.key,/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/);
  assert.match(r.spritePathId,/^[0-9]+$/);
  assert.match(r.texturePathId,/^[0-9]+$/);
  assert.ok(r.width>0&&r.height>0&&r.width<=1024&&r.height<=1024);
  assert.ok([10,12,25].includes(r.textureFormat));
  assert.ok(!keys.has(r.key)&&!spritePaths.has(r.spritePathId)&&!texturePaths.has(r.texturePathId));
  keys.add(r.key);spritePaths.add(r.spritePathId);texturePaths.add(r.texturePathId);
 }
 assert.equal(data.candidates.filter(x=>x.pixelTrial.startsWith('PASS')).length,19);
 assert.equal(data.candidates.filter(x=>x.reviewState.startsWith('HOLD')).length,3);
});
test('game-world icon candidates are individually version-verified and held keyart is not misclassified',()=>{
 const worlds=data.candidates.filter(x=>x.key.startsWith('world.'));
 assert.deepEqual(worlds.map(x=>x.key),['world.valley','world.exp1','world.hgw']);
 assert.equal(worlds.every(x=>x.pixelTrial.startsWith('PASS')),true);
 assert.equal(worlds.filter(x=>x.reviewState==='STATIC_REFERENCE_VERIFIED').length,2);
 assert.equal(worlds.find(x=>x.key==='world.hgw').reviewState,'HOLD_DEPLOYMENT');
});
