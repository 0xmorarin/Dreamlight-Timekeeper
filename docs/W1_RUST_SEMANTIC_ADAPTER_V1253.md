# 02 TIME — W1 Native semantics and future Rust adapter ABI (Switch v1.25.3)

**Evidence freeze / 2026-11-02.** Derived from existing PR #7 at `d7bb7a2db78fbb78127281c4d5c5ad3291004a6b`; no new NSO disassembly. Target integration PR #11 at start `393222e7832461ef5fea847b6fff475fedc45017` is **not modified**. This document is a Timekeeper adapter interface, not a new Wand codec, Rust package implementation, Writer permission, GridObject move/delete permission or physical Switch PASS.

## Authoritative reuse / identity and evidence

- DDVRE [TIME shared research index](https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit), [timing field/event registry](https://docs.google.com/document/d/18iFQJroXQ2lCIf4aElFrQV7Z-wSzwyXlJpRDpnYG0Ao/edit), [current timing state](https://docs.google.com/document/d/1UgMxSw1dl19gL6bjlmedMBtOe2io7sT1g3j58FgYoHg/edit), and existing [native ledger](W1_NATIVE_EVENT_SEMANTICS_V1253.md).
- Wand **01A**: common save version, P1G/JSON bytes, build identity, token CAS and copy/encode gate ownership. **01E**: actual Switch v1.25.3 schema626 **read-only** acceptance; NOT evidence of real modified P1G compatibility. **01D**: 17,413 v1.25.0 ItemData definitions; original v1.25.3 reused 244/244 event-linked item payloads and isWood tag v1.25.0–v1.25.3 parity; use ItemID evidence, never infer EventID from an ItemID. **01B**: original world/Area/Grid identity, DiffGrid overlays and ConditionalEvent GridObjectAddress reference constraints, no time-based Grid deletion permission.
- Pinned v1.25.3 Nintendo Switch BID **`9A239D3DB569756D`**, `GameInfo.Version=626`, source RecurringEvent definitions **508**, source data SHA256 **`028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea`**. Existing primary original `ExeFS/main` SHA256 **`16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a`**, decoded NSO text SHA256 **`15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328`**. These do not prove the build identity of a particular save file. No raw NSO, save, key or copyrighted asset is included.
- Legacy JS `src/w1-minimal-write-contract.mjs` is the existing STRUCTURAL-only oracle (not global Writer authority); `src/timing-native-semantics.mjs` is the versioned STATIC_ONLY native type-level ledger. Owner reported actual suppression using long-future NextOccurrence: **OWNER_REPORTED_RUNTIME_CONFIRMED**, with no independently verified per-EventID coverage. Additional Switch tests are **WAIVED_BY_OWNER**, not PASS.

## P0: four exact W1 subtype meaning boundaries

The only proposed field is `World.RecurringEvents/<canonical saved-index>/<saved oneof variant>/NextOccurrence`, as canonical JSON Pointer `/World/RecurringEvents/<index>/<Variant>/NextOccurrence`. A saved index is **not** EventID. The saved subtype's `RecurringEventItemID` is EventID, not linked ItemID, and it must match the independent 508-definition record. All four Native IL2CPP W1 subtypes have `RecurringEventItemID` at +0x18, `NextOccurrence` Timestamp pointer at +0x20, `EndDate` at +0x28; **only ItemSpawning** has additional `LastOccurrence` at +0x30. Only a timestamp's existing value is eligible for token substitution; no LastOccurrence/EndDate/quantity/grid/pending-fish edits.

| Saved subtype | Existing Execute RVA / direct Reschedule BL callsite | Existing cap / area / spawn evidence | Catch-up interval upper bound (STATIC_ONLY) | Pickup/remove/restart |
| --- | --- | --- | --- | --- |
| **ItemSpawning** | `0x057B9BC0` / `0x057BF0C4` | `ConditionsList.Evaluate 0x057BAA10`; `Area.ShouldSpawn 0x057BB090`; `GetMaximumAmount 0x057BBD88`; owner-grouped `numberOfItemsOnValidGrid` `0x057BF720`. `GridState.get_ItemAmountState +0x28` is **AssignedPlayer**, not Amount. Exact effective population and native successful placement unknown | `intervalTicks * trunc(GetMaximumAmount / MinNumberOfSpawn)`; getter `0x057C0140` | LastOccurrence setter static; pickup, existing objects and cold-restart outcome UNKNOWN |
| **WildCropsSpawningInVillage** | `0x057C2BC0` / `0x057C4260` | `Area.ShouldSpawn 0x057C34C0`; `GetMaximumAmount 0x057C38E8`; `SetupGardenProduction 0x057C41D4`; `CountTillMaximumAmount 0x057C49A0` caps its census, but precise seed predicate, Grid/DiffGrid completeness and successful creation UNKNOWN | `intervalTicks * trunc(GetMaximumAmount / NumberOfGardensToSpawn)`; getter `0x057C4350` | Crop harvest/remove and immediate reschedule UNKNOWN |
| **FlowerSpawningInVillage** | `0x057C99E0` / `0x057CAE58` | `GridCollection.TryGetGrid 0x057CA490`; `TryPlaceFlowers 0x057CAE20/0x057CAE38`; actual placement count and Grid identity UNKNOWN | `intervalTicks * trunc(MaximumAmount / NumberOfFlowersToSpawn)`; getter `0x057CB7C0` | Collection/removal, transient cap and restart UNKNOWN |
| **FishSpawningInVillage** | `0x057C6890` / `0x057C7110` | Area `TryGetVillageArea 0x057C6C34`; water-body number `0x057C6C44`; pending fish count `0x057C6E68`; `ProfileWorld.AddPendingFish 0x057C70F4` (NOT necessarily GridObject placement). No direct BL to common IsReady inside this Execute | `intervalTicks * MaxNumberOfPendingFishes`; getter `0x057C7EC0` | `RemovePendingFish 0x0598E800` emits **slot39**, not proven NextOccurrence/slot62. The 46 Fish source definitions in this reviewed category are inactive, therefore no ordinary W1 candidate promotion |

Common `IRecurringEventExtensions.Reschedule` RVA `0x05AF24D0` is the type-level setter path. `Profile.ActualizeRecurringEvents` `0x05A2A170` has a bounded catch-up branch for overdue schedules. In-memory setters of these four variants store Timestamp at +0x20 (opcode `F8020C01`); they do **not** themselves notify slot62. `Client.WaitForNextOccurrence` `0x0604E770` → `Client.Clock` +0xF0 appointment → typed `ExecuteRecurringEventAsync` `0x060B5F30` is statically traced, **not** a proven successful server transaction or spawn. Runtime Area fullness, native EventID-specific Consumer dispatch, collection-reschedule, generated GridObject provenance, and Save/Reopen/Restart are UNKNOWN. An EventID source family hint is not proof of that native event instance's execution.

**Readiness nuance:** reviewed common static predicate `Now >= NextOccurrence`; actual `Clock.Update` time expiration from its stored appointment uses `appointmentDateTime < currentTimeProviderNow`. These are not interchangeable. A future value (e.g. `2126-08-20T00:00:00Z`) may be intentionally suppressive, not a corruption signal. Do not auto-normalize/clamp.

## P1: Rust-only Timekeeper semantic adapter interface (design, not bound)

Issue [#19](https://github.com/0xmorarin/Dreamlight-Timekeeper/issues/19) assigns **all** P1G/ZIP/AES/Deflate, schema/build version interpretation, strict JSON byte spans, original SHA, unrelated-data preservation, old-value CAS, single Encode/independent Reopen, capabilities and browser WASM ownership to the **Wand-compatible 01 CORE common package**. TIME **must not** implement that engine or fork a second save representation. The Rust interface below is proposed and **API_PENDING_CORE**, not compiled/linked or release-ready:

```rust
// Conceptual, not currently a common-core import or implemented trait.
pub trait TrustedW1Evidence {
    fn source_identity(&self) -> SourceIdentity; // game/version/BID/schema/source SHA
    fn definition(&self, event_id: u32) -> Option<W1Definition>;
    fn native_source_hint(&self, event_id: u32) -> NativeVariantHint;
}
pub struct SavedW1Ref {
    pub saved_index: u32,
    pub event_id: u32,
    pub saved_oneof: W1Variant,
    pub next_occurrence_pointer: CanonicalJsonPointer,
    pub expected_old_utc: TimestampRfc3339,
}
pub struct W1EditIntent {
    pub target: SavedW1Ref,
    pub new_utc: TimestampRfc3339,
}
pub enum W1Verdict {
    Deny(W1DenyReason),
    StructuralCandidate {
        pointer: CanonicalJsonPointer,
        old_value_cas: TimestampRfc3339,
        expected_new_value: TimestampRfc3339,
        required_capability: Capability::EncodeCopy,
        evidence: EvidenceState::StaticOnly,
    },
}
pub trait TimekeeperW1Adapter {
    fn inspect(&self, trusted_source: &dyn TrustedW1Evidence,
       immutable_save: &dyn CommonSaveReadView,
       intents: &[W1EditIntent]) -> Result<Vec<W1Verdict>, W1AdapterError>;
}
```

Exact names/types may change to conform to the forthcoming common crate. There is **no** Timekeeper implementation of `CommonSaveReadView`, `Capability`, P1G or JSON span finder. Canonical Span/Start/End must be returned and authenticated by the common parser, never by untrusted UI. The semantic adapter only selects a pre-existing `NextOccurrence` token, verifies matching source event ID, oneof variant, canonical saved index, exact old value and source policy, and submits a **plan**, not bytes. The common Rust engine independently checks current source identity, source SHA, build/schema, strict JSON parsing/duplicate keys, unchanged-field preservation, byte offsets, CRC/ZIP compatibility, memory limits and appropriate encoded-copy capability before any output.

### Current JS oracle DTO for Rust differential tests

`src/w1-rust-adapter-oracle.mjs:projectW1RustAdapterOracle({profile,snapshot,plan,registry,ledger})` consumes **existing** `assessMinimalW1WriteTargets` and Native ledger. It returns `dreamlight-timekeeper.w1-rust-semantic-adapter.v1` with (a) typed separate event/source ID, saved index, saved oneof, pointer, linked ItemIDs; (b) exact old/new UTC timestamp strings and CAS precondition; (c) type-level Native RVA, catch-up formula and explicit UNKNOWN areas; (d) all-or-nothing decisions and expected one-token delta; (e) `requiredCapability=ENCODE_COPY`, but `capabilityGranted=false` and **no** validated source JSON span/bytes. Never use the DTO as a public Writer authorization receipt.

`tests/w1-rust-adapter-oracle.test.mjs` is the initial oracle fixture suite. Once 01 CORE's Rust trust/read/plan API is frozen: parse synthetic schema626 original source with strict Rust parser; compare **event/index/variant/pointer/old/new/reason and allowed one-field paths** against the existing JS oracle across positive, protected, no-op, stale, inactive, unknown, duplicate oneof, schema drift, alternate valid 2126/Now/past dates. The Rust byte-preservation oracle must compare with original tokens and independent reopen, **not** literal JSON bytes from JS's whole-object serializer. W1 can never authorize PERSISTENT_REPLACE. No user save, source binary, or production Writer is exercised by the JS DTO.

## Explicit denies / separated dangerous Grid work

- Moonstone Chest **source EventID `2010000064`** and spawned **ItemID `31400039`** are distinct. Reward/claim/online state remain protected. TimeBending `2010000093`/`2010000120`, W2 Snippet `2011300000`, Quest/DLC/protected entries, inactive Fish and unknown oneof/build/schema remain **DENY**; never promote from a source ItemID or static Native callsite.
- [Issue #4](https://github.com/0xmorarin/Dreamlight-Timekeeper/issues/4) Area GridObject bulk deletion: same ItemID only yields `ITEM_ID_ONLY` research candidate, not proof of origin; 01B root GridID/Area/DiffGrid/RemovedObjects/ModifiedObjects, `GridObject.From`, `ConditionalEventHistory.ActiveEvents` and historical references must be joined and an independent Native Remove lifecycle accepted. No deletion plan or capability is made.
- [Issue #5](https://github.com/0xmorarin/Dreamlight-Timekeeper/issues/5) Moonstone Chest move: main-Valley external PlayerHouse link with `PlayerHouseIndex=0` must be distinguished from shared original interior; preserve original chest GridObject.ID, State, pending refs, root GridID and placement geometry. Same-grid and cross-grid moves are different hazards, no relocation capability.
- Wand 01E actual schema626 read-only reports 1,746 active ConditionalEvent GridObjectAddress refs, 3 direct + 40 DiffGrid modified matches, and 1,703 unresolved save-local; **unresolved means UNKNOWN, not absent**. A timestamp-only operation does not delete or relocate existing spawned objects.

**Release/evidence status:** STATIC_ONLY native subtype semantics + SYNTHETIC_TESTED JS target/DTO; OWNER_REPORTED_RUNTIME_CONFIRMED aggregate only; real-save modified P1G, Rust/WASM adapter, physical game load/save/restart **not** independently accepted. All date examples are input values, never repair candidates by magnitude.
