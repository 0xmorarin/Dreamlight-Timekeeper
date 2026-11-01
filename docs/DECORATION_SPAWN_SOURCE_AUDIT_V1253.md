# Decoration-first recurring-event source audit — Switch v1.25.3

Status: **STATIC SOURCE-LINK AUDIT PASS / TIMER WRITES AND GRID REMOVAL NOT AUTHORIZED**  
BID: `9A239D3DB569756D`  
Profile schema: `626`  
RecurringEvent source SHA-256: `028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea`  
Project source: `data/events-v1253.json` (508 event definitions).  
Wand-first evidence: DDVRE 01D Game DB, 01B World/Grid, Grid identity/dependency, 01A Save, 01E read-only acceptance.  
Shared provenance/read-reuse index: https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit

## Why this audit exists

The product priority is reducing unwanted *naturally recurring* world objects during decoration, not diagnosing all distant future timestamps as corruption. These definitions are **event identities**, not the world object's own `GridObject.ID`. The `items[].id` links are item-definition IDs exposed by the source projection; they are **not confirmed as the exact serialized GridObject.ItemID** until the native spawn path and a real saved Grid are correlated. A source W1 policy remains STATIC research only, not a writer authorization.

## Current source classification

| Family | All source definitions | `active=true` definition flags | What the count means |
| --- | ---: | ---: | --- |
| Obstacles / thorns | 76 | 29 | Includes 16 Night Thorn definitions plus 60 other obstacles; quest/world exclusions still needed |
| Wild crops / herbs / spices | 38 | 7 | Source-linked `items[].id` sometimes refer to seed items; actual spawned object identity unverified |
| Flowers (generation only) | 157 | 40 | Excludes `DefaultFlowerDrying`, not a generation event |
| Wood material / fallen branches | 31 | 12 | Exactly six linked material ItemIDs from the versioned event pack |
| Other forage in same legacy display subgroup | 21 | Research only | Includes cinnamon, moss, mussel, pinecone, rush, sequin strands, copter seeds and oak leaves |
| All other event families | 185 | Research only | Not primary decoration candidates and include protected/conditional families |

**Totals: 302 source-defined primary decoration candidates / 88 with `active=true` in the definition.** `active=false` events remain in the source catalog and must never disappear from a historical or cross-version index. Neither boolean proves an event is currently scheduled or safe to modify in a user save.

### Confirmed source-linked wood ItemIDs

| Item | Item ID | Event count | Representative event ID |
| --- | --- | ---: | --- |
| Softwood / 軟材 | `31700014` | 8 | `2010000021` |
| Hardwood / 硬材 | `31700008` | 9 | `2010000073` |
| Dry Wood / 乾燥木材 | `31700003` | 4 | `2010000075` |
| Dark Wood / ダークウッド | `31700002` | 1 | `2010000079` |
| Tropical Wood / 熱帯木材 | `31700038` | 4 | `2010000100` |
| Reclaimed Barn Wood / 古納屋の木材 | `31700156` | 5 | `2010000180` |

Examples deliberately not in this wood subset:
- `2010000113` (`Expansion01!Wood!CinnamonJungle`) links Item `30200147` Cinnamon, despite containing `Wood` in its event name.
- `2010000138` links Mussel `31000084`; `2010000140` links Pine Cone `31700131`.
- Accordingly, selecting all legacy `木材・落下素材` items as "branch" objects is incorrect. The UI splits source subgroups `木材・落下枝` and `その他の落下素材`, but **does not automatically edit either**.

### Three distinct identities to track for any safe removal operation

1. **RecurringEvent definition ID**: e.g. `2010000021` governs a source spawn schedule.
2. **Linked ItemID / Item definition**: e.g. `31700014` is a source-linked material identity, not a saved object's unique identifier.
3. **Saved GridObject address**: `(GridID, GridObject.ID)` plus actual `GridObject.ItemID`, State/Source and optional `ConditionalEventHistoryData.SpawnActionState.SpawnedObjects` links. One ItemID can be present in multiple grids and instances; a single event may spawn several objects.

