// Synthetic-only input: never use actual user data or enable edited-save export.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createCipheriv} from 'node:crypto';
import {deflateRawSync,crc32} from 'node:zlib';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';

const KEY=Buffer.from('62357168683873614a38556c444a557a545a5864325467366d626f3857386e35','hex');
const minimal='"GameInfo":{"Version":626},"Player":{},"World":{}';
const jsonWith=(additional)=>'{'+minimal+','+additional+'}';

// Existing synthetic fixture calls JSON.stringify and necessarily removes
// duplicate keys/unsafe integer lexical forms. Build a minimal *test-only*
// ZIP from the original JSON text to exercise the direct packaged reader.
function rawTextP1g(jsonText){
 const raw=Buffer.from(jsonText);
 const data=deflateRawSync(raw);
 const name=Buffer.from('profile');
 const crc=crc32(raw);
 const local=Buffer.alloc(30+name.length+data.length);
 local.writeUInt32LE(0x04034b50,0);
 local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);
 local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);
 local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
 name.copy(local,30);data.copy(local,30+name.length);
 const central=Buffer.alloc(46+name.length);
 central.writeUInt32LE(0x02014b50,0);
 central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);
 central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);
 central.writeUInt32LE(data.length,20);central.writeUInt32LE(raw.length,24);
 central.writeUInt16LE(name.length,28);name.copy(central,46);
 const eocd=Buffer.alloc(22);
 eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(1,8);
 eocd.writeUInt16LE(1,10);eocd.writeUInt32LE(central.length,12);
 eocd.writeUInt32LE(local.length,16);
 const cipher=createCipheriv('aes-256-ecb',KEY,null);
 return new Uint8Array(Buffer.concat([cipher.update(local),cipher.update(central),
  cipher.update(eocd),cipher.final()]));
}

test('direct codec decode, parse and synthetic encode reject unsafe JSON lexical tokens',async()=>{
 const simple=makeSyntheticP1gProfile({GameInfo:{Version:626},Player:{},World:{}});
 const metadata=(await p1gPackagedProfileCodec.loadProfile(simple)).metadata;
 const malformed=[
  [jsonWith('"GameInfo":{"Version":627}'),/Duplicate JSON object key/],
  [jsonWith('"FutureOpaque":{"integer":9007199254740993}'),/Unsafe JSON integer/],
  [jsonWith('"FutureOpaque":{"small":1e-9999}'),/Underflowed JSON number/],
  [jsonWith('"FutureOpaque":'+ '['.repeat(260)+'0'+']'.repeat(260)),/nesting/]
 ];
 for(const [text,reason] of malformed){
  const packageBytes=rawTextP1g(text);
  const sourceBefore=Buffer.from(packageBytes);
  assert.throws(()=>p1gPackagedProfileCodec.parseProfileText(text),reason);
  await assert.rejects(p1gPackagedProfileCodec.loadProfile(packageBytes),reason);
  await assert.rejects(p1gPackagedProfileCodec.createEncodedProfile(text,metadata),reason);
  assert.deepEqual(Buffer.from(packageBytes),sourceBefore);
 }
});

test('synthetic larger profile preserves unknown nested data under strict codec read',async()=>{
 const payload='z'.repeat(6*1024*1024);
 const root={GameInfo:{Version:626,InitialVersion:518},Player:{Synthetic:true},
  World:{UnknownField:{deep:[{token:'untouched',large:payload}]}},
  UnknownRoot:{leadingZeroString:'000123',signedNumberString:'9007199254740993'}};
 const source=makeSyntheticP1gProfile(root),original=Buffer.from(source);
 const loaded=await p1gPackagedProfileCodec.loadProfile(source);
 assert.equal(loaded.metadata.profileVersion,626);
 assert.deepEqual(JSON.parse(loaded.jsonText),root);
 const envelope=auditP1gEnvelope({format:'packaged',metadata:loaded.metadata});
 assert.equal(envelope.repackageShapeObserved,true);
 assert.equal(envelope.writerAuthorized,false);
 assert.equal(envelope.editedCopyAuthorized,false);
 assert.deepEqual(Buffer.from(source),original);
});
