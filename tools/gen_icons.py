"""
Resize icon-512.png into all Android mipmap icon sizes.
Run from the project root: python3 tools/gen_icons.py
"""
from PIL import Image
import os

src = Image.open('icon-512.png').convert('RGBA')

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
    icon = src.resize((icon_px, icon_px), Image.LANCZOS)
    icon.save(f'{path}/ic_launcher.png')
    icon.save(f'{path}/ic_launcher_round.png')
    # Adaptive foreground: icon centered in larger canvas
    fg = Image.new('RGBA', (fg_px, fg_px), (0, 0, 0, 0))
    off = (fg_px - icon_px) // 2
    fg.paste(icon, (off, off), icon)
    fg.save(f'{path}/ic_launcher_foreground.png')

print('Custom icons written successfully')
