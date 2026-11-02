import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectWandGridObjectReferences} from '../src/wand-grid-reference-index.mjs';

function profile(){
 return {GameInfo:{Version:626},Player:{
  LastUsedLinkedEnvironmentEnter:{'9':{GridID:10,GridObjectID:5}},
  AchievementsData:[{GridObjectsCollected:{GridObjectAddresses:[{GridID:10,GridObjectID:6}]}}],
  DutySlots:{'4':{Slots:{'2':{StepData:{GridObjectsCollected:{
   GridObjectAddresses:[{GridID:10,GridObjectID:4}]
  }}}}}}
 },World:{GridCollection:{Grids:{'10':{ID:10,Objects:{
  '4':{ID:4,ItemID:31700014},'5':{ID:5,ItemID:40600010},
  '6':{ID:6,ItemID:30800059}
 }}}}},ConditionalEventHistory:{ActiveEvents:{
  '1520002000':{SpawnState:{SpawnedObjects:[{GridID:10,GridObjectID:4},{GridID:878,GridObjectID:41}]}},
  '1520002001':{SomeOtherState:{}}
 }}};
}
test('Wand active GridObjectAddress veto remains active even when no Grid object materializes',()=>{
 const p=profile(),original=JSON.stringify(p);
 const {result,byAddress}=inspectWandGridObjectReferences(p);
 assert.equal(result.activeReferenceCount,2);
 assert.equal(result.unknownReferenceCount,1);
 assert.equal(result.historicalReferenceCount,2);
 assert.equal(result.activeEventContainerPresent,true);
 assert.equal(result.sourceValidatedSchema,624);
 assert.equal(result.observedSchema,626);
 assert.equal(result.schema626Revalidated,false);
 assert.equal(byAddress({gridId:10,gridObjectId:4})[0].sourceType,
  'CONDITIONAL_EVENT_ACTIVE_SPAWNED_OBJECT');
 assert.equal(byAddress({gridId:878,gridObjectId:41})[0].activity,'ACTIVE');
 assert.equal(byAddress({gridId:878,gridObjectId:41})[0].activeOwnershipVeto,true);
 assert.equal(byAddress({gridId:10,gridObjectId:5})[0].activity,'UNKNOWN');
 assert.equal(byAddress({gridId:10,gridObjectId:6})[0].activity,'HISTORICAL');
 assert.equal(byAddress({gridId:10,gridObjectId:6})[0].activeOwnershipVeto,false);
 assert.equal(byAddress({gridId:10,gridObjectId:4}).length,2);
 assert.equal(result.writerAuthorized,false);
 assert.equal(result.bulkDeletionAuthorized,false);
 assert.equal(result.otherIdentityAndGridLayersUnreviewed,true);
 assert.equal(JSON.stringify(p),original);
});
test('invalid or drifted Wand ref shapes become explicit inconclusive diagnostics',()=>{
 const p=profile();
 p.ConditionalEventHistory.ActiveEvents['1520002000'].SpawnState.SpawnedObjects.push({GridID:10});
 p.ConditionalEventHistory.ActiveEvents['bad']={SpawnState:{SpawnedObjects:'unparsed'}};
 const {result}=inspectWandGridObjectReferences(p);
 assert.equal(result.invalidReferenceCount,2);
 assert.equal(result.activeReferenceCount,2);
 assert.equal(result.bulkDeletionAuthorized,false);
 const missing=profile();delete missing.ConditionalEventHistory;
 const check=inspectWandGridObjectReferences(missing).result;
 assert.equal(check.activeEventContainerPresent,false);
 assert.equal(check.activeReferenceCount,0);
 assert.equal(check.bulkDeletionAuthorized,false);
});
test('bounded source index rejects large or incompatible reference inputs',()=>{
 assert.throws(()=>inspectWandGridObjectReferences(profile(),{maxAddresses:1}));
 assert.throws(()=>inspectWandGridObjectReferences(profile(),{maxActiveEvents:1}));
 assert.throws(()=>inspectWandGridObjectReferences(profile(),{maxHistoricalRecords:1}));
 assert.throws(()=>inspectWandGridObjectReferences({World:{},Player:null}));
 assert.throws(()=>inspectWandGridObjectReferences(profile(),{maxAddresses:NaN}));
});
