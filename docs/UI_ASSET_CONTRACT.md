# Image and accessible UI icon contract

## Owner decision (2026-11-01)

Images deliberately use two distinct formats:

| Kind | Namespace | Format | Source |
| --- | --- | --- | --- |
| Item images | ItemID | VP8L Lossless WebP | Verified original Steam game assets |
| Game-specific UI/world icons | `game_ui:<semantic.key>` | VP8L Lossless WebP | Verified original Steam game assets |
| Tool controls and state glyphs | `app_ui:<semantic.key>` | SVG | Reviewed Lucide subset from a pinned official source |

The older all-Lossless-WebP policy **does not apply to app_ui**. Do not convert these original app SVGs back into raster assets. Game-source images must never be substituted with a newly drawn vector that merely resembles the game.

## App SVG source, licensing and accessibility

The preferred application icon set is **Lucide** (official source `lucide-icons/lucide`). The source is pinned at commit `a630cec77eac6568b989e87e4947a8bfe45caacd`; the 16 selected upstream icons are independently stored under `vendor/lucide/icons/`, and the original upstream `LICENSE` is retained in `vendor/lucide/LICENSE`. Lucide uses the ISC License, with an MIT License copyright notice for the included Feather-derived icons. Retain both notices when redistributing. Do not assert that original game images use Lucide licensing.

`src/app-ui-icon-design.mjs` fixes exactly 16 semantic-to-upstream-icon mappings. `scripts/build-app-ui-icons.mjs` only accepts those vetted source files, preserves their original geometry and sets a single neutral color (`#f2f6f6`) and stroke width (`2.25`) for the dark UI. The output is a native 24×24 SVG; no rasterization occurs. No Lucide framework runtime, icon font, build-time CDN or external network access is necessary in the browser. `data/app-ui-icons.json` revision 3 records the upstream commit, exact source SHA-256, styled output SHA-256, semantic key and source path. CI must recreate every SVG and compare both bytes and manifest.

Semantic mapping: `action.open-save`→`folder-open`, `action.open-another`→`folder-input`, `action.backup`→`download`, `status.warning`→`triangle-alert`, `status.error`→`circle-x`, `status.success`→`circle-check`, `action.search`→`search`, `action.filter`→`list-filter`, `action.expand`→`chevron-down`, `action.collapse`→`chevron-up`, `action.calendar`→`calendar-days`, `action.clock`→`clock`, `action.utc`→`globe`, `action.local-time`→`map-pin`, `action.technical-details`→`info`, and `status.missing-asset`→`image-off`.

For universal design, symbols augment rather than replace translated visible labels. Use `alt=""` and `aria-hidden="true"` on decorative SVG images, retain readable contrast and keyboard focus, provide at least 44 px touch targets, and do not communicate state by hue alone. A missing image must not disable buttons. Prefer known conventions at actual 20–24 px sizes and check real browser rendering. If a Lucide glyph is ambiguous in context, a plain text label takes precedence; icon-library popularity alone does not prove universal comprehensibility. An exceptional tool-specific glyph may be created separately but must pass the same design and accessibility gate.

The app UI manifest allows only local `.svg` files, and the validator enforces the expected root and permitted static shapes/attributes, hashes, source version and dimensional metadata. Embedded scripts, external references, SVG animation and arbitrary injected HTML are not supported.

## Game-derived icons, world mapping and evidence

Steam/Windows v1.25.3 source: `releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22`. Unity 6000.0.62f1 `ui-imagesatlas_assets_all.bundle`, 158,399,415 bytes, SHA-256 `8fb0c3dbc4f937bee5d2918dfd2b9bef115dd6626e15af712f3669becc102b3d`. CAB SHA-256 `f9454de68620f0dd15a0e1cb216f6ee86566a34672a63b706eb4c3f9292f3408`: 2,428 Sprite and 2,330 Texture2D objects.

The existing published VP8L game UI entries `skill.mining` and `status.warning` remain unchanged. Two more world-specific game-image entries are included:
- `world.valley`: exact Sprite `export_icon_ips_dream_valley`, SpritePathID `1512533464914153988`, TexturePathID `2722964377584423428`, 176×176, full rectangle. This is a Dreamlight Valley-brand symbol, **not** a claim that it was used in an actual world-selector component.
- `world.exp1`: exact Sprite `icon_eternity_isle`, SpritePathID `11850830269409517482`, TexturePathID `7386682675117285290`, 152×152, full rectangle.

The original PNG decoded from the actual Unity BC7 source and the generated WebP have byte-for-byte identical RGBA pixel values. Published files are versioned under `assets/steam/v1253/ui/world/`, and exact-source IDs, hashes, image dimensions and platform information are in `data/steam-ui-icons-v1253.json`. Other `game_ui` candidates are recorded separately, not automatically published.

`world.hgw` has a 168×168 game-source candidate, `icon_map_travel_mini1_honeywood` (SpritePathID `15526096041384401868`, TexturePathID `9168973084813024204`), and has passed local RGBA equality checks, but its deployment remains on HOLD pending release-byte validation.

The 1920×1080 `img_expansion_storybook_vale`, `img_expansion_wishblossom_ranch` and `img_expansionMini_honeyglow_woods` sprites are expansion key art, not equivalent to small category icons. Do **not** resize or mislabel them as equivalent world UI symbols. Until suitable matching icons are verified, world filters retain plain translated text and counts.

## Resolution and verification

`resolveIconAsset(itemManifest,itemId)` remains numeric. `resolveGameUiIcon(gameUiManifest,key)` only uses the original-versioned WebP manifest, while `resolveAppUiIcon(appUiManifest,key)` only uses original SVG metadata. The same UI function may use both resolvers, but neither can fall through into the wrong asset namespace. Both return null on invalid or missing provenance. No icon affects gameplay or save-field policy.

`npm test` checks names, manifests, security restrictions and byte integrity; `npm run test:icon-import` exercises a fully staged site with both game-source and app-source assets. The Chromium smoke workflow checks downloaded image decoding, language re-rendering, synthetic encrypted P1g read-only load, warning icon display, mobile layout, and fallback if an icon request is blocked. This does **not** authorize writing an edited save, and is not equivalent to actual Switch runtime acceptance.

The product remains four-tab and read-only. Special 2126 values, timestamp editing targets and restore logic remain provisional, independently gated by the original save-timing research contract.
