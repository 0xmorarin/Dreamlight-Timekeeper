import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {indexTimingReviewRules,assessTimingSnapshot} from '../src/timing-review.mjs';
import {assessTimekeeperTimingCompatibility} from '../src/core/timekeeper-timing-compatibility.mjs';
const events=indexEvents(JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8')));
const rules=indexTimingReviewRules(JSON.parse(await readFile(new URL('../data/timing-review-rules-v1253.json',import.meta.url),'utf8')));
const future='2126-08-20T00:00:00Z',target='2127-03-01T00:00:00Z';
function save(version=626){
 return {GameInfo:{Version:version},Player:{Name:'Synthetic'},World:{RecurringEvents:{
  '1':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:future}},
  '2':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:future}},
  '3':{FishSpawningInVillage:{RecurringEventItemID:2010200014,NextOccurrence:future}},
  '4':{ItemSpawning:{RecurringEventItemID:2010000064,NextOccurrence:future}},
  '5':{SnippetSpawning:{RecurringEventItemID:2011300000,NextOccurrence:future}}
 }}};
}
const snapshot=p=>assessTimingSnapshot(projectProfile(p,events),rules);
const stage=(s,ids)=>ids.map(id=>{const row=s.rows.find(r=>r.id===id);return {
 pointer:row.pointer,originalTime:row.time,targetTime:target
}});
test('static W1 fields remain research candidates only, intentional long-future values are not corruption',()=>{
 const p=save(),s=snapshot(p),before=JSON.stringify(p);
 const r=assessTimekeeperTimingCompatibility(p,s,stage(s,[2010000021,2010500008]));
 assert.equal(r.summary.researchCandidate,2);
 assert.equal(r.summary.excluded,0);
 assert.equal(r.rows[0].code,'STATIC_W1_RESEARCH_CANDIDATE');
 assert.equal(r.rows[1].code,'STATIC_W1_RESEARCH_CANDIDATE');
 assert(r.rows.every(x=>x.originalFutureDateIsCorruption===false));
 assert(r.rows.every(x=>x.sourceBuildVerified===false&&x.writerAuthorized===false));
 assert.equal(r.editedCopyAuthorized,false);
 assert.equal(r.saveWriterAllowed,false);
 assert.equal(JSON.stringify(p),before);
 assert.throws(()=>r.rows.push({}),TypeError);
});
test('source policy excludes Moonstone Chest, W2 Snippets and inactive W1 definitions',()=>{
 const p=save(),s=snapshot(p);
 const r=assessTimekeeperTimingCompatibility(p,s,stage(s,[2010000064,2011300000,2010200014]));
 assert.deepEqual(r.rows.map(x=>x.code),[
  'MOONSTONE_CHEST_SEPARATE_STATE','FIELD_FAMILY_OUT_OF_SCOPE','DEFINITION_MARKED_INACTIVE'
 ]);
 assert.equal(r.summary.excluded,3);
 assert.equal(r.summary.researchCandidate,0);
});
test('newer schema can be structurally seen but is never semantically or writer accepted',()=>{
 const p=save(650),s=snapshot(p);
 const r=assessTimekeeperTimingCompatibility(p,s,stage(s,[2010000021]));
 assert.equal(r.observedSchema,650);
 assert.equal(r.summary.versionReview,1);
 assert.equal(r.rows[0].code,'SCHEMA_VERSION_DRIFT_REVIEW');
 assert.equal(r.newerVersionReadMayProceed,true);
 assert.equal(r.rows[0].fieldSerializationAccepted,false);
 assert.equal(r.rows[0].sourceNativeSemanticsVerified,false);
 assert.equal(r.exportAvailable,false);
});
test('preflight conflicts and stale original value remain excluded from research eligibility',()=>{
 const p=save(),s=snapshot(p),t=stage(s,[2010000021]);
 p.World.RecurringEvents['1'].ItemSpawning.NextOccurrence='2128-01-01T00:00:00Z';
 const r=assessTimekeeperTimingCompatibility(p,s,t);
 assert.equal(r.rows[0].code,'PREFLIGHT_NOT_STRUCTURALLY_OBSERVED');
 assert.equal(r.summary.excluded,1);
});
test('missing or tampered static rule provenance is rejected',()=>{
 const p=save(),s=snapshot(p),t=stage(s,[2010000021]);
 assert.throws(()=>assessTimekeeperTimingCompatibility(p,{...s,timingReview:{...s.timingReview,evidenceBuildId:'WRONG'}},t),/provenance/);
 assert.throws(()=>assessTimekeeperTimingCompatibility(p,{...s,timingReview:{...s.timingReview,writerAuthorization:true}},t),/provenance/);
 assert.throws(()=>assessTimekeeperTimingCompatibility(p,{...s,timingReview:null},t),/provenance/);
});
