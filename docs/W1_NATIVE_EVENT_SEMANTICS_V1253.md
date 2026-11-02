# 02 TIME — W1 per-event Native semantics ledger (Switch v1.25.3)

**Evidence class: STATIC_ONLY.** This document does **not** claim Nintendo Switch runtime acceptance, save write compatibility, a native timer setter, or automatic GridObject delete/move permission.

## Fixed provenance and reuse

- Version: Nintendo Switch v1.25.3; BID `9A239D3DB569756D`; **main executable SHA-256** `16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a`. BID, executable hash and save `GameInfo.Version=626` are different identities.
- Source: `RecurringEvent.json` framed Protobuf SHA-256 `028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea`; reused normalized **508** records from `data/events-v1253.json`. The normalized JSON's source SHA field is a provenance claim, **not an independent rehash of the executable or raw Protobuf**.
- Native SSoT: [DDV_SAVE_TIMING_NATIVE_STATIC_FINDINGS_V1253](https://docs.google.com/document/d/1jdxyDMUDwukNfIzCNk_G4AZ0ATIWV27Ovefd0qP7efA/edit). Field SSoT: [DDV_SAVE_TIMING_FIELD_AND_EVENT_REGISTRY](https://docs.google.com/document/d/18iFQJroXQ2lCIf4aElFrQV7Z-wSzwyXlJpRDpnYG0Ao/edit). Shared [Wand-first reuse register](https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit).
- 01D's 244/244 byte-identical linked item definitions and verified `isWood` tag are **consumed** from `data/wand-iswood-crosswalk-v1253.json`, not recalculated. 01A progression-reference graph and 01B Grid identity/dependency contracts remain authoritative for objects and ConditionalEvent references.

## Native evidence ledger (all RVAs scoped ONLY to the fixed executable)

| Mechanism / consumer | RVA | Observed STATIC_ONLY evidence | Missing proof |
| --- | --- | --- | --- |
| `IsReadyForNextOccurence` | `0x05A65440` | `CMP` and `CSET HS` time-eligibility predicate | All callsites, side effects, any alternative readiness gates |
| `IRecurringEventExtensions.Reschedule` | `0x05AF24D0` | 10 direct BL callsites in reviewed binary: 9 Execute, 1 AddRecurringEvent | Indirect calls; pickup/remove/restart path |
| `IsEventOver` | `0x05AF3050` | Separate expiration test | EndDate conditions per event |
| `Profile.ActualizeRecurringEvents` | `0x05A2A170` | For overdue schedules with a bounded maximum: at `0x05A2AE20` SUB, `0x05A2AE24` CMP, `0x05A2AE28` B.LE; correction invokes DateTime subtraction `0x05A2B434`, Timestamp conversion `0x05A2B470`, and virtual NextOccurrence setter `0x05A2B534` | Future-date setter origin; every event variant's catch-up policy |
| `ItemSpawning.GetMaxIntervalToFullyExecute` | `0x057C0140` | Interval and minimum/maximum-based overdue catch-up bound | Exact result for each ID and area |
| `ItemSpawningRecurringEventItemData.GetMaximumAmount` | `0x047AB7F0` | Base maximum, optional area selector references | Actual world population/cap enforcement |
| `FlowerSpawningInVillage.Execute` | `0x057C99E0` | BL `IsReadyForNextOccurence` then TBNZ readiness branch | Spawn allocation, existing caps, event-specific reschedule and collection |

**No complete `Execute` RVA is evidenced by the current canonical static report for ItemSpawning, WildCropsSpawningInVillage or FishSpawningInVillage.** `ItemSpawning.Execute 0x057C...` is incomplete and must not be normalized into an exact address or ported to a later build.

## Per-kind source/native contract

| Saved event variant | Source example (Event ID) | Source-family meaning | Native result | Current status |
| --- | --- | --- | --- | --- |
| `ItemSpawning` | `2010000003` NightThorn; `2010000021` Softwood | Obstacles/material source hints | Scheduling/max amount/catch-up helpers exist; full Execute/instance lifecycle untraced | STATIC_ONLY; source variant hint is NOT a confirmed native event-ID dispatch |
| `WildCropsSpawningInVillage` | `2010400001` UrbanWildCrop | Wild crop/herb source hint | Universal readiness known, this variant's Execute path not proven | STATIC_ONLY, native consumer UNKNOWN |
| `FlowerSpawningInVillage` | `2010500008` UrbanDandelionYellow | Flower source hint | Execute readiness call/branch STATIC observed | STATIC_ONLY; generation, pickup, respawn not verified |
| `FishSpawningInVillage` | `2010200014` MeadowFishSpawning | Fishing ripple source hint, **active=false** definition | This variant's Execute path not proven | Source definition INACTIVE; no automatic W1 promotion |

Source `eventPolicy=W1`, `active=true` and a matching source-family hint are **not** native dispatch proof, an operational allowlist, or validation of the event's appearance in a particular save. An event's precise runtime event ID/variant association needs native and schema evidence.

### Mandatory exclusions and identity boundaries

- Event `2010000064` MoonStoneChest is `REPAIR_ONLY`, even though it uses an ItemSpawning schedule; claim limits/server reward state are independent and **protected**.
- Event IDs `2010000093` and `2010000120` use `UseChooseVillageAreaMaximumAmount` references to `2010700002` and `2010700004`; both source records are **HOLD / TimeBending** and must not become W1 spawn candidates because an amount helper references them.
- `2011300000` Snippet is W2 and `SnippetSpawning.CalculateNextCooldown` RVA `0x0580F290` has a separate trap/24-hour-count path. Do not apply normal ItemSpawning rules.
- Source `Event ID`, source-linked `ItemID`, and saved `(GridID, GridObject.ID)` are different. ItemID equality does not prove spawn origin. `ConditionalEventHistory.ActiveEvents/*/SpawnState/SpawnedObjects/*` is an active GridObjectAddress identity veto in existing Wand 01A evidence.
- `World.RecurringEvents/*/*.EndDate`, quest state, DLC entitlement, store fatigue, TimeBending, Snippet and inactive definitions are not covered by a four-kind static W1 suggestion.

## Now / +100 years / pickup / cold reload: what the evidence says

A `NextOccurrence` moved far ahead is **not automatically corrupt**. The overdue clamp applies to overly old scheduling, and does not establish a generic reset of scheduled future dates. The Native readiness predicate by itself is **not proof** that setting Now immediately spawns an object, setting +100 years suppresses every generation mechanism, pickup causes rescheduling, or a cold restart preserves the desired behavior. All remain **UNKNOWN** as operational guarantees. Already spawned objects are not removed by a schedule edit without a separate, validated mechanism.

One existing owner sample contains 323/468 shared `2126-08-20T00:00:00Z` entries, many intentionally used for decorating. The original setter and release lifecycle are not established; no automatic repair or anomaly flag may be inferred.

## New machine-readable contract and negative tests

`src/timing-native-semantics.mjs` consumes existing normalized event definitions and the verified Wand tag crosswalk; `tests/timing-native-semantics.test.mjs` tests exact source identity, all 508 event IDs, W1 source-family hints, inactive fishing, Moonstone, W2, TimeBending amount exceptions, unknown/mismatched saved variant, independent native method evidence, immutability and false writer/deliverability gates. The interface explicitly returns `SOURCE_VARIANT_HINT_ONLY` rather than native variant confirmed and never modifies user data or authorizes exports. The source build SHA is informational and **not attested from any loaded profile**.

## Further evidence required before semantic promotion

1. Extract version-matched method call/callee chains for each complete W1 Execute, readiness, Reschedule, AddRecurringEvent, pickup/remove, and grid allocation. Verify each RVA/instruction against the exact main SHA.
2. Build per-event-ID conditional and capacity matrix: item/source type, Area/Grid placement, active GridObject provenance, maximum/minimum, quest/DLC dependencies, event history, repeat/catch-up.
3. Controlled disposable-console scenarios: record baseline world + timestamps; test deliberate Now/+100y, presence of already spawned items, collection before/after change, save/exit/restart, then validate spawn/cap effects and resource integrity. Source-only tests cannot replace console testing.
4. Independently reconcile 01 CORE's per-operation Codec/ZIP/serialization and 05 QR's release gates. Until accepted, **all Writer, edited export, Grid delete and Moonstone move capabilities remain false**.
