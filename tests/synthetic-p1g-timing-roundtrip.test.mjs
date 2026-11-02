// SYNTHETIC FIXTURE TEST ONLY. Tests the existing P1G codec independently of
// the Timekeeper writer gate; never enables a user save export or a release.
import assert from 'node:assert/strict';
import test from 'node:test';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson,diffPaths} from '../src/core/safe-edit-session.mjs';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {auditTimingDeltaIsolated} from '../src/core/timing-delta-audit.mjs';
import {readFile} from 'node:fs/promises';

const index=indexEvents(JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8')));
const initial=()=>{
 return {GameInfo:{Version:626,InitialVersion:518,AdditionalUnknownInfo:'keep'},
  Player:{Name:'Synthetic'},World:{RecurringEvents:{
   '0':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z',CustomState:{x:5}}}
  }},UnrecognizedFutureFields:{data:[true,{nested:'keep'}],unseen:'unmodified'}};
};

test('SYNTHETIC ONLY: packaged P1G edited-copy encode/reopen preserves unrelated JSON values',async()=>{
 const original=initial();
 const source=makeSyntheticP1gProfile(original),sourceBefore=Buffer.from(source);
 const loaded=await p1gPackagedProfileCodec.loadProfile(source);
 const parsed=parseSafeJson(loaded.jsonText);
 assert.deepEqual(parsed,original);
 const view=projectProfile(parsed,index);
 const field=view.rows.find(x=>x.id===2010000021);
 const proposed={pointer:field.pointer,originalTime:field.time,targetTime:'2127-02-28T04:05:06.000Z'};
 const audit=auditTimingDeltaIsolated(parsed,view,[proposed]);
 assert.equal(audit.status,'READ_ONLY_ISOLATED_JSON_DIFF_PASS');
 // Apply to a synthetic clone only, for a codec contract test rather than any
 // production save export path. This cannot grant a writer capability.
 const syntheticEdit=structuredClone(parsed);
 syntheticEdit.World.RecurringEvents['0'].ItemSpawning.NextOccurrence=proposed.targetTime;
 assert.deepEqual(diffPaths(parsed,syntheticEdit),[proposed.pointer]);
 const changedJson=JSON.stringify(syntheticEdit);
 const edited=await p1gPackagedProfileCodec.createEncodedProfile(changedJson,loaded.metadata);
 assert(edited instanceof Uint8Array);
 const reopened=await p1gPackagedProfileCodec.loadProfile(edited);
 assert.deepEqual(parseSafeJson(reopened.jsonText),syntheticEdit);
 assert.deepEqual(diffPaths(parsed,parseSafeJson(reopened.jsonText)),[proposed.pointer]);
 // Source metadata equality is narrower than arbitrary ZIP or ciphertext parity.
 for(const field of ['flagBits','compressType','extractVersion','dosTime','dosDate',
  'createSystem','createVersion','internalAttr','externalAttr']){
   assert.equal(reopened.metadata.zip.profileEntry[field],loaded.metadata.zip.profileEntry[field],field);
 }
 for(const field of ['extra','comment']){
   assert.deepEqual(reopened.metadata.zip.profileEntry[field],loaded.metadata.zip.profileEntry[field],field);
 }
 assert.notDeepEqual(Buffer.from(edited),Buffer.from(source));
 assert.deepEqual(Buffer.from(source),sourceBefore);
 assert.equal(p1gPackagedProfileCodec.getProfileVersion(reopened.metadata),626);
 assert.equal(view.capabilities.editingAllowed,false);
 assert.equal(view.capabilities.exportEditedAllowed,false);
 assert.equal(audit.editedCopyAuthorized,false);
});

test('SYNTHETIC ONLY: modified game identity is rejected before P1G encode',async()=>{
 const original=initial();
 const source=makeSyntheticP1gProfile(original);
 const metadata=(await p1gPackagedProfileCodec.loadProfile(source)).metadata;
 const altered={...original,GameInfo:{...original.GameInfo,Version:627}};
 await assert.rejects(
  ()=>p1gPackagedProfileCodec.createEncodedProfile(JSON.stringify(altered),metadata),
  /PROFILE_VERSION_CHANGED_DURING_ENCODE/
 );
});

test('SYNTHETIC ONLY: codec refuses rebuilding unverified source ZIP metadata without writing',async()=>{
 const source=makeSyntheticP1gProfile(initial()),original=Buffer.from(source);
 const loaded=await p1gPackagedProfileCodec.loadProfile(source);
 const candidate=JSON.stringify({...initial(),FutureUnownedField:{preserve:true}});
 const zip=loaded.metadata.zip,entry=zip.profileEntry;
 const cases=[
  {name:'unknown archive prefix',zip:{...zip,archivePrefixBytes:undefined}},
  {name:'nonempty archive prefix',zip:{...zip,archivePrefixBytes:4}},
  {name:'local extra differs',zip:{...zip,profileEntry:{
   ...entry,localHeader:{...entry.localHeader,extra:Uint8Array.of(9,0,0,0)}
  }}},
  {name:'descriptor bit',zip:{...zip,profileEntry:{
   ...entry,flagBits:0x0008,localHeader:{...entry.localHeader,flagBits:0x0008}
  }}},
  {name:'entry comment',zip:{...zip,profileEntry:{
   ...entry,comment:Uint8Array.of(1)
  }}},
  {name:'unknown flag bits',zip:{...zip,profileEntry:{
   ...entry,flagBits:0x0020,localHeader:{...entry.localHeader,flagBits:0x0020}
  }}}
 ];
 for(const c of cases){
  await assert.rejects(
   p1gPackagedProfileCodec.createEncodedProfile(candidate,{...loaded.metadata,zip:c.zip}),
   /ZIP_SOURCE_ENVELOPE_REBUILD_UNVERIFIED/,c.name
  );
 }
 assert.deepEqual(Buffer.from(source),original);
});
