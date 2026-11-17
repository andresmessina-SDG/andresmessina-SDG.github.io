#!/usr/bin/env python3
"""Letter the signature: python3 tools/quill.py

Writes src/sdg.svg, the gilded S.D.G. at the foot of the page, laid in real
burnished gold (assets/book/gold.webp, from a thirteenth-century Bible initial).

S.D.G. is set in the page's own EB Garamond at weight 600, turned into plain
paths so it can be written out stroke by stroke. Each letter is uncovered by
a mask of broad pen strokes that follow its ductus, the order and direction
a scribe's pen would take; site.js and site.css run the pen once the
signature comes into view. Needs fontTools and brotli.
"""
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
    <pattern id="sdg-gold" patternUnits="userSpaceOnUse" x="0" y="-760" width="820" height="820">
      <image href="/assets/book/gold.webp" width="820" height="820" preserveAspectRatio="none"/>
    </pattern>
    <linearGradient id="sdg-depth" gradientUnits="userSpaceOnUse" x1="0" y1="-700" x2="0" y2="40">
      <stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3A2600" stop-opacity=".35"/>
    </linearGradient>
    <linearGradient id="sdg-sheen" gradientUnits="userSpaceOnUse" x1="-900" y1="-700" x2="-300" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      <animateTransform id="sdg-glint" attributeName="gradientTransform" type="translate" from="0 0" to="{width + 1200} 0" dur="2.4s" begin="indefinite" fill="freeze"/>
    </linearGradient>
    <radialGradient id="sdg-lamp" gradientUnits="userSpaceOnUse" cx="-9999" cy="-9999" r="520">
      <stop offset="0" stop-color="#FFF8DC" stop-opacity=".8"/><stop offset=".5" stop-color="#FFF3C4" stop-opacity=".25"/><stop offset="1" stop-color="#FFF3C4" stop-opacity="0"/>
    </radialGradient>
    <mask id="sdg-pen" maskUnits="userSpaceOnUse" x="-200" y="-900" width="{width + 400}" height="1100">
      <g class="sdg-pen" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">{pen_strokes}</g>
    </mask>
    <g id="sdg-glyphs">{"".join(letters)}</g>
  </defs>
  <g class="sdg-ink" mask="url(#sdg-pen)">
    <use href="#sdg-glyphs" fill="url(#sdg-gold)" stroke="#6E4F12" stroke-width="6" paint-order="stroke"/>
    <use href="#sdg-glyphs" fill="url(#sdg-depth)"/>
    <use href="#sdg-glyphs" fill="url(#sdg-sheen)"/>
    <use href="#sdg-glyphs" fill="url(#sdg-lamp)"/>
  </g>
</svg>
'''


def main():
    (ROOT / "src" / "sdg.svg").write_text(sdg(), encoding="utf-8")
    print("wrote src/sdg.svg")


if __name__ == "__main__":
    main()
