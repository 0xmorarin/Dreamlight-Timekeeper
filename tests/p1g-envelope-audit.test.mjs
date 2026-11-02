import assert from 'node:assert/strict';
import test from 'node:test';
import {makeSyntheticP1gProfile} from './fixture.mjs';
import {createCipheriv,createDecipheriv} from 'node:crypto';
import {p1gPackagedProfileCodec} from '../src/core/p1g-packaged-profile-codec.mjs';
import {auditP1gEnvelope} from '../src/core/p1g-envelope-audit.mjs';

const fixture=()=>({GameInfo:{Version:626},Player:{Name:'Synthetic'},World:{RecurringEvents:{}}});
test('synthetic decoded P1G envelope is a read-only risk assessment, not writer evidence',async()=>{
 const file=makeSyntheticP1gProfile(fixture()),orig=Buffer.from(file);
 const loaded=await p1gPackagedProfileCodec.loadProfile(file);
 const audit=auditP1gEnvelope({format:'packaged',metadata:loaded.metadata});
 assert.equal(audit.status,'SIMPLE_ENVELOPE_OBSERVED_REBUILD_UNVERIFIED');
 assert.equal(audit.archiveEntryCount,1);
 assert.equal(audit.profileEntryCount,1);
 assert.equal(audit.compressionMethod,8);
 assert.equal(audit.repackageShapeObserved,true);
 assert.equal(audit.localHeaderObserved,true);
 assert.equal(audit.localHeaderFieldsMatchCentral,true);
 assert.equal(audit.localExtraMatchesCentral,true);
 assert.equal(audit.lengths.archivePrefix,0);
 assert.equal(audit.lengths.profileTrailingRegion,0);
 assert.equal(audit.lengths.centralDirectoryTrailing,0);
 assert(audit.findings.includes('REBUILT_ZIP_RAW_BYTE_PARITY_NOT_PROVEN'));
 assert.equal(audit.bytePreservationVerified,false);
 assert.equal(audit.metadataPreservationVerified,false);
 assert.equal(audit.localHeaderParityVerified,false);
 assert.equal(audit.writerAuthorized,false);
 assert.equal(audit.editedCopyAuthorized,false);
 assert.deepEqual(Buffer.from(file),orig);
 assert(!('archiveComment' in audit));
 assert.throws(()=>audit.findings.push('injected'),TypeError);
});
test('archive extension/ZIP flag changes and extra entries are reported without exposing raw metadata bytes',async()=>{
 const loaded=await p1gPackagedProfileCodec.loadProfile(makeSyntheticP1gProfile(fixture()));
 const zip=loaded.metadata.zip;
 const audit=auditP1gEnvelope({format:'packaged',metadata:{
  zip:{...zip,entryCount:2,archiveComment:new Uint8Array([45,46]),
   profileEntry:{...zip.profileEntry,flagBits:0x0808,extra:new Uint8Array([1,2]),comment:new Uint8Array([7])}}
 }});
 for(const code of ['MULTI_ENTRY_OR_INVALID_PROFILE_COUNT','ARCHIVE_COMMENT_PRESENT',
  'LOCAL_CENTRAL_EXTRA_BYTES_DIFFER','ENTRY_COMMENT_PRESENT',
  'DATA_DESCRIPTOR_FLAG_WOULD_BE_REMOVED'])
  assert(audit.findings.includes(code),code);
 assert.equal(audit.status,'CONTAINER_REBUILD_REQUIRES_REVIEW');
 assert.equal(audit.repackageShapeObserved,false);
 assert.equal(audit.lengths.centralExtra,2);
 assert.equal(audit.localHeaderFieldsMatchCentral,false);
 assert.equal(audit.writerAuthorized,false);
 assert.equal(audit.editedCopyAuthorized,false);
});
test('unrecognized ZIP flags and compression are not silently normalized to a safe export',async()=>{
 const loaded=await p1gPackagedProfileCodec.loadProfile(makeSyntheticP1gProfile(fixture()));
 const zip=loaded.metadata.zip;
 const a=auditP1gEnvelope({format:'packaged',metadata:{
  zip:{...zip,profileEntry:{...zip.profileEntry,flagBits:0x0020,compressType:12}}
 }});
 assert(a.findings.includes('OTHER_ZIP_FLAGS_NEED_REVIEW'));
 assert(a.findings.includes('UNSUPPORTED_ZIP_COMPRESSION'));
 assert.equal(a.editedCopyAuthorized,false);
});
test('plain JSON has a separate unsupported modified-export contract and invalid metadata rejects',()=>{
 const plain=auditP1gEnvelope({format:'json'});
 assert.equal(plain.status,'PLAIN_JSON_NO_P1G_ENVELOPE');
 assert.equal(plain.sourceMetadataPresent,false);
 assert.equal(plain.writerAuthorized,false);
 assert.throws(()=>auditP1gEnvelope({format:'packaged',metadata:{}}));
 assert.throws(()=>auditP1gEnvelope({format:'packaged',metadata:{
  zip:{entryCount:1,profileEntryCount:1,archiveComment:'bad',
   profileEntry:{flagBits:0,compressType:8,extra:new Uint8Array(),comment:new Uint8Array()}}
 }}));
 assert.throws(()=>auditP1gEnvelope({format:'unknown'}));
});


