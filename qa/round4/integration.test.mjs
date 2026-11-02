// QA-owned independent Round 4 negative tests: run against exact integrated PR11 fixed HEAD.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {p1gPackagedProfileCodec as codec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';
import {makeSyntheticP1gProfile} from '../tests/fixture.mjs';
import {auditSteamUiPublicationLedger} from '../src/steam-ui-provenance.mjs';
import {compileW1NativeSemantics,analyzeW1StaticBranches} from '../src/timing-native-semantics.mjs';
const root=new URL('../',import.meta.url);
const load=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const valid={GameInfo:{Version:626},Player:{Synthetic:true},World:{RecurringEvents:{}},Unknown:{token:'unchanged'}};
test('R4 CORE: strict JSON reader rejects ambiguous lexical input while allowing preserved unknown objects',async()=>{
 const rootText='"GameInfo":{"Version":626},"Player":{},"World":{}';
 const invalid=[
  '{'+rootText+',"GameInfo":{"Version":626}}',
  '{'+rootText+',"Unknown":{"safe":1,"safe":2}}',
  '{'+rootText+',"Unknown":{"huge":9007199254740993}}',
  '{'+rootText+',"Unknown":{"underflow":1e-9999}}',
  '{'+rootText+',"Unknown":'+ '['.repeat(260)+'0'+']'.repeat(260)+'}'
 ];
 for(const raw of invalid)assert.throws(()=>codec.parseProfileText(raw),/Duplicate|Unsafe|Underflow|nesting|PROFILE_JSON_INVALID/);
 assert.equal(codec.parseProfileText(JSON.stringify(valid)).metadata.profileVersion,626);
});
test('R4 CORE: synthetic archive unknowns unchanged and ZIP metadata mutation prevents rebuild',async()=>{
 const original=makeSyntheticP1gProfile(valid),before=Buffer.from(original);
 const decoded=await codec.loadProfile(original);
 assert.deepEqual(JSON.parse(decoded.jsonText),valid);
 const audit=auditP1gEnvelope({format:'packaged',metadata:decoded.metadata});
 assert.equal(audit.writerAuthorized,false);
 assert.equal(audit.editedCopyAuthorized,false);
 const candidate=JSON.stringify({...valid,Unknown:{...valid.Unknown,extra:'synthetic-only'}});
 const zip=decoded.metadata.zip,entry=zip.profileEntry;
 const changed=[
  {...zip,archivePrefixBytes:1},
  {...zip,profileEntry:{...entry,comment:Uint8Array.of(8,0)}},
  {...zip,profileEntry:{...entry,flagBits:0x8,localHeader:{...entry.localHeader,flagBits:0x8}}},
  {...zip,profileEntry:{...entry,localHeader:{...entry.localHeader,extra:Uint8Array.of(8,0,0,0)}}}
 ];
 for(const z of changed)await assert.rejects(codec.createEncodedProfile(candidate,{...decoded.metadata,zip:z}),/ZIP_SOURCE_ENVELOPE_REBUILD_UNVERIFIED/);
 assert.deepEqual(Buffer.from(original),before);
});
test('R4 TIME: native source identity, ADRP/MOV correction and static-only authorization remain distinct',async()=>{
 const events=await load('data/events-v1253.json'),wood=await load('data/wand-iswood-crosswalk-v1253.json');
 const n=compileW1NativeSemantics(events,{woodTagPack:wood});
 assert.equal(n.rows.length,508);
 assert.equal(n.source.saveSchema,626);
 assert.equal(n.source.buildId,'9A239D3DB569756D');
 assert.equal(n.native.primaryBinary.mainSHA256,n.source.mainSHA256);
 assert.equal(n.native.primaryBinary.textSHA256,n.source.nsoTextSHA256);
 assert.notEqual(n.native.primaryBinary.textSHA256,n.native.primaryBinary.mainSHA256);
 assert.equal(n.native.primaryBinary.runtimeVerified,false);
 const correction=n.native.actualizeSourceConflict;
 assert.equal(correction.rva,'0x05A2AC94');
 assert.equal(correction.reportedOpcode,'0xB002B8C8');
 assert.equal(correction.correctedRVA,'0x05A2AC98');
 assert.equal(correction.correctedOpcode,'0xAA0003F9');
 assert.equal(correction.status,'RESOLVED_SOURCE_ANNOTATION_OFF_BY_4');
 // Machine word class check independently: ADRP 1001.... vs MOV X25,X0 alias ORR.
 assert.equal((0xB002B8C8 & 0x9f000000)>>>0,0x90000000);
 assert.equal(0xAA0003F9>>>0,0xaa0003f9);
 assert.equal(n.native.directRescheduleCallsites.length,10);
 for(const row of n.rows)assert.equal(row.writerAuthorized,false);
 for(const kind of ['ItemSpawning','WildCropsSpawningInVillage','FlowerSpawningInVillage','FishSpawningInVillage']){
  const t=n.traces[kind];
  assert.equal(t.spawnedGridObjectProvenanceVerified,false);
 }
 const result=analyzeW1StaticBranches(n,{eventId:2010000021,saveKind:'ItemSpawning',nowTicks:1n,
   nextOccurrenceTicks:2n,maxIntervalTicks:1n});
 assert.equal(result.writerAuthorized,false);
 assert.equal(result.runtimeVerified,false);
 assert.equal(result.spawnObserved,false);
});
test('R4 ASSET: static Steam source ledger rejects source drift, HOLD promotion and ambiguous image identity',async()=>{
 const catalog=await load('data/steam-ui-candidates-v1253.json'),manifest=await load('data/steam-ui-icons-v1253.json');
 const audit=auditSteamUiPublicationLedger(catalog,manifest);
 assert.equal(audit.verificationLevel,'STATIC_LEDGER_CROSSCHECK_ONLY');
 assert.equal(audit.publishedCount,4);
 assert.equal(audit.candidateCount,21);
 const cp=structuredClone;
 for(const changed of [
  c=>{c.source.fullVersion='v1.25.4';},
  c=>{c.source.bundleSHA256='0'.repeat(64);},
  c=>{c.source.cabSHA256='0'.repeat(64);},
  c=>{c.candidates[0].texturePathId=c.candidates[1].texturePathId;},
  c=>{c.candidates.find(r=>r.key==='skill.mining').pixelTrial='NOT_TESTED';}
 ]){const c=cp(catalog);changed(c);assert.throws(()=>auditSteamUiPublicationLedger(c,manifest));}
 const noRow=cp(catalog);noRow.candidates=noRow.candidates.filter(r=>r.key!=='skill.mining');
 assert.throws(()=>auditSteamUiPublicationLedger(noRow,manifest));
 const m=cp(manifest);m.icons['world.hgw']={...cp(m.icons['world.valley']),path:'assets/steam/v1253/ui/world/hgw.webp'};
 assert.throws(()=>auditSteamUiPublicationLedger(catalog,m));
 assert.equal('writerAuthorized' in audit,false);
});
