import { createCipheriv } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
const KEY = Buffer.from('62357168683873614A38556C444A557A545A5864325467366D626F3857386e35', 'hex');
const name = Buffer.from('profile', 'utf8');
export function makeSyntheticP1gProfile(root) {
    const profile = Buffer.from(JSON.stringify(root), 'utf8');
    const compressed = deflateRawSync(profile);
    const crc = crc32(profile);
    const dosTime = 0x5000;
    const dosDate = 0x5d3e;
    const local = Buffer.alloc(30 + name.length + compressed.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(profile.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    compressed.copy(local, 30 + name.length);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(profile.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(0, 42);
    name.copy(central, 46);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.length, 12);
    eocd.writeUInt32LE(local.length, 16);
    eocd.writeUInt16LE(0, 20);
    const archive = Buffer.concat([local, central, eocd]);
    const cipher = createCipheriv('aes-256-ecb', KEY, null);
    cipher.setAutoPadding(true);
    return new Uint8Array(Buffer.concat([cipher.update(archive), cipher.final()]));
}
export function syntheticProfile(deviceType = 'DeviceType_Switch') {
    return {
        GameInfo: { InitialVersion: 518, Version: 624, LastSaveDeviceInfo: { deviceType } },
        Settings: { Language: '' },
        Player: { Level: 1, Name: 'Synthetic' },
        World: { DecorationPresets: [] },
        Opaque: { keep: { future: true, values: [1, 2, 3] } }
    };
}
function crc32(data) {
    let c = 0xffffffff;
    for (const b of data) {
        c ^= b;
        for (let k = 0; k < 8; k += 1)
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    return (c ^ 0xffffffff) >>> 0;
}
