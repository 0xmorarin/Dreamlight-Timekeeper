import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyReadOnlyRcCandidate} from '../scripts/verify-readonly-rc-candidate.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const source=Array.from({length:244},(_,i)=>[i+1,i<173?'ActivityItem.json':i<225?'Furniture.json':'Companion.json']);
const fixture=()=>({
 buildFlag:'1',
 release:{contract:'timekeeper.sveltekit.readonly-rc-release-gate/1',status:'DRAFT_NEVER_DEPLOY',profile:'TEXT_ONLY_READ_FIRST',
  product:{readonlyRcBuildTimeFlag:'VITE_WEB_READONLY_RC=1',readonlyRcWorkerDeniedRequest:'prepareEdited',writerEnabled:false,editedCopyOutputEnabled:false,directOverwriteEnabled:false,productRustReadEnabled:false,publicReleaseStillBlockedDespiteMode:true,assetRasterImagesApproved:0,staticSourceTypes:244,textFallbackRequired:true},
  staging:{reviewOnly:true,noPrivateSaveOrGameBytes:true,noUploadOrDeployInThisWorkflow:true,noRemoteTelemetry:true},
  releaseGates:{acceptedCoreReadWorker:false,qrCoreProducerAndCursor:false,rightsApproved:false,rcHeadFrozen:false,versionedReleaseProvenanceApproved:false,publicPreviewApproved:false,publicReleaseApproved:false}},
 core:{contract:'timekeeper.web.readonly-core-worker/1',status:'PROPOSED_NOT_BOUND',actualReadWorkerEnabled:false,rustReadWasmInstalled:false,permissions:{ENCODE_COPY:false,PERSISTENT_REPLACE:false,sourceFileOverwrite:false},buildEvidence:{coreReadApiAccepted:false,qrFullReadAccepted:false},transport:{productProducerEgressEnforced:false,workerHelperWiredToRealCore:false}},
 types:{schema:'TIMEKEEPER_WEB_TEXT_SOURCE_TYPE_V1',status:'STATIC_SOURCE_ONLY',counts:{total:244,ActivityItem:173,Furniture:52,Companion:19},assetSource:{eventRegistrySha256:'a'.repeat(64)},policy:{imageUrlAuthority:false,writerAuthority:false,mediaRedistributionPermission:'NOT_ESTABLISHED'},items:source},
 inventory:{contract:'timekeeper.sveltekit-build-audit@1',totalFiles:21,totalBytes:21,ownerSvgCount:16,workerDataCount:3,basePath:'/Dreamlight-Timekeeper',deployAuthorized:false,writerReleaseAuthorized:false,itemImageRightsAccepted:false,sourceTreeAllowed:false,files:Array.from({length:21},(_,i)=>({path:'_app/immutable/chunks/'+i+'.js',bytes:1,sha256:'b'.repeat(64),class:'COMPILED_STATIC'}))}
});
test('strict internal RC receipt does not grant any product capability',()=>{
 const x=verifyReadOnlyRcCandidate(fixture());
 for(const k of ['productionRustReadAccepted','independentCumulativeQrAccepted','realSaveWriterEnabled','assetRightsApproved','publicReleaseApproved'])assert.equal(x[k],false);
 assert.equal(x.compiledFiles,21);
});
const negatives=[
 ['worker grant',x=>x.release.product.writerEnabled=true],
 ['copy grant',x=>x.release.product.editedCopyOutputEnabled=true],
 ['public grant',x=>x.release.releaseGates.publicReleaseApproved=true],
 ['staging upload',x=>x.release.staging.noUploadOrDeployInThisWorkflow=false],
 ['fake Core authority',x=>x.core.actualReadWorkerEnabled=true],
 ['fake Rust ABI',x=>x.core.rustReadWasmInstalled=true],
 ['fake cursor',x=>x.core.buildEvidence.coreReadApiAccepted=true],
 ['fake producer',x=>x.core.transport.productProducerEgressEnforced=true],
 ['rights claim',x=>x.types.policy.mediaRedistributionPermission='APPROVED'],
 ['image url authority',x=>x.types.policy.imageUrlAuthority=true],
 ['duplicate ID',x=>x.types.items[3][0]=x.types.items[2][0]],
 ['wrong counts',x=>x.types.counts.Furniture=53],
 ['game raster',x=>x.inventory.files[0].path='image.webp'],
 ['source leakage',x=>x.inventory.files[0].path='profile.p1g'],
 ['duplicate files',x=>x.inventory.files[1].path=x.inventory.files[0].path],
 ['incorrect sha',x=>x.inventory.files[0].sha256='x'],
 ['hidden byte',x=>x.inventory.totalBytes=1],
 ['runtime build toggle',x=>x.buildFlag='0'],
];
for(const [name,mutate] of negatives)test('reject '+name,()=>{
 const x=clone(fixture());mutate(x);
 assert.throws(()=>verifyReadOnlyRcCandidate(x),/RC_CANDIDATE_REJECTED/);
});
