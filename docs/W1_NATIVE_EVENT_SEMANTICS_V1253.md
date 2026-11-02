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
| `Profile.ActualizeRecurringEvents` | `0x05A2A170` | Interface slots GetMaxIntervalToFullyExecute=6, context Now=0, NextOccurrence getter=1, setter=2; for overdue schedules with a bounded maximum: at `0x05A2AE20` SUB, `0x05A2AE24` CMP, `0x05A2AE28` B.LE; correction invokes DateTime subtraction `0x05A2B434`, Timestamp conversion `0x05A2B470`, and virtual NextOccurrence setter `0x05A2B534` | Future-date setter origin; every event variant's catch-up policy |
| `ItemSpawning.GetMaxIntervalToFullyExecute` | `0x057C0140` | Interval and minimum/maximum-based overdue catch-up bound | Exact result for each ID and area |
| `ItemSpawningRecurringEventItemData.GetMaximumAmount` | `0x047AB7F0` | Base maximum, optional area selector references | Actual world population/cap enforcement |
| `ItemSpawning.Execute` completion side (entry RVA still unresolved) | `0x057BF058` / `0x057BF068` / `0x057BF0C4` | `Timestamp.FromDateTime`, store to `LastOccurrence` at IL2CPP offset `+0x30`, then BL `Reschedule` | Exact entry RVA, generation success/skip condition, pickup callbacks |\n| `FlowerSpawningInVillage.Execute` | `0x057C99E0` | BL `IsReadyForNextOccurence` then TBNZ readiness branch | Spawn allocation, existing caps, event-specific reschedule and collection |

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

