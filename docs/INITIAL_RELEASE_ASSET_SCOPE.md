# Dreamlight Timekeeper — initial release asset scope (04 ASSET)

**Evidence baseline:** integrated PR #11 / merged notice PR #15 `f6af69ec88d59336040737cd449abef586926073`. 04 ASSET original Draft PR #3 `f5bdd9d206e2842b193e466498a0a6a9eef4d0c5` is unchanged.

**Decision:** `OWNER_00_CTRL_PENDING`. This document is a release packaging comparison, NOT authorization to publish a particular profile. The product repository presently contains **four proprietary Steam/Windows game UI VP8L WebPs**, **16 provisional Owner-original App SVGs** and **zero Item images**. The three additional Steam candidates `world.hgw`, `tab.shops`, `tab.daily` remain HOLD and are not shipped. The bilingual unofficial notice does not grant redistribution rights for the existing four.

## Two candidate release profiles

| Profile | Game-original WebPs | Original App SVGs | Item images | Status |
|---|---:|---:|---:|---|
| `current_repo_game_ui` | 4 | 16 | 0 | Files already in repository; **0/4 documented redistribution permissions**; no new release approval |
| `owner_svg_text_only` | 0 | 16 | 0 | Isolated **non-published** candidate using text fallback and an emitted zero-game-icons runtime manifest |

The text-only candidate **omits the four game image bytes** and derives a deployment-only `data/steam-ui-icons-v1253.json` with `icons: {}` and `source.status: NO_ASSETS_VERIFIED`. It leaves the source repository manifest, scripts, game source hashes and historical Git commits unchanged. Therefore an absent game raster is never represented to the browser as successfully bundled, and existing text/icon fallback takes over. No game-origin WebP is downloaded by the user from that staged candidate. The historical source filenames/hashes in the public repository are not erased.

## Existing four game-source files — present, rights not established

| UI role | Repository file | Published byte SHA-256 | Permission |
|---|---|---|---|
| `skill.mining` | `assets/steam/v1253/ui/skill/mining.webp` | `dcc381b5480280bbd771fe6beea374993fd678b955ee605ddb9596bdea351197` | NOT_ESTABLISHED |
| `status.warning` | `assets/steam/v1253/ui/status/warning.webp` | `d9ecb95ae3b5e7483f8a4d7ee1cf51ded8b86323aed3459a4806e6b9e482b70e` | NOT_ESTABLISHED |
| `world.exp1` | `assets/steam/v1253/ui/world/exp1.webp` | `5fdfec6c047467a16b607f25a087b01263da151c48345fd0e21940de99d0e735` | NOT_ESTABLISHED |
| `world.valley` | `assets/steam/v1253/ui/world/valley.webp` | `c8de879d8f96eb678fad5bb2317b62a6bdce9523b8fe743ae348f62d4436e7ad` | NOT_ESTABLISHED |

Source provenance and technical pixel equality were previously recorded; neither constitutes redistribution permission. Existing file-level rights ledger: `data/steam-ui-existing-rights-review-v1253.json`. Use-of-game-asset risk and Owner permission decision are distinct from Writer safety and P1G validation.

## Sixteen Owner-original App SVG files — kept in both profiles

