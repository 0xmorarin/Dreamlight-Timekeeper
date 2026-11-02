# 02 TIME — W1 Offline Native Evidence and Wand Rust Research DTO Parity

**Date:** 2026-11-03. **Evidence:** STATIC_ONLY / SYNTHETIC_TESTED when dedicated CI passes. **NO** product Writer, Rust SemanticCommand implementation, independent P1G Codec, SaveSession fork, Grid deletion, Moonstone relocation or actual save modification.

## Reused authoritative evidence and exact build

Read the latest [DDV shared research SSoT](https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit), Wand 01A/01B/01D/01E, [original W1 Native evidence ledger](W1_NATIVE_EVENT_SEMANTICS_V1253.md), TIME PR #7 and PR #20. No broad re-disassembly. Exact original private Switch v1.25.3 NSO rehashed locally: original `main` SHA256 `16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a`; independently decompressed NSO text SHA256 `15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328`; BID `9A239D3DB569756D`. Existing version matched `dump.cs`. This re-confirms build fingerprint; it does not attest a different profile's build or native runtime.

The 508 source recurring definitions have manifest `rawEventSHA256=028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea`. Its EventID, linked ItemID, saved Index, serialized oneof, generated GridObject/PendingFish ID and a transaction Request EventID are distinct.

## Exact static instruction recheck (same SHA, not a new execution result)

| RVA | AArch64 instruction word | Native meaning bounded by static code |
| --- | --- | --- |
| `0x060AA13C` | `97FE8E25` | `Client.SetProfile` state machine BL to `Client.WaitForRecurringEvents` RVA `0x0604D9D0` |
| `0x0604E65C` | `94000045` | enumerator BL to `WaitForNextOccurrence` RVA `0x0604E770` |
| `0x060B5188` | `F9407A7A` | loads `Client.Clock` +0xF0, not online/portal clock |
| `0x060B53F0` | `97EBFD58` | BL to `Clock.Appointment` ctor `0x05BB4950` |
| `0x060B5E7C` | `B9002288` | stores `ExecuteRecurringEvent.Request.RecurringEventID` at +0x20 |
| `0x060B5F30` | `97D6A3D8` | BL to `ExecuteRecurringEventAsync` `0x0565EE90`: request issuance, NOT success |
| `0x0604EA34/0x0604EA3C` | `39474268/340000E8` | `OnRecurringEventRescheduled` can bypass processing with block flag +0x1D0 |
| `0x05A2A0F0` | `528007C2` | creation-path `Profile.AddRecurringEvent` slot62; not a universal setter broadcast |
| `0x057BF058/0x057BF068/0x057BF0C4` | `97974416/F8030D00/940CCD03` | `ItemSpawning.Execute` separately stamps LastOccurrence then invokes Reschedule `0x05AF24D0` |
| `0x0091C620` | `955CC4EC` | an additional BL to WaitForRecurringEvents; calling function still UNKNOWN |

The Client path is: saved subtype NextOccurrence -> typed wait -> local Clock.Appointment -> EventID-bearing transaction Request. It does **not** prove the authoritative transaction dispatch, subtype mutation success, object allocation, save write or automatic re-arm after disk modification. `Profile.ActualizeRecurringEvents` has conditional overdue catch-up/max-interval and `IsEventOver` guards; there is no evidence of unconditional normalization of all future dates or unconditional retention of overdue values on load. W1 field setters contain no inherent slot62 broadcast. Running appointments need not reread changed disk values.

## W1 offline meaning matrix

All four serialized W1 subtypes have `RecurringEventItemID` (+0x18), `NextOccurrence` (+0x20) and `EndDate` (+0x28). Only ItemSpawning also has `LastOccurrence` (+0x30). JSON patch is restricted to `/World/RecurringEvents/<actualSavedIndex>/<variant>/NextOccurrence`. Synthetic saved Index 7 below is NOT evidence of the actual Owner save's index.

