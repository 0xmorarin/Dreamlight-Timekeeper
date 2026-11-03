/**
 * 03 WEB: source-visible analysis of the compiled read-only review candidate.
 * STATIC HEURISTIC ONLY: minified/dynamic code can hide network egress; a
 * successful report NEVER grants release, Writer, image rights or Core READ.
 * 00 CTRL owns actual release manifest, independent reproducibility and deploy.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {auditSveltekitBuild} from './audit-sveltekit-build.mjs';
export const COMPILED_EGRESS_AUDIT='timekeeper.web.compiled-egress-review/1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const sinks=Object.freeze({
 fetch:/\bfetch\s*\(/g,
 xhr:/\bXMLHttpRequest\b/g,
 websocket:/\bWebSocket\s*\(/g,
 eventSource:/\bEventSource\s*\(/g,
 beacon:/\bsendBeacon\s*\(/g,
 importScripts:/\bimportScripts\s*\(/g,
 worker:/\bnew\s+Worker\s*\(/g
});
export function scanJsEgressIndicators(source){
 if(typeof source!=='string')throw TypeError('EXPECTED_COMPILED_TEXT');
 const counts={};
 for(const [key,rule] of Object.entries(sinks)){
  counts[key]=[...source.matchAll(rule)].length;
 }
 const literals=[...new Set((source.match(/https?:\/\/[^\s"'<>\\]+/g)||[]))].slice(0,24);
 return {counts,urlLiteralExamples:literals};
}
export function compareCompiledInventories(first,second){
 if(first?.contract!=='timekeeper.sveltekit-build-audit@1'||
   second?.contract!=='timekeeper.sveltekit-build-audit@1'||
   !Array.isArray(first.files)||!Array.isArray(second.files))
  throw Error('COMPILED_REPRO_INVENTORY_INVALID');
 const lines=i=>i.files.map(f=>[f.path,f.bytes,f.sha256]);
 const match=JSON.stringify(lines(first))===JSON.stringify(lines(second));
 return Object.freeze({match,mode:'EXACT_SHA256_FILE_PATH_AND_LENGTH',releaseApproved:false,
  note:'Only an independent clean second build with pinned toolchain/env/source can provide two-build evidence.'});
}
export async function auditCompiledReadOnlyEgress(build='build',{sourceRoot=process.cwd()}={}){
 const receipt=await auditSveltekitBuild(build,{sourceRoot});
 const inspected=[];
 for(const file of receipt.files){
  if(!file.path.endsWith('.js')&&!file.path.endsWith('.html'))continue;
  const content=await readFile(join(resolve(build),file.path));
  if(sha(content)!==file.sha256||content.byteLength!==file.bytes)
   throw Error('COMPILED_BYTES_CHANGED_AFTER_MANIFEST:'+file.path);
  const text=content.toString('utf8');
  inspected.push({path:file.path,sha256:file.sha256,bytes:file.bytes,
   indicators:scanJsEgressIndicators(text)});
 }
 const report={
  contract:COMPILED_EGRESS_AUDIT,
  builtFileCount:receipt.totalFiles,compiledTextFileCount:inspected.length,
  sourceInventorySha256:sha(Buffer.from(JSON.stringify(receipt.files))),
  bundleFiles:inspected,
  evidence:'STATIC_COMPILED_TEXT_SCAN_ONLY',
  coreRealReadAccepted:false,remoteEgressFullyExcluded:false,
  independentBrowserNetworkCheckRequired:true,
  independentCleanBuildReproducibilityRequired:true,
  contentAndDynamicImportReviewRequired:true,
  publicReleaseAuthorized:false,writerAuthorized:false,mediaRightsApproved:false
 };
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const out=resolve(process.argv[3]??'.release-audit/web-compiled-egress-review.json');
 const report=await auditCompiledReadOnlyEgress(process.argv[2]??'build');
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'w'});
 console.log(JSON.stringify({contract:report.contract,bundles:report.compiledTextFileCount,
  sourceInventorySha256:report.sourceInventorySha256,
  evidence:report.evidence,approved:false}));
}
