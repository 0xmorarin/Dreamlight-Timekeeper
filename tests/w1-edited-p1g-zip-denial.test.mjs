// Synthetic P1G ZIP source extensions and duplicate saved EventID fail closed.
import {createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {indexEvents} from '../src/reader.mjs';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {createW1EditedP1gCopy} from '../src/core/w1-edited-p1g-copy.mjs';

const KEY=Buffer.from('62357168683873614A38556C444A557A545A5864325467366D626F3857386e35','hex');
const registry=indexEvents(JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url),'utf8')));
const OLD='2126-08-20T00:00:00Z',target='2127-08-20T00:00:00Z';
const pointer='/World/RecurringEvents/0/ItemSpawning/NextOccurrence';
const entry={pointer,eventId:2010000021,kind:'ItemSpawning',originalTime:OLD,targetTime:target};
const review={
 status:'STRUCTURAL_W1_TARGETS_ONLY',contractVersion:'minimal-w1-target-v1',
 targetScopeVerified:true,writerAuthorized:false,editedExportAuthorized:false,
 source:{buildId:'9A239D3DB569756D',saveSchema:626,definitionCount:508,
 rawEventSHA256:'028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea'},
 candidateTargets:[{pointer,eventId:2010000021,variant:'ItemSpawning',
  savedIndex:0,originalTime:OLD,targetTime:target,writerAuthorized:false}]
};
const sourceProfile=()=>({GameInfo:{Version:626},Player:{Name:'Synthetic'},
 World:{RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000021,
 NextOccurrence:OLD}}},Opaque:{keep:[null,'not a timing field']}}});
const sha=b=>createHash('sha256').update(b).digest('hex');
const args=sourceBytes=>({sourceBytes,sourceSessionId:1,activeSessionId:1,
 expectedSourceSha256:sha(sourceBytes),targetBuild:{platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'},
 eventRegistry:registry,w1TargetReview:review,entries:[entry]});
function modifyArchive(source,mutate){
 const decipher=createDecipheriv('aes-256-ecb',KEY,null);
 const zip=Buffer.concat([decipher.update(source),decipher.final()]);
 const result=mutate(zip);
 const cipher=createCipheriv('aes-256-ecb',KEY,null);
 return new Uint8Array(Buffer.concat([cipher.update(result),cipher.final()]));
}
test('readable P1G archive with a physical ZIP comment cannot be rewritten by narrow copy API',async()=>{
 const source=makeSyntheticP1gProfile(sourceProfile());
 const modified=modifyArchive(source,z=>{
  const out=Buffer.concat([z,Buffer.from('opaque')]);
  out.writeUInt16LE(6,z.length-22+20);
  return out;
 });
 const original=Buffer.from(modified);
 await assert.rejects(createW1EditedP1gCopy(args(modified)),/W1_SOURCE_ZIP_REBUILD_UNSUPPORTED/);
 assert.deepEqual(Buffer.from(modified),original);
});
test('duplicate saved event definition ID in different recurring slots blocks copy',async()=>{
 const root=sourceProfile();
 root.World.RecurringEvents['3']={ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:OLD}};
 const bytes=makeSyntheticP1gProfile(root);
 await assert.rejects(createW1EditedP1gCopy(args(bytes)),/W1_DUPLICATE_SAVED_EVENT_ID/);
});
test('02 TIME review provenance, exact target and denial flags are not bypassable by stale candidate',async()=>{
 const source=makeSyntheticP1gProfile(sourceProfile()),base=args(source);
 for(const invalid of [
  {...review,source:{...review.source,buildId:'UNKNOWN'}},
  {...review,source:{...review.source,rawEventSHA256:'a'.repeat(64)}},
  {...review,writerAuthorized:true},
  {...review,editedExportAuthorized:true},
  {...review,candidateTargets:[{...review.candidateTargets[0],targetTime:OLD}]},
  {...review,candidateTargets:[{...review.candidateTargets[0],eventId:2010500008}]},
  {...review,candidateTargets:[]}
 ])await assert.rejects(createW1EditedP1gCopy({...base,w1TargetReview:invalid}),/W1_TIME_/);
 assert.equal(sha(source),base.expectedSourceSha256);
});
