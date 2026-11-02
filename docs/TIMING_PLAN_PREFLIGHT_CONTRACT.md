# Read-only timing plan preflight — 2026-11-02

Status: **SOURCE SHAPE CHECKED IN SYNTHETIC TESTS; NO WRITER AUTHORIZATION / NO GAMEPLAY ACCEPTANCE**

## Authority and operation
- The Worker retains one original parsed profile and its reviewed source projection. The UI proposal is untrusted input, even when it originated from the built-in preview.
- Each staged entry carries an exact JSON Pointer, original UTC timestamp and proposed UTC timestamp. Staging, undo, redo and preflight do not create an edited profile, encode, re-encrypt or rewrite a ZIP.
- The Worker requires its current sessionId for any preflight or original backup request. A new file invalidates the old token; the UI ignores superseded late preflight results.
- A pure check verifies that the saved field exists unchanged at the exact path; source and proposed times are valid, and pointers are canonical, unique and free of forbidden object prototype keys.
- For World.RecurringEvents / NextOccurrence, it checks the known variant name, exactly one recognized oneof branch, no unknown parallel branch with timing/event ID, valid event definition and the original RecurringEventItemID.
- STRUCTURE_OBSERVED means only that the save's **current serialized structure matches**. It does not establish native spawn scheduling semantics, event eligibility, platform source build, field diff preservation or an acceptable edited save.
- Unknown event definitions, unsupported field families, contradictory original values, invalid targets, stale sessions, ambiguous oneofs and missing fields are held or rejected. A far-future date by itself is not corruption.

## Compatibility and provenance
- Source evidence: Nintendo Switch v1.25.3, BID 9A239D3DB569756D, schema 626, 508 recurring-event definitions; see the existing source audit and Wand-first register.
- A save with a newer schema can still be read and structurally checked if the codec and parser support it; a matching schema is not proof of executable BID nor writer safety.
- Shop refreshes, daily reset history and other non-RecurringEvent fields remain independently unreviewed.
- Every output has writerAuthorized=false, editedCopyAuthorized=false, sourceBuildVerified=false, exportAvailable=false.
- The Wand 01A global writer authorization is unaffected; Timekeeper will need an independent per-operation/version compatibility gate after adequate evidence.

## Resource envelope and release blockers
- Preflight limit: at most 10,000 staged changes and 250,000 projected source rows. Large-save memory and performance in the 25/50/100/200 MiB planning envelope remain unbenchmarked.
- Test evidence is synthetic Node tests, plus Worker protocol/session tests. It is **not** actual browser interaction, exact-game-build proof or Nintendo Switch game load/resave verification.
- Before edited export: verify concrete event IDs and native spawn/collection state; profile serialization and unknown-field preservation; exact changed-path diff and independent encode/reopen; newer schema field compatibility; live game load/play/resave/full-exit/cold-load with disposable saves and restoration.
- The approved final workflow still requires separate original and edited downloads, original backup first, single final encode, no ZIP, and fallback retry controls. None are enabled by this preflight.

Wand-first research register:
https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit
