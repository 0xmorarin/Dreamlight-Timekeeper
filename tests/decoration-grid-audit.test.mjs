import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {compileDecorationSpawnEvidence} from '../src/decoration-spawn-evidence.mjs';
import {auditDecorationGridItemMatches} from '../src/decoration-grid-audit.mjs';

const source=compileDecorationSpawnEvidence(JSON.parse(
 await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8')));
function fixture(){
 return {World:{
  Villages:[{VillageAreaDataName:'Village04Layout',Areas:{
   '1':{GridIDs:[10,11]},
   '2':{GridIDs:[10]}
  }}],
  GridCollection:{Grids:{
   '10':{ID:10,Objects:{
    '4':{ID:4,ItemID:31700014,X:10,Y:20,State:{SomeState:{}}},
    '5':{ID:5,ItemID:30200147,X:11,Y:20},
    '6':{ID:6,ItemID:31400039,X:12,Y:20},
    '7':{ID:7,ItemID:31300003,X:13,Y:20},
    '8':{ID:99,ItemID:31700014,X:14,Y:20}
   }},
   '11':{ID:11,Objects:{
    '3':{ID:3,ItemID:31700156,X:5,Y:6},
    '4':{ID:4,ItemID:31700014,X:7,Y:8}
   }},
   '500':{ID:500,Objects:{'2':{ID:2,ItemID:31700014,X:9,Y:10}}}
  }}
 }};
}
test('read-only grid audit only matches direct-area saved objects by ItemID',()=>{
 const profile=fixture(),before=JSON.stringify(profile),srcBefore=JSON.stringify(source);
 const a=auditDecorationGridItemMatches(profile,source);
 assert.equal(a.gridObjectsInspected,7);
 assert.equal(a.directGridsInspected,2);
 assert.equal(a.matches.length,4);
 assert.equal(a.matches.find(x=>x.gridId===10&&x.gridObjectId===4).itemId,31700014);
 assert.equal(a.matches.find(x=>x.gridId===10&&x.gridObjectId===7).itemId,31300003);
 assert.equal(a.matches.some(x=>x.itemId===30200147),false);
 assert.equal(a.matches.some(x=>x.itemId===31400039),false);
 assert.equal(a.matches.some(x=>x.gridId===500),false);
 assert.equal(a.matches.find(x=>x.gridId===10).ownerAreaAmbiguous,true);
 assert.equal(a.matches.find(x=>x.gridId===11).ownerAreaAmbiguous,false);
 assert.equal(a.matches.every(x=>x.sourceProvenanceVerified===false&&
  x.bulkDeletionAuthorized===false&&x.timestampEditAuthorized===false),true);
 assert.equal(a.sourceMatchIsNotSpawnProof,true);
 assert.equal(JSON.stringify(profile),before);assert.equal(JSON.stringify(source),srcBefore);
});
test('source data must never grant deletion authority',()=>{
 const invalid=structuredClone(source);
 invalid.rows[0].bulkDeletionAuthorized=true;
 assert.throws(()=>auditDecorationGridItemMatches(fixture(),invalid));
 const mismatched=structuredClone(source);
 mismatched.source.buildId='UNREVIEWED';
 assert.throws(()=>auditDecorationGridItemMatches(fixture(),mismatched));
 const bad=fixture();bad.World.GridCollection.Grids['10'].ID=42;
 const audit=auditDecorationGridItemMatches(bad,source);
 assert(audit.diagnostics.some(x=>x.code==='GRID_IDENTITY_OR_OBJECT_STRUCTURE_UNKNOWN'));
 assert.equal(audit.bulkDeletionAuthorized,false);
 assert.throws(()=>auditDecorationGridItemMatches(fixture(),source,{maxObjects:2}));
 assert.throws(()=>auditDecorationGridItemMatches(fixture(),source,{maxGrids:1}));
});

test('Wand 01A active and system GridObjectAddress references veto tempting item matches',()=>{
 const p=fixture();
 p.Player={LastUsedLinkedEnvironmentEnter:{'scene':{GridID:11,GridObjectID:3}},
  AchievementsData:[{GridObjectsCollected:{GridObjectAddresses:[{GridID:11,GridObjectID:4}]}}]};
 p.GameInfo={Version:626};
 p.ConditionalEventHistory={ActiveEvents:{
  '1520002098':{SpawnState:{SpawnedObjects:[
   {GridID:10,GridObjectID:4},{GridID:878,GridObjectID:41}
  ]}}
 }};
 const original=JSON.stringify(p);
 const result=auditDecorationGridItemMatches(p,source);
 const active=result.matches.find(x=>x.gridId===10&&x.gridObjectId===4);
 assert.equal(active.referenceAssessment,'ACTIVE_IDENTITY_REFERENCE');
 assert.deepEqual(active.activeConditionalEventIds,['1520002098']);
 assert.equal(active.bulkDeletionAuthorized,false);
 const system=result.matches.find(x=>x.gridId===11&&x.gridObjectId===3);
 assert.equal(system.referenceAssessment,'UNKNOWN_SYSTEM_REFERENCE');
 assert.equal(system.unknownSystemReferenceCount,1);
 const historic=result.matches.find(x=>x.gridId===11&&x.gridObjectId===4);
 assert.equal(historic.referenceAssessment,'HISTORICAL_ONLY_REQUIRES_OTHER_GATES');
 assert.equal(historic.historicalReferenceCount,1);
 assert.equal(historic.bulkDeletionAuthorized,false);
 assert.equal(result.wandReferenceSnapshot.activeReferenceCount,2);
 assert.equal(result.wandReferenceSnapshot.schema626Revalidated,false);
 assert.equal(result.wandReferenceSnapshot.writerAuthorized,false);
 assert.equal(result.absenceOfReferenceIsNotRemovalAuthorization,true);
 assert.equal(JSON.stringify(p),original);
});
test('unknown reference shapes and unavailable Wand source never imply clearance',()=>{
 const p=fixture();
 const without=auditDecorationGridItemMatches(p,source);
 assert.equal(without.wandReferenceSnapshot,null);
 assert.equal(without.matches[0].referenceAssessment,'NOT_EVALUATED');
 p.Player={};
 p.ConditionalEventHistory={ActiveEvents:{'42':{SpawnState:{SpawnedObjects:[{GridID:10}]}}}};
 const invalid=auditDecorationGridItemMatches(p,source);
 assert.equal(invalid.wandReferenceSnapshot.invalidReferenceCount,1);
 assert.equal(invalid.matches[0].referenceAssessment,'INCOMPLETE_REFERENCE_GRAPH');
 assert.equal(invalid.bulkDeletionAuthorized,false);
});


test('Wand DiffGrids modified source-linked objects are assessed separately from direct area grids',async()=>{
 const p=fixture();
 p.Player={};
 p.ConditionalEventHistory={ActiveEvents:{'1520002098':{SpawnState:{
  SpawnedObjects:[{GridID:878,GridObjectID:41}]
 }}}};
 p.World.GridCollection.DiffGrids={
  '878':{ID:878,ModifiedObjects:{
   '41':{ID:41,ItemID:31700131,From:'GridSource_RemovingBlockers'},
   '42':{ID:42,ItemID:30800059}
  },RemovedObjects:[39]},
  '879':{ID:879,ModifiedObjects:{
   '5':{ID:5,ItemID:30200147}
  }}
 };
 const tagPack=JSON.parse(await readFile(new URL('../data/wand-iswood-crosswalk-v1253.json',import.meta.url),'utf8'));
 const tagged=compileDecorationSpawnEvidence(JSON.parse(
  await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8')),{woodTagPack:tagPack});
 const before=JSON.stringify(p);
 const a=auditDecorationGridItemMatches(p,tagged);
 assert.equal(a.diffModifiedObjectsInspected,3);
 assert.equal(a.diffModifiedMatches.length,2);
 const pine=a.diffModifiedMatches.find(x=>x.itemId===31700131);
 assert.equal(pine.gridId,878);
 assert.equal(pine.sourceMatchLevel,'ITEM_ID_ONLY_DIFF_MODIFIED');
 assert.equal(pine.exactDirectAreaLinked,false);
 assert.equal(pine.referenceAssessment,'ACTIVE_IDENTITY_REFERENCE');
 assert.deepEqual(pine.activeConditionalEventIds,['1520002098']);
 assert.equal(pine.sourceFromRawPresent,true);
 assert.equal(pine.sourceFromSemanticsVerified,false);
 assert.equal(pine.locationRoleVerified,false);
 assert.equal(pine.bulkDeletionAuthorized,false);
 assert.equal(a.diffModifiedMatches.some(x=>x.itemId===30200147),false);
 assert.equal(a.matches.some(x=>x.itemId===31700131),false);
 assert.equal(a.diffModifiedGridsAreNotDirectAreaRoots,true);
 assert.equal(JSON.stringify(p),before);
});
test('malformed DiffGrid structure is reported, not promoted as editable',()=>{
 const p=fixture();
 p.World.GridCollection.DiffGrids={'44':{ID:45,ModifiedObjects:{}}};
 const r=auditDecorationGridItemMatches(p,source);
 assert(r.diagnostics.some(x=>x.code==='DIFF_GRID_IDENTITY_MISMATCH'));
 assert.equal(r.bulkDeletionAuthorized,false);
 p.World.GridCollection.DiffGrids={'44':{ID:44,ModifiedObjects:[{ID:5,ItemID:31700014}]}};
 const r2=auditDecorationGridItemMatches(p,source);
 assert(r2.diagnostics.some(x=>x.code==='DIFF_MODIFIED_OBJECTS_STRUCTURE_UNREVIEWED'));
 assert.equal(r2.diffModifiedMatches.length,0);
 assert.throws(()=>auditDecorationGridItemMatches(p,source,{maxGrids:1}));
});
