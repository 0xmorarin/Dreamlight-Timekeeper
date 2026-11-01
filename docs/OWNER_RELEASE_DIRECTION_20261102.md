# Owner-approved Timekeeper release direction — 2026-11-02

Status: **PRODUCT DECISIONS LOCKED / PHASE 3 IMPLEMENTATION PENDING EXPLICIT DESIGN REVIEW**. This document supersedes the earlier future-time-as-anomaly emphasis in the PR #2 diagnostic discussion. No writer or edited-save download is enabled by this documentation change.

## Product intent, ordered by priority

1. **Decoration and spawn control (PRIMARY):** allow users to set the next execution time of *verified, eligible local automatic-spawn events* deliberately into the future (including very long intervals, such as ~100 years) to suspend their unwanted recurrence while decorating. "Future" is not synonymous with "corrupt." Do not automatically normalize or revert these dates.
2. **Time-travel recovery (SECONDARY):** the same manual controls may move an inadvertently future-dated eligible event to the present or another chosen date. Do not claim this fixes every timer or bypasses linked conditions.
3. **Manual, not automatic:** expose UTC/local-time aware set-to-now and arbitrary date-time actions, exact before/after and undo. Automatic anomaly recognition and auto-repair are NOT required for initial release. PR #2's save-wide distribution audit remains optional, technical/debug information and must not dominate the normal UI.

Owner evidence: in the Owner's save, many automatic-spawn items are **intentionally configured ~100 years into the future to suppress automatic spawning**. Earlier 323/468 shared `2126-08-20T00:00:00Z` is an observation in one save, not proof of corruption or a universally engine-authored sentinel. The Owner's stated intent explains the deliberate long-term scheduling use case; it does **not** independently prove the setter mechanism, runtime persistence or release path. The `SPECIAL_2126_UNRESOLVED` and `HOLD_2126_UNKNOWN` legacy labels are diagnostic/research restrictions only, not judgments that the stored future value is an error. Future source implementation should decouple user-selected datetime from a field's structural/runtime eligibility. Ordinary and 100-year future settings should be supported for a verified editable event without a blanket date-direction veto.

## Initial capability scope — review matrix, not write authorization

| Field / event family | Product intent | Current evidence | Initial handling before runtime validation |
| --- | --- | --- | --- |
| `World.RecurringEvents.*.ItemSpawning.NextOccurrence` | PRIMARY; control ordinary automatic object spawn | W1 static research candidate; event-specific population/area caps | Highest research priority; allow exact eligible ID only after semantics + save round-trip + console test |
| `WildCropsSpawningInVillage.NextOccurrence` | PRIMARY; suppress wild herb/spice spawn | W1 static candidate; region/population limits unknown | Same conditional research priority |
| `FlowerSpawningInVillage.NextOccurrence` | PRIMARY; suppress flower respawn | W1 static candidate; execution path 0x057C99E0 and readiness 0x05A65440 | Same priority; investigate object pickup/remove/parked-like state |
| `FishSpawningInVillage.NextOccurrence` | SECONDARY; resource control | W1 static candidate | Later tier within verified spawn scope; test node/zone state |
| `SnippetSpawning.NextOccurrence` | SECONDARY; quest/DLC-specific | W2; 24h cooldown, trap/token/firstActualize | Read-only until linked-state behavior proven |
| `MiningRockTurningSpecial.NextOccurrence` | SECONDARY; special mine state | W2; linked rock states unknown | Read-only until runtime analysis |
| `FlowerDryingInVillage` / selection control `ChooseItem`, `ChooseVillageArea` | NOT generic spawn suppression | Diagnostic / protected | No bulk date editing; display only if informative |
| `TimeLostTreasureSpawning`, `MakeCharacterEager`, `PendingFishUpgrade` | Other gameplay systems | Diagnostic only | No generic writes |
| `Stores/Displays/Shops/Placed Stalls.*LastRefresh` | Later refresh control | W2; fatigue/frequency/initial values; Now may DELAY refresh | Initially read-only; no automatic "refresh now" feature |
| `FishingStallData.LastCollect` | Later collection control | W2; reward/catch-up state unknown | Initially read-only |
| `TreeAndBushData.EndOfGrowth`, `GardenData.*.EndOfGrowth` | Later growth control | W2; linked growth/watering state unknown | Initially read-only |
| `TreeAndBushData.EndOfLife` | NOT growth/ready time | Protected; death/lifetime semantics | Exclude from generic editing |
| `LastDailyReset` / `LastWeeklyReset` | Separate reset systems | Diagnostic only; counters and online state | Initially read-only |
| MoonStone Chest event `2010000064` | Local spawn schedule only | Local ID confirmed; server claim limits separate | Conditional, exclude server rewards and entitlement/claims |

