# Semantic UI icon contract — Steam v1.25.3

## Boundaries

Three distinct namespaces are used:

| Kind | Lookup key | Manifest | Destination |
| --- | --- | --- | --- |
| Item image | numeric ItemID | `data/steam-icons-v1253.json` | `assets/steam/v1253/<ItemID>.webp` |
| Steam game UI | `game_ui:<semantic.key>` | `data/steam-ui-icons-v1253.json` | `assets/steam/v1253/ui/<semantic>/<key>.webp` |
| App UI | `app_ui:<semantic.key>` | `data/app-ui-icons.json` | `assets/app/ui/<semantic>/<key>.webp` |

All distributed images must be non-animated **VP8L Lossless WebP**, not lossy VP8, AVIF, PNG or SVG. CSS and text-only fallback remain permitted and do not create a new image-format exception. The UI does not download media from a third-party provider. Game images are versioned independently of the original tool artwork.

Source image pixels, output bytes and provenance hashes are verified separately from **gameplay timer semantics**. An icon is not a field editor capability. Neither the new assets nor the existing W1/W2 research candidates permit saving an edited profile.

## Verified examples and source

Actual Steam source is `releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22`, `aa/win/ui-imagesatlas_assets_all.bundle` (158,399,415 bytes; SHA-256 `8fb0c3dbc4f937bee5d2918dfd2b9bef115dd6626e15af712f3669becc102b3d`). Unity 6000.0.62f1 CAB SHA-256 `f9454de68620f0dd15a0e1cb216f6ee86566a34672a63b706eb4c3f9292f3408`. Unity serialized objects: 2,428 Sprites and 2,330 Texture2D assets.

`data/steam-ui-candidates-v1253.json` records **18 separately identified Sprite/Texture2D references**, names, exact path IDs, full rectangles, dimensions and texture formats. 16 had independent local lossless WebP decoded-RGBA comparison PASSED using libwebp/Pillow `lossless=True,method=6,exact=True`. Candidate assignments `tab.shops` and `tab.daily` remain *semantic review holds* rather than published images because a Scrooge Store upgrade and shop timer do not necessarily represent all shops or all daily events.

Initial binary import into Draft PR #3 is intentionally limited to **two exact assets**, with source hashes and output hashes tracked in `data/steam-ui-icons-v1253.json`:

- `game_ui:skill.mining` — Sprite `8838071592011784765`, Texture2D `2140947109914567229`; 128×128.
- `game_ui:status.warning` — Sprite `1195881995301868918`, Texture2D `4550751082103756150`; 32×32.

The remaining 14 pixel-equivalent sources have not yet been published in the repository; local research or separate import review is not proof that the web UI is already displaying them.

## Tool presentation

Semantic images are optional decorations. Tabs, group buttons, alerts and file actions always retain visible translated text and keyboard focus; failure to load an icon removes only its image, not the control. File actions can be decorated by a separate `app_ui` source. The `app_ui` manifest remains empty until tool-owned art is created and tested.

For current UI routing:
- `tab.<tab-id>` decorates the tab only when its semantics are reviewed and its image is published.
- `skill.mining`, `skill.fishing`, `skill.gardening`, `skill.foraging` decorate matching visible category groups.
- `status.warning` indicates anomalous future timestamp **as an observation**, not confirmed corruption.
- `action.open-save`, `action.open-another` and `action.backup` are reserved App UI keys; if missing, plain controls remain fully operational.

Item imagery continues to resolve by ItemID, not by the new semantic namespace.

## Verification

`npm test` now checks all three manifests for strict source/version identity, allowed paths, hashes, verified status, bytes, dimensions, path collisions and VP8L encoding. `npm run test:icon-import` retains the original item-image pixel round-trip test and verifies a staged site with UI manifests and their published binaries. Tests use synthetic input and CI; browser image rendering and console save-write QA remain distinct unverified gates.

For local regeneration from the actual Steam game, run:

```sh
python -m pip install lz4 pillow
python scripts/audit-steam-ui-atlas.py --bundle /path/to/ui-imagesatlas_assets_all.bundle --output /private/ui-audit
python scripts/audit-steam-ui-atlas.py --bundle /path/to/ui-imagesatlas_assets_all.bundle --output /private/ui-audit --extract
```

ImageMagick's `magick` is additionally required for image extraction. The first command audits references without writing images. The second produces private Lossless WebP images and a versioned manifest. It does not write to the site or overwrite a published file. Both commands use exact original-bundle SHA checks and fail closed for unexpected UnityFS, Sprite/Texture or image formats.

The accepted product layout remains independent of Dreamwish Wand, and the four top-level functional tabs stay unchanged.
