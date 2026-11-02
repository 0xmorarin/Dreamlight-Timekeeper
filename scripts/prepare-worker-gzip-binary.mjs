import {copyFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const from=new URL('../data/item-names-v1250.json.gz',import.meta.url);
const to=new URL('../data/item-names-v1250.json.bin',import.meta.url);
// Vite/sirv may transparently decode or treat .gz as a download. Preserve the
// SAME gzip bytes under a neutral static MIME extension for this build only.
const bytes=await readFile(from);
if(bytes[0]!==0x1f||bytes[1]!==0x8b)throw Error('Expected deterministic GZIP source bytes');
await copyFile(from,to);
const copied=await readFile(to);
if(!bytes.equals(copied))throw Error('Worker resource gzip alias byte mismatch');
console.log('Static Worker gzip alias verified sha256='+createHash('sha256').update(bytes).digest('hex'));
