const MAX_INPUT_BYTES = 128 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_PROFILE_BYTES = 128 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 1024;
const PROFILE_NAME = 'profile';
const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_EOCD = 0x06054b50;
const ZIP_METHOD_STORE = 0;
const ZIP_METHOD_DEFLATE = 8;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const KEY_BYTES = hexToBytes('62357168683873614A38556C444A557A545A5864325467366D626F3857386e35');
let AES_ROUND_KEYS;
export const P1G_CODEC_VERSION = 'p1g-packaged-profile-codec@1';
export const P1G_CONTRACT = 'p1g-v0';
export const p1gPackagedProfileCodec = Object.freeze({
    contract: P1G_CONTRACT,
    codecVersion: P1G_CODEC_VERSION,
    async loadProfile(input) {
        const source = requireBytes(input, 'profile source');
        const archive = await decryptAes256EcbPkcs7(source);
        if (archive.length > MAX_ARCHIVE_BYTES)
            throw new Error('DECRYPTED_ARCHIVE_TOO_LARGE');
        const extracted = await extractProfileFromZip(archive);
        let jsonText;
        try {
            jsonText = decoder.decode(extracted.profileBytes);
        }
        catch {
            throw new Error('PROFILE_UTF8_INVALID');
        }
        const root = parseRequiredProfileJson(jsonText);
        return {
            inputType: 'packaged',
            jsonText,
            metadata: Object.freeze({
                codecVersion: P1G_CODEC_VERSION,
                profileVersion: checkedVersion(root.GameInfo.Version),
                zip: extracted.metadata
            })
        };
    },
    parseProfileText(text) {
        const root = parseRequiredProfileJson(text);
        return { metadata: Object.freeze({ profileVersion: checkedVersion(root.GameInfo.Version) }) };
    },
    async createEncodedProfile(text, expectedMetadata) {
        if (typeof text !== 'string' || text.length === 0)
            throw new Error('PROFILE_JSON_INVALID');
        const root = parseRequiredProfileJson(text);
        const metadata = requireCodecMetadata(expectedMetadata);
        if (metadata.codecVersion !== P1G_CODEC_VERSION)
            throw new Error('CODEC_METADATA_VERSION_MISMATCH');
        if (checkedVersion(root.GameInfo.Version) !== checkedVersion(metadata.profileVersion)) {
            throw new Error('PROFILE_VERSION_CHANGED_DURING_ENCODE');
        }
        if (metadata.zip.entryCount !== 1 || metadata.zip.profileEntryCount !== 1) {
            throw new Error('ZIP_UNSUPPORTED_EXTRA_ENTRIES_FOR_MODIFIED_ENCODE');
        }
        if (metadata.zip.archiveComment.length !== 0) {
            throw new Error('ZIP_UNSUPPORTED_ARCHIVE_COMMENT_FOR_MODIFIED_ENCODE');
        }
        const profileBytes = encoder.encode(text);
        if (profileBytes.length > MAX_PROFILE_BYTES)
            throw new Error('PROFILE_ENTRY_TOO_LARGE');
        const archive = await buildSingleProfileZip(profileBytes, metadata.zip.profileEntry);
        const encrypted = encryptAes256EcbPkcs7(archive);
        const reopened = await this.loadProfile(encrypted);
        const expectedRoot = JSON.parse(text);
        const actualRoot = JSON.parse(reopened.jsonText);
        if (!jsonSemanticEqual(expectedRoot, actualRoot))
            throw new Error('ENCODE_REOPEN_SEMANTIC_MISMATCH');
        return encrypted;
    },
    getProfileVersion(metadata) {
        const obj = asObject(metadata);
        const version = obj?.profileVersion;
        return checkedVersion(version);
    }
});
export async function decodeP1gPackagedProfile(ciphertext) {
    return p1gPackagedProfileCodec.loadProfile(ciphertext);
}
function requireBytes(input, label) {
    if (!(input instanceof Uint8Array))
        throw new TypeError(`${label} must be Uint8Array.`);
    if (input.length === 0 || input.length > MAX_INPUT_BYTES)
        throw new Error('INVALID_ENCRYPTED_PROFILE_LENGTH');
    return input;
}
function asObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function checkedVersion(value) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
        return value;
    if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) {
        const n = Number(value);
        if (Number.isSafeInteger(n))
            return n;
    }
    throw new Error('PROFILE_VERSION_INVALID');
}
function parseRequiredProfileJson(text) {
    let root;
    try {
        root = JSON.parse(text);
    }
    catch {
        throw new Error('PROFILE_JSON_INVALID');
    }
    if (!asObject(root) || !asObject(root.GameInfo))
        throw new Error('PROFILE_ROOT_INVALID');
    if (!asObject(root.Player) || !asObject(root.World))
        throw new Error('PROFILE_REQUIRED_SECTIONS_MISSING');
    return root;
}
function requireCodecMetadata(value) {
    const obj = asObject(value);
    const zip = asObject(obj?.zip);
    const entry = asObject(zip?.profileEntry);
    if (!obj || !zip || !entry || typeof obj.codecVersion !== 'string')
        throw new Error('CODEC_METADATA_INVALID');
    return obj;
}
function jsonSemanticEqual(a, b) {
    if (Object.is(a, b))
        return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length && a.every((v, i) => jsonSemanticEqual(v, b[i]));
    }
    const ao = asObject(a), bo = asObject(b);
    if (ao && bo) {
        const ak = Object.keys(ao), bk = Object.keys(bo);
        if (ak.length !== bk.length)
            return false;
        for (const k of ak) {
            if (!Object.prototype.hasOwnProperty.call(bo, k) || !jsonSemanticEqual(ao[k], bo[k]))
                return false;
        }
        return true;
    }
    return false;
}
async function decryptAes256EcbPkcs7(ciphertext) {
    if (ciphertext.length === 0 || ciphertext.length % 16 !== 0)
        throw new Error('INVALID_ENCRYPTED_PROFILE_LENGTH');
    if (!globalThis.crypto?.subtle)
        throw new Error('WEB_CRYPTO_UNAVAILABLE');
    const last = ciphertext.subarray(ciphertext.length - 16);
    const x = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1)
        x[i] = last[i] ^ 0x10;
    const crafted = aes256EncryptBlock(x, AES_ROUND_KEYS);
    const cbcCipher = new Uint8Array(ciphertext.length + 16);
    cbcCipher.set(ciphertext, 0);
    cbcCipher.set(crafted, ciphertext.length);
    let cbcPlain;
    try {
        const key = await crypto.subtle.importKey('raw', KEY_BYTES, { name: 'AES-CBC' }, false, ['decrypt']);
        const result = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, key, cbcCipher);
        cbcPlain = new Uint8Array(result);
    }
    catch (error) {
        throw new Error(`AES_DECRYPT_FAILED:${error instanceof Error ? error.message : String(error)}`);
    }
    if (cbcPlain.length !== ciphertext.length)
        throw new Error('AES_CBC_ECB_BRIDGE_LENGTH_MISMATCH');
    const padded = new Uint8Array(ciphertext.length);
    padded.set(cbcPlain.subarray(0, 16), 0);
    for (let off = 16; off < ciphertext.length; off += 16) {
        for (let i = 0; i < 16; i += 1)
            padded[off + i] = cbcPlain[off + i] ^ ciphertext[off - 16 + i];
    }
    return pkcs7Unpad(padded);
}
function encryptAes256EcbPkcs7(plain) {
    const padded = pkcs7Pad(plain);
    const out = new Uint8Array(padded.length);
    for (let off = 0; off < padded.length; off += 16) {
        out.set(aes256EncryptBlock(padded.subarray(off, off + 16), AES_ROUND_KEYS), off);
    }
    return out;
}
function pkcs7Pad(data) {
    const pad = 16 - (data.length % 16 || 16) + (data.length % 16 === 0 ? 16 : 0);
    const out = new Uint8Array(data.length + pad);
    out.set(data);
    out.fill(pad, data.length);
    return out;
}
function pkcs7Unpad(data) {
    if (data.length === 0 || data.length % 16 !== 0)
        throw new Error('INVALID_PKCS7_PADDING');
    const pad = data[data.length - 1];
    if (pad < 1 || pad > 16 || pad > data.length)
        throw new Error('INVALID_PKCS7_PADDING');
    for (let i = data.length - pad; i < data.length; i += 1)
        if (data[i] !== pad)
            throw new Error('INVALID_PKCS7_PADDING');
    return data.slice(0, data.length - pad);
}
const SBOX = Uint8Array.from([
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
]);
const RCON = Uint8Array.from([0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]);
AES_ROUND_KEYS = expandAes256Key(KEY_BYTES);
function expandAes256Key(key) {
    if (!(key instanceof Uint8Array) || key.length !== 32)
        throw new Error('AES256_KEY_LENGTH_INVALID');
    const w = new Uint8Array(240);
    w.set(key);
    let generated = 32, rcon = 1;
    const temp = new Uint8Array(4);
    while (generated < 240) {
        temp.set(w.subarray(generated - 4, generated));
        if (generated % 32 === 0) {
            const t = temp[0];
            temp[0] = SBOX[temp[1]] ^ RCON[rcon++];
            temp[1] = SBOX[temp[2]];
            temp[2] = SBOX[temp[3]];
            temp[3] = SBOX[t];
        }
        else if (generated % 32 === 16) {
            for (let i = 0; i < 4; i += 1)
                temp[i] = SBOX[temp[i]];
        }
        for (let i = 0; i < 4; i += 1) {
            w[generated] = w[generated - 32] ^ temp[i];
            generated += 1;
        }
    }
    return w;
}
function aes256EncryptBlock(input, roundKeys) {
    if (input.length !== 16)
        throw new Error('AES_BLOCK_LENGTH_INVALID');
    const s = Uint8Array.from(input);
    addRoundKey(s, roundKeys, 0);
    for (let round = 1; round < 14; round += 1) {
        subBytes(s);
        shiftRows(s);
        mixColumns(s);
        addRoundKey(s, roundKeys, round * 16);
    }
    subBytes(s);
    shiftRows(s);
    addRoundKey(s, roundKeys, 14 * 16);
    return s;
}
function addRoundKey(s, k, off) { for (let i = 0; i < 16; i += 1)
    s[i] ^= k[off + i]; }
function subBytes(s) { for (let i = 0; i < 16; i += 1)
    s[i] = SBOX[s[i]]; }
function shiftRows(s) {
    const t = Uint8Array.from(s);
    s[0] = t[0];
    s[4] = t[4];
    s[8] = t[8];
    s[12] = t[12];
    s[1] = t[5];
    s[5] = t[9];
    s[9] = t[13];
    s[13] = t[1];
    s[2] = t[10];
    s[6] = t[14];
    s[10] = t[2];
    s[14] = t[6];
    s[3] = t[15];
    s[7] = t[3];
    s[11] = t[7];
    s[15] = t[11];
}
function xtime(x) { return ((x << 1) ^ ((x & 0x80) ? 0x1b : 0)) & 0xff; }
function mixColumns(s) {
    for (let c = 0; c < 4; c += 1) {
        const i = c * 4, a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
        const x0 = xtime(a0), x1 = xtime(a1), x2 = xtime(a2), x3 = xtime(a3);
        s[i] = x0 ^ (x1 ^ a1) ^ a2 ^ a3;
        s[i + 1] = a0 ^ x1 ^ (x2 ^ a2) ^ a3;
        s[i + 2] = a0 ^ a1 ^ x2 ^ (x3 ^ a3);
        s[i + 3] = (x0 ^ a0) ^ a1 ^ a2 ^ x3;
    }
}
async function extractProfileFromZip(archive) {
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    const eocdOffset = findEocd(archive, view);
    const disk = u16(view, eocdOffset + 4), centralDisk = u16(view, eocdOffset + 6);
    const entriesDisk = u16(view, eocdOffset + 8), entriesTotal = u16(view, eocdOffset + 10);
    const centralSize = u32(view, eocdOffset + 12), centralOffset = u32(view, eocdOffset + 16);
    const archiveCommentLength = u16(view, eocdOffset + 20);
    if (disk !== 0 || centralDisk !== 0 || entriesDisk !== entriesTotal)
        throw new Error('ZIP_MULTIDISK_UNSUPPORTED');
    if (entriesTotal === 0 || entriesTotal > MAX_ZIP_ENTRIES)
        throw new Error('ZIP_ENTRY_COUNT_INVALID');
    if (centralOffset + centralSize > eocdOffset)
        throw new Error('ZIP_CENTRAL_DIRECTORY_INVALID');
    if (eocdOffset + 22 + archiveCommentLength !== archive.length)
        throw new Error('ZIP_EOCD_LENGTH_INVALID');
    const archiveComment = archive.slice(eocdOffset + 22);
    let pos = centralOffset;
    const entries = [];
    for (let index = 0; index < entriesTotal; index += 1) {
        if (pos + 46 > eocdOffset || u32(view, pos) !== ZIP_CENTRAL)
            throw new Error('ZIP_CENTRAL_ENTRY_INVALID');
        const versionMadeBy = u16(view, pos + 4);
        const extractVersion = u16(view, pos + 6);
        const flagBits = u16(view, pos + 8);
        const method = u16(view, pos + 10);
        const dosTime = u16(view, pos + 12), dosDate = u16(view, pos + 14);
        const crc = u32(view, pos + 16), compressedSize = u32(view, pos + 20), uncompressedSize = u32(view, pos + 24);
        const nameLen = u16(view, pos + 28), extraLen = u16(view, pos + 30), commentLen = u16(view, pos + 32);
        const diskStart = u16(view, pos + 34), internalAttr = u16(view, pos + 36), externalAttr = u32(view, pos + 38);
        const localOffset = u32(view, pos + 42);
        const end = pos + 46 + nameLen + extraLen + commentLen;
        if (end > eocdOffset)
            throw new Error('ZIP_CENTRAL_ENTRY_TRUNCATED');
        if (diskStart !== 0)
            throw new Error('ZIP_MULTIDISK_UNSUPPORTED');
        const nameBytes = archive.slice(pos + 46, pos + 46 + nameLen);
        let filename;
        try {
            filename = decoder.decode(nameBytes);
        }
        catch {
            throw new Error('ZIP_FILENAME_UTF8_INVALID');
        }
        entries.push({
            filename, versionMadeBy, extractVersion, flagBits, method, dosTime, dosDate, crc,
            compressedSize, uncompressedSize, internalAttr, externalAttr, localOffset,
            extra: archive.slice(pos + 46 + nameLen, pos + 46 + nameLen + extraLen),
            comment: archive.slice(pos + 46 + nameLen + extraLen, end)
        });
        pos = end;
    }
    if (pos !== centralOffset + centralSize)
        throw new Error('ZIP_CENTRAL_SIZE_MISMATCH');
    const profiles = entries.filter((e) => e.filename === PROFILE_NAME);
    if (profiles.length !== 1)
        throw new Error('ZIP_PROFILE_ENTRY_COUNT_INVALID');
    const entry = profiles[0];
    if (entry.uncompressedSize > MAX_PROFILE_BYTES)
        throw new Error('PROFILE_ENTRY_TOO_LARGE');
    if ((entry.flagBits & 0x0001) !== 0)
        throw new Error('ZIP_ENCRYPTED_ENTRY_UNSUPPORTED');
    if (entry.method !== ZIP_METHOD_STORE && entry.method !== ZIP_METHOD_DEFLATE)
        throw new Error('ZIP_COMPRESSION_METHOD_UNSUPPORTED');
    const local = entry.localOffset;
    if (local + 30 > archive.length || u32(view, local) !== ZIP_LOCAL)
        throw new Error('ZIP_LOCAL_HEADER_INVALID');
    const localVersion = u16(view, local + 4);
    const localFlags = u16(view, local + 6), localMethod = u16(view, local + 8);
    const localDosTime = u16(view, local + 10), localDosDate = u16(view, local + 12);
    const localCrc = u32(view, local + 14);
    const localCompressedSize = u32(view, local + 18);
    const localUncompressedSize = u32(view, local + 22);
    const localNameLen = u16(view, local + 26), localExtraLen = u16(view, local + 28);
    if ((localFlags & 0x0001) !== 0 || localMethod !== entry.method)
        throw new Error('ZIP_LOCAL_HEADER_MISMATCH');
    const dataStart = local + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > centralOffset)
        throw new Error('ZIP_PROFILE_DATA_TRUNCATED');
    const localNameBytes = archive.slice(local + 30, local + 30 + localNameLen);
    let localName;
    try {
        localName = decoder.decode(localNameBytes);
    }
    catch {
        throw new Error('ZIP_FILENAME_UTF8_INVALID');
    }
    if (localName !== PROFILE_NAME)
        throw new Error('ZIP_LOCAL_PROFILE_NAME_MISMATCH');
    const localExtra = archive.slice(local + 30 + localNameLen, dataStart);
    const compressed = archive.slice(dataStart, dataEnd);
    const profileBytes = entry.method === ZIP_METHOD_STORE ? compressed :
        await transformDeflate(compressed, false, entry.uncompressedSize);
    if (profileBytes.length !== entry.uncompressedSize || profileBytes.length > MAX_PROFILE_BYTES)
        throw new Error('PROFILE_ENTRY_SIZE_MISMATCH');
    if (crc32(profileBytes) !== entry.crc)
        throw new Error('ZIP_PROFILE_CRC_INVALID');
    return {
        profileBytes,
        metadata: Object.freeze({
            entryCount: entriesTotal,
            profileEntryCount: profiles.length,
            archiveComment,
            // Read-only original layout evidence; never used as an implicit
            // modified-copy writer authorization.
            archivePrefixBytes: local,
            profileTrailingRegionBytes: centralOffset - dataEnd,
            centralDirectoryTrailingBytes: eocdOffset - (centralOffset + centralSize),
            profileEntry: Object.freeze({
                createSystem: (entry.versionMadeBy >>> 8) & 0xff,
                createVersion: entry.versionMadeBy & 0xff,
                extractVersion: entry.extractVersion,
                flagBits: entry.flagBits,
                compressType: entry.method,
                crc32: entry.crc,
                compressedSize: entry.compressedSize,
                uncompressedSize: entry.uncompressedSize,
                dosTime: entry.dosTime,
                dosDate: entry.dosDate,
                comment: entry.comment,
                extra: entry.extra,
                internalAttr: entry.internalAttr,
                externalAttr: entry.externalAttr,
                localHeader: Object.freeze({
                    extractVersion: localVersion,
                    flagBits: localFlags,
                    compressType: localMethod,
                    dosTime: localDosTime,
                    dosDate: localDosDate,
                    crc32: localCrc,
                    compressedSize: localCompressedSize,
                    uncompressedSize: localUncompressedSize,
                    extra: localExtra
                })
            })
        })
    };
}
async function buildSingleProfileZip(profileBytes, rawMeta) {
    const meta = asObject(rawMeta);
    if (!meta)
        throw new Error('ZIP_METADATA_INVALID');
    const method = Number(meta.compressType);
    if (method !== ZIP_METHOD_STORE && method !== ZIP_METHOD_DEFLATE)
        throw new Error('ZIP_COMPRESSION_METHOD_UNSUPPORTED');
    const extra = requireUint8(meta.extra, 'ZIP extra');
    const comment = requireUint8(meta.comment, 'ZIP comment');
    if (extra.length > 0xffff || comment.length > 0xffff)
        throw new Error('ZIP_METADATA_TOO_LARGE');
    const name = encoder.encode(PROFILE_NAME);
    const compressed = method === ZIP_METHOD_STORE ? profileBytes : await transformDeflate(profileBytes, true);
    if (compressed.length > 0xffffffff || profileBytes.length > 0xffffffff)
        throw new Error('ZIP64_UNSUPPORTED');
    const crc = crc32(profileBytes);
    const flags = (Number(meta.flagBits) & 0xffff) & ~0x0009;
    const dosTime = Number(meta.dosTime) & 0xffff, dosDate = Number(meta.dosDate) & 0xffff;
    const extractVersion = Number(meta.extractVersion) & 0xffff;
    const versionMadeBy = ((Number(meta.createSystem) & 0xff) << 8) | (Number(meta.createVersion) & 0xff);
    const internalAttr = Number(meta.internalAttr) & 0xffff;
    const externalAttr = Number(meta.externalAttr) >>> 0;
    const local = new Uint8Array(30 + name.length + extra.length + compressed.length);
    const lv = new DataView(local.buffer);
    set32(lv, 0, ZIP_LOCAL);
    set16(lv, 4, extractVersion);
    set16(lv, 6, flags);
    set16(lv, 8, method);
    set16(lv, 10, dosTime);
    set16(lv, 12, dosDate);
    set32(lv, 14, crc);
    set32(lv, 18, compressed.length);
    set32(lv, 22, profileBytes.length);
    set16(lv, 26, name.length);
    set16(lv, 28, extra.length);
    local.set(name, 30);
    local.set(extra, 30 + name.length);
    local.set(compressed, 30 + name.length + extra.length);
    const centralOffset = local.length;
    const central = new Uint8Array(46 + name.length + extra.length + comment.length);
    const cv = new DataView(central.buffer);
    set32(cv, 0, ZIP_CENTRAL);
    set16(cv, 4, versionMadeBy);
    set16(cv, 6, extractVersion);
    set16(cv, 8, flags);
    set16(cv, 10, method);
    set16(cv, 12, dosTime);
    set16(cv, 14, dosDate);
    set32(cv, 16, crc);
    set32(cv, 20, compressed.length);
    set32(cv, 24, profileBytes.length);
    set16(cv, 28, name.length);
    set16(cv, 30, extra.length);
    set16(cv, 32, comment.length);
    set16(cv, 34, 0);
    set16(cv, 36, internalAttr);
    set32(cv, 38, externalAttr);
    set32(cv, 42, 0);
    central.set(name, 46);
    central.set(extra, 46 + name.length);
    central.set(comment, 46 + name.length + extra.length);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    set32(ev, 0, ZIP_EOCD);
    set16(ev, 4, 0);
    set16(ev, 6, 0);
    set16(ev, 8, 1);
    set16(ev, 10, 1);
    set32(ev, 12, central.length);
    set32(ev, 16, centralOffset);
    set16(ev, 20, 0);
    return concat(local, central, eocd);
}
function findEocd(bytes, view) {
    const min = Math.max(0, bytes.length - (22 + 0xffff));
    for (let pos = bytes.length - 22; pos >= min; pos -= 1) {
        if (u32(view, pos) === ZIP_EOCD)
            return pos;
    }
    throw new Error('ZIP_ARCHIVE_INVALID');
}
async function transformDeflate(data, compress, maxOutputBytes = compress ? MAX_ARCHIVE_BYTES : MAX_PROFILE_BYTES) {
    const Ctor = compress ? globalThis.CompressionStream : globalThis.DecompressionStream;
    if (typeof Ctor !== 'function')
        throw new Error(compress ? 'COMPRESSION_STREAM_UNAVAILABLE' : 'DECOMPRESSION_STREAM_UNAVAILABLE');
    let stream;
    try {
        stream = new Ctor('deflate-raw');
    }
    catch {
        throw new Error('DEFLATE_RAW_UNSUPPORTED');
    }
    const hardLimit = compress ? MAX_ARCHIVE_BYTES : MAX_PROFILE_BYTES;
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 0 || maxOutputBytes > hardLimit)
        throw new Error('ZIP_STREAM_OUTPUT_BOUND_INVALID');
    // Reject zip bombs as chunks arrive, BEFORE building an unbounded arrayBuffer.
    // On read, the central ZIP uncompressed size is an additional hard ceiling.
    const output = new Blob([data]).stream().pipeThrough(stream);
    const reader = output.getReader();
    const chunks = [];
    let length = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!(value instanceof Uint8Array) || value.byteLength > maxOutputBytes - length)
                throw new Error(compress ? 'COMPRESSED_DATA_TOO_LARGE' : 'PROFILE_ENTRY_TOO_LARGE');
            length += value.byteLength;
            chunks.push(value);
        }
    }
    catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
    }
    finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}
