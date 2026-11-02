# 03 WEB × 04 ASSET — isolated UI integration contract, 2026-11-02

STATUS: **INTEGRATION REHEARSAL ONLY**. No permanent merged UI build, release status, save writer or edited-save export.

## Fixed input provenance

- WEB/Session: PR #10 `feat/web-session-backup-guards`, parent PR #2 `9ebdac063b81934eee37a62e5694749b1cf1aa65`. Existing read-only Worker, exact pointer preflight, Session checks, original-byte backup, DST handling, datetime previews and Undo/Redo are authoritative.
- ASSET: PR #3 `449b208d98d51332c48c65583485fcde5a230616`, parent PR #1 `e647fe6ed15d7ee37fa5201d8d2dc9c82c105aed`. Validated game_ui/app_ui manifest and source images, original SVG16, icon presentation hooks and CSS are owned by 04 ASSET.
- **No PR #3 Worker implementation may replace PR #10 Worker.** PR #3's old `request('backup')` does not carry a Session identity and is intentionally excluded.
- Final merge ordering and final `src/app.mjs` review belong to 00 CTRL; 04 ASSET owns any manifest/SVG/WebP source changes, 03 WEB owns Session/Worker/backup/stage/preflight and integration regression.

## Deterministic minimal merge rehearsal

`scripts/build-web-asset-rehearsal.mjs` creates an ephemeral `.integration-preview` from PR #10 and a separate **pinned** PR #3 checkout. It imports only Asset-owned icon manifests, images and `ui-assets.mjs`/`icon-assets.mjs`, then attaches the exact PR #3 icon presentation functions to the PR #10 app. It copies the PR #3 semantic icon CSS additions and fails immediately if the source anchors drift.

The WEB base stays authoritative for:
- `createOriginalBackupCoordinator`, Worker `backup(sessionId)`, source/decode capability, stale-response rejection.
- `refreshPreflight` sequence and Session-bound plan; stale A→B preflight results ignored.
- `resolveTimePreset`, `parseLocalDateTime` rejection of DST fold/gap, `stagePreview`/Undo/Redo, read-only diagnostics.
- Worker remains the only authority for source status and capability; no read-only field or W1 classification becomes writable.

Presentation hooks imported from the pinned ASSET:
- `validateIconManifest` + `resolveIconAsset` for item icon provenance.
- `validateUiManifest` + `resolveGameUiIcon`/`resolveAppUiIcon` for game/tool icons.
- `semanticIcon`, `decorateWithIcon`, `refreshActionIcons`, and tab/region/timing display hooks.
- Load independently for all three manifests; rejected/missing manifest or blocked image URLs only remove decorative images, never labels, keyboard controls or save-data functionality.

This staging script does **not** commit the generated merged files. It is an executable migration aid for 00 CTRL, not an assertion that a Git merge will resolve every future branch conflict.

## Repro / independent 05 QR test contract

On a clean checkout of the **specified PR #10 final HEAD**, with Node 22, Python 3, Playwright Chromium and system dependencies:

```bash
npm test
npm install --no-save playwright@1.56.1
npx playwright install --with-deps chromium
git clone --no-checkout https://github.com/0xmorarin/Dreamlight-Timekeeper.git _asset_reference
git -C _asset_reference checkout 449b208d98d51332c48c65583485fcde5a230616
test "$(git -C _asset_reference rev-parse HEAD)" = 449b208d98d51332c48c65583485fcde5a230616
node scripts/build-web-asset-rehearsal.mjs "$PWD/_asset_reference" "$PWD/.integration-preview"
node tests/browser-web-session.smoke.mjs
node .integration-preview/tests/browser-web-asset-integration.smoke.mjs
node .integration-preview/tests/browser-web-session.smoke.mjs
node .integration-preview/tests/browser-web-asset-zoom.smoke.mjs
```

GitHub Actions `.github/workflows/web-asset-rehearsal.yml` checks out the pinned PR #3 source and automatically runs the last three browser tests. Verify the workflow, run ID and **exact final HEAD** before using results as evidence.

Negative test matrix:
- Invalid/blocked game icon or app manifest, blocked asset fetch: labels, 4 tabs, locale, calendar preview, stage and backup still operate.
- Old first-save `backup` and `preflight` delayed past replacement: do not download old bytes or overwrite new plan.
- In-flight duplicate backup click: no second Worker backup request; next valid new-session backup still exact.
- DST spring-forward missing wall time and fall-back repeated wall time fail closed, including a 30-minute Lord Howe transition.
- Actual Chromium browser zoom 200%: use `chrome.tabs.setZoom` in isolated test extension (not emulated DPR/CSS zoom), check narrowed CSS viewport, 4 tabs, date plan, original backup and focus.
- Never expose edited-save, ZIP, direct overwrite, game data upload or local telemetry.

## Release boundaries

Only **SYNTHETIC_TESTED / browser synthetic** acceptance may be claimed. Actual Switch save edit/export compatibility, full P1G rebuilt metadata parity, console cold-load and QR writer release remain **UNKNOWN/BLOCKED**. `src/ui-separate-downloads.mjs` stays unwired; a future two-file original-first + edited-second download remains behind independent Worker authorization and 05 QR.
