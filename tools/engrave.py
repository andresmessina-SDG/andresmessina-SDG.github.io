#!/usr/bin/env python3
"""Engrave the two lines of Bach that sit on the page's staves: python3 tools/engrave.py

Writes src/score-open.svg (the first line of the chorale, under "The works")
and src/score-close.svg (its last line, which ends at the final double bar).

The notes are the soprano of J. S. Bach's four-part setting of Luther's
"Ein feste Burg ist unser Gott", BWV 302, in D major and common time:
bars 0 to 2 (the upbeat to the first fermata) and bars 10 to 12 (the last
phrase to the final fermata), checked against the music21 edition of the
Bach chorales.

The note shapes come from Bravura (SIL Open Font License), the SMuFL music
font, turned into plain SVG paths so the page needs no music font. Needs
fontTools; Bravura.otf is downloaded into tools/.cache/ on first run.
"""
import urllib.request
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / ".cache"  # not committed; see .gitignore
BRAVURA_URL = "https://raw.githubusercontent.com/steinbergmedia/bravura/master/redist/otf/Bravura.otf"

S = 5.0             # one staff space, in CSS pixels; the page's staves use the same
TOP = 16.0          # room above the top line (stems and fermatas), in pixels
LYRIC_GAP = 3.4     # baseline of the words, in staff spaces below the bottom line
INK = "var(--ink)"
WORDS = "var(--muted)"

# SMuFL code points
G_CLEF, SHARP, COMMON_TIME = 0xE050, 0xE262, 0xE08A
HEAD_BLACK, HEAD_HALF, FERMATA = 0xE0A4, 0xE0A3, 0xE4C0

# Diatonic steps above E4, the bottom line of the treble staff.
STEP = {"D4": -1, "E4": 0, "F#4": 1, "G4": 2, "A4": 3, "B4": 4, "C#5": 5, "D5": 6}

BAR = "|"
# (pitch, length in quarters, syllable, hyphen after it, fermata)
OPENING = [
    ("D5", 1, "Ein’", False, False), BAR,
    ("D5", 1, "fe", True, False), ("D5", 1, "ste", False, False),
    ("A4", .5, "Burg", False, False), ("B4", .5, "", False, False), ("C#5", 1, "ist", False, False), BAR,
    ("D5", .5, "un", True, False), ("C#5", .5, "", False, False), ("B4", 1, "ser", False, False),
    ("A4", 1, "Gott,", False, True),
]
CLOSING = [
    ("D5", 1, "auf", False, False), ("C#5", 1, "Erd’n", False, False), ("B4", 1, "ist", False, False), BAR,
    ("A4", 1, "nicht", False, False), ("B4", .5, "sein’s", False, False), ("A4", .5, "", False, False),
    ("G4", 1, "Glei", True, False), ("F#4", 1, "", False, False), BAR,
    ("E4", 2, "", False, False), ("D4", 1, "chen.", False, True),
]
ADVANCE = {.5: 2.5, 1: 3.6, 2: 5.0}  # least horizontal space after a note, in staff spaces
WORD_SIZE = 11.5    # px; the size .score-words sets in assets/site.css
WORD_GAP = 1.1      # least space between two syllables, in staff spaces
WORD_FONT = ROOT / "assets" / "fonts" / "eb-garamond-italic-latin.woff2"


class Words:
    """Widths of syllables in the page's own italic, so no two words collide."""
    def __init__(self):
        f = TTFont(WORD_FONT)
        self.cmap, self.hmtx, self.upm = f.getBestCmap(), f["hmtx"], f["head"].unitsPerEm

    def width(self, s: str) -> float:
        return sum(self.hmtx[self.cmap[ord(c)]][0] for c in s if ord(c) in self.cmap) * WORD_SIZE / self.upm


def font() -> TTFont:
    path = CACHE / "Bravura.otf"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_bytes(urllib.request.urlopen(BRAVURA_URL, timeout=60).read())
    return TTFont(path)