const KEY=Buffer.from('62357168683873614A38556C444A557A545A5864325467366D626F3857386e35','hex');
function alteredEncryptedFixture(mutator){
 const initial=Buffer.from(makeSyntheticP1gProfile(fixture()));
 const decipher=createDecipheriv('aes-256-ecb',KEY,null);
 const plain=Buffer.concat([decipher.update(initial),decipher.final()]);
 mutator(plain);
 const cipher=createCipheriv('aes-256-ecb',KEY,null);
 return new Uint8Array(Buffer.concat([cipher.update(plain),cipher.final()]));
}
test('decoded actual local header discrepancies are observed without editing the source',async()=>{
 const source=alteredEncryptedFixture(plain=>{
  const flags=plain.readUInt16LE(6);
  plain.writeUInt16LE(flags|0x0008,6); // local descriptor flag only
  plain.writeUInt16LE((plain.readUInt16LE(10)+1)&0xffff,10);
  plain.writeUInt32LE((plain.readUInt32LE(14)+1)>>>0,14);
  plain.writeUInt32LE((plain.readUInt32LE(18)+1)>>>0,18);
 });
 const before=Buffer.from(source);
 const loaded=await p1gPackagedProfileCodec.loadProfile(source);
 const report=auditP1gEnvelope({format:'packaged',metadata:loaded.metadata});
 for(const code of ['LOCAL_CENTRAL_FLAGS_DIFFER','LOCAL_CENTRAL_DOS_TIME_DIFFERS',
  'LOCAL_CENTRAL_CRC_DIFFERS','LOCAL_CENTRAL_SIZES_DIFFER'])
  assert(report.findings.includes(code),code);
 assert.equal(report.status,'CONTAINER_REBUILD_REQUIRES_REVIEW');
 assert.equal(report.localHeaderFieldsMatchCentral,false);
 assert.equal(report.editedCopyAuthorized,false);
 assert.deepEqual(Buffer.from(source),before);
});
test('decoded ZIP archive preamble and unparsed trailing bytes are not silently treated as equivalent',async()=>{
 const loaded=await p1gPackagedProfileCodec.loadProfile(makeSyntheticP1gProfile(fixture()));
 const zip=loaded.metadata.zip;
 const report=auditP1gEnvelope({format:'packaged',metadata:{
  zip:{...zip,archivePrefixBytes:42,profileTrailingRegionBytes:12,centralDirectoryTrailingBytes:3}
 }});
 assert(report.findings.includes('ZIP_PREFIX_BYTES_PRESENT'));
 assert(report.findings.includes('PROFILE_TO_CENTRAL_TRAILING_BYTES'));
 assert(report.findings.includes('CENTRAL_TO_EOCD_GAP_BYTES'));
 assert.equal(report.repackageShapeObserved,false);
 assert.equal(report.status,'CONTAINER_REBUILD_REQUIRES_REVIEW');
 assert.equal(report.writerAuthorized,false);
});
test('legacy metadata without local evidence explicitly remains inconclusive',async()=>{
 const loaded=await p1gPackagedProfileCodec.loadProfile(makeSyntheticP1gProfile(fixture()));
 const zip=loaded.metadata.zip;
 const entry={...zip.profileEntry};
 delete entry.localHeader;
 const audit=auditP1gEnvelope({format:'packaged',metadata:{zip:{...zip,profileEntry:entry}}});
 assert.equal(audit.localHeaderObserved,false);
 assert.equal(audit.localHeaderFieldsMatchCentral,null);
 assert(audit.findings.includes('LOCAL_HEADER_BYTES_NOT_EXPOSED'));
 assert.equal(audit.repackageShapeObserved,false);
 assert.equal(audit.writerAuthorized,false);
});

