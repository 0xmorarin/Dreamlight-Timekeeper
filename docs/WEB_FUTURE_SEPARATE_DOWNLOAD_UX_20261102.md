# 03 WEB — Future Separate Download UX Contract (2026-11-02)
Status: **DESIGN AND SYNTHETIC TESTED ONLY**. No product edited-save export, writer capability, direct overwrite or ZIP support exists.

## Worker-owned gate
The UI may consume a future `WORKER_VERIFIED_PAIR` receipt only after 01 CORE and 02 TIME validate the exact source and intended operations, 05 QR independently accepts the writer, and the Worker prepares **both** files by strict diff, single encode, independent reopen and preservation checks. All existing `editingAllowed`, `exportEditedAllowed`, `writerAuthorized` and `editedCopyAuthorized` flags remain false. The receipt status is a hypothetical interface example, not an implemented Worker command or authority grant.

## UI flow
- Initially only the original-byte backup remains available. Do not show or enable the edited file download until verified Worker support exists; do not infer readiness from a version, static W1 classification or timestamp.
- Future single user action: request both outputs from Worker, wait until both are fully prepared, then attempt the original download first and the edited download second (separate files; no ZIP).
- Display **Download original again** and **Download edited again** as two independent actions after preparation, retaining the files only within the active browser session. The browser may suppress a second download without returning a reliable receipt; a click means *trigger requested*, never *download saved*.
- If original triggering fails synchronously, do not automatically trigger the edited file. A blocked second trigger must not discard either prepared output; use the respective retry.
- Invalidate the receipt, both retry actions and pending browser responses at the beginning of any file switch/session loss. No direct write to the chosen input file.

## Synthetic acceptance
`src/ui-separate-downloads.mjs` is an **unwired, presentation-only** coordinator. `tests/ui-separate-downloads.test.mjs` checks incomplete/unverified preparation, two-file order, rejected first trigger, blocked second trigger, independent retries, naming collision and session invalidation. This cannot establish game-save writer correctness or real browser download permission behavior. PR #10 also verifies the **existing** original-only backup path in real Chromium. Preserve the four-tab UI, the PR #3 original SVG icon decisions, and explicit capability boundaries when eventually integrating.
