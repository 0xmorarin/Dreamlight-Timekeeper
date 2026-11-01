# Steam v1.25.3 Ingredient icon source evidence

Evidence acquired on 2026-11-01 by reading actual bytes from the versioned DDVRE Google Drive source. This document records original game file observations, not a license to redistribute raw assets.

## Source identity

- Steam/Windows FullVersion.txt: `releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22`
- Game source: `ddv_Data/StreamingAssets/aa/win/ui-images-generatedicons_assets_assets/ingredient_1c1bf99b.bundle`
- Original UnityFS bundle bytes: 1,908,475
- Bundle SHA-256: `3cd8bec46facd9c4caa128982d08265dd3be18cd2ca4244841f96a6c34f76252`
- UnityFS revision `6000.0.62f1`; 62 compressed blocks; 2 nodes, serialized asset and external `.resS`
- Serialized asset node `CAB-84968e02b5630e9ce7705412c5b58d6a`: 74,372 bytes
- External texture node `CAB-84968e02b5630e9ce7705412c5b58d6a.resS`: 8,017,264 bytes
- v1.25.3 `itemlist/ActivityItem.json`: framed protobuf, 1,229,360 bytes; SHA-256 `20e4f190fc4481325cb4311a4a3f3e6fc57d3f1ca7a67acffd9c9008394ba5d4`
- ActivityItem parsed records: 3,716, containing 2,215 distinct `field 4` icon GUID values; this is *not* the full cross-game item DB.

## Actual object and ItemID mapping audit

The serialized CAB uses format revision 22, Unity platform 19 and the native asset object table. It contains 59 Texture2D objects (Unity class ID 28), 58 Sprite objects (class ID 213) and one AssetBundle object (class ID 142).

Texture formats are **48 BC7 (Unity TextureFormat 25)** and **11 DXT5 (TextureFormat 12)**. Both codecs were decoded from the actual bundle `.resS` data. The Sprite-to-Texture path ID links are present in the source object bytes.

The verified path is:

`ActivityItem field 1 ItemID → ActivityItem field 4 GUID → AssetBundle container entry → Sprite path ID → Sprite's Texture2D path ID → external resS bytes`

The audited Ingredient Bundle yields **58 distinct Sprite objects associated with 90 ItemIDs**. Several ItemIDs legitimately refer to the same source Sprite. Do not assume a 1:1 correspondence or assign files based on their English names.

Sample concrete mapping:
- `ItemID 31100005`, `Product!Butter`
- Also `31100170` and `31100200` use the same icon
- Icon GUID `cde81d2b9fb9e5646849beef392f99d4`
- Sprite name `Butter`, path ID `15475831571031946655`
- Texture2D name `Butter`, path ID `9245154426014365087`
- Texture: 512 × 512, BC7, full Sprite rectangle

All mapped 58 Sprites in this bundle had complete source-texture rectangles. Any other bundle's sprites with atlas subrects must be treated separately and cropped only after a verified mapping.

## Local conversion evidence

Using native UnityFS/LZ4 block extraction and DDS decode (BC7/DXT5), 90 mapped PNG candidates were generated locally without resizing. Lossless WebP encoding was then independently tested using Pillow/libwebp `lossless=True, method=6, exact=True`:

- Input RGBA ↔ decoded WebP RGBA byte-for-byte equality: **90/90 PASS**
- All 90 outputs carried a VP8L chunk
- PNG total: 5,030,051 bytes
- Lossless WebP total: 3,354,600 bytes
- This is a Pillow-based local conversion test, **not** a claimed execution of `cwebp -z 9` on those specific game textures.
- SHA-256 integrity of each local export and a reproducible import plan were saved as research data, not added to this public Git tree.

## Remaining release gates

1. Independently verify extraction/mapping from each additional Steam icon bundle. The current 90 items are **only the Ingredient subset**, not all 15,705 localized item IDs.
2. Use the existing offline importer to regenerate actual deployment WebP, check output SHA and full pixel equality, and ensure no incomplete/non-unique GUID mapping.
3. Confirm product asset-use and publication policy before adding copyrighted original game icon files to this public repository.
4. Run a browser image-loading test with a populated manifest and verify names/regions on actual saves.
5. Maintain `data/steam-icons-v1253.json` as empty until these publication gates are resolved. This does not block reader functionality.

The reader and timing writer capabilities are unaffected; no save fields were modified.
