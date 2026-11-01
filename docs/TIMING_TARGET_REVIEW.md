# Timing target review contract

The user-facing four-tab layout is stable, but **individual edit targets, exclusions, and operations are not finalized**. This file and `data/timing-review-rules-v1253.json` describe provisional review only. The game runtime and the current save can evolve independently.

## Source of authority

- Game source: Switch DDV v1.25.3, BID `9A239D3DB569756D`, schema `626`; this is the build used to derive the rules, **not** a build identity automatically inferred from an uploaded save.
- DDVRENX SSoT: `DDV_SAVE_TIMING_FIELD_AND_EVENT_REGISTRY`, `DDV_SAVE_TIMING_NATIVE_STATIC_FINDINGS_V1253`, `DDV_SAVE_TIMING_VALIDATION_GATES`.
- Event definitions are v1.25.3, and localized item-name fallback is v1.25.0. They must not be presented as the same data version.
- `revision` in the rules JSON increments when classifications, source evidence or field semantics change. Do not put a new build or schema into the existing v1.25.3 rule file.

## Provisional review states

| State | Meaning |
| --- | --- |
| `RESEARCH_CANDIDATE` | Field type and event's static W1 policy make focused analysis worthwhile; NOT write authorization |
| `CONDITIONAL_REVIEW` | Linked state, fatigue, population limits or native trigger need separate evidence |
| `DIAGNOSTIC_ONLY` | Show recorded time to assist diagnosis; no bulk edit |
| `PROTECTED` | Must not be transformed as a generic timer |
| `HOLD_*` | Current observation is invalid, unproven or structurally ambiguous |
| `UNCLASSIFIED` | No approved evidence mapping yet |

All states have `writerAuthorized=false` and `editedCopyAuthorized=false`. New field kinds are always `UNCLASSIFIED` until added to the versioned rule set. A revised static classification **never** unlocks writing.

## Observations that must remain separate

- A future `NextOccurrence` may be a normal unelapsed schedule. It does not by itself imply save corruption.
- The shared `2126-08-20T00:00:00Z` value was observed 323 times in one save. It has no established authoring or release mechanism and remains excluded from automatic correction. Other distant dates also require investigation.
- `World.Stores[*].LastRefresh` and display refresh times use fatigue and frequency checks: assigning current time may postpone refresh.
- `TreeAndBushData.EndOfLife` is not a growth/harvest target.
- `SnippetSpawning` uses dedicated cooldown / first-actualization paths.
- `MoonStoneChest` is a local spawn timer; server reward claims and limits are outside this tool.
- An event-registry `active=false` record is not silently promoted to an operational write target.
- Initial values such as 2019-01-01 and 1970-era timestamps must not be mass-normalized.

## Future target additions / changes

For each candidate, capture the save's exact field path, protobuf declaring message and field number, Item ID versus RecurringEvent ID namespace, originating BID and SHA, native reader and writer entry points, population/quest/linked-state requirements, error modes, and cold-load/relaunch outcomes. Run unchanged-save serialization preservation checks separately. Promote only a specific, narrow operation behind a **new** writer capability gate after independent static and actual console acceptance; do not edit this reader rule set to grant permissions.

No file changes, encoded copies or save modifications occur in this module. The original save backup remains byte-identical.

## Save-wide read-only timing audit (2026-11-02)

`src/timing-audit.mjs` reports the saved timing distribution without treating any future timestamp as proof of corruption or a repair target. It consumes the *same immutable projection* and field-rule review result that the Worker uses for the individual rows, and shares one observation clock with the reader. Its `timingAudit` output groups rows into elapsed/past, ordinary future, exact shared 2126 instant, other distant future, and invalid time. Date strings representing the observed `2126-08-20T00:00:00Z` instant with an all-zero fractional suffix are treated identically; nonzero fractions are not silently merged. Records without a valid supported time remain nonwritable.

For recurring events, the audit counts rows with the shared 2126 instant, their distinct native event variants and mapped world groups, unknown event definitions and conflicting serialized oneof structures. A multi-type pattern is an **observed coincidence across source categories**, not proof of a game-internal sentinel design or of the underlying cause. The report does not contain raw personal identity, player names, full raw profile data, or permissions to edit; it is generated locally in the Worker. Event-specific evidence and source build still require independent review.

`autoRepairAllowed`, `writerAuthorized`, `shared2126.originVerified`, and `shared2126.releaseMechanismVerified` are always false. `sourceBuildVerified` also remains false because save schema equality alone cannot prove Switch BID or executable identity. A normal future `NextOccurrence` is not called corruption, and legacy 2019/1970 values are not mass-reset.

The UI shows a collapsible localized count summary in the details panel, preserving keyboard focus and read-only operation. It opens by default only when a shared 2126 value, another distant date or invalid date is present. All counts are derived from a synthetic testable projection and cannot modify the original bytes or produce an edited save.

**Remaining blockers:** source of the 2126 shared value, event release mechanism and pickup/removal call path, console cold-load evidence, format-preserving unknown-field round-trip and source build fingerprint checks. The audit deliberately does not claim these have been solved.
