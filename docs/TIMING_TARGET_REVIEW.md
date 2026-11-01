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