| Example source-only EventID / W1 subtype | Native Execute / Reschedule BL RVA | Related state and unresolved runtime effects | Edit intent |
| --- | --- | --- | --- |
| `2010000021` ItemSpawning | `0x057B9BC0 / 0x057BF0C4` | Area, ConditionsList, GetMaximumAmount and owner-grouped Grid count; LastOccurrence separately updated. Effective Grid population, pickup/removal, transaction outcome UNKNOWN | Static candidate if actual saved oneof/Index/old value verified |
| `2010400001` WildCropsSpawningInVillage | `0x057C2BC0 / 0x057C4260` | Area.ShouldSpawn, bounded CountTillMaximumAmount, SetupGardenProduction; harvested garden/conditional refs UNKNOWN | Static candidate only |
| `2010500008` FlowerSpawningInVillage | `0x057C99E0 / 0x057CAE58` | Grid.TryGetGrid, TryPlaceFlowers, flower maximum; actual successful count and removal/restart UNKNOWN | Static candidate only |
| `2010200014` FishSpawningInVillage | `0x057C6890 / 0x057C7110` | Area/water-body number, pending-fish count and AddPendingFish (not proven GridObject). No direct common readiness BL in Execute. **All 46 reviewed source Fish definitions inactive** | **DENY** |

Existing static overdue cap formulas: Item interval × trunc(GetMaximumAmount / MinNumberOfSpawn); WildCrops interval × trunc(GetMaximumAmount / NumberOfGardensToSpawn); Flower interval × trunc(MaximumAmount / NumberOfFlowersToSpawn); Fish interval × MaxNumberOfPendingFishes. These are **not** definitive in-game generated object counts or a general restriction on valid future UTC dates.

## Offline validation and cross-language witness comparison

- Confirm original source SHA and explicit Switch BID/schema separately; load profile/schema626 from immutable bytes. Compare source EventID, actual saved Index, exact oneof, source-active W1 policy, linked ItemIDs and exact old field with snapshot. Re-check old timestamp by decoded UTC **and raw lexical JSON token**; escaped `\\u0032` may decode to the same 2126 time. Separate encrypted P1G SHA, decoded JSON SHA, registry source SHA and build identity; do not substitute any of them.
- Presets `2022-09-06T00:00:00Z` and intentional `2126-08-20T00:00:00Z` (and 2127) are valid synthetic values, not damage or automatic repairs. Broad RFC3339/Native DateTime game scheduling compatibility remains operation-specific.
- New pinned Wand crate test-only binary calls **actual** `p1g::encode_synthetic_fixture` and `w1_evidence::inspect_w1_source_research`, never clones or reimplements either. JS separately calls `projectW1RustAdapterOracle` with the actual 508-event registry and versioned Native ledger. Rust fixture registry is deliberately synthetic and NOT authoritative; the Rust StructuralWitness explicitly reports registry semantics, Native semantics, reference completeness and EncodeCopy authority **false**. A protected or inactive EventID can pass *structural* Rust witness yet be **DENIED** by JS meaning oracle; this is intentional layering, not parity failure.
- Negative fixtures cover Index/EventID/oneof mismatch, duplicate oneof, stale old time, three SHA separation, external BID, no-op, protected Moonstone `2010000064`, TimeBending `2010000093/2010000120`, Quest/DLC, W2 Snippet `2011300000`, all 46 inactive Fish, unknown kind. Every mixed protected batch denies. Synthetic Inventory/Grid/Quest rows verify W1 scope excludes other paths; **do not claim** complete domain ReferenceIndex or mixed transactional operation authority from this test.
- No real Owner schema626 save was accessed here. Wand 01E's prior REAL_SAVE_READ_ONLY acceptance applies only to its private controlled read-only report, not to these synthetic EventID/Index examples or any edited copy. Any actual V2 offline one-field P1G edited copy belongs to 01 CORE, with original immutable, exact selected delta, independent reopen and unknown/reference preservation.

