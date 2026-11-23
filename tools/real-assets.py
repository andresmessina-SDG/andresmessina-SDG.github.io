#!/usr/bin/env python3
"""Prepare the book's real materials from their sources: python3 tools/real-assets.py SRC_DIR

Every texture and ornament in the book is a photograph or scan of a real thing (sources and
licences in assets/book/SOURCES.md). This turns the downloaded originals in SRC_DIR into the
sizes the page uses, in assets/book/:

  initial-a.webp  the opening initial A: a 13th-century Italian Bible initial on burnished gold
  vine.webp       gilded ivy, flowers and hairline stems from the border of a 15th-century Book
                  of Hours (Use of Metz), its vellum lifted out so it can be laid on another page
  gold.webp       a patch of that Bible initial's burnished gold, to gild S.D.G.
  parchment.webp  medieval parchment, made to tile
  fleuron.webp    a printer's ornament from the Kilmarnock Burns of 1786, its paper lifted out
  seal.webp       a seal of red sealing wax on a folded letter of 1846, cut from its paper, to close
                  the envelope on the calendar page (from Commons' 960px rendering of the scan)
  envelope.webp   the back of an envelope of 1843 (Fanny Appleton's, to Longfellow), cut from the
                  scanner's white, its own black seal taken out to make way for the red one
  letter.webp     the blank page of the letter that came in that envelope, with its stationer's
                  emboss and the creases it was folded in three by: the paper the readings are on

"Lifting out" divides a scan by its own paper colour, so the paper becomes white and only ink,
paint and gold remain; laid on the page with mix-blend-mode: multiply, the ornament sits on our
parchment as if painted there. Needs Pillow and numpy.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "book"


def save(img, name, q=82, aq=100):
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name, "WEBP", quality=q, alpha_quality=aq, method=6)
    print(f"wrote assets/book/{name} {img.size} {(OUT / name).stat().st_size // 1024} KB")


def lift(img, blur=40):
    """Divide out the paper: an estimate of the bare paper colour at every point (a wide median of
    the light pixels) becomes white, leaving what was painted or printed on it."""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    small = img.convert("RGB").resize((max(8, img.width // 16), max(8, img.height // 16)), Image.LANCZOS)
    paper = small.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2)).resize(img.size, Image.BICUBIC)
    p = np.asarray(paper).astype(np.float32) + 1
    out = np.clip(a / p * 255 * 1.02, 0, 255)
    return Image.fromarray(out.astype(np.uint8))


def to_alpha(img):
    """Turn the white a lifted scan leaves into transparency ("colour to alpha"): each pixel keeps the
    least opacity, and the colour, that over white gives back what was scanned. Then it lies on any
    page with ordinary blending, which holds inside the book's turning leaves as multiply does not."""
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255
    alpha = (1 - a).max(axis=2, keepdims=True)
    alpha = np.where(alpha < 0.035, 0, alpha)                 # the paper's own grain stays behind
    colour = 1 - (1 - a) / np.maximum(alpha, 1e-4)
    rgba = np.concatenate([colour.clip(0, 1), alpha.clip(0, 1)], axis=2)
    return Image.fromarray((rgba * 255).round().astype(np.uint8), "RGBA")


