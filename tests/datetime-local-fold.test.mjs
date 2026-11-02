import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
const moduleUrl=new URL('../src/i18n.mjs',import.meta.url).href;
function parseInZone(zone,wall){
 const script='import {parseLocalDateTime} from '+JSON.stringify(moduleUrl)+';process.stdout.write(JSON.stringify(parseLocalDateTime('+JSON.stringify(wall)+')));';
 return JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:zone},encoding:'utf8'}));
}
test('ordinary local time is converted into UTC with its wall time preserved',()=>{
 assert.equal(parseInZone('Asia/Tokyo','2026-11-02T10:15'),'2026-11-02T01:15:00.000Z');
 assert.equal(parseInZone('America/New_York','2026-07-01T13:45'),'2026-07-01T17:45:00.000Z');
});
test('DST spring gap and fall fold must both fail closed',()=>{
 assert.equal(parseInZone('America/New_York','2026-03-08T02:30'),null);
 assert.equal(parseInZone('America/New_York','2026-11-01T01:30'),null);
 assert.equal(parseInZone('America/New_York','2026-11-01T03:30'),'2026-11-01T08:30:00.000Z');
 assert.equal(parseInZone('Australia/Lord_Howe','2026-04-05T01:45'),null);
});
test('malformed calendar dates are rejected while leap days remain valid',()=>{
 assert.equal(parseInZone('Asia/Tokyo','2026-02-30T12:00'),null);
 assert.equal(parseInZone('Asia/Tokyo','2024-02-29T12:00'),'2024-02-29T03:00:00.000Z');
 assert.equal(parseInZone('Asia/Tokyo','2026-11-02T12:00:30'),null);
});
