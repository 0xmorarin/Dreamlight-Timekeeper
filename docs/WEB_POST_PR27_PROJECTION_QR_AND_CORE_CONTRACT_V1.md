# 03 WEB / Post-PR27 — independent Projection negative corpus and trusted CORE boundary

Status: **STATIC_ONLY contract proposal + synthetic-only UI Fence negative tests**.
Source: accepted Issue #19, WEB PR27 `eb071cc49927c1b154b6780001d2d6f5f8abeca8`, WEB PR24 `565005fb2daa66ea9ccd3568438e7a2039a0416c`, 05 QR PR26/PR28, Wand PR312 `c6b152512d3bc901fd1474dbcfcb07253ae1b347`. No production Rust/WASM binding, semantic Writer authorization or main merge.

## Scope and independent QR fixture entrypoints

- `tests/fixtures/web-projection-negative-corpus.mjs` provides synthetic JSON-only deterministic `identity/query/page` builders, enumerated response and multi-step cursor negative case IDs. **No user saves or game-origin data.**
- `tests/web-projection-qr-fixtures.test.mjs` executes `node --test tests/web-projection-qr-fixtures.test.mjs` against the **pre-existing** `src/lib/timekeeper/session-response-fence.mjs` without modifying its implementation. Each response fixture performs a negative dispatch+receive and checks no fabricated next Cursor can continue.
- Response cases: 700KB single Grid row, >64KiB multibyte UTF-8 row, aggregate >2MiB across 200 individually small Inventory rows, complete=true with cursor, complete=false without cursor, empty nonfinal page, absent/undefined/oversized cursor, source SHA swap, revision mismatch, foreign session, foreign view and unsupported BigInt.
- Stateful cases: repeat/loop/out-of-order continuation, filter and sort change mid-page, old generation after File A→B, Core-issued Undo/Redo revision transitions, overlapping first-page requests, duplicate reply.
- Positive control: one small type-specific Grid / Inventory / Quest summary per domain. Large source documents remain possible; oversized **rows** require indexed, bounded projections. The test cannot establish full native index completeness, cursor authenticity, cancellation inside the Worker, P1G read support or actual 200MiB browser memory safety.
- Existing PR27 Fence tests already cover bounds and async snapshots. This corpus is a *standalone 05 QR entrypoint*, not a duplicate product implementation. Independent QR must rerun on an exact frozen head and add a trusted Worker-controlled cursor tamper/fake/reference-graph case once CORE exposes the port.

## Exact trust division (proposal, not implemented)

Machine-readable proposal: `contracts/web-core-projection-boundary-v1.json`.

| Boundary | Mandatory behavior | Current evidence |
| --- | --- | --- |
| CORE index | Fully validate prerequisites, retain domain logical identities, index from original current save, determine complete/nextCursor from an exhaustive current revision index. Never infer completion from a selected set of 512 pointers. | **MISSING** as product API. Wand `query_paged` uses caller pointer list, offset and MAX_PAGE=64 / 512-pointer watch. |
| Trusted Worker | Reject transfer before postMessage above max200 rows, 64KiB JSON UTF-8/row, 2MiB whole response **including metadata**; account for structured clone allocations. Oversize is an error, not truncation or hidden loss. Enforce resource bounds on indexes and cursor state. | **PROPOSED**, not present in current JS or Rust product read transport. |
| Worker-issued cursor | Opaque unguessable handle in Worker-private map OR verified authenticated token; bind encrypted source P1G SHA, session/generation, schema and independently evidenced build, revision, index-generation, domain/view, canonical filters, sort with tie-break, limit, next position and expiry. Single-use/atomic on continuation; reject replay, forged, stale, foreign, changed-query and exhausted tokens. | **MISSING**. Numeric offset in research Rust does not meet this contract. |
| Svelte/UI fence | Reject impossible result shape, stale Session/Revision/SHA, out-of-order Cursor/response, total page/row overrun; discard cached pages on File switch and Core-issued Undo/Redo. Does **not** mint or verify valid source/permission/cursor or domain graph. | **Implemented rejection-only design**, not product Worker transport. |
| Source/authority | Original local encrypted P1G SHA and decoded/Registry hashes are separate. Build BID cannot be inferred from schema. Domain reference graph and operation permissions originate from trusted CORE, never UI; no page response is a Writer grant. | **No product permission**. |

