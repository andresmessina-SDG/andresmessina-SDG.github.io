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
  leather.webp    the worn calf of a 19th-century family Bible's cover, for the boards
  oak.webp        oak planks, for the desk the book lies on
  fleuron.webp    a printer's ornament from the Kilmarnock Burns of 1786, its paper lifted out

"Lifting out" divides a scan by its own paper colour, so the paper becomes white and only ink,
paint and gold remain; laid on the page with mix-blend-mode: multiply, the ornament sits on our
parchment as if painted there. Needs Pillow and numpy.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "book"


def save(img, name, q=82):
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name, "WEBP", quality=q, method=6)
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
    # its gold, behind the prophet's shoulder
    g = Image.open(s / "initA1.jpg").convert("RGB").crop((715, 190, 945, 395))
    save(g.resize((256, 256), Image.LANCZOS), "gold.webp", 88)

    # the Metz border: the column of ivy and flowers between the text and the page's edge
    m = Image.open(s / "metz-3840.jpg").convert("RGB")
    W, H = m.size
    col = m.crop((int(W * 0.745), int(H * 0.035), int(W * 0.875), int(H * 0.86)))
    col = to_alpha(lift(col))
    save(col.resize((170, round(170 * col.height / col.width)), Image.LANCZOS), "vine.webp", 72)   # shown at most about 160px wide

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

    # the boards: worn oxblood calf
    lt = Image.open(s / "bible1.jpg").convert("RGB")
    save(lt.resize((720, round(720 * lt.height / lt.width)), Image.LANCZOS), "leather.webp", 74)

    # the desk: oak, darkened and warmed as old furniture is
    o = Image.open(s / "oak.png").convert("RGB")
    arr = np.asarray(o).astype(np.float32) * np.array([0.62, 0.5, 0.4])
    save(Image.fromarray(arr.clip(0, 255).astype(np.uint8)).resize((900, 900), Image.LANCZOS), "oak.webp", 78)

    # the fleuron
    f = Image.open(s / "fleuron1.jpg").convert("RGB")
    W, H = f.size
    f = lift(f.crop((int(W * 0.2), int(H * 0.12), int(W * 0.8), int(H * 0.83))))
    f = ImageOps.grayscale(f)
    f = ImageOps.autocontrast(f, cutoff=1).point(lambda v: 255 if v > 170 else round(v * 255 / 170))
    f = ImageOps.colorize(f, black=(52, 38, 26), white=(255, 255, 255))   # printer's ink, gone brown with age
    save(to_alpha(f.resize((300, round(300 * f.height / f.width)), Image.LANCZOS)), "fleuron.webp", 86)


if __name__ == "__main__":
    main(sys.argv[1])
