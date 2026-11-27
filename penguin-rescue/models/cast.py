# The Penguin Rescue cast as layered pop-up cut-outs, drawn like a pen-and-watercolour storybook.
# Nobody turns in 3D: each figure slides across the page like the game's standees, so depth lives
# in the stacked card and the white die-cut backing. Proportions follow the real animals.
# Run: blender -b -P models/cast.py [-- name ...]
#   -> models/cast/<name>.png preview for each character, lineup.png, cast.blend
# The game-ready models come from bake.py.
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
bpy.ops.wm.read_factory_settings(use_empty=True)
import popup as P
from popup import (card, ink, line, hatch, inked, crescent, smooth, mirror, ellipse, fluffy,
                   rotate, move, flipx, open_curve, INK)

OUT = os.path.join(HERE, "cast")
os.makedirs(OUT, exist_ok=True)
WHITE, BLUSH = '#f6efdd', '#e9a89c'

# ======================================================================================
# Penguins: a small real penguin (Adélie-like) — bottle body with the head running into it,
# white front from the throat down, eye rings, long paddle flippers, webbed pink feet.
# ======================================================================================
NAVY, NAVY_DK = '#46566b', '#3a495c'

def penguin(name, size, scarf, scarf_dk, hat=None, tuft=False, bow=None, sad=False, sx=1.0, sz=1.0):
    P.begin(name, size)
    S = lambda pts: move(pts, sx=sx, sz=sz)
    BODY = S(smooth(mirror([(0, 0.895), (0.08, 0.882), (0.135, 0.845), (0.155, 0.78), (0.152, 0.715), (0.163, 0.655),
                            (0.2, 0.56), (0.236, 0.44), (0.256, 0.31), (0.244, 0.19), (0.2, 0.1), (0.12, 0.052), (0, 0.042)])))
    FRONT = S(smooth(mirror([(0, 0.705), (0.052, 0.69), (0.1, 0.635), (0.152, 0.53), (0.183, 0.39), (0.186, 0.25),
                             (0.158, 0.135), (0.1, 0.078), (0, 0.066)])))
    FLIP_R = S(smooth([(0.185, 0.6), (0.222, 0.588), (0.268, 0.49), (0.3, 0.37), (0.306, 0.3), (0.288, 0.29),
                       (0.262, 0.34), (0.226, 0.44), (0.192, 0.53)]))
    FOOT_R = S(smooth([(0.03, 0.075), (0.13, 0.08), (0.168, 0.045), (0.175, 0.018), (0.152, 0.006), (0.132, 0.022),
                       (0.112, 0.002), (0.088, 0.018), (0.066, 0.0), (0.042, 0.02), (0.022, 0.045)], n=6))
    BEAK = S(smooth([(-0.024, 0.756), (0.024, 0.756), (0.012, 0.715), (0.0, 0.684), (-0.012, 0.715)], n=8))
    BAND = S(smooth([(-0.172, 0.672), (0.0, 0.648), (0.172, 0.672), (0.182, 0.628), (0.0, 0.6), (-0.182, 0.628)], n=8))
    KNOT = S(smooth([(0.045, 0.632), (0.1, 0.636), (0.112, 0.598), (0.05, 0.592)], n=6))
    TAIL = S(smooth([(0.06, 0.605), (0.108, 0.603), (0.128, 0.445), (0.082, 0.44)], n=8))
    sil = [BODY, FLIP_R, flipx(FLIP_R), FOOT_R, flipx(FOOT_R)]

    if hat:
        HAT_C, TILT, LIFT = (0, 0.86), -5, 0.016
        hat_pts = lambda pts: S([(x, z + LIFT) for x, z in rotate(pts, TILT, HAT_C)])
        DOME = hat_pts(smooth([(0.0, 0.99), (0.095, 0.972), (0.152, 0.925), (0.175, 0.86), (0.172, 0.818), (0.0, 0.81),
                               (-0.172, 0.818), (-0.175, 0.86), (-0.152, 0.925), (-0.095, 0.972)]))
        CUFF = hat_pts(smooth([(-0.186, 0.857), (0.0, 0.866), (0.186, 0.857), (0.19, 0.806), (0.0, 0.797), (-0.19, 0.806)], n=8))
        POM = hat_pts(ellipse(0.0, 1.012, 0.043, 0.04, n=24))
        sil += [DOME, CUFF, POM]
    if tuft:   # a little crest of swept-back feathers, like a young rockhopper's
        CREST = [S(ellipse(cx, cz, 0.017, 0.052, n=24, rot=r)) for cx, cz, r in ((-0.022, 0.925, 22), (0.012, 0.94, -4), (0.046, 0.92, -32))]
        sil += CREST
    if bow:
        BOW_C = S([(0.105, 0.87)])[0]
        LOOPS = [ellipse(BOW_C[0] + 0.036, BOW_C[1] + 0.018, 0.038, 0.024, n=28, rot=25),
                 ellipse(BOW_C[0] - 0.034, BOW_C[1] + 0.014, 0.035, 0.022, n=28, rot=-22)]
        sil += LOOPS

    P.backing(sil)
    P.easel(-0.1, 0.1, 0.06, 0.2)

    for s, sh in ((1, FOOT_R), (-1, flipx(FOOT_R))):
        inked(f"foot{s}", sh, 1, '#df9a78', w=0.0045)
        for t, x in enumerate((0.08, 0.124)):
            line(f"toe{s}{t}", S([(s * x, 0.05), (s * (x + 0.004), 0.03), (s * (x + 0.002), 0.014)]), 1, 0.0028)
    if tuft:
        for i, f in enumerate(CREST):
            inked(f"crest{i}", f, 1.5 + i * 0.1, NAVY_DK, w=0.004)

    card("body", BODY, 2, NAVY)
    hatch("body_h", crescent(BODY, -0.07, 0.035), BODY, 2, color='#232c38')
    ink("body_ink", BODY, 2, 0.0062)

    card("front", FRONT, 3, WHITE, wash=0.07)
    hatch("front_h", crescent(FRONT, -0.055, 0.05), FRONT, 3, angle=58, spacing=0.012, w=0.002, color='#8a8f99')
    ink("front_ink", FRONT, 3, 0.005)

    for s in (-1, 1):
        ex, ez = S([(s * 0.07, 0.772)])[0]
        look = -0.012 if sad else -0.004
        card(f"ring{s}", ellipse(ex, ez, 0.027, 0.03, n=28), 4, WHITE, wash=0)
        ink(f"ring{s}_ink", ellipse(ex, ez, 0.027, 0.03, n=28), 4, 0.003)
        card(f"eye{s}", ellipse(ex + s * 0.002, ez + look, 0.0165, 0.019, n=20), 4.4, INK, wash=0)
        card(f"glint{s}", ellipse(ex + s * 0.002 + 0.006, ez + look + 0.007, 0.0055, 0.006, n=12), 4.7, '#ffffff', wash=0)
        cx, cz = S([(s * 0.112, 0.728)])[0]
        card(f"cheek{s}", ellipse(cx, cz, 0.022, 0.014, n=20), 4, BLUSH, wash=0.04)
        if sad:   # worried brows that lift toward the middle
            line(f"brow{s}", [(ex + s * 0.03, ez + 0.035), (ex + s * 0.005, ez + 0.043), (ex - s * 0.02, ez + 0.052)], 4.6, 0.0042)
    if sad:   # one tear on the cheek
        tx, tz = S([(-0.1, 0.735)])[0]
        inked("tear", smooth([(tx, tz + 0.02), (tx + 0.01, tz - 0.002), (tx, tz - 0.012), (tx - 0.01, tz - 0.002)], n=8), 4.8, '#a9cbe6', w=0.0025, wash=0)
    inked("beak", BEAK, 4.6, '#d9893f', w=0.0038)
    line("beak_mid", S([(0.0, 0.752), (0.0, 0.72), (0.0, 0.69)]), 4.6, 0.0022)

    for s, sh in ((1, FLIP_R), (-1, flipx(FLIP_R))):
        card(f"flipper{s}", sh, 5, NAVY_DK)
        if s == 1:
            hatch("flip_h", crescent(sh, -0.03, 0.02), sh, 5, spacing=0.0095, color='#1d2530')
        ink(f"flipper{s}_ink", sh, 5, 0.0052)

    card("band", BAND, 6, scarf)
    for i, x in enumerate((-0.15, -0.105, -0.06, -0.015, 0.03, 0.075, 0.12, 0.16)):
        z = 0.636 + 0.85 * x * x
        line(f"rib{i}", S([(x, z + 0.024), (x + 0.003, z), (x, z - 0.024)]), 6, 0.0026, color=scarf_dk)
    ink("band_ink", BAND, 6, 0.0048)
    card("tail", TAIL, 7, scarf)
    for i, z in enumerate((0.565, 0.53, 0.495)):
        line(f"stripe{i}", S([(0.066 + (0.6 - z) * 0.13, z), (0.112 + (0.6 - z) * 0.13, z - 0.002)]), 7, 0.0034, color=scarf_dk)
    for i in range(4):
        x = 0.086 + i * 0.013
        line(f"fringe{i}", S([(x, 0.447), (x + 0.002, 0.43), (x - 0.001, 0.414)]), 7, 0.0045, color=scarf)
    ink("tail_ink", TAIL, 7, 0.0046)
    inked("knot", KNOT, 7.4, scarf, w=0.0046)

    if hat:
        card("dome", DOME, 8, hat[0])
        for i, x in enumerate((-0.12, -0.06, 0.0, 0.06, 0.12)):
            ink(f"hatrib{i}", hat_pts(open_curve([(x * 1.08, 0.868), (x, 0.92), (x * 0.7, 0.968)])), 8, 0.0026, closed=False, color=hat[1])
        hatch("dome_h", crescent(DOME, -0.045, 0.03), DOME, 8, spacing=0.0095, w=0.0022, color='#3e5677')
        ink("dome_ink", DOME, 8, 0.0055)
        inked("cuff", CUFF, 9, WHITE, wash=0.06)
        inked("pom", POM, 9, WHITE, w=0.0045, wash=0.06)
    if bow:
        for i, lp in enumerate(LOOPS):
            inked(f"bow{i}", lp, 8, bow[0], w=0.004)
            line(f"bowfold{i}", [BOW_C, ((BOW_C[0] + lp[len(lp) // 3][0]) / 2, (BOW_C[1] + lp[len(lp) // 3][1]) / 2)], 8, 0.0022, color=bow[1])
        inked("bowknot", ellipse(BOW_C[0], BOW_C[1], 0.016, 0.014, n=16), 8.5, bow[0], w=0.0035)

# ======================================================================================
# The explorer: a child in a red parka with a fur-ruffed hood, about four heads tall.
# ======================================================================================
def explorer():
    P.begin("hero", 1.2)
    PARKA, PARKA_DK, FUR, SKIN = '#c4553a', '#8e3a27', '#efe2c6', '#f0c7a0'
    HOOD = ellipse(0, 0.8, 0.158, 0.152, n=48)
    RUFF = fluffy(0, 0.795, 0.118, tufts=18, depth=0.08)
    FACE = ellipse(0, 0.792, 0.083, 0.088, n=40)
    COAT = smooth(mirror([(0, 0.685), (0.1, 0.678), (0.148, 0.64), (0.175, 0.53), (0.2, 0.39), (0.226, 0.25), (0.12, 0.236), (0, 0.234)]))
    HEM = smooth([(-0.238, 0.262), (0.0, 0.252), (0.238, 0.262), (0.244, 0.222), (0.0, 0.212), (-0.244, 0.222)], n=8)
    SLEEVE_R = smooth([(0.13, 0.65), (0.19, 0.62), (0.24, 0.5), (0.27, 0.37), (0.232, 0.35), (0.2, 0.46), (0.155, 0.55)])
    MITT_R = smooth([(0.222, 0.36), (0.275, 0.36), (0.29, 0.32), (0.272, 0.282), (0.235, 0.285), (0.218, 0.32)], n=8)
    THUMB_R = ellipse(0.212, 0.33, 0.016, 0.022, n=16, rot=-20)
    LEG_R = smooth([(0.03, 0.24), (0.1, 0.24), (0.098, 0.07), (0.035, 0.07)], n=6)
    BOOT_R = smooth([(0.028, 0.095), (0.104, 0.095), (0.128, 0.04), (0.13, 0.008), (0.02, 0.006), (0.022, 0.05)], n=8)
    P.backing([HOOD, COAT, HEM, SLEEVE_R, flipx(SLEEVE_R), MITT_R, flipx(MITT_R), LEG_R, flipx(LEG_R), BOOT_R, flipx(BOOT_R)])
    P.easel(-0.1, 0.1, 0.1, 0.2)
    for s, leg, boot in ((1, LEG_R, BOOT_R), (-1, flipx(LEG_R), flipx(BOOT_R))):
        inked(f"leg{s}", leg, 1, '#3a4660')
        line(f"crease{s}", [(s * 0.062, 0.2), (s * 0.068, 0.15), (s * 0.064, 0.1)], 1, 0.0022)
        inked(f"boot{s}", boot, 2, '#5a3a28')
        line(f"lace{s}", [(s * 0.04, 0.075), (s * 0.075, 0.08), (s * 0.1, 0.07)], 2, 0.0022, color='#d8c39a')
    card("coat", COAT, 3, PARKA)
    hatch("coat_h", crescent(COAT, -0.06, 0.03), COAT, 3, color=PARKA_DK)
    ink("coat_ink", COAT, 3, 0.0058)
    line("zip", [(0.0, 0.66), (0.004, 0.45), (0.0, 0.25)], 3, 0.0028)
    for i, z in enumerate((0.6, 0.52, 0.44, 0.36)):
        inked(f"toggle{i}", ellipse(0.024, z, 0.013, 0.006, n=12), 3.4, FUR, w=0.002, wash=0)
    inked("hem", HEM, 4, FUR, wash=0.05)
    for i in range(9):
        x = -0.2 + i * 0.05
        line(f"hemfur{i}", [(x, 0.25), (x + 0.006, 0.237), (x + 0.002, 0.222)], 4, 0.0018, color='#b7a888')
    inked("hood", HOOD, 5, PARKA)
    hatch("hood_h", crescent(HOOD, -0.04, 0.03), HOOD, 5, color=PARKA_DK)
    card("ruff", RUFF, 6, FUR, wash=0.05)
    ink("ruff_ink", RUFF, 6, 0.004)
    inked("face", FACE, 7, SKIN, wash=0.05)
    inked("fringe", smooth([(-0.07, 0.83), (-0.03, 0.87), (0.03, 0.872), (0.075, 0.83), (0.04, 0.845), (0.01, 0.825), (-0.02, 0.845)], n=8), 7.3, '#6b4630', w=0.003)
    for s in (-1, 1):
        card(f"eye{s}", ellipse(s * 0.031, 0.79, 0.0095, 0.012, n=16), 7.5, INK, wash=0)
        card(f"glint{s}", ellipse(s * 0.031 + 0.004, 0.794, 0.003, 0.0035, n=10), 7.7, '#ffffff', wash=0)
        card(f"cheek{s}", ellipse(s * 0.05, 0.765, 0.018, 0.011, n=16), 7.4, BLUSH, wash=0)
    line("smile", [(-0.015, 0.757), (0.0, 0.75), (0.015, 0.757)], 7.5, 0.0028)
    for s, sl, mt, th in ((1, SLEEVE_R, MITT_R, THUMB_R), (-1, flipx(SLEEVE_R), flipx(MITT_R), flipx(THUMB_R))):
        card(f"sleeve{s}", sl, 6.5, PARKA)
        if s == 1:
            hatch("sleeve_h", crescent(sl, -0.03, 0.02), sl, 6.5, color=PARKA_DK)
        ink(f"sleeve{s}_ink", sl, 6.5, 0.005)
        inked(f"thumb{s}", th, 6.8, '#7a4a2e', w=0.0035)
        inked(f"mitt{s}", mt, 7, '#7a4a2e', w=0.0045)

# ======================================================================================
# The puffin: an Atlantic puffin, stocky and upright, turned to show the famous beak in
# profile. Black cap and collar, pale face, big striped beak, knitting a yellow scarf.
# ======================================================================================
def puffin():
    P.begin("puffin", 0.85)
    BLACK, BLACK_DK = '#2b2f37', '#15181d'
    BODY = smooth([(0.02, 0.935), (0.12, 0.905), (0.17, 0.83), (0.16, 0.72), (0.2, 0.6), (0.225, 0.42), (0.195, 0.22),
                   (0.12, 0.09), (0.0, 0.05), (-0.13, 0.08), (-0.205, 0.2), (-0.225, 0.4), (-0.195, 0.6), (-0.14, 0.75),
                   (-0.115, 0.85), (-0.06, 0.915)])
    BELLY = smooth([(0.1, 0.655), (0.18, 0.55), (0.2, 0.4), (0.17, 0.22), (0.1, 0.1), (-0.02, 0.075), (-0.1, 0.15),
                    (-0.13, 0.32), (-0.1, 0.5), (-0.02, 0.63)])
    FACE = smooth([(-0.065, 0.86), (0.04, 0.885), (0.14, 0.845), (0.158, 0.76), (0.12, 0.695), (0.0, 0.69), (-0.08, 0.75)])
    BEAK = smooth([(0.135, 0.862), (0.205, 0.856), (0.29, 0.805), (0.335, 0.765), (0.285, 0.735), (0.2, 0.708), (0.135, 0.698)])
    PLATE = smooth([(0.135, 0.862), (0.172, 0.858), (0.17, 0.704), (0.135, 0.698)], n=6)
    WING = smooth([(-0.17, 0.62), (-0.09, 0.57), (-0.065, 0.38), (-0.11, 0.2), (-0.19, 0.27), (-0.22, 0.45)])
    FOOT_R = smooth([(0.02, 0.07), (0.11, 0.075), (0.15, 0.03), (0.16, 0.0), (0.12, 0.012), (0.095, -0.002), (0.07, 0.012), (0.04, 0.0), (0.015, 0.03)], n=6)
    FOOT_L = move(flipx(FOOT_R), dx=-0.02)
    KNIT = smooth([(0.0, 0.45), (0.12, 0.47), (0.115, 0.3), (0.005, 0.29)], n=6)
    P.backing([BODY, BEAK, FOOT_R, FOOT_L])
    P.easel(-0.09, 0.09, 0.08, 0.2)
    for nm, sh in (("footR", FOOT_R), ("footL", FOOT_L)):
        inked(nm, sh, 1, '#e8823a', w=0.0042)
    card("body", BODY, 2, BLACK)
    hatch("body_h", crescent(BODY, -0.06, 0.035), BODY, 2, color=BLACK_DK)
    ink("body_ink", BODY, 2, 0.006)
    card("belly", BELLY, 3, WHITE, wash=0.07)
    hatch("belly_h", crescent(BELLY, -0.05, 0.05), BELLY, 3, angle=58, spacing=0.012, w=0.002, color='#8a8f99')
    ink("belly_ink", BELLY, 3, 0.0048)
    inked("face", FACE, 4, '#e4e1da', w=0.0045, wash=0.06)
    # eye with its little red ring and the grey horn marks above and below
    inked("eyering", ellipse(0.075, 0.8, 0.017, 0.016, n=20), 4.4, '#d4553a', w=0.002, wash=0)
    card("eye", ellipse(0.076, 0.8, 0.0105, 0.011, n=16), 4.6, INK, wash=0)
    card("glint", ellipse(0.08, 0.804, 0.0035, 0.0035, n=10), 4.8, '#ffffff', wash=0)
    line("hornup", [(0.07, 0.82), (0.064, 0.838), (0.055, 0.852)], 4.6, 0.0035, color='#6c6f78')
    line("horndown", [(0.084, 0.78), (0.08, 0.765), (0.072, 0.75)], 4.6, 0.003, color='#6c6f78')
    card("cheek", ellipse(0.04, 0.735, 0.022, 0.013, n=16), 4.4, BLUSH, wash=0)
    card("wing", WING, 5, BLACK)
    hatch("wing_h", crescent(WING, -0.03, 0.02), WING, 5, spacing=0.0095, color=BLACK_DK)
    ink("wing_ink", WING, 5, 0.005)
    # knitting: a half-made scarf on two needles
    card("knit", KNIT, 6, '#d6a646')
    for i in range(5):
        z = 0.44 - i * 0.033
        line(f"knitrow{i}", [(0.01, z), (0.06, z + 0.004), (0.11, z + 0.006)], 6, 0.0022, color='#a8802f')
    ink("knit_ink", KNIT, 6, 0.0042)
    for i, (a, b) in enumerate((((-0.06, 0.43), (0.18, 0.5)), ((-0.04, 0.5), (0.17, 0.43)))):
        line(f"needle{i}", [a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.004), b], 6.5, 0.0075, color='#b08850')
        inked(f"needletip{i}", ellipse(a[0], a[1], 0.009, 0.009, n=12), 6.6, '#c94c3c', w=0.002, wash=0)
    line("yarnstrand", [(0.01, 0.3), (-0.03, 0.22), (-0.01, 0.14), (0.04, 0.1)], 6.5, 0.0028, color='#d6a646')
    # the beak: grey-blue base plate, yellow ridge, red-orange blade with grooves, rosette at the gape
    inked("beak", BEAK, 7, '#d65a32', w=0.0045)
    inked("plate", PLATE, 7.3, '#7d8a9c', w=0.003, wash=0.05)
    line("ridge", [(0.176, 0.855), (0.18, 0.78), (0.176, 0.708)], 7.4, 0.006, color='#e8bd45')
    for i, x in enumerate((0.22, 0.255)):
        line(f"groove{i}", [(x, 0.845 - (x - 0.2) * 0.6), (x + 0.008, 0.78), (x, 0.725)], 7.4, 0.0022, color='#a8452a')
    line("gape", [(0.15, 0.758), (0.24, 0.762), (0.33, 0.766)], 7.4, 0.0032)
    inked("rosette", ellipse(0.143, 0.753, 0.012, 0.009, n=12), 7.5, '#f0b84a', w=0.002, wash=0)

# ======================================================================================
# Bobble: a harbour seal pup lying on the ice, head raised — plump, spotted, big dark eyes.
# ======================================================================================
def seal():
    P.begin("bobble", 0.75)
    GREY, GREY_DK, PALE = '#9aa6b2', '#5d6874', '#d7dde3'
    BODY = smooth([(-0.78, 0.14), (-0.6, 0.24), (-0.3, 0.34), (0.0, 0.42), (0.2, 0.5), (0.33, 0.62), (0.42, 0.7),
                   (0.55, 0.725), (0.65, 0.67), (0.71, 0.59), (0.67, 0.53), (0.55, 0.5), (0.45, 0.44), (0.38, 0.3),
                   (0.3, 0.12), (0.1, 0.035), (-0.3, 0.03), (-0.62, 0.06)])
    BELLY = smooth([(0.4, 0.4), (0.32, 0.16), (0.1, 0.06), (-0.3, 0.055), (-0.6, 0.08), (-0.35, 0.11), (0.05, 0.12), (0.28, 0.22)])
    HIND = smooth([(-0.72, 0.16), (-0.88, 0.3), (-0.98, 0.33), (-0.94, 0.2), (-1.0, 0.1), (-0.9, 0.05), (-0.74, 0.1)])
    FORE = smooth([(0.12, 0.17), (0.24, 0.15), (0.3, 0.06), (0.26, 0.02), (0.14, 0.06)])
    MUZZLE = ellipse(0.665, 0.565, 0.055, 0.04, n=28, rot=-10)
    P.backing([BODY, HIND, FORE])
    P.easel(-0.3, 0.2, 0.05, 0.25)
    inked("hind", HIND, 1, GREY_DK, w=0.0045)
    for i in range(3):
        line(f"hindtoe{i}", [(-0.78, 0.17), (-0.88 - i * 0.02, 0.22 - i * 0.05), (-0.95 - i * 0.01, 0.28 - i * 0.09)], 1, 0.0022, color='#3d4650')
    card("body", BODY, 2, GREY)
    hatch("body_h", crescent(BODY, -0.05, 0.06), BODY, 2, angle=70, color=GREY_DK)
    for i, (x, z, r) in enumerate(((-0.45, 0.22, 0.025), (-0.3, 0.27, 0.018), (-0.15, 0.31, 0.028), (0.0, 0.36, 0.02),
                                   (0.12, 0.4, 0.024), (0.22, 0.5, 0.017), (-0.6, 0.17, 0.016), (-0.05, 0.25, 0.015),
                                   (0.15, 0.3, 0.02), (0.35, 0.58, 0.016), (0.45, 0.65, 0.014))):
        card(f"spot{i}", ellipse(x, z, r * 1.3, r, n=14, rot=15 * (i % 3 - 1)), 2.3, '#6e7a87', wash=0.1)
    ink("body_ink", BODY, 2, 0.006)
    card("belly", BELLY, 3, PALE, wash=0.06)
    ink("belly_ink", BELLY, 3, 0.0035)
    inked("muzzle", MUZZLE, 3.5, '#c9d1d9', w=0.0035, wash=0.04)
    card("eye", ellipse(0.545, 0.635, 0.032, 0.036, n=24), 4, INK, wash=0)
    card("glint", ellipse(0.556, 0.65, 0.011, 0.012, n=12), 4.3, '#ffffff', wash=0)
    card("glint2", ellipse(0.535, 0.618, 0.005, 0.005, n=10), 4.3, '#ffffff', wash=0)
    inked("nose", smooth([(0.69, 0.6), (0.715, 0.598), (0.72, 0.58), (0.7, 0.572), (0.685, 0.582)], n=6), 4, '#2c3138', w=0.002)
    line("mouth", [(0.7, 0.545), (0.68, 0.535), (0.655, 0.54)], 4, 0.0025)
    for i in range(3):   # whiskers, fine and long
        line(f"whisk{i}", [(0.66, 0.565 - i * 0.012), (0.74, 0.575 - i * 0.025), (0.8, 0.58 - i * 0.04)], 4, 0.0018)
        card(f"wdot{i}", ellipse(0.65 + i * 0.012, 0.567 - i * 0.008, 0.003, 0.003, n=8), 3.8, '#6e7a87', wash=0)
    card("cheek", ellipse(0.52, 0.575, 0.026, 0.016, n=16), 3.8, BLUSH, wash=0)
    inked("fore", FORE, 4.5, GREY_DK, w=0.0045)
    for i in range(3):
        line(f"claw{i}", [(0.25 + i * 0.015, 0.06 + i * 0.012), (0.28 + i * 0.012, 0.04 + i * 0.012)], 4.6, 0.0025)

# ======================================================================================
# Grimfin: an orca, side on, facing right — robust torpedo body, tall dorsal fin, white eye
# patch, chin and flank, grey saddle. Tricorn hat with a cockade, brass spyglass at his eye.
# ======================================================================================
def orca():
    P.begin("grimfin", 1.6)
    BLACK, BLACK_DK, CREAM = '#2e333c', '#171a20', '#f1ece0'
    BODY = smooth([(1.0, 0.4), (0.95, 0.53), (0.8, 0.63), (0.5, 0.7), (0.1, 0.7), (-0.3, 0.6), (-0.6, 0.46), (-0.85, 0.35),
                   (-0.95, 0.33), (-0.95, 0.28), (-0.8, 0.25), (-0.5, 0.2), (-0.1, 0.13), (0.4, 0.12), (0.75, 0.18), (0.95, 0.28)])
    DORSAL = smooth([(-0.05, 0.68), (0.08, 0.69), (0.03, 0.9), (-0.07, 1.14), (-0.12, 1.12), (-0.16, 0.9), (-0.26, 0.66)])
    FLUKES = smooth([(-0.88, 0.31), (-1.02, 0.46), (-1.16, 0.5), (-1.12, 0.38), (-1.03, 0.305), (-1.12, 0.21), (-1.17, 0.1), (-1.02, 0.14)])
    PEC = smooth([(0.42, 0.24), (0.56, 0.22), (0.53, 0.1), (0.43, 0.0), (0.35, 0.02), (0.36, 0.14)])
    CHIN = smooth([(0.98, 0.31), (0.88, 0.21), (0.6, 0.145), (0.3, 0.13), (0.15, 0.142), (0.35, 0.172), (0.65, 0.215), (0.88, 0.28)])
    FLANK = smooth([(-0.05, 0.162), (-0.2, 0.2), (-0.38, 0.3), (-0.5, 0.345), (-0.44, 0.27), (-0.3, 0.19), (-0.12, 0.148)])
    PATCH = ellipse(0.6, 0.52, 0.09, 0.034, n=32, rot=-8)
    SADDLE = smooth([(-0.12, 0.665), (-0.3, 0.6), (-0.46, 0.51), (-0.4, 0.49), (-0.24, 0.55)])
    HAT = smooth([(0.49, 0.655), (0.465, 0.77), (0.56, 0.735), (0.655, 0.83), (0.755, 0.745), (0.855, 0.785), (0.825, 0.66), (0.66, 0.69)], n=6)
    P.backing([BODY, DORSAL, FLUKES, PEC, HAT, smooth([(0.82, 0.43), (1.22, 0.5), (1.22, 0.56), (0.82, 0.5)], n=4)])
    P.easel(-0.3, 0.3, 0.12, 0.3)
    inked("flukes", FLUKES, 1, BLACK, w=0.0055)
    card("dorsal", DORSAL, 1.5, BLACK)
    hatch("dorsal_h", crescent(DORSAL, -0.04, 0.02), DORSAL, 1.5, spacing=0.012, color=BLACK_DK)
    ink("dorsal_ink", DORSAL, 1.5, 0.0055)
    card("body", BODY, 2, BLACK)
    hatch("body_h", crescent(BODY, -0.04, 0.07), BODY, 2, angle=70, spacing=0.012, color=BLACK_DK)
    ink("body_ink", BODY, 2, 0.0065)
    card("saddle", SADDLE, 2.5, '#7b828c', wash=0.15)
    for nm, sh in (("chin", CHIN), ("flank", FLANK), ("patch", PATCH)):
        inked(nm, sh, 3, CREAM, w=0.004, wash=0.05)
    # gruff but not frightening: a heavy brow and a sideways smirk
    card("eye", ellipse(0.785, 0.462, 0.014, 0.016, n=16), 4, INK, wash=0)
    card("glint", ellipse(0.79, 0.468, 0.0045, 0.005, n=10), 4.3, '#ffffff', wash=0)
    line("brow", [(0.745, 0.51), (0.785, 0.5), (0.83, 0.484)], 4, 0.0075, color='#cfc9bd')
    line("mouth", [(0.975, 0.33), (0.9, 0.312), (0.83, 0.315), (0.8, 0.333)], 4, 0.0045, color='#cfc9bd')
    card("cheek", ellipse(0.84, 0.4, 0.03, 0.016, n=16), 3.8, '#c98880', wash=0)
    card("pec", PEC, 4.5, BLACK)
    hatch("pec_h", crescent(PEC, -0.03, 0.03), PEC, 4.5, spacing=0.011, color=BLACK_DK)
    ink("pec_ink", PEC, 4.5, 0.005)
    # tricorn with gold braid and a skull-and-bones cockade
    card("hat", HAT, 5, '#2a2a33')
    hatch("hat_h", crescent(HAT, -0.03, 0.02), HAT, 5, spacing=0.011, color='#121217')
    ink("hat_braid", HAT, 5, 0.009, color='#c9a046')
    ink("hat_ink", HAT, 5.1, 0.0035)
    inked("cockade", ellipse(0.66, 0.74, 0.028, 0.026, n=20), 5.5, CREAM, w=0.003, wash=0)
    for s in (-1, 1):
        line(f"bone{s}", [(0.66 - 0.024 * s, 0.712), (0.66, 0.74), (0.66 + 0.024 * s, 0.768)], 5.7, 0.004, color=CREAM)
    # brass spyglass held to his eye
    TUBE = [smooth([(0.81 + a, 0.462 + a * 0.12 - r), (0.81 + b, 0.462 + b * 0.12 - r2), (0.81 + b, 0.462 + b * 0.12 + r2), (0.81 + a, 0.462 + a * 0.12 + r)], n=4)
            for a, b, r, r2 in ((0.0, 0.14, 0.016, 0.016), (0.14, 0.27, 0.02, 0.02), (0.27, 0.4, 0.026, 0.026))]
    for i, t in enumerate(TUBE):
        inked(f"tube{i}", t, 6 + i * 0.2, '#c99a3c', w=0.0035)
        hatch(f"tube_h{i}", lambda p, i=i: p[1] < 0.462 + (p[0] - 0.81) * 0.12 - 0.006, t, 6 + i * 0.2, angle=20, spacing=0.008, w=0.0018, color='#8a6424')
    for i, a in enumerate((0.14, 0.27)):
        line(f"band{i}", [(0.81 + a, 0.462 + a * 0.12 - 0.026), (0.81 + a, 0.462 + a * 0.12 + 0.026)], 6.7, 0.006, color='#9a7228')
    inked("lens", ellipse(1.21, 0.51, 0.008, 0.026, n=16, rot=7), 6.8, '#9fcbe8', w=0.003, wash=0)

# ======================================================================================
# The walrus: a big bull sitting up — massive pear body, small head, broad whiskered muzzle,
# long tusks, skin folds. A green knitted cap; with or without his lost spectacles.
# ======================================================================================
def walrus(specs):
    P.begin("walrusSpecs" if specs else "walrus", 1.55)
    BROWN, BROWN_DK, PAD = '#a8774f', '#7b5234', '#d8b38c'
    BODY = smooth(mirror([(0, 0.9), (0.09, 0.89), (0.15, 0.85), (0.19, 0.76), (0.25, 0.62), (0.33, 0.46), (0.4, 0.3),
                          (0.43, 0.15), (0.41, 0.05), (0.3, 0.005), (0, 0.0)]))
    FLIP_R = smooth([(0.24, 0.22), (0.33, 0.14), (0.45, 0.05), (0.51, 0.005), (0.3, 0.0), (0.21, 0.08)])
    TUSK_R = smooth([(0.035, 0.64), (0.09, 0.64), (0.088, 0.5), (0.075, 0.37), (0.06, 0.46)], n=8)
    CAP = smooth([(0.0, 0.975), (0.08, 0.965), (0.13, 0.915), (0.152, 0.85), (0.0, 0.845), (-0.152, 0.85), (-0.13, 0.915), (-0.08, 0.965)])
    BAND = smooth([(-0.158, 0.872), (0.0, 0.878), (0.158, 0.872), (0.16, 0.838), (0.0, 0.832), (-0.16, 0.838)], n=8)
    BOBBLE = fluffy(0.0, 0.995, 0.03, tufts=10, depth=0.12)
    P.backing([BODY, FLIP_R, flipx(FLIP_R), CAP, BOBBLE])
    P.easel(-0.15, 0.15, 0.06, 0.25)
    card("body", BODY, 2, BROWN)
    hatch("body_h", crescent(BODY, -0.07, 0.04), BODY, 2, color=BROWN_DK)
    for i, (r, a0, a1) in enumerate(((0.3, 55, 125), (0.34, 60, 120), (0.42, 65, 115), (0.5, 70, 110))):   # skin folds
        line(f"fold{i}", [(math.cos(math.radians(a)) * r, 0.25 + math.sin(math.radians(a)) * r * 0.7) for a in (a0, (a0 + a1) / 2, a1)], 2.2, 0.0032, color='#6a4630')
    ink("body_ink", BODY, 2, 0.0065)
    for s, sh in ((1, TUSK_R), (-1, flipx(TUSK_R))):
        inked(f"tusk{s}", sh, 3, '#f3ead6', w=0.0038, wash=0.04)
        line(f"tuskline{s}", [(s * 0.07, 0.6), (s * 0.072, 0.5), (s * 0.068, 0.42)], 3, 0.0018, color='#c9bd9f')
    for s in (-1, 1):
        inked(f"pad{s}", ellipse(s * 0.068, 0.665, 0.082, 0.064, n=32), 4 + (s + 1) * 0.05, PAD, w=0.0045, wash=0.06)
        for j in range(9):   # whisker pores and stiff bristles
            x, z = s * (0.03 + (j % 3) * 0.035), 0.69 - (j // 3) * 0.025
            card(f"pore{s}{j}", ellipse(x, z, 0.0035, 0.0035, n=8), 4.3, '#8a6446', wash=0)
        for j in range(4):
            x = s * (0.04 + j * 0.03)
            line(f"bristle{s}{j}", [(x, 0.615), (x + s * 0.004, 0.595), (x + s * 0.01, 0.578)], 4.3, 0.0022, color='#efe3c8')
    for s in (-1, 1):
        line(f"nostril{s}", [(s * 0.018, 0.74), (s * 0.03, 0.735), (s * 0.04, 0.742)], 4.4, 0.004)
    for s in (-1, 1):
        ex = s * 0.105
        if specs:
            card(f"glass{s}", ellipse(ex, 0.775, 0.042, 0.042, n=28), 4.2, '#d9e8f2', wash=0)
            card(f"eye{s}", ellipse(ex, 0.772, 0.014, 0.016, n=16), 4.4, INK, wash=0)
            card(f"glint{s}", ellipse(ex + 0.005, 0.778, 0.0045, 0.005, n=10), 4.6, '#ffffff', wash=0)
            ink(f"rim{s}", ellipse(ex, 0.775, 0.044, 0.044, n=32), 4.7, 0.007, color='#3a302a')
            line(f"shine{s}", [(ex - 0.026, 0.79), (ex - 0.018, 0.805), (ex - 0.005, 0.812)], 4.8, 0.003, color='#ffffff')
        else:   # squinting hard, trying to see
            line(f"squint{s}", [(ex - 0.022, 0.77), (ex, 0.782), (ex + 0.022, 0.77)], 4.4, 0.0048)
        card(f"cheek{s}", ellipse(s * 0.165, 0.72, 0.026, 0.015, n=16), 3.9, BLUSH, wash=0)
    if specs:
        line("bridge", [(-0.062, 0.782), (0.0, 0.797), (0.062, 0.782)], 4.7, 0.006, color='#3a302a')
    for s, sh in ((1, FLIP_R), (-1, flipx(FLIP_R))):
        card(f"flipper{s}", sh, 5, BROWN_DK)
        for j in range(3):
            line(f"digit{s}{j}", [(s * (0.32 + j * 0.04), 0.1 - j * 0.02), (s * (0.36 + j * 0.045), 0.04 - j * 0.01)], 5, 0.002, color='#4e3322')
        ink(f"flipper{s}_ink", sh, 5, 0.005)
    card("cap", CAP, 6, '#5e957a')
    for i, x in enumerate((-0.09, -0.045, 0.0, 0.045, 0.09)):
        line(f"caprib{i}", [(x * 1.1, 0.86), (x, 0.915), (x * 0.6, 0.96)], 6, 0.0024, color='#46735d')
    ink("cap_ink", CAP, 6, 0.0048)
    inked("capband", BAND, 6.5, '#e6cd85', w=0.0042)
    card("bobble", BOBBLE, 7, '#e6cd85', wash=0.05)
    ink("bobble_ink", BOBBLE, 7, 0.0035)

# ======================================================================================
# Arctic foxes, sitting: compact body, short muzzle, small rounded ears, a thick tail curled
# round the paws. White winter coat shaded blue-grey. Mama wears a lilac shawl; kits are
# smaller and rounder with bigger heads and short tails.
# ======================================================================================
def fox(kit):
    P.begin("kit" if kit else "fox", 0.58 if kit else 0.95)
    FUR, SHADE, PINK = '#f5f6f7', '#9fb0c6', '#e9c3c3'
    hs, hd = (1.22, -0.12) if kit else (1.0, 0.0)   # kits: bigger head, set lower
    H = lambda pts: move(pts, dz=hd, sx=hs, sz=hs, c=(0, 0.8))
    if kit:
        BODY = smooth(mirror([(0, 0.6), (0.11, 0.59), (0.16, 0.5), (0.2, 0.34), (0.22, 0.18), (0.19, 0.05), (0.11, 0.01), (0, 0.01)]))
        TAIL = smooth([(0.17, 0.24), (0.27, 0.22), (0.3, 0.12), (0.24, 0.03), (0.08, 0.0), (-0.1, 0.01), (-0.14, 0.05),
                       (-0.06, 0.06), (0.12, 0.07), (0.2, 0.12)])
    else:
        BODY = smooth(mirror([(0, 0.72), (0.13, 0.705), (0.19, 0.62), (0.22, 0.48), (0.27, 0.3), (0.28, 0.15), (0.24, 0.05), (0.14, 0.01), (0, 0.01)]))
        TAIL = smooth([(0.22, 0.32), (0.33, 0.3), (0.38, 0.18), (0.32, 0.05), (0.12, 0.0), (-0.12, 0.01), (-0.22, 0.05),
                       (-0.18, 0.09), (0.02, 0.07), (0.2, 0.1), (0.25, 0.2)])
    HEAD = H(smooth(mirror([(0, 0.94), (0.075, 0.935), (0.135, 0.905), (0.172, 0.85), (0.19, 0.79), (0.178, 0.745),
                            (0.13, 0.7), (0.06, 0.672), (0, 0.665)])))
    EAR_R = H(smooth([(0.05, 0.915), (0.075, 0.985), (0.11, 1.005), (0.14, 0.975), (0.155, 0.9)]))
    INNER_R = H(smooth([(0.075, 0.93), (0.09, 0.975), (0.112, 0.99), (0.13, 0.965), (0.135, 0.92)], n=8))
    pz = 0.03 if not kit else 0.025
    PAW_R = ellipse(0.075, pz, 0.05, 0.028, n=20) if not kit else ellipse(0.06, pz, 0.042, 0.025, n=20)
    P.backing([BODY, HEAD, EAR_R, flipx(EAR_R), TAIL])
    P.easel(-0.1, 0.1, 0.06, 0.2)
    card("body", BODY, 2, FUR, wash=0.05)
    hatch("body_h", crescent(BODY, -0.06, 0.04), BODY, 2, color=SHADE)
    ink("body_ink", BODY, 2, 0.0055)
    legx = 0.06 if kit else 0.075
    for s in (-1, 1):
        top = 0.36 if not kit else 0.28
        line(f"leg{s}", [(s * (legx - 0.03), top), (s * (legx - 0.026), top * 0.5), (s * (legx - 0.032), 0.05)], 2.2, 0.0032)
        hx = 0.21 if not kit else 0.16   # the haunch of the folded hind leg
        line(f"haunch{s}", [(s * hx, top), (s * (hx - 0.04), top * 0.6), (s * (hx - 0.035), top * 0.25), (s * (hx - 0.005), 0.04)], 2.2, 0.0034)
        sh = PAW_R if s == 1 else flipx(PAW_R)
        inked(f"paw{s}", sh, 2.5, FUR, w=0.004, wash=0.04)
        for j in (-1, 1):
            line(f"toe{s}{j}", [(s * legx + j * 0.014, pz + 0.02), (s * legx + j * 0.012, pz - 0.012)], 2.6, 0.002)
    for i in range(6):   # chest fluff
        x = -0.06 + i * 0.024
        z0 = (0.56 if not kit else 0.47) - abs(x) * 0.6
        line(f"chest{i}", [(x, z0), (x + 0.006, z0 - 0.03), (x, z0 - 0.055)], 2.3, 0.0018, color=SHADE)
    card("tail", TAIL, 3, FUR, wash=0.05)
    hatch("tail_h", crescent(TAIL, -0.04, 0.05), TAIL, 3, angle=40, color=SHADE)
    ink("tail_ink", TAIL, 3, 0.005)
    if not kit:   # lilac shawl over the shoulders, knotted at the chest, with a fringe
        SHAWL = smooth(mirror([(0, 0.7), (0.13, 0.695), (0.205, 0.62), (0.225, 0.53), (0.15, 0.49), (0.07, 0.43), (0, 0.39)]))
        card("shawl", SHAWL, 3.5, '#a995c9')
        hatch("shawl_h", crescent(SHAWL, -0.04, 0.03), SHAWL, 3.5, spacing=0.0095, color='#7f6ca3')
        hatch("shawl_rows", lambda p: True, SHAWL, 3.5, angle=-3, spacing=0.026, w=0.0022, color='#7f6ca3')
        ink("shawl_ink", SHAWL, 3.5, 0.0045)
        for i in range(9):
            x = -0.2 + i * 0.05
            z = 0.52 - (0.2 - abs(x)) * 0.62 if abs(x) < 0.2 else 0.52
            line(f"shawlfringe{i}", [(x, z), (x + 0.004, z - 0.018), (x + 0.002, z - 0.034)], 3.5, 0.0035, color='#a995c9')
        inked("shawlknot", ellipse(0.0, 0.4, 0.026, 0.02, n=16), 3.8, '#a995c9', w=0.0035)
    for s, ear, inner in ((1, EAR_R, INNER_R), (-1, flipx(EAR_R), flipx(INNER_R))):
        inked(f"ear{s}", ear, 4, FUR, w=0.0045, wash=0.04)
        card(f"inner{s}", inner, 4.2, PINK, wash=0.05)
    card("head", HEAD, 4.5, FUR, wash=0.05)
    hatch("head_h", crescent(HEAD, -0.045, 0.03), HEAD, 4.5, spacing=0.0095, w=0.002, color=SHADE)
    ink("head_ink", HEAD, 4.5, 0.005)
    for s in (-1, 1):
        ex, ez = H([(s * 0.062, 0.83)])[0]
        card(f"eye{s}", ellipse(ex, ez, 0.021 * hs, 0.017 * hs, n=20, rot=s * 14), 5, INK, wash=0)
        card(f"glint{s}", ellipse(ex + 0.006 * hs, ez + 0.006 * hs, 0.005 * hs, 0.005 * hs, n=10), 5.3, '#ffffff', wash=0)
        cx, cz = H([(s * 0.11, 0.77)])[0]
        card(f"cheek{s}", ellipse(cx, cz, 0.02 * hs, 0.012 * hs, n=16), 4.8, BLUSH, wash=0)
        line(f"ruff{s}", H([(s * 0.16, 0.8), (s * 0.172, 0.775), (s * 0.158, 0.755)]), 4.8, 0.0022, color=SHADE)
    NOSE = H(smooth([(-0.022, 0.745), (0.022, 0.745), (0.01, 0.725), (0.0, 0.72), (-0.01, 0.725)], n=6))
    inked("nose", NOSE, 5, '#2a2526', w=0.002, wash=0)
    line("mouth", H([(-0.025, 0.698), (-0.01, 0.692), (0.0, 0.71), (0.01, 0.692), (0.025, 0.698)]), 5, 0.0026)
    line("muzzle", H([(0.0, 0.72), (0.0, 0.708)]), 5, 0.002)
    for s in (-1, 1):   # the snout: a fox reads as a fox by its muzzle running up between the eyes
        line(f"snout{s}", H([(s * 0.026, 0.742), (s * 0.034, 0.77), (s * 0.04, 0.8)]), 4.8, 0.0024, color='#8d9cb0')

# ======================================================================================
# Book Two, spring. Mama Eider: a female common eider, side on, facing right, settled on her nest
# of down. Warm brown, barred all over, with the long sloping wedge of a bill that runs up the
# forehead. Her nest is a heap of grey-white down.
# ======================================================================================
def eider():
    P.begin("eider", 0.72)
    BROWN, BROWN_DK, DOWN, DOWN_DK = '#a07a52', '#6f5034', '#efe9df', '#b8ad9c'
    NEST = smooth([(-0.56, 0.02), (0.0, 0.0), (0.56, 0.02), (0.6, 0.1), (0.5, 0.2), (0.25, 0.25), (-0.25, 0.25),
                   (-0.5, 0.2), (-0.6, 0.1)])
    BODY = smooth([(-0.56, 0.4), (-0.42, 0.44), (-0.22, 0.54), (0.02, 0.58), (0.2, 0.55), (0.3, 0.46), (0.33, 0.33),
                   (0.26, 0.2), (0.0, 0.15), (-0.3, 0.17), (-0.45, 0.25)])
    WING = smooth([(-0.44, 0.38), (-0.2, 0.48), (0.06, 0.5), (0.2, 0.43), (0.16, 0.3), (-0.12, 0.26), (-0.38, 0.29)])
    HEAD = smooth([(0.18, 0.52), (0.2, 0.64), (0.27, 0.75), (0.37, 0.77), (0.45, 0.71), (0.47, 0.62), (0.42, 0.54),
                   (0.33, 0.48)])
    BILL = smooth([(0.43, 0.72), (0.5, 0.67), (0.62, 0.6), (0.61, 0.565), (0.5, 0.57), (0.44, 0.6)], n=6)
    P.backing([NEST, BODY, HEAD, BILL])
    P.easel(-0.25, 0.2, 0.05, 0.25)
    card("body", BODY, 2, BROWN)
    hatch("body_h", crescent(BODY, -0.04, 0.05), BODY, 2, angle=70, color=BROWN_DK)
    for i in range(9):   # the barring that makes her vanish on a nest
        x = -0.42 + i * 0.085
        z0 = 0.2 + 0.32 * (1 - abs(x + 0.06) / 0.5) ** 0.5
        line(f"bar{i}", [(x - 0.02, z0), (x + 0.01, z0 - 0.03), (x + 0.04, z0 - 0.02)], 2.2, 0.0035, color=BROWN_DK)
    ink("body_ink", BODY, 2, 0.006)
    card("wing", WING, 3, '#8d6845')
    for i in range(5):
        x = -0.36 + i * 0.11
        line(f"feather{i}", [(x, 0.31 + i * 0.012), (x + 0.07, 0.38 + i * 0.015), (x + 0.12, 0.42 + i * 0.008)], 3.2, 0.003, color=BROWN_DK)
    ink("wing_ink", WING, 3, 0.0045)
    card("head", HEAD, 4, BROWN)
    hatch("head_h", crescent(HEAD, -0.03, 0.03), HEAD, 4, spacing=0.0095, w=0.002, color=BROWN_DK)
    ink("head_ink", HEAD, 4, 0.005)
    inked("bill", BILL, 4.5, '#7f8a6a', w=0.004, wash=0.05)
    line("billline", [(0.47, 0.62), (0.6, 0.58)], 4.6, 0.0022)
    card("eye", ellipse(0.37, 0.66, 0.022, 0.024, n=20), 5, INK, wash=0)
    card("glint", ellipse(0.378, 0.672, 0.007, 0.007, n=10), 5.3, '#ffffff', wash=0)
    card("cheek", ellipse(0.33, 0.6, 0.026, 0.015, n=16), 4.8, BLUSH, wash=0)
    card("nest", NEST, 6, DOWN, wash=0.06)
    for i in range(10):   # wisps of down
        x = -0.48 + i * 0.105
        z = 0.12 + 0.1 * (1 - abs(x) / 0.6)
        line(f"down{i}", [(x - 0.03, z), (x, z + 0.03), (x + 0.03, z + 0.005)], 6.2, 0.0025, color=DOWN_DK)
    ink("nest_ink", NEST, 6, 0.005)

# ======================================================================================
# The hare: a mountain hare sitting up, front on, halfway between coats: brown on top, still
# winter white underneath. Long ears with black tips, a split lip, and very long whiskers.
# ======================================================================================
def hare():
    P.begin("hare", 0.8)
    FUR, SHADE, WINTER, PINK = '#b58d66', '#7f5f42', '#f5f2ec', '#e9c3c3'
    BODY = smooth(mirror([(0, 0.6), (0.12, 0.59), (0.19, 0.5), (0.23, 0.34), (0.245, 0.18), (0.2, 0.05), (0.11, 0.01), (0, 0.01)]))
    BELLY = smooth(mirror([(0, 0.47), (0.08, 0.455), (0.135, 0.36), (0.15, 0.2), (0.11, 0.07), (0, 0.05)]))
    HEAD = smooth(mirror([(0, 0.79), (0.08, 0.785), (0.135, 0.75), (0.158, 0.69), (0.142, 0.63), (0.09, 0.59), (0, 0.58)]))
    MUZZLE = smooth(mirror([(0, 0.68), (0.045, 0.675), (0.065, 0.645), (0.05, 0.615), (0, 0.605)]))
    EAR_R = smooth([(0.03, 0.765), (0.04, 0.88), (0.07, 1.02), (0.105, 1.045), (0.125, 0.98), (0.11, 0.85), (0.09, 0.75)])
    INNER_R = smooth([(0.055, 0.8), (0.065, 0.9), (0.085, 0.99), (0.102, 0.98), (0.1, 0.87), (0.085, 0.79)], n=8)
    TIP_R = smooth([(0.07, 1.0), (0.08, 1.03), (0.105, 1.045), (0.125, 0.98), (0.12, 0.96), (0.095, 0.985)], n=6)
    FOOT_R = ellipse(0.09, 0.03, 0.07, 0.03, n=20)
    P.backing([BODY, HEAD, EAR_R, flipx(EAR_R)])
    P.easel(-0.1, 0.1, 0.06, 0.2)
    card("body", BODY, 2, FUR, wash=0.06)
    hatch("body_h", crescent(BODY, -0.06, 0.04), BODY, 2, color=SHADE)
    ink("body_ink", BODY, 2, 0.0055)
    card("belly", BELLY, 2.5, WINTER, wash=0.04)
    ink("belly_ink", BELLY, 2.5, 0.0035)
    for s in (-1, 1):
        sh = FOOT_R if s == 1 else flipx(FOOT_R)
        inked(f"foot{s}", sh, 2.8, WINTER, w=0.004, wash=0.04)
        line(f"haunch{s}", [(s * 0.2, 0.32), (s * 0.16, 0.2), (s * 0.17, 0.08)], 2.6, 0.0034)
        line(f"arm{s}", [(s * 0.06, 0.42), (s * 0.055, 0.3), (s * 0.05, 0.2)], 2.6, 0.003)
    for s, ear, inner, tip in ((1, EAR_R, INNER_R, TIP_R), (-1, flipx(EAR_R), flipx(INNER_R), flipx(TIP_R))):
        inked(f"ear{s}", ear, 3, FUR, w=0.0045, wash=0.05)
        card(f"inner{s}", inner, 3.2, PINK, wash=0.05)
        card(f"tip{s}", tip, 3.3, '#3b2f27', wash=0)
    card("head", HEAD, 4, FUR, wash=0.05)
    hatch("head_h", crescent(HEAD, -0.045, 0.03), HEAD, 4, spacing=0.0095, w=0.002, color=SHADE)
    ink("head_ink", HEAD, 4, 0.005)
    inked("muzzle", MUZZLE, 4.3, WINTER, w=0.003, wash=0.03)
    for s in (-1, 1):
        card(f"eye{s}", ellipse(s * 0.075, 0.715, 0.02, 0.022, n=20, rot=s * 10), 5, INK, wash=0)
        card(f"glint{s}", ellipse(s * 0.075 + 0.006, 0.723, 0.006, 0.006, n=10), 5.3, '#ffffff', wash=0)
        card(f"cheek{s}", ellipse(s * 0.11, 0.655, 0.02, 0.012, n=16), 4.8, BLUSH, wash=0)
        for i in range(3):
            line(f"whisk{s}{i}", [(s * 0.05, 0.64 - i * 0.008), (s * 0.15, 0.645 - i * 0.02), (s * 0.22, 0.64 - i * 0.035)], 4.8, 0.0016)
    inked("nose", smooth([(-0.018, 0.67), (0.018, 0.67), (0.0, 0.652)], n=6), 5, '#c9727a', w=0.0018, wash=0)
    line("lip", [(0.0, 0.652), (0.0, 0.632), (-0.016, 0.622)], 5, 0.0022)
    line("lip2", [(0.0, 0.632), (0.016, 0.622)], 5, 0.0022)

# ======================================================================================
# Book Two, summer. The hermit crab: side on, facing right, peeking out of a spiral shell that is
# plainly too small. Orange-red, one big claw, eyes on stalks, walking legs splayed on the sand.
# ======================================================================================
def crab():
    P.begin("crab", 0.5)
    RED, RED_DK, SHELL, SHELL_DK = '#e0703f', '#a8482a', '#f0dcc0', '#c7a37a'
    SHELL_PTS = smooth([(-0.34, 0.06), (-0.42, 0.18), (-0.38, 0.32), (-0.26, 0.42), (-0.1, 0.44), (0.02, 0.37),
                        (0.05, 0.24), (0.0, 0.1), (-0.12, 0.04)])
    BODY = smooth([(-0.02, 0.12), (0.0, 0.3), (0.12, 0.4), (0.26, 0.38), (0.34, 0.26), (0.3, 0.12), (0.14, 0.07)])
    # the big claw, low and in front, with a clear notch between its two fingers
    CLAW = smooth([(0.3, 0.14), (0.4, 0.19), (0.5, 0.21), (0.57, 0.16), (0.48, 0.125), (0.57, 0.085), (0.49, 0.03),
                   (0.36, 0.06)], n=6)
    SMALL = smooth([(0.24, 0.08), (0.32, 0.05), (0.36, 0.02), (0.3, 0.0), (0.22, 0.03)], n=6)
    P.backing([SHELL_PTS, BODY, ellipse(0.44, 0.12, 0.15, 0.1, n=28), SMALL])   # an oval behind the claw: its notch would fold the backing
    P.easel(-0.2, 0.15, 0.03, 0.18)
    for i, (x0, x1) in enumerate(((0.04, -0.02), (0.1, 0.08), (0.16, 0.18), (0.22, 0.28))):   # walking legs
        line(f"leg{i}", [(x0, 0.12), (x1 + 0.04, 0.06), (x1 + 0.02, 0.0)], 1, 0.006, color=RED_DK)
    card("body", BODY, 2, RED)
    hatch("body_h", crescent(BODY, -0.03, 0.03), BODY, 2, color=RED_DK)
    ink("body_ink", BODY, 2, 0.005)
    for s_, (x, z) in enumerate(((0.16, 0.54), (0.25, 0.56))):   # eyes on stalks
        line(f"stalk{s_}", [(x - 0.02, 0.38), (x - 0.01, 0.46), (x, z)], 2.5, 0.006, color=RED_DK)
        card(f"eye{s_}", ellipse(x, z, 0.026, 0.026, n=16), 3, INK, wash=0)
        card(f"glint{s_}", ellipse(x + 0.008, z + 0.008, 0.008, 0.008, n=10), 3.3, '#ffffff', wash=0)
    line("smile", [(0.25, 0.25), (0.285, 0.23), (0.32, 0.25)], 2.6, 0.0035)
    card("cheek", ellipse(0.21, 0.27, 0.022, 0.013, n=14), 2.6, BLUSH, wash=0)
    card("shell", SHELL_PTS, 3, SHELL)
    hatch("shell_h", crescent(SHELL_PTS, 0.04, -0.04), SHELL_PTS, 3, angle=30, color=SHELL_DK)
    spiral = [(-0.17 + 0.15 * (1 - t / 24) * math.cos(t * 0.55), 0.24 + 0.13 * (1 - t / 24) * math.sin(t * 0.55)) for t in range(24)]
    line("spiral", spiral, 3.2, 0.005, color=SHELL_DK)
    ink("shell_ink", SHELL_PTS, 3, 0.006)
    inked("claw", CLAW, 4, RED, w=0.005)
    line("pincer", [(0.565, 0.12), (0.47, 0.125)], 4.2, 0.004)
    inked("small", SMALL, 4, RED, w=0.004)

# ======================================================================================
CAST = {
    "tuck":        lambda: penguin("tuck", 1.0, '#d6a646', '#a8802f', hat=('#7e9dc4', '#5e7da5')),
    "tuckSad":     lambda: penguin("tuckSad", 1.0, '#d6a646', '#a8802f', hat=('#7e9dc4', '#5e7da5'), sad=True),
    "pip":         lambda: penguin("pip", 1.0, '#c25a4b', '#8f3e33', tuft=True, sx=0.96, sz=1.04),
    "pebble":      lambda: penguin("pebble", 1.0, '#4f9a8c', '#3a7368', bow=('#e3a0b6', '#b9708a'), sx=1.03, sz=0.95),
    "hero":        explorer,
    "puffin":      puffin,
    "bobble":      seal,
    "grimfin":     orca,
    "walrus":      lambda: walrus(False),
    "walrusSpecs": lambda: walrus(True),
    "fox":         lambda: fox(False),
    "kit":         lambda: fox(True),
    "eider":       eider,
    "hare":        hare,
    "crab":        crab,
}

if __name__ == "__main__":   # importing this file (bake.py does) only defines the cast
    want = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(CAST)
    groups = {}
    for name in want:
        CAST[name]()
        groups[name] = (P.root, list(P.parts))

    # ---------- previews: each figure on a snowy paper page, then the whole cast in a row ----------
    sc = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=60)
    bpy.context.object.data.materials.append(P.paper('#eaf1f7', 0.05))
    key_data = bpy.data.lights.new("key", 'AREA'); key_data.size = 1.6
    key = bpy.data.objects.new("key", key_data); sc.collection.objects.link(key)
    world = bpy.data.worlds.new("sky"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (*P.lin('#d6e4f2'), 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 96; sc.cycles.device = 'CPU'
    sc.view_settings.view_transform = 'Standard'
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = 62

    def bbox(objs):
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
        return Vector((min(p.x for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.z for p in pts)))

    def shoot(objs, path):
        lo, hi = bbox(objs)
        w, h = hi.x - lo.x, hi.y - lo.y
        wide = w > h * 1.1
        sc.render.resolution_x, sc.render.resolution_y = (1300, 760) if wide else (800, 950)
        aspect = sc.render.resolution_x / sc.render.resolution_y
        target = Vector(((lo.x + hi.x) / 2, 0, lo.y + h * 0.48))
        # fit the figure in about 72% of the frame; the 36 mm sensor spans the longer side of the image
        f = 36 / cam.data.lens * 0.72
        fx, fz = (f, f / aspect) if aspect >= 1 else (f * aspect, f)
        dist = max(w / fx, h / fz)
        dirn = Vector((0, -3.0, 0.85)).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        key.location = target + Vector((-1.2, -2.2, 2.1)) * (dist / 3.2)
        key.rotation_euler = (target - key.location).to_track_quat('-Z', 'Y').to_euler()
        key_data.energy = 110 * (dist / 3.2) ** 2
        key_data.size = 1.6 * dist / 3.2
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)

    def show_only(names):
        for n, (r, objs) in groups.items():
            for o in [r] + objs:
                o.hide_render = n not in names

    for name, (r, objs) in groups.items():
        show_only({name})
        shoot(objs, os.path.join(OUT, f"{name}.png"))

    if len(groups) > 1:
        # the lineup leaves out the alternate faces so each character appears once
        row = [n for n in groups if n not in ("tuckSad", "walrusSpecs")]
        x = 0.0
        for n in row:
            r, objs = groups[n]
            lo, hi = bbox(objs)
            r.location.x += x - lo.x
            x += (hi.x - lo.x) + 0.25
        show_only(set(row))
        shoot([o for n in row for o in groups[n][1]], os.path.join(OUT, "lineup.png"))
        for n in row:
            groups[n][0].location.x = 0

    show_only(set(groups))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "cast.blend"))
