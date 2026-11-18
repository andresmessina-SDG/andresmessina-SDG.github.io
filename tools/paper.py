#!/usr/bin/env python3
"""The book's paper: python3 tools/paper.py

Derived from the real parchment (assets/book/parchment.webp, made by tools/real-assets.py from a
medieval leaf): the same skin, its grain kept at a little over half and its colour at a quarter, on a lighter,
cooler ground, as a fine modern paper is beside vellum. The result tiles as the parchment does.
Needs Pillow and numpy.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "assets" / "book"
GRAIN = 0.6                         # how much of the parchment's light and dark is kept
TINT = 0.25                         # and of its colour (the warm mottling of the skin)
GROUND = np.array([250, 246, 237])  # the paper's colour, a warm white


def main():
    a = np.asarray(Image.open(BOOK / "parchment.webp").convert("RGB")).astype(np.float32)
    mean = a.reshape(-1, 3).mean(axis=0)
    dev = a - mean
    lum = dev.mean(axis=2, keepdims=True)                 # the grain as light and dark
    out = GROUND + lum * GRAIN + (dev - lum) * TINT        # and a little of its colour
    img = Image.fromarray(out.clip(0, 255).round().astype(np.uint8))
    img.save(BOOK / "paper.webp", "WEBP", quality=90, method=6)
    print(f"wrote assets/book/paper.webp {img.size} {(BOOK / 'paper.webp').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
