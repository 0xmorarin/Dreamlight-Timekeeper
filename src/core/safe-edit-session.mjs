import { BuildMatchStatus, CURRENT_V125_BUILD_CONTRACTS, PlatformFamily, detectSaveIdentity, evaluateWriterAuthorization, matchSupportedBuild } from './versioning.mjs';
const MAX_SOURCE_BYTES = 128 * 1024 * 1024;
const MAX_JSON_DEPTH = 256;
export class SafeProfileEditSession {
    constructor(state) {
        this.source = state.source;
        this.original = state.original;
        this.originalMetadata = state.originalMetadata;
        this.originalFormat = state.originalFormat;
        this.codec = state.codec;
        this.sourcePlatform = state.sourcePlatform;
        this.sourceRawSha256 = state.sourceRawSha256;
        this.contracts = state.contracts;
        this.saveIdentity = detectSaveIdentity(this.original, {
            sourcePlatform: this.sourcePlatform,
            sourceRawSha256: this.sourceRawSha256
        });
    }
    static async open(args) {
        if (!(args.sourceBytes instanceof Uint8Array) || args.sourceBytes.length === 0 || args.sourceBytes.length > MAX_SOURCE_BYTES) {
            throw new Error('Input is empty or exceeds the validated size limit.');
        }
        if (!args.codec || typeof args.codec.loadProfile !== 'function' ||
            typeof args.codec.parseProfileText !== 'function' ||
            typeof args.codec.createEncodedProfile !== 'function' ||
            typeof args.codec.getProfileVersion !== 'function' ||
            typeof args.codec.contract !== 'string' || args.codec.contract.length === 0) {
            throw new Error('Safe profile codec contract is incomplete.');
        }
        const immutableSource = args.sourceBytes.slice();
        const sourceRawSha256 = await sha256Hex(immutableSource);
        const loaded = await args.codec.loadProfile(immutableSource.slice());
        if (loaded.inputType !== 'plain' && loaded.inputType !== 'packaged') {
            throw new Error('Unknown profile input format.');
        }
        if (typeof loaded.jsonText !== 'string')
            throw new Error('Codec did not return decoded profile JSON text.');
        const original = parseSafeJson(loaded.jsonText);
        requireProfileRoot(original);
        const metadataVersion = checkedVersion(args.codec.getProfileVersion(loaded.metadata));
        const rootVersion = checkedVersion(asObject(original.GameInfo)?.Version);
        if (metadataVersion !== rootVersion) {
            throw new Error('Codec metadata/profile GameInfo.Version mismatch.');
        }
        return new SafeProfileEditSession({
            source: immutableSource,
            original,
            originalMetadata: loaded.metadata,
            originalFormat: loaded.inputType,
            codec: args.codec,
            sourcePlatform: normalizeSourcePlatform(args.sourcePlatform),
            sourceRawSha256,
            contracts: args.contracts ?? CURRENT_V125_BUILD_CONTRACTS
        });
    }
    getSnapshot() {
        return structuredClone(this.original);
    }
    getSaveIdentity() {
        return this.saveIdentity;
    }
    getPreflightContext() {
        return Object.freeze({
            saveIdentity: this.saveIdentity,
            codecContract: this.codec.contract,
            inputFormat: this.originalFormat
        });
    }
    async exportVerifiedCopy(args) {
        validatePointerAllowlist(args.exactAllowedPaths);
        if (typeof args.edit !== 'function')
            throw new Error('Missing edit callback.');
        const draft = structuredClone(this.original);
        args.edit(draft);
        requireProfileRoot(draft);
        const changes = diffPaths(this.original, draft);
        if (changes.length === 0) {
            return Object.freeze({
                format: this.originalFormat,
                backupOriginalBytes: this.source.slice(),
                editedBytes: this.source.slice(),
                sourceRawSha256: this.sourceRawSha256,
                editedRawSha256: this.sourceRawSha256,
                changedPaths: Object.freeze([]),
                noOp: true,
                saveIdentity: this.saveIdentity,
                authorization: null
            });
        }
        const build = matchSupportedBuild(this.saveIdentity, args.targetBuild, this.contracts);
        if (build.status !== BuildMatchStatus.Exact) {
            throw new Error(`Writer build gate failed: ${build.status}: ${build.reason}`);
        }
        if (changes.some((path) => path === '/GameInfo' || path.startsWith('/GameInfo/'))) {
            throw new Error('Editing GameInfo identity/version metadata is not authorized.');
        }
        const permitted = new Set(args.exactAllowedPaths);
        const forbidden = changes.filter((path) => !permitted.has(path));
        if (forbidden.length > 0) {
            throw new Error(`Editor attempted to change unapproved profile field(s): ${forbidden.join(', ')}`);
        }
        const jsonText = JSON.stringify(draft);
        if (!jsonText)
            throw new Error('JSON serialization failed.');
        const reparsed = parseSafeJson(jsonText);
        requireProfileRoot(reparsed);
        if (diffPaths(draft, reparsed).length > 0) {
            throw new Error('JSON round-trip lost or normalized semantic information.');
        }
        const serializedChanges = diffPaths(this.original, reparsed);
        if (!sameStringArray(changes, serializedChanges)) {
            throw new Error('Serialization changed a profile field outside the planned delta.');
        }
        const parsedByCodec = this.codec.parseProfileText(jsonText);
        const codecVersion = checkedVersion(this.codec.getProfileVersion(parsedByCodec.metadata));
        if (codecVersion !== build.contract.profileGameInfoVersion) {
            throw new Error('Codec validation did not preserve the supported profile version.');
        }
        const edited = await this.codec.createEncodedProfile(jsonText, this.originalMetadata);
        if (!(edited instanceof Uint8Array) || edited.length === 0 || edited.length > MAX_SOURCE_BYTES) {
            throw new Error('Codec produced an empty or oversized output.');
        }
        const verified = await this.codec.loadProfile(edited.slice());
        if (verified.inputType !== this.originalFormat) {
            throw new Error('Encoded output changed the input profile format.');
        }
        const verifiedRoot = parseSafeJson(verified.jsonText);
        requireProfileRoot(verifiedRoot);
        if (diffPaths(verifiedRoot, reparsed).length > 0) {
            throw new Error('Encoded output failed independent reopen/reparse semantic verification.');
        }
        const verifiedVersion = checkedVersion(this.codec.getProfileVersion(verified.metadata));
        if (verifiedVersion !== build.contract.profileGameInfoVersion) {
            throw new Error('Encoded output reopened with the wrong profile version.');
        }
        const authorization = evaluateWriterAuthorization({
            saveIdentity: this.saveIdentity,
            targetBuild: args.targetBuild,
            codec: {
                readSupported: true,
                encodeSupported: true,
                roundTripVerified: true,
                contract: this.codec.contract
            },
            operation: args.operation,
            contracts: this.contracts
        });
        if (!authorization.capabilities.encodeCopy) {
            throw new Error('Encoded-copy authorization failed after verification.');
        }
        return Object.freeze({
            format: this.originalFormat,
            backupOriginalBytes: this.source.slice(),
            editedBytes: edited.slice(),
            sourceRawSha256: this.sourceRawSha256,
            editedRawSha256: await sha256Hex(edited),
            changedPaths: Object.freeze(changes.slice()),
            noOp: false,
            saveIdentity: this.saveIdentity,
            authorization,
            exportContext: Object.freeze({
                targetBuild: Object.freeze({
                    platform: args.targetBuild.platform,
                    kind: args.targetBuild.kind,
                    value: args.targetBuild.value
                }),
                codecContract: this.codec.contract,
                exactBuildContractId: build.contract.id,
                operation: Object.freeze({
                    id: args.operation.id,
                    owner: args.operation.owner,
                    runtimeGate: args.operation.runtimeGate
                })
            })
        });
    }
}
function requireProfileRoot(value) {
    const root = asObject(value);
    if (!root || !asObject(root.GameInfo) || !asObject(root.Player) || !asObject(root.World)) {
        throw new Error('Unexpected DDV profile root; GameInfo, Player, and World objects are required.');
    }
}
function asObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value)
        : null;
}
function checkedVersion(value) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
        return value;
    if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) {
        const parsed = Number(value);
        if (Number.isSafeInteger(parsed))
            return parsed;
    }
    throw new Error('Profile schema/GameInfo version is not a non-negative safe integer.');
}
function normalizeSourcePlatform(value) {
    return value === PlatformFamily.Switch || value === PlatformFamily.SteamWindows
        ? value
        : PlatformFamily.Unknown;
}
function validatePointerAllowlist(paths) {
    if (!Array.isArray(paths) || paths.some((path) => typeof path !== 'string' || !/^\/(?:[^~]|~[01])*$/.test(path))) {
        throw new Error('Invalid exact JSON Pointer allowlist.');
    }
    if (new Set(paths).size !== paths.length)
        throw new Error('Duplicate path in exact JSON Pointer allowlist.');
}
export function parseSafeJson(source) {
    if (typeof source !== 'string' || source.length === 0)
        throw new Error('Decoded profile JSON is empty.');
    rejectDuplicateObjectKeys(source);
    rejectUnsafeJsonNumbers(source);
    const value = JSON.parse(source);
    const root = asObject(value);
    if (!root)
        throw new Error('Decoded profile JSON root must be an object.');
    return root;
}
function rejectDuplicateObjectKeys(source) {
    const stack = [];
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '"') {
            const start = i;
            for (i += 1; i < source.length; i += 1) {
                if (source[i] === '\\') {
                    i += 1;
                    continue;
                }
                if (source[i] === '"')
                    break;
            }
            if (i >= source.length)
                throw new Error('Unterminated JSON string.');
            const top = stack[stack.length - 1];
            if (!top)
                continue;
            let j = i + 1;
            while (j < source.length && /\s/.test(source[j]))
                j += 1;
            if (source[j] === ':') {
                const key = JSON.parse(source.slice(start, i + 1));
                if (typeof key !== 'string')
                    throw new Error('Invalid JSON object key.');
                if (top.has(key))
                    throw new Error('Duplicate JSON object key; export blocked.');
                top.add(key);
            }
        }
        else if (ch === '{') {
            stack.push(new Set());
        }
        else if (ch === '[') {
            stack.push(null);
        }
        else if (ch === '}' || ch === ']') {
            stack.pop();
        }
        if (stack.length > MAX_JSON_DEPTH)
            throw new Error('JSON nesting exceeds the supported safety limit.');
    }
    if (stack.length !== 0)
        throw new Error('Unbalanced JSON structure.');
}
function rejectUnsafeJsonNumbers(source) {
    let inString = false;
    // Match at the existing offset without making a fresh suffix for each
    // token in a large save; this retains the prior number-token grammar.
    const numericToken = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+\-]?\d+)?/y;
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (inString) {
            if (ch === '\\') {
                i += 1;
                continue;
            }
            if (ch === '"')
                inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch !== '-' && (ch < '0' || ch > '9'))
            continue;
        numericToken.lastIndex = i;
        const match = numericToken.exec(source);
        if (!match)
            continue;
        const token = match[0];
        const value = Number(token);
        if (!Number.isFinite(value))
            throw new Error('JSON number is not finite.');
        // Exponent/decimal spelling can silently round an integral unsafe
        // magnitude, e.g. 9007199254740993.0 or 9.007199254740993e15.
        if (Number.isInteger(value) && !Number.isSafeInteger(value))
            throw new Error('Unsafe JSON integer: cannot guarantee data preservation.');
        if (/^-?(?:0|[1-9]\d*)$/.test(token)) {
            const integer = BigInt(token);
            if (integer > BigInt(Number.MAX_SAFE_INTEGER) || integer < BigInt(Number.MIN_SAFE_INTEGER)) {
                throw new Error('Unsafe JSON integer: cannot guarantee data preservation.');
            }
        }
        else if (value === 0 && !/^-?0(?:\.0*)?(?:[eE][+\-]?\d+)?$/.test(token)) {
            throw new Error('Underflowed JSON number: cannot guarantee data preservation.');
        }
        i += token.length - 1;
    }
}
function escapePointer(key) {
    return key.replaceAll('~', '~0').replaceAll('/', '~1');
}
export function diffPaths(a, b, prefix = '', depth = 0, output = []) {
    if (Object.is(a, b))
        return output;
    if (depth > MAX_JSON_DEPTH)
        throw new Error('JSON nesting exceeds the supported safety limit.');
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            output.push(prefix);
            return output;
        }
        for (let i = 0; i < a.length; i += 1)
            diffPaths(a[i], b[i], `${prefix}/${i}`, depth + 1, output);
        return output;
    }
    const ao = asObject(a);
    const bo = asObject(b);
    if (ao && bo) {
        const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
        for (const key of keys) {
            const path = `${prefix}/${escapePointer(key)}`;
            if (!Object.prototype.hasOwnProperty.call(ao, key) || !Object.prototype.hasOwnProperty.call(bo, key)) {
                output.push(path);
            }
            else {
                diffPaths(ao[key], bo[key], path, depth + 1, output);
            }
        }
        return output;
    }
    output.push(prefix);
    return output;
}
function sameStringArray(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
}
async function sha256Hex(bytes) {
    if (!globalThis.crypto?.subtle)
        throw new Error('Web Crypto SHA-256 is unavailable.');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
