import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {makeSyntheticP1gProfile} from './fixture.mjs';
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{const bytes=await readFile(fileURLToPath(url));return new Response(bytes,{status:200,headers:{'content-type':String(url).endsWith('.gz')?'application/octet-stream':'application/json'}})};
let reply;
globalThis.self={postMessage:data=>{reply?.(data);}};
await import('../src/worker.mjs');
function send(type,contents='',name='profile.json',options={}){
  const source=Buffer.from(contents,'utf8');
  const buffer=source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength);
  return new Promise((resolve,reject)=>{
    const fail=setTimeout(()=>reject(new Error('Worker did not respond')),3000);
    reply=data=>{clearTimeout(fail);resolve(data)};
    self.onmessage({data:{id:2,type,name,buffer,...options}});
  });
}
const profile={GameInfo:{Version:626},Player:{Name:'TEST'},World:{RecurringEvents:{}}};
test('UTF-8 BOM profile.json is handled and acknowledged',async()=>{
  const result=await send('open','\uFEFF'+JSON.stringify(profile));
  assert.equal(result.ok,true);
  assert.equal(result.format,'json');
  assert.equal(result.view.identity.name,'TEST');
});
test('Worker provides non-mutating read-only shared-date diagnostics for uploaded save',async()=>{
 const special='2126-08-20T00:00:00.000Z';
 const source={GameInfo:{Version:626},Player:{Name:'Fixture'},World:{RecurringEvents:{
  '0':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:special}},
  '1':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:special}},
  '2':{FishSpawningInVillage:{RecurringEventItemID:2010200014,NextOccurrence:'2028-01-01T00:00:00Z'}}
 }}};
 const sourceText=JSON.stringify(source);
 const result=await send('open',sourceText);
 assert.equal(result.ok,true);
 assert.equal(result.view.timingAudit.statuses.SPECIAL_2126_UNRESOLVED,2);
 assert.equal(result.view.timingAudit.shared2126.multiTypePattern,true);
 assert.equal(result.view.timingAudit.shared2126.originVerified,false);
 assert.equal(result.view.timingAudit.autoRepairAllowed,false);
 assert.equal(result.view.timingAudit.writerAuthorized,false);
 assert.equal(result.view.capabilities.editingAllowed,false);
 assert.equal(JSON.stringify(source),sourceText);
});
test('Worker identifies plain JSON container contract without claiming a P1G writer',async()=>{
 const result=await send('open',JSON.stringify(profile));
 assert.equal(result.ok,true);
 assert.equal(result.view.containerAudit.status,'PLAIN_JSON_NO_P1G_ENVELOPE');
 assert.equal(result.view.containerAudit.writerAuthorized,false);
 assert.equal(result.view.containerAudit.editedCopyAuthorized,false);
 assert.equal(result.view.containerAudit.sourceMetadataPresent,false);
});


test('Worker packaged P1G audit is non-mutating and session-scoped backup retains the source bytes',async()=>{
 const p={GameInfo:{Version:626},Player:{Name:'Synthetic'},World:{RecurringEvents:{}}};
 const bytes=makeSyntheticP1gProfile(p);
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const result=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('Worker did not respond')),3000);
  reply=data=>{clearTimeout(timeout);resolve(data)};
  self.onmessage({data:{id:2,type:'open',name:'profile.p1g',buffer}});
 });
 assert.equal(result.ok,true);
 assert.equal(result.format,'packaged');
 const a=result.view.containerAudit;
 assert.equal(a.status,'SIMPLE_ENVELOPE_OBSERVED_REBUILD_UNVERIFIED');
 assert.equal(a.writerAuthorized,false);
 assert.equal(a.bytePreservationVerified,false);
 assert.equal(a.localHeaderObserved,true);
 assert.equal(a.localHeaderFieldsMatchCentral,true);
 assert(a.findings.includes('REBUILT_ZIP_RAW_BYTE_PARITY_NOT_PROVEN'));
 const original=await send('backup','','profile.p1g',{sessionId:result.sessionId});
 assert.equal(original.ok,true);
 assert.deepEqual(new Uint8Array(original.buffer),bytes);
});
test('malformed profile.json returns a visible error result',async()=>{
  const result=await send('open','{invalid');
  assert.equal(result.ok,false);
  assert.equal(typeof result.error,'string');
  assert(result.error.length>0);
});

test('Worker preflight uses the active decoded save and blocks stale session tokens',async()=>{
 const input={GameInfo:{Version:628},Player:{Name:'Synthetic'},World:{RecurringEvents:{
   '12':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z'}}
 }}};
 const source=JSON.stringify(input);
 const opened=await send('open',source,'source.json');
 assert.equal(opened.ok,true);
 assert(Number.isSafeInteger(opened.sessionId));
 const row=opened.view.rows.find(x=>x.id===2010000021);
 const entries=[{pointer:row.pointer,originalTime:row.time,targetTime:'2127-02-01T00:00:00Z'}];
 const result=await send('preflight','', 'source.json',{sessionId:opened.sessionId,entries});
 assert.equal(result.ok,true);
 assert.equal(result.report.rows[0].code,'STRUCTURE_OBSERVED');
 assert.equal(result.compatibility.status,'TIMEKEEPER_FIELD_COMPATIBILITY_RESEARCH_ONLY');
 assert.equal(result.compatibility.rows[0].code,'SCHEMA_VERSION_DRIFT_REVIEW');
 assert.equal(result.compatibility.sourceBuildVerified,false);
 assert.equal(result.compatibility.saveWriterAllowed,false);
 assert.equal(result.compatibility.editedCopyAuthorized,false);
 assert.equal(result.report.schema,628);
 assert.equal(result.report.editedCopyAuthorized,false);
 assert.equal(result.report.writerAuthorized,false);
 const stale=await send('preflight','', 'source.json',{sessionId:opened.sessionId-1,entries});
 assert.equal(stale.ok,false);
 assert.match(stale.error,/stale/);
 const backup=await send('backup','','source.json',{sessionId:opened.sessionId});
 assert.equal(backup.ok,true);
 assert.equal(Buffer.from(backup.buffer).toString('utf8'),source);
 const forbiddenBackup=await send('backup','','source.json',{sessionId:opened.sessionId-1});
 assert.equal(forbiddenBackup.ok,false);
 const newer=await send('open',JSON.stringify(profile),'replacement.json');
 assert.equal(newer.ok,true);
 assert.notEqual(newer.sessionId,opened.sessionId);
 assert.equal((await send('preflight','', 'source.json',{sessionId:opened.sessionId,entries})).ok,false);
});

test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.self;});
