"""
Generate Android launcher icons for QuickList from the shared icon-512.png master.
Run from the project root:  python3 tools/gen_icons.py

icon-512.png is the full-bleed QuickList mark (blue field, white list card) that
tools/make-icons.js renders from the same coordinates as icon.svg. Resizing that
one master keeps the launcher icon identical to the PWA / web icon.

- ic_launcher.png            legacy icon, corners rounded (transparent outside)
- ic_launcher_round.png      round-mask variant (full bleed; OS circles it)
- ic_launcher_foreground.png adaptive foreground (full bleed; OS masks it)
- ic_launcher_background.xml solid brand blue, so no white shows behind the mask
"""
from PIL import Image, ImageDraw
import os

BLUE = (0x2F, 0x6B, 0xF6, 255)
SRC = os.path.join(os.path.dirname(__file__), '..', 'icon-512.png')
master = Image.open(SRC).convert('RGBA')


def resized(px):
    return master.resize((px, px), Image.LANCZOS)


def rounded(px, radius_frac=0.22):
    """Resized master with rounded corners; area outside the radius is transparent
    so legacy launchers (pre-adaptive, API < 26) show a clean squircle."""
    base = resized(px)
    mask = Image.new('L', (px, px), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, px - 1, px - 1], radius=int(px * radius_frac), fill=255)
    out = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    out.paste(base, mask=mask)
    return out


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
    rounded(icon_px).save(f'{path}/ic_launcher.png')      # legacy, pre-rounded
    resized(icon_px).save(f'{path}/ic_launcher_round.png')  # round variant
    resized(fg_px).save(f'{path}/ic_launcher_foreground.png')  # adaptive foreground

# Adaptive background: solid brand blue (matches the mark's field) so the masked
# icon never shows a white or transparent gap behind the foreground.
drawable = 'android/app/src/main/res/drawable'
os.makedirs(drawable, exist_ok=True)
with open(f'{drawable}/ic_launcher_background.xml', 'w') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n'
            '<shape xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <solid android:color="#2F6BF6"/>\n'
            '</shape>\n')

print('Icons written from icon-512.png — brand blue background, rounded legacy icon')