function requireUint8(value, label) {
    if (value instanceof Uint8Array)
        return value;
    throw new Error(`${label} metadata is not Uint8Array.`);
}
let CRC_TABLE;
function crc32(data) {
    if (!CRC_TABLE) {
        CRC_TABLE = new Uint32Array(256);
        for (let n = 0; n < 256; n += 1) {
            let c = n;
            for (let k = 0; k < 8; k += 1)
                c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            CRC_TABLE[n] = c >>> 0;
        }
    }
    let c = 0xffffffff;
    for (const b of data)
        c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function u16(v, o) { if (o < 0 || o + 2 > v.byteLength)
    throw new Error('ZIP_BOUNDS'); return v.getUint16(o, true); }
function u32(v, o) { if (o < 0 || o + 4 > v.byteLength)
    throw new Error('ZIP_BOUNDS'); return v.getUint32(o, true); }
function set16(v, o, x) { v.setUint16(o, x & 0xffff, true); }
function set32(v, o, x) { v.setUint32(o, x >>> 0, true); }
function concat(...arrays) { const n = arrays.reduce((s, a) => s + a.length, 0), out = new Uint8Array(n); let o = 0; for (const a of arrays) {
    out.set(a, o);
    o += a.length;
} return out; }
function hexToBytes(hex) { if (hex.length % 2)
    throw new Error('HEX_LENGTH'); const out = new Uint8Array(hex.length / 2); for (let i = 0; i < out.length; i += 1)
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16); return out; }
