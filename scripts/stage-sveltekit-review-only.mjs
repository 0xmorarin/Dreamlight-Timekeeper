/**
 * 00 CTRL: Copy only the WEB-audited SvelteKit static build into a NEW,
 * external review folder. This is NOT a publishing or release operation.
 * No game-derived raster, source checkout, save file or unreviewed path is copied.
 */
import {createHash} from 'node:crypto';
import {dirname,join,relative,resolve,sep} from 'node:path';
import {lstat,realpath,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {auditSveltekitBuild} from './audit-sveltekit-build.mjs';

const defaultRoot=fileURLToPath(new URL('../',import.meta.url));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(parent,child)=>{
 const rel=relative(parent,child);
 return rel===''||(!rel.startsWith('..'+sep)&&rel!=='..'&&!rel.startsWith(sep));
};

async function checkInputDirectoryComponents(path,label){
 let current=resolve(path);
 for(;;){
  const stat=await lstat(current);
  if(stat.isSymbolicLink()||!stat.isDirectory())
   throw Error('REVIEW_STAGE_SYMLINK_OR_INVALID_'+label+':'+current);
  const parent=dirname(current);
  if(parent===current)break;
  current=parent;
 }
}

async function verifyReviewDestination(source,build,output){
 if(inside(source,output)||inside(output,source)||
    inside(build,output)||inside(output,build))
  throw Error('REVIEW_STAGE_SOURCE_OR_BUILD_OVERLAP');
 let current=output;
 let existing=null;
 for(;;){
  try{
   const st=await lstat(current);
   if(st.isSymbolicLink())throw Error('REVIEW_STAGE_SYMLINK_ANCESTOR:'+current);
   if(!st.isDirectory())throw Error('REVIEW_STAGE_NON_DIRECTORY_ANCESTOR:'+current);
   if(existing===null)existing=current;
  }catch(e){if(e?.code!=='ENOENT')throw e;}
  const parent=dirname(current);
  if(parent===current)break;
  current=parent;
 }
 if(existing===null)throw Error('REVIEW_STAGE_NO_EXISTING_PARENT');
 const actual=await realpath(existing);
 const candidate=resolve(actual,relative(existing,output));
 if(inside(source,candidate)||inside(candidate,source)||
    inside(build,candidate)||inside(candidate,build))
  throw Error('REVIEW_STAGE_REALPATH_OVERLAP');
}

const sameEntries=(a,b)=>a.length===b.length&&a.every((x,i)=>
 x.path===b[i].path&&x.bytes===b[i].bytes&&x.sha256===b[i].sha256&&x.class===b[i].class
);

/**
 * Review-only staging, outside checkout, with no upload/deployment side effects.
 * Input must be an audited local SvelteKit build and a NEW destination directory.
 * The returned receipt is never a Writer/media/release authorization.
 */
export async function stageSveltekitReviewOnly({
 sourceRoot=defaultRoot,
 buildRoot,
 outputRoot
}={}){
 if(typeof outputRoot!=='string'||!outputRoot.trim())
  throw Error('REVIEW_STAGE_EXPLICIT_OUTPUT_REQUIRED');
 // Check the caller-supplied leaf BEFORE realpath: realpath hides symlinks.
 // A buildRoot alias must not silently pass the provenance boundary.
 const sourcePath=resolve(sourceRoot);
 const buildPath=resolve(buildRoot??join(sourcePath,'build'));
 await checkInputDirectoryComponents(sourcePath,'SOURCE_ROOT');
 await checkInputDirectoryComponents(buildPath,'BUILD_ROOT');
 const source=await realpath(sourcePath);
 const build=await realpath(buildPath);
 if(!inside(source,build))
  throw Error('REVIEW_STAGE_COMPILED_BUILD_REQUIRED');
 const output=resolve(outputRoot);
 await verifyReviewDestination(source,build,output);
 const reviewed=await auditSveltekitBuild(build,{sourceRoot:source});
 if(reviewed.deployAuthorized!==false||reviewed.writerReleaseAuthorized!==false||
    reviewed.sourceTreeAllowed!==false||reviewed.itemImageRightsAccepted!==false)
  throw Error('REVIEW_STAGE_AUDIT_PERMISSION_INCONSISTENT');
 // Refuse to replace even an EMPTY existing directory.
 await mkdir(output);
 let completed=false;
 try{
  for(const item of reviewed.files){
   const from=join(build,item.path);
   const stat=await lstat(from);
   if(!stat.isFile()||stat.isSymbolicLink())
    throw Error('REVIEW_STAGE_SOURCE_TYPE_CHANGED:'+item.path);
   const bytes=await readFile(from);
   if(bytes.length!==item.bytes||sha256(bytes)!==item.sha256)
    throw Error('REVIEW_STAGE_SOURCE_CHANGED:'+item.path);
   const dest=join(output,item.path);
   await mkdir(dirname(dest),{recursive:true});
   await writeFile(dest,bytes,{flag:'wx'});
   if(sha256(await readFile(dest))!==item.sha256)
    throw Error('REVIEW_STAGE_COPY_HASH_MISMATCH:'+item.path);
  }
  const staged=await auditSveltekitBuild(output,{sourceRoot:source});
  if(!sameEntries(reviewed.files,staged.files))
   throw Error('REVIEW_STAGE_INVENTORY_CHANGED');
  completed=true;
  return Object.freeze({
   contract:'timekeeper.sveltekit-review-stage@1',
   releaseProfile:'OWNER_SVG_TEXT_ONLY_REVIEW',
   sourceTreeCopied:false,
   publicReleaseApproved:false,
   mediaRedistributionApproved:false,
   writerAuthorityChanged:false,
   deployAuthorized:false,
   fileCount:staged.totalFiles,
   totalBytes:staged.totalBytes,
   inventorySha256:sha256(Buffer.from(JSON.stringify(staged.files))),
   evidence:'COMPILED_BYTES_STAGED_FOR_INDEPENDENT_REVIEW_ONLY'
  });
 }finally{
  if(!completed)await rm(output,{recursive:true,force:true});
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==4)throw Error(
  'Usage: node scripts/stage-sveltekit-review-only.mjs <compiled-build-root> <new-external-review-folder>');
 console.log(JSON.stringify(await stageSveltekitReviewOnly({
  buildRoot:process.argv[2],outputRoot:process.argv[3]
 }),null,2));
}
