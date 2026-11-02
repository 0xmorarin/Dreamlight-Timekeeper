# 00 CTRL / Isolated first-wave read-only integration

Base: PR #2 `9ebdac063b81934eee37a62e5694749b1cf1aa65`, main unchanged. Source commits: PR #8 CORE `72c972ad7b4fa3c2ae46d506c1140d25ca33c22b`; PR #7 TIME `91b640bf23ec05dcd32ce36de054f8d1964210fd`; PR #10 WEB `2a7c1518610ce12e9473c16ec988557924748f51`; PR #9 QA `d6394a210f2af35b36b3b7861764473375140bd9`; PR #3 ASSET `449b208d98d51332c48c65583485fcde5a230616` stacked on PR #1 `e647fe6ed15d7ee37fa5201d8d2dc9c82c105aed`.

Read-only integration candidate only. Exact upstream blobs copied without rebase or mutation to their branches. PR #10 source is authoritative for Worker, backup, session, preflight, Undo/Redo and UTC/DST; PR #3 only supplies strictly validated icon manifests, semantic presentation hooks and image assets, using existing WEB rehearsal transformations. Styles preserve PR #2 layout and append PR #3 icon CSS; package.json retains PR #3 icon validation script. Combined timing-review.yml includes PR #7 Native and PR #9 independent QA change triggers under both pull_request and push.

The PR #10 one-shot ephemeral `web-asset-rehearsal.yml` is intentionally excluded from permanent staging because it expects an unintegrated app. Its historical script/test remains for provenance. This integration is **not independently accepted** until 05 QR verifies this exact combined HEAD (Node, icons, actual Chromium tab/session/backup, missing asset fallback, 200% native zoom, all false writer flags, no remote data exposure).

No original save writes, edited export, Grid deletion, chest move, direct overwrite, or Wand capability change. Real schema626 ZIP envelope inspection is READ ONLY; native W1 scheduler is STATIC ONLY; all persistent Writer gates remain CLOSED.
