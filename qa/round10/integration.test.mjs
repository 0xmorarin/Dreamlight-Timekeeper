// 05 QR Round10 independent fixed integrated Native STATIC_ONLY and asset rights gates.
// No owner private save, original game binary, writer or asset redistribution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileW1NativeSemantics} from '../src/timing-native-semantics.mjs';
import {auditExistingGameUiPublicationRights} from '../src/steam-ui-provenance.mjs';

const file=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const json=async path=>JSON.parse(await file(path));
const n=compileW1NativeSemantics(await json('data/events-v1253.json'),
  {woodTagPack:await json('data/wand-iswood-crosswalk-v1253.json')});
const decodeBL=(pc,word)=>{
 assert.equal((word&0xfc000000)>>>0,0x94000000);
 let imm=word&0x03ffffff;if(imm&0x02000000)imm-=0x04000000;
 return (pc+imm*4)>>>0;
};
const decodeB=(pc,word)=>{
 assert.equal((word>>>26)&63,5);
 let imm=word&0x03ffffff;if(imm&0x02000000)imm-=0x04000000;
 return (pc+imm*4)>>>0;
};
const decodeBCond=(pc,word)=>{
 assert.equal((word&0xff000010)>>>0,0x54000000);
 let imm=(word>>>5)&0x7ffff;if(imm&0x40000)imm-=0x80000;
 return (pc+imm*4)>>>0;
};
test('Round10 Clock.Update polls provider only when not paused; strict due date < now, not <=',()=>{
 const c=n.native.clockAppointmentEvaluation;
 assert.equal(c.clockUpdateRVA,'0x05BB4D30');
 assert.equal(c.clockPausedFieldOffset,'0x28');
 assert.equal(c.clockPausedLoadRVA,'0x05BB4E08');
 assert.equal(c.clockPausedSkipBranchRVA,'0x05BB4E0C');
 assert.equal(c.clockAppointmentsFieldOffset,'0x10');
 assert.equal(c.currentTimeProviderFieldOffset,'0x18');
 assert.equal(c.currentTimeProviderLoadRVA,'0x05BB4E30');
 assert.equal(c.currentTimeProviderInvokeRVA,'0x05BB4E48');
 assert.equal(c.appointmentDateTimeFieldOffset,'0x10');
 assert.equal(c.appointmentCancellationTokenOffset,'0x18');
 assert.equal(c.appointmentTaskCompletionSourceOffset,'0x20');
 assert.equal(c.nowTicksMaskRVA,'0x05BB4E70');
 assert.equal(c.appointmentDateTimeMaskRVA,'0x05BB4F68');
 assert.equal(c.deadlineCompareRVA,'0x05BB4F6C');
 assert.equal(decodeBCond(0x05BB4F70,0x54FFF8A2),0x05BB4E84);
 assert.equal(0x54FFF8A2&15,2); // B.HS skips when date >= now
 assert.equal(c.strictDueCondition,'appointmentMaskedDateTime < currentProviderMaskedNow');
 assert.equal(c.deadlineEqualsNowTriggersCompletion,false);
 assert.equal(decodeBL(0x05BB4F18,0x977711C6),0x03979630);
 assert.equal(decodeBL(0x05BB4F90,0x977710E8),0x03979330);
 assert.equal(decodeBL(0x05BB4FA4,0x97814EEB),0x03C08B50);
 assert.equal(c.providerInvokedAtEachNonPausedClockUpdate,true);
 assert.equal(c.existingAppointmentReReadsRecurringEventTimestamp,false);
 assert.equal(c.directOSClockTimeSourceConfirmed,false);
 assert.equal(c.timezoneAndDSTBehaviorConfirmed,false);
 assert.equal(c.consoleClockJumpResultConfirmed,false);
});
test('Round10 Client.Update profile guard and three clock calls do not prove live timer wake',()=>{
 const x=n.native.clockClientPolling;
 assert.equal(x.clientUpdateRVA,'0x0604C460');
 assert.equal(x.profilePresentGuardRVA,'0x0604C4F0');
 assert.deepEqual(x.clocks.map(c=>c.offset),['0xF0','0xF8','0x100']);
 assert.deepEqual(x.clocks.map(c=>c.clientField),['Clock','ClockOnline','ClockPortal']);
 assert.equal(decodeBL(0x0604C500,0x97EDA20C),0x05BB4D30);
 assert.equal(decodeBL(0x0604C510,0x97EDA208),0x05BB4D30);
 assert.equal(decodeB(0x0604C52C,0x17EDA201),0x05BB4D30);
 assert.equal(x.constructorCreatesThreeDistinctClockObjects,true);
 assert.equal(x.clientUpdateEntryCalledInRuntimeVerified,false);
 assert.equal(x.worldRecurringEventUsesMainClockConfirmed,false);
 assert.equal(x.updateLoopDoesNotRearmAppointments,true);
});
test('Round10 reschedule slot62 handler blocked flag and rewait paths not universal setter event',()=>{
 const g=n.native.recurringEventClientDispatchGuards,r=n.native.recurringWaitRecreationCallsites;
 assert.equal(g.handlerRVA,'0x0604E9B0');
 assert.equal(g.blockFlagField,'blockRecurringEventReschedule');
 assert.equal(g.blockFlagOffset,'0x1D0');
 assert.equal((0x39474268>>>10)&0xfff,0x1D0);
 assert.equal(g.earlyReturnWhenBlockFlagNonzero,true);
 assert.equal(g.isWorldAuthoritativeCallRVA,'0x0604EA5C');
 assert.equal(decodeBL(0x0604EA5C,0x97FFE499),0x06047CC0);
 assert.equal(g.handlerContainsDirectSetterCall,false);
 assert.equal(g.handlerIsNotProofOfSubscription,true);
 assert.equal(decodeBL(0x060AA13C,0x97FE8E25),0x0604D9D0);
 assert.equal(decodeBL(0x060915E0,0x97FEF0FC),0x0604D9D0);
 assert.equal((0x39074288>>>10)&0xfff,0x1D0);
 assert.equal((0x390742DF>>>10)&0xfff,0x1D0);
 assert.equal(r.debugTimeSkip.debugOnlyPathNotAuthorizedProductFlow,true);
 assert.equal(r.newProfileWaitEnumeratesCandidates,true);
 assert.equal(r.existingCTSGenerationAndCleanupAcrossReloadVerified,false);
 assert.equal(r.coldLoadAndRestartRuntimeVerified,false);
 assert.equal(n.native.clientNextOccurrenceWaitLifecycle.automaticSavedTimestampChangeNotification,false);
 assert.equal(n.native.clientNextOccurrenceWaitLifecycle.exactWaiterCancellationRaceResolved,false);
 assert.equal(n.native.clientRecurringRescheduleNotification.notificationFiredByEverySetterVerified,false);
 for(const [id,kind] of [[2010000021,'ItemSpawning'],[2010400001,'WildCropsSpawningInVillage'],[2010500008,'FlowerSpawningInVillage']]){
  const q=n.query(id,kind);
  assert.equal(q.writerAuthorized,false);
  assert.equal(q.editedExportAuthorized,false);
 }
});
test('Round10 four already published Steam game images have NO proven permission, newer 3 still HOLD',async()=>{
 const [manifest,rights]=await Promise.all([
  json('data/steam-ui-icons-v1253.json'),json('data/steam-ui-existing-rights-review-v1253.json')]);
 const result=auditExistingGameUiPublicationRights(manifest,rights);
 assert.equal(result.existingDeployedCount,4);
 assert.equal(result.rightsConfirmedCount,0);
 assert.equal(result.rightsReviewRequiredCount,4);
 assert.equal(result.publicationPermissionGranted,false);
 assert.equal(rights.terms.specificExtractedSpritesPublicReusePermission,'NOT_ESTABLISHED');
 assert.equal(rights.rightsApproval,false);
 for(const key of ['skill.mining','status.warning','world.valley','world.exp1']){
  const row=rights.reviewedItems[key];
  assert.equal(row.currentDeployment,'PUBLISHED_PREEXISTING');
  assert.equal(row.copyrightRedistributionPermission,'NOT_ESTABLISHED');
  assert.equal(row.releaseRightsApproved,false);
 }
 for(const key of ['world.hgw','tab.shops','tab.daily'])assert.equal(Object.hasOwn(manifest.icons,key),false);
 for(const mutate of [
  r=>r.rightsApproval=true,
  r=>r.terms.specificExtractedSpritesPublicReusePermission='GRANTED',
  r=>r.reviewedItems['world.exp1'].copyrightRedistributionPermission='GRANTED',
  r=>r.reviewedItems['skill.mining'].releaseRightsApproved=true,
  r=>r.reviewedItems['status.warning'].publicSha256='0'.repeat(64),
  r=>delete r.reviewedItems['world.valley']
 ]){
  const changed=structuredClone(rights);mutate(changed);
  assert.throws(()=>auditExistingGameUiPublicationRights(manifest,changed));
 }
});
test('Round10 real Tab, Shift+Tab, trusted Enter and synthetic P1G are not OS chooser gate',async()=>{
 const script=await file('tests/browser-asset-zoom.smoke.mjs');
 const workflow=await file('.github/workflows/browser-ui.yml');
 assert.match(script,/page\.keyboard\.press\('Tab'\)/);
 assert.match(script,/page\.keyboard\.press\('Shift\+Tab'\)/);
 assert.match(script,/page\.keyboard\.press\('Enter'\)/);
 assert.match(script,/:focus-visible/);
 assert.match(script,/document\.hasFocus\(\)/);
 assert.match(script,/e\.type==='keydown'&&e\.key==='Enter'&&e\.target==='open-welcome'&&e\.trusted/);
 assert.match(script,/e\.type==='click'&&e\.target==='save-file'&&e\.userActivation===true/);
 assert.match(script,/page\.locator\('#save-file'\)\.setInputFiles/);
 assert.match(script,/makeSyntheticP1gProfile/);
 assert.match(script,/browserChooserEvents\+\+/);
 assert.doesNotMatch(script,/page\.waitForEvent\('filechooser'/);
 assert.match(workflow,/for sample in 1 2 3 4 5/);
 assert.match(workflow,/node tests\/browser-asset-zoom\.smoke\.mjs/);
});
