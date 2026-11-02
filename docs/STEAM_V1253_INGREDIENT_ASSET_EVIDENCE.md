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


## Additional category bundle audits (same Steam build and ActivityItem source)

The same UnityFS object-table, ActivityItem field-4 GUID, AssetBundle container PPtr, Sprite-to-Texture and full-rect checks were applied independently to seven more bundles. Recorded SHA-256 values refer to the **raw compressed UnityFS source**, not the extracted images.

| Source bundle | Raw SHA-256 | Mapped ItemIDs | Unique Sprite references |
| --- | --- | ---: | ---: |
| \`flower_584a9f69.bundle\` | \`e7cbd3f2c08f13bcca84e58ec96cf519ef566cb2061c5ae6fe3d65a612b97770\` | 110 | 100 |
| \`fish_3f084647.bundle\` | \`cfb844919e844124ba390730ec95d6dd0e4fabfaf409f25227e5ef09beb551a6\` | 88 | 76 |
| \`seed_8c733f88.bundle\` | \`3650906d8318350dd35944ddbcf67f4616e11c37e544ab379a48faa059514e3f\` | 108 | 97 |
| \`craftingmaterial_a01be543.bundle\` | \`85255ade497a5fcf9945d569624286d518c7d07d874f32b84ad612173436137c\` | 148 | 124 |
| \`crop_7563a03a.bundle\` | \`c7301948d3d58315da07330245e1c58857492069b9007c79ad6a9344fcd7a3e9\` | 159 | 122 |
| \`mineral_6fc39434.bundle\` | \`0e530e5bed94c8c840c9506cec8be46f61a2615651f5ced8d842033f97734b3e\` | 57 | 53 |
| \`other_650458c6.bundle\` | \`8cfbfa263869b7b275ea382895322d16d1a79af96082dc3f111f461dbbd1b058\` | 0 via ActivityItem | 0 matched; 25 Sprite objects present |

Across Ingredient and the seven listed sources, 760 ItemIDs were matched with **zero duplicate ItemIDs between bundles**. This is a partial source-specific coverage count and must not be called a complete Steam item icon index. The \`other\` source requires another item-definition/asset reference table and must not be automatically mapped by filename.

Additional private conversion checks: Flower 110/110, Fish 88/88 and Seed 108/108 PNG/WebP RGBA pixel equality PASS, using Pillow/libwebp with \`lossless=True\`, \`exact=True\`, mixed encoding methods 0/3 due local resource limits. Taken together with Ingredient 90/90 method 6, **396/396 local decoded-RGBA equality checks passed**. Remaining Crafting Material, Crop and Mineral mappings have not been individually exported and pixel-checked; do not report them as verified deployment images.

The checked extraction script is \`scripts/audit-steam-icons.py\`. Its code and synthetic test suite contain no game image assets; the build remains reader-only and the public deployed icon manifest remains unpopulated.
