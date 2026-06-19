"""
Generate Android launcher icons for the QuickList adaptive icon.
Run from the project root (the GitHub Action does this): python3 tools/gen_icons.py

Why this exists: the Android adaptive icon FOREGROUND must fill the whole
108dp canvas (so the OS mask cuts a full dark shape, never a small floating
tile) while keeping the four dots inside the ~66dp safe zone (so no mask crops
them). Pasting a small centred copy is what produced the "reframed" look.
"""
from PIL import Image, ImageDraw
import os

src = Image.open('icon-512.png').convert('RGBA')

BG = (0x14, 0x16, 0x1B, 255)                       # dark background, fully opaque
DOTS = [(0xF2, 0x55, 0x5A), (0xE8, 0xA9, 0x17),    # TL coral, TR amber
        (0x2E, 0x97, 0xE8), (0x21, 0xA9, 0x71)]    # BL sky,  BR emerald


def make_foreground(px):
    """Full-bleed dark canvas + 4 dots sized to sit safely inside the mask."""
    img = Image.new('RGBA', (px, px), BG)
    d = ImageDraw.Draw(img)
    c = px / 2.0
    off = 0.13 * px      # dot-centre offset from the icon centre
    r = 0.11 * px        # dot radius  -> farthest point ~0.29*px < 0.305 safe radius
    centres = [(c - off, c - off), (c + off, c - off), (c - off, c + off), (c + off, c + off)]
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
    # legacy square / round launcher icon: the full dark+dots tile
    icon = src.resize((icon_px, icon_px), Image.LANCZOS)
    icon.save(f'{path}/ic_launcher.png')
    icon.save(f'{path}/ic_launcher_round.png')
    # adaptive foreground: full-bleed dark + safe-zone dots (no framing, no crop)
    make_foreground(fg_px).save(f'{path}/ic_launcher_foreground.png')

print('Custom icons written successfully')
