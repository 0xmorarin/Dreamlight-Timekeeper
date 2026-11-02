# 02 TIME — W1 per-event Native semantics ledger (Switch v1.25.3)

## Round 7 — per-player Item count, WildCrops bounded census and Client reschedule notification (2026-11-02)

**New static evidence scope**: original private Nintendo Switch v1.25.3 `ExeFS/main` SHA256 `16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a`, NSO decompressed text SHA256 `15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328`, BID `9A239D3DB569756D`, exact matching `dump.cs`. Reuses original file/section checks, W1 Execute/Reschedule, DiffGrid overlay and Native RVA ledger; no new game version, console test, live event execution or save write. Method signatures and field offsets are taken from the original v1.25.3 IL2CPP dump. The source is privately held; do not commit `main`, decoded text, `dump.cs`, or a real save.

### ItemSpawning: actual grouped count Consumer (correction to broad item-count interpretation)

`ItemSpawning.Execute` has two direct BL callsites **`0x057BC0EC (94000D8D)`** and **`0x057BC5EC (94000C4D)`** to compiler-generated `ItemSpawning.<Execute>g__IncNumberOfItemsOnValidGrid|50_15(Nullable<int> playerId, ref ...DisplayClass50_3)` at RVA **`0x057BF720`**. IL2CPP closure `DisplayClass50_3` contains `Dictionary<int,int> numberOfItemsOnValidGrid`. The helper executes `0x057BF82C BL 0x03B56B30` (dictionary lookup), conditionally increments the retrieved value at `0x057BF850 ADD W9,W9,#1` (`11000529`), and updates the dictionary at `0x057BF878 BL 0x03B51D40`. Its nullable `playerId` argument is semantically distinct from source `RecurringEventItemID` or `GridObject.ID`.

At the second callsite the input at `0x057BC5C4` is **`AmountWithState.AssignedPlayer` +`0x28`**, *not Amount* (+`0x18`), as corrected in Round 6. Thus the new path establishes **owner/assignment-grouped counting** in the Execute algorithm, not that the accessor returns a scene-global number of items. Other object-enumeration branches may contribute to this dictionary; exact membership, max-per-player calculation, and how already removed/default/modified DiffGrid entries are reflected in this enumeration remain unresolved. A per-group dictionary count is not a persisted count of all existing objects and does not imply an object was created.

### WildCrops: bounded enumeration of existing candidates is distinct from interval catch-up cap

IL2CPP generated closure `WildCropsSpawningInVillage.<>c__DisplayClass44_1` has `int maximumAmount` at +`0x10` and `<Execute>g__CountTillMaximumAmount|0(Item seedItem)` RVA **`0x057C49A0`**. The `WildCropsSpawningInVillage.<>c.<Execute>b__44_4(IGrid x)` selector at RVA **`0x057C4810`** dispatches IGrid slot 6 to enumerate objects. `CountTillMaximumAmount` constructs an enumeration, initializes the count with `0x057C4D10 MOV W20,WZR`, increments `0x057C4E0C ADD W20,W20,#1` (`11000694`) while iterating, then at `0x057C4E10 CMP W20,W8` (`6B08029F`) compares against closure maximum and at `0x057C4E14 B.LT` repeats if still below. It returns the bounded count at `0x057C4E84 MOV W0,W20`.

This is a **concrete bounded existing-object enumeration path**, not proof that every saved Garden seed/crop maps 1:1 to an object. The exact seed-item predicate and whether it traverses both default and DiffGrid overlay objects in each candidate Area must be traced to attribute a specific save object. Do **not** conflate this enumerator's `maximumAmount` with the **distinct** static `GetMaxIntervalToFullyExecute` formula from Round 4. Neither returns observed successful spawn count. Successful `SetupGardenProduction` still depends on the Round 5 conditional placement result.

### RecurringEventRescheduled: real Client timer Consumer is separate from PendingFish removal notification

The native interface `IWorldEventDispatcher.RaiseRecurringEventRescheduled(uint recurringEventID)` is **slot 62**, with concrete `ProfileEventDispatcher` implementation RVA **`0x05A8EC10`** and event delegate field **`OnRecurringEventRescheduled` at +`0x208`**. Client has `OnRecurringEventRescheduled(uint recurringEventID)` RVA **`0x0604E9B0`**. The checked handler attempts a corresponding event record lookup via **`0x0604EB9C BL 0x03C14440`**. It evaluates `IsEventOver` (RVA `0x05AF3050`) at **`0x0604EBF8`** and **`0x0604EC0C`** (direct BL words `97EA9116`, `97EA9111`). Its branch on an ended event can bypass the wait. On the continuing path **`0x0604EC7C BL 0x0604E770`** calls `Client.WaitForNextOccurrence(RecurringEvent, CancellationToken)`; the returned task enters a separate continuation/scheduling path. This is an event-ID-targeted timer consumer but it does not itself prove the game ran that handler, performed immediate Execute, wrote persistent save data or that the next event actually fired. Its runtime subscription and all future-time conditions remain unconfirmed.

Critically the **emitter is not universally established**. `Profile.AddRecurringEvent` RVA **`0x05A29920`** has a conditional dispatcher call, using **`0x05A2A0F0 MOV W2,#62`** (`528007C2`), **`0x05A2A118 BLR X8`** — an explicit **creation-path RaiseRecurringEventRescheduled** notification. But `IRecurringEventExtensions.Reschedule` RVA `0x05AF24D0` was separately confirmed to invoke the NextOccurrence interface setter and has *not* been proved to emit slot 62 upon **every setter**. `Profile.ActualizeRecurringEvents` setter branches also must not be presumed to notify the Client. The source and trigger contract must be verified before asserting `NextOccurrence` edits cause immediate resubscription.

