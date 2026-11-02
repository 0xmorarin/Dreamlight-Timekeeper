# 03 WEB — Single SaveSession Worker contract and static artifact handoff (2026-11-02)

## Scope / source precedence
- **ACCEPTED ARCHITECTURE:** Timekeeper Issue #19, Single SaveSession / whole-document validation / indexed lazy access / Core-owned ChangeSet+Revision / verified one-time export. Accepted architecture ≠ running production Rust P1G encoder or writer grant.
- **Baseline:** Timekeeper Draft PR #22 HEAD `b7ea1010b060c58868b4c0a04673aed61b01f1bd`; legacy product PR #14 `e9f70d8076a9fd4702e54bc913974b2761be1c20`; integrated PR #11 frozen `393222e7832461ef5fea847b6fff475fedc45017`.
- Wand common Rust **Draft PR #312** HEAD `a50a0c5a61b06a240ebad7871670c7bac7fff899` is strict decoded JSON token/span research and Chrome WASM proof. It has **no accepted encrypted P1G Rust AES/ZIP/CRC/Encode/Reopen**, mixed-domain transaction implementation, save-session release or product Writer.
- The existing SvelteKit page and legacy `timekeeper.save-worker@1` continue unchanged, with JS original source/Session/CAS/Codec in the existing Worker. No second save loader, UI-side codec or direct original overwrite.

## Future common port (design/typing only, not a live Worker endpoint)
`src/lib/timekeeper/save-session-contract.ts` defines **`ddv.common-save-session/1`**:
1. `openLocal(File)` returns one **Core-issued opaque SessionIdentity**, source SHA, stable generation+revision, explicit READ/ENCODE_COPY/PERSISTENT_REPLACE capability/evidence states. No Svelte-invented permission.
2. `queryPage({identity,domain,view,page:{cursor,limit},filters,sort})` returns typed bounded projections with an opaque cursor and identity/revision. Grid, Inventory, Storage and timing share the SAME Core Session; no decoded raw save object in Svelte, and the UI cannot infer that a cursor slice validates all dependencies.
3. `planCAS({identity,expectedRevision,expectedSourceSha256,commands})` submits a Core-validated semantic command and returns a Core-owned `ChangeSetReference`. W1 intent fields distinguish event definition ID vs saved event index vs oneof, and expected UTC old/new values. Future Wand commands are domain-owned; Timekeeper never authorizes Inventory/Grid writes.
4. `validate(ChangeSet)`, `history({action:'undo'|'redo',expectedRevision})`, and `encodeCopy({changeSetId,expectedRevision})` operate on the one Core overlay/history with global dependency checks and exact source revision CAS. Only CORE may issue verified original/edited P1G buffers; UI retains separate original-first triggers and per-file retries.
5. `invalidate/close` cancels requests across an entire local source switch or route close. A new session supersedes all previous page cursors, prepared exports and UI history references.

`src/lib/timekeeper/session-response-fence.mjs` is **UI rejection logic only**: it neither creates session IDs/SHAs nor increments revisions/creates ChangeSets. It rejects invalid Core-issued identity shapes, stale generation/source SHA/revision, oversized page responses and old revisions; current UI remains on the old JS Worker path until the shared port is implemented and independent 05 QR accepts its parity. Node negatives cover file switch, altered same-length source SHA, invalid cursor/page size, forged persisted-replace capability, and revision regression.

**Future Rust acceptance dependencies:** 01 CORE/Wand 01A supplies a frozen engine-owned protocol backed by full P1G envelope, strict all-document parsing, sparse spans, cross-domain indexes, atomic transaction and independent re-open/delta; 02 TIME validates W1 intent against native + event type semantics; 05 QR verifies fixed HEAD against JS oracle, same-save multiple-domain operation, memory/OOM, stale Session/Revision/Source CAS and nontrivial ZIP metadata; 00 CTRL approves integration. `RUST_SAVE_SESSION_INTEGRATION` is hardcoded `API_PENDING_CORE / wasmInstalled=false / writerGranted=false`. It is not a UI feature flag.

