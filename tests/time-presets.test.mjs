import test from 'node:test';
import assert from 'node:assert/strict';
import {EARLY_ACCESS_RELEASE_DATE,FORMAL_LAUNCH_DATE,resolveTimePreset} from '../src/time-presets.mjs';

test('now uses one clock value and is not a save write',()=>{
 const at=Date.parse('2026-11-02T01:02:03.456Z');
 assert.equal(resolveTimePreset('now',{now:at}),'2026-11-02T01:02:03.456Z');
});
test('100 years preserves the UTC clock and clamps leap day when destination is not leap',()=>{
 const at=Date.parse('2000-02-29T17:25:12.333Z');
 assert.equal(resolveTimePreset('century',{now:at}),'2100-02-28T17:25:12.333Z');
 assert.equal(resolveTimePreset('century',{now:Date.parse('2026-11-02T07:00:00Z')}),'2126-11-02T07:00:00.000Z');
});
test('game release-date preset means local midnight on 2022-09-06, not invented launch instant',()=>{
 assert.equal(EARLY_ACCESS_RELEASE_DATE,'2022-09-06');
 assert.equal(FORMAL_LAUNCH_DATE,'2023-12-05');
 const d=new Date(resolveTimePreset('release',{now:Date.parse('2026-01-01T00:00:00Z')}));
 assert.equal(d.getFullYear(),2022);assert.equal(d.getMonth(),8);assert.equal(d.getDate(),6);
 assert.equal(d.getHours(),0);assert.equal(d.getMinutes(),0);
});
test('unknown presets and non-finite clocks fail',()=>{
 assert.throws(()=>resolveTimePreset('unverified',{now:Date.now()}));
 assert.throws(()=>resolveTimePreset('century',{now:NaN}));
});
