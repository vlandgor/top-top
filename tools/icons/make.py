#!/usr/bin/env python3
"""Renders every icon and splash image from art.py.

Needs rsvg-convert (librsvg) and Pillow. Run from the repo root:  python3 tools/icons/make.py
Writes the Android launcher icons (adaptive + legacy + themed monochrome), the splash
images, the web favicon and the Play Store icon.
"""
import os, subprocess, tempfile, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import art

RES = "android/app/src/main/res"
DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
BG = (5, 8, 10)                                     # #05080a, the game's background

def render(svg, w, h=None):
    h = h or w
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as f:
        f.write(svg); path = f.name
    out = path + ".png"
    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), path, "-o", out], check=True)
    im = Image.open(out).convert("RGBA"); os.remove(path); os.remove(out)
    return im

def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)

for d, k in DENS.items():
    # adaptive icon layers: 108dp
    s = round(108 * k)
    save(render(art.FG(), s), f"{RES}/mipmap-{d}/ic_launcher_foreground.png")
    save(render(art.BG(), s), f"{RES}/mipmap-{d}/ic_launcher_background.png")
    save(render(art.MONO(), s), f"{RES}/mipmap-{d}/ic_launcher_monochrome.png")
    # legacy icons for Android 7 and older launchers: 48dp, the visible 72dp of the canvas
    s = round(48 * k)
    save(render(art.FULL("squircle", view="0 0 108 108").replace('viewBox="0 0 108 108"', 'viewBox="18 18 72 72"'), s),
         f"{RES}/mipmap-{d}/ic_launcher.png")
    save(render(art.FULL("circle", view="0 0 108 108").replace('viewBox="0 0 108 108"', 'viewBox="18 18 72 72"'), s),
         f"{RES}/mipmap-{d}/ic_launcher_round.png")
    # Android 12+ splash icon: 288dp canvas, content inside the 192dp circle
    save(render(art.SPLASH(), round(288 * k)), f"{RES}/drawable-{d}/splash_icon.png")

# legacy splash (Android 11 and older): the game's background with the icon in the middle
SPLASH = {"port-mdpi": (320, 480), "port-hdpi": (480, 800), "port-xhdpi": (720, 1280),
          "port-xxhdpi": (960, 1600), "port-xxxhdpi": (1280, 1920),
          "land-mdpi": (480, 320), "land-hdpi": (800, 480), "land-xhdpi": (1280, 720),
          "land-xxhdpi": (1600, 960), "land-xxxhdpi": (1920, 1280), "": (480, 320)}
for q, (w, h) in SPLASH.items():
    im = Image.new("RGBA", (w, h), BG + (255,))
    s = round(min(w, h) * 0.9)
    fg = render(art.SPLASH(), s)
    im.alpha_composite(fg, ((w - s) // 2, (h - s) // 2))
    save(im.convert("RGB"), f"{RES}/drawable{'-' + q if q else ''}/splash.png")

# Play Store icon: 512x512, full bleed (Play rounds the corners itself)
full = art.FULL(None, view="18 18 72 72")
save(render(full, 512).convert("RGB"), "store/icon-512.png")
# Play Store feature graphic, 1024x500: the LED floor with the boots mid-step, the name on the
# left. no other words, so one image serves every store language
def feature():
    cells = []
    for gx in range(14):
        for gy in range(7):
            x, y = 470 + gx * 76 - 40, -20 + gy * 76
            lit = (gx, gy) in ((3, 3), (4, 3))
            cells.append(f'<rect x="{x}" y="{y}" width="70" height="70" rx="10" fill="#0a1113" stroke="#132024"/>'
                         f'<rect x="{x+12}" y="{y+12}" width="46" height="46" rx="7" fill="#19e3c8" '
                         f'opacity="{.22 if lit else (.05 if (gx+gy)%2 else .08)}"/>')
    danger = ('<rect x="886" y="208" width="70" height="70" rx="10" fill="#ff3b4e" filter="url(#glow)"/>'
              '<rect x="962" y="208" width="70" height="70" rx="10" fill="none" stroke="#ff3b4e" stroke-width="3" '
              'stroke-dasharray="9 6" opacity=".7"/>')
    boots = art.boot(0, 0, 50, 0, True, "#8fcfc5", "#3fb6a5", "#2c6e66") + art.boot(58, -8, 50, 22, False, "#e9fffb", "#19e3c8", "#2a8f82", glow=True)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
<defs>{art.GLOW}<linearGradient id="fade" x1="0" x2="1"><stop offset=".3" stop-color="#05080a"/>
<stop offset=".62" stop-color="#05080a" stop-opacity="0"/></linearGradient></defs>
<rect width="1024" height="500" fill="#05080a"/>{"".join(cells)}{danger}
<circle cx="693" cy="243" r="30" fill="none" stroke="#19e3c8" stroke-opacity=".55" stroke-width="3"/>
<g transform="translate(693 243) scale(1.3)">{boots}</g>
<rect width="1024" height="500" fill="url(#fade)"/>
<text x="64" y="236" font-family="Noto Sans, Inter, Roboto, DejaVu Sans, sans-serif" font-weight="900"
 font-size="104" fill="#effffc" letter-spacing="6">TOP</text>
<text x="64" y="346" font-family="Noto Sans, Inter, Roboto, DejaVu Sans, sans-serif" font-weight="900"
 font-size="104" fill="#effffc" letter-spacing="6">TOP</text>
</svg>'''
save(render(feature(), 1024, 500).convert("RGB"), "store/feature-graphic-1024x500.png")

# web favicon
os.makedirs("public", exist_ok=True)
open("public/icon.svg", "w").write(art.FULL("squircle", view="18 18 72 72"))
print("icons and splash written")
