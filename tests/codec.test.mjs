import assert from 'node:assert/strict';
import test from 'node:test';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {parseSafeJson} from '../src/core/safe-edit-session.mjs';
import {indexEvents,projectProfile} from '../src/reader.mjs';
import {readFile} from 'node:fs/promises';
const idx=indexEvents(JSON.parse(await readFile(new URL('../data/events-v1253.json',import.meta.url))));
test('Wand packaged profile codec reads synthetic schema626 without changing input',async()=>{
  const input={GameInfo:{Version:626,InitialVersion:518,LastCustomIdOwner:'TEST'},Player:{Name:'Synthetic'},World:{RecurringEvents:{'0':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:'2126-08-20T00:00:00Z'}}}},Unrelated:{preserve:['opaque',25]}};
  const encrypted=makeSyntheticP1gProfile(input);const before=Buffer.from(encrypted);
  const result=await p1gPackagedProfileCodec.loadProfile(encrypted);
  const parsed=parseSafeJson(result.jsonText);
  assert.deepEqual(parsed,input);
  assert.deepEqual(Buffer.from(encrypted),before);
  const view=projectProfile(parsed,idx);
  assert.equal(view.rows.find(x=>x.id===2010000003).writeAuthorized,false);
  assert.equal(view.identity.schema,626);
});
test('Wand strict parse rejects duplicate profile keys',()=>{
  assert.throws(()=>parseSafeJson('{"GameInfo":{},"GameInfo":{},"Player":{},"World":{}}'),/Duplicate/);
});
