#!/usr/bin/env python3
"""web_assets.py — WebP derivatives of every field-day image.

Converts SW Maps attached photos (both courses), Pixel GPS photos,
and SW Maps screenshots to web-sized WebP under dataset/web-assets/
(photos/, screenshots/). Names are source stems, matching the
data/photos/<stem>.webp and data/screenshots/<stem>.webp URLs that
partial_holes.py and build_survey_assets.py publish. copy-data.mjs
copies the result into the web bundle.

Recipe: EXIF-transpose, cap longest side (photos 1600, screenshots
1080), WebP quality 82, method 6. Re-running is a no-op for files
already newer than their source. Usage:
  dataset/.venv/bin/python dataset/scripts/web_assets.py
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "dataset" / "web-assets"
JOBS = [
    # (source glob, out subdir, max side)
    ("dataset/survey/2026-11-01-community/photos_attached/*.jpg", "photos", 1600),
    ("dataset/survey/2026-11-01-tiki/photos_attached/*.jpg", "photos", 1600),
    ("dataset/survey/2026-11-01-community/photos/*.jpg", "photos", 1600),
    ("dataset/survey/2026-11-01-community/screenshots/*.png", "screenshots", 1080),
]


def convert(src: Path, dst: Path, max_side: int) -> None:
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((max_side, max_side), Image.LANCZOS)
        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst, "WEBP", quality=82, method=6)


def main() -> int:
    total = 0
    for pattern, sub, max_side in JOBS:
        files = sorted(REPO.glob(pattern))
        for src in files:
            convert(src, OUT / sub / f"{src.stem}.webp", max_side)
        total += len(files)
        print(f"{sub}: {len(files)} from {pattern}")
    print(f"web-assets: {total} sources -> {OUT.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