Detailed machine states and explicit rejection conditions live in the JSON proposal. For an eventual READ-only product prototype, 01 CORE must expose a pinned Worker ABI; 05 QR independently verifies source binding, true completeness, budget enforcement **at both trusted producer and UI consumer**, A→B, undo, cursor tamper/replay/expiry, large Grid/Inventory/Quest and memory errors. The legacy JS Worker remains the comparison oracle, with current 128MiB cap unchanged.

## Wand PR312 delta from WEB27's 1909dd5e snapshot

Observed at PR312 exact `c6b152512d3bc901fd1474dbcfcb07253ae1b347` (14 commits newer). `session.rs` Git blob `c222695ff1e2e3122170c4c627ccde928bdaabfb` now invokes narrow source Chest-edge validation, including replay/undo paths. New `semantic_safety.rs` blob `0096ba2f0e060baa5239a3e423b42f3a8876a12e` checks known GridObject.Container → Player.ContainerInventories edges on small selected subtrees and rejects nested unknown member loss/array shrink in recognized structural changes. **It is not an exhaustive native or quest reference graph**. `p1g.rs` remains blob `c8cacdc5fa6afc7a60f388af561522e2867f5c9b`, synthetic-only encrypted codec; Rust↔Wand JS and Timekeeper JS encrypted synthetic P1G parity was reported by 01 CORE (33/33 Rust suite, CI #41460360640 / #41460360442), not independently re-executed by WEB. Product port gaps stay: no accepted encrypted input File SaveSession/complete domain index/opaque Worker cursor, no original-backup product API, no semantic ChangeSet authorization, no product Writer. Preserve all existing ten feature gaps in `contracts/web-rust-save-session-alignment-v1.json`; only its post-PR27 observation is updated.

## Compatibility / release

No change to four Svelte tabs, 8-language selection, original-first separate downloads, UI undo/redo, 320px/mobile and 200% zoom behavior, old `timekeeper.save-worker@1`/JS Codec, no private save upload. No modification of 00 CTRL PR25 staging or 04 ASSET images. Legacy HTML Verify/Release CI remains RED, never waived or relabeled PASS. Phase B: only after 01 CORE submits fixed stable READ-only Rust/WASM + 05 QR independent acceptance. Subsequent SemanticCommand/global history and Verified Export require **separate** operation-specific gates; current export and direct overwrite are forbidden.

## Independent execution / verdict format

1. Pin source HEAD, base commit, path SHA for test, fixture, Fence, contract and any CI YAML. Re-run `node --test tests/save-session-response-fence.test.mjs tests/web-projection-qr-fixtures.test.mjs tests/web-rust-session-alignment.test.mjs`. Confirm exact per-case failure codes and valid small domain positives.
2. Verify SvelteKit migration workflow full exact-head run (node, Svelte-check, base-path static build, actual Chromium synthetic backup/edit/reopen, A→B→C, locales, keyboard, 320px / zoom) **before** claiming new HEAD PASS. A local V8 test harness is not equivalent.
3. Audit negative trust gap at Worker producer; absent CORE API means mark **BLOCKED**, never grant READ/WASM or Writer through client-side tests.
4. Keep stale legacy HTML CI failures visible; do not silently edit/reuse 00 CTRL staging allowlist.

Evidence status: new fixture **SYNTHETIC_TESTED locally in isolated JS evaluation**; CORE contract **STATIC_ONLY**; Rust product READ **BLOCKED**, Rust Writer **BLOCKED**, Switch runtime **UNKNOWN**.
