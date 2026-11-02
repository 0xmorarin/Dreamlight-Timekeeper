# DDV structured ItemID semantics — Wand-first reuse contract

Status: **01D EXISTING CONFIRMED MODEL REUSED + TIMEKEEPER SOURCE-LINK AUDIT**, no editor writer, no native Grid removal approval.  
Baseline: Wand Switch v1.24.13 (16,930 definitions), Switch v1.25.0 (17,413 definitions, ID encoding mismatches 0), Timekeeper Switch v1.25.3 source event registry (508 event definitions).  
Shared canonical (Wand ↔ Timekeeper): https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit  
01D initial v1.25 source contract: https://docs.google.com/document/d/1GutzUiTVWrTeJ_8I1VrXMtFxzX9h2DR1O2GdxoyjuNQ/edit  
Wand Phase 1 Game Database: https://docs.google.com/document/d/1zZMWfIKJJjSIoVFtIveccER-IWWsjts3HWaitz6OKdA/edit  
Wand Game DB source/current handoff: https://docs.google.com/document/d/1qjxZtSi6JeNegAtY6DWtcKfEdR8gB-29yBmqcXU3mYQ/edit

## 1. Numeric structure (already verified by Wand; not a new hypothesis)

Wand's existing definition builder has verified all observed valid definition IDs against:

- `ItemID = ItemType × 10,000,000 + Index`
- `Index = Subtype × 100,000 + SubtypeIndex`
- `ItemType = floor(ItemID / 10,000,000)`
- `Subtype = floor((ItemID % 10,000,000) / 100,000)`
- `SubtypeIndex = ItemID % 100,000`

A real item example `31700014`: `ItemType=3` (ActivityItem, per Wand source), `Index=1700014`, numeric `Subtype=17`, `SubtypeIndex=14`. Source-linked `31700131` Pine Cone and `31700121` Moss also have `ItemType=3, Subtype=17`; **Subtype17 cannot by itself mean "Wood"**. `30400121` Oregano Seed is `ItemType=3, Subtype=4`; `30800059` Dandelion is `3:8`; `31300003` Small Night Thorn is `3:13`; `40600010` Large Coral is `4:6`. All names here come from the existing normalized v1.25.3 event source items, *not* guessed from digits.

The per-version `Definitions.Items` enum, concrete `ItemData` class, `Tags`, `Set`, `CollectionSet`, localized names and availability/provenance remain necessary. Numerical ItemType/Subtype is a stable *syntactic namespace*, not a full item kind, spawn source, inventory route or permission. Old or new versions may change versioned semantic metadata; the Wand snapshot and UpdateDiff must detect this, not treat the same number as an eternal authorization.

## 2. Recheck of the 508 v1.25.3 recurring source definitions

Source: `data/events-v1253.json`, source framed Protobuf SHA-256 `028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea`, Switch BID `9A239D3DB569756D`, schema626. Exactly **489 source-to-item links**, **244 distinct linked ItemIDs**, **11 observed numerical (ItemType,Subtype) pairs**. This source does not contain the complete global v1.25.3 Game DB; these statistics are for event-linked items only.

| Numeric ItemType:Subtype | Linked occurrences | Unique linked ItemIDs | Examples / context |
| --- | ---: | ---: | --- |
| 3:8 | 157 | 93 | flower generation sources, e.g. Dandelion |
| 3:13 | 93 | 24 | Night Thorns and certain activity objects; also event/ground contexts |
| 4:6 | 85 | 52 | obstacle/ground/event furniture-like object definitions |
| 3:17 | 53 | 17 | *mixed* Wood, Moss, Pine Cone, Sequin Strands, other forage |
| 3:4 | 38 | 20 | herb/wild crop source-linked seeds, not automatically the generated GridObject.ItemID |
| 12:2 | 37 | 19 | Snippet linked items; typed enum verification needed for exact display subtype label |
| 3:14 | 8 | 5 | daily reward item and event/loot sources; not interchangeable with recurring event ID |
| 3:2 | 8 | 4 | Cinnamon and other ingredients/events |
| 3:11 | 5 | 5 | shells and similar items |
| 3:0 | 4 | 4 | limited event material links |
| 3:10 | 1 | 1 | Mussel |

These counts describe **links**, not independent events, spawns, actual owned stock, or saved world objects.

## 3. Architecture for upgrade resilience

