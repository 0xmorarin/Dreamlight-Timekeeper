export const PlatformFamily = Object.freeze({
    Switch: 'switch',
    SteamWindows: 'steam-windows',
    Unknown: 'unknown'
});
export const BuildIdentityKind = Object.freeze({
    SwitchBid: 'switch-bid',
    SteamFullVersion: 'steam-full-version'
});
export const RuntimeGateStatus = Object.freeze({
    NotRequired: 'NOT_REQUIRED',
    Passed: 'PASSED',
    Pending: 'PENDING',
    Failed: 'FAILED'
});
export const BuildMatchStatus = Object.freeze({
    Exact: 'EXACT',
    UnsupportedBuild: 'UNSUPPORTED_BUILD',
    SchemaMismatch: 'SCHEMA_MISMATCH',
    InvalidTarget: 'INVALID_TARGET'
});
export const CURRENT_V125_BUILD_CONTRACTS = Object.freeze([
    Object.freeze({
        id: 'ddv-switch-v1.25.3-9A239D3DB569756D-v626',
        platform: PlatformFamily.Switch,
        gameVersion: '1.25.3',
        profileGameInfoVersion: 626,
        buildIdentity: Object.freeze({
            kind: BuildIdentityKind.SwitchBid,
            value: '9A239D3DB569756D'
        }),
        codecContract: 'p1g-v0',
        // Copy-only eligibility is independent of the prohibited in-place Writer.
        persistentWriteAuthorized: false
    }),
    Object.freeze({
        id: 'ddv-switch-v1.25.0-52BD625D9B4E0053-v624',
        platform: PlatformFamily.Switch,
        gameVersion: '1.25.0',
        profileGameInfoVersion: 624,
        buildIdentity: Object.freeze({
            kind: BuildIdentityKind.SwitchBid,
            value: '52BD625D9B4E0053'
        }),
        codecContract: 'p1g-v0',
        persistentWriteAuthorized: false
    }),
    Object.freeze({
        id: 'ddv-steam-windows-v1.25.0-releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14-v624',
        platform: PlatformFamily.SteamWindows,
        gameVersion: '1.25.0',
        profileGameInfoVersion: 624,
        buildIdentity: Object.freeze({
            kind: BuildIdentityKind.SteamFullVersion,
            value: 'releases_1.25-v1.25.0-8687-gdd3d3a5ae738-incremental-14'
        }),
        codecContract: 'p1g-v0',
        persistentWriteAuthorized: false
    })
]);
export function detectSaveIdentity(root, options = {}) {
    const obj = asObject(root);
    const gameInfo = asObject(obj?.GameInfo);
    const lastSaveDeviceInfo = asObject(gameInfo?.LastSaveDeviceInfo);
    const version = asSafeInteger(gameInfo?.Version);
    const initialVersion = asSafeInteger(gameInfo?.InitialVersion);
    const deviceType = typeof lastSaveDeviceInfo?.deviceType === 'string'
        ? lastSaveDeviceInfo.deviceType
        : null;
    const lastSavePlatform = platformFromDeviceType(deviceType);
    const sourcePlatform = normalizePlatform(options.sourcePlatform);
    let relationship = 'UNKNOWN';
    if (sourcePlatform !== PlatformFamily.Unknown && lastSavePlatform !== PlatformFamily.Unknown) {
        relationship = sourcePlatform === lastSavePlatform
            ? 'SAME'
            : 'DIFFERENT_CROSS_SAVE_POSSIBLE';
    }
    return Object.freeze({
        profileGameInfoVersion: version,
        initialProfileGameInfoVersion: initialVersion,
        lastSaveDeviceType: deviceType,
        lastSavePlatform,
        sourcePlatform,
        sourceLastSaveRelationship: relationship,
        sourceRawSha256: typeof options.sourceRawSha256 === 'string' && options.sourceRawSha256.length > 0
            ? options.sourceRawSha256
            : null
    });
}
export function platformFromDeviceType(deviceType) {
    if (deviceType === 'DeviceType_Switch')
        return PlatformFamily.Switch;
    if (deviceType === 'DeviceType_Windows')
        return PlatformFamily.SteamWindows;
    return PlatformFamily.Unknown;
}
export function normalizePlatform(value) {
    return value === PlatformFamily.Switch || value === PlatformFamily.SteamWindows
        ? value
        : PlatformFamily.Unknown;
}
export function matchSupportedBuild(saveIdentity, targetBuild, contracts = CURRENT_V125_BUILD_CONTRACTS) {
    if (!isTargetBuildIdentity(targetBuild)) {
        return Object.freeze({ status: BuildMatchStatus.InvalidTarget, contract: null, reason: 'Target build identity is incomplete or invalid.' });
    }
    const candidate = contracts.find((contract) => contract.platform === targetBuild.platform &&
        contract.buildIdentity.kind === targetBuild.kind &&
        contract.buildIdentity.value === targetBuild.value) ?? null;
    if (!candidate) {
        return Object.freeze({ status: BuildMatchStatus.UnsupportedBuild, contract: null, reason: 'Exact target build is not in the supported build registry.' });
    }
    if (saveIdentity.profileGameInfoVersion !== candidate.profileGameInfoVersion) {
        return Object.freeze({
            status: BuildMatchStatus.SchemaMismatch,
            contract: candidate,
            reason: `Profile GameInfo.Version ${String(saveIdentity.profileGameInfoVersion)} does not match build contract ${candidate.profileGameInfoVersion}.`
        });
    }
    return Object.freeze({ status: BuildMatchStatus.Exact, contract: candidate, reason: 'Exact target build and profile version contract match.' });
}
export function evaluateWriterAuthorization(args) {
    const contracts = args.contracts ?? CURRENT_V125_BUILD_CONTRACTS;
    const build = matchSupportedBuild(args.saveIdentity, args.targetBuild, contracts);
    const exactBuild = build.status === BuildMatchStatus.Exact;
    const codecContractMatches = exactBuild && args.codec.contract === build.contract.codecContract;
    const readProfile = Boolean(args.codec.readSupported);
    const planOperation = readProfile && exactBuild && codecContractMatches &&
        args.operation.structuralCapabilitiesSupported && args.operation.planSupported;
    const encodeCopy = planOperation && args.codec.encodeSupported && args.codec.roundTripVerified &&
        args.operation.validationPassed;
    const runtimeReady = args.operation.runtimeGate === RuntimeGateStatus.NotRequired ||
        args.operation.runtimeGate === RuntimeGateStatus.Passed;
    const persistence = args.persistence ?? {
        backupReady: false,
        atomicReplaceReady: false,
        postCommitVerifyReady: false
    };
    const releaseAuthorized = Boolean(build.contract?.persistentWriteAuthorized);
    const persistentReplace = encodeCopy && releaseAuthorized && runtimeReady &&
        persistence.backupReady && persistence.atomicReplaceReady && persistence.postCommitVerifyReady;
    const findings = [];
    if (args.saveIdentity.sourceLastSaveRelationship === 'DIFFERENT_CROSS_SAVE_POSSIBLE') {
        findings.push({
            code: 'SOURCE_LAST_SAVE_PLATFORM_DIFFER',
            severity: 'INFO',
            message: 'Source/storage platform differs from LastSaveDeviceInfo; this can be a legitimate DDV cross-save state and is not itself a write blocker.'
        });
    }
    if (!readProfile)
        findings.push({ code: 'CODEC_READ_UNSUPPORTED', severity: 'ERROR', message: 'Profile codec did not authorize safe read.' });
    if (!exactBuild)
        findings.push({ code: build.status, severity: 'ERROR', message: build.reason });
    if (exactBuild && !codecContractMatches)
        findings.push({ code: 'CODEC_CONTRACT_MISMATCH', severity: 'ERROR', message: 'Codec contract does not match the exact build registry entry.' });
    if (!args.operation.structuralCapabilitiesSupported)
        findings.push({ code: 'STRUCTURAL_CAPABILITY_UNSUPPORTED', severity: 'ERROR', message: 'Required save structural capability is not supported.' });
    if (!args.operation.planSupported)
        findings.push({ code: 'OPERATION_PLAN_UNSUPPORTED', severity: 'ERROR', message: 'Operation planning is not supported for this contract.' });
    if (!args.operation.validationPassed)
        findings.push({ code: 'OPERATION_VALIDATION_FAILED', severity: 'ERROR', message: 'Operation validation has not passed.' });
    if (!args.codec.encodeSupported || !args.codec.roundTripVerified)
        findings.push({ code: 'ENCODE_COPY_NOT_VERIFIED', severity: 'ERROR', message: 'Safe encoded-copy production is not fully verified.' });
    if (!releaseAuthorized)
        findings.push({ code: 'PERSISTENT_WRITE_NOT_RELEASE_AUTHORIZED', severity: 'WARNING', message: 'Exact build is known, but the current registry intentionally keeps persistent replacement disabled.' });
    if (!runtimeReady)
        findings.push({ code: 'RUNTIME_GATE_NOT_READY', severity: 'WARNING', message: `Runtime gate is ${args.operation.runtimeGate}.` });
    if (!persistence.backupReady || !persistence.atomicReplaceReady || !persistence.postCommitVerifyReady) {
        findings.push({ code: 'PERSISTENCE_BOUNDARY_NOT_READY', severity: 'WARNING', message: 'Backup, atomic replacement, and post-commit verification are not all ready.' });
    }
    return Object.freeze({
        build,
        capabilities: Object.freeze({
            readProfile,
            planOperation,
            encodeCopy,
            persistentReplace
        }),
        findings: Object.freeze(findings)
    });
}
function asObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value)
        : null;
}
function asSafeInteger(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}
function isTargetBuildIdentity(value) {
    const obj = asObject(value);
    if (!obj || typeof obj.value !== 'string' || obj.value.length === 0)
        return false;
    if (obj.platform === PlatformFamily.Switch) {
        return obj.kind === BuildIdentityKind.SwitchBid;
    }
    if (obj.platform === PlatformFamily.SteamWindows) {
        return obj.kind === BuildIdentityKind.SteamFullVersion;
    }
    return false;
}
