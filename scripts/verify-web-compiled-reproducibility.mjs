// 03 WEB proof of exact-binary equality across two explicit build inventories.
// It cannot verify toolchain/source/environment independence by itself.
import {readFile} from 'node:fs/promises';
import {compareCompiledInventories} from './audit-web-compiled-egress.mjs';
const [a,b]=process.argv.slice(2);
if(!a||!b||a===b)throw Error('TWO_DISTINCT_BUILD_INVENTORY_FILES_REQUIRED');
const first=JSON.parse(await readFile(a,'utf8'));
const second=JSON.parse(await readFile(b,'utf8'));
const receipt=compareCompiledInventories(first,second);
if(!receipt.match)throw Error('SAME_HEAD_REBUILD_BYTES_DIFFER');
console.log(JSON.stringify({...receipt,claim:'SAME_RUNNER_CLEAN_REBUILD_ONLY',
 independentEnvironmentVerified:false,publicReleaseApproved:false}));
