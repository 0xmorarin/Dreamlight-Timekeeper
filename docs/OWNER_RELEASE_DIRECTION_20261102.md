# Owner-approved Timekeeper release direction — 2026-11-02

Status: **OWNER-APPROVED PRODUCT AND PHASE 3 CORE DESIGN / IMPLEMENTATION AND VALIDATION PENDING**. This document supersedes the earlier future-time-as-anomaly emphasis and superseded ZIP export proposal. No writer or edited-save download is enabled by this documentation change.

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

## Date presets — owner approved, gameplay semantics separately gated

Core preset buttons are **Now**, **100 years ahead**, and **Game release date**. The release date is the original Early Access start **2022-09-06**, according to Disney/Gameloft; this is distinct from the game's formal post-Early-Access launch **2023-12-05**. Treat this as a date preset, not a claim that the game launched exactly at midnight UTC. The preset's timezone/local-time convention and rounding will be explicit and tested, with an option to refine time of day; it must not imply the reactivation of expired online events or reward entitlements.

"100 years ahead" means relative to **one frozen present-time snapshot** on the chosen action, with a deterministic calendar-year policy (including February 29 and DST behavior) instead of blindly adding a fixed number of milliseconds. For each selected eligible field, the same target time is applied in one preview/commit batch. Any chosen future value is intentional; no arbitrary threshold or 2126 observation should disable an otherwise proven write operation. Individual fields remain gated on actual source semantics.

## Phase 3 core session and final export — OWNER APPROVED

- The browser-local input original is held unchanged; decode/parse once per opening.
- During editing, keep a **minimal field-level plan and Undo/Redo** only. Do not serialize/recompress/re-encrypt the whole save for each edit.
- At final export, validate the selected exact path/ID/version-conditioned allowlist and original values, apply changes to an isolated copy, compute precise diff, encode/repack only once, reopen and compare all unrelated fields; fail closed on any mismatch. Before that, *no* save writing.
- **DO NOT PACKAGE BOTH FILES INTO A ZIP.** Owner rejected the ZIP proposal for convenience. When final output passes verification, offer **one action that attempts both separate downloads**: untouched source backup and edited artifact (trigger original backup first; browser multiple-download policies may block the second). Provide a visible individual retry/download button for each already prepared file. Keep prepared blobs in memory only for the user session, with sensible size caps, and do not re-encode just to retry a download. Do not claim two downloads are guaranteed by browsers.
- Edited output and source backup remain independent objects; source is byte-identical to uploaded input. Record source hash and edited hash for validation; user-facing archive download is not required. No server upload/telemetry.
- A **possible direct-input-file overwrite mode** is a separate feasibility backlog, NOT APPROVED for initial release. Ordinary `<input type=file>` cannot write through to the user's disk path. A capable HTTPS browser may offer File System Access handles with explicit permission; when available, get user consent and a verified backup before any direct overwrite, detect edit/reload failures, and fall back to separate downloads. Web page code cannot directly replace protected Nintendo Switch save storage.
- Memory/performance tests must reflect Wand's existing decoded >10MB owner observation and 25/50/100/200MiB planning envelope; Worker owns parsed state, and UI receives only needed rows/summaries. Optimize duplicate buffers and encoding only after measurement; do not claim theoretical memory guarantees.

**Approval boundary:** Owner approved the lightweight one-decode, staged field edits, final-one-encode independent validation core and separate-file export design. These are implementation mandates, NOT proof that existing `SafeProfileEditSession` is a verified v1.25.3 writer, and NOT permission to enable real output before save preservation and Switch acceptance.

## Additional independent world-editing backlog — not ordinary timer edits

1. **Area-scoped one-click removal of auto-spawned activity GridObjects** (obstacles, wild herbs/spices, branches/wood, flowers etc.). First map source event/ItemID to actual spawned GridObject, verify area/root/subgrid scope, distinguish quest objects, player-placed objects, mission spawn history, reference dependencies and rescheduling. Soft deletion/undo and source-state preservation need independent proof before allowing any bulk delete.
2. **Move the already spawned Moonstone Chest in front of the original player's house, main Valley scope.** Interpret Moonstone as the existing chest object, not currency balance or online reward claim editing. Wand 01B and DDV_PLAYERHOUSE_SAVE_MODEL_v1.24.13 establish `PlayerHouseIndex=0` as original interior but *not* a unique global entrance or fixed position. Resolve the actual main Valley exterior GridObject, placement grid, usable coordinate/footprint and collision constraints; preserve object identity and conditional-event references and test resave/restart. Different from forcing a new chest spawn.
3. **Wand-first shared research rule**: search DDVRE/Wand canonical Save 01A, World 01B, Game DB 01D, Runtime 01E and PlayerHouse/Grid transaction research before doing any new static analysis. Add verified missing facts to the shared DDVRE/00_PROJECT index at https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit; Timekeeper's Drive docs and this repository link to it instead of copying originals. Future Wand integration consumes versioned contracts after its own independent gates; do not change Wand production write authorization.

## Release evidence remaining

1. Confirm exact event families and IDs that genuinely stop/restart spawning when shifted, including behavior of next event processing, object collection, max population and 2126 long-term values.
2. Verify original P1G/ZIP profile JSON is preserved for unchanged portions, including future/unknown fields and metadata. Distinguish source event-definition Protobuf files from the saved P1G JSON document.
3. Compare 626 baseline with newer-save profiles for **exact field-level structural compatibility**; do not demand unconditional exact BID for mere reading.
4. Test each initially supported operation on a disposable Switch save through export, game load, play, resave, complete exit, relaunch and undo/restoration.
5. Only then promote exact field/event IDs from provisional static rules to separately audited writer allowlist.
