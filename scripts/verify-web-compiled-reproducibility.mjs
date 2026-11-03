// 03 WEB proof of exact-binary equality across two explicit build inventories.
// It cannot verify toolchain/source/environment independence by itself.
import {readFile} from 'node:fs/promises';
import {compareCompiledInventories} from './audit-web-compiled-egress.mjs';
const [a,b]=process.argv.slice(2);
if(!a||!b||a===b)throw Error('TWO_DISTINCT_BUILD_INVENTORY_FILES_REQUIRED');
const first=JSON.parse(await readFile(a,'utf8'));
const second=JSON.parse(await readFile(b,'utf8'));
const receipt=compareCompiledInventories(first,second);
if(!receipt.match){
 const aFiles=new Map(first.files.map(x=>[x.path,x])),bFiles=new Map(second.files.map(x=>[x.path,x]));
 const delta=[...new Set([...aFiles.keys(),...bFiles.keys()])].sort()
  .flatMap(path=>{
   const old=aFiles.get(path),now=bFiles.get(path);
   if(old?.sha256===now?.sha256&&old?.bytes===now?.bytes)return [];
   return [{path,oldSha:old?.sha256??null,newSha:now?.sha256??null,
    oldBytes:old?.bytes??null,newBytes:now?.bytes??null}];
  });
 console.error('WEB_SAME_HEAD_REBUILD_SHA_MISMATCH '+JSON.stringify(delta));
 throw Error('SAME_HEAD_REBUILD_BYTES_DIFFER');
}
console.log(JSON.stringify({...receipt,claim:'SAME_RUNNER_CLEAN_REBUILD_ONLY',
 independentEnvironmentVerified:false,publicReleaseApproved:false}));
