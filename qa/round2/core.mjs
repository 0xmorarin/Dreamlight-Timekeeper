// 05 QR independent CORE acceptance; copied into fixed PR #8 checkout by CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {makeSyntheticP1gProfile} from './fixture.mjs';
const profile=()=>({GameInfo:{Version:626},Player:{Name:'QA Synthetic'},World:{RecurringEvents:{}},Unknown:{future:[1,2,3]}});
const source=makeSyntheticP1gProfile(profile());
const decoded=await p1gPackagedProfileCodec.loadProfile(source);
const zip=decoded.metadata.zip;
const report=z=>auditP1gEnvelope({format:'packaged',metadata:{zip:z}});
const deny=a=>{
 assert.equal(a.repackageShapeObserved,false);
 assert.equal(a.writerAuthorized,false);
 assert.equal(a.editedCopyAuthorized,false);
 assert.equal(a.metadataPreservationVerified,false);
 assert.equal(a.localHeaderParityVerified,false);
 assert.equal(a.bytePreservationVerified,false);
};

test('QR-R2 CORE source single-entry observation remains writer-disabled and byte-inert',()=>{
 const before=Buffer.from(source);
 const a=report(zip);
 assert.equal(a.repackageShapeObserved,true);
 assert.equal(a.localHeaderFieldsMatchCentral,true);
 assert.equal(a.writerAuthorized,false);
 assert.equal(a.editedCopyAuthorized,false);
 assert.deepEqual(JSON.parse(decoded.jsonText).Unknown,profile().Unknown);
 assert.deepEqual(Buffer.from(source),before);
});
test('QR-R2 CORE missing and invalid ZIP boundary lengths always veto an observed simple layout',()=>{
 const cases=[
  ['archivePrefixBytes',undefined,'ARCHIVE_PREFIX_LENGTH_UNKNOWN'],
  ['profileTrailingRegionBytes',null,'PROFILE_TRAILING_LENGTH_UNKNOWN'],
  ['centralDirectoryTrailingBytes',-1,'CENTRAL_TRAILING_LENGTH_UNKNOWN'],
  ['archivePrefixBytes',1.5,'ARCHIVE_PREFIX_LENGTH_UNKNOWN'],
  ['centralDirectoryTrailingBytes',Number.NaN,'CENTRAL_TRAILING_LENGTH_UNKNOWN']
 ];
 for(const [key,value,code] of cases){
  const a=report({...zip,[key]:value});
  assert(a.findings.includes(code),key);
  deny(a);
 }
});
test('QR-R2 CORE positive or unsigned-overflow ZIP gaps and metadata cannot authorize repackaging',()=>{
 for(const [key,value,code] of [
  ['archivePrefixBytes',2,'ZIP_PREFIX_BYTES_PRESENT'],
  ['profileTrailingRegionBytes',7,'PROFILE_TO_CENTRAL_TRAILING_BYTES'],
  ['centralDirectoryTrailingBytes',3,'CENTRAL_TO_EOCD_GAP_BYTES']
 ]){
  const a=report({...zip,[key]:value});
  assert(a.findings.includes(code),key);deny(a);
 }
 for(const extra of [
  {crc32:-1},{crc32:0x100000000},{compressedSize:undefined},
  {uncompressedSize:0x100000000},{extractVersion:0x10000},
  {createSystem:300},{createVersion:null},{internalAttr:-1},{externalAttr:NaN}
 ]){
  const a=report({...zip,profileEntry:{...zip.profileEntry,...extra}});
  assert(a.findings.includes('CENTRAL_HEADER_FIELDS_INCOMPLETE')||
    a.findings.includes('REBUILD_SOURCE_ATTRIBUTES_INCOMPLETE'));deny(a);
 }
});
test('QR-R2 CORE matching data-descriptor and matching nonempty local/central extras never imply rebuild compatibility',()=>{
 const e=zip.profileEntry;
 for(const [entry,expected] of [
  [{...e,flagBits:0x0008,localHeader:{...e.localHeader,flagBits:0x0008}},'DATA_DESCRIPTOR_FLAG_WOULD_BE_REMOVED'],
  [{...e,extra:new Uint8Array([10,20]),localHeader:{...e.localHeader,extra:new Uint8Array([10,20])}},'ZIP_EXTRA_FIELDS_REBUILD_SEMANTICS_UNVERIFIED'],
  [{...e,comment:new Uint8Array([10])},'ENTRY_COMMENT_PRESENT'],
  [{...e,flagBits:0x0001,localHeader:{...e.localHeader,flagBits:0x0001}},'ENCRYPTED_ZIP_ENTRY_NOT_SUPPORTED']
 ]){
  const a=report({...zip,profileEntry:entry});
  assert(a.findings.includes(expected),expected);deny(a);
 }
 const a=report({...zip,archiveComment:new Uint8Array([7])});
 assert(a.findings.includes('ARCHIVE_COMMENT_PRESENT'));deny(a);
});
test('QR-R2 CORE local/central flags, CRC, compressed sizes and DOS times differ without write privileges',()=>{
 const e=zip.profileEntry,l=e.localHeader;
 for(const [change,expected] of [
  [{flagBits:l.flagBits^0x8},'LOCAL_CENTRAL_FLAGS_DIFFER'],
  [{crc32:(l.crc32+1)>>>0},'LOCAL_CENTRAL_CRC_DIFFERS'],
  [{compressedSize:l.compressedSize+1},'LOCAL_CENTRAL_SIZES_DIFFER'],
  [{dosTime:l.dosTime^1},'LOCAL_CENTRAL_DOS_TIME_DIFFERS']
 ]){
  const a=report({...zip,profileEntry:{...e,localHeader:{...l,...change}}});
  assert(a.findings.includes(expected),expected);deny(a);
 }
});
test('QR-R2 CORE malformed ZIP metadata and unchanged input prohibit writer promotion',()=>{
 assert.throws(()=>auditP1gEnvelope({format:'packaged',metadata:{zip:{}}}));
 assert.throws(()=>report({...zip,profileEntry:{...zip.profileEntry,extra:'bad'}}));
 assert.equal(auditP1gEnvelope({format:'json'}).editedCopyAuthorized,false);
 assert.deepEqual(Buffer.from(source),Buffer.from(makeSyntheticP1gProfile(profile())));
});

test('QR-R2 CORE streaming inflation aborts before collecting output exceeding central declared size',async()=>{
 const Original=globalThis.DecompressionStream;
 const size=zip.profileEntry.uncompressedSize+1;
 globalThis.DecompressionStream=class {
  constructor(type){
   assert.equal(type,'deflate-raw');
   return new TransformStream({transform(_chunk,controller){
    controller.enqueue(new Uint8Array(size));
   }});
  }
 };
 try{
  await assert.rejects(()=>p1gPackagedProfileCodec.loadProfile(source),/PROFILE_ENTRY_TOO_LARGE/);
 }finally{globalThis.DecompressionStream=Original;}
 assert.equal(report(zip).writerAuthorized,false);
});
