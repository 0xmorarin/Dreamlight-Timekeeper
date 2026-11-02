# 05 QR — Independent read-only acceptance and Writer Release Gate
Date: 2026-11-02
Target: Dreamlight Timekeeper / Nintendo Switch DDV v1.25.3 / research BID 9A239D3DB569756D / save schema 626
Parent: Draft PR #2 HEAD 9ebdac063b81934eee37a62e5694749b1cf1aa65
Scope: source, synthetic negative QA and workflow evidence only. NO production writer, edited copy, real-save mutation or main merge.

## Fixed upstream PRs and evidence

| Target | Fixed HEAD | Base | Observed CI | Classification | Decision |
| --- | --- | --- | --- | --- | --- |
| PR #1 image pipeline | e647fe6ed15d7ee37fa5201d8d2dc9c82c105aed | main c4ce993b | #41306337887 success, same head | SYNTHETIC_TESTED / source asset workflow | PARTIAL |
| PR #2 timing research | 9ebdac063b81934eee37a62e5694749b1cf1aa65 | main c4ce993b | #41369590837 success, 110/110, same head | SYNTHETIC_TESTED; STATIC_ONLY for native event meanings | PARTIAL |
| PR #3 UI icons | 422839c5ffd979f85766e04c4a487864c4f02a21 | PR #1 e647fe6e | #41316390845 and Chromium #41316390910 success, same head | SYNTHETIC_TESTED / limited RUNTIME_TESTED browser icon smoke | PARTIAL |

CI jobs were checked against the Actions run's head_sha, not inferred from the PR description. The PR #3 Chromium job covers icon smoke; it does NOT prove the full 4-tab/time/backup/Undo workflow. PR #2 Node suite does NOT prove a real Chromium run, live save edit, re-import, or Switch load.

## Independent negative coverage

QA-only file: `tests/qa-release-gate-independent.test.mjs`. Distinct from existing developer test files.
- Intentional 2126 NextOccurrence input, staged far-past preview, undo/redo, source JSON and unknown-field invariance. SOURCE/SYNTHETIC only.
- Original-time drift, changed recurring-event ID, future unknown parallel branch, forged path and duplicate plan fail closed.
- New schema 700 may inspect but may not inherit edited-copy authorization.
- Synthetic encrypted P1G reader retains original bytes and nested unknown JSON on read. This is not encode acceptance.
- Central ZIP comments, extra bytes, descriptor flags and local/central discrepancies cause rebuild-review findings and no grant.
- Worker public message surface remains open/backup/preflight/check, with byte-copy backup; no export/overwrite branch.
- Existing PR #2 tests cover stale session, original backup, P1G synthetic codec, preflight and semantic classification. Those claims remain upstream evidence until independent tests/CI actually execute.

## Acceptance matrix

| Boundary | Evidence class | Decision | Outstanding |
| --- | --- | --- | --- |
| PR #1 source & CI pinned | CONFIRMED | PARTIAL | every asset source and actual render/pixel equivalence, product acceptance |
| PR #3 source & icon Chromium smoke | RUNTIME_TESTED (limited) | PARTIAL | full 4-tab browser interaction; responsive/a11y/language/file-switch |
| PR #2 read-only plans & pure tests | SYNTHETIC_TESTED | PARTIAL | QA CI completion, future writer semantic gates |
| UI original backup / stale session | SYNTHETIC_TESTED (developer) | PARTIAL | independent full browser action and multiple-download behavior |
| Reader schema626 actual accepted Wand save | REAL_SAVE_READ_ONLY (prior 01E evidence) | PARTIAL | 05 QR has not run fresh private input test |
| JSON exact-field diff | SYNTHETIC_TESTED | PARTIAL | versioned serializer preservation on real modified copy |
| P1G synthetic Encode/Reopen | SYNTHETIC_TESTED | PARTIAL | original ZIP flags/descriptor/CRC/metadata/opaque fidelity on real input |
| Native event timing semantics | STATIC_ONLY | BLOCKED | W1 per-ID scheduling, pickup, removal, rate/area/DLC lifecycle |
| Real save modified & re-opened | UNKNOWN | BLOCKED | controlled cloned save, encrypted copy diff, independent decode |
| Switch cold-load/save/exit/restart/restore | UNKNOWN | BLOCKED | separate real console acceptance results |
| Writer product release | UNKNOWN | BLOCKED | all mandatory gates + independent 05 QR PASS |

## Writer Release Gate: all conditions mandatory

- [ ] Owner-approved event ID/path/field-number allowlist; evidence of native consumers and associated state.
- [ ] Source build fingerprint, schema and compatibility verified per operation; no inference from schema alone.
- [ ] Safe pointer, event ID, oneof and original value match; unknown or conflicting data fail closed.
- [ ] Unknown/unchanged fields, original input bytes, ZIP metadata and opaque extensions preserved.
- [ ] Exact isolated JSON diff, one Encode and independent Reopen under controlled real save.
- [ ] Separate original backup and edited download prepared before download; backup first, independent retry; never ZIP bundle.
- [ ] Negative tests for stale worker/session/file switch, failed downloads, malicious metadata and partial failure.
- [ ] Switch cold-load, normal save, complete exit, relaunch, progression/unrelated-state check and recovery.
- [ ] Independent fixed-HEAD QA decision PASS for the exact operation and build.
- [ ] Explicit final product release authorization only after the above, while the Wand global Writer gate remains unchanged.

Verdict: QA may accept read-only/source/synthetic evidence in a limited scope. Writer/edited export/direct overwrite remain OFF. Owner-staged ~100-year future timestamps must not be auto-repaired. No user save or game binaries are contained in this document.
