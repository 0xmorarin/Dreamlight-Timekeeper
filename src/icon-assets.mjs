export const ICON_ROOT = 'assets/steam/v1253/';
export const ICON_PLATFORM = 'Steam/Windows';
export const ICON_VERSION = '1.25.3';
const SHA256 = /^[0-9a-f]{64}$/;
const ITEM_ID = /^(?:0|[1-9][0-9]*)$/;
const ASSET_PATH = /^assets\/steam\/v1253\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.webp$/;
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function validateIconManifest(manifest) {
  if (!isObject(manifest) || !isObject(manifest.source) || !isObject(manifest.icons))
    throw new Error('Invalid icon manifest structure.');
  if (manifest.source.platform !== ICON_PLATFORM || manifest.source.gameVersion !== ICON_VERSION)
    throw new Error('Icon manifest source platform/version mismatch.');
  const entries = Object.entries(manifest.icons);
  const expectedStatus = entries.length ? 'VERIFIED_STEAM_ASSETS' : 'NO_STEAM_ASSET_BYTES_VERIFIED';
  if (manifest.source.status !== expectedStatus)
    throw new Error('Icon manifest availability status does not match its entries.');
  const usedPaths = new Set();
  for (const [id,record] of entries) {
    if (!ITEM_ID.test(id) || !Number.isSafeInteger(Number(id)) || !isObject(record))
      throw new Error('Invalid item ID or icon entry.');
    if (record.platform !== 'Steam' || record.gameVersion !== ICON_VERSION ||
      record.verified !== true || !ASSET_PATH.test(record.path) ||
      !SHA256.test(record.sha256) || !SHA256.test(record.sourceSha256) ||
      typeof record.sourceAsset !== 'string' || !record.sourceAsset.trim() ||
      !Number.isInteger(record.width) || record.width < 1 || record.width > 16383 ||
      !Number.isInteger(record.height) || record.height < 1 || record.height > 16383)
      throw new Error(`Icon provenance or lossless WebP metadata missing for item ${id}.`);
    if (usedPaths.has(record.path))
      throw new Error(`Duplicate icon output path: ${record.path}`);
    usedPaths.add(record.path);
  }
  return true;
}

export function resolveIconAsset(manifest,itemId) {
  if (manifest?.source?.platform !== ICON_PLATFORM ||
      manifest?.source?.gameVersion !== ICON_VERSION ||
      manifest?.source?.status !== 'VERIFIED_STEAM_ASSETS') return null;
  const key = String(itemId);
  if (!ITEM_ID.test(key)) return null;
  const record = manifest.icons?.[key];
  if (!record || record.verified !== true || record.platform !== 'Steam' ||
      record.gameVersion !== ICON_VERSION || !ASSET_PATH.test(record.path) ||
      !SHA256.test(record.sha256) || !SHA256.test(record.sourceSha256)) return null;
  return record;
}

export function inspectLosslessWebP(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 25) throw new Error('WebP file is truncated.');
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const ascii = (start,end) => String.fromCharCode(...bytes.subarray(start,end));
  if (ascii(0,4) !== 'RIFF' || ascii(8,12) !== 'WEBP' || view.getUint32(4,true) !== bytes.length-8)
    throw new Error('Invalid WebP RIFF envelope.');
  if (ascii(12,16) !== 'VP8L') throw new Error('Only non-animated lossless VP8L icons are accepted.');
  const chunkSize = view.getUint32(16,true);
  if (chunkSize < 5 || 20+chunkSize+(chunkSize%2) !== bytes.length ||
      bytes[20] !== 0x2f) throw new Error('Invalid VP8L image header.');
  const bits = view.getUint32(21,true);
  if ((bits>>>29)!==0) throw new Error('Unknown VP8L header version.');
  return {width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1};
}
