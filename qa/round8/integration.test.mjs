// Round8 independent fixed-integration negative acceptance: synthetic input only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDecipheriv,createCipheriv} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {makeSyntheticP1gProfile} from '../tests/fixture.mjs';
import {p1gPackagedProfileCodec as codec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
import {runSyntheticWorkerProbe} from '../tests/p1g-worker-memory-probe.mjs';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
import {auditSteamUiConsumerLinks,auditSteamUiPublicationLedger} from '../src/steam-ui-provenance.mjs';

const read=async name=>JSON.parse(await readFile(new URL('../'+name,import.meta.url),'utf8'));
const KEY=Buffer.from('62357168683873614a38556c444a557a545a5864325467366d626f3857386e35','hex');
const source=()=>({GameInfo:{Version:626},Player:{Name:'QR Synthetic'},World:{RecurringEvents:{
 '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z',
    Unrecognized:{array:[null,'001',false]}}}},Other:{list:[{key:'2'},null,'keep']}});
function transform(original,mutate){
 const dec=createDecipheriv('aes-256-ecb',KEY,null);
 const zip=Buffer.concat([dec.update(original),dec.final()]);
 const changed=mutate(zip);
 const enc=createCipheriv('aes-256-ecb',KEY,null);
 return new Uint8Array(Buffer.concat([enc.update(changed),enc.final()]));
}
test('R8 CORE synthetic encode/reopen only exact timestamp delta and immutable source',async()=>{
 const original=source(),input=makeSyntheticP1gProfile(original),before=Buffer.from(input);
 const initial=await codec.loadProfile(input),p=parseSafeJson(initial.jsonText),edited=structuredClone(p);
 edited.World.RecurringEvents['0'].ItemSpawning.NextOccurrence='2127-01-01T00:00:00.000Z';
 const expected='/World/RecurringEvents/0/ItemSpawning/NextOccurrence';
 assert.deepEqual(diffPaths(p,edited),[expected]);
 const encoded=await codec.createEncodedProfile(JSON.stringify(edited),initial.metadata);
 const reloaded=parseSafeJson((await codec.loadProfile(encoded)).jsonText);
 assert.deepEqual(reloaded,edited);
 assert.deepEqual(diffPaths(p,reloaded),[expected]);
 assert.deepEqual(reloaded.World.Other,p.World.Other);
 assert.deepEqual(reloaded.World.RecurringEvents['0'].ItemSpawning.Unrecognized,p.World.RecurringEvents['0'].ItemSpawning.Unrecognized);
 assert.deepEqual(Buffer.from(input),before);
 assert.equal(auditP1gEnvelope({format:'packaged',metadata:initial.metadata}).writerAuthorized,false);
});
test('R8 CORE physically present ZIP archive/member comments remain read-only but never re-encodable',async()=>{
 const baseline=makeSyntheticP1gProfile(source()),before=Buffer.from(baseline);
 const mods=[
  [zip=>{const at=zip.length-22,comment=Buffer.from('QR','ascii'),out=Buffer.concat([zip,comment]);
    out.writeUInt16LE(comment.length,at+20);return out;},/ZIP_UNSUPPORTED_ARCHIVE_COMMENT_FOR_MODIFIED_ENCODE/],
  [zip=>{const end=zip.length-22,central=zip.readUInt32LE(end+16),centralEnd=central+46+zip.readUInt16LE(central+28)+zip.readUInt16LE(central+30),
     comment=Buffer.from('qrc','ascii'),out=Buffer.concat([zip.subarray(0,centralEnd),comment,zip.subarray(centralEnd)]);
    out.writeUInt16LE(comment.length,central+32);
    out.writeUInt32LE(zip.readUInt32LE(end+12)+comment.length,end+comment.length+12);
    return out;},/ZIP_SOURCE_ENVELOPE_REBUILD_UNVERIFIED/]
 ];
 for(const [mutate,rejection] of mods){
  const changed=transform(baseline,mutate),cipherBackup=Buffer.from(changed);
  const readback=await codec.loadProfile(changed);
  assert.deepEqual(parseSafeJson(readback.jsonText),source());
  const gate=auditP1gEnvelope({format:'packaged',metadata:readback.metadata});
  assert.equal(gate.repackageShapeObserved,false);
  assert.equal(gate.writerAuthorized,false);
  await assert.rejects(codec.createEncodedProfile(JSON.stringify({...source(),test:2}),readback.metadata),rejection);
  assert.deepEqual(Buffer.from(changed),cipherBackup);
 }
 assert.deepEqual(Buffer.from(baseline),before);
});
test('R8 CORE matching synthetic ZIP extras and descriptor flag cannot authorize source rebuild',async()=>{
 const baseline=makeSyntheticP1gProfile(source()),before=Buffer.from(baseline);
 const extra=Buffer.from([0x34,0x12,0x00,0x00]);
 const mutated=transform(baseline,zip=>{
  const e=zip.length-22,c=zip.readUInt32LE(e+16),cs=zip.readUInt32LE(e+12);
  const localEnd=30+zip.readUInt16LE(26);
  const withLocal=Buffer.concat([zip.subarray(0,localEnd),extra,zip.subarray(localEnd)]);
  const newCentral=c+extra.length,centralNameEnd=newCentral+46+withLocal.readUInt16LE(newCentral+28);
  const out=Buffer.concat([withLocal.subarray(0,centralNameEnd),extra,withLocal.subarray(centralNameEnd)]);
  const newEocd=e+extra.length*2;
  out.writeUInt16LE(extra.length,28);
  out.writeUInt16LE(extra.length,newCentral+30);
  out.writeUInt32LE(newCentral,newEocd+16);
  out.writeUInt32LE(cs+extra.length,newEocd+12);
  return out;
 });
 const first=await codec.loadProfile(mutated);
 assert.deepEqual(parseSafeJson(first.jsonText),source());
 assert.deepEqual(Buffer.from(first.metadata.zip.profileEntry.extra),extra);
 assert.deepEqual(Buffer.from(first.metadata.zip.profileEntry.localHeader.extra),extra);
 const gate=auditP1gEnvelope({format:'packaged',metadata:first.metadata});
 assert.equal(gate.localExtraMatchesCentral,true);
 assert.equal(gate.repackageShapeObserved,false);
 await assert.rejects(codec.createEncodedProfile(JSON.stringify({...source(),test:1}),first.metadata),/ZIP_SOURCE_ENVELOPE_REBUILD_UNVERIFIED/);
 const meta=structuredClone(first.metadata);
 meta.zip.profileEntry.flagBits|=8;meta.zip.profileEntry.localHeader.flagBits|=8;
 const flagged=auditP1gEnvelope({format:'packaged',metadata:meta});
 assert.equal(flagged.repackageShapeObserved,false,'synthetic descriptor flag alone is not valid rebuild proof');
 assert.equal(flagged.writerAuthorized,false);
 assert.deepEqual(Buffer.from(baseline),before);
});
test('R8 CORE Node Worker diagnostic measurements cannot claim Chromium peak acceptance',async()=>{
 const report=await runSyntheticWorkerProbe(1);
 assert.equal(report.environment,'NODE_WORKER_THREADS_NOT_BROWSER_WORKER');
 assert.equal(report.memoryEvidence,'SNAPSHOTS_NOT_PEAK');
 assert.equal(report.browserWorkerPeakAccepted,false);
 assert.equal(report.runtimeSaveAccepted,false);
 assert.equal(report.workerNoEncode,true);
 assert.equal(report.writerAuthorized,false);
 assert.equal(report.editedCopyAuthorized,false);
 assert.equal(report.workerReadings.afterJsonParse.rssProcessWide>0,true);
 await assert.rejects(runSyntheticWorkerProbe(25),/Synthetic MiB/);
});
const decodeBL=(site,word)=>{assert.equal((word&0xfc000000)>>>0,0x94000000);let i=word&0x3ffffff;if(i&0x2000000)i-=0x4000000;return (site+i*4)>>>0};
test('R8 TIME owner-keyed counts, capped WildCrops count, and reschedule slot62 stay STATIC_ONLY',async()=>{
 const registry=await read('data/events-v1253.json'),woodTagPack=await read('data/wand-iswood-crosswalk-v1253.json');
 const n=compileW1NativeSemantics(registry,{woodTagPack}),a=n.native.itemOwnerGroupedCount,b=n.native.wildCropsBoundedExistingCount,c=n.native.clientRecurringRescheduleNotification;
 assert.equal(a.closureType,'Dictionary<int,int>');
 assert.equal(a.argumentType,'Nullable<int> playerId');
 assert.equal(a.closureField,'numberOfItemsOnValidGrid');
 assert.equal(decodeBL(0x057BC0EC,0x94000D8D),0x057BF720);
 assert.equal(decodeBL(0x057BC5EC,0x94000C4D),0x057BF720);
 assert.equal(a.amountWithStateAssignedPlayerRVA,'0x057BC5C4');
 assert.equal(a.recordedValueNotProofOfTotalGridObjects,true);
 assert.equal(a.activeConditionalEventAttributionUnverified,true);
 assert.equal(b.helperRVA,'0x057C49A0');
 assert.equal(b.closureMaxFieldOffset,'0x10');
 assert.equal(b.gridSelectorInterfaceSlot,6);
 assert.equal(b.isCappedEnumeratorNotNativeIntervalMax,true);
 assert.equal(b.exactPerItemFilterAndEffectiveGridCompleteness,'UNKNOWN');
 assert.equal(b.successfulGardenSpawnObserved,false);
 assert.equal(c.dispatcherInterfaceSlot,62);
 assert.equal(c.fishRemovedDispatcherInterfaceSlot,39);
 assert.notEqual(c.dispatcherInterfaceSlot,c.fishRemovedDispatcherInterfaceSlot);
 assert.equal(c.clientHandlerDirectRescheduleCall,false);
 assert.equal(c.notificationFiredByEverySetterVerified,false);
 assert.equal(c.actualizeRaisesRescheduleNotificationVerified,false);
 assert.equal(c.handlerSubscriptionRuntimeVerified,false);
 assert.equal(c.normalSaveTimingVerified,false);
 assert.equal(c.profileAddNotificationConditionalOnDispatcher,true);
 const mov=Number.parseInt(c.profileAddNotificationSlotOpcode,16);
 assert.equal(mov&31,2);assert.equal((mov>>>5)&0xffff,62);
 assert.equal(n.native.primaryBinary.runtimeVerified,false);
 for(const [id,kind] of [[2010000021,'ItemSpawning'],[2010400001,'WildCropsSpawningInVillage'],[2010500008,'FlowerSpawningInVillage']]){
   const q=n.query(id,kind);assert.equal(q.writerAuthorized,false);assert.equal(q.operationEvidence,'BLOCKED');
 }
});
test('R8 ASSET HUD PPtr-shaped world.hgw source evidence is never visual runtime or redistribution authority',async()=>{
 const [c,consumer,m]=await Promise.all([read('data/steam-ui-candidates-v1253.json'),read('data/steam-ui-consumer-links-v1253.json'),read('data/steam-ui-icons-v1253.json')]);
 const a=auditSteamUiConsumerLinks(c,consumer);
 assert.equal(a.verificationLevel,'REAL_MENU_HUD_SERIALIZED_REFERENCE_RECORD_ONLY');
 assert.deepEqual(a.sourceLinkedKeys,['world.hgw']);
 assert.deepEqual(a.boundedNegativeKeys,['tab.shops','tab.daily']);
 assert.equal(a.releaseApproved,false);
 assert.equal(consumer.scope.componentFieldLayout,'UNTYPED_SERIALIZED_PPTR_PATTERN');
 assert.equal(consumer.scope.runtimeUIObserved,false);
 assert.equal(consumer.scope.otherBundlesNotChecked,true);
 assert.equal(consumer.candidates['world.hgw'].gameObjectName,'VillageAreaDisplay');
 assert.deepEqual(consumer.candidates['world.hgw'].spriteReferenceOffsets,[780,796,812,828]);
 assert.equal(consumer.candidates['world.hgw'].visualRuntimeVerified,false);
 assert.equal(consumer.candidates['world.hgw'].confirmedMenuTab,'UNKNOWN');
 assert.equal(consumer.legal.explicitPermissionToRedistributeExtractedGameSprites,'NOT_VERIFIED');
 assert.equal(consumer.legal.newImagePublicDeployment,'HOLD');
 assert.equal(auditSteamUiPublicationLedger(c,m).publishedCount,4);
 for(const key of ['world.hgw','tab.shops','tab.daily'])assert.equal(Object.hasOwn(m.icons,key),false);
 for(const fn of [x=>x.scope.runtimeUIObserved=true,x=>x.scope.componentFieldLayout='TYPED_PPTR',x=>x.candidates['world.hgw'].confirmedMenuTab='world.hgw',x=>x.candidates['tab.shops'].spriteReferenceOffsets=[4],x=>x.legal.newImagePublicDeployment='APPROVED']){
  const mutated=structuredClone(consumer);fn(mutated);assert.throws(()=>auditSteamUiConsumerLinks(c,mutated));
 }
 assert.equal(consumer.writerAuthorization,false);
});
