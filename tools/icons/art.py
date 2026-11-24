# Top Top icon art, as SVG on the 108x108 adaptive-icon canvas.
# Everything that must survive any launcher mask sits inside the r=33 safe circle.
# Colours are the game's own: floor #05080a / #0a1113, teal #19e3c8, boots #e9fffb / #8fcfc5.

def boot(cx, cy, length, angle, left, body, edge, detail, glow=False):
    """A boot from above, toe pointing up before rotation; the same shape as src/render/boot.ts."""
    L, W = length, length * 0.58
    p = (f"M0 {L*.5:.2f} C{W*.42:.2f} {L*.5:.2f} {W*.4:.2f} {L*.18:.2f} {W*.45:.2f} {-L*.06:.2f} "
         f"C{W*.52:.2f} {-L*.36:.2f} {W*.3:.2f} {-L*.5:.2f} 0 {-L*.5:.2f} "
         f"C{-W*.38:.2f} {-L*.5:.2f} {-W*.52:.2f} {-L*.34:.2f} {-W*.48:.2f} {-L*.08:.2f} "
         f"C{-W*.44:.2f} {L*.16:.2f} {-W*.42:.2f} {L*.5:.2f} 0 {L*.5:.2f} Z")
    lw = max(0.6, L * 0.045)
    flip = " scale(-1 1)" if left else ""
    laces = "".join(f'<line x1="{-W*.16:.2f}" x2="{W*.16:.2f}" y1="{-L*.1+i*L*.085:.2f}" y2="{-L*.1+i*L*.085:.2f}" '
                    f'stroke="{detail}" stroke-width="{lw*.9:.2f}" stroke-linecap="round"/>' for i in range(3))
    f = ' filter="url(#glow)"' if glow else ""
    return (f'<g transform="translate({cx} {cy}) rotate({angle}){flip}">'
            f'<path d="{p}" fill="{body}" stroke="{edge}" stroke-width="{lw:.2f}"{f}/>'
            f'<path d="M{-W*.33:.2f} {-L*.3:.2f} A{W*.3:.2f} {L*.13:.2f} 0 0 1 {W*.27:.2f} {-L*.3:.2f}" fill="none" '
            f'stroke="{detail}" stroke-width="{lw:.2f}" stroke-linecap="round"/>{laces}'
            f'<ellipse cx="0" cy="{L*.27:.2f}" rx="{W*.3:.2f}" ry="{L*.16:.2f}" fill="none" stroke="{detail}" stroke-width="{lw*1.3:.2f}"/>'
            f'</g>')

GLOW = ('<filter id="glow" x="-60%" y="-60%" width="220%" height="220%">'
        '<feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="b"/>'
        '<feFlood flood-color="#19e3c8" flood-opacity=".9"/><feComposite in2="b" operator="in" result="g"/>'
        '<feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>')

def pair(mono=False):
    """Two lit floor tiles; the left boot planted on its ring, the right one mid-swing, glowing."""
    w = lambda c: "#fff" if mono else c
    out = []
    for i, x in enumerate((29, 55)):
        if not mono:
            out.append(f'<rect x="{x}" y="41" width="24" height="24" rx="4" fill="#0a1113" stroke="#1d3034" stroke-width=".7"/>')
            out.append(f'<rect x="{x+4.5}" y="45.5" width="15" height="15" rx="2.6" fill="#19e3c8" opacity="{.22 if i==0 else .12}"/>')
    # the planted boot's ring
    out.append(f'<circle cx="41" cy="53" r="11" fill="none" stroke="{w("#19e3c8")}" stroke-opacity="{1 if mono else .55}" stroke-width="1.3"/>')
    # the swing arc, from the right tile up toward the next one
    out.append(f'<path d="M67 53 A26 26 0 0 0 59.4 34.6" fill="none" stroke="{w("#19e3c8")}" stroke-opacity="{1 if mono else .6}" '
               'stroke-width="1.4" stroke-linecap="round" stroke-dasharray="0.1 3.4"/>')
    out.append(boot(41, 53, 19, 0, True, w("#8fcfc5"), w("#3fb6a5"), "#000" if mono else "#2c6e66"))
    out.append(boot(66, 48, 19, 22, False, w("#e9fffb"), w("#19e3c8"), "#000" if mono else "#2a8f82", glow=not mono))
    # centre the composition in the safe circle
    return '<g transform="translate(54 54) scale(1.08) translate(-54 -51)">' + "".join(out) + '</g>'

def background():
    cells = "".join(f'<rect x="{x+3}" y="{y+3}" width="12" height="12" rx="2" fill="#19e3c8" opacity="{.05 if (x+y)//18%2 else .08}"/>'
                    for x in range(0, 108, 18) for y in range(0, 108, 18))
    return f'''<defs><radialGradient id="bg" cx=".5" cy=".45" r=".7">
<stop offset="0" stop-color="#0d1c1e"/><stop offset="1" stop-color="#05080a"/></radialGradient>{GLOW}</defs>
<rect width="108" height="108" fill="url(#bg)"/>{cells}'''

def svg(body, view="0 0 108 108", size=108, clip=None):
    c = ""
    if clip == "circle":
        c = '<clipPath id="c"><circle cx="54" cy="54" r="36"/></clipPath>'
        body = f'<g clip-path="url(#c)">{body}</g>'
    elif clip == "squircle":
        c = '<clipPath id="c"><rect x="18" y="18" width="72" height="72" rx="15"/></clipPath>'
        body = f'<g clip-path="url(#c)">{body}</g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" width="{size}" height="{size}">'
            f'<defs>{c}{GLOW}</defs>{body}</svg>')

FG = lambda: svg(pair())
SPLASH = lambda: svg(pair())
BG = lambda: svg(background())
MONO = lambda: svg(pair(mono=True))
FULL = lambda clip=None, view="18 18 72 72": svg(background() + pair(), view=view, clip=clip)
