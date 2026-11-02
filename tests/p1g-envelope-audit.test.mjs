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
 assert.equal(report.repackageShapeObserved,true);
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
