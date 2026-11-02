# 01 CORE — W1 Minimal Edited P1G Copy / Worker API

## Status and ownership

The Worker-callable module src/core/w1-edited-p1g-copy.mjs exports createW1EditedP1gCopy(). It creates an in-memory original/edited byte pair. It does NOT download or overwrite a file. The actual src/worker.mjs integration is owned by 03 WEB; 00 CTRL owns PR11 integration and 05 QR owns independent acceptance. Product UI edited exports are currently OFF.

Target is explicitly selected Switch v1.25.3 BID 9A239D3DB569756D, schema GameInfo.Version 626, codec p1g-v0. BID is NEVER inferred from save schema. Build registry persistentWriteAuthorized is still false; encodeCopy and persistentReplace are distinct.

## Mandatory inputs: all verification under Worker authority

- sourceBytes: actual Worker-held originally selected encrypted P1G, unchanged.
- sourceSessionId: UI-proposed current open Session; activeSessionId: Worker-controlled current identifier. Also supply getActiveSessionId as a Worker-only callback, sampled BEFORE open, AFTER async open, and AFTER encoded-copy completion; never deserialize that callback from a UI message.
- expectedSourceSha256: SHA-256 captured by Worker at the original open. CORE recomputes from the immutable source copy.
- targetBuild: explicit {platform:'switch',kind:'switch-bid',value:'9A239D3DB569756D'}.
- eventRegistry: Worker-created indexEvents(verified local 508-event registry). Never accept UI-created event registry.
- w1TargetReview: Worker-computed result from 02 TIME assessMinimalW1WriteTargets() using 02 TIME compileW1NativeSemantics(), the actual parsed source, the timing-review snapshot, original registry and the verified native/source ledger. The function originates in independently owned PR7 and is NOT duplicated in CORE. It must be STRUCTURAL_W1_TARGETS_ONLY with exact source BID/schema/508 definitions/raw source digest, targetScopeVerified true, writerAuthorized false, editedExportAuthorized false, and per-target candidateTargets matching selected ID, oneof, saved row, pointer, original and new UTC timestamp. Research permission alone is not writer permission: CORE checks all independently.
- entries: UI proposals only, an array of {pointer,eventId,kind,originalTime,targetTime}. Strict five-part World.RecurringEvents/<index>/<W1 variant>/NextOccurrence; only W1 ItemSpawning, WildCropsSpawningInVillage, FlowerSpawningInVillage, FishSpawningInVillage. Exact old value CAS. No unknown oneof or variant, duplicate saved EventID, inactive Fish, Moonstone Chest, W2, ambiguous branch, invalid schema or date, duplicate plan pointer, or no-op.

The exported function does NOT take an arbitrary UI-supplied edit callback, ZIP encoder, or override of allowed field paths. It reuses SafeProfileEditSession.open, inspectTimingPlan, auditP1gEnvelope, SafeProfileEditSession.exportVerifiedCopy, diffPaths and p1gPackagedProfileCodec. It accepts only a simple audited ZIP source shape, rejecting unknown extra fields, comments and descriptors. One isolated Encode and subsequent Codec Reopen verify the semantic delta. Unknown JSON values survive semantically; raw JSON spelling and Deflate bitstream are not claimed byte-identical.

Successful return: status WORKER_VERIFIED_EDITED_P1G_COPY; sourceSessionId; sourceRawSha256; editedRawSha256; backupOriginalBytes and editedBytes (distinct Uint8Array copies); changedPaths; encodeCopyAuthorized true; persistentReplaceAuthorized false; userDownloadPerformed false; originalOverwritePerformed false; deviceLoadVerified false.

03 WEB must suppress a stale result after awaiting CORE and confirm Worker active Session still matches. WEB must prepare original and edited outputs separately, attempt original backup download FIRST, then edited copy download; support retry of either when browser blocks multi-downloads; never zip the files or reuse the original filename for edited copy. Do not expose modified exports before 00 CTRL and 05 QR scoped review.

## Evidence / release

SYNTHETIC_TESTED: schema626 generated P1G modified, changed pointers only, source original unchanged, existing Codec independently reopens; negatives for stale hash/Session, oneof conflict, unsafe plan, ZIP archive comment, active W1 policy, duplicate saved definition ID and 02 TIME candidate drift. W1 review fixture in CORE tests is a SYNTHETIC stand-in, not an actual live PR7 integration acceptance; integrate actual 02 TIME in PR11 via 00 CTRL.

REAL_SAVE_READ_ONLY: prior authorized owner original canonical JavaScript codec and SafeSession opened, with no edited output. Real edited P1G compatibility not tested.

OWNER_REPORTED_RUNTIME_CONFIRMED: Owner observed NextOccurrence suppression on Switch; per-EventID independent verification NOT asserted. Further cold-load/save/exit/restart was WAIVED_BY_OWNER, never PASS. No automatic normalization of intentional 2126 timestamps, real save modification, in-place Writer or Wand Writer authority changes in this CORE PR.
