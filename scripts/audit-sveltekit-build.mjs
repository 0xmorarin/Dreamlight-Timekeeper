/**
 * Review-only deterministic SvelteKit build inventory for 00 CTRL / 05 QR.
 * No upload, no release staging and no broad source-directory inclusion.
 * Usage: node scripts/audit-sveltekit-build.mjs build .release-audit/inventory.json
 */
import {readdir,readFile,lstat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const workerAssets=Object.freeze([
 /^_app\/immutable\/workers\/assets\/events-v1253-[A-Za-z0-9_-]+\.json$/,
 /^_app\/immutable\/workers\/assets\/timing-review-rules-v1253-[A-Za-z0-9_-]+\.json$/,
 /^_app\/immutable\/workers\/assets\/item-names-v1250\.json-[A-Za-z0-9_-]+\.bin$/
]);
async function inventoryFiles(root){
 const names=[];
 async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const path=join(dir,entry.name),stat=await lstat(path);
   if(stat.isSymbolicLink())throw Error('SYMLINK_FORBIDDEN:'+path);
   if(stat.isDirectory()){await walk(path);continue;}
   if(!stat.isFile())throw Error('NONFILE_FORBIDDEN:'+path);
   names.push(relative(root,path).split('\\').join('/'));
  }
 }
 await walk(root);return names.sort();
}
export async function auditSveltekitBuild(root,{sourceRoot=process.cwd()}={}){
 const target=resolve(root),paths=await inventoryFiles(target);
 const manifest=JSON.parse(await readFile(join(sourceRoot,'data/app-ui-icons.json'),'utf8'));
 const icons=Object.values(manifest.icons??{}).filter(x=>x.verified===true&&x.kind==='app_ui');
 if(icons.length!==16)throw Error('OWNER_16_SVG_PROVENANCE_REQUIRED');
 const svgMap=new Map(icons.map(({path,sha256})=>[path,sha256]));
 if(svgMap.size!==16)throw Error('OWNER_SVG_DUPLICATE');
 const seenSvg=new Set(),seenWorkerAssets=new Set(),result=[];
 for(const path of paths){
  if(path.includes('..')||path.startsWith('/')||
     /(?:^|\/)(?:src|tests|qa|scripts|docs|\.github|node_modules)(?:\/|$)/.test(path)||
     /\.(?:webp|png|jpg|jpeg|map|wasm|p1g|zip|nca|nsp|keys?)$/i.test(path))
   throw Error('UNAPPROVED_DISTRIBUTION_PATH:'+path);
  const isEntry=path==='index.html'||path==='404.html';
  const isIcon=svgMap.has(path);
  const isNotice=path==='assets/app/release-notice.css';
  const isCompiled= /^_app\/immutable\/(?:entry|nodes|chunks|assets|workers)\/[A-Za-z0-9_./-]+\.(?:js|css|json|bin)$/.test(path);
  const isFramework= /^_app\/(?:env\.js|version\.json)$/.test(path);
  if(!(isEntry||isIcon||isNotice||isCompiled||isFramework))
   throw Error('UNKNOWN_BUILD_OUTPUT:'+path);
  const bytes=await readFile(join(target,path));
  const checksum=hash(bytes);
  if(isIcon){
   if(svgMap.get(path)!==checksum)throw Error('OWNER_SVG_HASH_DRIFT:'+path);
   seenSvg.add(path);
  }
  if(path.includes('/workers/assets/')){
   const rule=workerAssets.find(rule=>rule.test(path));
   if(!rule)throw Error('UNAPPROVED_WORKER_DATA:'+path);
   const index=workerAssets.indexOf(rule);
   if(seenWorkerAssets.has(index))throw Error('DUPLICATE_WORKER_DATA:'+path);
   seenWorkerAssets.add(index);
   const sourceName=[
    'data/events-v1253.json',
    'data/timing-review-rules-v1253.json',
    'data/item-names-v1250.json.gz'
   ][index];
   const original=await readFile(join(sourceRoot,sourceName));
   if(!original.equals(bytes))throw Error('WORKER_DATA_SOURCE_MISMATCH:'+path);
  }
  result.push({path,bytes:bytes.length,sha256:checksum,
   class:isIcon?'OWNER_ORIGINAL_PROVISIONAL_SVG':isNotice?'INFORMATIONAL_NOTICE':
    path.includes('/workers/assets/')?'WORKER_DATA_REVIEW_REQUIRED':
    isEntry?'HTML_ENTRY':'COMPILED_STATIC'});
 }
 if(paths.filter(p=>p==='index.html'||p==='404.html').length!==2||
    seenSvg.size!==16||seenWorkerAssets.size!==3||
    !paths.some(p=>/^_app\/immutable\/workers\/.+\.js$/.test(p))||
    !paths.some(p=>/^_app\/immutable\/entry\/.+\.js$/.test(p)))
  throw Error('INCOMPLETE_SVELTEKIT_ARTIFACT');
 return {
  contract:'timekeeper.sveltekit-build-audit@1',
  deployAuthorized:false,
  sourceTreeAllowed:false,
  itemImageRightsAccepted:false,
  writerReleaseAuthorized:false,
  basePath:'/Dreamlight-Timekeeper',
  entries:['index.html','404.html'],
  ownerSvgCount:seenSvg.size,
  workerDataCount:seenWorkerAssets.size,
  workerCode:result.filter(x=>x.path.startsWith('_app/immutable/workers/')&&x.path.endsWith('.js')).map(x=>x.path),
  totalFiles:result.length,totalBytes:result.reduce((a,x)=>a+x.bytes,0),
  files:result
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const build=process.argv[2]??'build',out=resolve(process.argv[3]??'.release-audit/sveltekit-build-inventory.json');
 const report=await auditSveltekitBuild(build);
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(report,null,2)+'\n');
 console.log('SVELTEKIT_DISTRIBUTION_REVIEW_ONLY '+JSON.stringify({
  files:report.totalFiles,bytes:report.totalBytes,ownerSvg:report.ownerSvgCount,
  workerData:report.workerDataCount,workerJs:report.workerCode,
  inventorySha256:hash(await readFile(out)),approved:false
 }));
}
