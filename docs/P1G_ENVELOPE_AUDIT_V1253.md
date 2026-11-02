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
