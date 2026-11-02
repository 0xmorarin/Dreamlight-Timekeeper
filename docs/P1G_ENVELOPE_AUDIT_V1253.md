# P1G envelope compatibility inspection — 2026-11-02

Status: **SOURCE-CODE-CONFIRMED LIMITATIONS / SYNTHETIC NODE TESTS PASS / NO MODIFIED SAVE EXPORT AUTHORIZED**

## Provenance and scope
- Source: existing Wand 01A Save/Codec/Version Contract and 01A v1.25.3 schema626 structural gate, reused through Timekeeper's `src/core/p1g-packaged-profile-codec.mjs`.
- Source build evidence: Switch v1.25.3 BID `9A239D3DB569756D`, schema `626`. Save schema does **not** reveal its actual running executable BID; Steam uses a separate FullVersion identity.
- This inspection is a **read-only consumer** of the already-decoded P1G metadata. It does not decrypt again, repack, authorize, or export any edited save. There is no new game-binary analysis.
- Implementation: `src/core/p1g-envelope-audit.mjs`; tests `tests/p1g-envelope-audit.test.mjs` and packaged Worker integration in `tests/worker.test.mjs`.

## Observed current codec limitations (code inspection, not hypothetical approvals)

The decoder originally exposed the archive entry count, comment length, central-directory profile compression/flags/extra/comment, and version/attribute/time metadata. **Since the 2026-11-02 local-header parity extension**, it additionally returns the actual profile local header's extract version, flags, method, DOS time/date, CRC, compressed/uncompressed sizes, original local extra bytes, and lengths of ZIP prefix/profile-to-central/central-to-EOCD gaps. These additions are observational only.

The current modified-copy codec:
1. Requires exactly one ZIP entry and one profile entry, with no archive comment.
2. Rebuilds the archive as a single profile ZIP. The original **local header extra bytes and local flag bits are now exposed for read-only comparison**, but the existing writer still uses **central-directory extra bytes** as the new local extra and normalizes flags. Source local/central parity can be observed; **reconstructed output parity remains unverified**.
3. Normalizes flag bits via `flagBits & ~0x0009`. A source using data descriptor bit `0x0008` cannot be reconstructed with identical flags; other ZIP flag semantics require separate review.
4. Recompresses the modified profile if using deflate and rewrites ZIP offsets, entry headers, checksums and encrypted ciphertext. Even a simple archive does not establish raw byte equality after modification.
5. Preserves the original encrypted bytes on unchanged/backup paths. A modified-copy semantic JSON reopen result is **not equivalent** to exact metadata or ciphertext preservation.

The new audit emits machine-readable findings for: extra/multiple ZIP entries; archive comments; central extra and entry comment; data descriptors; unsupported flags or compression method; unknown local-header parity; and unproven raw byte reconstruction.

Even `SIMPLE_ENVELOPE_OBSERVED_REBUILD_UNVERIFIED` retains `localHeaderParityVerified=false`, `bytePreservationVerified=false`, `metadataPreservationVerified=false`, `writerAuthorized=false` and `editedCopyAuthorized=false`. JSON input has a separate non-P1G export contract and cannot inherit encrypted P1G handling.

## Validation and next gate

- Synthetic P1G (single profile entry): read-only Worker reports envelope risks and exact original backup bytes remain identical.
- Synthetic altered metadata exercises additional entries, comments, central extras, descriptor and unsupported flags. Synthetic tests are not evidence that those altered ZIPs can be loaded or safely rebuilt.
- A real v1.25.3 P1G user save has **not** been re-encoded, modified or round-tripped as part of this work. No console cold-load, resave, cleanup or restored-save test has been performed.
- Before enabling modified exports, analyze **real approved fixture envelopes without publishing raw save bytes**, reconcile local-vs-central extra fields, file prefixes and data-descriptor behavior, use codec-source identity/version evidence, then independently verify exact changes, independently reopen and test game acceptance on a disposable copy.
- No changes to Wand production writer permissions, Timekeeper download policy, Grid delete/move, or the planned separate backup/edited downloads.

Wand-first shared registry: https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit

## Superseding local-versus-central parity checkpoint (2026-11-02)

- `src/core/p1g-packaged-profile-codec.mjs` now returns the source profile entry's local header metadata and raw local-extra bytes strictly inside the Worker/codec boundary. This read-only metadata does not add codec editing authority, change encryption/repacking logic, or leak original extension bytes in the UI.
- `src/core/p1g-envelope-audit.mjs` compares source local-vs-central flags, method, extract version, DOS timestamps, CRC, compressed and uncompressed sizes, and byte-for-byte local/central extra fields. It separately reports nonzero archive prefix, profile-to-central trailing region and central-to-EOCD gaps. These are source-internal layout observations, **not** proof that modified ZIP reconstruction preserves headers.
- On a normal single-entry *synthetic* P1G, all inspected local/central fields match; `localHeaderFieldsMatchCentral=true`, while `localHeaderParityVerified=false`, `metadataPreservationVerified=false`, and `editedCopyAuthorized=false` remain unconditional. Deliberately malformed encrypted synthetic archives with divergent local flags/time/CRC/sizes are recognized without modifying input bytes. Reader accepts some local/central disagreements because source data can legitimately carry descriptor flags; the audit warns rather than silently granting writer support.
- The original v1.25.3 Switch real-save **read-only** 01E acceptance reports one ZIP profile entry, method 8/deflate, valid profile CRC and schema626. It did **not** record the new local/central metadata comparisons and therefore does not provide real-file parity acceptance. Reusing the existing real sample for bounded private read-only metadata observation is the next step, not a completed test here.
- Current Timekeeper release writer gates, Wand 01A source/target-build separation and **no user save export** remain unchanged.

## 01 CORE isolation checkpoint — 2026-11-02 (rebuild-shape and streaming bounds)

Provenance: PR #2 parent `9ebdac063b81934eee37a62e5694749b1cf1aa65`; narrow 01 CORE branch only. The archived 01E source's Drive metadata was checked (457,696 bytes, stored name `profile.json`), and the existing 01E report was read. This checkpoint **did not read/decrypt the private real source** using the new inspector. It cannot claim schema626 local/central ZIP attribute parity, descriptor form, rebuild equivalence or native cold-load PASS.

### Corrected meaning of `repackageShapeObserved`

Before this checkpoint, the flag could be true despite nonzero ZIP prefix/gap bytes or an absent boundary length. The flag is now true only for a completely observed, one-entry source with all of the following:

- exactly one archive entry and profile; known zero ZIP prefix, post-profile gap and central-to-EOCD gap;
- no archive/entry comment and no local/central extra data, with matching local and central flags, method, extract version, DOS timestamp/date, CRC and sizes;
- no descriptor flag, encryption or other undocumented flags (only 0 or UTF-8 bit `0x0800` accepted by this observational shape predicate);
- supported method (stored or deflate) and complete valid central CRC/sizes/attributes (including the original creator-system, creator-version, internal and external attributes).

Missing, noninteger, negative or out-of-range numeric evidence is **not** silently interpreted as zero/safe. New diagnostic codes include `ARCHIVE_PREFIX_LENGTH_UNKNOWN`, `PROFILE_TRAILING_LENGTH_UNKNOWN`, `CENTRAL_TRAILING_LENGTH_UNKNOWN`, `CENTRAL_HEADER_FIELDS_INCOMPLETE` and `REBUILD_SOURCE_ATTRIBUTES_INCOMPLETE`. Matching nonempty extras and even perfectly matching descriptor flags still force review. These are conservative source-layout flags; no resulting value is a writer authorization.

### Inflation memory boundary

