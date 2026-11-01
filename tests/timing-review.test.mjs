import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {indexTimingReviewRules,assessTimingRow,assessTimingSnapshot} from '../src/timing-review.mjs';
import {validTime,indexEvents,projectProfile} from '../src/reader.mjs';

const rules=JSON.parse(await readFile(new URL('../data/timing-review-rules-v1253.json',import.meta.url),'utf8'));
const events=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const index=indexTimingReviewRules(rules),registry=indexEvents(events);
const at=Date.parse('2026-11-01T12:00:00Z');
const profile=()=>({GameInfo:{Version:626},Player:{Name:'TEST'},World:{
 RecurringEvents:{
  '0':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:'2026-11-02T10:00:00Z'}},
  '1':{ItemSpawning:{RecurringEventItemID:2010000064,NextOccurrence:'2026-11-02T10:00:00Z'}},
  '2':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:'2126-08-20T00:00:00Z'}},
  '3':{ItemSpawning:{RecurringEventItemID:99999999,NextOccurrence:'2026-11-02T10:00:00Z'}},
  '4':{FishSpawningInVillage:{RecurringEventItemID:2010200014,NextOccurrence:'2026-11-02T10:00:00Z'}}
 },
 Stores:[{BuildingItemID:20300028,LastRefresh:'2019-01-01T00:00:00Z'}]
}});
test('index rules are versioned, revisable and explicitly never writer-authorized',()=>{
 assert.equal(index.source.revision,1);
 assert.equal(index.source.writerAuthorization,false);
 assert.equal(index.rules.size,21);
 for(const changed of [
  {source:{...rules.source,writerAuthorization:true}},
  {source:{...rules.source,buildId:'WRONG'}},
  {source:{...rules.source,schema:624}}
 ])assert.throws(()=>indexTimingReviewRules({...rules,...changed}));
 const repeat={...rules,rules:[...rules.rules,rules.rules[0]]};
 assert.throws(()=>indexTimingReviewRules(repeat),/Ambiguous/);
});
test('ordinary W1, anomalous 2126, moonstone, unknown, inactive and old shop timestamp do not converge',()=>{
 const original=projectProfile(profile(),registry,{now:at}),before=JSON.stringify(original);
 const view=assessTimingSnapshot(original,index);
 assert.equal(JSON.stringify(original),before);
 const by=id=>view.rows.find(x=>x.id===id)?.review;
 assert.equal(by(2010000003).status,'RESEARCH_CANDIDATE');
 assert.equal(by(2010000064).status,'CONDITIONAL_REVIEW');
 assert.equal(by(2010500008).status,'HOLD_2126_UNKNOWN');
 assert.equal(by(99999999).status,'HOLD_UNKNOWN_EVENT');
 assert.equal(by(2010200014).status,'HOLD_INACTIVE_EVENT');
 assert.equal(view.rows.find(x=>x.kind==='StoreInfo.LastRefresh').review.status,'HOLD_INITIALIZATION_ORIGIN');
 assert.equal(view.rows.every(x=>x.writeAuthorized===false&&x.review.writerAuthorized===false),true);
 assert.equal(view.timingReview.writerAuthorization,false);
});
test('rule changes remain observations and do not authorize writes',()=>{
 const revised=structuredClone(rules);
 revised.source.revision=2;
 revised.rules.find(x=>x.kind==='ItemSpawning').classification='CONDITIONAL_REVIEW';
 const sample=projectProfile(profile(),registry,{now:at}).rows.find(x=>x.id===2010000003);
 const decision=assessTimingRow(sample,indexTimingReviewRules(revised));
 assert.equal(decision.status,'CONDITIONAL_REVIEW');
 assert.equal(decision.ruleRevision,2);
 assert.equal(decision.writerAuthorized,false);
 assert.equal(decision.editedCopyAuthorized,false);
});
test('calendar rollover and non-leap day are excluded while nanosecond UTC stays valid',()=>{
 assert.equal(validTime('2026-02-30T10:00:00Z'),false);
 assert.equal(validTime('2026-02-29T10:00:00Z'),false);
 assert.equal(validTime('2024-02-29T10:00:00.123456789Z'),true);
 assert.equal(validTime('2026-11-01T23:59:59.999999999Z'),true);
});
test('schema mismatch and conflicting oneof structures fail closed',()=>{
 const snapshot=projectProfile(profile(),registry,{now:at});
 const row=snapshot.rows.find(x=>x.id===2010000003);
 assert.equal(assessTimingRow(row,index,{schema:624}).status,'HOLD_SCHEMA');
 assert.equal(assessTimingRow({...row,structureValid:false},index).status,'HOLD_STRUCTURE');
 assert.equal(assessTimingRow({...row,status:'DISTANT_FUTURE_UNVERIFIED'},index).status,'HOLD_DISTANT_FUTURE');
});
