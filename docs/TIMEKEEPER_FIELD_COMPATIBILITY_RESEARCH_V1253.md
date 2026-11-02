# Timekeeper per-field timing research compatibility — 2026-11-02

Status: **STATIC RESEARCH CLASSIFICATION / NOT WRITER AUTHORIZATION**.

## Reused authority

Existing Wand 01A save/codec/versioning contract, 01E Switch v1.25.3 real-save **read-only** acceptance, and Timekeeper's v1.25.3 508-event source registry / 21 static timing rules. The source evidence build is Nintendo Switch DDV v1.25.3, BID `9A239D3DB569756D`, schema `626`; the uploaded save does not itself contain proof of its executable BID.

Owner product decision: decoration-friendly user-selected `NextOccurrence` changes, including deliberate 100-year future dates, take precedence over automatic time-travel anomaly repair. Existing future timestamps do not imply broken saves.

## New standalone contract

`src/core/timekeeper-timing-compatibility.mjs` accepts the **Worker-owned parsed profile**, its verified-source read-only projection, and a proposed exact-path timing plan. It reruns `inspectTimingPlan`, rejects missing/modified static rule provenance, and returns **only a research report**.

- `STATIC_W1_RESEARCH_CANDIDATE`: source schema 626; exact original `NextOccurrence` path, single known event variant and ID observed; source rule is `nextOccurrence`; event family is ordinary `ItemSpawning`, `WildCropsSpawningInVillage`, `FlowerSpawningInVillage`, or `FishSpawningInVillage`; source definition has `active=true`, `W1` static research policy and native evidence.
- `SCHEMA_VERSION_DRIFT_REVIEW`: same source-shaped candidate on another save schema. Loading/inspecting newer profiles is allowed when the codec recognizes them, **not** auto-promoted to native-semantic or writer compatibility.
- `PREFLIGHT_NOT_STRUCTURALLY_OBSERVED`: missing, changed or ambiguous exact source path, event ID, original time or oneof; no research promotion.
- `MOONSTONE_CHEST_SEPARATE_STATE`, `FIELD_FAMILY_OUT_OF_SCOPE`, `CONTROL_EVENT_PROTECTED`, `EVENT_POLICY_NOT_W1`, `DEFINITION_MARKED_INACTIVE`, `DEFINITION_ACTIVITY_UNKNOWN`: separate, excluded or unproven systems (Moonstone rewards, Snippet W2, protected controls, inactive definitions, shop/reset/growth counters).
- Source review's historical HOLD_2126 and HOLD_DISTANT_FUTURE warnings **are not automatic exclusions** from the research status: a deliberate distant-future timestamp is a legitimate proposed date, not confirmed corruption.

All emitted rows and totals keep `sourceBuildVerified=false`, `sourceNativeSemanticsVerified=false`, `fieldSerializationAccepted=false`, `consoleColdLoadAccepted=false`, `operationAllowlisted=false`, `writerAuthorized=false` and `editedCopyAuthorized=false`. The report is not an executable allowlist. The separate shared Wand 01A writer registry was not modified.

## Acceptance and remaining steps

- Regression tests cover known W1, distant-future dates, active/non-active definitions, Moonstone, W2, wrong source registry identity, stale original, newer schema, and unknown active state.
- Worker sends the report with the source preflight response under the same save `sessionId`. UI displays research classifications in the preview plan but does **not** offer edited save export.
- **Before allowing writes:** determine original/native source event ID + protobuf declaration/field number and operation semantics, reference/capacity/area/DLC dependencies, per-version exact serialization/unknown-field preservation, packaged metadata parity, and disposable Switch game load/save/relaunch acceptance. A source schema match or a synthetic Codec PASS does not satisfy these gates.
- Unchanged original backups continue to be returned byte-for-byte; no direct source overwrite, ZIP download, time-travel auto-repair, spawn Grid deletion, or Moonstone chest relocation is authorized by this report.

Canonical shared source: https://docs.google.com/document/d/1JFEcHRWclsGLkRsW9-lMcfgcNiGoeVRoL6xaJ-8CDd8/edit