### Cross-stream finding: pointer-only plan is not trusted intent binding

Parallel 02 TIME Draft PR #36 independently observed an important limitation in the **existing, unchanged** JS interface: it only receives a canonical pointer, an old UTC timestamp and a new UTC timestamp; if the caller accidentally switches to **another valid W1 pointer**, the lower-level checker can return a structural candidate **for that other EventID**. This does not mean the intended original EventID was bound. PR #37 tests the gap against **actual Wand Rust W1Identity**: requesting saved index 8 + Flower oneof with an expected *ItemSpawning* EventID yields Rust `W1_SAVED_EVENT_ID_CAS_FAILED` even though a pointer-only proposal for the legitimate Flower EventID is individually structurally valid. An eventual production SemanticCommand MUST carry separately verified requested EventID, saved Index, oneof and pointer, plus original source/revision and old value CAS, rather than inferring user intent from the pointer. No existing JS Writer permission is inferred or expanded.

## Exactly which runtime questions remain

1. Load/restart: observe verified EventID/oneof, original NextOccurrence, `Profile.ActualizeRecurringEvents` entry/guards, `SetProfile` WaitForRecurringEvents, `Client.Clock` appointment, event CTS/cancellation and block flag; distinguish fixed saved 2126 from an overdue timer clamped on actual load. Does the post-load *saved* value change?
2. Authoritative transaction: match Request.RecurringEventID to server/transaction dispatch and subtype Execute, record result/denial and actual save mutation; Client async issuance alone does not prove success.
3. Object effects: measure actual Area/Grid/DiffGrid/ConditionalEvent links, quota, ItemSpawning LastOccurrence, WildCrops/Flower produced objects, Fish PendingFish, removal/pickup without edit and cold-reload. A timestamp-only edit does **not** clear existing Grid objects.
4. A physical console observation is warranted ONLY if these precise native/save-state outcomes cannot be resolved offline; no universal hardware block for research, tests or isolated offline copies.

**Fail closed:** no W1 product writer or Rust SemanticCommand product binding until CORE supplies accepted stable semantic API and QR operation-specific acceptance. No GridObject delete, Moonstone move, online grant, direct source overwrite, ZIP bundle or auto-2126 correction. The existing Owner report is aggregate OWNER_REPORTED_RUNTIME_CONFIRMED, not EventID-level RUNTIME_TESTED.


## Cross-stream real-save V2 receipt (2026-11-03; CORE-owned, not rerun by TIME)

01 CORE isolated Wand [Draft PR #329](https://github.com/DreamwishWand/web/pull/329) (parent PR312 at c6b152512d3bc901fd1474dbcfcb07253ae1b347; HEAD d4d1c17e77d9e8741efc7849330a0351aec699e8) reports **private offline** v1.25.3/schema626 immutable original SHA and supported ZIP metadata matched the established 01E original. A private Python no-op AES/ZIP rebuild and independent Node reopen passed; one **actually observed ItemSpawning NextOccurrence** field in an isolated copy was changed with exact old-value CAS, unrelated decoded bytes unchanged and independent Node reopen passed. No original or edited actual save, key, private metadata or personal data is part of this TIME PR. This is **OFFLINE_COPY_VERIFIED by 01 CORE's private Python+Node scope**, not a new TIME execution/test and not accepted real-save cross-codec Rust/WandJS/TimekeeperJS parity. The exact saved EventID/Index, change request and Native state were not provided to this TIME branch; **therefore this document does not elevate the above synthetic ItemSpawning ID 2010000021 to a verified real-save event identity**. Native completion, load-time actualization, in-game spawned Grid/DiffGrid and related reference effects remain independently UNKNOWN. Coordinate offline W1 V3 on non-sensitive redacted source identity/oneof and before/after field-only fingerprints with CORE; no user-save data transfer and no blanket physical Switch stop.
