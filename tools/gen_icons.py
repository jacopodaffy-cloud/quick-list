"""
Generate Android launcher icons for QuickList.
Run from the project root: python3 tools/gen_icons.py

- Dots are smaller (r = 0.075 * px) and sit comfortably inside safe zone
- ic_launcher.png has pre-baked rounded corners so it looks right on every launcher
- ic_launcher_background.xml is overwritten with the same dark colour so no white shows
"""
from PIL import Image, ImageDraw
import os

BG = (0x14, 0x16, 0x1B, 255)
DOTS = [(0xF2, 0x55, 0x5A), (0xE8, 0xA9, 0x17),
        (0x2E, 0x97, 0xE8), (0x21, 0xA9, 0x71)]


def make_icon(px):
    """Dark canvas with 4 smaller coloured dots."""
    img = Image.new('RGBA', (px, px), BG)
    d = ImageDraw.Draw(img)
    c = px / 2.0
    off = 0.10 * px    # dots closer together (was 0.13)
    r = 0.075 * px          # smaller than before (was 0.11)
    centres = [(c - off, c - off), (c + off, c - off),
               (c - off, c + off), (c + off, c + off)]
    for (cx, cy), col in zip(centres, DOTS):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col + (255,))
    return img


def make_icon_rounded(px):
    """Same icon with pre-rounded corners (22% radius) baked in.
    Corners are filled with the same dark BG so no white or transparent areas."""
    base = make_icon(px)
    mask = Image.new('L', (px, px), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, px - 1, px - 1], radius=int(px * 0.22), fill=255
    )
    result = Image.new('RGBA', (px, px), BG)   # dark fill for corners
    result.paste(base, mask=mask)
    return result


configs = [
    ('mipmap-mdpi',    48,  108),
    ('mipmap-hdpi',    72,  162),
    ('mipmap-xhdpi',   96,  216),
    ('mipmap-xxhdpi',  144, 324),
    ('mipmap-xxxhdpi', 192, 432),
]

for folder, icon_px, fg_px in configs:
    path = f'android/app/src/main/res/{folder}'
    os.makedirs(path, exist_ok=True)

    # Legacy launcher icon — pre-rounded so corners always look right
    make_icon_rounded(icon_px).save(f'{path}/ic_launcher.png')
    # Round icon variant (circle mask handled by the OS, but give it the design)
    make_icon(icon_px).save(f'{path}/ic_launcher_round.png')
    # Adaptive foreground — full canvas, OS applies its own mask
    make_icon(fg_px).save(f'{path}/ic_launcher_foreground.png')

# Overwrite adaptive icon background to dark — no white leaking behind foreground
drawable = 'android/app/src/main/res/drawable'
os.makedirs(drawable, exist_ok=True)
with open(f'{drawable}/ic_launcher_background.xml', 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n'
            '<shape xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <solid android:color="#14161B"/>\n'
            '</shape>\n')

print('Icons written — smaller dots, rounded corners, dark background everywhere')
