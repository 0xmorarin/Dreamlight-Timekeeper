import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {TAB_ORDER,indexEvents,projectProfile,previewScope,safeText,classifyDate} from '../src/reader.mjs';

const data=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const events=indexEvents(data);
function profile(){return {GameInfo:{Version:626,LastCustomIdOwner:'TEST_PLAYER',Created:'2025-01-01T00:00:00Z',Modified:'2026-10-31T09:12:00Z'},Player:{Name:'Test Player'},World:{RecurringEvents:{'0':{FishSpawningInVillage:{RecurringEventItemID:2010200014,NextOccurrence:'2026-11-02T00:00:00Z'}},'1':{ItemSpawning:{RecurringEventItemID:2010000064,NextOccurrence:'2026-11-02T00:00:00Z'}},'2':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:'2126-08-20T00:00:00Z'}},'3':{SnippetSpawning:{RecurringEventItemID:2011300000,NextOccurrence:'2027-08-01T11:13:00Z'}}},Stores:[{BuildingItemID:20300028,LastRefresh:'2026-10-30T00:00:00Z',Displays:[{DisplayInfo:{LastRefresh:'2026-10-29T00:00:00Z'}}]}],Shops:[{shopName:'Goofy',Data:{LastRefresh:'2019-01-01T00:00:00Z'}}]}}}
test('four tabs retain approved order and default',()=>{assert.deepEqual(TAB_ORDER.map(x=>x[0]),['spawn','resources','shops','daily'])});
test('event registry contains 508 distinct definitions',()=>{assert.equal(events.size,508)});
test('snippet and moonstone events go to their approved independent tabs',()=>{assert.equal(events.get(2011300000).tab,'spawn');assert.equal(events.get(2010000064).tab,'daily')});
test('nobr formatting is not exposed as markup',()=>{assert.equal(safeText('<nobr>小さな</nobr>\u200b<nobr>闇のトゲ</nobr>'),'小さな闇のトゲ')});
test('all profile observations remain read only',()=>{const p=profile(),prior=JSON.stringify(p),snapshot=projectProfile(p,events);assert.equal(JSON.stringify(p),prior);assert.equal(snapshot.identity.playerId,'TEST_PLAYER');assert.equal(snapshot.identity.buildId,null);assert.equal(snapshot.capabilities.editingAllowed,false);assert.equal(snapshot.rows.every(r=>r.writeAuthorized===false),true);assert(snapshot.rows.some(r=>r.tab==='resources'&&r.id===2010200014));assert(snapshot.rows.some(r=>r.tab==='daily'&&r.id===2010000064));assert(snapshot.rows.some(r=>r.tab==='spawn'&&r.id===2011300000));assert(snapshot.rows.some(r=>r.tab==='shops'&&r.kind==='DisplayInfo.LastRefresh'))});
test('future sentinel remains flagged and unmodified',()=>{const snapshot=projectProfile(profile(),events);const r=snapshot.rows.find(r=>r.id===2010500008);assert.equal(r.status,'SPECIAL_2126_UNRESOLVED');assert.equal(classifyDate('2126-08-20T00:00:00Z'),'SPECIAL_2126_UNRESOLVED')});
test('bulk preview never mutates the source and denies writes',()=>{const snapshot=projectProfile(profile(),events);const prior=JSON.stringify(snapshot);const result=previewScope(snapshot,{tab:'spawn',mode:'custom',customTime:'2026-10-31T10:00:00Z'});assert.equal(result.status,'PREVIEW_ONLY_NO_MUTATION');assert(result.affected.length>0);assert(result.affected.every(x=>x.writeAuthorized===false));assert.equal(JSON.stringify(snapshot),prior)});
test('unknown event IDs are not treated as writable',()=>{const p=profile();p.World.RecurringEvents['8']={ItemSpawning:{RecurringEventItemID:999999999,NextOccurrence:'2026-11-01T00:00:00Z'}};const result=projectProfile(p,events);const r=result.rows.find(x=>x.id===999999999);assert.equal(r.policy,'HOLD');assert.match(r.reason,/存在しない/);assert.equal(r.writeAuthorized,false)});
test('alternate schema does not enable edits',()=>{const p=profile();p.GameInfo.Version=624;const r=projectProfile(p,events);assert.equal(r.capabilities.schemaRecognized,false);assert.equal(r.capabilities.editingAllowed,false)});
test('bad timestamp is diagnostic and excluded from writes',()=>{const p=profile();p.World.RecurringEvents['0'].FishSpawningInVillage.NextOccurrence='invalid';const r=projectProfile(p,events).rows.find(x=>x.id===2010200014);assert.equal(r.status,'INVALID');assert.equal(r.time,null);assert.equal(r.writeAuthorized,false)});

test('wood and other forage show as separate read-only source classifications',()=>{
 const p=profile();
 p.World.RecurringEvents['42']={ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z'}};
 p.World.RecurringEvents['43']={ItemSpawning:{RecurringEventItemID:2010000113,NextOccurrence:'2126-08-20T00:00:00Z'}};
 const before=JSON.stringify(p);
 const rows=projectProfile(p,events).rows;
 const wood=rows.find(r=>r.id===2010000021),cinnamon=rows.find(r=>r.id===2010000113);
 assert.equal(wood.group,'自然資源');
 assert.equal(wood.subgroup,'木材・落下枝');
 assert.equal(cinnamon.subgroup,'その他の落下素材');
 assert.equal(wood.writeAuthorized,false);
 assert.equal(cinnamon.writeAuthorized,false);
 assert.equal(JSON.stringify(p),before);
});
