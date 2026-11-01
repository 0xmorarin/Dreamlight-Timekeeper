import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateIconManifest,inspectLosslessWebP} from '../src/icon-assets.mjs';

const root = resolve(process.argv[2]||fileURLToPath(new URL('../',import.meta.url)));
const manifest = JSON.parse(await readFile(new URL('../data/steam-icons-v1253.json',import.meta.url),'utf8'));
validateIconManifest(manifest);
let total=0;
for (const [id,entry] of Object.entries(manifest.icons)) {
  const file = resolve(root,entry.path);
  const bytes = await readFile(file);
  if (bytes.length > 6*1024*1024) throw new Error(`Icon ${id} exceeds 6 MiB.`);
  const sha = createHash('sha256').update(bytes).digest('hex');
  if (sha !== entry.sha256) throw new Error(`Icon SHA-256 mismatch: ${id}`);
  const dimensions = inspectLosslessWebP(bytes);
  if (dimensions.width !== entry.width || dimensions.height !== entry.height)
    throw new Error(`Icon dimensions mismatch: ${id}`);
  total++;
}
console.log(total ? `Verified ${total} lossless VP8L icon assets (SHA-256 + dimensions + provenance metadata).` :
  'No verified Steam assets yet. Empty manifest is valid; display placeholders remain.');