1. On any encountered valid numeric item ID, decode `ItemType`, `Index`, `Subtype`, and `SubtypeIndex` using the pure Wand-proven formula.
2. Lookup by full `ItemID` in same-version Wand 01D lossless Game DB; if found, verify the ID, `ItemType`, `Index`, `Subtype`, and **concrete ItemData class** match before semantic use. Resolve versioned enum names, UI taxonomy, tags, localization and provenance from its canonical derived indexes.
3. On absent or newer-than-researched IDs, show the numeric identity with label **UNREVIEWED**, not a guessed semantic category. Continue read-only inspection; writes and destructive Grid operations remain disallowed per field until the new source has been validated.
4. For a game update, rebuild the authoritative 01D snapshots from new game data and compare category/enum, concrete type, tags, source relation and item aliases/variations. The ItemID formula may still hold while semantics change; source equality and runtime restrictions are separate checks.
5. A recurring `RecurringEventItemID` (e.g. `2010000021`) is a definition in an **event namespace**, not evidence of the same `ItemID` as the generated resource (`31700014`) or the save-local `GridObject.ID`. Keep three identifiers distinct.
6. Do not blindly rename `Wood` source group by numeric `3:17`: canonical `Wood` source-linked material records require concrete names and ItemID set, while the same numeric subtype includes other foliage, shells and collecting items.
7. Future Wand integration should reuse this source-proven decoder and optional Game DB identity verification; do **not** re-extract the full 17,413-item DB or copy its raw assets into Timekeeper.

## 4. Implementation and tests

- Pure `src/item-id-structure.mjs` has `decodeStructuredItemId` and `verifyItemDefinitionIdentity`. No browser or Node dependency, no side effects or write privileges. Source enum/class validation remains delegated to the caller and versioned Wand metadata; a numeric ID match is explicitly `semanticVerified=false`.
- `src/decoration-spawn-evidence.mjs` uses the structural decoder as a **cross-check** for original definition-linked items and retains exact source-family grouping plus known, source-linked six wood material IDs. It never promotes `3:17` alone to wood.
- `tests/item-id-structure.test.mjs` tests the numeric formula and 244 distinct linked real item IDs against 508 source events, rejects invalid/inexact numbers, and verifies `3:17` wood/nonwood ambiguity.
- Existing 01D tested artifact is authoritative for all-game coverage; the Timekeeper data/events-v1253.json remains authoritative only for the reviewed event source. No synthetic fixture provides a newly verified actual ItemData or runtime Grid write.

## 5. Further native source verification

- Recover the current v1.25.3 `Definitions.Items` enum and Game DB source index, not just v1.25.0. Determine whether observed item type/subtype enum assignments are unchanged; record the source hashes.
- Obtain a version-matched actual spawn `GridObject.ItemID` vs the *source-linked item definition ID* for WildCrops (the `items` link may be a **seed** ID), wood, NightThorn and flowers.
- Trace generated-vs-player-placed source state `GridObject.From`, conditional event history and native removal/reschedule before bulk removal or save writing.
- Keep Owner's 100-year future scheduled values as user-intended; the ItemID classification does not determine clock values or timestamp write permission.

## 6. Superseding direct source proof: v1.25.0 → v1.25.3 (2026-11-02)

Prior open question for the **244 event-linked ItemIDs** is now resolved: the actual v1.25.3 `ActivityItem.json` (3,716 frames), `Furniture.json` (6,233) and `Companion.json` (362) were read from the original DDVRE GameRoot/itemlist source, each frame's varint Item.Index and inner full protobuf ItemID were checked, and **all 244/244 linked ItemID raw protobuf payload bytes matched v1.25.0 Wand lossless DB SHA-256 exactly; 0 changed/missing**. This is not a claim that the *entire* v1.25.3 item universe matches the v1.25.0 baseline.

The complete v1.25.0 Query Index contains 17,413 concrete typed definitions and **114** distinct numeric (ItemType, Subtype) pairs, with zero same-pair subtype-name or concrete-type conflicts. `src/wand-item-taxonomy.mjs` adds a read-only consumer with explicit `EXACT_VERSION_ITEM_DEFINITION`, `HISTORICAL_ITEM_DEFINITION`, `NUMERIC_FAMILY_ONLY` and `UNKNOWN_NUMERIC_FAMILY` statuses; no historical match is promoted to a save-write authorization.

Cross-build Tag corpus was **also byte-identical**: SHA-256 `1208fc88a6b6b47346a6e8680db831b6a6751115adef34c4baf4ff7abdae9f3f` in both v1.25.0 and v1.25.3 original `Tag.json`. Gameplay `isWood` (`2001200062`) therefore has the same underlying source definition as the accepted Wand 01D v1.25.0 tag. All 14 distinct item IDs referenced in the 52 legacy `木材・落下素材` event definitions have byte-identical v1.25.0/v1.25.3 item payloads, permitting the 40 `isWood` / 12 non-wood source categorization.

This resolves classification and source-tag stability **only**. It does not establish whether any linked ItemID is the same as the spawned `GridObject.ItemID`, whether the object was generated by the event, which native removal transaction is appropriate, or whether any stored `NextOccurrence` is safe to rewrite.

Sources: actual v1.25.3 DDVRE itemlist folder https://drive.google.com/drive/folders/1mfm2PpUtQx7rDusFSuXDVUF0r3H2YljC ; Wand v1.25.0 lossless https://drive.google.com/file/d/1_iMow5gXJTmgbogw1y7S8vTQp-Bj2vI8/view ; verified source/hash ledger https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit ; source-bounded 14-item `isWood` pack `data/wand-iswood-crosswalk-v1253.json`. This research keeps all writer/delete booleans false and does not create an independent full Game DB.
