import {isAbsolute} from 'node:path';

const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^(?:0|[1-9][0-9]*)$/;
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function checkIconImportPlan(plan) {
  if (!isObject(plan) || !isObject(plan.source) || !Array.isArray(plan.icons))
    throw new Error('Invalid icon import plan.');
  if (plan.source.platform !== 'Steam/Windows' || plan.source.gameVersion !== '1.25.3')
    throw new Error('Icon source must be Steam/Windows v1.25.3.');
  if (!plan.icons.length) throw new Error('No icons specified.');
  const ids = new Set();
  const paths = new Set();
  for (const entry of plan.icons) {
    if (!isObject(entry) || typeof entry.itemId !== 'string' || !ID.test(entry.itemId) ||
      !Number.isSafeInteger(Number(entry.itemId))) throw new Error('Invalid Item ID.');
    if (typeof entry.pngPath !== 'string' || entry.pngPath.length === 0 ||
      isAbsolute(entry.pngPath) || !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.png$/.test(entry.pngPath))
      throw new Error('Source PNG path must be a simple relative path.');
    if (typeof entry.sourceAsset !== 'string' || !entry.sourceAsset.trim() ||
      typeof entry.itemIdEvidence !== 'string' || !entry.itemIdEvidence.trim() ||
      !SHA256.test(entry.sourceSha256))
      throw new Error('Source provenance or mapping evidence missing.');
    if (ids.has(entry.itemId) || paths.has(entry.pngPath))
      throw new Error('Duplicate source image or Item ID.');
    ids.add(entry.itemId);
    paths.add(entry.pngPath);
  }
  return true;
}

export function readPngRgbaHeader(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 33 ||
    !Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    throw new Error('Input must be PNG.');
  const d = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (d.getUint32(8,false)!==13 || Buffer.from(bytes.subarray(12,16)).toString()!=='IHDR')
    throw new Error('PNG header invalid.');
  const width=d.getUint32(16,false),height=d.getUint32(20,false);
  if (width<1 || height<1 || width>1024 || height>1024 ||
    bytes[24]!==8 || bytes[25]!==6 || bytes[28]!==0)
    throw new Error('Only non-interlaced 8-bit RGBA PNG up to 1024 pixels is accepted.');
  return {width,height};
}