test('missing or noninteger ZIP boundary lengths never masquerade as zero-length source layout',async()=>{
 const loaded=await p1gPackagedProfileCodec.loadProfile(makeSyntheticP1gProfile(fixture()));
 const zip=loaded.metadata.zip;
 for(const [key,value,code] of [
  ['archivePrefixBytes',undefined,'ARCHIVE_PREFIX_LENGTH_UNKNOWN'],
  ['profileTrailingRegionBytes',-1,'PROFILE_TRAILING_LENGTH_UNKNOWN'],
  ['centralDirectoryTrailingBytes',NaN,'CENTRAL_TRAILING_LENGTH_UNKNOWN']
 ]){
  const altered={...zip,[key]:value};
  const report=auditP1gEnvelope({format:'packaged',metadata:{zip:altered}});
  assert(report.findings.includes(code),key);
  assert.equal(report.status,'CONTAINER_REBUILD_REQUIRES_REVIEW');
  assert.equal(report.repackageShapeObserved,false);
  assert.equal(report.writerAuthorized,false);
  assert.equal(report.editedCopyAuthorized,false);
 }
});
test('source descriptor flags are not confused with reconstructable ZIP even when local and central flags agree',async()=>{
 const loaded=await p1gPackagedProfileCodec.loadProfile(makeSyntheticP1gProfile(fixture()));
 const zip=loaded.metadata.zip,entry=zip.profileEntry;
 const report=auditP1gEnvelope({format:'packaged',metadata:{zip:{...zip,profileEntry:{
  ...entry,flagBits:0x0008,localHeader:{...entry.localHeader,flagBits:0x0008}
 }}}});
 assert.equal(report.localHeaderFieldsMatchCentral,true);
 assert(report.findings.includes('DATA_DESCRIPTOR_FLAG_WOULD_BE_REMOVED'));
 assert.equal(report.repackageShapeObserved,false);
 assert.equal(report.status,'CONTAINER_REBUILD_REQUIRES_REVIEW');
 assert.equal(report.writerAuthorized,false);
});
test('matching source extras are still unverified rebuild semantics, not simple export shape',async()=>{
 const loaded=await p1gPackagedProfileCodec.loadProfile(makeSyntheticP1gProfile(fixture()));
 const zip=loaded.metadata.zip,entry=zip.profileEntry,extra=new Uint8Array([0xab,0xcd]);
 const report=auditP1gEnvelope({format:'packaged',metadata:{zip:{...zip,profileEntry:{
  ...entry,extra,localHeader:{...entry.localHeader,extra}
 }}}});
 assert.equal(report.localExtraMatchesCentral,true);
 assert.equal(report.localHeaderFieldsMatchCentral,true);
 assert(report.findings.includes('ZIP_EXTRA_FIELDS_REBUILD_SEMANTICS_UNVERIFIED'));
 assert.equal(report.repackageShapeObserved,false);
 assert.equal(report.editedCopyAuthorized,false);
});
test('unknown central numeric fields and rebuild attributes fail closed independently',async()=>{
 const loaded=await p1gPackagedProfileCodec.loadProfile(makeSyntheticP1gProfile(fixture()));
 const zip=loaded.metadata.zip,entry=zip.profileEntry;
 for(const changed of [{compressedSize:undefined},{crc32:0x100000000},{createVersion:undefined},
   {internalAttr:NaN},{externalAttr:-1}]){
  const report=auditP1gEnvelope({format:'packaged',metadata:{zip:{...zip,profileEntry:{...entry,...changed}}}});
  assert.equal(report.status,'CONTAINER_REBUILD_REQUIRES_REVIEW');
  assert.equal(report.repackageShapeObserved,false);
  assert.equal(report.writerAuthorized,false);
 }
});

