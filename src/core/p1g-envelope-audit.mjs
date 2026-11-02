// Read-only comparison of the decoded ZIP central-directory and local header.
// Source-internal parity is NOT evidence that modified ZIP reconstruction is safe.
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const bytes=x=>x instanceof Uint8Array?x:null;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const equalBytes=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const safeCount=n=>integer(n)?n:null;
export function auditP1gEnvelope({format,metadata=null}={}){
 if(format==='json')return Object.freeze({
  status:'PLAIN_JSON_NO_P1G_ENVELOPE',
  readFormat:'json',sourceMetadataPresent:false,
  findings:Object.freeze(['PLAIN_JSON_DIFFERENT_EXPORT_CONTRACT']),
  localHeaderObserved:false,localHeaderFieldsMatchCentral:null,
  repackageShapeObserved:false,localHeaderParityVerified:false,
  bytePreservationVerified:false,metadataPreservationVerified:false,
  writerAuthorized:false,editedCopyAuthorized:false
 });
 if(format!=='packaged')throw new Error('Unknown source envelope format.');
 const zip=metadata?.zip,entry=zip?.profileEntry;
 if(!obj(metadata)||!obj(zip)||!obj(entry)||
    !integer(zip.entryCount)||!integer(zip.profileEntryCount)||
    !integer(entry.flagBits)||!integer(entry.compressType))
  throw new Error('Incomplete decoded P1G envelope metadata.');
 const archiveComment=bytes(zip.archiveComment);
 const centralExtra=bytes(entry.extra),centralComment=bytes(entry.comment);
 if(!archiveComment||!centralExtra||!centralComment)
  throw new Error('Unsafe decoded P1G envelope extension metadata.');
 const findings=[];
 const add=(condition,code)=>{if(condition)findings.push(code)};
 add(zip.entryCount!==1||zip.profileEntryCount!==1,'MULTI_ENTRY_OR_INVALID_PROFILE_COUNT');
 add(archiveComment.length>0,'ARCHIVE_COMMENT_PRESENT');
 add(centralComment.length>0,'ENTRY_COMMENT_PRESENT');
 add((entry.flagBits&0x0008)!==0,'DATA_DESCRIPTOR_FLAG_WOULD_BE_REMOVED');
 add((entry.flagBits&0x0001)!==0,'ENCRYPTED_ZIP_ENTRY_NOT_SUPPORTED');
 add((entry.flagBits&~0x0808)!==0,'OTHER_ZIP_FLAGS_NEED_REVIEW');
 add(entry.compressType!==0&&entry.compressType!==8,'UNSUPPORTED_ZIP_COMPRESSION');
 add(safeCount(zip.archivePrefixBytes)>0,'ZIP_PREFIX_BYTES_PRESENT');
 add(safeCount(zip.profileTrailingRegionBytes)>0,'PROFILE_TO_CENTRAL_TRAILING_BYTES');
 add(safeCount(zip.centralDirectoryTrailingBytes)>0,'CENTRAL_TO_EOCD_GAP_BYTES');
 const local=entry.localHeader;
 const localPresent=obj(local)&&integer(local.flagBits)&&integer(local.compressType)&&
  bytes(local.extra)!==null&&integer(local.extractVersion)&&
  integer(local.dosTime)&&integer(local.dosDate)&&integer(local.crc32)&&
  integer(local.compressedSize)&&integer(local.uncompressedSize);
 let localFieldsMatchCentral=null;
 let extraEqual=null;
 if(!localPresent){
  add(centralExtra.length>0,'CENTRAL_EXTRA_PRESENT_LOCAL_EXTRA_UNVERIFIED');
  findings.push('LOCAL_HEADER_BYTES_NOT_EXPOSED');
 }else{
  extraEqual=equalBytes(centralExtra,local.extra);
  add(!extraEqual,'LOCAL_CENTRAL_EXTRA_BYTES_DIFFER');
  add(local.flagBits!==entry.flagBits,'LOCAL_CENTRAL_FLAGS_DIFFER');
  add(local.compressType!==entry.compressType,'LOCAL_CENTRAL_METHOD_DIFFERS');
  add(local.extractVersion!==entry.extractVersion,'LOCAL_CENTRAL_VERSION_DIFFERS');
  add(local.dosTime!==entry.dosTime||local.dosDate!==entry.dosDate,'LOCAL_CENTRAL_DOS_TIME_DIFFERS');
  if([entry.crc32,entry.compressedSize,entry.uncompressedSize].every(integer)){
   add(local.crc32!==entry.crc32,'LOCAL_CENTRAL_CRC_DIFFERS');
   add(local.compressedSize!==entry.compressedSize||
       local.uncompressedSize!==entry.uncompressedSize,'LOCAL_CENTRAL_SIZES_DIFFER');
  }else findings.push('CENTRAL_SIZES_NOT_EXPOSED');
  localFieldsMatchCentral=extraEqual&&local.flagBits===entry.flagBits&&
   local.compressType===entry.compressType&&local.extractVersion===entry.extractVersion&&
   local.dosTime===entry.dosTime&&local.dosDate===entry.dosDate&&
   integer(entry.crc32)&&integer(entry.compressedSize)&&integer(entry.uncompressedSize)&&
   local.crc32===entry.crc32&&local.compressedSize===entry.compressedSize&&
   local.uncompressedSize===entry.uncompressedSize;
  add(centralExtra.length>0,'ZIP_EXTRA_FIELDS_REBUILD_SEMANTICS_UNVERIFIED');
 }
 findings.push('REBUILT_ZIP_RAW_BYTE_PARITY_NOT_PROVEN');
 const benign=new Set(['REBUILT_ZIP_RAW_BYTE_PARITY_NOT_PROVEN']);
 return Object.freeze({
  status:findings.some(code=>!benign.has(code))?
   'CONTAINER_REBUILD_REQUIRES_REVIEW':'SIMPLE_ENVELOPE_OBSERVED_REBUILD_UNVERIFIED',
  readFormat:'packaged',sourceMetadataPresent:true,
  archiveEntryCount:zip.entryCount,profileEntryCount:zip.profileEntryCount,
  compressionMethod:entry.compressType,flagBits:entry.flagBits,
  localHeaderObserved:localPresent,localHeaderFieldsMatchCentral:localFieldsMatchCentral,
  localExtraMatchesCentral:extraEqual,
  lengths:Object.freeze({
   archiveComment:archiveComment.length,
   centralExtra:centralExtra.length,
   localExtra:localPresent?local.extra.length:null,
   centralComment:centralComment.length,
   archivePrefix:safeCount(zip.archivePrefixBytes),
   profileTrailingRegion:safeCount(zip.profileTrailingRegionBytes),
   centralDirectoryTrailing:safeCount(zip.centralDirectoryTrailingBytes)
  }),
  findings:Object.freeze(findings),
  repackageShapeObserved:zip.entryCount===1&&zip.profileEntryCount===1&&
   archiveComment.length===0&&(entry.compressType===0||entry.compressType===8)&&
   (localFieldsMatchCentral===true),
  // Even perfect local/central SOURCE parity does not prove that the new
  // ZIP header/extra/compressed bytes or the encrypted archive are identical.
  localHeaderParityVerified:false,bytePreservationVerified:false,
  metadataPreservationVerified:false,writerAuthorized:false,
  editedCopyAuthorized:false
 });
}
