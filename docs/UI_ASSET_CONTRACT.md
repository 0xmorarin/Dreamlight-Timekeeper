# Image and accessible UI icon contract

## Owner decision (2026-11-01)

Images deliberately use two distinct formats:

| Kind | Namespace | Format | Source |
| --- | --- | --- | --- |
| Item images | ItemID | VP8L Lossless WebP | Verified original Steam game assets |
| Game-specific UI/world icons | `game_ui:<semantic.key>` | VP8L Lossless WebP | Verified original Steam game assets |
| Tool-created controls, state glyphs | `app_ui:<semantic.key>` | SVG | Original unified vector icons designed for this tool |

The older all-Lossless-WebP policy **does not apply to app_ui**. Do not convert these original app SVGs back into raster assets. Game-source images must never be substituted with a newly drawn vector that merely resembles the game.

## App SVG accessibility

Exactly 16 original app icons are published from `src/app-ui-icon-design.mjs` by `scripts/build-app-ui-icons.mjs`. They share a 24×24 viewBox, 2.25-unit rounded strokes, a light neutral stroke color and sparse familiar outlines. `data/app-ui-icons.json` revision 2 records a SHA-256 for each exact SVG and another hash for the original geometry definition. CI rebuilds the source and requires byte-identical output.

Buttons and status messages **keep text labels**. Icons are decorative and use empty alt text and `aria-hidden`; keyboard operation, visible focus and localization do not depend on a successful image request. Controls use minimum 44 px touch targets and a strong dark/light visual contrast; the primary light-background button reverses icon brightness for legibility. An unavailable SVG must not block the corresponding action. Unknown or arbitrary SVG contents are refused: the app manifest only allows local `.svg` paths; the build validator restricts the root SVG contract, geometry tags, attributes, hash and dimensions. No remote image source, script or SVG animation is allowed.

The 16 semantic keys are: `action.open-save`, `action.open-another`, `action.backup`, `action.search`, `action.filter`, `action.expand`, `action.collapse`, `action.calendar`, `action.clock`, `action.utc`, `action.local-time`, `action.technical-details`, `status.warning`, `status.error`, `status.success`, and `status.missing-asset`. Presence in the manifest does not imply each symbol is used in the current interface.

The old original app `.webp` files, `scripts/build-app-ui-icons.py` and its Pillow-based tests were removed from the feature branch, replaced with Node SVG-specific regression tests.

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
