"""Cuts white-on-transparent docs/brand-v2/emblem.png and logotype.png out of the client's reference renders.

Stopgap: docs/brand-v2/client-logo.jpeg and the original emblem.png / logotype.png were not delivered with the brief
(D-049), so the elements are recovered from the rendered references (ink #73393B on blush #F5E8E2). Alpha is the share
of ink at each pixel, so antialiasing is kept. Nothing is redrawn or re-typeset. Replace the outputs with the client's
originals when they arrive; tools/brand/build.ts reads only the two PNGs.
Run: python3 tools/brand/extract-from-reference.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2] / 'docs' / 'brand-v2'
BG = np.array([0xF5, 0xE8, 0xE2], float)
INK = np.array([0x73, 0x39, 0x3B], float)


def white_on_transparent(img: Image.Image) -> Image.Image:
    px = np.asarray(img.convert('RGB'), float)
    axis = BG - INK
    alpha = np.clip(((BG - px) @ axis) / (axis @ axis), 0, 1)
    alpha[alpha < 0.03] = 0  # flatten JPEG-like noise in the field
    out = np.zeros(px.shape[:2] + (4,), np.uint8)
    out[..., :3] = 255
    out[..., 3] = (alpha * 255).round().astype(np.uint8)
    return Image.fromarray(out)


def trim(img: Image.Image, pad: int = 8) -> Image.Image:
    a = np.asarray(img)[..., 3]
    ys, xs = np.where(a > 8)
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, img.width), min(ys.max() + pad + 1, img.height))
    return img.crop(box)


# emblem: the icon render has it alone at 62% of a 1024 canvas
trim(white_on_transparent(Image.open(root / 'icon-blush.png'))).save(root / 'emblem.png')

# logotype: the splash render, rows between the emblem and the tagline
splash = white_on_transparent(Image.open(root / '01-blush-light.png'))
a = np.asarray(splash)[..., 3]
rows = np.where((a > 8).any(axis=1))[0]
# split the ink rows into bands (emblem, logotype, tagline) at gaps of 40 px or more
bands, start = [], rows[0]
for prev, cur in zip(rows, rows[1:]):
    if cur - prev > 40:
        bands.append((start, prev)); start = cur
bands.append((start, rows[-1]))
assert len(bands) == 3, bands
y0, y1 = bands[1]
trim(splash.crop((0, y0 - 4, splash.width, y1 + 5))).save(root / 'logotype.png')
print('bands', bands)