class Glyphs:
    def __init__(self, f: TTFont):
        self.set = f.getGlyphSet()
        self.cmap = f.getBestCmap()
        self.k = S / 250.0  # SMuFL: an em is four staff spaces

    def bounds(self, cp):
        pen = BoundsPen(self.set)
        self.set[self.cmap[cp]].draw(pen)
        x0, y0, x1, y1 = pen.bounds
        return x0 * self.k, y0 * self.k, x1 * self.k, y1 * self.k

    def path(self, cp, x, y):
        """SVG path for a glyph whose origin sits at (x, y)."""
        pen = SVGPathPen(self.set, lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        self.set[self.cmap[cp]].draw(TransformPen(pen, (self.k, 0, 0, -self.k, x, y)))
        return f'<path d="{pen.getCommands()}"/>'


def y_of(pitch: str, bottom: float) -> float:
    return bottom - STEP[pitch] * S / 2


def engrave(notes, with_clef: bool, g: Glyphs, w: "Words", label: str) -> str:
    bottom = TOP + 4 * S + 0.5  # centre of the bottom line (CSS draws 1px lines from y=0)
    parts, words = [], []
    x = 0.6 * S
    if with_clef:
        parts.append(g.path(G_CLEF, x, y_of("G4", bottom)))
        x += g.bounds(G_CLEF)[2] + 1.0 * S
        for p in ("F#5", "C#5"):  # key signature: F sharp on the top line, C sharp in the third space
            step = {"F#5": 8, "C#5": 5}[p]
            parts.append(g.path(SHARP, x, bottom - step * S / 2))
            x += g.bounds(SHARP)[2] + 0.3 * S
        x += 0.8 * S
        parts.append(g.path(COMMON_TIME, x, bottom - 2 * S))
        x += g.bounds(COMMON_TIME)[2] + 1.6 * S
    head_w = g.bounds(HEAD_BLACK)[2]
    stem_w = 0.12 * S

    # place the notes: by the rhythm, then further apart wherever the words need room
    placed, word_end, bars_since = [], -1e9, []
    for n in notes:
        if n == BAR:
            x += 0.2 * S
            placed.append(["bar", x])
            bars_since.append(len(placed) - 1)
            x += 1.7 * S
            continue
        pitch, length, syl, hyphen, fermata = n
        if syl:
            left = x + head_w / 2 - w.width(syl) / 2
            if left < word_end:
                shift = word_end - left
                # a bar line just before this note moves with it, keeping its distance
                for k in bars_since:
                    placed[k][1] += shift
                x += shift
            word_end = x + head_w / 2 + w.width(syl) / 2 + WORD_GAP * S + (1.4 * S if hyphen else 0)
        bars_since = []
        placed.append(["note", x, pitch, length, syl, hyphen, fermata])
        x += ADVANCE[length] * S
    width = x - ADVANCE[notes[-1][1]] * S + head_w + 1.2 * S

    # group eighths into beamed pairs
    items = [p for p in placed if p[0] == "note"]
    beams, i = [], 0
    while i < len(items):
        if items[i][3] == .5 and i + 1 < len(items) and items[i + 1][3] == .5:
            beams.append((i, i + 1))
            i += 2
        else:
            i += 1
    in_beam = {a: b for a, b in beams} | {b: a for a, b in beams}

    def stem_up(idxs):
        far = max((items[j] for j in idxs), key=lambda it: abs(STEP[it[2]] - 4))
        return STEP[far[2]] < 4

    ends = {}
    for a, b in beams:
        up = stem_up([a, b])
        ya, yb = (y_of(items[j][2], bottom) + (-3.5 if up else 3.5) * S for j in (a, b))
        mid = (ya + yb) / 2
        slant = max(-0.5 * S, min(0.5 * S, (yb - ya) / 2))
        ends[a], ends[b] = (up, mid - slant / 2), (up, mid + slant / 2)
    for j, it in enumerate(items):
        if j not in ends:
            up = stem_up([j])
            ends[j] = (up, y_of(it[2], bottom) + (-3.5 if up else 3.5) * S)

    for p in placed:
        if p[0] == "bar":
            parts.append(f'<rect x="{p[1]:.2f}" y="{TOP:.2f}" width="{0.16 * S:.2f}" height="{4 * S + 1:.2f}"/>')
    for j, (_, nx, pitch, length, syl, hyphen, fermata) in enumerate(items):
        ny = y_of(pitch, bottom)
        parts.append(g.path(HEAD_HALF if length == 2 else HEAD_BLACK, nx, ny))
        up, end = ends[j]
        sx = nx + head_w - stem_w if up else nx
        y0, y1 = (end, ny - 0.17 * S) if up else (ny + 0.17 * S, end)
        parts.append(f'<rect x="{sx:.2f}" y="{min(y0, y1):.2f}" width="{stem_w:.2f}" height="{abs(y1 - y0):.2f}"/>')
        if fermata:
            top_of_music = min(TOP, end if up else ny - 0.6 * S)
            parts.append(g.path(FERMATA, nx + head_w / 2 - (g.bounds(FERMATA)[2]) / 2, top_of_music - 0.45 * S))
        if syl:
            words.append(f'<text x="{nx + head_w / 2:.2f}" y="{bottom + LYRIC_GAP * S:.2f}">{syl}</text>')
        nxt = next((it for it in items[j + 1:] if it[4]), None)  # the next note that carries a syllable
        if hyphen and nxt:
            left_end = nx + head_w / 2 + w.width(syl) / 2
            right_start = nxt[1] + head_w / 2 - w.width(nxt[4]) / 2
            hx = (left_end + right_start) / 2  # midway between the two syllables
            words.append(f'<text x="{hx:.2f}" y="{bottom + LYRIC_GAP * S:.2f}">-</text>')
    for a, b in beams:
        (up, ya), (_, yb) = ends[a], ends[b]
        xa = items[a][1] + (head_w - stem_w if up else 0)
        xb = items[b][1] + (head_w if up else stem_w)
        t = 0.5 * S * (1 if up else -1)
        parts.append(f'<path d="M{xa:.2f} {ya:.2f}L{xb:.2f} {yb:.2f}L{xb:.2f} {yb + t:.2f}L{xa:.2f} {ya + t:.2f}Z"/>')

    height = bottom + LYRIC_GAP * S + 4
    return (f'<svg class="score-notes" viewBox="0 0 {width:.1f} {height:.1f}" width="{width:.1f}" height="{height:.1f}" '
            f'role="img" aria-label="{label}">\n'
            f'  <g fill="{INK}">{"".join(parts)}</g>\n'
            f'  <g class="score-words" fill="{WORDS}" text-anchor="middle">{"".join(words)}</g>\n'
            f'</svg>\n')


def main():
    g, w = Glyphs(font()), Words()
    (ROOT / "src" / "score-open.svg").write_text(
        engrave(OPENING, True, g, w, "The first line of Bach’s setting of Ein feste Burg ist unser Gott"), encoding="utf-8")
    (ROOT / "src" / "score-close.svg").write_text(
        engrave(CLOSING, False, g, w, "The last line of Bach’s setting of Ein feste Burg ist unser Gott"), encoding="utf-8")
    print("wrote src/score-open.svg and src/score-close.svg")


if __name__ == "__main__":
    main()