None of these rows currently represents a released write capability. Event-ID and declaring field structure are **additional exact requirements**, not inferred from an editable family or event name. Final allowed/blocked set will be confirmed after source investigation and runtime verification.

## Save version compatibility — owner-approved product requirement

**A save newer than the researched v1.25.3 must not be rejected solely due to its game version or schema.** The upload page lists researched supported version(s) and users decide whether to try other versions. This is not a guarantee that new or changed fields are writable.

Separate three states:
- `READ_SUPPORTED`: container/JSON decode and safe viewing works, even if the save schema is newer; show observed schema and `source build unverified`.
- `STRUCTURALLY_COMPATIBLE_FIELD`: exact selected object path, event-ID semantics, scalar type, parent/oneof invariants, original unknown fields and serialization integrity are independently checked. Compatible known fields may become candidates on newer saves *after their operation's native semantics have adequate release evidence*. The field compatibility is evaluated per operation, not by broad schema-number equality.
- `WRITER_BLOCKED`: modified field kind unknown, changed layout/meaning, serialization not preserved, invalid timestamp, or structural ambiguity. Do not transform it. Preserve original and offer read-only/backup.

The current `src/core/versioning.mjs` and `SafeProfileEditSession.exportVerifiedCopy()` use exact build contracts, while `src/reader.mjs` and `src/timing-review.mjs` recognize schema 626 for current research. These strict rules must be *reworked with a **separate Timekeeper edit compatibility gate*** before a wider-version writer is enabled; do not silently disable or weaken shared Dreamwish Wand authorization. A user choosing to try a newer save is not sufficient evidence to claim an unverified edited file is safe. Avoid requiring Switch BID in the save itself when it is not present; record version provenance honestly.

## Backup and computational model — design to approve before Phase 3

Owner asks for the original backup **at the same final download step** as the edited save, similar to DDV Profile Converter. Preferred proposal:
- Load/decode once, keep the exact source byte array unchanged in the local browser session; no upload or cloud storage.
- Record user changes as a small ordered in-memory set of field-level edits/undo actions. While selecting/changing rows, do **not** re-encrypt or rebuild the full save.
- At final Export only: apply the allowlisted edit plan to one detached copy, validate original-to-edited semantic diff, package and re-open the newly encoded save, compare the exact allowed fields and all unrelated data.
- Offer **one download** containing `original` and `edited` files in a ZIP by default (do not compress already encrypted P1G bytes; use ZIP STORE, not a CPU-expensive deflate). Optional single edited file is a future UX choice; preserve prominent original-backup availability throughout.
- Avoid two consecutive browser downloads triggered by one click if browser download policies can block the second. Assess ZIP RAM and peak browser memory on large real saves; cap input sizes and fail safely. The archive itself must not be mistaken for a directly game-importable save; the edited file inside is the artifact.
- No original file is automatically overwritten. Nothing is written at selection time, preview time or diagnostic time. Preserve the session's original bytes until the tab is closed or explicitly replaced.

**Approval scope:** The Phase 1 product intent and Phase 2 research priorities are approved. Phase 3 is a **design proposal**, not approved implementation: explain stages, tradeoffs of two files vs single archive, performance, compatibility and recovery/verification to Owner first. Do not enable actual save edits or public writer without its separate approval and testing.

## Release evidence remaining

1. Confirm exact event families and IDs that genuinely stop/restart spawning when shifted, including behavior of next event processing, object collection, max population and 2126 long-term values.
2. Verify original P1G/ZIP profile JSON is preserved for unchanged portions, including future/unknown fields and metadata. Distinguish source event-definition Protobuf files from the saved P1G JSON document.
3. Compare 626 baseline with newer-save profiles for **exact field-level structural compatibility**; do not demand unconditional exact BID for mere reading.
4. Test each initially supported operation on a disposable Switch save through export, game load, play, resave, complete exit, relaunch and undo/restoration.
5. Only then promote exact field/event IDs from provisional static rules to separately audited writer allowlist.
