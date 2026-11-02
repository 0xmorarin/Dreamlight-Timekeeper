import assert from 'node:assert/strict';
import test from 'node:test';
import {makeSyntheticP1gProfile} from './fixture.mjs';
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
 assert(audit.findings.includes('LOCAL_HEADER_BYTES_NOT_EXPOSED'));
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
  'CENTRAL_EXTRA_PRESENT_LOCAL_EXTRA_UNVERIFIED','ENTRY_COMMENT_PRESENT',
  'DATA_DESCRIPTOR_FLAG_WOULD_BE_REMOVED'])
  assert(audit.findings.includes(code),code);
 assert.equal(audit.status,'CONTAINER_REBUILD_REQUIRES_REVIEW');
 assert.equal(audit.repackageShapeObserved,false);
 assert.equal(audit.lengths.centralExtra,2);
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