For bulk-removal research, only the third identity can select a specific field object. Verify source-spawn provenance (not player placement or mission reference) and native removal side effects before enabling any destructive operation.

## Remaining native verification queue

1. Resolve the v1.25.3 spawn implementation path for `ItemSpawning`, `WildCropsSpawningInVillage`, `FlowerSpawningInVillage` and other source families, including actual GridObject.ItemID, GridObject.State/From, generated object ID and ConditionalEvent spawned-object references.
2. For **wood and fallen branches**, specifically trace `Wood!...` and `Foraging!...Wood...` resource events. Confirm whether all visible dropped sticks are owned by the same source schedule or by a separate tree/foraging mechanism; names alone are inadequate.
3. Correlate saved event `RecurringEventItemID` and `NextOccurrence` with concrete spawned GridObjects and their proper Area/root/subgrid. Source catalog grouping does not prove the in-game generated object exists.
4. Trace native removal/pickup and population-count changes. Evaluate whether a long future schedule suppresses *new spawning* without clearing already spawned objects (a separate operation).
5. Define exact event-ID and exact GridObject allowlists, quest/mission exclusions, corruption handling, save-write preservation and console cold-reload tests. No source metadata flag alone authorizes writes.

## Machine-verifiable implementation

`src/decoration-spawn-evidence.mjs` compiles the evidence from the single canonical `data/events-v1253.json`. It distinguishes source family, active metadata and mutability independently. It never mutates the user save and hardcodes the following capability booleans to `false`: `writerAuthorized`, `bulkDeletionAuthorized`, `linkedItemIsPlacedGridObjectVerified` and `runtimeSpawnAndRemovalVerified`. Version, BID, schema and event-source SHA must match the reviewed baseline.

`tests/decoration-spawn-evidence.test.mjs` guards source counts, specific event-to-item links, exceptions including Cinnamon, Moonstone/area selectors, invalid source fingerprints, and inactive-vs-candidate separation. Tests cannot establish Switch runtime acceptance.

The future Wand integration consumes this evidence through the shared DDVRE index and an explicit versioned adapter; it must not replicate the 508 source records or inherit independent writer permissions.


## Follow-up: offline read-only GridObject ItemID candidate crosswalk

`src/decoration-grid-audit.mjs` implements `auditDecorationGridItemMatches(profile,source)` for **research only**. It consumes the exact Switch v1.25.3 source fingerprint and walks only the directly referenced Area GridIDs in `World.Villages[].Areas[].GridIDs` and `World.GridCollection.Grids[gridId].Objects`. Each matching saved GridObject must have a valid (GridID, map key == GridObject.ID), and its actual `GridObject.ItemID` must match one of the source-linked primary decoration Item IDs.

Results contain only: selected GridID/GridObjectID, ItemID, *possible* recurring source event IDs, source families, direct area locator if uniquely determined, unresolved area ownership, state presence and counts. For an Item ID shared across 8+ source event definitions, the output deliberately retains all possible source event IDs rather than assigning an invented origin. Saved GridObjects in technical/indirect grids, including untraced SubGrid ownership, are **not** analyzed by this first pass; do not interpret non-match as object absence. Area entries with the same GridID in multiple Areas remain ambiguous; category validation and native spawn-origin evidence are independent blockers.

Every matched object remains `sourceProvenanceVerified=false`, `nativeRemovalVerified=false`, `bulkDeletionAuthorized=false` and `timestampEditAuthorized=false`. This module does **not** alter the user's save or call any writer. It does not pretend that `GridObject.ItemID` matches alone identify a naturally generated object rather than a player-placed or quest-linked one. It deliberately avoids resolving source `GridObject.From` semantics, historical event references and object-owned SubGrids without authoritative v1.25.3 source proof. Performance budgets for direct grids and individual objects cause fail-closed errors instead of partial results.

`tests/decoration-grid-audit.test.mjs` uses small synthetic Areas/Grids to distinguish exact Item ID matches, excluded Cinnamon and Moonstone Chest, a technical/unreachable Grid, ambiguous multiple Area references, duplicate/mismatched object IDs, source fingerprint mismatch, input immutability and output guards. Actual Switch profile/console behavior remains untested for this new crosswalk.