The decoder previously assembled all `deflate-raw` output with `Response(...).arrayBuffer()` and checked maximum size afterward. It now reads stream chunks and checks the declared central-directory `uncompressedSize` and `MAX_PROFILE_BYTES` (128 MiB) *before* appending each chunk, canceling on overflow. The compressor is likewise bounded by `MAX_ARCHIVE_BYTES` (256 MiB). This eliminates a particular unbounded full-inflation allocation route; it does **not** establish an overall browser peak-memory guarantee during AES decryption, JSON safety parsing, structured cloning, diff computation or encoding. Synthetic size-confusion regression is required.

### Cross-stream capability boundary (01 CORE -> 02 TIME / 03 WEB / 05 QR)

| Capability | Evidence owner | Meaning | Writer effect |
| --- | --- | --- | --- |
| `READ_PACKAGE` | 01 CORE | strict P1G decrypt, ZIP entry selection, CRC and size checks completed | none |
| `READ_PROFILE` | 01 CORE | strict UTF-8/JSON parse, root/schema observed | none |
| `ENVELOPE_SOURCE_OBSERVED` | 01 CORE | local/central metadata and layout were inspected; risk findings may remain | none |
| `PLAN_STRUCTURE_OBSERVED` | 01 CORE preflight + 02 TIME row interpretation | exact pointer, original value, recurrence oneof and source ID checked | none |
| `JSON_DELTA_SYNTHETIC_TESTED` | 01 CORE | isolated clone, exact JSON-path diff and JSON reparse matched | none |
| `ENCODE_COPY_VERIFIED` | future 01 CORE + independent 05 QR | complete original-envelope preservation policy, staging, ZIP metadata, strict diff and independent output reopen | **not achieved** |
| `OPERATION_RUNTIME_VERIFIED` | 02 TIME + 05 QR | version/ID-specific native semantics and Switch load/save/restart acceptance | **not achieved** |

03 WEB must consume Worker-owned reports, not infer any capability from a timestamp, schema number, UI row selection, `repackageShapeObserved`, or source P1G read success. 02 TIME owns native event scheduling semantics; 01 CORE owns ZIP/serializer preservation. None of these observations changes `operationAllowlisted=false`, `writerAuthorized=false`, `editedCopyAuthorized=false`; source input replacement is not implemented. Wand 01A writer gates remain untouched.

### Evidence separation and open questions

- **SOURCE-CONFIRMED:** the old ZIP emitter reconstructs one entry, normalizes descriptor flags, reuses central extra for the local header, recompresses and re-encrypts.
- **SYNTHETIC-TESTED:** crafted missing lengths, source flags, extra records and central header anomalies are rejected as a simple observed envelope; central-size-confusion inflation aborts without returning a decoded profile.
- **REAL_SAVE_READ_ONLY (upstream 01E):** original 457,696-byte Switch v1.25.3 schema626 save passes offline read-only checks, including one deflated profile and CRC. This does not validate the new audit or edited encode.
- **BLOCKED:** in a private ephemeral environment, run this exact current inspector against the approved original and retain only redacted aggregate metadata; distinguish the data descriptor's actual signature/length and full ZIP extensions. Never commit raw save, key, decoded JSON, or raw ZIP extension bytes.
- **UNKNOWN:** modified ZIP compatibility on schema626, exact unknown-field preservation under edited serialization, post-encryption equivalence and console cold-load/resave/relaunch. An actual modified-copy export remains disabled.


## 01 CORE Round 2 — real accepted Switch schema626 ZIP source inspection (2026-11-02)

**Evidence level: REAL_SAVE_READ_ONLY (new ZIP layout observation), plus separate SYNTHETIC_TESTED negatives. NOT an accepted modified-save writer.**

- Approved source: original 01E Switch v1.25.3/schema626 packaged save, independently confirmed original SHA-256 `86b24cb861e4d65bb22f6627ac275d6a8c3bd4cfb968d2399cb5d328313dcb10`, 457,696 bytes. The original matched the existing 01E acceptance metadata before use and again after inspection. Native executable BID is **external evidence**, not recovered from this save.
- Private read-only method: fetch from approved Drive location into isolated workspace, independently AES-ECB/PKCS7-decrypt **in memory**, inspect ZIP local, central, EOCD fields with Python `struct` and `zipfile`, verify CRC/profile size/schema, compare observed metadata to the existing PR #8 `auditP1gEnvelope` predicates. **The TypeScript/JavaScript audit module itself was not imported into this private Python execution**; this is an independent equivalent predicate projection, not a newly executed Node codec acceptance. No re-encode, ZIP rebuild, updated JSON, export or source write. Decrypted data was never written to disk; the temporary mounted original and inspection script were deleted afterward.
- Observations: decoded archive 457,687 bytes, one `profile` entry, `method=8` (deflate), raw profile 5,252,207 bytes and compressed profile 457,575 bytes. Local and central flags each `0x0000`, descriptor bit clear and **no descriptor region**; version-needed local/central both 20, DOS date/time parity, CRC parity, compressed and uncompressed size parity. Local/central extra lengths both zero; entry comment/archive comment both zero; ZIP prefix, post-profile-to-central gap and central-to-EOCD gap all zero. Creator system=0, creator version=20; internal/external attributes=0. CRC/JSON root/schema626 checks passed.
- The source matches `SIMPLE_ENVELOPE_OBSERVED_REBUILD_UNVERIFIED`: only finding `REBUILT_ZIP_RAW_BYTE_PARITY_NOT_PROVEN`; `repackageShapeObserved=true`, **`localHeaderParityVerified=false`, `bytePreservationVerified=false`, `metadataPreservationVerified=false`, `writerAuthorized=false` and `editedCopyAuthorized=false`**. No proprietary raw ZIP metadata, decrypted JSON or save bytes are committed.
- This observation narrows the **one inspected original file** only. It does **not** guarantee future schemas, Steam files, all user saves, ZIP deflate encoding parity, JSON textual/opaque-field fidelity, edited ZIP metadata, ciphertext parity, or game runtime acceptance.

### Streamed decompression bounds versus inspected save

The current decoder's absolute profile-size cap is 128 MiB = 134,217,728 bytes. The observed schema626 profile is about 5.009 MiB: **~25.55 times smaller than that cap**; source deflate ratio ~11.48:1. Encrypted input is 457,696 bytes. The cap prevents one decompressor output from exceeding the allowed bound, but no overall peak-memory proof exists because memory is also consumed by source ciphertext, decrypted ZIP, compressed bytes, profile buffer, UTF-8 text, parsed JSON, clones, and other Worker work. Future/other saves must not be rejected solely for being larger than this one sample; size-policy decisions require separate real-save distributions and performance tests.

### Source-environment preservation versus modified ZIP writer

| ZIP property | Observed real schema626 | Current `buildSingleProfileZip` behavior | Evidence boundary |
| --- | --- | --- | --- |
| entry/profile count | 1 / 1 | emits exactly 1 / 1 | matches this shape; no general source preservation |
| local/central flags | both `0x0000` | `flagBits & ~0x0009` | same bit value here; descriptor/flag normalization exists |
| method | 8 | deflates again | compressed bytes and CRC/size change on edit; byte parity unverified |
| local/central extra | 0 / 0 | copies **central** extra into both headers | matching here only; divergent future extras are not preserved |
| entry/archive comments | 0 / 0 | entry comment copied; archive comment always omitted | nonempty archive comment blocked; entry comment not proved byte-preserving beyond field copy |
| prefix/descriptor/tail regions | all 0/absent | rebuilds without any source prefix, descriptor, or trailing regions | only the simple observed input avoids these losses |
| DOS date/time | local-central matched | central DOS values copied to both | local divergent values would be normalized |
| creator version/system, attrs | 20 / 0; attrs 0 | central values copied into rebuilt header | equality of these fields does not authorize repack |
| CRC and uncompressed/compressed sizes | local-central matched, CRC passed | regenerated for modified profile | expected edited values will differ |
| JSON representation | strict read-only root schema626 | JSON serialized anew | unknown JSON semantics, original text and order/format not proven preserved |

