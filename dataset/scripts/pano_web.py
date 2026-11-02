#!/usr/bin/env python3
"""pano_web.py — web derivatives of the survey 360° panos.

Source panos are 19k-pixel wide (12-31 MB) — fine for the archive, useless
on a phone. Web derivatives: 2048px wide WebP q80 (a few hundred KB), which
is what the walkthrough PhotoDome loads. Deterministic: fixed width and
quality; sidecar per output with source sha.

Usage: python pano_web.py [src-dir] [dst-dir]
Defaults: dataset/survey/2026-11-01-community/panos -> dataset/panos-web/
"""
import hashlib
import json
import sys
from pathlib import Path

import PIL
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
WIDTH = 2048
QUALITY = 80


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    src_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else (
        REPO / "dataset/survey/2026-11-01-community/panos"
    )
    dst_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else (
        REPO / "dataset/panos-web"
    )
    dst_dir.mkdir(parents=True, exist_ok=True)
    for src in sorted(src_dir.glob("*.PANO.jpg")):
        stem = src.name.replace(".PANO.jpg", ".webp")
        dst = dst_dir / stem
        im = Image.open(src).convert("RGB")
        nh = round(im.height * WIDTH / im.width)
        out = im.resize((WIDTH, nh), Image.LANCZOS)
        out.save(dst, "WEBP", quality=QUALITY, method=6)
        data = dst.read_bytes()
        sidecar = {
            "source": str(src.relative_to(REPO)),
            "source_sha256": sha256_of(src),
            "output": str(dst.relative_to(REPO)),
            "dimensions": list(out.size),
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data),
            "pil_version": PIL.__version__,
            "python_version": sys.version.split()[0],
            "transforms": [f"resize_w{WIDTH}_lanczos", f"export_webp_q{QUALITY}_m6"],
        }
        dst.with_suffix(dst.suffix + ".sidecar.json").write_text(
            json.dumps(sidecar, indent=1) + "\n"
        )
        print(f"{src.name} -> {dst.name} ({len(data) // 1024} KiB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
