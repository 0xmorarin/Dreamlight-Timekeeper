import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {SUPPORTED_LOCALES,resolveLocale,initialLocale,translate,localDate,parseLocalDateTime,areaName,categoryName} from '../src/i18n.mjs';
const names=JSON.parse(gunzipSync(await readFile(new URL('../data/item-names-v1250.json.gz',import.meta.url))));
test('official item-name pack retains all eight locales and provenance',()=>{
 assert.equal(Object.keys(names.items).length,15705);
 assert.equal(names.source.displayOnly,true);
 assert.equal(names.source.gameVersion,'1.25.0');
 assert.equal(names.source.platformOfSource,'Switch');
 assert.equal(names.items['31300003']['en-US'],'Small Night Thorn');
 assert.match(names.items['31300003'].ja,/闇のトゲ/);
 assert.deepEqual(SUPPORTED_LOCALES,['en-US','de','es','fr','it','ja','pt-BR','zh-CN']);
});
test('browser locale selection recognizes language priorities and saved override',()=>{
 assert.equal(resolveLocale(['en-GB','ja-JP']),'en-US');
 assert.equal(resolveLocale(['pt-PT','en-US']),'pt-BR');
 assert.equal(resolveLocale(['zh-Hans-CN']),'zh-CN');
 assert.equal(resolveLocale(['zh-Hant-TW','fr-FR']),'fr');
 assert.equal(resolveLocale(['pl-PL','xx-XX']),'en-US');
 assert.equal(initialLocale({languages:['ja-JP']},null),'ja');
 assert.equal(initialLocale({languages:['ja-JP']},{getItem:()=> 'de'}),'de');
});
test('language dictionaries have no untranslated important navigation labels',()=>{
 const keys=['official','gameVersion','saveVersion','dropHint','openSave','language','panelRegions','panelCategories','timeNext','timeRefresh','timeGrowth','tab_spawn'];
 for(const locale of SUPPORTED_LOCALES)for(const key of keys)assert.notEqual(translate(locale,key),key,`${locale} / ${key}`);
 assert.equal(categoryName('en-US','障害物'),'Obstacles');
 assert.equal(categoryName('ja','障害物'),'障害物');
 assert.equal(areaName('ja','Urban'),'広場');
 assert.equal(areaName('en-US','Urban'),'Plaza');
});
test('local time conversion preserves the UTC source and rejects nonexistent local wall time',()=>{
 const saved=process.env.TZ;
 try{
  process.env.TZ='Asia/Tokyo';
  assert.equal(parseLocalDateTime('2026-11-01T21:00'),'2026-11-01T12:00:00.000Z');
  assert.match(localDate('2026-11-01T12:00:00Z','ja'),/21:00/);
  process.env.TZ='America/New_York';
  assert.equal(parseLocalDateTime('2026-03-08T02:30'),null);
  assert.equal(parseLocalDateTime('2026-11-01T08:00'),'2026-11-01T13:00:00.000Z');
 }finally{if(saved===undefined)delete process.env.TZ;else process.env.TZ=saved;}
});
test('Steam image manifest does not misidentify Switch derivatives as verified Steam assets',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../data/steam-icons-v1253.json',import.meta.url),'utf8'));
 assert.equal(manifest.source.platform,'Steam/Windows');
 assert.equal(manifest.source.status,'NO_STEAM_ASSET_BYTES_VERIFIED');
 assert.deepEqual(manifest.icons,{});
});

test('semantic timing rows preserve distinct EventID and spawned item identities',async()=>{
 const {indexEvents,projectProfile}=await import('../src/reader.mjs');
 const defs=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
 const snapshot=projectProfile({GameInfo:{Version:626},Player:{},World:{RecurringEvents:{'3':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:'2026-11-01T12:00:00Z'}}}}},indexEvents(defs),{itemNames:names.items});
 const r=snapshot.rows[0];
 assert.equal(r.id,2010000003);
 assert.equal(r.eventName,'NightThornSpawningVillage!UrbanNightThornSpawn');
 assert.equal(r.areaKey,'Urban');
 assert.equal(r.timingKey,'timeNext');
 assert(r.items.length>=2);
 assert.equal(r.items[0].id,31300003);
 assert.equal(r.items[0].names['en-US'],'Small Night Thorn');
 assert.equal(r.items[0].names.ja.includes('闇のトゲ'),true);
 assert.equal(r.writeAuthorized,false);
});
