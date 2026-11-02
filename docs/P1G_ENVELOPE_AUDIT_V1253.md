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