**Known capacity limitations:** current legacy JS Worker returns timing rows as a single projection and creates a full decoded object; Svelte displays only the first 80 entries, which is local incremental rendering **not real paged Worker query/virtual scrolling**. Existing 128MiB decoded cap and 220k Grid scan warning remain, so Issue #18 100–200MB target **BLOCKED**. No memory benchmark/Rust P1G performance acceptance is implied by this interface.

## Compiled SvelteKit distribution review (P1, NOT a release stage)
Input: the compiled `build/` output from `npm run build` with `BASE_PATH=/Dreamlight-Timekeeper`. `scripts/audit-sveltekit-build.mjs` traverses only **compiled files**, refuses symlinks/unknown extensions/unknown paths/source directories, and reports every sorted path, size and SHA-256. It does **not** construct a deployable ZIP or copy any repository directory.

Review envelope:
- Root: `index.html`, `404.html`.
- Generated Svelte/Vite files under `_app/immutable/{entry,nodes,chunks,assets,workers}/...` and the narrow framework entry files `_app/env.js`, `_app/version.json` if emitted. Worker JS must be present.
- **Worker data assets:** Vite-hashed `events-v1253-*.json`, `timing-review-rules-v1253-*.json`, `item-names-v1250.json-*.bin` (the last is the byte-identical canonical gzip `.gz` source served under a neutral extension because of Vite 7 Worker MIME behavior). All three bytes must match source data exactly. These may still need Owner content/provenance approval.
- UI: exact 16 existing verified `assets/app/ui/**.svg`, each SHA must match `data/app-ui-icons.json`; `assets/app/release-notice.css`. No additional image sources.
- **Explicit rejection:** any game-origin raster `.webp/.png/.jpg`, raw save `.p1g`, `.nsp/.nca`, secrets/keys, maps/WASM (no approved build yet), unknown files, missing Worker or canonical data, mismatched Owner SVG hash, symlinks, or source/test/doc/git directories.
- CI inventory output: `.release-audit/sveltekit-build-inventory.json` retained as **review-only GitHub Actions artifact**; it is **outside** `build/` and must not be copied automatically to public Pages. Each manifest record has a derived SHA and risk class. `deployAuthorized:false`, `writerReleaseAuthorized:false`, `sourceTreeAllowed:false`. This inventory is for 00 CTRL/05 QR to design a **new explicit SvelteKit release/stager policy**, not to bypass the old safety whitelist.

The two **legacy CI failures** remain independently real on the migration branch: `Verify Timekeeper` and `Release asset profiles` reject unknown Svelte/TS build/source paths using old HTML-only staging. Changing this whitelist is owned by 00 CTRL, after 05 QR acceptance of the staged bytes and content permissions. Old HTML Chromium tests are not substitute SvelteKit tests. Do not declare them PASS, replace old gate with `cp -r .`, or deploy a repository checkout.

## QA scope
- New Node `tests/save-session-response-fence.test.mjs` validates stale identity/page/revision/capability rejects; `tests/sveltekit-build-inventory.test.mjs` checks accepted synthetic compiled envelope and disallowed source/media/hash corruptions.
- Existing dedicated SvelteKit CI continues type-check, static GitHub Pages base path, real Chromium JS Worker synthetic encrypted P1G editing, independent reopen/byte parity, A→B→C Session switch, 320px, 200% zoom and locale8. No old-head full Writer replay.
- **05 QR independent acceptance and real save** remain separate. SVG-original status is not permission to distribute proprietary game images, and ItemID images Issue #17 are still 04 ASSET-owned.

## Exact files modified for this scoped PR
`src/lib/timekeeper/save-session-contract.ts`, `src/lib/timekeeper/session-response-fence.mjs`, `scripts/audit-sveltekit-build.mjs`, `tests/save-session-response-fence.test.mjs`, `tests/sveltekit-build-inventory.test.mjs`, `.github/workflows/web-sveltekit-wand-migration.yml`, this handoff document. None touches `src/worker.mjs`, `src/core`, `src/routes/+page.svelte`, `src/lib/timekeeper/worker-adapter.ts`, `src/ui-separate-downloads.mjs`, `src/ui-backup-coordinator.mjs`, `src/time-presets.mjs` or assets.

Release decision: **HOLD / DRAFT**.
