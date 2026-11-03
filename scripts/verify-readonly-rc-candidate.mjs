/** 00 CTRL: strict *review-only* release-candidate inventory receipt.
 * This validates negative permission invariants, never grants release authority.
 * No save bytes, network, source code upload or deployment.
 */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const denied=(message)=>{throw Error('RC_CANDIDATE_REJECTED:'+message);};
const requireFalse=(obj,key,label)=>{
 if(!obj || obj[key]!==false)denied(label+'.'+key+' MUST_BE_FALSE');
};
const requireTrue=(obj,key,label)=>{
 if(!obj || obj[key]!==true)denied(label+'.'+key+' MUST_BE_TRUE');
};
const sha=/^[a-f0-9]{64}$/;
export function verifyReadOnlyRcCandidate({release,core,types,inventory,buildFlag}={}){
 if(buildFlag!=='1')denied('VITE_WEB_READONLY_RC_BUILD_FLAG');
 if(release?.contract!=='timekeeper.sveltekit.readonly-rc-release-gate/1'||
    release.status!=='DRAFT_NEVER_DEPLOY'||release.profile!=='TEXT_ONLY_READ_FIRST')
   denied('RELEASE_PROFILE');
 if(release.product?.readonlyRcBuildTimeFlag!=='VITE_WEB_READONLY_RC=1'||
    release.product?.readonlyRcWorkerDeniedRequest!=='prepareEdited')denied('WORKER_DENY_CONTRACT');
 for(const k of ['writerEnabled','editedCopyOutputEnabled','directOverwriteEnabled',
  'productRustReadEnabled','publicReleaseStillBlockedDespiteMode']){
   if(k==='publicReleaseStillBlockedDespiteMode')requireTrue(release.product,k,'product');
   else requireFalse(release.product,k,'product');
 }
 if(release.product.assetRasterImagesApproved!==0||release.product.staticSourceTypes!==244||
    release.product.textFallbackRequired!==true)denied('TEXT_ONLY_REQUIRED');
 for(const k of ['reviewOnly','noPrivateSaveOrGameBytes','noUploadOrDeployInThisWorkflow',
  'noRemoteTelemetry'])requireTrue(release.staging,k,'staging');
 const blocked=['acceptedCoreReadWorker','qrCoreProducerAndCursor','rightsApproved',
  'rcHeadFrozen','versionedReleaseProvenanceApproved','publicPreviewApproved','publicReleaseApproved'];
 for(const k of blocked)requireFalse(release.releaseGates,k,'releaseGates');
 if(core?.contract!=='timekeeper.web.readonly-core-worker/1'||
    core.status!=='PROPOSED_NOT_BOUND'||core.actualReadWorkerEnabled!==false||
    core.rustReadWasmInstalled!==false)denied('CORE_PRODUCT_AUTHORITY');
 for(const k of ['ENCODE_COPY','PERSISTENT_REPLACE','sourceFileOverwrite'])
  requireFalse(core.permissions,k,'core.permissions');
 for(const k of ['coreReadApiAccepted','qrFullReadAccepted'])
  requireFalse(core.buildEvidence,k,'core.buildEvidence');
 if(core.transport?.productProducerEgressEnforced!==false||
    core.transport?.workerHelperWiredToRealCore!==false)denied('CORE_EGRESS_UNACCEPTED');
 if(types?.schema!=='TIMEKEEPER_WEB_TEXT_SOURCE_TYPE_V1'||
    types.status!=='STATIC_SOURCE_ONLY'||types.counts?.total!==244||
    types.counts?.ActivityItem!==173||types.counts?.Furniture!==52||
    types.counts?.Companion!==19||!Array.isArray(types.items)||types.items.length!==244||
    !sha.test(types.assetSource?.eventRegistrySha256??''))denied('ITEM_SOURCE_TYPES');
 requireFalse(types.policy,'imageUrlAuthority','types.policy');
 requireFalse(types.policy,'writerAuthority','types.policy');
 if(types.policy.mediaRedistributionPermission!=='NOT_ESTABLISHED')denied('MEDIA_RIGHTS');
 const kinds=new Set(['ActivityItem.json','Furniture.json','Companion.json']);
 let prev=0;const counts={ActivityItem:0,Furniture:0,Companion:0};
 for(const item of types.items){
  if(!Array.isArray(item)||item.length!==2||!Number.isSafeInteger(item[0])||
     item[0]<=prev||!kinds.has(item[1]))denied('ITEM_ID_SOURCE_INVALID');
  prev=item[0];counts[item[1].slice(0,-5)]++;
 }
 for(const [name,n] of Object.entries(counts))if(n!==types.counts[name])denied('ITEM_COUNTS');
 if(inventory?.contract!=='timekeeper.sveltekit-build-audit@1'||
    !Array.isArray(inventory.files)||inventory.totalFiles!==inventory.files.length||
    inventory.totalFiles<20||inventory.ownerSvgCount!==16||inventory.workerDataCount!==3||
    inventory.basePath!=='/Dreamlight-Timekeeper')denied('COMPILED_INVENTORY');
 for(const k of ['deployAuthorized','writerReleaseAuthorized','itemImageRightsAccepted',
  'sourceTreeAllowed'])requireFalse(inventory,k,'inventory');
 let sum=0;const distinct=new Set();
 for(const item of inventory.files){
  if(typeof item.path!=='string'||distinct.has(item.path)||
     item.path.includes('..')||item.path.startsWith('/')||
     /\\.(?:webp|png|jpe?g|wasm|p1g|zip|nca|nsp|key|map)$/i.test(item.path)||
     !Number.isSafeInteger(item.bytes)||item.bytes<0||!sha.test(item.sha256)||
     !['OWNER_ORIGINAL_PROVISIONAL_SVG','INFORMATIONAL_NOTICE',
       'WORKER_DATA_REVIEW_REQUIRED','HTML_ENTRY','COMPILED_STATIC'].includes(item.class))
    denied('COMPILED_ENTRY');
  distinct.add(item.path);sum+=item.bytes;
 }
 if(sum!==inventory.totalBytes)denied('COMPILED_BYTE_COUNT');
 return Object.freeze({
  contract:'timekeeper.ctrl.readonly-rc-review-receipt/1',
  evidence:'REVIEW_ONLY_NEGATIVE_CAPABILITY_AND_INVENTORY_CONTRACT',
  sourceTypeCount:244,ownerSvgCount:16,compiledFiles:inventory.totalFiles,
  compiledBytes:inventory.totalBytes,
  productionRustReadAccepted:false,independentCumulativeQrAccepted:false,
  realSaveWriterEnabled:false,assetRightsApproved:false,publicReleaseApproved:false,
  reviewOnly:true,
  residual:['actual Rust Core worker and private cursor','real-save W1 V3 and independent V2 QA',
   'compiled JS content/egress audit','cross-build reproducibility','TOCTOU',
   'image redistribution rights','public artifact pinned approval']
 });
}
const load=async p=>JSON.parse(await readFile(p,'utf8'));
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==3)denied('USAGE_INVENTORY_PATH_REQUIRED');
 const [release,core,types,inventory]=await Promise.all([
  load('contracts/web-readonly-rc-release-v1.json'),
  load('contracts/web-readonly-core-worker-v1.json'),
  load('data/web-text-item-types-v1253.json'),load(process.argv[2])]);
 console.log('RC_REVIEW_ONLY '+JSON.stringify(verifyReadOnlyRcCandidate({release,core,types,inventory,buildFlag:process.env.VITE_WEB_READONLY_RC})));
}
