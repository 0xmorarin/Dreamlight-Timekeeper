# Wand 01A/01B GridObjectAddress dependency reuse — v1.25.3 Timekeeper research

Status: **01A/01B SOURCE VERIFIED / READ-ONLY SCHEMA626 PROJECTION / NO GRID REMOVAL OR SAVE WRITER AUTHORITY**  
Scope: source Switch v1.25.0 schema624 Wand accepted; current Timekeeper Switch v1.25.3 schema626 *projection only*, BID `9A239D3DB569756D`. Do not treat a v1.25.0 RVA or source contract as independently verified v1.25.3 native behavior.

## Canonical Wand SSoT (read first)

- 01A Save Core current handoff: https://docs.google.com/document/d/1ZFAdqWae-BmORG8RXVMFHz7yweAAdk8Chrevxo-l-cg/edit
- 01B World/Grid current handoff: https://docs.google.com/document/d/1d4l-GG5W0F3cSRIltgZyA_ZTzf8Nv7r0QG1h7Sr2x2w/edit
- Legacy source/native Grid transaction read-only research: https://docs.google.com/document/d/1aa4-aX9do1wy5dZb0VN4ftp7BGbtKaG_6dYthDG5vpM/edit
- Actual original 01A code + tests + JSON Schema + fixture summaries: [DDV_CORE_SAVE_PROGRESSION_REFERENCE_INDEX_V125_V1_0_2026-10-02.zip](https://drive.google.com/file/d/1W_N_5G_RAd_zD42ODwr3NKRLQX_hYuYS/view), **SHA-256 `340fcab446a0f2e7db31604a927d90e1664398652285e325da2b1bcb092d480b`**, ZIP CRC PASS. 01A source file `src/progression-reference-index.js`; 01A contract `ddv.progression-reference-index@1`.
- Cross-product SSoT: https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit

The 01A ZIP is an existing verified Wand artifact. We did **not** copy its raw fixture saves, complete 34 KB adapter, or full Game DB into the public Timekeeper repo. Instead, the code below reuses its exact typed reference semantics and path definitions with a bounded v1.25.3 read-only adapter.

## Accepted existing Wand facts (do not re-investigate)

1. `/ConditionalEventHistory/ActiveEvents/*/SpawnState/SpawnedObjects/*` has **exact {GridID, GridObjectID}** of active conditional-event-controlled world objects. It is `ACTIVE_IDENTITY_REFERENCE`; for identity-changing operations this is a veto. An active entry **is not** merely historical and may outlive the save-local materialized GridObject.
2. `/Player/LastUsedLinkedEnvironmentEnter/*` stores an exact entry location/address; `UNKNOWN` system pointer, not active quest proof but not safe to rewrite or remove without separate logic.
3. `/Player/AchievementsData/*/GridObjectsCollected/GridObjectAddresses/*` and `/Player/DutySlots/*/Slots/*/StepData/GridObjectsCollected/GridObjectAddresses/*` are `HISTORICAL` collected-object bookkeeping. A historical address can point to a currently materialized GridObject; that does **not** make it active ownership. Preserve history instead of rewriting it by default.
4. Other identity-sensitive or category-specific contexts include Mission objective collected IDs, Keyhole state, Garden sapling IDs, and unknown native consumers. A missing match from the above subset is **not** proof that the object can be deleted.
5. Wand 01B v1.25.0 static path: `ConditionalEventHistoryData.Initialize` RVA 0x58B44A0 -> `Evaluate` RVA 0x58B5040 -> `UndoAction` RVA 0x58B5880 -> `UndoSpawn` RVA 0x58BC360 -> `RemoveFromGrid` ValidateThis RVA 0x57D0920 / ApplyThis RVA 0x57D21E0 -> `ActiveEvents.Remove`. `RemoveWhenDone` only controls automatic removal when an **already active** condition transitions false; it does **not** mean "when Mission completed". The `SpawnedObjects` list is not individually cleared by `UndoSpawn`. Removing the active-event entry is not proof all object removal attempts succeeded. Re-evaluation during reload can trigger `UndoSpawn` for non-`DoOnce` events; `DoOnce` has different handling. These are **v1.25.0 static facts**, not transplanted v1.25.3 RVAs or completed runtime tests.
6. The Wand schema624 authoritative Switch save had 1,716 active ConditionalEvent addresses, only 42 save-local ItemID resolutions (3 normal GridObjects, 39 DiffGrids.ModifiedObjects), and 1,674 save-local unmaterialized addresses. These are *observations about that sample*, not general event counts or 1,674 corruption reports. The accepted 01A work did 11/11 synthetic tests; it does not grant world writes.

## What Timekeeper now does

`src/wand-grid-reference-index.mjs` projects 01A-proven paths read-only from the **uploaded** save (not the above personal example). It distinguishes active conditional-event refs, historical Achievement/Duty bookkeeping, and unknown system entrance refs; resolves exact save-local addresses through Grids/Objects, DiffGrids/ModifiedObjects or DiffGrids/RemovedObjects with `SAVE_LOCAL_OBJECT_NOT_MATERIALIZED` preserved as distinct. Includes bounded counts, original-source contract version, observed profile schema, non-authoritative flags, and explicit structural anomalies. The original save remains unmodified.

`src/decoration-grid-audit.mjs` enriches **source ItemID-matching** read-only Grid candidates with `referenceAssessment`, matching active event IDs, unknown and historical reference counts. A reference is exact by `GridID:GridObjectID`, not by the source ItemID. Possible states:

- `ACTIVE_IDENTITY_REFERENCE` – identity is held by an operational ConditionalEvent; delete/move authority blocked.
- `UNKNOWN_SYSTEM_REFERENCE` – recoverable location/system reference, not proof of quest ownership but still blocked.
- `HISTORICAL_ONLY_REQUIRES_OTHER_GATES` – only collected-history address matched, preserved; not positive deletion proof.
- `INCOMPLETE_REFERENCE_GRAPH` – unknown/malformed/missing active source; blocked.
- `NOT_EVALUATED` – unavailable Player root; blocked.
- `NO_MATCHED_KNOWN_REFERENCE_OTHER_GATES_OPEN` – scanned known subset but no match; other identity layers/native consumers still open.

Every row retains `sourceProvenanceVerified=false`, `nativeRemovalVerified=false`, `bulkDeletionAuthorized=false`, `timestampEditAuthorized=false` and a source-only `ItemID` match. The source `GridObject.From` field is **observed if serialized but not interpreted**, because an authoritative native enum/provenance transition contract has not been accepted. **No runtime `From` meaning is invented.**

## Source/version and feature boundary

- Baseline 01A full adapter is **schema624 only**, tests & real sample acceptance v1.25.0. The Timekeeper subset accepts schema626 data as **research read**, carries `schema626Revalidated=false`, and never claims full `ddv.progression-reference-index@1` output equivalence. For newer unresearched saves, fail closed on malformed path shapes while permitting read-only inspection.
- 01B ordinary Grid transform uses different geometry+root authorization; do not reuse for automatic-spawn items, quest objects, or Moonstone Chest as though ordinary Furniture placement were proven. Current source `automaticSpawning=true` / unknown item classes and persistent commit remain unsupported.
- RecurringEvent ItemID, linked ItemID, saved GridObject.ID, ConditionalEvent ID and exact GridObjectAddress are distinct identities. No source-link ItemID match establishes event-created origin.
- Future manual `NextOccurrence` edits require independently verified save-session writer, allowlist, and console cold-reload. Current research index cannot elevate a timestamp path or mass deletion to editable.

## Next work (targeted)

1. Reuse 01A/01B existing current schema626 read-only / v1253 structural comparison to validate the exact reference path types against real saved samples, without disclosing personal addresses.
2. Trace `GridObject.From` enum, origin setters and lifecycle across spawn `ItemSpawning.Execute`, `FlowerSpawningInVillage.Execute`, wild crop, pickup and RemoveFromGrid with actual v1.25.3 native binary. Distinguish runtime automatic vs user-placed vs quest objects.
3. Determine source-event vs saved GridObject association for 311 candidate source definitions and exclude active conditional-event or unknown identity-bearing referenced objects. Build dry-run deletion plan before any writer.
4. Independently verify grid removal, NextOccurrence reschedule, population cap and cold-load on disposable Switch save. Preserve existing user intentional ~100-years-future suppression.

Static analysis and synthetic CI are **not** actual console removal, roundtrip writer acceptance, or permission to mutate saves.

## 2026-11-02 private real-save read-only regression, diff-grid caveat

The existing Wand 01E accepted Switch schema626 source was decoded *locally and read-only* and checked against 01A's exact identity-reference paths. See the internal **DDVRE/00_PROJECT** cross-product research SSoT for aggregate denominators and the redacted machine-readable evidence; no raw source profile or per-object addresses are committed to this public repository.

Key structural findings: the older 01A schema624 profile is **not** the same sample as the schema626 profile. Both have many operational ConditionalEvent refs that cannot be resolved through save-local Grids/DiffGrids, and **some source ItemID matches are stored in DiffGrids.ModifiedObjects with active exact-address ConditionalEvent references**. Thus `World.Villages→Areas→GridIDs→Grids.Objects` alone is an insufficient exhaustive search for field objects or unsafe ownership references.

The v1.25.3 sample also demonstrated that serialized `GridObject.From` is frequently omitted from ordinary Grids.Objects and that a small set of Diff ModifiedObjects carries named `GridSource_...` values. The `From` enum alone has **no accepted generated-vs-user-placed origin mapping** here. Its absence must never imply an object was automatically spawned, and its presence must not be interpreted as a secure removal authorization.

Accordingly, `src/decoration-grid-audit.mjs` now returns a separate `diffModifiedMatches` read-only result (never blended into direct Area matches). Each has exact reference assessment, `locationRoleVerified=false`, `sourceFromSemanticsVerified=false`, `sourceProvenanceVerified=false`, `nativeRemovalVerified=false` and `bulkDeletionAuthorized=false`. Malformed DiffGrid identity or map shapes produce explicit diagnostics; the total object-processing budget covers both direct Grids and DiffGrids. No deletion, move, serialization or per-profile mutation is performed.

This is a **read-only actual-save structural observation**, plus synthetic tests of the new source adapter, not independent actual save mutation or console runtime verification.
