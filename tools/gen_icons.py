"""
Generate Android launcher icons for QuickList.
Run from the project root: python3 tools/gen_icons.py

All icon variants (legacy, round, adaptive foreground) use the same
dark full-bleed design so there are no white corners or borders.
The adaptive icon background XML is also set to the same dark color.
"""
from PIL import Image, ImageDraw
import os

src = Image.open('icon-512.png').convert('RGBA')

BG = (0x14, 0x16, 0x1B, 255)                       # dark background
DOTS = [(0xF2, 0x55, 0x5A), (0xE8, 0xA9, 0x17),    # TL coral, TR amber
        (0x2E, 0x97, 0xE8), (0x21, 0xA9, 0x71)]    # BL sky,  BR emerald


def make_icon(px):
    """Dark canvas + 4 coloured dots — used for every icon variant."""
    img = Image.new('RGBA', (px, px), BG)
    d = ImageDraw.Draw(img)
    c = px / 2.0
    off = 0.13 * px
    r = 0.11 * px
    centres = [(c - off, c - off), (c + off, c - off),
               (c - off, c + off), (c + off, c + off)]
    for (cx, cy), col in zip(centres, DOTS):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col + (255,))
    return img


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

    # Legacy square and round icons — same dark design, no white border
    icon = make_icon(icon_px)
    icon.save(f'{path}/ic_launcher.png')
    icon.save(f'{path}/ic_launcher_round.png')

    # Adaptive foreground — larger canvas, same design
    make_icon(fg_px).save(f'{path}/ic_launcher_foreground.png')

# Overwrite the adaptive icon background XML with the same dark color
# so there is never any white visible under the foreground layer
drawable = 'android/app/src/main/res/drawable'
os.makedirs(drawable, exist_ok=True)
with open(f'{drawable}/ic_launcher_background.xml', 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n'
            '<shape xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <solid android:color="#14161B"/>\n'
            '</shape>\n')

print('All icons written — dark background, no white borders')