| UI role | Repository file | Published byte SHA-256 | Source |
|---|---|---|---|
| `action.backup` | `assets/app/ui/action/backup.svg` | `7e2502159ee862616df4b230a0a64439279375fa7d479e4648aafc63e1afca60` | Owner original / provisional design |
| `action.calendar` | `assets/app/ui/action/calendar.svg` | `40d7e4c22ff305b10e15099cc3cd29794baacfc30c4bf74a362ce858fecb503c` | Owner original / provisional design |
| `action.clock` | `assets/app/ui/action/clock.svg` | `0776e0ad5ac88ca0755e95bd88ace40d27220b30620c3b9bc4cdbb3a4e415b2f` | Owner original / provisional design |
| `action.collapse` | `assets/app/ui/action/collapse.svg` | `97f047aba6798ae05eb5fe08a39bd252b0026722ac213f0ad95d55b75ddccac9` | Owner original / provisional design |
| `action.expand` | `assets/app/ui/action/expand.svg` | `c79885738922bc316664841ba377a59ac35b05d00a5f62fc06b449e409a8345e` | Owner original / provisional design |
| `action.filter` | `assets/app/ui/action/filter.svg` | `b41a0dcfca41089677e99cb0a2cb866db1d61df8215134c55b8673473e01bff6` | Owner original / provisional design |
| `action.local-time` | `assets/app/ui/action/local-time.svg` | `b38d21441e24520adc43f54172a0e6950fed9bb79ca704c20fae7029fa2013c7` | Owner original / provisional design |
| `action.open-another` | `assets/app/ui/action/open-another.svg` | `2c133ce24e9b9eb71ae508f6fb82a85c7d431b856b4bbde656425cdd853f7972` | Owner original / provisional design |
| `action.open-save` | `assets/app/ui/action/open-save.svg` | `7f0ae21c1568bbe0ec301ba380d99aa2e30c2c3a25a055ba0c938bb72a0e747d` | Owner original / provisional design |
| `action.search` | `assets/app/ui/action/search.svg` | `b192be61bfda3eadca57d9f638f4d425a8dd3e4bd0f3ea70386bbfa9e6db9a6d` | Owner original / provisional design |
| `action.technical-details` | `assets/app/ui/action/technical-details.svg` | `4bdc56b0dcd54badb67a3d3bd3955ca862e60b4aea29a8ad467f91851aff4981` | Owner original / provisional design |
| `action.utc` | `assets/app/ui/action/utc.svg` | `c66228134601630e81f5768948249e57316cc202132eb4b0bb211ba5fd123fb2` | Owner original / provisional design |
| `status.error` | `assets/app/ui/status/error.svg` | `6d5c8eef26181f8aa217526c1d1dcca227766da97fd84fae2859d0c0cd74e0fd` | Owner original / provisional design |
| `status.missing-asset` | `assets/app/ui/status/missing-asset.svg` | `f0ea02a5606c906a364c94cc8717aefd3f265f280698967de0f1b9a9c1ff7390` | Owner original / provisional design |
| `status.success` | `assets/app/ui/status/success.svg` | `ab00ee3422b6235bc989384a9788dcc000c7fe6d9a54749d114717c16697a170` | Owner original / provisional design |
| `status.warning` | `assets/app/ui/status/warning.svg` | `e3729b8548179dc6487f7a87d92b60f07ac454d81abaad4abf8787cc15833709` | Owner original / provisional design |

These 16 remain exactly as selected. No icon library substitution, additional image extraction or display-mapping rewrite is proposed. Text labels and programmatic focus remain authoritative when decorative icons are absent.

## Repeatable, isolated evidence — not a deployment command

From a PR containing `scripts/stage-release-asset-profile.mjs`:

```bash
node scripts/stage-release-asset-profile.mjs current_repo_game_ui /tmp/timekeeper-game-preview
node scripts/stage-release-asset-profile.mjs owner_svg_text_only /tmp/timekeeper-svg-preview
```

The output directories must be **new and outside the source checkout**. The tool copies only static product HTML/CSS, required `src/*.mjs` modules, required runtime `data/*` files and the profile's exact pinned image bytes; it refuses changed source checksums, unknown quantities, unknown media profiles, symlinks, hidden files, output overwrites and additional game media. It cannot edit original saves or choose a production deployment. Only the SVG-only staged runtime manifest is modified, never the repository source manifest. Both copies continue to carry the bilingual non-affiliation notice.

Independent Chromium release-profile CI must operate on **both staged roots** and exercise: four tabs, P1G upload, selected timing plan, synthetic schema626 Writer preparation, encoded edited P1G independent reopen/diff, original-first separate original/edited downloads and individual retry, Undo/Redo/Session invalidation, and absent game media UI fallback. A successful synthetic Chromium test is **SYNTHETIC_TESTED** only: it does not establish real save compatibility, Switch load/re-save, browser real-user file dialog reliability or production Writer permission. If the exact-head CI fails, do not describe either profile as validated.

## Explicit separation of decisions

- **00 CTRL / Owner:** choose actual image publication profile after rights review; select deployment artifact; review 05 QR results and PR/CI lineage. Do not silently treat the existing four proprietary WebPs as licensed.
- **03 WEB:** preserve the real 4-tab layout, file input, Worker/Session and verified original/edited download UI; no source or UI changes are requested by this Asset scope.
- **01 CORE / 02 TIME / 05 QR:** independent Writer compatibility, exact-diff/Encode/Reopen and runtime/device release gates. Image profile selection does not give Writer new capabilities.
- **05 QR:** independently inspect the exact built tree and hosted/release artifact (including presence/absence of game bytes), responsive/keyboard fallback and native picker/assistive-technology gaps. Source Git history or a disclaimer alone cannot answer distribution rights.

**Result requested from 00 CTRL:** approve one of the two image profiles or keep both as unreleased candidates; separately resolve the four WebPs' redistribution-rights status. No new game images or Item images will be added for v1.

## Owner-selected attribution wording / community precedents (2026-11-02)

