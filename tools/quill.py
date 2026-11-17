#!/usr/bin/env python3
"""Letter the signature: python3 tools/quill.py

Writes src/sdg.svg, the gilded S.D.G. at the foot of the page, and
src/seal.svg, the wax seal pressed beside it.

S.D.G. is set in the page's own EB Garamond at weight 600, turned into plain
paths so it can be written out stroke by stroke. Each letter is uncovered by
a mask of broad pen strokes that follow its ductus, the order and direction
a scribe's pen would take; site.js and site.css run the pen once the
signature comes into view. Needs fontTools and brotli.
"""
import math
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "assets" / "fonts" / "eb-garamond-roman-latin.woff2"
TRACK = 140  # letter-spacing, in font units: the 0.14em the text once had

# Pen strokes for each glyph, in its own font units (y up, from its origin):
# (path, nib width, seconds the pen takes). They are drawn in this order.
DUCTUS = {
    "S": [("M425 470C400 590 340 645 240 645C140 645 95 590 95 510C95 420 180 380 260 330"
           "C340 280 390 240 390 170C390 70 310 15 210 15C120 15 70 90 40 220", 165, .75)],
    ".": [("M80 55L170 45", 175, .14)],
    "D": [("M176 690L176 -30", 170, .3),
          ("M0 640L330 640C560 640 660 500 660 330C660 150 540 18 330 18L0 18", 160, .6)],
    "G": [("M640 540C600 600 530 645 420 645C230 645 105 490 105 310C105 130 230 8 400 8"
           "C480 8 570 40 690 90", 170, .65),
          ("M430 285L760 285M615 250L610 60", 130, .32)],
}
LIFT = .12  # seconds the pen is off the page between strokes


def fmt(v: float) -> str:
    return f"{v:.1f}".rstrip("0").rstrip(".")


def sdg() -> str:
    f = instancer.instantiateVariableFont(TTFont(FONT), {"wght": 600})
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
    x, letters, strokes = 0, [], []
    for ch in "S.D.G.":
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs, fmt)
        gs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        letters.append(f'<path d="{pen.getCommands()}"/>')
        for d, w, t in DUCTUS[ch]:
            strokes.append((x, d, w, t))
        x += hmtx[name][0] + TRACK
    width = x - TRACK
    pen_strokes, at = "", 0.0
    for x0, d, w, t in strokes:
        pen_strokes += (f'<path d="{d}" transform="matrix(1 0 0 -1 {x0} 0)" stroke-width="{w}" pathLength="1" '
                        f'style="--d:{at:.2f}s;--t:{t}s"/>')
        at += t + LIFT
    return f'''<svg class="sdg-letters" viewBox="0 -700 {width} 735" aria-hidden="true">
  <defs>
    <linearGradient id="sdg-gold" gradientUnits="userSpaceOnUse" x1="0" y1="-760" x2="0" y2="60">
      <stop offset="0" stop-color="#F0DA94"/><stop offset=".42" stop-color="#C9A045"/><stop offset=".7" stop-color="#A27A28"/><stop offset="1" stop-color="#7C5B19"/>
    </linearGradient>
    <linearGradient id="sdg-sheen" gradientUnits="userSpaceOnUse" x1="-900" y1="-700" x2="-300" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      <animateTransform id="sdg-glint" attributeName="gradientTransform" type="translate" from="0 0" to="{width + 1200} 0" dur="2.4s" begin="indefinite" fill="freeze"/>
    </linearGradient>
    <mask id="sdg-pen" maskUnits="userSpaceOnUse" x="-200" y="-900" width="{width + 400}" height="1100">
      <g class="sdg-pen" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">{pen_strokes}</g>
    </mask>
    <g id="sdg-glyphs">{"".join(letters)}</g>
  </defs>
  <g class="sdg-ink" mask="url(#sdg-pen)">
    <use href="#sdg-glyphs" fill="url(#sdg-gold)"/>
    <use href="#sdg-glyphs" fill="url(#sdg-sheen)"/>
  </g>
</svg>
'''


def seal() -> str:
    """A disc of vermilion wax, its edge pooled unevenly, pressed with a ring of words and a monogram."""
    pts = []
    for k in range(72):
        a = 2 * math.pi * k / 72
        r = 46 + 1.6 * math.sin(3 * a + .7) + 1.1 * math.sin(5 * a + 2.1) + .8 * math.sin(9 * a + .3) + .5 * math.sin(14 * a)
        pts.append((50 + r * math.cos(a), 50 + r * math.sin(a)))
    # a smooth closed curve through the points (Catmull-Rom as cubic Béziers)
    d = f"M{pts[0][0]:.2f} {pts[0][1]:.2f}"
    n = len(pts)
    for i in range(n):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f"C{c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}"
    d += "Z"
    ring = "M50 50m-28.5 0a28.5 28.5 0 1 1 57 0a28.5 28.5 0 1 1-57 0"
    words = "JESU JUVA · SOLI DEO GLORIA ·"
    text = (f'<text font-family="IM Fell English SC, EB Garamond, serif" font-size="8.6">'
            f'<textPath href="#seal-ring" startOffset="0" textLength="{2 * math.pi * 28.5 - 3:.1f}" lengthAdjust="spacing">{words}</textPath></text>')
    mono = '<text x="50" y="58.5" text-anchor="middle" font-family="EB Garamond, serif" font-size="25" font-weight="600" letter-spacing="-.5">AM</text>'
    return f'''<svg class="seal" viewBox="0 0 100 100" aria-hidden="true">
  <defs>
    <radialGradient id="seal-wax" cx=".36" cy=".3" r=".8">
      <stop offset="0" stop-color="#D9583A"/><stop offset=".45" stop-color="#B0361F"/><stop offset="1" stop-color="#6E1B0E"/>
    </radialGradient>
    <linearGradient id="seal-well" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7A2010"/><stop offset="1" stop-color="#B43C24"/>
    </linearGradient>
    <linearGradient id="seal-lip" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E9805F"/><stop offset=".5" stop-color="#B0361F" stop-opacity="0"/><stop offset="1" stop-color="#5A140A"/>
    </linearGradient>
    <path id="seal-ring" d="{ring}" transform="rotate(-90 50 50)"/>
    <g id="seal-device">{text}{mono}</g>
  </defs>
  <path d="{d}" fill="url(#seal-wax)"/>
  <circle cx="50" cy="50" r="37.5" fill="none" stroke="url(#seal-lip)" stroke-width="3"/>
  <circle cx="50" cy="50" r="35.6" fill="url(#seal-well)"/>
  <circle cx="50" cy="50" r="35.6" fill="none" stroke="#5A140A" stroke-opacity=".55" stroke-width="1"/>
  <use href="#seal-device" fill="#F08A68" fill-opacity=".55" transform="translate(.55 .6)"/>
  <use href="#seal-device" fill="#4E1006" fill-opacity=".8" transform="translate(-.45 -.5)"/>
  <use href="#seal-device" fill="#A2321C"/>
  <ellipse cx="34" cy="24" rx="13" ry="5" transform="rotate(-32 34 24)" fill="#fff" fill-opacity=".16"/>
</svg>
'''


def main():
    (ROOT / "src" / "sdg.svg").write_text(sdg(), encoding="utf-8")
    (ROOT / "src" / "seal.svg").write_text(seal(), encoding="utf-8")
    print("wrote src/sdg.svg and src/seal.svg")


if __name__ == "__main__":
    main()
