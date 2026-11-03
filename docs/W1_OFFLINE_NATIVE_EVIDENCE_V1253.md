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

01 CORE isolated Wand [Draft PR #329](https://github.com/DreamwishWand/web/pull/329) (parent PR312 at c6b152512d3bc901fd1474dbcfcb07253ae1b347; HEAD d4d1c17e77d9e8741efc7849330a0351aec699e8) reports **private offline** v1.25.3/schema626 immutable original SHA and supported ZIP metadata matched the established 01E original. A private Python no-op AES/ZIP rebuild and independent Node reopen passed; one **actually observed ItemSpawning NextOccurrence** field in an isolated copy was changed with exact old-value CAS, unrelated decoded bytes unchanged and independent Node reopen passed. No original or edited actual save, key, private metadata or personal data is part of this TIME PR. This is **OFFLINE_COPY_VERIFIED by 01 CORE's private Python+Node scope**, not a new TIME execution/test and not accepted real-save cross-codec Rust/WandJS/TimekeeperJS parity. The CURRENT shared SSoT later records a **real-save-derived selected EventID 2010000021, savedIndex 155, oneof ItemSpawning**, old UTC 2126-08-20T00:00:00Z and new UTC 2022-09-06T00:00:00Z; strict original-value/token CAS and exact one-field change, independent private Python/Node reopen. This establishes **REAL_SAVE_READ_ONLY event identity and CORE-owned offline V2 isolated-copy technical preservation evidence** for this specific selected row only. The test fixture Index 7 in this PR is still SYNTHETIC; do not infer that other W1 EventIDs have verified real-save indices. The authenticated actual private data was not accessed by TIME; only anonymized derived SSoT evidence is referenced. Native completion, load-time actualization, in-game spawned Grid/DiffGrid and related reference effects remain independently UNKNOWN. Coordinate offline W1 V3 on non-sensitive redacted source identity/oneof and before/after field-only fingerprints with CORE; no user-save data transfer and no blanket physical Switch stop.

## Round 11 — trusted EventID CAS and verified saved ItemSpawning context (2026-11-03)

CORE PR329's private schema626 technical report verifies a real-save-derived selected tuple:
`EventID=2010000021 / savedIndex=155 / oneof=ItemSpawning / pointer=/World/RecurringEvents/155/ItemSpawning/NextOccurrence`. The private Python/Node isolated edit-copy changed `2126-08-20T00:00:00Z` to `2022-09-06T00:00:00Z` with exact one-field delta and independent reopen. CORE PR329 is now HEAD `4c8cf5568ad767c5712dbe948fc6d9dc4dbbac76`, three current CI SUCCESS, but the new actual Rust/WandJS/TimekeeperJS real-source comparison branches remain NOT_RUN. This is CORE-owned REAL_SAVE_STRUCTURAL_VERIFIED + partial offline edited-copy evidence, not TIME's own private-save test and not product Writer or V3 Native behavior acceptance.

### Specific Native Consumer / loaded-value boundaries

| Phase | Existing Switch v1.25.3 static path | Unresolved proof |
| --- | --- | --- |
| Profile setup | `Client.SetProfile` state machine `0x060A9B70` calls `WaitForRecurringEvents` from `0x060AA13C`; `Profile.ActualizeRecurringEvents` `0x05A2A170` has conditional catch-up and EndDate gates | Whether this exact saved EventID is normalized on actual load, and persistence after reserialize |
| Clock scheduling | `WaitForNextOccurrence` `0x0604E770` reads subtype timestamp, installs `Client.Clock +0xF0` Appointment, strict deadline < current-provider time | Exact time provider, paused clock, stored CTS/cancel-and-rearm; strict Clock expiry is not the same as readiness Now >= NextOccurrence |
| Transaction | Async state machine stores EventID into `ExecuteRecurringEvent.Request +0x20` at `0x060B5E7C`, calls RPC at `0x060B5F30` | World-authority branch, server-side operation dispatch, result and actual Grid/DiffGrid mutations |
| ItemSpawning Execute | `0x057B9BC0` reads Area/Conditions/quantity; separate LastOccurrence update `0x057BF058/0x057BF068` precedes Reschedule `0x057BF0C4` | Exact generated GridObject IDs, counts, pickup/removal follow-up, slot62 notification and saved value after cold restart |
| Intentional future | 2126 long future is accepted user input, 2022 may be overdue; 2127 future also valid as structural input | No automatic corruption classification, no guarantee that editing timestamp removes objects already spawned |

### Contract for eventual trusted Rust SemanticCommand

One **Core-issued** immutable SaveSession must bind source encrypted P1G SHA, decoded JSON SHA, canonical 508-definition Registry SHA, external platform/BID/schema, SessionID and Revision **plus** intended EventID, actual savedIndex, exact oneof, canonical NextOccurrence pointer, raw old JSON token CAS and decoded old UTC CAS. The intended EventID MUST be independently identified: existing pointer-only JS plans can legitimately resolve a **different valid W1 event** at a different pointer, without knowing the caller's original intent. Confirm correct source EventID `RecurringEventItemID` at the actual index, single oneof, W1 source-active policy, no duplicate IDs or protected family. The change set is exactly the timestamp token; keep LastOccurrence, EndDate, raw unknown/opaque bytes and all other domain references. Required read/write dependency closure over applicable Quest/Grid/Inventory/ConditionalEvent state belongs to CORE and may not be inferred from nonoverlapping JSON paths. Any stale source or revision or unsupported dependency rejects the whole atomic mixed-domain transaction; Undo/Redo must restore all domains.

The new `src/w1-bound-intent-research.mjs` checks those cross-field equality relations against **simulated** trusted Core witnesses and existing `projectW1RustAdapterOracle()`, without parsing P1G, editing a document, creating a real Session, or authenticating Core origin. Its `authenticatedByCore` value is a deliberately **spoofable test fixture flag**, never a security boundary: this helper is not a product Validator, Capability, or Writer implementation. Returned `capabilityGranted=false, writerAuthorized=false, productSemanticCommandAuthorized=false, operationReferencesComplete=false`. Targeted tests cover wrong desired ID despite valid pointer, wrong source hashes/Revision, old escaped raw token-vs-UTC, no-op, mixed protected batch and other-domain preservation. Keep future 2022/2126/2127 dates semantically user-directed, not automatically damaged.

### PR #36 / PR #37 non-duplicating integration

PR36 `0de351dea8c3a97782e3b7086e753469e00abaa8` introduced a four-kind synthetic W1 vector, static Rust-shape tests and Native condition matrix. PR37 is a sibling from the same PR20 parent and actually compiles Wand CORE PR312's Rust structural witness against JS W1 oracle; this new bound-intent negative test is on PR37 only. Distinct modified files and no ancestor relationship: **00 CTRL should stack both onto one isolated fixed integration HEAD after 05 QR scoped review, not merge sibling PRs to main separately.** Neither branch grants Native runtime or product export authorization.

For a future operation-specific runtime test (only if offline V3 cannot resolve it), observe the verified EventID 2010000021's `Client.Clock` appointment, `blockRecurringEventReschedule`, EventID CTS/rearm, typed RPC result, Area/Grid/DiffGrid object IDs/LastOccurrence and saved NextOccurrence after game cold reload. These are named unknowns, NOT a blanket hardware gate.

## Round 12 — latest CORE real-copy scope and 05 QR fixed-head delta (2026-11-03)

**Current source-specific update superseding Round 11's earlier NOT_RUN statement only:** Wand CORE PR329 moved to `9c2945a6ac41e584a49394bd1b39865c6d68daeb` (parent PR312 `c6b152512d3bc901fd1474dbcfcb07253ae1b347`). Its owner-reported **PRIVATE local actual schema626 source** run exercised the same original with all three real codecs (Wand Rust, established Wand JS and Timekeeper JS), generating a no-op and one `EventID2010000021, savedIndex155, ItemSpawning/NextOccurrence` edit per implementation. Six copies independently reopened by Node Crypto/Zlib/CRC; real-source 11/11 Rust negative cases rejected; exact selected timestamp only changed and original P1G remained immutable. Latest focused CI `41549778109`, Rust research `41549778122`, ordinary CI `41549778507` are SUCCESS, but operate on synthetic or source-only CI fixtures; **private local evidence is developer-reported, NOT independently replayed/accepted 05 QR actual-save V2**. Operation V2 status: CORE private REAL_SAVE_OFFLINE_EDITED technical PASS, independent 05 QR V2 still OPEN. Session Revision CAS, complete operation-specific Native references and any product capability remain UNVERIFIED/OFF. No actual original bytes, private source or key have been provided to 02 TIME or GitHub.

**05 QR scope:** independent QA [PR #40](https://github.com/0xmorarin/Dreamlight-Timekeeper/pull/40), fixed test HEAD `bd20f872ceff1b43ab6309b7fb23cff5cd36c3a4`, CI `41549485107` 4/4 limited PASS, reviewed **TIME PR37 old HEAD `f982f3055cad3569504e1b6a3279abc8d775acdd`**. It did not review the subsequently added `src/w1-bound-intent-research.mjs`, `tests/w1-bound-intent-research.test.mjs`, or their new test cases. A new scoped QR acceptance must pin the newer TIME37 HEAD; do not repurpose QA #40 or call synthetic Rust witness a product SemanticCommand.

**Native per-operation dependency and recompute closure (version-specific STATIC_ONLY):**

| Variant | Required related-state audit for an operation-specific W1 writer | Runtime/semantic uncertainty preventing V3 promotion |
| --- | --- | --- |
| ItemSpawning (actual source EventID2010000021/index155) | saved `RecurringEventItemID`, `NextOccurrence`, `EndDate`, `LastOccurrence`; Area/Conditions, subtype max/owned Grid counts, Grid/DiffGrid effective objects and relevant conditional state; no unknown-field alteration | `ActualizeRecurringEvents` branch ordering on cold profile load, authoritative `ExecuteRecurringEvent` dispatch, successful objects and reschedule emission/CTS waiting |
| WildCropsSpawningInVillage | saved identity/next/end; Area, effective crop/garden counts, `NumberOfGardensToSpawn`, `SetupGardenProduction` GridID+GridObjectID and linked Quest/ConditionalEvent refs where used | actual garden creation, harvest/remove, save persistence and first-run rescheduling |
| FlowerSpawningInVillage | saved identity/next/end; Area/actual grid projection, effective flower count, `MaximumAmount`, `NumberOfFlowersToSpawn` and `TryPlaceFlowers` | successful placement, pickup and cold-load regeneration outcome |
| FishSpawningInVillage | saved identity/next/end, water-body/Area, `PendingFish` and its remove dispatcher slot39; do not map to a GridObject by assumption | all 46 reviewed current-source definitions are inactive; policy **DENY**, no W1 operational release without new separately verified source/Native evidence |

A change only to `NextOccurrence` **does not remove an existing object**. ConditionalEvent/Quest/Grid/Inventory checks are relevant to source-aware read sets where the selected operation actually depends on them. Do not overstate a source-wide 11-domain reference graph as mandatory for isolated W1 **research**; product operation must satisfy all **applicable** dependencies and preserve unrelated/unknown fields. Missing applicable Native dependencies fail closed for that operation only.

**Research-only CAS audit:** `src/w1-bound-intent-research.mjs` is incapable of authenticating a caller-supplied `authenticatedByCore:true` flag or proving the origin of JSON token bytes. Its tests now explicitly show that even a spoofed positive flag cannot authorize Writer, that changing any Core-token EventID/Index/oneof/decoded UTC fails, and that protected Moonstone/TimeBending/inactive Fish/W2 mixed plans deny all W1 edits. No source/session mutation, no product Rust binding or non-W1 Transaction staging occurs in TIME. Future real `SemanticCommand` must be issued and checked inside Core/Worker against immutable source and a Core-issued revision, not merely serialized UI-like witness fields.

**Physical device only if needed for a named residual:** (a) test `SetProfile`/Actualize loaded-value overwrite and `Clock.Appointment` due date; (b) monitor ItemSpawning EventID2010000021 typed RPC response, Area counts and `LastOccurrence` update; (c) check cold restart persistence/pickup rearm after isolated copy. Do not require console checks to run synthetic/native research or to develop V2 local offline edit-copy.