Owner instructed that a tool displaying game-file-derived imagery should clearly state it is independent of Disney and Gameloft and that game titles, artwork, characters, logos and other game assets belong to Disney, Gameloft and relevant rights holders. Welcome/workspace in `index.html` now include these statements in both Japanese and English. Public analogues: [Dreamers Portal](https://starlightdreamers.com/user/CozyCeto/dreamsnap/202951) credits the Disney Dreamlight Valley material to Gameloft, Disney or licensors; [Dreamlight Valley Wiki site policies](https://dreamlightvalleywiki.com/Dreamlight_Valley_Wiki:Site_policies) allow some already-visible game-file-derived media under their own policy and require image copyright notices; [Wiki content policy](https://dreamlightvalleywiki.com/Dreamlight_Valley_Wiki:Using_wiki_content) explicitly states game names, images, assets belong to Disney and Gameloft, not the Wiki. These are examples of transparent credit, not transferable licences or proof that the Timekeeper images are automatically distributable. The four existing proprietary game WebPs remain `NOT_ESTABLISHED` for redistribution permission and no new game sprites or profile publication is authorized by this UI wording update. Profile selection remains an explicit separate decision.


## Superseding Issue #17 P0 correction — NOT a complete release (2026-11-02)

The preceding 62/58 staging-profile counts belong to the old **four-decorative-game-WebP only** proof of concept. Owner Issue #17 now explicitly makes ItemID thumbnails mandatory for a usable v1. **Neither old profile is a complete product release**. The Issue #17 audit adds one explicitly reviewed read-only module `src/item-image-coverage.mjs` to the release stager's approved module list, increasing its temporary pre-image candidate file totals to 63/59 (33 source modules); this does **not** select or authorize either staging profile. The static audit file `data/item-image-coverage-v1253.json` is maintainer evidence, not a runtime icon atlas and is not added to public staging. Actual new image files must be added only with independently reviewed source ItemID→GUID→Sprite/Texture, lossless WebP RGBA, permissions, performance and QR evidence.

Authoritative new status and 03 WEB integration contract: `docs/ITEM_IMAGE_ISSUE17_COVERAGE.md`. Baseline 508 recurring definitions, 244 ItemIDs, 0 deployed Item thumbnails, 138 static source-linked research candidates and 106 source-unlinked items; real-save extra visible IDs remain unenumerated. Full image coverage = P0 BLOCKED, not a release PASS. Do not restore a finished-v1 claim based only on this document.


## 2026-11-03 — November RC text-only distinction / full image scope retained

For a controlled **internal diagnostic/preview RC**, a read-only text-first item row may be used even though there are **0/244** actual approved published game-derived ItemID images. The exact v1.25.3 508 RecurringEvent/244 ItemID inventory and source ItemDB provenance are unchanged. Research status **VERIFIED0 / AMBIGUOUS81 / MISSING163**, all missing or ambiguous image URLs null. No added Owner waiver: the image-complete product requires correct original item+variant images, exact reviewed VP8L bytes, independent 05 QR acceptance, complete displayed item inventory including authorized anonymous real-save extras, and Disney/Gameloft redistribution rights (currently \`NOT_ESTABLISHED\`). The 25 private item source pixel proofs do not constitute approved packaged media. The 81 same-GUID common IconAddress cases point to one shared \`icon_2x2\` placeholder, whereas their 81 different ItemDB field5 GUIDs resolve to world \`UnityEngine.GameObject\` Prefabs, **not independently verified 2D thumbnails**.

**03 WEB handoff**: consume \`resolveRcItemTextRow()\` from \`src/item-image-coverage.mjs\` (\`timekeeper.rc-item-text-fallback.v1\`). Display escaped localized \`name\`, exact \`ItemID\`, honest \`category.label\` (all 244 original v1.25.3 ItemDB field1 source-typed: ActivityItem 173, Furniture 52, Companion 19; extra save-only ItemIDs remain unclassified), accessible \`textFallback.ariaLabel\` and image-unavailable/ambiguous status, always with onload-error/decode-error fallback. Do **not** create \`img src\` for null URL. Do not classify item/source by ID prefix or fabricate image paths. An image URL can only come from a **separately approved static image manifest**. Save-derived ID/unknown category remains text fallback; input P1G bytes remain local. 03 WEB owns SvelteKit integration, actual mobile/zoom/keyboard/screen-reader smoke, worker/file-switch fencing and its isolated review inventory; 04 ASSET does not change those branches.

The existing \`owner_svg_text_only\` candidate is a **conditional review/RC profile**, not proof that the packaged SvelteKit artifact is deployable. Preserve the original Owner SVG16 and exclude all game-derived UI WebPs or unreviewed game rasters from a no-game-image stage. Historical game-derived UI WebPs still in source have no inferred permission. PR #25 stages only 00 CTRL-authorized exact reviewed compiled bytes; do not edit its allowlist here. Keep \`deployAuthorized:false\` until independent staged-file acceptance, and do not enable Writer/original overwrite through an asset RC label. Issue #17 image-complete acceptance remains open.
