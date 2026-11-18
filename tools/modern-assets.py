#!/usr/bin/env python3
"""The modern binding and desk: python3 tools/modern-assets.py SRC_DIR

From real scans (Poly Haven, CC0; see assets/book/SOURCES.md), downloaded into SRC_DIR:

  cloth.webp  the boards: book_pattern_col1 (a scan of a real bookbinding cloth, olive), its weave kept
              and the cloth dyed slate blue, its scuffs and light threads quietened, as a new book's is
  desk.webp   the table it lies on: oak_veneer_03 (a scan of real oak veneer, pale, with its arched grain)

Both tile. Needs Pillow and numpy.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "book"
SLATE = np.array([58, 72, 90], dtype=np.float32)   # the cloth's dye: a deep, greyed blue


def save(img, name, q):
    img.save(OUT / name, "WEBP", quality=q, method=6)
    print(f"wrote assets/book/{name} {img.size} {(OUT / name).stat().st_size // 1024} KB")


def main(src):
    s = Path(src)
    # the cloth: its light and dark only (the weave), the brightest specks and scuffs taken down to the
    # weave around them, then laid on the dye
    c = Image.open(s / "book_pattern-col1-2k.jpg").convert("L").resize((1024, 1024), Image.LANCZOS)
    a = np.asarray(c).astype(np.float32)
    local = np.asarray(c.filter(ImageFilter.GaussianBlur(6))).astype(np.float32)
    a = np.minimum(a, local * 1.18)                       # a scuff is a thread far lighter than its neighbours
    # and the cloth's mottling (its age and handling) evened out, the weave kept: each point over the
    # broad light around it
    broad = np.asarray(Image.fromarray(a.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28))).astype(np.float32)
    a = a / np.maximum(broad, 1)
    a = 1 + (a - 1) * 0.85                                # the weave, a touch quieter
    cloth = (SLATE[None, None, :] * a[..., None]).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(cloth).resize((600, 600), Image.LANCZOS), "cloth.webp", 74)

    # the desk: the oak as it is, a little smaller
    o = Image.open(s / "oak_veneer_03-2k.jpg").convert("RGB")
    save(o.resize((1000, 1000), Image.LANCZOS), "desk.webp", 72)


if __name__ == "__main__":
    main(sys.argv[1])
