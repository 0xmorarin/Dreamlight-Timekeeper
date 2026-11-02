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

