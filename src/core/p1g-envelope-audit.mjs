// Read-only reporting of P1G envelope features that may change under the
// current single-profile ZIP rebuild. It never approves modified export.
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const asBytes=x=>x instanceof Uint8Array?x:null;
const uint=x=>Number.isSafeInteger(x)&&x>=0;
export function auditP1gEnvelope({format,metadata=null}={}){
 if(format==='json')return Object.freeze({
  status:'PLAIN_JSON_NO_P1G_ENVELOPE',
  readFormat:'json',sourceMetadataPresent:false,
  findings:Object.freeze(['PLAIN_JSON_DIFFERENT_EXPORT_CONTRACT']),
  repackageShapeObserved:false,localHeaderParityVerified:false,
  bytePreservationVerified:false,metadataPreservationVerified:false,
  writerAuthorized:false,editedCopyAuthorized:false
 });
 if(format!=='packaged')throw new Error('Unknown source envelope format.');
 const zip=metadata?.zip,entry=zip?.profileEntry;
 if(!obj(metadata)||!obj(zip)||!obj(entry)||
    !uint(zip.entryCount)||!uint(zip.profileEntryCount)||
    !uint(entry.flagBits)||!uint(entry.compressType))
  throw new Error('Incomplete decoded P1G envelope metadata.');
 const archiveComment=asBytes(zip.archiveComment);
 const centralExtra=asBytes(entry.extra),centralComment=asBytes(entry.comment);
 if(!archiveComment||!centralExtra||!centralComment)
  throw new Error('Unsafe decoded P1G envelope extension metadata.');
 const findings=[];
 const add=(condition,code)=>{if(condition)findings.push(code)};
 add(zip.entryCount!==1||zip.profileEntryCount!==1,'MULTI_ENTRY_OR_INVALID_PROFILE_COUNT');
 add(archiveComment.length>0,'ARCHIVE_COMMENT_PRESENT');
 add(centralExtra.length>0,'CENTRAL_EXTRA_PRESENT_LOCAL_EXTRA_UNVERIFIED');
 add(centralComment.length>0,'ENTRY_COMMENT_PRESENT');
 add((entry.flagBits&0x0008)!==0,'DATA_DESCRIPTOR_FLAG_WOULD_BE_REMOVED');
 add((entry.flagBits&0x0001)!==0,'ENCRYPTED_ZIP_ENTRY_NOT_SUPPORTED');
 add((entry.flagBits&~0x0808)!==0,'OTHER_ZIP_FLAGS_NEED_REVIEW');
 add(entry.compressType!==0&&entry.compressType!==8,'UNSUPPORTED_ZIP_COMPRESSION');
 // The decoder currently does not expose original local extra bytes, local
 // flag bits or file-prefix/ZIP layout details for byte-level comparison.
 findings.push('LOCAL_HEADER_BYTES_NOT_EXPOSED');
 findings.push('REBUILT_ZIP_RAW_BYTE_PARITY_NOT_PROVEN');
 // Even with a simple single-entry archive, JSON whitespace, compression,
 // ZIP offsets and ECB ciphertext can differ upon modified repack.
 return Object.freeze({
  status:findings.some(x=>!['LOCAL_HEADER_BYTES_NOT_EXPOSED','REBUILT_ZIP_RAW_BYTE_PARITY_NOT_PROVEN'].includes(x))?
   'CONTAINER_REBUILD_REQUIRES_REVIEW':'SIMPLE_ENVELOPE_OBSERVED_REBUILD_UNVERIFIED',
  readFormat:'packaged',sourceMetadataPresent:true,
  archiveEntryCount:zip.entryCount,profileEntryCount:zip.profileEntryCount,
  compressionMethod:entry.compressType,flagBits:entry.flagBits,
  lengths:Object.freeze({
   archiveComment:archiveComment.length,
   centralExtra:centralExtra.length,centralComment:centralComment.length
  }),
  findings:Object.freeze(findings),
  repackageShapeObserved:zip.entryCount===1&&zip.profileEntryCount===1&&
   archiveComment.length===0&&(entry.compressType===0||entry.compressType===8),
  localHeaderParityVerified:false,bytePreservationVerified:false,
  metadataPreservationVerified:false,writerAuthorized:false,
  editedCopyAuthorized:false
 });
}
