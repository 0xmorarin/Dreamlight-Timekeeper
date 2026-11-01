# Steam icon import (read-only save reader)

Target: Dreamlight Timekeeper, Steam/Windows DDV v1.25.3. Release format is **lossless VP8L WebP**. Image import is an offline maintainer operation, never a browser upload or save mutation.

## Asset discovery

The authoritative Steam game files are stored separately in DDVRE. The v1.25.3 Steam/Windows GameRoot includes `ddv_Data/StreamingAssets/aa/win`, Addressables catalogs and Unity assets. These files are **potential sources**, not preverified extracted icon image files.

Drive source inventory identified `aa/win/ui-images-generatedicons_assets_assets/` with category-specific bundles, including `flower_584a9f69.bundle` (3,784,859 bytes), `fish_3f084647.bundle` (4,175,341 bytes), `ingredient_1c1bf99b.bundle` (1,908,475 bytes), `seed_8c733f88.bundle` (6,372,358 bytes), `craftingmaterial_a01be543.bundle` (4,679,416 bytes), `furniture_a1c425a5.bundle` (249,369,620 bytes), and `clothing_27c843ba.bundle` (175,977,709 bytes). Another possible source is `aa/win/ui-imagesatlas_assets_all.bundle` (158,399,415 bytes). This inventory confirms the **files and their reported sizes**, not the presence of any particular extracted texture, Sprite or ItemID association. Obtain actual texture bytes from the correct asset bundle using a Unity asset extraction tool. Record the source bundle identifier and exported texture asset identifier. Establish ItemID to texture ID/GUID from authoritative game data, not file numbering or appearance. Preserve any original asset bytes and extraction provenance outside the deployable repository.

A correct source candidate is one locally extracted, non-interlaced 8-bit RGBA PNG (up to 1024×1024) with no resized/cropped pixels and an independently reviewed ItemID mapping. Every candidate requires its original file SHA-256, source asset identifier and mapping evidence.

## Local import contract

Write an unpublished local JSON file with the following structure; replace all example values with **observed** data:

```json
{
  "source": {"platform":"Steam/Windows","gameVersion":"1.25.3"},
  "icons": [{
    "itemId":"31300003",
    "pngPath":"items/31300003.png",
    "sourceAsset":"<actual asset bundle + GUID / stable texture ID>",
    "itemIdEvidence":"<actual mapping source / row ID>",
    "sourceSha256":"<sha256 of extracted PNG bytes>"
  }]
}
```

Run from repository root with Node.js, libwebp's `cwebp` and ImageMagick's `magick` on PATH:

```sh
node scripts/import-steam-icons.mjs /path/to/local-plan.json
npm test
```

The import script checks source hashes and exact source paths, converts using `cwebp -lossless -z 9 -exact -metadata none`, confirms the resulting VP8L bitstream/dimensions, and compares both decoded RGBA pixel buffers with ImageMagick. It appends only new ItemIDs to the manifest and requires all entries to pass before publishing manifest changes. Actual game provenance and copyright/redistribution review remain independent maintainer decisions. This script is not an asset extractor and does not validate game ItemID/GUID mappings independently.

Generated files are deployed to `assets/steam/v1253/*.webp`; the source PNG and the local plan remain private research input. Do not commit extracted source or personal game data. Runtime verifies the manifest structure; Node CI checks deployed WebP SHA-256, VP8L format and image dimensions. A verified icon is never treated as a save editor write capability.

Missing images remain placeholders. Under no circumstances should Switch-derived assets be relabeled Steam.


## Reproducible UnityFS extraction (v1.25.3)

The verified local source extractor is \`scripts/audit-steam-icons.py\`. It reads the original Steam \`ingredient_1c1bf99b.bundle\` and \`itemlist/ActivityItem.json\`, follows the serialized \`field 4\` icon GUID through the Unity AssetBundle container and checks Sprite-to-Texture2D path IDs. It supports full-rectangle Sprite data with BC7 (TextureFormat 25) or DXT5 (TextureFormat 12). Sub-rectangles and unexpected serialized layouts fail closed rather than silently export the wrong graphic.

Install the local analysis dependency with \`python -m pip install lz4\`; ImageMagick (\`magick\`) is required only for PNG extraction. No dependency is introduced to the public web app. The files are read from a locally owned Steam installation or authorized research copy:

\`\`\`sh
python scripts/audit-steam-icons.py --bundle /path/to/ingredient_1c1bf99b.bundle --activity /path/to/ActivityItem.json --output /private/research
python scripts/audit-steam-icons.py --bundle /path/to/ingredient_1c1bf99b.bundle --activity /path/to/ActivityItem.json --output /private/research --extract
node scripts/import-steam-icons.mjs /private/research/icon-import-plan.json
npm test
\`\`\`

The first command creates \`icon-audit.json\` without extracting image files. The second additionally creates \`items/<ItemID>.png\` and an import plan. Do not repeat \`--extract\` into a directory already containing those image names; it refuses overwrites.

This narrow extractor does not claim to support all Unity 6 bundles, atlases, compressed formats, Sprite trimming variants or all ItemID definition files. The verified Ingredient source covers 90 ItemIDs / 58 distinct Sprite assets, while other categories require independent mapping. The \`sourceAsset\` field carries GUID and exact Sprite/Texture path IDs; \`itemIdEvidence\` carries the ActivityItem file SHA-256 plus the field-4 GUID. Importing image files into the public tree remains subject to a separate publication decision.