Additional reused detailed originals: [Native Follow-up 3](https://drive.google.com/file/d/1u1yqHNNWpre2aUv2zMwK9S_Q9uHQeEQP/view), [Actualize and Spawn Recovery](https://drive.google.com/file/d/17JrRAVkslcAuq62wvy8RpzJvZuxeGyVD/view). The repeated-action path initializes a counter to 100 at 0x05A2AFC4, but the post-action decrement/test order does NOT independently establish exactly 100 executions. No hard cap is asserted here.


## Round 2 — Predicate/Consumer audit and corrected evidence provenance (2026-11-02)

The original Native research artifact [DDV_v1253_Actualize_Catchup_Flow_Evidence_20261101.json](https://drive.google.com/file/d/1gfP_zlVoyjnejn8e6WIgoSv5F7I7rDc5/view) binds **main** SHA-256 `16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a` and **decompressed NSO text** SHA-256 `15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328` to the existing static flow. They are different hashes and must never be interchanged with BID `9A239D3DB569756D` or save schema626. Reused records were NOT regenerated by opening the main executable in Round 2.

### NEW: source metadata contradiction at 0x05A2AC94

The artifact reports `RVA 0x05A2AC94`, opcode `0xB002B8C8`, text `mov x25, x0`, interpreted as storing `GetMaxIntervalToFullyExecute` into X25. Independent decoding of **the provided 32-bit opcode**, using LLVM's AArch64 disassembler, produces **`adrp x8, ...`**, not `mov x25, x0` (the latter register alias encodes `0xAA0003F9`). This establishes an **EVIDENCE_METADATA_CONFLICT**, NOT proof that the actual game executable contains either instruction at that RVA. The original source may contain an annotation or address transcription error. Re-fetch the version-matched main and independently re-check bytes at 0x05A2AC94 and the actual X25 def-use path before marking the maximum-time argument setup exact. This dispute does **not** automatically invalidate the independent 0x05A2AE20 SUB / 0x05A2AE24 CMP / 0x05A2AE28 B.LE opcode sequence or the later arithmetic/callsite facts, but it prevents an unqualified claim about X25 initialization at the disputed address.

### Independently checked *artifact-opcode* examples (NOT a binary SHA revalidation)

| Source RVA | Artifact opcode | Decoded instruction/target | Supports | Would falsify / remaining gap |
| --- | --- | --- | --- | --- |
| `0x05A65640` | `0xEB09011F` | `cmp x8, x9` | Readiness comparison | Need predecessor assignments for X8/X9 for every consumer |
| `0x05A65644` | `0x1A9F37E0` | `cset w0, hs` | Unsigned comparison result | Other guard conditions/expiry and amount are separate |
| `0x05A2AE20` | `0xCB090108` | `sub x8, x8, x9` | Overdue delta | Verify predecessor tick masks and X25 def-use |
| `0x05A2AE24` | `0xEB19011F` | `cmp x8, x25` | Comparison against X25 | Actual provenance of X25 is disputed above |
| `0x05A2AE28` | `0x540006CD` | `b.le 0x05A2AF00` | Correct branch destination for no correction when delta <= bound | Other paths and loop re-entry not exhausted |
| `0x05A2B434` | `0x9428864F` | `bl 0x0644CD70` | DateTime subtraction in correction arm | Only conditional arm, not proof it ran |
| `0x05A2B50C` | `0x52800042` | `mov w2,#2` | Setter interface-slot constant | Requires dispatch target resolution |
| `0x05A2B534` | `0xD63F0100` | `blr x8` | Virtual call (context says setter) | Target cannot be inferred from BLR alone |
| `0x057BF0C4` | `0x940CCD03` | `bl 0x05AF24D0` | Direct ItemSpawning completion→Reschedule | Does not establish when completion arm is entered |
| `0x05A2AFF4` | `0x34FFB07C` | `cbz w28, 0x05A2A600` | Post-action zero check against old W28 | Does NOT prove an exact 100-transaction cap |

The only independently checked object was the **recorded instruction word**; without a fresh SHA-checked original main, this is not a new executable-level confirmation. The recorded full NSO text still needs byte-for-byte revalidation. `src/timing-native-semantics.mjs` retains the conflict as `actualizeSourceConflict.status=EVIDENCE_METADATA_CONFLICT` and does not promote runtime evidence.

### Native branch-condition model, explicitly less than runtime behavior

`analyzeW1StaticBranches(ledger, {eventId,saveKind,nowTicks,nextOccurrenceTicks,maxIntervalTicks})` evaluates two static predicates only: conditional `nowTicks >= nextOccurrenceTicks` and conditional `nowTicks - nextOccurrenceTicks > maxIntervalTicks`. Operands must be non-negative `bigint` within the 62-bit masked-tick domain evidenced by `0x05A2AE18/1C`. Missing effective `maxIntervalTicks` yields `overdueClampCondition=null`; no arbitrary interval is invented. The function does NOT know whether the real event called Actualize, reached readiness, passed IsEventOver, allocated objects, saw any Area/Grid counts, rescheduled or survived cold restart. This is **STATIC_PREDICATE_MODEL_ONLY**, not a Native scheduler emulator. Source status `SOURCE_VARIANT_HINT_ONLY` is prerequisite; all protected, mismatched, inactive or unknown IDs are excluded. All operational/write flags remain false.

| Model input (hypothetical relative ticks) | Conditional readiness | Conditional overdue correction | Unsupported inference |
| --- | --- | --- | --- |
| Now=1,000,000; Next=2,000,000; max=300,000 | false | false | Does not prove all other spawn paths suppressed |
| Now=1,000,000; Next=1,000,000; max=300,000 | true | false | Does not mean an item actually spawns immediately |
| Now=1,000,000; Next=700,000; max=300,000 | true | false (strict >) | Does not prove future reschedule or counts |
| Now=1,000,000; Next=699,999; max=300,000 | true | true | Does not prove the correction arm was reached or persistence |
| Any valid Now/Next; max unknown | conditional | unknown | Do not infer effective max from source interval alone |

### Call-graph frontier, source truth versus missing links

- `IsReadyForNextOccurence` is a verified predicate method. The existing FlowerSpawningInVillage.Execute RVA 0x057C99E0 has a readiness BL + TBNZ path. There is NO complete exact Execute entry or readiness callsite evidence for ItemSpawning, WildCropsSpawningInVillage, or FishSpawningInVillage in the consulted canonical reports; their use of the common predicate remains a target for native call-graph proof.
- `Profile.AddRecurringEvent` is one of ten existing **direct BL** `Reschedule` callers, while nine are `Execute` methods. The complete AddRecurringEvent callsite RVA, full nine per-kind caller map, and all virtual/indirect callsites remain UNKNOWN. `ItemSpawning.Execute` has a known completion-side direct call at 0x057BF0C4, preceded by storing LastOccurrence at 0x057BF068. **No direct pickup/removal→Reschedule BL** was found in the prior full-text scan; this proves only absence from those direct references, not absence of indirect callbacks or other setters.
- The only evidenced `GetMaximumAmount` special area-selection references are the existing TimeBending HOLD IDs `2010000093→2010700002` and `2010000120→2010700004`. This is **not** a general Area spawn-cap equivalence or evidence that any per-Area Grid count equals the source `MaximumAmount`. Existing field offsets for native `GetMaxIntervalToFullyExecute` use min spawn, amount and max interval, but the per-event allocation path/cap checks have not been followed.
- `firstActualize` treats Snippet (oneof case 12) separately: prior static TBZ/CMP/B.NE/B.EQ path around `0x05A2AB70–0x05A2ABC8`. Its W2 state must not inherit a W1 model or an ordinary item catch-up calculation.

### Event-specific unresolved gate / independent test specification

| Event ID | Static classification | Known boundary | Required falsification / console scenario (future, not executed) |
| --- | --- | --- | --- |
| `2010000003` | active W1 NightThorn, ItemSpawning source hint, TimeOfDay | Amount/catch-up helper exists; actual Grid count UNKNOWN | Save baseline thorn IDs/counts; change only NextOccurrence after independent Writer gate; run Next=Now vs future with already-spawned thorns; compare after cold restart |
| `2010000021` | active W1 Softwood; source ItemID `31700014`; Duration | Event ID vs GridObject identity not proved | Reproduce under empty/full wood cap; test pickup before/after chosen time; track same Area/Grid and IDs, including indirect references |
| `2010400001` | active W1 UrbanWildCrop; linked seed ItemID `30400121` | Linked seed is not proof of actual sprout GridObject.ItemID | Snapshot concrete spawned weeds/herbs and compare Area/Grid before/after re-actualize; verify quantity cap, lifecycle, restart |
| `2010500008` | active W1 UrbanDandelion; linked ItemID `30800059` | Execute readiness path known, allocation/count unknown | Compare flowering already populated vs manually cleared area and check if NextOccurrence is overwritten on harvest/removal |
| `2010200014` | FishSpawning source candidate, inactive definition | No execution eligibility established; not active W1 | Distinguish current-version disabled event from any alternate fishing ripple scheduler before testing |
| `2010000064` | MoonstoneChest, REPAIR_ONLY | Claim/reward caps separate from local schedule | NEVER include in ordinary W1 experiment; separate protected online acceptance |
| `2010000093` / `2010000120` | TimeBending HOLD / ChooseVillageArea-derived maximum | Native selection references exist, but wrong event family | Remain excluded; do not treat as ordinary Area cap or spawn timer |
| `2011300000` | Snippet W2 | FirstActualize special case / trap state / 24-hour path | Separate W2 research; never covered by W1 tests |

No raw game binary, original save, decrypted private data, console tests, edit bytes or new Writer permissions are included in these Round 2 results. 05 QR should reject any interpretation that elevates a static predicate to a game/runtime PASS or ignores the upstream opcode conflict.