**API contract for 02 TIME / 03 WEB (existing code, not a new permission service):**
`p1gPackagedProfileCodec.loadProfile(sourceBytes)` yields `jsonText`, `metadata.profileVersion`, and Worker-internal ZIP metadata. `auditP1gEnvelope({format:'packaged',metadata})` returns redacted `status`, `findings[]`, `lengths`, central `flagBits` and `compressionMethod`, `localHeaderObserved`, `localHeaderFieldsMatchCentral`, `localExtraMatchesCentral`, `repackageShapeObserved`, plus permanently false `writerAuthorized`, `editedCopyAuthorized`, `localHeaderParityVerified`, `bytePreservationVerified`, `metadataPreservationVerified`. `format:'json'` has a separate `PLAIN_JSON_NO_P1G_ENVELOPE` result. The UI must never display private local/central raw extra bytes, plaintext ZIP or source JSON as part of the audit. `inspectTimingPlan` and `auditTimingDeltaIsolated` stay independent and non-writing. Neither schema nor these observations implies version-matched executable identity, operation semantics, export, or writer authorization.

**Round 2 negative regression:** Five additional *synthetic encrypted ZIP* tests exercise an actual signed data descriptor with local sizes zero, a real local-only unknown extra record, central-to-EOCD gap, a ~2 MiB highly compressible stream with forged central declared uncompressed size, and the 128 MiB+1 declared boundary. They do not test at-cap 128 MiB actual memory usage or all malformed ZIP variants. Exact-head CI for the test commit `108bd9a9a5b75e855019b2ef76a36790ce20e1b5`: [#41375389185](https://github.com/0xmorarin/Dreamlight-Timekeeper/actions/runs/41375389185) SUCCESS / Node 22 **120/120 PASS**. Final doc-only commit CI must be recorded against its own HEAD before independent 05 QR acceptance.

## 01 CORE Round 3 — verified exact-JS source audit and codec rejection boundary (2026-11-02)

**REAL_SAVE_READ_ONLY (exact PR #8 audit module):** The audited local module's Git blob hash was verified equal to GitHub `aae18cfd45916ad934feb61f12dc976e234ddfc4`. On the approved 01E Switch schema626 ciphertext (457,696 bytes; previously accepted SHA-256 `86b24cb861e4d65bb22f6627ac275d6a8c3bd4cfb968d2399cb5d328313dcb10`), an independent **Node.js AES-ECB/ZIP metadata parser** reconstructed the `zip` metadata shape in memory and called the **exact JavaScript** `auditP1gEnvelope({format:'packaged',metadata})`, then rechecked the unchanged encrypted input SHA. Result: `SIMPLE_ENVELOPE_OBSERVED_REBUILD_UNVERIFIED`; only finding `REBUILT_ZIP_RAW_BYTE_PARITY_NOT_PROVEN`; `localHeaderFieldsMatchCentral=true`, `repackageShapeObserved=true`, `writerAuthorized=false`, `editedCopyAuthorized=false`, `bytePreservationVerified=false`. Compressed profile 457,575 bytes; decompressed profile 5,252,207 bytes; flags 0/0; descriptor gap 0; extras/comments/prefix/gaps all zero. Result agrees with Round 2 Python projection. The **full `p1gPackagedProfileCodec.loadProfile` was not executed against this private real original** (the exact audit function *was* executed). No real data changed, encoded, exported or committed. Private temporary source and scripts deleted.

**New code boundary:** the codec's own decode/parse/research-encode routes now reuse existing `parseSafeJson`, not unguarded `JSON.parse` at their first acceptance point; direct calls reject duplicate object keys, unsafe JSON integers, exponent underflow and excessive JSON nesting. This closes a gap between Worker-side strict parsing and direct codec API usage; it does not make untrusted JSON safe for game writes.

The existing synthetic `createEncodedProfile` now additionally requires an **observed fully simple source ZIP shape** from `auditP1gEnvelope` before any profile encode; missing/unknown fields, unexpected prefix/gaps, local/central extra differences, descriptor, unknown ZIP flag or entry comment yield `ZIP_SOURCE_ENVELOPE_REBUILD_UNVERIFIED`. This is an extra **denial** condition, NOT a positive operation authorizer: callers may forge metadata, and even source parity does not prove output fidelity. The internal codec's ability to encode a benign synthetic JSON is not a product Write or export entitlement.

**Synthetic regression:** new `tests/p1g-json-safety.test.mjs` crafts test-only encrypted ZIP directly from lexical JSON (necessary to retain duplicate keys that JSON.stringify removes), rejects malformed direct decode/parse/encode, confirms encrypted input immutability and validates unknown nested fields in a ~6 MiB decompressed synthetic profile. Existing `tests/synthetic-p1g-timing-roundtrip.test.mjs` now compares selected normalized ZIP metadata fields on synthetic encode/reopen, exact requested pointer diff and encrypted original bytes, and rejects six unsafe source envelope variants before synthetic encoding. None of these tests uses real data for rebuilding. They are not peak heap benchmarks nor proof of 128 MiB real-save acceptance.

**Operation-level Codec/Envelope capability specification (01 CORE contract, consumed as Worker read-only diagnostics):**

- `readPackageObserved`: source cryptographic/ZIP/CRC reader completed. No BID inference.
- `strictJsonObserved`: duplicate key, numeric and depth guards plus root constraints passed. Unknown fields are preserved *on the read path*, not yet on real edited serialization.
- `envelopeShapeObserved`: `auditP1gEnvelope.repackageShapeObserved` true/false and `findings[]`; only source metadata observation, **not** byte fidelity.
- `planPointerObserved`: 01 CORE `inspectTimingPlan` exact snapshot ID, pointer and original-value checks; does not infer native meanings.
- `syntheticReopenObserved`: isolated synthetic modified JSON path diff, internal encode and independent reopen; cannot be promoted to real-save verification.
- `operationNativeSemanticsVerified`: owned by 02 TIME/05 QR, never assigned by Codec. `targetBuildVerified`: separate authoritative installation identity. `editedCopyAuthorized=false`, `writerAuthorized=false`, `operationAllowlisted=false`, `persistentReplaceAuthorized=false` until separate acceptance.

**Metadata preservation limits still open:** original ZIP may contain unknown local extra, central extra, archive/entry comment, prefix, descriptor, trailing data, unknown flags and unusual timestamp/header variance; current rebuild reconstructs one `profile` entry and normalizes or drops unsupported features rather than losslessly copying their raw bytes. Stored/deflate method, central creator/attribute/DOS values can be observed on a simple source, but new CRC/sizes, compressed bytes, ZIP header offsets, ciphertext and raw JSON representation must change or be independently verified when edited. A successful source audit and a synthetic matching metadata projection are necessary **but insufficient** evidence for save compatibility.

**Release gate:** 05 QR independent review of new HEAD + CI; a separate disposable *real modified-copy* metadata/unknown-field preservation study and Switch cold-load/save/restart are still OPEN and prohibited in this round. PR #11 UI/Worker integration and Wand 01A permissions untouched.

## 01 CORE Round 4 — JSON lexical fidelity, numeric precision and ZIP rebuild TOCTOU (2026-11-02)

**Provenance:** Draft PR #8 based on unchanged PR #2 HEAD `9ebdac063b81934eee37a62e5694749b1cf1aa65`. The prior Round 3 version of PR #8 is present **byte-for-byte** in integration PR #11 HEAD `51aba6924ab39c1c83682cb29ad58c63abef1fdc` for the verified core, envelope and JSON test blobs. Round 4 commits are owned by PR #8 only; PR #11, Worker, UI, Wand and native semantics were not modified.

### Full real-save read pathway and actual evidence

`loadProfile(ciphertext)` has source-level sequence: (1) encrypted input size/type and AES-ECB/PKCS7 decoding; (2) ZIP EOCD, central and local header bounds, entry selection, deflate and CRC verification; (3) UTF-8 decoding; (4) strict `parseSafeJson` duplicate key / unsafe numeric / depth enforcement and required root shape; (5) version extraction and ZIP metadata publication; (6) separate `auditP1gEnvelope` from the Worker, emitting source-only findings. The original 01E source hash and private independent AES/ZIP metadata path were verified in earlier rounds, and **the exact JavaScript envelope audit was executed against reconstructed metadata from the real accepted original** in Round 3. **The entire new JS `loadProfile` call on that real original has not been independently run as one end-to-end operation in these rounds.** This distinction remains an explicit read-only compatibility gap after Round 4. Source metadata parity is not full codec runtime or edited-copy approval.

### New strict number guard (01 CORE source change)

Existing `parseSafeJson` already refused integer tokens beyond `Number.MAX_SAFE_INTEGER`. Exponent or fraction spellings of such integer magnitudes could bypass that lexical test and round during `Number()` conversion. It now rejects **all parsed integral unsafe magnitudes**, including `9007199254740993.0`, `9.007199254740993e15` and `1e20`, on every direct codec read/parse/research-encode path. Plain fractional `0.125` and representable exponent integer `6.26e2` remain accepted in the synthetic matrix. Numeric token recognition reuses a sticky regex on the original source rather than repeatedly allocating unexamined suffix copies per number token. Synthetic regression includes 50,000 safe numeric values and unknown opaque nested fields. This guard is intentionally conservative: a future save legitimately requiring unsafe numeric *integral* magnitude will be read-blocked until a lossless representation is supported; the same schema number does not grant compatibility.

### Source JSON vs modified JSON serialization

**Synthetic-only lexical preservation observation:** the original JSON byte/text representation can contain Unicode escape sequences (including surrogate pairs and lone surrogate), `1.0`, `1e2`, `9007199254740993` as a **string**, and object keys `"12"` before `"2"`. Original `loadProfile` returns the decoded `jsonText` unchanged, but parsing/cloning and `JSON.stringify` of a synthetic change converts number spellings, Unicode spellings, whitespace and integer-index-like object key ordering. The reopened synthetic P1G still has exactly one authorized synthetic path difference by `diffPaths`, and opaque values and their types compare equal. **Therefore semantic JSON equality and unknown-value survival do not prove original JSON textual/byte preservation.** No real modified-save test was performed.

| Compatibility aspect | Source/Node evidence | Operation-level limit |
| --- | --- | --- |
| duplicate keys (including escaped aliases) | direct parser rejects; synthetic P1G encrypted test | unsupported profile is fail-closed, no Writer |
| unsafe integer/exponent/fraction | rejected across direct parser/decode/research encode | cannot promise lossless conversion of unsafe magnitudes |
| Unicode escaped text / lone surrogate | synthetic parsed/reopened values match | escape spelling and raw JSON bytes are not preserved by `JSON.stringify` |
| integer-looking object keys | synthetic values match | order may be normalized, even outside planned pointer |
| numeric `1.0` / `1e2` | synthetic values match | original numeric spellings not preserved |
| numerical-looking string | retained as a string | type must never be inferred from string contents |
| one edited pointer, unknown nested JSON | source-copy unchanged; synthetic exact semantic `diffPaths` | no real schema626 edited-copy, opaque binary or serializer compatibility |
| 50,000 numeric array tokens | synthetic strict parse PASS | not a 128 MiB browser memory or real-save load benchmark |

### Synthetic ZIP repacking, metadata mutation and source-byte boundaries

The research-only `createEncodedProfile` receives caller-owned decoded metadata. A ZIP source may be fully audited at method entry, yet `buildSingleProfileZip` performs an asynchronous deflate before reading header attributes. To prevent post-audit caller mutation from affecting output bytes, the codec now snapshots and copies validated source ZIP header scalar attributes plus `extra`/`comment` bytes *before* awaiting compression. This is a **TOCTOU hardening measure for the synthetic research encode API**, not proof that a caller-provided metadata object is authentic. A synthetic test mutates `flagBits`, DOS time/date, extract version, creator system/version and internal/external attributes after entering encode; reopened synthetic output retains the audited snapshot values.

A separate synthetic encrypted P1G comparison confirms ZIP local/central signature and checksum consistency, the changed profile's **different CRC and compressed data bytes**, re-emit of known simple source flags, creator, DOS timestamp, external attrs and zero extra/comment lengths, and exact unchanged original source bytes. The regenerated ZIP's central offsets, compressed data, CRC, ciphertext, raw JSON and any future unsupported opaque extension are not promised byte-identical. The source envelope compatibility gate continues to reject unknown metadata and unrecognized extras/descriptor rather than silently copying/normalizing them. No Writer is enabled.

### Evidence, dependencies and remaining acceptance

- **CONFIRMED:** codec control flow, strict numeric/checksum path, source ZIP snapshot prior to async rebuild, unchanged `auditP1gEnvelope` and immutable false capability/report fields.
- **SYNTHETIC_TESTED:** direct unsafe numeric aliases, escaped duplicate keys, Unicode/order lexical drift vs unchanged semantic values, large numeric token set, simple ZIP rebuild byte/CRC changes, header-field snapshot under mutation, unchanged original ciphertext, and previous negative ZIP/Inflate coverage.
- **REAL_SAVE_READ_ONLY:** approved 01E source and Round 2/3 independent ZIP metadata + exact JS envelope-audit function result. This round does not extend exact real-file JS full-path execution.
- **UNKNOWN/BLOCKED:** full new JS `loadProfile` on real original, real modified-copy `createEncodedProfile`, actual ZIP opaque preservation and serializer identity, 128 MiB browser memory pressure, Switch runtime cold-load/save/restart and 05 QR independence for this new HEAD.
- **Capability for 02 TIME/03 WEB:** the existing Worker-owned `auditP1gEnvelope` status/findings and read-only preflight remain the only permitted projection; `repackageShapeObserved` is a **source shape signal**. There is no consumer API change, no source-derived BID claim, and no Writer permission from any read, synthetic encode/reopen or lexical observation. `operationAllowlisted=false`, `writerAuthorized=false`, `editedCopyAuthorized=false` and independent restore/replacement remains unauthorized.

Round 4 QA must inspect these exact code and test deltas against the prior accepted HEAD, run CI at the final frozen SHA and independently confirm no UI/Worker/Wand changes. PR #11 integration must be planned by 00 CTRL after new HEAD review; no direct integration push is performed here.

## 01 CORE Round 5 — Wand 01A serializer contract delta and negative read-only acceptance (2026-11-02)

**Upstream source of truth, NOT reimplementation:** Wand 01A Save/Codec/Version Contract documents `READ_PACKAGE`, `READ_PROFILE`, `ENCODE_COPY`, and `PERSISTENT_REPLACE` as **distinct** authorities. It requires exact (platform family, target executable BuildIdentity, save schema, codec revision); clone-only edits; exact JSON Pointer allowlists; source SHA and expected old value checking; unknown/unrelated JSON fields, arrays and map keys/tombstones/allocation metadata preserved; independent decode/reopen; complete backup before atomic persistent replacement with verification/rollback. A typed protobuf writer would additionally need unknown protobuf field preservation. The 01A reference implementation already covers synthetic/older narrow fixture workflows; it does **not** prove Switch v1.25.3 schema626 modified-save export or product Writer release. 01E real schema626 evidence remains READ_ONLY.

### Operation-level preservation matrix

| Requirement | Existing Timekeeper mechanism | New Round 5 test / precise limit | Owner |
| --- | --- | --- | --- |
| source backup | `SafeProfileEditSession` source copy, `loadProfile` input immutability | two independent read operations preserve byte-identical synthetic ciphertext; edited synthetic research operation does not mutate original | 01 CORE |
| source identity / build | schema and exact BuildIdentity modeled separately | schema700 may be structurally inspected but `editedCopyAuthorized=false`; BID must not be inferred from schema | 01 CORE/05 QR |
| exact pointer + expected old value | `inspectTimingPlan` resolves own source row and expected string | two real event-definition IDs in **synthetic** source have exact two-pointer changes; stale original value and ID drift both yield `HOLD_PREFLIGHT`, without returning edited bytes | 01 CORE + 02 TIME semantics |
| allowlisted delta | `auditTimingDeltaIsolated` applies only on temporary clone, computes `diffPaths` and rechecks JSON parse | unknown-field alteration gives an extra disallowed path in semantic diff; exact two-pointer synthetic plan matches after encode/reopen | 01 CORE |
| unknown generic JSON | lossless clone and strict JSON parse with 128 MiB profile maximum | unknown GameInfo/World/per-event/grid/opaque objects, array slots, null, booleans, Unicode, numerical-looking **strings** preserved on synthetic semantic reopen | 01 CORE |
| original ordering / lexical JSON | original `jsonText` preserved in read-only decoder; changed JSON is `JSON.stringify` | JSON object integer-key ordering, numeric spelling, whitespace/escapes may change on encode; no assertion of byte/lexical fidelity | 01 CORE / writer BLOCKED |
| array/object identity | `diffPaths` and `JSON.stringify` semantic comparison | synthetic array element order, tombstone-style null, nested values retain exact order/values; not proof of native object identity or unknown protobuf fields | 01 CORE / 02 TIME |
| ZIP headers and extensions | strict source audit; research-only rebuild of one `profile` member | simple synthetic metadata observed; unlike source, edited CRC and compressed data necessarily recomputed; descriptor, extra, comments and atypical timestamps must remain denied or independently proved lossless | 01 CORE |
| corruption/DoS | bounded decrypt/ZIP parser and streamed inflate | encrypted synthetic mutations at local signature, central CRC, central compressed size, EOCD magic and ciphertext alignment rejected without changing source; preexisting compressed-bomb/128MiB+1 tests remain | 01 CORE |
| encode/reopen authorization | internal research synthetic `createEncodedProfile` and independent `loadProfile` | synthetic-only exact two-row roundtrip is evidence of serialization mechanics, **not** source build/native/game compatibility | 01 CORE+05 QR |
| durable replacement | no product Writer or replacement pipeline | backup-first, validate plan, single isolated encode, independent reopen, separate files/download and future runtime gates are product obligations, none released | 00 CTRL/01 CORE/03 WEB/05 QR |

**New synthetic test file:** `tests/p1g-serialization-contract.test.mjs` contains four independent fixtures: (1) two-pointer exact-diff synthetic P1G encode/reopen and array/unknown-field preservation; (2) stale expected old time, changed RecurringEventItemID, extra unknown JSON mutation and newer-schema read-only proof; (3) physically corrupted encrypted test ZIP local signature, central CRC, declared compressed size and EOCD plus misaligned ciphertext truncation must fail; (4) repeated independent reads keep the encrypted source byte-identical. These test-only mutations are made to copies and do not process or modify any real save.

### Explicitly unresolved sources of incompatibility

- **Unknown JSON syntax vs value:** semantic retention can be true even if original JSON text/order/number spelling changes. Future Write policy must decide whether such normalization is acceptable *per operation and game engine* rather than assuming that semantic equality implies losslessness.
- **Source envelope vs rebuilt package:** a source ZIP that has identical local/central data does not guarantee rebuilt extra fields, compression bitstream, DOS metadata, EOCD shape, archive-level extensions, or encrypted output. Unusual envelopes continue to fail closed; `repackageShapeObserved` is **not** a writer authorization.
- **No full real JS serializer test:** Round 3 exercised exact JS `auditP1gEnvelope` against approved real-save ZIP metadata, but not the entire new JS `loadProfile` on the real original. Real modified save is explicitly prohibited here; native load/save/restart is not tested.
- **Memory:** 128 MiB is an individual uncompressed profile ceiling, not a proven browser peak heap. Earlier synthetic ~6 MiB JSON and 50,000 numeric tokens test only bounded subsets, not an actual 128 MiB safe-performance claim.
- **Export protocol:** preserve immutable input and original hash; stage small plan + Undo/Redo; assert exact schema/build/pointer/value/event ID/operation semantics; prepare original backup; clone into isolated copy and verify exact delta; **encode only once**; independently reopen and re-audit; present separate original and edited file downloads only after all gates and independent QR are satisfied. This is a future contract, not a released implementation.

**Cross-stream gate:** 01 CORE may confirm only `READ_PACKAGE`, `READ_PROFILE`, strict JSON and synthetic serialization evidence. 02 TIME must confirm native `NextOccurrence` consumer/event-specific behavior. 05 QR must independently validate fixed HEAD, negative tests, version compatibility and required Switch hardware acceptance. 00 CTRL manages integration and final release. 03 WEB merely renders Worker-owned diagnostic capabilities. `writerAuthorized=false`, `editedCopyAuthorized=false`, `operationAllowlisted=false`, and `persistentReplaceAuthorized=false` remain unconditional here.


## 01 CORE Round 6 — exact-JS real schema626 load and research Codec provenance boundary (2026-11-02)

### New genuine read-only code-path evidence (scope upgrade only)

The previously open question "was the **full current JavaScript** `p1gPackagedProfileCodec.loadProfile()` executed against the approved original?" is **YES in Round 6**, limited to `REAL_SAVE_READ_ONLY`. A private isolated Node.js 22.16.0 workspace used exactly four source modules fetched from PR #8's unchanged Round 5 HEAD `9579e6a02bc7b874e6181ae641759153e287c4b4`, individually **verified against canonical Git blob SHA-1**, with no modifications:
- `src/core/p1g-packaged-profile-codec.mjs` blob `0185fe691b588e90ccfe046959a66bb0a0d7a3fc`
- `src/core/safe-edit-session.mjs` blob `51f1ad4a95be10d5a40ddf98d3dd5244c09c9059`
- `src/core/versioning.mjs` blob `09cec8e0390773668f6caa10ea24112f07817013`
- `src/core/p1g-envelope-audit.mjs` blob `aae18cfd45916ad934feb61f12dc976e234ddfc4`

The exact previously approved 01E Switch v1.25.3 original was used **read-only**. Its ciphertext measured `457,696` bytes and SHA-256 `86b24cb861e4d65bb22f6627ac275d6a8c3bd4cfb968d2399cb5d328313dcb10` matched the upstream 01E acceptance before **and after** the complete JS read. No synthetic substitution of source or manually projected ZIP metadata in this new run.

The exact `p1gPackagedProfileCodec.loadProfile(source)` succeeded: AES-256-ECB/PKCS7 unwrap, ZIP central/local selection and Deflate8 with CRC and declared size, strict UTF-8+JSON parse, root validation, `GameInfo.Version=626`, and native JavaScript Zip metadata output. Independent invocation of exact `auditP1gEnvelope({format:'packaged', metadata:loaded.metadata})` returned `SIMPLE_ENVELOPE_OBSERVED_REBUILD_UNVERIFIED`, `repackageShapeObserved=true`, `writerAuthorized=false`, `editedCopyAuthorized=false`. ZIP header flags 0/0, one `profile` entry, compressed 457,575 bytes, inflated 5,252,207 bytes, local/central extra 0/0, archive comment 0. This **now confirms the exact codec-to-envelope observation path**, not only Round 3 independent Node ZIP parsing + exact JS audit in isolation.

The same approved original was independently opened with the exact `SafeProfileEditSession.open({sourceBytes,sourcePlatform:PlatformFamily.Switch,codec:p1gPackagedProfileCodec})`, returning packaged format, codec contract `p1g-v0`, schema626, and original byte hash unchanged. This method's automatic immutable in-memory source copy and strict JSON parse ran; **`exportVerifiedCopy` was NEVER called on the private original**. No edit, encode, repackage, encrypted modified-save bytes, product download, persistent write, diagnostic private-field output or Switch runtime action was performed. Only redacted aggregate fields and source hashes were retained; private raw source/temp source-transfer artifact/local scripts were cleaned. Node read took about 309 ms in this isolated run and final process RSS snapshot was ~74 MB; **neither number is a guaranteed browser/Worker peak**.

### New independent synthetic negative coverage (3 tests, not actual-save write)

`tests/p1g-serialization-contract.test.mjs` now additionally verifies:
1. `SafeProfileEditSession.open` on purely synthetic bytes, `exportVerifiedCopy` **no-op** path returns two independent byte-identical source copies, `noOp=true`, `authorization=null` and **zero research Encode calls**. A distinct attempted non-no-op with a deliberately unsupported target Switch BID fails `Writer build gate failed` **before** internal Encode or independent reopen is attempted; source and parsed snapshot remain unchanged. No-op byte-copy semantics are NOT a product edited-export release.
2. A **synthetic forged source ZIP metadata tuple** may retain exact local/central consistency and `repackageShapeObserved=true` despite falsely supplied DOS date/time. Internal research `createEncodedProfile` can re-emit this forged timestamp in a synthetic encrypted output: consequently, the source-shape audit neither authenticates caller-supplied metadata nor proves provenance/source byte fidelity. Both audit Writer booleans remain false. Any future edit must bind metadata to the original byte hash, snapshot and session contract instead of trusting caller-authored parity.
3. A highly compressible **12 MiB string** within a synthetic schema626 profile (compression ratio > 100:1) is decoded as declared, with original ciphertext unchanged. This tests one bounded compression-ratio regime; it does not assert max 128 MiB inflation or browser Worker process-memory acceptance.

### Serializer and Writer capability boundary — unchanged

**Semantic preservation:** isolated clone + `diffPaths` may prove unchanged JSON *values* and array contents for synthetic operations. **Byte preservation:** original JSON syntax, numeric spellings, Unicode escapes, integer-index-key order, ZIP local/central metadata, unknown extra/comment, descriptor, Deflate bitstream, and encrypted bytes require separate evidence. During editing, even a simple ZIP's CRC/sizes/compressed bytes/ciphertext change; no real rewritten schema626 sample has been accepted.

**Input/computation bounds:** `MAX_INPUT_BYTES=128 MiB` encrypted bytes, `MAX_ARCHIVE_BYTES=256 MiB` decrypted ZIP and research compressed output ceiling, `MAX_PROFILE_BYTES=128 MiB` inflated profile (also central declared uncompressed limit), plus Zip entry count 1024 and nested JSON depth 256. The streaming Inflate ceiling is not an overall peak RSS or a bounded browser `Worker` transfer estimate; extra copies arise for input bytes, AES bridge, ZIP archive, decompression chunks, JSON text/object graph and clone/reopen. Browser peak must be independently measured under realistic memory pressure; source ZIP compressed ratio and object graph fan-out matter.

**Acceptance split:**
- 01 CORE: exact source original hash, package/JSON/ZIP read, stable source snapshot and pointer CAS, preservation plan, synthetically verified single isolated Encode + independent reopen only. Not privileged to assert runtime semantics or new build compatibility from schema alone.
- 02 TIME: version-specific native `NextOccurrence` scheduling/consumer/side effects and operation-specific allowlist.
- 05 QR: independently validate fixed HEAD/negative paths; future isolated real modified-save metadata/JSON preservation only after safety prerequisites; Switch game load, normal save, full shutdown/relaunch and restore; Release Gate.
- 00 CTRL: PR stack, parent/QA dependency and integration. 03 WEB consumes Worker-owned facts but never decides Writer authority.

**Remaining BLOCKED/UNKNOWN:** real schema626 edited-copy Encode/Reopen and JSON/ZIP opaque extension preservation; exact executable BID from save alone; metadata provenance-bound writer design; data descriptor/ZIP extensions on unusual *real* sources; 128 MiB Worker-peak memory; Switch load/save/exit/relaunch; 05 QR independent acceptance of this Round 6 HEAD. Keep `operationAllowlisted=false`, `writerAuthorized=false`, `editedCopyAuthorized=false`, `persistentReplaceAuthorized=false`; original/edited files remain separately prepared only after a future accepted **backup-first → exact pointer CAS → isolated clone delta → single Encode → independent Reopen** sequence. Do not modify the Wand common Writer gate or PR #11 integration from this stream.


## 01 CORE Round 7 — physical ZIP extensions, multi-row CAS negatives, Worker memory evaluation scaffold (2026-11-02)

**Input evidence and separation:** Round 6's independently hash-matched, full actual-JavaScript `p1gPackagedProfileCodec.loadProfile(original)` and `SafeProfileEditSession.open(original)` PASS on approved Switch v1.25.3/schema626 original remains the highest evidence: **REAL_SAVE_READ_ONLY**. The earlier real-file `auditP1gEnvelope` alone was a narrower observation. This Round 7 does **not** fetch or re-open the real original, does not call real `createEncodedProfile`, and cannot claim **REAL_SAVE_EDITED_COPY**, opaque-field preservation or Switch load/save/restart.

### New synthetic coverage and differential acceptance

**Multi-field preflight (source CAS, 2 independent `NextOccurrence` pointers):** `tests/p1g-round7-negative.test.mjs` verifies that an otherwise valid two-row plan containing one stale original time, invalid target time, identical old/new timestamp or missing source pointer yields `HOLD_PREFLIGHT` for the whole isolated audit; one already-valid pointer may not promote the invalid companion. Duplicate and dangerous `__proto__` pointers throw before any clone-edit; snapshot schema drift is rejected. An explicit third change in an unknown array/object path produces an extra `diffPaths` entry, not part of the planned pointer set. These are **synthetic read-only plan proofs**, not application of a real P1G edit.

**Physical ZIP source extensions (not merely forged metadata):** additional encrypted synthetic P1G fixtures insert a genuine archive comment, genuine central entry comment and *matching, well-formed unknown extra records in both local and central headers*. The exact codec can read all three fixtures; the exact envelope audit marks `repackageShapeObserved=false` and `writerAuthorized=false` despite a successful read and, for the matched extras case, `localHeaderFieldsMatchCentral=true`. Internal synthetic `createEncodedProfile` refuses to reconstruct any of those source envelopes. Earlier positive source-envelope simplicity, physically present descriptor and local-only extra regressions remain unchanged; the new tests are NOT evidence of lossless serialization of extra/descriptor/comment bytes. The research repacker still generates one `profile` ZIP, re-computes CRC/sizes/Deflate stream/offsets and new AES ciphertext and cannot make arbitrary source metadata round-trip byte-for-byte.

### Memory measurement: executable Node-Worker probe, NOT browser acceptance

The opt-in `tests/p1g-worker-memory-probe.mjs` constructs a **synthetic only** profile, creates an encrypted fixture, structured-clones bytes into a Node `worker_threads` Worker (no transfer/detachment), and samples main and Worker `heapUsed`, `external`, `arrayBuffers`, and **process-wide** `rss` at the receive/decode/parse/clone/stringify steps. It executes strict read-only `loadProfile` + `parseSafeJson`, makes a temporary clone and JSON text, but **never encodes or exports**. The CLI input is explicitly bounded to 1–24 MiB; use `node tests/p1g-worker-memory-probe.mjs 8` for optional local diagnostics. All reported figures are **snapshots rather than measured peaks**, and the RSS is shared across Node threads; they must not be presented as per-Worker allocations.

The CI-only `tests/p1g-worker-memory.test.mjs` performs a 1 MiB Node Worker smoke and asserts that no `writerAuthorized` or `editedCopyAuthorized` is set. It also rejects invalid/out-of-range input sizes **before** fixture allocation. This validates the probe harness only; Node Worker heap, Node `CompressionStream` behavior, and process RSS do **not** establish browser Worker compatibility. The product uses browser structured clone/transfer and browser memory management; these require independent real Chromium/Firefox/WebKit QA with device-dependent memory pressure, peak allocations, Worker termination/cancellation, cross-Worker session switching, file switching, and repeated inspect/undo/reopen. Record source ciphertext bytes, inflated bytes, main/Worker peaks, browser OOM/crash outcomes and no unintended downloads. Do not assert that 128 MiB streamed Inflate cap bounds total memory: the reader may hold ciphertext, decrypted ZIP, Inflate chunks and concatenated output, UTF-8 text, parsed object graph, and clone simultaneously.

| Data or operation | Evidence | Byte-preservation status |
| --- | --- | --- |
| Original source P1G `loadProfile` / Session open | REAL_SAVE_READ_ONLY from Round 6; SHA before/after | Source ciphertext unchanged; no edited output |
| Unknown fields, arrays, `null`, Unicode, numeric strings | SYNTHETIC_TESTED from Round 3–6 | Semantic JSON equality only; JSON text spelling/key ordering/number escapes may differ |
| Two-pointer `NextOccurrence` CAS | SYNTHETIC_TESTED from R5 plus R7 negatives | Exact semantic path delta, no real Writer grant |
| Local/central ZIP header fields, flags and DOS time | SYNTHETIC_TESTED simple repack | Observed/equivalent selected fields; no source provenance or raw ZIP byte guarantee |
| ZIP descriptor, unknown extra, archive/entry comments | SYNTHETIC_TESTED physical source extensions | Read may succeed; synthetic repackage **denied**, never normalized silently |
| CRC/Deflate stream, ZIP offsets, encrypted ciphertext | SYNTHETIC_TESTED changed profile | Changed bytes expected; identical binary output not claimed |
| 128 MiB Inflate cap, Worker/browser peak | Source guard + SYNTHETIC_TESTED sub-limit; Worker Node probe only | Browser peak **UNKNOWN** and release gate BLOCKED |

### Explicit consumer permission / handoff contract

01 CORE remains responsible for original-hash/source-meta provenance, strict JSON/ZIP, operation-level exact pointer+old-value+diff and future backup-first single isolated Encode/independent Reopen. 02 TIME owns native event meaning for each `NextOccurrence` consumer, creation/reschedule/limits and operation allowlist. 05 QR owns independent fixed-HEAD negative acceptance, **browser memory/Worker boundary**, and eventual safe real modified-copy and Switch cold-load/resave/relaunch acceptance. 00 CTRL alone integrates onto PR #11; 03 WEB consumes Worker read-only findings and does not authorize Write.

Fail closed if any source ZIP region, opaque extension, source metadata, schema/build/Codec identity or operation-semantic contract is unverified. No inference of BID from schema626; no automatic future-time correction; no direct original overwrite. **All production `operationAllowlisted`, `writerAuthorized`, `editedCopyAuthorized`, `persistentReplaceAuthorized` remain false**, regardless of source envelope simplicity or synthetic success. Backup must precede an isolated clone with verified CAS, single Encode, independent Reopen and exact delta, followed by separate approved original and edited downloads only after all independent gates.


## 01 CORE Round 8 — actual-browser memory instrumentation, executable limitations, and acceptance contract (2026-11-02)

### Evidence and source-of-truth reconciliation

Round 6 completed the **full real-schema626 canonical JavaScript** `p1gPackagedProfileCodec.loadProfile()` and `SafeProfileEditSession.open()` read-only path against the previously 01E-approved Switch original. This evidence remains `REAL_SAVE_READ_ONLY` with source hash unchanged. It exceeds the earlier *only* `auditP1gEnvelope()` metadata check. Round 8 did **not** access or re-encode the original.

Round 7 already had synthetic ZIP local/central descriptor/extra/comment rejection, exact multi-pointer CAS with stale-old-value fail-closed, and a Node `worker_threads` memory snapshot probe. These are reused unchanged. Existing synthetic internal encode/reopen is **not** real-save Writer compatibility. `GameInfo.Version`, the exact executable BID, version string, and codec revision stay different evidence dimensions.

### New executable actual-browser measurement harness (tests only, no product code)

- `tests/browser-memory/synthetic-fixture.mjs`: generates only a bounded 1–24 MiB synthetic schema626 P1G in process memory and writes bytes to **stdout**, never reads any save path or private material.
- `tests/browser-memory/index.html` and `p1g-read-worker.mjs`: browser `Worker({type:'module'})` uses the **existing unmodified production Codec** and read-only `SafeProfileEditSession.open`; measures phases **received → loadProfile → parseSafeJson → structuredClone → JSON.stringify → session-open**. Reports source ciphertext bytes, uncompressed profile bytes, codec/schema, phase durations and optional Chromium-specific `performance.memory` values. Clone vs transferable array-buffer delivery are explicitly separated: transfer operates on a *copy*, preserving the synthetic original. Session-switch/cancel tests terminate a Worker, discard stale session IDs, and start a new Worker; they do **not** claim in-codec AbortSignal cancellation.
- `tests/browser-memory/run_browsers.py`: optional Playwright Python harness. Serves on 127.0.0.1 via a strict **allowlist-only** HTTP handler (synthetic fixture and 6 local code/page paths) with COOP `same-origin`, COEP `require-corp`, CORP `same-origin`. Executes Chromium, Firefox and WebKit when their actual browser executables exist. Measures main/Worker phase snapshots and optionally `performance.measureUserAgentSpecificMemory()` (if available), and 30-ms-sampled **summed RSS of newly spawned browser processes**, using optional `psutil`. Browser reports always mark `browserPeakMemoryAccepted=false` and `realSaveWriteAccepted=false`, because neither JS heap snapshots nor sampled/possibly double-counted RSS constitute a precise browser process peak.
- `tests/p1g-browser-memory-contract.test.mjs`: Node CI-only tests validate synthetic fixture bounds, actual codec decoding, and absence of edited-save Writer/encode entrypoints in browser page/Worker. This does **not** constitute running the browser.

Optional reproducible invocation, **only from an environment permitting localhost and possessing actual browser binaries**:
```sh
python tests/browser-memory/run_browsers.py --browser all --mib 1
CHROMIUM_PATH=/usr/bin/chromium python tests/browser-memory/run_browsers.py --browser chromium --mib 4
```

### Observed execution limits (do not silently promote to a browser PASS)

The isolated QA environment contains system Chromium and Python Playwright, but its administrative browser policy rejects **all attempted** navigation to local `http://127.0.0.1`, arbitrary HTTP(S) domains and `file://` with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. With the new runner, **Chromium's actual Codec Worker path was NOT executed**. Firefox Playwright executable was absent (`~/.cache/ms-playwright/firefox-1497/firefox/firefox`); WebKit executable was absent (`~/.cache/ms-playwright/webkit-2227/pw_run.sh`). Their runtime memory and Codec execution are `BLOCKED/UNKNOWN`, not FAIL of Codec semantics.

As an intentionally narrower fallback, local Chromium `about:blank` supports a `blob:` Worker but is **not a secure context** (`crypto.subtle` unavailable); an in-browser **synthetic JSON-only** Parse → Clone → Serialize Worker was exercised with **1, 4 and 12 MiB** payloads, producing successful responses in all three cases. Example observed Worker processing durations were approximately 3.9 ms, 39.6 ms, and 172.2 ms, **not stable benchmark thresholds**. The approximate observed maximum from 30-ms polling across newly spawned Chromium processes was 541,523,968 **summed RSS bytes**, with shared-memory double-counting possible; it is neither a per-Worker measurement nor a guaranteed transient peak. This fallback is reproduced by `tests/browser-memory/opaque-origin-staging.py`; it **does not execute P1G AES/decompression, exact codec, SafeProfileEditSession or cross-origin isolated APIs**, and it cannot be counted as Codec browser acceptance. No actual user file was used anywhere.

### Instrumentation contract to 03 WEB and 05 QR

For each browser **and each accepted platform/device class** record: browser build, OS/physical memory class, worker configuration and page isolation, input encrypted ZIP bytes, ZIP declared inflated bytes, profile JSON UTF-8 bytes and UTF-16 char count, object graph and array fanout counts, clone mode (`structuredClone` versus transferable Buffer), time to first progress, phase durations, process ID topology, memory sampling frequency, sampled RSS range/maximum, JS heap snapshots, UA-specific memory (when supported), OOM/renderer exits, cancellation and old-session response suppression, source byte hash before/after and whether any download occurred. Enumerate **normal vs high-compression-ratio vs metadata-corrupt/CRC/truncated vs near-limit** synthetic fixtures; include repeated load, file switch, Worker termination, cancellation mid-decompress, and return to initial source. Do not run near 128 MiB on resource-constrained devices unless test budget/limits are established; start 1 / 4 / 12 / 24 MiB and scale only after stability. Test Firefox/WebKit independently, not by treating a Chromium run as cross-engine coverage.

Memory distinctions are material: encrypted source input `MAX_INPUT_BYTES=128 MiB`; decrypted ZIP `MAX_ARCHIVE_BYTES=256 MiB`; single inflated profile `MAX_PROFILE_BYTES=128 MiB`; JSON nesting depth `MAX_JSON_DEPTH=256`. Streaming Inflate limits *output collection*, not the aggregate of AES ciphertext/copy, decrypted ZIP, Inflate streamed chunks+concatenated array, UTF-8 text/parsed object graph, snapshot clone, serialized strings, Worker structured-clone/transfer buffers and multiple live sessions. `performance.memory` is Chromium-specific and may report imprecise or unavailable values; UA-specific memory is asynchronous and not a peak; RSS polling may miss spikes and can double-count shared pages. Exact peak/OOM thresholds require independent device/browser instrumentation and explicit acceptance margins by 05 QR.

### Serialization and Writer gate remain separate

An operation may preserve **semantic JSON values**, arrays and unknown object keys under synthetic JSON reparse even though JSON whitespace, Unicode escapes, exponent/decimal spelling, integer-looking object-key ordering and raw UTF-8 text change. A simple source ZIP can preserve selected local/central header fields after synthetic repackage while regenerated CRC, Deflate stream, central offsets and AES ciphertext naturally differ; unknown ZIP extras, descriptors and comments are **readable but rejected** for synthetic rebuild. Source-envelope shape and exact real-save `loadProfile` are not evidence of modified-copy game compatibility.

Future edited copies still require source-hash-bound immutable original backup first, exact build/codec/schema and 02 TIME event semantics, CAS of every original pointer/value, isolated JSON clone and exact allowlisted semantic diff, single Encode and independent Reopen including ZIP metadata validation, 05 QR browser memory and device cold load/save/fully exit/relaunch, before separate original and edited downloads. No shared Wand Writer authority changes. 00 CTRL alone integrates PR #8 into PR #11; 03 WEB consumes only Worker-confirmed read-only states. All `operationAllowlisted=false`, `writerAuthorized=false`, `editedCopyAuthorized=false`, `persistentReplaceAuthorized=false` remain unconditional.


## 01 CORE Round 10 — P0 evidence correction for synthetic browser source bytes (2026-11-02)

**P0 issue (05 QR) resolved in *research harness only*, subject to independent fixed-HEAD QR:** previous `tests/browser-memory/index.html` emitted `sourceCopyPreserved: original.byteLength===input.byteLength || mode==='transfer'`. The first branch checked *length*, not bytes. The latter branch reported *true* even after transferable `input.buffer` became detached. It could not establish either input-content equality or retained source integrity. Do NOT cite earlier boolean as source-byte preservation evidence.

**Revised evidence contract and distinct scopes:**
1. Before sending any bytes, create `input=original.slice()`, compare **every byte** against the retained `original` using `bytesEqual(original,input)`, then independently compute SHA-256 for `original` and `input`. A same-length one-byte change is rejected before sending; this property is exercised by new Node synthetic negative tests. Record `preSendExactByteMatch` and `preSendSha256Match` only after both checks succeed.
2. Worker uses `crypto.subtle.digest('SHA-256', source)` on the **actual received** `Uint8Array`, before parsing, and returns `workerReceivedSourceSha256` on successful `DONE`. Main compares it against original pre-send hash, and reports `workerReceivedSourceSha256Match` only on success. This verifies transmission content at Worker reception, not an entire game-save roundtrip.
3. Main computes `sourceHashAfter` from the retained `original` following the completed read-only Worker operation and verifies it equals `sourceHashBefore`, reporting `originalSourceSha256Unchanged`. The original is separate from the copied input and remains the reference across transfers.
4. Clone-mode `input` must remain attached; Transfer-mode `input` must be detached. **Never attempt to compare the detached input after transfer**; `sentInputPostSendByteComparison='NOT_POSSIBLE_DETACHED'`. The pre-send comparison, Worker-received digest, and retained original post-send digest are three different facts. Remove misleading `sourceCopyPreserved`.
5. Session controls now create the active state **before** asynchronous fixture fetch and use AbortController plus session-identity checks after asynchronous operations; cancellation and switch reject pending operations rather than leaving a Promise indefinitely outstanding. `staleResponsesDropped` is a counter of actually seen mismatched messages; an absent stale response is **not** evidence of a demonstrated stale-callback attack. Termination is not a validated in-codec AbortSignal.
6. Browser helper `negativeSameLengthMutationTest` modifies a byte without changing length; the runner requires rejection. Node synthetic tests validate first/middle/last byte changes, 256 distinct changed positions, SHA mismatch, Transfer detachment, and original retention. This is synthetic evidence, **not real-save byte proof**.

**RSS/memory acceptance correction:** `SampledProcessRSS.report().sampleCount===0` results in `rssEvidenceStatus='NO_VALID_RSS_SAMPLES'`, `rssEvidenceAvailable=false`, `rssPeakAccepted=false`. If samples exist, the status is `SAMPLED_PROCESS_SUM_NOT_EXACT_PEAK`, always `maxObservedRssIsExactPeak=false`. Samples arrive about every 30ms, may miss transients and may double-count OS shared memory among browser processes. Browser JS heap and UA-specific memory are independent point observations and cannot be inferred from sampled RSS. A successful read-only P1G Worker run does NOT by itself establish browser peak-memory safety.

**Scope and cross-engine status:** Tests are limited to synthetic schema626 P1G. Earlier 05 QR independent actual Chrome read-only on immutable CORE Round8 HEAD remains evidence for **that HEAD** only, not a new QA PASS. Optional Playwright Chrome/Firefox/WebKit harness must independently execute on this precise Round10 SHA, record browser build, source/inflate byte sizes, pre-send/Worker/post-send hashes, session fence, OS sampled RSS with valid sample counts, and crash/OOM. The JSON-only `about:blank` fallback never counts as P1G Codec execution. The 128MiB inflation cap remains separate from aggregate browser memory and OOM.

**Preservation/Writer boundary unchanged:** Round6 approved actual original's exact JavaScript `loadProfile` and `SafeProfileEditSession.open` remains **REAL_SAVE_READ_ONLY** only. Existing strict JSON, synthetic exact-pointer original-value CAS, synthetic single Encode/reopen and physical ZIP extra/comment/descriptor Fail Closed remain unchanged; no actual edited schema626 P1G and no Switch runtime roundtrip. JSON semantic equality is not source JSON text spelling/key order/escaping preservation; source ZIP parity is not preservation of unknown extensions or compressed bytes. No actual save accessed, changed, encoded, exported, or committed. All Writer/export/persistent replace capabilities remain false; 02 TIME semantics and 05 QR independent gates required, 00 CTRL alone integrates PR #11.
