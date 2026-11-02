# Exact-field JSON diff and synthetic P1G codec proof — 2026-11-02

Status: **SYNTHETIC / RESEARCH ONLY — NO USER-SAVE EXPORT AUTHORIZED**

## What was implemented

- `src/core/timing-delta-audit.mjs` performs a **separate, explicit** isolated JSON-delta audit. It does not run on ordinary stage, undo or redo.
- It reruns `inspectTimingPlan` on the authoritative parsed profile and review projection; a caller cannot pass a forged PASS result as proof.
- If any proposed field is held or rejected, no clone is created; the result is `HOLD_PREFLIGHT`. A zero-change plan is also held.
- Only when *every* proposed item reports `STRUCTURE_OBSERVED`, the research verifier clones the source, applies exact proposed timestamp changes to the clone and validates the complete JSON object with `diffPaths`.
- The observed change-path set must equal the intended set exactly, including no changes to other fields or root identity. After JSON stringify and strict parse, the same exact diff set must still hold, catching unrelated JSON value loss or normalization.
- **No edited object, serialized JSON, encrypted buffer, file handle, download token or write callback is returned.** All writer, export, native-semantic, source-build and container-roundtrip capability flags remain false.
- The clone may be costly: live UI/Worker integration is intentionally NOT enabled until benchmark results exist for 25/50/100/200 MiB real-world save planning. This is an isolated test facility, not normal preview behavior.

## Narrow synthetic encoded roundtrip check

- `tests/synthetic-p1g-timing-roundtrip.test.mjs` creates a synthetic schema 626 P1G archive using the existing local fixture generator, decodes it with the current P1G codec, and evaluates the isolated delta verifier.
- On **that synthetic fixture only**, the test creates a modified clone, produces one encrypted copy with `createEncodedProfile`, reopens the encrypted copy, and asserts that only the planned `NextOccurrence` value changed. The original bytes and unrelated synthetic JSON fields remain unchanged.
- Modifying `GameInfo.Version` triggers the existing codec metadata/version mismatch rejection before encoding.
- These tests exercise the existing codec's single-entry fixture path and cannot independently prove raw byte fidelity, unknown ZIP entry handling, extra-entry or archive-comment preservation, real game schema compatibility, renderer/browser behavior or Nintendo Switch cold-load acceptance.
- There is no production code path to export the synthetic edited copy, and no browser UI button to run the isolated clone-audit.

## Release gates unchanged

1. Confirm native spawn scheduling and per-event ID/family exclusions, including quest conditions, area/DLC ownership and existing spawned GridObjects.
2. Verify real profile container preservation and unmodified fields with version-specific evidence; do not conflate a parsed JSON semantic diff with identical raw bytes.
3. Establish a separate **Timekeeper** field/operation compatibility gate, without loosening the Wand 01A global writer restrictions. Schema equality and `STRUCTURE_OBSERVED` never grant write permission.
4. Run disposable **real saves** through edit/encode, game load, play, resave, complete exit/relaunch, and restoration independently. No such real-world test has passed here.
5. Only after independent acceptance, connect minimal staged deltas to a final, single encoded copy and separate untouched-original/edited-file downloads (no ZIP, with download retries).

Canonical cross-product research:
https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit
