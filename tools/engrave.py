#!/usr/bin/env python3
"""Engrave the chorale the book is written over: python3 tools/engrave.py

The page carries the whole of J. S. Bach's four-part setting of Luther's
"Ein feste Burg ist unser Gott", BWV 302, one line to each spread of the book:
the nine phrases of its strophe, as the music21 edition of the Bach chorales
has them (the repeat of the first two written out with the second verse's
words), set out in seven staves:

  1  Ein' feste Burg ist unser Gott,            the opening spread
  2  ein' gute Wehr und Waffen.                 Scriptura
  3  Er hilft uns frei aus aller Noth,          Worldviews in Motion
  4  die uns jetzt hat betroffen.               A History of the Christian Church
  5  Der alt' böse Feind, mit Ernst er's jetzt meint,   The Pilgrim's Road
  6  gross Macht und viel List sein grausam' Rüstzeug ist,   Revelation
  7  auf Erd'n ist nicht sein's Gleichen.       the last spread, to the final double bar

Writes src/chorale/1.svg to 7.svg: the soprano engraved on its own staff, with
its words, each note a <g class="n"> that lights as it sounds, and the
staff's data-play attribute holding all four voices as [start, length, MIDI
note] in beats, with the fermatas held, for site.js's organ. Also writes
src/bach.svg, B-A-C-H in notes for the colophon.

The note shapes come from Bravura (SIL Open Font License), the SMuFL music
font, turned into plain SVG paths so the page needs no music font. Needs
fontTools and music21; Bravura.otf is downloaded into tools/.cache/ on first run.
"""
import json
import urllib.request
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / ".cache"  # not committed; see .gitignore
BRAVURA_URL = "https://raw.githubusercontent.com/steinbergmedia/bravura/master/redist/otf/Bravura.otf"

S = 5.0             # one staff space, in CSS pixels
TOP = 16.0          # room above the top line (stems and fermatas), in pixels
LYRIC_GAP = 3.4     # baseline of the words, in staff spaces below the bottom line
INK = "var(--ink)"
WORDS = "var(--muted)"
RULE = "var(--rule)"

# SMuFL code points
G_CLEF, SHARP, COMMON_TIME = 0xE050, 0xE262, 0xE08A
HEAD_BLACK, HEAD_HALF, FERMATA = 0xE0A4, 0xE0A3, 0xE4C0
HEAD_WHOLE, FLAT, NATURAL = 0xE0A2, 0xE260, 0xE261

# Diatonic steps above E4, the bottom line of the treble staff.
LETTER_STEP = {"C": -2, "D": -1, "E": 0, "F": 1, "G": 2, "A": 3, "B": 4}
KEY = {"F", "C"}    # D major: F and C are sharp in the key signature

ADVANCE = {.5: 2.5, 1: 3.6, 2: 5.0}  # least horizontal space after a note, in staff spaces
WORD_SIZE = 11.5    # px; the size .score-words sets in assets/site.css
WORD_GAP = 1.1      # least space between two syllables, in staff spaces
WORD_FONT = ROOT / "assets" / "fonts" / "eb-garamond-italic-latin.woff2"

# Each staff: the soprano's span of the strophe, in quarter notes from its start (repeat written out)
STAVES = [(0, 8), (8, 16), (16, 24), (24, 32), (32, 44), (44, 54), (54, 64)]
HOLD, BREATH = 0.9, 0.3   # a fermata holds its chord this many beats longer, then breathes
BEAT = 0.68               # seconds to a quarter note when the organ plays


def step(pitch: str) -> int:
    letter, octave = pitch[0], int(pitch[-1])
    return LETTER_STEP[letter] + 7 * (octave - 4)


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
    return bottom - step(pitch) * S / 2


def read_chorale():
    """The soprano as notes and bar lines, and all four voices as sounding events, per staff."""
    from music21 import corpus
    score = corpus.parse("bach/bwv302").expandRepeats()
    parts = list(score.parts)
    sop = []
    for m in parts[0].getElementsByClass("Measure"):
        for n in m.notes:
            at = float(m.offset + n.offset)
            want = 2 if 16 <= at < 32 else 1   # the written-out repeat takes the second verse's words
            lyric = next((l for l in n.lyrics if l.text and l.number == want), None) or next((l for l in n.lyrics if l.text), None)
            sop.append({
                "at": at, "len": float(n.quarterLength),
                "pitch": n.pitch.nameWithOctave.replace("-", "b"),
                "syl": lyric.text.replace("'", "’").replace("gross", "groß") if lyric else "",
                "hyphen": bool(lyric and lyric.syllabic in ("begin", "middle")),
                "fermata": bool(n.expressions),
                # the edition splits a measure where a phrase ends, so a bar line goes by the beat, not the measure
                "downbeat": n.beat == 1,
                "ends_bar": n.beat + n.quarterLength == 5,
            })
    voices = [[(float(n.offset), float(n.quarterLength), n.pitch.midi) for n in p.flatten().notes] for p in parts]
    return sop, voices


def staff_notes(sop, a, b):
    out = []
    for n in sop:
        if not a <= n["at"] < b:
            continue
        if n["downbeat"] and out:
            out.append("|")
        out.append(n)
    last = out[-1]
    end = "final" if b == STAVES[-1][1] else ("bar" if last["ends_bar"] else None)
    return out, end


def play_data(sop, voices, a, b):
    """All four voices within [a, b), in beats from a: each fermata's chord held, then a breath before what follows."""
    eps = 1e-6
    ends = [n["at"] + n["len"] for n in sop if n["fermata"] and a < n["at"] + n["len"] <= b + eps]
    inner = [e for e in ends if e < b - eps]          # fermatas within the staff, which push what follows later
    def start(t):
        return t - a + (HOLD + BREATH) * sum(1 for e in inner if e <= t + eps)
    def stop(t):
        held = HOLD if any(abs(t - e) < eps for e in ends) else 0
        return t - a + (HOLD + BREATH) * sum(1 for e in inner if e < t - eps) + held
    events = sorted([round(start(at), 3), round(stop(at + ln) - start(at), 3), midi]
                    for v in voices for at, ln, midi in v if a <= at < b)
    lights = [round(start(n["at"]), 3) for n in sop if a <= n["at"] < b]
    return {"beat": BEAT, "events": events, "lights": lights}


def engrave(items, end, g: Glyphs, w: Words, label: str, play: dict, time_sig: bool) -> str:
    bottom = TOP + 4 * S + 0.5   # centre of the bottom line
    parts, words = [], []
    x = 0.6 * S
    parts.append(g.path(G_CLEF, x, y_of("G4", bottom)))
    x += g.bounds(G_CLEF)[2] + 1.0 * S
    for st in (8, 5):   # key signature: F sharp on the top line, C sharp in the third space
        parts.append(g.path(SHARP, x, bottom - st * S / 2))
        x += g.bounds(SHARP)[2] + 0.3 * S
    x += 0.8 * S
    if time_sig:
        parts.append(g.path(COMMON_TIME, x, bottom - 2 * S))
        x += g.bounds(COMMON_TIME)[2] + 1.6 * S
    else:
        x += 0.6 * S
    head_w = g.bounds(HEAD_BLACK)[2]
    stem_w = 0.12 * S
    sharp_w = g.bounds(SHARP)[2]

    # place the notes: by the rhythm, then further apart wherever the words need room
    placed, word_end, bars_since = [], -1e9, []
    for n in items:
        if n == "|":
            x += 0.2 * S
            placed.append(["bar", x])
            bars_since.append(len(placed) - 1)
            x += 1.7 * S
            continue
        accidental = "#" in n["pitch"] and n["pitch"][0] not in KEY
        if accidental:
            x += sharp_w + 0.3 * S
        if n["syl"]:
            left = x + head_w / 2 - w.width(n["syl"]) / 2
            if left < word_end:
                shift = word_end - left
                for k in bars_since:   # a bar line just before this note moves with it
                    placed[k][1] += shift
                x += shift
            word_end = x + head_w / 2 + w.width(n["syl"]) / 2 + WORD_GAP * S + (1.4 * S if n["hyphen"] else 0)
        bars_since = []
        placed.append(["note", x, n, accidental])
        x += ADVANCE[n["len"]] * S
    last = [p for p in placed if p[0] == "note"][-1]
    width = last[1] + head_w + {"final": 2.8 * S, "bar": 1.8 * S, None: 1.2 * S}[end]
    if last[2]["syl"]:   # room for the last word, which may reach past the last note
        width = max(width, last[1] + head_w / 2 + w.width(last[2]["syl"]) / 2 + 2)

    notes = [p for p in placed if p[0] == "note"]
    beams, i = [], 0
    while i < len(notes):
        if notes[i][2]["len"] == .5 and i + 1 < len(notes) and notes[i + 1][2]["len"] == .5:
            beams.append((i, i + 1))
            i += 2
        else:
            i += 1

    def stem_up(idxs):
        far = max((notes[j][2] for j in idxs), key=lambda n: abs(step(n["pitch"]) - 4))
        return step(far["pitch"]) < 4

    ends = {}
    for a, b in beams:
        up = stem_up([a, b])
        ya, yb = (y_of(notes[j][2]["pitch"], bottom) + (-3.5 if up else 3.5) * S for j in (a, b))
        mid = (ya + yb) / 2
        slant = max(-0.5 * S, min(0.5 * S, (yb - ya) / 2))
        ends[a], ends[b] = (up, mid - slant / 2), (up, mid + slant / 2)
    for j, (_, _, n, _) in enumerate(notes):
        if j not in ends:
            up = stem_up([j])
            ends[j] = (up, y_of(n["pitch"], bottom) + (-3.5 if up else 3.5) * S)

    lines = "".join(f'<rect x="0" y="{TOP + k * S:.2f}" width="{width:.2f}" height="1"/>' for k in range(5))
    for p in placed:
        if p[0] == "bar":
            parts.append(f'<rect x="{p[1]:.2f}" y="{TOP:.2f}" width="{0.16 * S:.2f}" height="{4 * S + 1:.2f}"/>')
    if end == "bar":
        parts.append(f'<rect x="{last[1] + head_w + 1.4 * S:.2f}" y="{TOP:.2f}" width="{0.16 * S:.2f}" height="{4 * S + 1:.2f}"/>')
    elif end == "final":
        bx = last[1] + head_w + 1.6 * S
        parts.append(f'<rect x="{bx:.2f}" y="{TOP:.2f}" width="{0.16 * S:.2f}" height="{4 * S + 1:.2f}"/>'
                     f'<rect x="{bx + 0.5 * S:.2f}" y="{TOP:.2f}" width="{0.7 * S:.2f}" height="{4 * S + 1:.2f}"/>')
    heads = []
    for j, (_, nx, n, accidental) in enumerate(notes):
        ny = y_of(n["pitch"], bottom)
        bits = []
        if accidental:
            bits.append(g.path(SHARP, nx - sharp_w - 0.3 * S, ny))
        bits.append(g.path(HEAD_HALF if n["len"] == 2 else HEAD_BLACK, nx, ny))
        up, e = ends[j]
        sx = nx + head_w - stem_w if up else nx
        y0, y1 = (e, ny - 0.17 * S) if up else (ny + 0.17 * S, e)
        bits.append(f'<rect x="{sx:.2f}" y="{min(y0, y1):.2f}" width="{stem_w:.2f}" height="{abs(y1 - y0):.2f}"/>')
        if n["fermata"]:
            top_of_music = min(TOP, e if up else ny - 0.6 * S)
            bits.append(g.path(FERMATA, nx + head_w / 2 - g.bounds(FERMATA)[2] / 2, top_of_music - 0.45 * S))
        heads.append(f'<g class="n">{"".join(bits)}</g>')
        if n["syl"]:
            words.append(f'<text x="{nx + head_w / 2:.2f}" y="{bottom + LYRIC_GAP * S:.2f}">{n["syl"]}</text>')
        nxt = next((it for it in notes[j + 1:] if it[2]["syl"]), None)
        if n["hyphen"] and nxt:
            left_end = nx + head_w / 2 + w.width(n["syl"]) / 2
            right_start = nxt[1] + head_w / 2 - w.width(nxt[2]["syl"]) / 2
            words.append(f'<text x="{(left_end + right_start) / 2:.2f}" y="{bottom + LYRIC_GAP * S:.2f}">-</text>')
    for a, b in beams:
        (up, ya), (_, yb) = ends[a], ends[b]
        xa = notes[a][1] + (head_w - stem_w if up else 0)
        xb = notes[b][1] + (head_w if up else stem_w)
        t = 0.5 * S * (1 if up else -1)
        parts.append(f'<path d="M{xa:.2f} {ya:.2f}L{xb:.2f} {yb:.2f}L{xb:.2f} {yb + t:.2f}L{xa:.2f} {ya + t:.2f}Z"/>')

    height = bottom + LYRIC_GAP * S + 4
    data = json.dumps(play, separators=(",", ":"))
    return (f'<svg class="score-notes" viewBox="0 0 {width:.1f} {height:.1f}" width="{width:.1f}" height="{height:.1f}" '
            f'role="img" aria-label="{label}" data-play=\'{data}\'>\n'
            f'  <g class="score-staff" fill="{RULE}">{lines}</g>\n'
            f'  <g fill="{INK}">{"".join(parts)}{"".join(heads)}</g>\n'
            f'  <g class="score-words" fill="{WORDS}" text-anchor="middle">{"".join(words)}</g>\n'
            f'</svg>\n')


# B-A-C-H: in German, B is B flat and H is B natural. (pitch, accidental, letter)
MOTIF = [("Bb4", FLAT, "B"), ("A4", None, "A"), ("C5", None, "C"), ("B4", NATURAL, "H")]


def engrave_motif(g: Glyphs) -> str:
    """A short staff of its own, in whole notes: each note is a <g class="n"> that site.js lights as it sounds."""
    top = 3.0 * S
    bottom = top + 4 * S + 0.5
    x = 0.4 * S
    clef = g.path(G_CLEF, x, y_of("G4", bottom))
    x += g.bounds(G_CLEF)[2] + 1.6 * S
    head_w = g.bounds(HEAD_WHOLE)[2]
    notes, letters = [], []
    for pitch, acc, letter in MOTIF:
        if acc:
            aw = g.bounds(acc)[2]
            acc_path = g.path(acc, x, y_of(pitch, bottom))
            x += aw + 0.35 * S
        else:
            acc_path = ""
        head = g.path(HEAD_WHOLE, x, y_of(pitch, bottom))
        notes.append(f'<g class="n">{acc_path}{head}</g>')
        letters.append(f'<text x="{x + head_w / 2:.2f}" y="{bottom + 3.6 * S:.2f}">{letter}</text>')
        x += head_w + 2.6 * S
    x -= 1.2 * S
    width = x + 0.16 * S + 0.5
    lines = "".join(f'<rect x="0" y="{top + i * S:.2f}" width="{width:.2f}" height="1"/>' for i in range(5))
    bar = f'<rect x="{x:.2f}" y="{top:.2f}" width="{0.16 * S:.2f}" height="{4 * S + 1:.2f}"/>'
    height = bottom + 3.6 * S + 4
    play = {"beat": 0.6, "events": [[0, 0.56, 70], [1, 0.56, 69], [2, 0.56, 72], [3, 1.5, 71]], "lights": [0, 1, 2, 3]}
    data = json.dumps(play, separators=(",", ":"))
    return (f'<svg class="motif" viewBox="0 0 {width:.1f} {height:.1f}" width="{width:.1f}" height="{height:.1f}" aria-hidden="true" data-play=\'{data}\'>\n'
            f'  <g class="motif-staff" fill="{RULE}">{lines}</g>\n'
            f'  <g fill="{INK}">{clef}{bar}{"".join(notes)}</g>\n'
            f'  <g class="motif-letters" text-anchor="middle">{"".join(letters)}</g>\n'
            f'</svg>\n')


def main():
    g, w = Glyphs(font()), Words()
    sop, voices = read_chorale()
    out = ROOT / "src" / "chorale"
    out.mkdir(exist_ok=True)
    for k, (a, b) in enumerate(STAVES, 1):
        items, end = staff_notes(sop, a, b)
        words = " ".join(n["syl"] + ("-" if n["hyphen"] else "") for n in items if n != "|" and n["syl"]).replace("- ", "")
        label = f"Bach, Ein feste Burg ist unser Gott, BWV 302: “{words}”"
        svg = engrave(items, end, g, w, label, play_data(sop, voices, a, b), time_sig=(k == 1))
        (out / f"{k}.svg").write_text(svg, encoding="utf-8")
    (ROOT / "src" / "bach.svg").write_text(engrave_motif(g), encoding="utf-8")
    print(f"wrote src/chorale/1.svg to {len(STAVES)}.svg and src/bach.svg")


if __name__ == "__main__":
    main()
