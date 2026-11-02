// 05 QR Round9 Phase A: isolated TIME STATIC_ONLY source acceptance.
// Run only against exact TIME owner commit; not an integrated PR11 release test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
const input=JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8'));
const woodTagPack=JSON.parse(await readFile(new URL('../data/wand-iswood-crosswalk-v1253.json',import.meta.url),'utf8'));
const n=compileW1NativeSemantics(input,{woodTagPack});
const bl=(rva,opcode)=>{
 assert.equal((opcode&0xfc000000)>>>0,0x94000000);
 let imm=opcode&0x3ffffff;if(imm&0x2000000)imm-=0x4000000;
 return (rva+imm*4)>>>0;
};
test('R9 four W1 setters write a field and GC barrier but do not directly emit slot62',()=>{
 const g=n.native.nextOccurrenceSetterCallGraph;
 assert.equal(g.writeFieldOffset,'0x20');
 const opcode=Number.parseInt(g.writeInstructionWord,16);
 assert.equal(opcode,0xF8020C01);
 assert.equal(opcode&31,1);
 assert.equal((opcode>>>5)&31,0);
 assert.equal((opcode>>>12)&0x1ff,0x20);
 assert.deepEqual(g.setters.map(r=>r.kind),['ItemSpawning','WildCropsSpawningInVillage','FlowerSpawningInVillage','FishSpawningInVillage']);
 assert(g.setters.every(r=>Number(r.writeRVA)>Number(r.entryRVA)));
 assert.equal(g.eachSetterDirectBLCalls,0);
 assert.equal(g.eachSetterIndirectBLRCalls,0);
 assert.equal(g.setterDirectlyEmitsSlot62,false);
 assert.equal(g.callerCanEmitSeparateNotification,true);
 assert.equal(g.anySetterCausesClientWaitRearmVerified,false);
});
test('R9 slot62 instruction absence in scanned methods cannot exclude indirect notifications',()=>{
 const a=n.native.slot62EmissionSiteAudit;
 assert.equal(a.slotRegisterWord,'0x528007C2');
 const op=Number.parseInt(a.slotRegisterWord,16);
 assert.equal(op&31,2);
 assert.equal((op>>>5)&0xffff,62);
 assert.equal(a.checkedWindows.length,7);
 assert.deepEqual(a.checkedWindows[0].movW2Slot62Rvas,['0x05A2A0F0']);
 assert.equal(a.checkedWindows[0].method,'Profile.AddRecurringEvent');
 assert(a.checkedWindows.slice(1).every(w=>w.movW2Slot62Rvas.length===0));
 assert.equal(a.absenceOfInstructionDoesNotExcludeVirtualOrIndirectNotification,true);
 assert.equal(a.actualizeClientNotificationVerified,false);
 assert.equal(a.executeClientNotificationVerified,false);
 assert.equal(n.native.clientRecurringRescheduleNotification.notificationFiredByEverySetterVerified,false);
});
test('R9 Client wait and cancellation: recorded BL targets are static, not actual clock completion',()=>{
 const w=n.native.clientNextOccurrenceWaitLifecycle;
 assert.equal(w.clockAppointmentType,'Clock.Appointment(DateTime dateTime, CancellationToken ct)');
 assert.equal(w.clientRecurringEventCTSOffset,'0xE8');
 assert.equal(w.profileCTSOffset,'0xC0');
 assert.equal(w.perEventSourceType,'Dictionary<uint,CancellationTokenSource>');
 assert.equal(bl(0x0604E65C,0x94000045),0x0604E770);
 assert.equal(bl(0x0604EC7C,0x97FFFEBD),0x0604E770);
 assert.equal(bl(0x060B5388,0x977373BE),0x03D92280);
 assert.equal(bl(0x060B53F0,0x97EBFD58),0x05BB4950);
 assert.equal(bl(0x060B57EC,0x976A84D1),0x03B56B30);
 assert.equal(bl(0x060B5838,0x94119EAE),0x0651D2F0);
 assert.equal(bl(0x060B59FC,0x976A70D1),0x03B51D40);
 assert.equal(bl(0x060B5AA4,0x9411A6C3),0x0651F5B0);
 assert.equal(w.exactWaiterCancellationRaceResolved,false);
 assert.equal(w.automaticSavedTimestampChangeNotification,false);
 assert.equal(w.sceneSpawnAfterWaitVerified,false);
 assert.equal(w.gameRestartRestorationVerified,false);
});
test('R9 removing a recurring event cancels matching CTS; bare timestamp editing is not proven to trigger this',()=>{
 const r=n.native.clientRecurringEventRemovalLifecycle;
 assert.equal(r.callback,'Client.OnRecurringEventRemoved');
 assert.equal(bl(0x0604ED68,0x976C1F72),0x03B56B30);
 assert.equal(bl(0x0604ED88,0x9413395A),0x0651D2F0);
 assert.equal(bl(0x0604ED98,0x94133B22),0x0651DA20);
 assert.equal(bl(0x0604EDB4,0x976C1B17),0x03B55A10);
 assert.equal(r.cancellationConditionalOnMatchingSource,true);
 assert.equal(r.invocationOnTimestampEditVerified,false);
 assert.equal(r.gameRuntimeObserved,false);
 for(const [id,kind] of [[2010000021,'ItemSpawning'],[2010400001,'WildCropsSpawningInVillage'],[2010500008,'FlowerSpawningInVillage']]){
  const v=n.query(id,kind);
  assert.equal(v.nativePerEventEvidence,'UNKNOWN');
  assert.equal(v.operationEvidence,'BLOCKED');
  assert.equal(v.writerAuthorized,false);
  assert.equal(v.editedExportAuthorized,false);
 }
});