This slot-62 path is **not** the `IWorldEventDispatcher.RaisePendingFishRemoved` **slot 39** documented in Round 5. The latter has a candidate FishingSystem listener and BodyOfWater.RemoveFish Consumer but **no proven indirect path back to slot-62 or to the native Reschedule helper**. Absence of a direct BL is not proof no other subscribed observer exists. Pickup/removal-driven recurring events therefore remain UNKNOWN.

### Source EventID / actual save subtype / GridObject and ConditionalEvent reference: cross-SSoT boundary

Reused authoritative Wand 01A/01B/01E read-only research rather than duplicating schema/codec: v1.25.3 01E reports 1,746 active ConditionalEvent `GridObjectAddress` references, of which only three map to direct `GridObjects`, 40 to `DiffGrids.ModifiedObjects`, and 1,703 remain not materialized as save-local direct/modified objects. Some recurring-source item candidates intersect these save structures, **not** proof of source EventID→stored subtype→concrete GridObject identity. The `GridObject.From` field is commonly omitted. Existing active references must still veto naive removal, and missing save-local objects must not be treated as an authorisation to delete/recreate an item. See [Wand read-only source consumer contract](https://docs.google.com/document/d/1YrlS4uudzzDEXzSn29DkfmBOs9YkqYSfip6By5gSzYQ/edit) and [01B World/Grid handoff](https://docs.google.com/document/d/1d4l-GG5W0F3cSRIltgZyA_ZTzf8Nv7r0QG1h7Sr2x2w/edit). Four active *definition* witness IDs remain source-only: NightThorn `2010000003`, Wood `2010000021`, WildCrop `2010400001`, Flower `2010500008`; their individual live save oneof and concrete GridObject provenance remain UNKNOWN.

### Minimal future/now/overdue/collection/restart observations (not executed)

For a disposable read-only-before / reversible runtime fixture with exact schema626 and controlled conditions, preserve version/BID, actual saved RecurringEvent oneof, source/EventID, all timestamps, Area and Grid IDs, default+DiffGrid modified/removed sets, Count/AssignedPlayer group values, Garden state, PendingFish, ConditionalEvent addresses, DLC and quest flags. Differentiate **future NextOccurrence + pre-existing objects**, **Now due without runtime change**, **overdue with 0 vs near-cap effective existing objects**, **pickup/harvest vs untouched**, **fresh save then full process termination/reload**. For every event, require full callback trace and resulting saved-object/timer diffs; do not count a branch being true as a spawn. Record whether slot 62 was actually emitted, Client handler actually reached, EndDate considered, any direct or indirect spawn/Reschedule called and whether in-memory vs serialized values differ. **Every matrix case remains unexecuted, STATIC_ONLY.**

Safety: deliberately long 2126 `NextOccurrence` is accepted. Moonstone Chest `2010000064`, TimeBending HOLD `2010000093/2010000120`, W2, all 46 inactive Fish source IDs, unknown variant and newer save schemas are not automatically W1. Writer allowlist, edited export, Grid deletion and Moonstone movement remain false; only 01 CORE/05 QR later unlock independent gates. **No runtime, save persistence or Switch restart PASS**.

---

## Round 6 — Item amount field correction, DiffGrid overlay count and conditional object-ID allocation (2026-11-02)

**Evidence:** new RVA/word checks from the unchanged v1.25.3 original Switch `main` SHA256 `16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a`, decompressed NSO text SHA256 `15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328`, BID `9A239D3DB569756D`, and associated exact `dump.cs`. Existing SHA acceptance, catch-up, NextOccurrence / EndDate, Fish event handlers and prior W1 method entries are **reused**, not retested. Source data stays private; only word/RVA fixtures are pinned.

### New negative: ItemSpawning.get_ItemAmountState is not a read of Amount or scene total

`ItemSpawning.Execute` at `0x057BC5BC BL 0x04E66530` calls `GridState.get_ItemAmountState()`. A subsequent null guard leads to `0x057BC5C4` exact opcode `F9401414 = LDR X20,[X0,#0x28]`. In the exact `Definitions.Items.AmountWithState` structure, the **Amount** nullable integer is at `+0x18`, **State** at `+0x20`, and **AssignedPlayer** nullable integer at **`+0x28`**. Hence the consumed subfield at that callsite is **AssignedPlayer**, not Amount. A Round 5 high-level summary treating this accessor as an existing-scene item count was overbroad: it identifies *an AmountWithState access*, but the actual traced load is *not* proof of a numeric live GridObject cap. Other quantity paths, including virtual IGrid/ObjectCount and item-specific count state, remain unresolved. This correction does not mean that no quantity guards exist.

### DiffGrid is a default/modified/removed overlay, NOT just ModifiedObjects

Exact IL2CPP `Meta.Grids.DiffGrid` fields: `ModifiedObjects` map `+0x40`, `RemovedObjects` repeated IDs `+0x48`, `NextGridObjectID` `+0x50`, `defaultGrid` runtime reference `+0x58`. In its `ObjectCount()` entry `0x04E8DA90` / common predicate counter `0x04E8DAA0`, Native `0x04E8DBA8 LDR X19,[X21,#0x58]` obtains defaultGrid; `0x04E8DBE8 LDR X9,[X21,#0x48]` obtains removedObjects; `0x04E8DBF8 LDR W8,[X8,#0x18]`, `0x04E8DBFC LDR W9,[X9,#0x18]`, `0x04E8DC00 SUB W8,W8,W9` calculate a base default-count minus removed-count; `0x04E8DC08 LDR X0,[X21,#0x40]` accesses the modified map; conditional `0x04E8DF04 ADD W8,W8,#1` increments for a matching modified element. This count core also contains predicate-dependent filtering/iteration; the summary **is not** an exact universal Area limit formula. Critically, simply counting `ModifiedObjects` omits default objects and removal overlays.

A direct BL scan over each W1 Execute range found **0 direct** calls to `Grid.ObjectCount` or `DiffGrid.ObjectCount` and **0 direct** calls to concrete `DiffGrid` methods, but the same instruction windows contain indirect BLR calls (Item 33, WildCrops 12, Flower 10, Fish 0). Therefore an `IGrid` virtual call might count objects: **no direct BL does not imply no population checking**. Actual Area-specific count and the object category selected by a virtual count remain UNKNOWN.

### Conditional DiffGrid.AddObject implementation bridges allocated GridObject.ID and ItemID

The exact `DiffGrid.Meta.Grids.IGridInternal.AddObject` entry is `0x04E8BC70`, with inner `DiffGrid.AddObject(GridObject,...)` at `0x04E8BEA0`. The source includes `0x04E8BDB4 LDR W8,[X22,#0x50]`, `0x04E8BDB8 ADD W9,W8,#1`, `0x04E8BDBC STR W9,[X22,#0x50]` to advance the next-ID field. `0x04E8BDC8 STP W8,W27,[X0,#0x18]` places that allocated ID and the item ID into the newly constructed `GridObject` at offsets `+0x18` and `+0x1C`. It then delegates to the inner AddObject. The latter checks a placement validation helper at `0x04E8BF70 BL 0x04EC4FA0`, branches on failure at `0x04E8BF7C TBZ → 0x04E8C080`, and accesses `ModifiedObjects` via `0x04E8BF80 LDR X0,[X21,#0x40]` for a map-update helper `0x04E8BFA0 BL 0x03C13CF0`.

**Ordering matters:** the transient next-ID increment precedes the inner placement-success test. Neither that counter increment nor the intermediate object construction proves a successful placement, persisted map delta, or a stable ID after failed transaction rollback. The inner/outer concrete DiffGrid chain is source-verified, but the W1 Execute sites use interface/transaction paths, and **W1→this concrete implementation dispatch has not been proved for a specific save**. `GridObject.Source/From` may be absent; no `RecurringEventItemID`→`GridObject.ID` linkage is directly established by this field store.

### Four specific event/source witnesses and explicit evidence gates

| Event ID | Verified source definition name and type hint | Required before concluding actual game instance |
| --- | --- | --- |
| `2010000003` | `NightThornSpawningVillage!UrbanNightThornSpawn`, ItemSpawning candidate | Exact schema626 saved oneof, Area/Grid routing, actual object ID and unambiguous provenance |
| `2010000021` | `Wood!Wetland_Softwood`, ItemSpawning candidate | Same plus count of relevant wood ItemIDs in **effective default/modified/removed** grid |
| `2010400001` | `UrbanWildCropSpawn`, WildCrops candidate | Same plus garden production state and GridObject.ID from successful placement |
| `2010500008` | `UrbanDandelionYellow`, Flower candidate | Same plus measured successful placement and existing flower counts |

These four source records are active in the exact 508-record definition inventory, but the links to the **actual save subtype and concrete GridObject** are not yet accepted. For real-save read-only provenance, reuse **Wand 01A/01B/01E** rather than reimplementing Grid normalization or ConditionalEvent addresses. In the separate v1.25.3 01E study, only a small subset of many active ConditionalEvent addresses materialized as save-local direct/modified objects; `GridObject.From` was frequently absent. This is a strong negative on ID-by-item inference, not a W1 runtime proof. See [existing Wand read-only consumer contract](https://docs.google.com/document/d/1YrlS4uudzzDEXzSn29DkfmBOs9YkqYSfip6By5gSzYQ/edit) and [01B World/Grid handoff](https://docs.google.com/document/d/1d4l-GG5W0F3cSRIltgZyA_ZTzf8Nv7r0QG1h7Sr2x2w/edit).

### Timing and required minimal observation (not executed)

Retain Round 5's eight-case matrix. For each **active, actually identified saved variant** compare: (A) future `NextOccurrence` with existing objects, (B) overdue due-schedule with empty vs near-cap effective Grid, (C) pickup/removal without timestamp edit, and (D) normal save, exit and cold reload. Observe both direct `Grid.Objects` and DiffGrid default + modified − removed overlay, next-ID counters, `ItemID`, `GridObject.ID`, optional `From`, conditional event address references and category state, not just JSON string counts. `Actualize` branch true and `GetMaxIntervalToFullyExecute` computed value alone never prove spawn or population. Source EventID, ItemID, GridObjectID and PendingFishID remain separate. Moonstone, TimeBending, W2, inactive Fish, unknown variants and newer schema are BLOCKED. Intentional 2126 timestamps are valid inputs. **No Writer, edited export, Grid deletion or Moonstone relocation. STATIC_ONLY remains STATIC_ONLY; all hardware cases unexecuted.**

---

## Round 5 — Execute creation Consumers, fish dispatcher & minimum hardware acceptance (2026-11-02)

**NEW source-static evidence only.** The following RVAs and AArch64 words were read from the existing verified v1.25.3 NSO text (raw main SHA-256 `16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a`; decompressed text SHA-256 `15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328`; Switch BID `9A239D3DB569756D`). No fresh build or new version comparison was implied. Exact method targets were matched against the same v1.25.3 `dump.cs` and Round 4 `GetMaxIntervalToFullyExecute` / expiry / `LastOccurrence` results were reused rather than re-established. No console load, original-save change, or private binary commit.

### Source-specific W1 Execute → generation candidate chain

| Source Native variant | RVA → Consumer | What is supported, and what is still UNKNOWN |
| --- | --- | --- |
| `ItemSpawning` | `Execute 0x057B9BC0` → `ConditionsList.Evaluate 0x057BAA10` → `ProfileWorld.GetGridsFromScene 0x057BAC58` → `SpawnRecurringEventAreaSpecification.ShouldSpawn 0x057BB090` → `GridState.get_ItemAmountState 0x057BC5BC` → `GridExtensions.FindValidPositionAround 0x057BE080` → `PlaceOnGrid.Types.Request.ctor 0x057BE6F8` | Native scene, prerequisite/quest-like condition list, Area filter, extant grid-item amount state, position search and placement request *all* enter this Execute path. This does **not** prove a placed GridObject, ID attribution, successful request, permanent object removal or per-Area cap equivalence. `ConditionsList` concrete records, DLC permission and direct/indirect placement result must be resolved before runtime claims. |
| `WildCropsSpawningInVillage` | `Execute 0x057C2BC0` → `ShouldSpawn 0x057C34C0` → `GetMaximumAmount 0x057C38E8` → `FindValidPositionAround 0x057C3EE0` → placement-result helper `0x057C4190 BL 0x0399D370` → `0x057C4194 TBZ W0,#0 → 0x057C41D8` on failure; success side `0x057C41A0 LDR W22,[X8,#0x24]` and `0x057C41A8 LDR W23,[X26,#0x28]` then `0x057C41D4 BL 0x050F09A0` | **A conditional native ID bridge is verified:** when the placement helper returns a true bit, this Execute passes a grid ID and resulting object ID to `CreateGardeningTile.SetupGardenProduction(Item seedItem,uint gridID,uint gridObjectID,...)`. The false branch bypasses production setup. This is **not** proof the success branch was taken for a concrete EventID, that the garden survives save/reboot, or that the linked seed ItemID equals the generated GridObject ID. |
| `FlowerSpawningInVillage` | `Execute 0x057C99E0` → `GridCollection.TryGetGrid 0x057CA490` → two `TryPlaceFlowers` calls `0x057CAE20` / `0x057CAE38` → nested helper entry `0x057CAFA0` → `GridExtensions.FindValidPositionAround 0x057CB464` and indirect grid methods | Exact helper BLs and nested position search are static. Full indirect `IGrid.AddObject` resolution, the return/success decision, flower counts, scene load and the created GridObject ID are still UNKNOWN. Do not infer two successful placement batches merely from two helper callsites. |
| `FishSpawningInVillage` | `Execute 0x057C6890` → `TryGetVillageArea 0x057C6C34` → number of bodies of water `0x057C6C44` → `CountMatchingPendingFishForLocation 0x057C6E68` → `FishingUtils.SelectWeightedRandomValidFishingRippleRarity 0x057C6F94` → `ProfileWorld.AddPendingFish 0x057C70F4` | The Native target is a **PendingFish record**, not a directly established GridObject. PendingFish ID, ripple ID, ItemID and Event ID remain separate. Crucially, all **46** entries of the existing source registry with `group=釣り`, `subgroup=波紋の生成` have `active=false` in the current v1.25.3 definitions. An executable `FishSpawningInVillage.Execute` does not change those 46 source definitions to active. Do not use an inactive source ID as W1 positive test or assume the only fishing mechanism is RecurringEvent. |

**Opcode pinning:** Direct branch arithmetic/targets from original words include Item scene `0x057BAC58 9407040E → 0x0597BC90`, Area `0x057BB090 979A4358 → 0x03E4BDF0`, position `0x057BE080 97DC287C → 0x04EC8270`; Wild position `0x057C3EE0 97DC10E4 → 0x04EC8270`, placement `0x057C4190 97876478 → 0x0399D370`, skip `0x057C4194 36000220 → 0x057C41D8`, Setup `0x057C41D4 97E4B1F3 → 0x050F09A0`; Flower helper `0x057CAE20 94000060` / `0x057CAE38 9400005A → 0x057CAFA0` and inner position `0x057CB464 97DBF383 → 0x04EC8270`; Fish rarity `0x057C6F94 940CBE5F → 0x05AF6910`, PendingFish addition `0x057C70F4 94071D7B → 0x0598E6E0`. All statements are about static *call and branch* presence; no live return values were observed.

### PendingFish removal event Consumer: stronger but not closed

Round 4 established `ProfileWorld.RemovePendingFish 0x0598E800` → `MapField.Remove 0x0598E874` → `IWorldEventDispatcher` virtual slot **39** (`0x0598E8B8 MOV W2,#39`, `0x0598E8E4 BLR X8`). Round 5 matched slot 39 in `dump.cs` to **`IWorldEventDispatcher.RaisePendingFishRemoved(uint pendingFishID)`**; the concrete `ProfileEventDispatcher` implementation entry is `0x05A8DB40`, with the `OnPendingFishRemoved` delegate stored at field offset `+0x1F8`. A plausible game-side handler exists: **`FishingSystem.OnPendingFishRemoved 0x033FDB20`**, which traverses the FishingSystem's body-of-water list at `+0xA8` and calls **`BodyOfWater.RemoveFish(uint pendingFishID)` via `0x033FDB5C BL 0x033E89F0`**, with an early exit on success and no direct `Reschedule` BL.

This explains a **separate fish-ripple removal Consumer**, but the exact runtime subscription/binding of that delegate and all indirect callbacks remain unverified. It is incorrect to claim that Fish pickup cannot ever reschedule anything, that the handler is always subscribed, or that the dispatcher can never invoke a separately subscribed timer listener. The complete NSO scan still finds exactly ten **direct** BL sites to `Reschedule 0x05AF24D0`; no direct BL exists within `RemovePendingFish`, `FishingSystem.OnPendingFishRemoved`, or the inspected `BodyOfWater.RemoveFish` region.

### Catch-up integration, active objects and identity boundaries

Existing Round 4 evidence establishes that the four `GetMaxIntervalToFullyExecute` overrides multiply the maximum base interval by different quantity-related values. Those maxima bound an **overdue** catch-up path within `Profile.ActualizeRecurringEvents`, subject to its actual runtime entry, `IsEventOver` and other guards; they are not live-object counts. The newly traced generation Consumers independently consult Area/scene/location, grid item amount, valid placement, pending fish state, or production setup. Therefore neither `NextOccurrence <= Now` nor an overdue-clamp predicate alone establishes a successful creation; setting `NextOccurrence` far in the future does not automatically remove existing GridObjects, persistent gardening tiles, flowers or PendingFish. `LastOccurrence` remains separately serialized for ItemSpawning only; `NextOccurrence > EndDate` is the separately proven expiry test, and whether an edited timestamp crosses this test must be considered without silently correcting the user's intentional value. The Source EventID, linked ItemID, generated GridObjectID and PendingFishID are different identifiers. Native per-EventID actual-save subtype, DLC/Quest gating, exact count policy, pickup/remove callbacks and saved/reload persistence are **UNKNOWN**.

### Minimum Switch hardware QA matrix — plan only, **zero cases executed**

Use only a safely isolated and restorable test save, preserve original bytes and exact version/BID/schema fingerprints, and retain before/after source EventID/actual serialized oneof, `NextOccurrence`, `EndDate`, ItemSpawning `LastOccurrence`, area GridObject IDs, pending fish IDs, counts, scene, clock and DLC/quest state. Do not run this against the Owner's real save or allow the product Writer. Eight cases are pinned to the read-only Native ledger (`native.runtimeAcceptanceCases`), **all marked `passed:false`**:

| Case | Variant/source eligibility | Minimum observed contrast | Why it matters |
| --- | --- | --- | --- |
| W1-01 | ItemSpawning source hint only | Due schedule: empty vs already populated target grids | Verify Item/Area counts and whether actual objects are added rather than inferring from interval |
| W1-02 | ItemSpawning source hint only | Pickup/remove vs untouched, then reload | Observe whether `LastOccurrence`, `NextOccurrence` or grid IDs change independently |
| W1-03 | WildCrops source hint only | Empty vs cap-saturated gardens | Identify conditional placement-success and garden production with stable GridObject ID |
| W1-04 | WildCrops source hint only | Harvest vs unharvested garden, cold reload | Determine crop re-generation and whether pickup changes timer |
| W1-05 | Flower source hint only | Empty vs cap-saturated areas | Check helper success, Area quantity and concrete flower GridObject |
| W1-06 | Flower source hint only | Remove/collect vs uncollected, cold reload | Distinguish existing flowers, next addition, no automatic deletion |
| W1-07 | Fish **inactive definitions** | **Passive observation only; no activation** of pending fish addition/removal and other fishing mechanisms | Cannot promote any of the 46 inactive definition IDs to W1 positive runtime execution |
| W1-08 | Protected, W2, inactive, unknown or newer schema | Negative-only: no mutation or edited export | Verify fail-closed, Moonstone/TimeBending protections and future intentional schedule |

All cases remain **BLOCKED for product Writer**. Console observation without isolated source and reversible backup is not approved. Execution by QA would require separate runtime trace/compare of grid state, fresh load/normal save/exit/restart and restoration. No static result in Round 5 is `RUNTIME_TESTED`.

---

## Round 4 — W1 catch-up quantity, expiry, state and removal (2026-11-02)

**Evidence: RAW_NSO_STATIC_VERIFIED, no runtime/source-Event-ID dispatch acceptance.** Reused the exact Round 3 SHA-checked private NSO and v1.25.3 IL2CPP `dump.cs`; the raw executable was not uploaded to GitHub, and source hash acceptance was not repeated as a new finding. Original `main` SHA256 `16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a`, text SHA256 `15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328`, BID `9A239D3DB569756D`. All RVAs below are **module RVA**, not absolute virtual addresses.

### 1. Four distinct native `GetMaxIntervalToFullyExecute` calculations

The same interval helper `RecurringEventIntervalData.GetMaxTimeBetweenExecutions` at RVA `0x047941D0` is called by each W1 override, but the multiplicity is variant-specific; C-style signed integer division truncation applies to the three SDIV paths. The formulas are derived from exact signed AArch64 `SDIV`, `MUL`, `LDR` and `BL` words, matched to per-type native field offsets in `dump.cs`. **These are catch-up horizons, not the numbers guaranteed to appear on screen, and not guarantees about GridObject IDs.**

| W1 type / method RVA | Number expression multiplying the maximum interval | RVA / opcode landmarks |
| --- | --- | --- |
| `ItemSpawning`, `0x057C0140` | `GetMaximumAmount() / MinNumberOfSpawn`, where `MinNumberOfSpawn` is +`0x54`; the maximum helper may use Area-choice overrides | Helper `0x057C02C0 BL 0x047941D0`; max `0x057C02E4 BL 0x047AB7F0`; `0x057C02E8 LDR W8,[X19,#0x54]`; `0x057C02EC SDIV W8,W0,W8`; `0x057C02F8 MUL X0,X20,X8` |
| `WildCropsSpawningInVillage`, `0x057C4350` | `GetMaximumAmount() / NumberOfGardensToSpawn`, denominator field +`0x58`, maximum helper RVA `0x047BCFA0` | Interval `0x057C44D0 BL 0x047941D0`; maximum `0x057C44F4 BL 0x047BCFA0`; `0x057C44F8 LDR W8,[X19,#0x58]`; `0x057C44FC SDIV`; `0x057C4508 MUL` |
| `FlowerSpawningInVillage`, `0x057CB7C0` | `MaximumAmount / NumberOfFlowersToSpawn`, direct fields +`0x60` and +`0x54` | Interval `0x057CB940 BL 0x047941D0`; `0x057CB95C LDR W8,[X19,#0x60]`; `0x057CB960 LDR W9,[X19,#0x54]`; `0x057CB964 SDIV`; `0x057CB970 MUL` |
| `FishSpawningInVillage`, `0x057C7EC0` | `MaxNumberOfPendingFishes` directly (no integer division), field +`0x60` | Interval `0x057C8098 BL 0x047941D0`; `0x057C80B0 LDRSW X8,[X19,#0x60]`; `0x057C80B4 MUL X0,X20,X8` |

No default positive/zero denominator assumptions, per-ID numeric values, Area actual count equality, overflow handling, or runtime successful spawns are asserted from these snippets. `WildCrops` and `ItemSpawning` call separate `GetMaximumAmount` methods; `Flower` uses direct fields; `Fish` describes PendingFish state, not GridObject allocation. TimeBending HOLD area-choice references `2010000093/2010000120` remain protected, not W1 exceptions.

### 2. `IsEventOver` is not a comparison of `Now` with EndDate

`IRecurringEventExtensions.IsEventOver` RVA `0x05AF3050` obtains `EndDate` through interface slot **3**, `NextOccurrence` through slot **1**, converts timestamps to date ticks, masks both values with `0x3FFFFFFFFFFFFFFF`, and at `0x05AF3230 CMP X8,X9` / `0x05AF3234 CSET W0,HI` returns true if **masked NextOccurrence > masked EndDate**. A null EndDate can return false; other invalid/no-result/error branches are not runtime tested. Source `Profile.ActualizeRecurringEvents` directly calls this helper at `0x05A2AF4C`, `0x05A2AF84`, `0x05A2B044`, `0x05A2B058`, with source BL words decoding exactly to `0x05AF3050`. This is a planned-occurrence/EndDate comparison; it is not a generic check for a wall-clock date being past EndDate, and is not proof that the event is removed from serialized save data. It constrains the catch-up loop, not the meaning of all other expiry/quest guards.

### 3. NextOccurrence, LastOccurrence, Grid and persistence are separate

The matching v1.25.3 IL2CPP serialized W1 structures have **`RecurringEventItemID` (+`0x18`), `NextOccurrence` (+`0x20`), `EndDate` (+`0x28`)** in all four variants. Only `ItemSpawning` also declares **`LastOccurrence` protobuf field #4 at +`0x30`**, with the previously verified Execute `0x057BF058 BL Timestamp.FromDateTime` and `0x057BF068 STR X0,[X8,#0x30]!` before `0x057BF0C4 Reschedule`. WildCrops, Flower and Fish lack this same serialized field; do not synthesize LastOccurrence for them.

`Reschedule` may produce a new NextOccurrence via virtual slot-2 setter; `ActualizeRecurringEvents` may also set it after the overdue clamp. Neither in-memory setter **proves** that a packaged save was written, that Grid objects already present were deleted or were left untouched by the wider game, or that subsequent loading will retain the new timestamp. In particular setting a future date does not directly delete an already spawned GridObject. The full object allocation/count/ID and save persistence paths require independent tracing and runtime acceptance.

### 4. Fish PendingFish remove is a distinct state mutation

Source `ProfileWorld.AddPendingFish` RVA `0x0598E6E0` is called from Fish.Execute at `0x057C70F4`. Separate `ProfileWorld.RemovePendingFish` RVA `0x0598E800` calls `MapField<TKey,TValue>.Remove` (instantiation RVA `0x03C141D0`) at `0x0598E874`, then optionally dispatches an event via slot argument 39 `0x0598E8B8 MOV W2,#39` / `0x0598E8E4 BLR X8`. It contains **no direct BL** to `Reschedule` `0x05AF24D0`, consistent with the previous 10-callsite whole-text scan. The dispatcher consumer and any indirect reaction, actual fish collection callbacks, server-origin update, or new occurrence update remain UNKNOWN. `PendingFish` key is not automatically a placed `GridObjectID`; a successful MapField removal does not prove a ripple was removed in a loaded scene.

### 5. Per-Event-ID evidence boundary (508 records, no write promotion)

For every source definition, `sourceRecordEvidence=CONFIRMED` refers **only** to the existing byte-verified v1.25.3 508-record source inventory. Before the caller supplies an independently known saved variant, `nativePerEventEvidence=UNKNOWN` and `variantConsumerStaticEvidence=UNKNOWN`; a matching caller-supplied W1 hint yields **`variantConsumerStaticEvidence=STATIC_ONLY`**, **not** `nativePerEventEvidence=STATIC_ONLY`, because the EventID→native stored variant mapping remains unverified. All observed game outcomes remain `UNKNOWN`; all operations remain `BLOCKED`.

| Example EventID | Source-only/W1 classification | Native matching saved subtype | Existing object, pickup, cooldown and actual next event |
| --- | --- | --- | --- |
| `2010000021` | Wood ItemSpawning candidate, source CONFIRMED | Type-level STATIC_ONLY when caller supplies ItemSpawning; **per-ID UNKNOWN** | UNKNOWN |
| `2010400001` | WildCrops candidate, source CONFIRMED | Type-level STATIC_ONLY when caller supplies WildCrops; per-ID UNKNOWN | UNKNOWN |
| `2010500008` | Flower candidate, source CONFIRMED | Type-level STATIC_ONLY when caller supplies Flower; per-ID UNKNOWN | UNKNOWN |
| `2010200014` | Inactive Fish definition | **BLOCKED** | UNKNOWN |
| `2010000064` | MoonstoneChest | **BLOCKED** separate online/reward gate | UNKNOWN |
| `2010000093`, `2010000120` | TimeBending HOLD exceptions | **BLOCKED** separate family | UNKNOWN |
| Unknown or mismatch ID/type | UNKNOWN | UNKNOWN | UNKNOWN |

The sample owner's `2126-08-20T00:00:00Z` value is allowed and may be deliberate decoration suppression. A future timestamp cannot be classified as damage by its magnitude. No writer allowlist, edited export, Area Grid deletion, or Moonstone movement was opened.

### 6. Falsification/QA next paths

Follow the **source-ID→concrete serialized RecurringEvent oneof discriminator→Execute implementation dispatch** at the appropriate save version; inspect explicit `GetMaximumAmount` handling and live grid item count sources, event activation/Quest/DLC conditions; trace the virtual PendingFish removal event listeners and real player pickup flow; distinguish already created GridObjects from future scheduled additions; find the transaction-to-persistent-save boundary in collaboration with 01 CORE without changing codec. Run read-only console comparisons with before/after area object manifests and cold reload when a safe QA environment exists. No static branch may become a guarantee of spawn or a product-level Writer PASS.

---


## Round 3 primary binary verification — current authoritative Native outcome (2026-11-02)

**Evidence classification: RAW_NSO_STATIC_VERIFIED, NOT RUNTIME_TESTED.** Round 1/2 sections further below are retained as research history where they disagree with the new direct-binary facts. Original Nintendo Switch v1.25.3 DDVRE private `ExeFS/main` Drive file ID `1towEM6WrKL6ZMwepI76xyPfpzxuqS6BN` was retrieved and verified **read-only**. Original same-version `Il2CppDump/dump.cs` Drive ID `17_y_G-olsu7zzOBcKwJg5YTFOW9JQbto` was retrieved as the method RVA index. Neither was committed or distributed.

| Raw artifact / identity | Measured primary evidence |
| --- | --- |
| Executable `main` | 96,027,926 bytes, SHA256 `16957e6ed546daeb196f296362d5ded885fad9eeff70584870f645e1204ca94a` |
| `NSO0` Module ID | `9A239D3DB569756D9EAAABD79771C522` (BID prefix `9A239D3DB569756D`) |
| Decompressed text | mem offset 0, 152,840,832 bytes, SHA256 `15d17f0b9e95d022368bbd89ec8feacec6f1feb2439bc9a37fe2f6bf2078a328` |
| Decompressed rodata | mem offset `0x091C3000`, 26,282,928 bytes, SHA256 `2a8f5c5c9203b9c42cf59cf540e0d017ff6bc9b6709c1c2c691241ffb508348c` |
| Decompressed data | mem offset `0x0AAD4000`, 13,050,504 bytes, SHA256 `c3ac6f93de050aafaacdcc9bf77d4712643726e25374ef0179823191cebb4ce6` |

All three decompressed section SHA256 digests independently match their NSO0 header hashes; raw main SHA matches the prior authoritative source. This is stronger than checking opcodes copied into a research JSON, but still **static**, with no console or save-write acceptance.

### Original X25 issue: RESOLVED_SOURCE_ANNOTATION_OFF_BY_4

The earlier evidence JSON incorrectly attached `MOV X25,X0` to `0x05A2AC94`. Direct LLVM 17 AArch64 disassembly of verified main text shows **`0x05A2AC94`: `0xB002B8C8` = `ADRP X8,...`**, immediately followed by **`0x05A2AC98`: `0xAA0003F9` = `MOV X25,X0`**. In `Profile.ActualizeRecurringEvents` (method entry RVA `0x05A2A170`), slot-6 `IRecurringEvent.GetMaxIntervalToFullyExecute` virtual calls at `0x05A2AC64` or `0x05A2AC8C` converge on the X25 save at `0x05A2AC98` (branches `0x05A2AC68 CBNZ X20 → 0x05A2AC94`, `0x05A2AC90 CBZ X20 → 0x05A2B568`; fallthrough otherwise). `0x05A2AE20 SUB X8,X8,X9`, `0x05A2AE24 CMP X8,X25`, and `0x05A2AE28 B.LE 0x05A2AF00` confirm the signed overdue threshold. `0x05A2B42C MOV X1,X25` feeds the maximum into subtraction `0x05A2B434 BL 0x0644CD70`. Later the register is **repurposed** at `0x05A2B4D4 MOV X25,X0` after `Timestamp.FromDateTime`, and at `0x05A2B530 MOV X1,X25` it holds the adjusted timestamp argument for the virtual setter `0x05A2B534 BLR X8`. These are different meanings of X25 at different program points. The earlier *semantic* catch-up model was supported; the specific original instruction annotation was shifted by exactly four bytes. This correction does not establish a universal future-date reset, event effect, or runtime setter invocation.

### Verified full direct BL graph for IRecurringEventExtensions.Reschedule

After scanning the complete SHA-verified text for direct AArch64 BL to target `0x05AF24D0`, exactly **10** sites were found and matched to original method RVA metadata. Each RVA is a source byte-backed direct callsite, not merely a source-family hypothesis.

| Method (dump.cs entry RVA) | BL Reschedule RVA |
| --- | --- |
| `ItemSpawning.Execute` (`0x057B9BC0`) | `0x057BF0C4` |
| `WildCropsSpawningInVillage.Execute` (`0x057C2BC0`) | `0x057C4260` |
| `FishSpawningInVillage.Execute` (`0x057C6890`) | `0x057C7110` |
| `FlowerSpawningInVillage.Execute` (`0x057C99E0`) | `0x057CAE58` |
| `FlowerDryingInVillage.Execute` (`0x057CDC10`) | `0x057CEC34` |
| `ChooseVillageArea.Execute` (`0x057D1020`) | `0x057D1DE8` |
| `MiningRockTurningSpecial.Execute` (`0x057D3860`) | `0x057D5378` |
| `PendingFishUpgrade.Execute` (`0x05800F40`) | `0x05801D50` |
| `ChooseItem.Execute` (`0x05807070`) | `0x0580737C` |
| `Profile.AddRecurringEvent` (`0x05A29920`) | `0x05A29F18` |

The original statement “nine Execute + one AddRecurringEvent” remains correct; indirect BLR calls, alternate writers and pickup/removal callbacks are **not** ruled out by this scan.

### W1-specific Native consumer, readiness and appearance constraints

| W1 variant | Exact Execute; direct IsReady references | Direct Reschedule | Other verified calls and caveat |
| --- | --- | --- | --- |
| ItemSpawning | `0x057B9BC0`; `0x057BA660`, `0x057BA684` | `0x057BF0C4` | `ConditionsList.Evaluate 0x057BAA10`; Area `ShouldSpawn 0x057BB090`; `GetMaximumAmount 0x057BBD88`; `GridState.get_ItemAmountState 0x057BC5BC`. False readiness at `0x057BA668/0x057BA688` bypasses this direct Reschedule. In-Execute RemoveItem helper is not a proof of player pickup rescheduling. |
| WildCropsSpawningInVillage | `0x057C2BC0`; `0x057C2FC8` | `0x057C4260` | Area `ShouldSpawn 0x057C34C0`; subtype `GetMaximumAmount 0x057C38E8`; `CreateGardeningTile.SetupGardenProduction 0x057C41D4`. False readiness branches `0x057C2FCC → 0x057C4264`, bypassing this Reschedule; source seed ItemID is not actual GridObject identity. |
| FlowerSpawningInVillage | `0x057C99E0`; `0x057C9DD4`, `0x057C9DF4` | `0x057CAE58` | `GridCollection.TryGetGrid 0x057CA490`; `TryPlaceFlowers 0x057CAE20/0x057CAE38`. False readiness branches `0x057C9DDC/0x057C9DF8` bypass `0x057CAE58`. No proof of successful placement or per-Area counts. |
| FishSpawningInVillage | `0x057C6890`; **0 direct BL to common IsReady inside this Execute** | `0x057C7110` | `TryGetVillageArea 0x057C6C34`; `GetNumberOfNormalBodiesOfWaterInArea 0x057C6C44`; `CountMatchingPendingFishForLocation 0x057C6E68`; `ProfileWorld.AddPendingFish 0x057C70F4`. This is PendingFish state; direct ripple/GridObject generation, alternative readiness checks and cold-reload outcome are still UNKNOWN. |

The three observed readiness-false branch paths bypass their *specific* Execute Reschedule callsites. None establishes that an already-spawned object disappears, an area cap is a hard Grid population count, pickup reschedules, or a future date suppresses every other mechanism. Fish has no direct BL to common IsReady in its Execute, but alternative/interface checks are not excluded. The per-event-ID semantic ledger remains **source-variant-hint-only**, not a verified saved subtype or GridObject provenance. Always exclude Moonstone `2010000064`, TimeBending `2010000093/2010000120`, Snippet W2, inactive IDs and unknown variants from any Writer authority.

### Reschedule callee: interval variant and virtual NextOccurrence setter (raw NSO)

Directly verified at `IRecurringEventExtensions.Reschedule` RVA `0x05AF24D0` from the same primary SHA-checked NSO: `0x05AF25E8 LDR W8,[X0,#0x20]` reads the interval oneof case, then `0x05AF25F0 CMP W8,#2` / `0x05AF25F8 CMP W8,#1` dispatch the two recognized interval types (the method's C# `Duration` / `TimeOfDay` forms; this is **not** a universal per-ID interval guarantee). `0x05AF2A60 BL 0x05AF2D60` and `0x05AF2C30 BL 0x05AF2D60` call `<Reschedule>g__SetNextTimeOfDay|0_0`. After a candidate next Timestamp is computed, `0x05AF2C7C MOV W2,#2` selects `IRecurringEvent.set_NextOccurrence` interface slot 2, `0x05AF2CA0 MOV X1,X20` passes the computed value, and `0x05AF2CA4 BLR X8` invokes its virtual setter. This is independent primary **STATIC** proof of an explicit Reschedule → NextOccurrence setter path and does not show how any pickup/removal code calls this helper, what concrete ID is being scheduled, whether the setter persists on cold reboot, or whether an actual spawn was successful. Tests reconstruct both helper BL targets from primary instruction words and verify the static setter proof flags. All write/edited-export permissions remain false.

### QR and next steps

Pinned opcode words (not raw game bytes) in Node tests reconstruct the ten direct Reschedule targets and five W1 readiness callsite targets. Preserve source fingerprint distinctions and reject tests that confuse branch-condition reachability with runtime success. Next investigate `Reschedule` callee's actual timestamp calculation, `AddRecurringEvent` ExecuteOnAdd flow, Fish alternate clock/expiry logic, per-Area caps and mutation/harvest callbacks with 01B Grid identity evidence. Main/NSO bytes remain private. No save change, Writer, edited export, Grid deletion or Moonstone movement is authorized.

---

**Legacy Round 1/2 evidence class: STATIC_ONLY.** This document does **not** claim Nintendo Switch runtime acceptance, save write compatibility, a native timer setter, or automatic GridObject delete/move permission.

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

**Historical Round 1/2 limitation; superseded by primary NSO verification above:** No complete `Execute` RVA was evidenced in the then-consulted derived research for ItemSpawning, WildCropsSpawningInVillage or FishSpawningInVillage. `ItemSpawning.Execute 0x057C...` is incomplete and must not be normalized into an exact address or ported to a later build.

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

### Historical Round 2 contradiction at 0x05A2AC94 (resolved above)

The artifact reports `RVA 0x05A2AC94`, opcode `0xB002B8C8`, text `mov x25, x0`, interpreted as storing `GetMaxIntervalToFullyExecute` into X25. Independent decoding of **the provided 32-bit opcode**, using LLVM's AArch64 disassembler, produces **`adrp x8, ...`**, not `mov x25, x0` (the latter register alias encodes `0xAA0003F9`). This establishes an **historical EVIDENCE_METADATA_CONFLICT**, resolved above by the independently verified executable. The original source may contain an annotation or address transcription error. Re-fetch the version-matched main and independently re-check bytes at 0x05A2AC94 and the actual X25 def-use path before marking the maximum-time argument setup exact. This dispute does **not** automatically invalidate the independent 0x05A2AE20 SUB / 0x05A2AE24 CMP / 0x05A2AE28 B.LE opcode sequence or the later arithmetic/callsite facts, but it prevents an unqualified claim about X25 initialization at the disputed address.

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