def tileable(img, overlap=0.18):
    """Make a texture tile by cross-fading each edge into the opposite one."""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    ow, oh = int(w * overlap), int(h * overlap)
    # horizontal: blend the right strip over the left
    ramp = np.linspace(0, 1, ow)[None, :, None]
    left = a[:, :ow] * ramp + a[:, w - ow:] * (1 - ramp)
    a = np.concatenate([left, a[:, ow:w - ow]], axis=1)
    h, w, _ = a.shape
    ramp = np.linspace(0, 1, oh)[:, None, None]
    top = a[:oh] * ramp + a[h - oh:] * (1 - ramp)
    a = np.concatenate([top, a[oh:h - oh]], axis=0)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def main(src):
    s = Path(src)
    # the opening initial: the painted block of the cutting, inside its torn edges
    a = Image.open(s / "initA1.jpg").convert("RGB")
    a = a.crop((82, 86, 1204, 1342))
    save(a.resize((560, round(560 * a.height / a.width)), Image.LANCZOS), "initial-a.webp", 86)
    # and the size the page shows it at (the share images and icons are drawn from the larger)
    save(a.resize((320, round(320 * a.height / a.width)), Image.LANCZOS), "initial-a-320.webp", 86)
    # its gold, behind the prophet's shoulder
    g = Image.open(s / "initA1.jpg").convert("RGB").crop((715, 190, 945, 395))
    save(g.resize((256, 256), Image.LANCZOS), "gold.webp", 88)

    # the Metz border: the column of ivy and flowers between the text and the page's edge
    m = Image.open(s / "metz-3840.jpg").convert("RGB")
    W, H = m.size
    col = m.crop((int(W * 0.745), int(H * 0.035), int(W * 0.875), int(H * 0.86)))
    col = to_alpha(lift(col))
    col = col.resize((170, round(170 * col.height / col.width)), Image.LANCZOS)   # shown at most about 160px wide
    # the faintest of what was lifted (the vellum's own grain, never the paint) is let go, and the rest
    # kept at a weight a page can carry: 110 KB, not 260, with nothing lost to the eye
    a = np.asarray(col).copy()
    a[a[..., 3] < 16] = 0
    save(Image.fromarray(a, "RGBA"), "vine.webp", 72, 65)

    # parchment: the smooth (hair) side of a medieval leaf, a little lighter, made to tile
    p = Image.open(s / "perg2.jpg").convert("RGB")
    arr = np.asarray(p).astype(np.float32)
    mean = arr.reshape(-1, 3).mean(axis=0)
    arr = mean + (arr - mean) * 1.15                   # its grain and flecks, a little deepened
    arr = arr * (np.array([250, 243, 228]) / mean)     # on a warm vellum ground
    # take out the dark flecks, which would recur at the same place on every page where the tile repeats
    med = np.asarray(Image.fromarray(arr.clip(0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(9))).astype(np.float32)
    fleck = (med - arr).mean(axis=2, keepdims=True) > 14
    arr = np.where(fleck, med, arr)
    p = tileable(Image.fromarray(arr.clip(0, 255).astype(np.uint8)))
    save(p.resize((720, 720), Image.LANCZOS), "parchment.webp", 80)

    # (the boards and the desk are made by tools/modern-assets.py)

    # the fleuron
    f = Image.open(s / "fleuron1.jpg").convert("RGB")
    W, H = f.size
    f = lift(f.crop((int(W * 0.2), int(H * 0.12), int(W * 0.8), int(H * 0.83))))
    f = ImageOps.grayscale(f)
    f = ImageOps.autocontrast(f, cutoff=1).point(lambda v: 255 if v > 170 else round(v * 255 / 170))
    f = ImageOps.colorize(f, black=(52, 38, 26), white=(255, 255, 255))   # printer's ink, gone brown with age
    save(to_alpha(f.resize((300, round(300 * f.height / f.width)), Image.LANCZOS)), "fleuron.webp", 86)

    # the seal: the wax is what is red and not tan (the letter's paper, and the scraps of it torn away
    # with the wax, are tan); its letters and its border, darker, are filled in as what the wax encloses
    w = Image.open(s / "seal-1846-960.jpg").convert("RGB").crop((370, 215, 605, 420))
    a = np.asarray(w).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    wax = Image.fromarray((((g < r * 0.62) & (b < r * 0.5) & (r > 70)) * 255).astype(np.uint8), "L")
    wax = wax.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    outside = ImageOps.expand(wax, 3, 0)
    ImageDraw.floodfill(outside, (0, 0), 128)
    whole = outside.point(lambda v: 0 if v == 128 else 255).crop((3, 3, 3 + w.width, 3 + w.height))
    ImageDraw.floodfill(whole, (110, 100), 200)          # the piece at the seal's middle, and no stray specks
    whole = whole.point(lambda v: 255 if v == 200 else 0).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    w = w.convert("RGBA")
    w.putalpha(whole.filter(ImageFilter.GaussianBlur(.7)))
    w = w.crop(w.getchannel("A").point(lambda v: 255 if v > 30 else 0).getbbox())
    side = max(w.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(w, ((side - w.width) // 2, (side - w.height) // 2), w)
    save(sq.resize((208, 208), Image.LANCZOS), "seal.webp", 86)   # (the size it was scanned at)

    # the envelope: what is not the scanner's white, its edge softened a little; its black wax seal (the
    # dark piece about the middle, grown a little to take its shadow) filled from clean paper higher on the
    # same flap, where no fold line crosses, in the light of the paper about it. Where the seal was, the
    # flap's point, is where site.css sets the red seal and folds the flap (--tip in site.css).
    e = Image.open(s / "envelope-1843-1280.jpg").convert("RGB")
    a = np.asarray(e).astype(np.float32)
    H, W = a.shape[:2]
    lum, sat = a.mean(2), a.max(2) - a.min(2)
    env = Image.fromarray((((lum < 238) | (sat > 12)) * 255).astype(np.uint8), "L").filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    outside = ImageOps.expand(env, 3, 0)
    ImageDraw.floodfill(outside, (0, 0), 128)
    env = outside.point(lambda v: 0 if v == 128 else 255).crop((3, 3, 3 + W, 3 + H))
    yy, xx = np.mgrid[0:H, 0:W]
    black = Image.fromarray((((lum < 125) & ((xx - 626) ** 2 + (yy - 520) ** 2 < 125 ** 2)) * 255).astype(np.uint8), "L")
    black = black.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    where = black.getbbox()
    grown = black.filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(4))
    m = np.asarray(grown).astype(np.float32)[..., None] / 255
    clean = np.roll(a, 230, axis=0)                                  # the paper 230px above

    def box(x, r):
        for ax in (0, 1):
            c = np.cumsum(np.pad(x, [(r + 1, r) if k == ax else (0, 0) for k in range(x.ndim)], mode="edge"), axis=ax)
            x = (np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * r - 1), axis=ax)) / (2 * r + 1)
        return x

    def light(x, w, r=40):                                           # the light at each point, from what w weights
        return box(box(x * w[..., None], r), r) / np.maximum(box(box(w[..., None], r), r), 1e-6)

    keep = 1 - (np.asarray(grown.filter(ImageFilter.MaxFilter(9))).astype(np.float32) / 255 > .02).astype(np.float32)
    a = a * (1 - m) + clean * light(a, keep) / np.maximum(light(clean, np.ones_like(keep)), 1) * m
    e = Image.fromarray(a.clip(0, 255).astype(np.uint8)).convert("RGBA")
    e.putalpha(env.filter(ImageFilter.GaussianBlur(.8)))
    bb = env.getbbox()
    e = e.crop(bb)
    print(f"envelope: flap's point at {((where[0] + where[2]) / 2 - bb[0]) / e.width:.4f}, {((where[1] + where[3]) / 2 - bb[1]) / e.height:.4f}; {e.width / e.height:.4f} wide to high")
    save(e.resize((960, round(960 * e.height / e.width)), Image.LANCZOS), "envelope.webp", 78)   # (sharp at twice the size it is shown at, about 400px)

    # the letter's paper: the right-hand page of the sheet (from Commons' 1920px rendering), which she left
    # blank, with its own edges: cut from the scanner's white (the paper is what is cream, not white) on
    # three sides, and on the fourth at the fold between its two pages. It was folded in three to go into
    # the envelope: its creases lie at 28.6% and 65.3% of its height (measured on the scan), where site.css
    # folds it (--crease-1, --crease-2)
    page = Image.open(s / "letter-1843-1920.jpg").convert("RGB").crop((963, 58, 1890, 1504))
    a = np.asarray(page).astype(np.float32)
    cream = Image.fromarray((((a[..., 0] - a[..., 2]) > 18) * 255).astype(np.uint8), "L")
    cream = cream.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    outside = ImageOps.expand(cream, 3, 0)
    outside.paste(255, (0, 0, 4, outside.height))   # (the fold: paper to the very edge)
    ImageDraw.floodfill(outside, (outside.width - 1, 0), 128)
    sheet = outside.point(lambda v: 0 if v == 128 else 255).crop((3, 3, 3 + page.width, 3 + page.height))
    page = page.convert("RGBA")
    page.putalpha(sheet.filter(ImageFilter.GaussianBlur(.7)))
    save(page.resize((900, round(900 * page.height / page.width)), Image.LANCZOS), "letter.webp", 80, 90)


if __name__ == "__main__":
    main(sys.argv[1])