test('streamed inflation rejects bytes exceeding the central directory size before full materialization',async()=>{
 const source=alteredEncryptedFixture(plain=>{
  const eocd=plain.length-22;
  assert.equal(plain.readUInt32LE(eocd),0x06054b50);
  const central=plain.readUInt32LE(eocd+16);
  assert.equal(plain.readUInt32LE(central),0x02014b50);
  assert.equal(plain.readUInt16LE(central+10),8);
  plain.writeUInt32LE(1,central+24);
 });
 const before=Buffer.from(source);
 await assert.rejects(p1gPackagedProfileCodec.loadProfile(source),/PROFILE_ENTRY_TOO_LARGE/);
 assert.deepEqual(Buffer.from(source),before);
});

function rearrangedEncryptedFixture(rearrange) {
 const initial=Buffer.from(makeSyntheticP1gProfile(fixture()));
 const decipher=createDecipheriv('aes-256-ecb',KEY,null);
 const archive=Buffer.concat([decipher.update(initial),decipher.final()]);
 const changed=rearrange(archive);
 assert(Buffer.isBuffer(changed));
 const cipher=createCipheriv('aes-256-ecb',KEY,null);
 return new Uint8Array(Buffer.concat([cipher.update(changed),cipher.final()]));
}
test('valid synthetic ZIP with actual signed data descriptor remains read-only, never simple',async()=>{
 const source=rearrangedEncryptedFixture(plain=>{
  const eocd=plain.length-22,central=plain.readUInt32LE(eocd+16);
  const descriptor=Buffer.alloc(16);
  descriptor.writeUInt32LE(0x08074b50,0);
  descriptor.writeUInt32LE(plain.readUInt32LE(central+16),4);
  descriptor.writeUInt32LE(plain.readUInt32LE(central+20),8);
  descriptor.writeUInt32LE(plain.readUInt32LE(central+24),12);
  const zip=Buffer.concat([plain.subarray(0,central),descriptor,plain.subarray(central)]);
  zip.writeUInt16LE(0x0008,6);
  zip.writeUInt32LE(0,14);zip.writeUInt32LE(0,18);zip.writeUInt32LE(0,22);
  zip.writeUInt16LE(0x0008,central+16+8);
  zip.writeUInt32LE(central+16,eocd+16+16);
  return zip;
 });
 const original=Buffer.from(source);
 const decoded=await p1gPackagedProfileCodec.loadProfile(source);
 const audit=auditP1gEnvelope({format:'packaged',metadata:decoded.metadata});
 assert.equal(decoded.metadata.profileVersion,626);
 assert.equal(audit.lengths.profileTrailingRegion,16);
 assert.equal(audit.flagBits,0x0008);
 assert.equal(audit.localHeaderFieldsMatchCentral,false);
 for(const code of ['DATA_DESCRIPTOR_FLAG_WOULD_BE_REMOVED',
  'PROFILE_TO_CENTRAL_TRAILING_BYTES','LOCAL_CENTRAL_CRC_DIFFERS',
  'LOCAL_CENTRAL_SIZES_DIFFER']) assert(audit.findings.includes(code),code);
 assert.equal(audit.repackageShapeObserved,false);
 assert.equal(audit.writerAuthorized,false);
 assert.deepEqual(Buffer.from(source),original);
});
test('synthetic local-only extra field is observed from ZIP bytes and never inferred from central extra',async()=>{
 const source=rearrangedEncryptedFixture(plain=>{
  const eocd=plain.length-22,central=plain.readUInt32LE(eocd+16);
  const nameEnd=30+plain.readUInt16LE(26);
  const extra=Buffer.from([0xad,0xde,0x00,0x00]); // unknown, empty ZIP extra record
  const zip=Buffer.concat([plain.subarray(0,nameEnd),extra,plain.subarray(nameEnd)]);
  zip.writeUInt16LE(extra.length,28);
  zip.writeUInt32LE(central+extra.length,eocd+extra.length+16);
  return zip;
 });
 const original=Buffer.from(source);
 const decoded=await p1gPackagedProfileCodec.loadProfile(source);
 const report=auditP1gEnvelope({format:'packaged',metadata:decoded.metadata});
 assert.equal(report.lengths.localExtra,4);
 assert.equal(report.lengths.centralExtra,0);
 assert.equal(report.localExtraMatchesCentral,false);
 assert(report.findings.includes('LOCAL_CENTRAL_EXTRA_BYTES_DIFFER'));
 assert.equal(report.repackageShapeObserved,false);
 assert.equal(report.editedCopyAuthorized,false);
 assert.deepEqual(Buffer.from(source),original);
});
test('central-directory to EOCD padding is audited from actual synthetic ZIP layout',async()=>{
 const source=rearrangedEncryptedFixture(plain=>{
  const eocd=plain.length-22;
  return Buffer.concat([plain.subarray(0,eocd),Buffer.from([0x61,0x62,0x63]),
   plain.subarray(eocd)]);
 });
 const loaded=await p1gPackagedProfileCodec.loadProfile(source);
 const report=auditP1gEnvelope({format:'packaged',metadata:loaded.metadata});
 assert.equal(report.lengths.centralDirectoryTrailing,3);
 assert(report.findings.includes('CENTRAL_TO_EOCD_GAP_BYTES'));
 assert.equal(report.repackageShapeObserved,false);
 assert.equal(report.writerAuthorized,false);
});
test('a compressed highly repetitive synthetic profile does not bypass central declared-size bound',async()=>{
 const big={...fixture(),SyntheticPadding:'Z'.repeat(2*1024*1024)};
 const source=new Uint8Array(makeSyntheticP1gProfile(big));
 const cipher=createDecipheriv('aes-256-ecb',KEY,null);
 const plain=Buffer.concat([cipher.update(source),cipher.final()]);
 const eocd=plain.length-22,central=plain.readUInt32LE(eocd+16);
 assert(plain.readUInt32LE(central+24)>2*1024*1024);
 assert(plain.readUInt32LE(central+20)<16384); // compression-bomb-like ratio
 plain.writeUInt32LE(1024,central+24);
 const recipher=createCipheriv('aes-256-ecb',KEY,null);
 const malformed=new Uint8Array(Buffer.concat([recipher.update(plain),recipher.final()]));
 const before=Buffer.from(malformed);
 await assert.rejects(p1gPackagedProfileCodec.loadProfile(malformed),/PROFILE_ENTRY_TOO_LARGE/);
 assert.deepEqual(Buffer.from(malformed),before);
});
test('declared profile larger than absolute 128 MiB ceiling is rejected before inflation',async()=>{
 const source=alteredEncryptedFixture(plain=>{
  const eocd=plain.length-22,central=plain.readUInt32LE(eocd+16);
  plain.writeUInt32LE(128*1024*1024+1,central+24);
 });
 const original=Buffer.from(source);
 await assert.rejects(p1gPackagedProfileCodec.loadProfile(source),/PROFILE_ENTRY_TOO_LARGE/);
 assert.deepEqual(Buffer.from(source),original);
});
