# Timekeeper item icon assets — provenance and quality contract

Timekeeper's images are display-only. A missing image is permitted and must not block reading a save.

## Chosen output format

- Web delivery: static **lossless WebP / VP8L** (8-bit RGBA), no animation or lossy fallback masquerading as a verified icon.
- Retain the original source asset outside the deployed website; record its SHA-256 and stable game asset identifier.
- Recommended libwebp invocation for a lossless PNG source:
  `cwebp -lossless -z 9 -exact -metadata none source.png -o 31300003.webp`
- `-exact` preserves RGB values under fully transparent pixels. `-z 9` uses slower, denser lossless compression. Compare against `-z 6` for conversion time and actual size.
- Convert source images without upscaling or resampling. Validate the converted image visually and, when possible, with a pixel-for-pixel RGBA comparison against the decoded source. The RIFF/VP8L check alone is **not** an independent pixel-equivalence test.
- Keep PNG or unmodified extracted asset as research master. Conversion does not change Steam/Switch source provenance.

## Metadata contract

The deployed manifest is `data/steam-icons-v1253.json`. It stays empty until original **Steam/Windows v1.25.3** asset bytes have been obtained and verified. Do not represent Switch-only extracted images as Steam-sourced assets.

For each verified icon, the `icons` object has a numeric ItemID key and a record:
```json
{
  "platform": "Steam",
  "gameVersion": "1.25.3",
  "verified": true,
  "path": "assets/steam/v1253/31300003.webp",
  "sha256": "<64-character lowercase SHA-256 of WebP bytes>",
  "sourceSha256": "<64-character lowercase SHA-256 of source image/asset bytes>",
  "sourceAsset": "<stable in-game Steam asset identifier>",
  "width": 128,
  "height": 128
}
```

When icons exist, set `source.status` to `VERIFIED_STEAM_ASSETS`. Otherwise keep `NO_STEAM_ASSET_BYTES_VERIFIED` and `icons: {}`.

Run `npm test` and `npm run verify:icons` before publishing. This verifies metadata, source platform/version declarations, output SHA-256, structural lossless VP8L encoding, and dimensions. It does **not** prove whether the original source was genuinely extracted from Steam, nor independently prove pixel-for-pixel equality. Both require source evidence and a decoded-pixel comparison.

No file uploads, downloads or image conversions are executed by the public site; all assets are bundled and served as static files. The image system is kept separate from the read-only save reader and the unapproved save writer.
