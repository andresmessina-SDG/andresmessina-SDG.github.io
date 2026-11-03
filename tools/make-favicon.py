#!/usr/bin/env python3
"""Pack the small icons that render-images.js draws into /favicon.ico.

Browsers ask the root of the host for /favicon.ico, so this one also serves
any project site beneath it that does not name an icon of its own.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sizes = [16, 32, 48]
images = [Image.open(ROOT / "tools" / f"favicon-{s}.png").convert("RGBA") for s in sizes]
images[-1].save(ROOT / "favicon.ico", sizes=[(s, s) for s in sizes], append_images=images[:-1])
for s in sizes:
    (ROOT / "tools" / f"favicon-{s}.png").unlink()
print("wrote favicon.ico")
