import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

KEYS = ('action.open-save', 'action.open-another', 'action.backup')
INK = '#d8ece8'
SIZE = 48
SCALE = 4

def render(key):
    image = Image.new('RGBA', (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    def xy(points):
        return [(int(x * SCALE), int(y * SCALE)) for x, y in points]
    def line(points, fill=INK, width=3.25, joint='curve'):
        draw.line(xy(points), fill=fill, width=round(width * SCALE), joint=joint)
    def rectangle(box, fill=None, outline=INK, width=3):
        draw.rounded_rectangle(tuple(int(v * SCALE) for v in box), radius=round(3 * SCALE),
                               fill=fill, outline=outline, width=round(width * SCALE))
    def polygon(points, fill=None, outline=INK, width=3):
        draw.polygon(xy(points), fill=fill)
        if outline:
            line(points + [points[0]], outline, width)
    if key == 'action.open-save':
        polygon([(6, 15), (17, 15), (21, 19), (41, 19), (41, 37), (6, 37)], fill=None)
        line([(25, 30), (33, 30), (33, 24)])
        line([(29, 24), (33, 20), (37, 24)])
    elif key == 'action.open-another':
        rectangle((8, 9, 31, 34))
        rectangle((16, 17, 39, 41))
        line([(25, 28), (36, 28)])
        line([(32, 24), (36, 28), (32, 32)])
    elif key == 'action.backup':
        line([(24, 7), (24, 28)])
        line([(16, 21), (24, 29), (32, 21)])
        line([(8, 31), (8, 38), (40, 38), (40, 31)])
    else:
        raise ValueError('Unknown semantic icon: ' + key)
    return image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

def generate(output):
    root = Path(output)
    manifest = {'kind': 'app_ui', 'source': {'platform': 'Dreamlight Timekeeper',
                'revision': 1, 'status': 'VERIFIED_ASSETS', 'writerAuthorization': False}, 'icons': {}}
    for key in KEYS:
        image = render(key)
        path = 'assets/app/ui/' + key.replace('.', '/') + '.webp'
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, 'WEBP', lossless=True, method=6, exact=True)
        decoded = Image.open(target).convert('RGBA')
        if decoded.tobytes() != image.tobytes() or target.read_bytes()[12:16] != b'VP8L':
            raise ValueError('Lossless image mismatch: ' + key)
        manifest['icons'][key] = {'kind': 'app_ui', 'verified': True, 'path': path,
          'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
          'sourceSha256': hashlib.sha256(image.tobytes()).hexdigest(),
          'sourceAsset': 'scripts/build-app-ui-icons.py',
          'mappingEvidence': 'Original 48x48 author-defined glyph: ' + key,
          'width': SIZE, 'height': SIZE}
    dest = root / 'data' / 'app-ui-icons.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return manifest

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = generate(args.output)
    print(json.dumps({'generated': len(result['icons']), 'format': 'VP8L Lossless WebP'}))
