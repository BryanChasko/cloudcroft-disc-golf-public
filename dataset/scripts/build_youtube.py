"""YouTube channel kit from the November 1 ground survey (PIL-only).

Deterministic: same inputs -> same bytes. Brand per ~/writing/BRAND.md:
house navy #0F141C panels/edge fade, badge navy #00002a, orange #ff9900
accent (<= ~15% of frame), DejaVu Sans Bold for code-drawn text.

Outputs (docs/youtube/):
  yt-banner-2560x1440.webp  channel art (safe-area aware)
  yt-thumb-mountaintop-1280x720.webp  video thumbnail, tee box 2 pano
  yt-thumb-basket-1280x720.webp  video thumbnail, basket close-up
  yt-profile-800x800.webp  channel avatar, basket close-up square

Run:  python dataset/scripts/build_youtube.py
Requires: Pillow (repo venv or system).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PHOTOS = ROOT / "web/public/data/photos"
PANOS = ROOT / "web/public/data/panos"
OUT = ROOT / "docs/youtube"

NAVY = (15, 20, 28)  # #0F141C house navy
PAPER = (247, 245, 239)
GRAY = (176, 178, 182)
ORANGE = (255, 153, 0)
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

SOURCES = {
    "pano_tee2": "web/public/data/panos/PXL_20261101_173005849.webp",
    "basket1": "web/public/data/photos/PXL_20261101_171528886.MP.webp",
}


def load(rel: str) -> Image.Image:
    p = ROOT / rel
    if not p.exists():
        sys.exit(f"missing source (run web build first): {rel}")
    return Image.open(p).convert("RGB")


def vignette(img: Image.Image, feather: int = 60) -> Image.Image:
    """Canonical linear edge-distance fade into house navy."""
    import math

    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    px = mask.load()
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            d = min(x, y, w - 1 - x, h - 1 - y) / max(feather, 1)
            v = int(255 * (1 - min(max(d, 0.0), 1.0)) ** 1.5)
            px[x, y] = v
    mask = mask.resize((w, h))
    navy = Image.new("RGB", (w, h), NAVY)
    # mask is 255 at the edges, 0 inside: navy bleeds in from the frame.
    return Image.composite(navy, img, mask)


def center_text(
    draw: ImageDraw.ImageDraw,
    cx: int,
    y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
) -> None:
    l, t, r, b = draw.textbbox((0, 0), text, font=font)
    draw.text((cx - (r - l) / 2, y), text, font=font, fill=fill)


def build_banner() -> Image.Image:
    """2560x1440: title over pine-navy, tee-2 pano riding the safe band."""
    pano = load(SOURCES["pano_tee2"])
    img = Image.new("RGB", (2560, 1440), NAVY)
    # Pano scaled to full width lands exactly on the 423px TV safe band.
    band_h = round(2560 * pano.height / pano.width)
    band = pano.resize((2560, band_h), Image.LANCZOS)
    img.paste(band, (0, (1440 - band_h) // 2))
    img = vignette(img, feather=110)
    draw = ImageDraw.Draw(img)
    title = ImageFont.truetype(FONT_BOLD, 118)
    sub = ImageFont.truetype(FONT_REG, 52)
    center_text(draw, 1280, 250, "CLOUDCROFT DISC GOLF", title, PAPER)
    # Orange keyline under the title, inside the 1546px safe width.
    draw.rectangle([1280 - 180, 408, 1280 + 180, 416], fill=ORANGE)
    center_text(
        draw, 1280, 1006, "AR scoremap  ·  Cloudcroft, New Mexico", sub, GRAY
    )
    return img


def pano_thumb() -> Image.Image:
    """1280x720 from the tee-2 pano center (disc-golf vista)."""
    pano = load(SOURCES["pano_tee2"])
    w, h = pano.size
    cw = round(h * 16 / 9)
    left = (w - cw) // 2
    thumb = pano.crop((left, 0, left + cw, h)).resize(
        (1280, 720), Image.LANCZOS
    )
    return vignette(thumb, feather=50)


def basket_thumb() -> Image.Image:
    """1280x720 from the basket-1 close-up (portrait -> 16:9 center)."""
    photo = load(SOURCES["basket1"])
    w, h = photo.size
    ch = round(w * 9 / 16)
    top = min(max((h - ch) // 2 - 60, 0), h - ch)
    thumb = photo.crop((0, top, w, top + ch)).resize(
        (1280, 720), Image.LANCZOS
    )
    return vignette(thumb, feather=50)


def profile() -> Image.Image:
    """800x800 avatar: basket close-up, center square."""
    photo = load(SOURCES["basket1"])
    w, h = photo.size
    side = min(w, h)
    avatar = (
        photo.crop(((w - side) // 2, (h - side) // 2 - 40, (w + side) // 2, (h + side) // 2 - 40))
        .resize((800, 800), Image.LANCZOS)
    )
    return vignette(avatar, feather=40)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = {
        "yt-banner-2560x1440.webp": build_banner(),
        "yt-thumb-mountaintop-1280x720.webp": pano_thumb(),
        "yt-thumb-basket-1280x720.webp": basket_thumb(),
        "yt-profile-800x800.webp": profile(),
    }
    manifest = []
    for name, img in jobs.items():
        path = OUT / name
        img.save(path, "WEBP", quality=88, method=6)
        manifest.append({"file": name, "size": list(img.size)})
    sidecar = {
        "generated_by": "dataset/scripts/build_youtube.py",
        "brand": "~/writing/BRAND.md",
        "navy": "#0F141C",
        "accent": "#ff9900 (keyline only)",
        "font": FONT_BOLD,
        "sources": SOURCES,
        "assets": manifest,
    }
    (OUT / "build_youtube.sidecar.json").write_text(
        json.dumps(sidecar, indent=2) + "\n"
    )
    print(f"wrote {len(jobs)} assets to {OUT}")


if __name__ == "__main__":
    main()
