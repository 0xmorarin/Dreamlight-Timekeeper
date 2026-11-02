// 05 QR / Round 5: independent, synthetic-only, exact PR11 SHA executed by CI.
// This file never grants write authority to any edited real save.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
import {p1gPackagedProfileCodec as codec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {makeSyntheticP1gProfile} from '../tests/fixture.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';
import {compileW1NativeSemantics,analyzeW1StaticBranches} from '../src/timing-native-semantics.mjs';
import {auditSteamUiPublicationLedger} from '../src/steam-ui-provenance.mjs';
const json=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
const valid={GameInfo:{Version:626},Player:{Name:'Independent R5'},World:{RecurringEvents:{}},Opaque:{keep:[true,{'12':'twelve','2':'two'}]}};
test('R5 CORE decimal/exponent unsafe integer aliases and unicode-escaped duplicate keys fail closed',async()=>{
 const metadata=(await codec.loadProfile(makeSyntheticP1gProfile(valid))).metadata;
 const prefix='"GameInfo":{"Version":626},"Player":{},"World":{},';
 for(const unsafe of [
   '{"value":9007199254740993.0}',
   '{"value":9.007199254740993e15}',
   '{"value":1e20}',
   '{"value":-1e20}',
   '{"nested":{"safe":1,"\\u0073afe":2}}',
   '{"value":1e-9999}'
 ]) {
   const text='{'+prefix+'"Opaque":'+unsafe+'}';
   assert.throws(()=>parseSafeJson(text),/Unsafe JSON integer|Duplicate JSON object key|Underflowed JSON number/);
   assert.throws(()=>codec.parseProfileText(text),/Unsafe JSON integer|Duplicate JSON object key|Underflowed JSON number/);
   await assert.rejects(codec.createEncodedProfile(text,metadata),/Unsafe JSON integer|Duplicate JSON object key|Underflowed JSON number/);
 }
 for(const safe of ['{"value":6.26e2}', '{"value":0.125}', '{"value":9007199254740991e0}']){
   const text='{'+prefix+'"Opaque":'+safe+'}';
   assert.equal(codec.parseProfileText(text).metadata.profileVersion,626);
 }
});
test('R5 CORE serializer semantic roundtrip: synthetic unknown JSON and exact changed path only',async()=>{
 const raw=makeSyntheticP1gProfile(valid),before=Buffer.from(raw);
 const loaded=await codec.loadProfile(raw);
 const edited=structuredClone(parseSafeJson(loaded.jsonText));
 edited.Opaque.keep.push({later:{text:'00021',fraction:0.125}});
 const serialized=JSON.stringify(edited);
 const output=await codec.createEncodedProfile(serialized,loaded.metadata);
 const opened=await codec.loadProfile(output);
 assert.deepEqual(parseSafeJson(opened.jsonText),edited);
 assert.deepEqual(diffPaths(parseSafeJson(loaded.jsonText),parseSafeJson(opened.jsonText)),['/Opaque/keep/2']);
 assert.deepEqual(Buffer.from(raw),before);
 assert.equal(auditP1gEnvelope({format:'packaged',metadata:loaded.metadata}).writerAuthorized,false);
});
test('R5 CORE caller-owned ZIP metadata mutation after codec starts cannot change observed archive',async()=>{
 const raw=makeSyntheticP1gProfile(valid),loaded=await codec.loadProfile(raw);
 const src=loaded.metadata.zip.profileEntry;
 const caller={...src,extra:src.extra.slice(),comment:src.comment.slice()};
 const metadata={...loaded.metadata,zip:{...loaded.metadata.zip,profileEntry:caller}};
 const candidate=JSON.stringify({...valid,Opaque:{keep:'snapshot safety'}});
 const job=codec.createEncodedProfile(candidate,metadata);
 caller.flagBits=8;
 caller.compressType=0;
 caller.createSystem=1;
 caller.dosTime=0;
 caller.dosDate=0;
 caller.extra=Uint8Array.of(1);
 caller.comment=Uint8Array.of(1);
 metadata.zip.profileEntry={...caller};
 const encrypted=await job,reopened=await codec.loadProfile(encrypted);
 assert.equal(reopened.metadata.zip.profileEntry.flagBits,src.flagBits);
 assert.equal(reopened.metadata.zip.profileEntry.compressType,src.compressType);
 assert.equal(reopened.metadata.zip.profileEntry.createSystem,src.createSystem);
 assert.equal(reopened.metadata.zip.profileEntry.dosTime,src.dosTime);
 assert.equal(reopened.metadata.zip.profileEntry.dosDate,src.dosDate);
 assert.deepEqual(parseSafeJson(reopened.jsonText).Opaque,{keep:'snapshot safety'});
 assert.equal(auditP1gEnvelope({format:'packaged',metadata:loaded.metadata}).editedCopyAuthorized,false);
});
test('R5 TIME static W1 max interval uses variant-specific formula with no object-count guarantee',async()=>{
 const n=compileW1NativeSemantics(await json('data/events-v1253.json'),{woodTagPack:await json('data/wand-iswood-crosswalk-v1253.json')});
 assert.equal(n.rows.length,508);
 const checks=[
  ['ItemSpawning','MinNumberOfSpawn',true],
  ['WildCropsSpawningInVillage','NumberOfGardensToSpawn',true],
  ['FlowerSpawningInVillage','NumberOfFlowersToSpawn',true],
  ['FishSpawningInVillage',null,false]
 ];
 for(const [kind,divisor,division] of checks){
  const x=n.native.catchupByVariant[kind];
  assert.equal(x.finalObjectCountGuarantee,false);
  assert.equal(x.divisionRVA!==null,division);
  if(divisor)assert.equal(x.amountField,divisor);
  assert.match(x.formula,/intervalTicks/);
 }
 assert.match(n.native.catchupByVariant.FishSpawningInVillage.formula,/MaxNumberOfPendingFishes/);
 assert.equal(n.native.catchupByVariant.FishSpawningInVillage.divisionRVA,null);
 assert(n.rows.every(r=>!r.writerAuthorized&&!r.editedExportAuthorized));
});
test('R5 TIME IsEventOver uses NextOccurrence > EndDate, and fish dispatcher does not prove reschedule',async()=>{
 const n=compileW1NativeSemantics(await json('data/events-v1253.json'),{woodTagPack:await json('data/wand-iswood-crosswalk-v1253.json')});
 const ex=n.native.expiry;
 assert.equal(ex.condition,'masked NextOccurrence > masked EndDate');
 assert.equal(ex.nextOccurrenceGetterSlot,1);
 assert.equal(ex.endDateGetterSlot,3);
 assert.equal(ex.saveEffectVerified,false);
 assert.equal(ex.runtimeVerified,false);
 const rm=n.native.pendingFishRemoval;
 assert.equal(rm.method,'ProfileWorld.RemovePendingFish');
 assert.equal(rm.dispatcherSlotArgument,39);
 assert.equal(rm.directRescheduleCall,false);
 assert.equal(rm.indirectRescheduleViaDispatcherVerified,false);
 assert.equal(rm.pickupOutcomeVerified,false);
 assert.equal(rm.saveWriteVerified,false);
 const fish=n.query(2010200014,'FishSpawningInVillage');
 assert.equal(fish.status,'INACTIVE_SOURCE_DEFINITION');
 assert.equal(fish.pickupOrRemovalRescheduleVerified,false);
 assert.equal(fish.writerAuthorized,false);
 const future=analyzeW1StaticBranches(n,{eventId:2010000021,saveKind:'ItemSpawning',nowTicks:100n,nextOccurrenceTicks:200n,maxIntervalTicks:10n});
 assert.equal(future.writerAuthorized,false);
 assert.equal(future.spawnObserved,false);
});
test('R5 ASSET HOLD trial must not contaminate published manifest, candidate review or public asset list',async()=>{
 const c=await json('data/steam-ui-candidates-v1253.json'),m=await json('data/steam-ui-icons-v1253.json');
 const audit=auditSteamUiPublicationLedger(c,m);
 assert.equal(audit.verificationLevel,'STATIC_LEDGER_CROSSCHECK_ONLY');
 assert.equal(audit.publishedCount,4);
 assert.equal(audit.candidateCount,21);
 assert.deepEqual(audit.heldKeys,['tab.shops','tab.daily','world.hgw']);
 for(const k of audit.heldKeys){
  assert(!Object.hasOwn(m.icons,k),'HOLD key leaked into public manifest: '+k);
  const row=c.candidates.find(x=>x.key===k);
  assert.equal(row.semanticUseProof,'UNKNOWN');
  assert.ok(row.holdEvidence&&row.holdEvidence.length>8);
  assert.ok(row.reviewState.startsWith('HOLD_'));
 }
 const changed=structuredClone(c);
 changed.candidates.find(x=>x.key==='world.hgw').semanticUseProof='CONFIRMED';
 assert.throws(()=>auditSteamUiPublicationLedger(changed,m),/Malformed/);
 const missing=structuredClone(c);
 delete missing.candidates.find(x=>x.key==='tab.daily').holdEvidence;
 assert.throws(()=>auditSteamUiPublicationLedger(missing,m),/Malformed/);
 const added=structuredClone(m);
 added.icons['world.hgw']={...added.icons['world.valley'],path:'assets/steam/v1253/ui/world/hgw.webp'};
 assert.throws(()=>auditSteamUiPublicationLedger(c,added));
});
