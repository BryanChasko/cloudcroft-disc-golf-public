#!/usr/bin/env python3
"""build_survey_assets.py — index every field-day image for the web.

Reads dataset/survey/2026-11-01-community/MANIFEST.md (photo + pano
tables carry lat/lon + human labels) and the screenshots/ directory,
and writes dataset/survey-assets.json: one record per Pixel photo
(15), pano (6), and SW Maps screenshot (20), each with coordinates
where known and the served WebP URL (web_assets.py emits the files,
copy-data.mjs publishes them). Pano records carry pano_id joining
them to web/src/config.ts PANOS.

Deterministic: pure function of MANIFEST.md + directory listings.
"""

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SURVEY = REPO / "dataset" / "survey" / "2026-11-01-community"
MANIFEST = SURVEY / "MANIFEST.md"
OUT = REPO / "dataset" / "survey-assets.json"

ROW_RE = re.compile(
    r"^\|\s*(PXL_[^|\s]+\.jpg)\s*\|\s*([\d.\-]+)\s*\|\s*([\d.\-]+)\s*\|\s*([^|]+?)\s*\|$",
    re.MULTILINE,
)
PANO_IDS = {
    "PXL_20261101_171610748.PANO.jpg": "basket1",
    # 170324214 shoots the Hole 1 tee area (GPS + sign both read Hole 1);
    # it was mislabeled tee2 until the Nov 2026 mountaintop correction.
    "PXL_20261101_170324214.PANO.jpg": "tee1-area",
    "PXL_20261101_173918101.PANO.jpg": "basket2",
    # south pair identified nov 2026 (bryan ground truth): 175756282 =
    # Byron Ligon teebox 3, 180216070 = Byron Ligon fairway 3. pano_ids
    # stay tiki-vista/tiki-aspen: stable join keys to web PANOS; the
    # identified names live in MANIFEST.md labels + PANO-INDEX.md.
    "PXL_20261101_180216070.PANO.jpg": "tiki-aspen",
    "PXL_20261101_175756282.PANO.jpg": "tiki-vista",
    "PXL_20261101_173005849.PANO.jpg": "tee2-area",
}
PANO_COURSE = {
    "basket1": "community",
    "tee1-area": "community",
    "basket2": "community",
    "tee2-area": "community",
    "tiki-aspen": "tiki",
    "tiki-vista": "tiki",
}
# verbatim from MANIFEST "two transcribed remarks"
TRANSCRIBED = {
    "Screenshot_20261101-103445.png": {
        "lat": 32.961717387,
        "lon": -105.741697207,
        "label": "Recording community-tee-2 — par 3, 245 ft, mando right, fence line OB right (37-fix average)",
    },
    "Screenshot_20261101-110039.png": {
        "lat": 32.956911667,
        "lon": -105.738341667,
        "label": "Recording unknown-teebox-front (Byron Ligon teebox 3 area, identified nov 2026)",
    },
}


def flow_label(name: str) -> str:
    t = name.removeprefix("Screenshot_20261101-").removesuffix(".png")
    hhmm = f"{t[:2]}:{t[2:4]}"
    if t <= "093523":
        phase = "SW Maps project + point-layer setup"
    elif t <= "095543":
        phase = "SW Maps map view over the course"
    elif t < "110003":
        phase = "Recording averaged GPS points"
    else:
        phase = "Second project: cloudcroft-village-course (Tiki)"
    return f"{phase} — {hhmm}"


def main() -> int:
    text = MANIFEST.read_text()
    assets = []
    for fname, lat, lon, label in ROW_RE.findall(text):
        stem = Path(fname).stem
        if ".PANO" in fname:
            pid = PANO_IDS[fname]
            assets.append(
                {
                    "asset_id": fname,
                    "kind": "pano",
                    "pano_id": pid,
                    "course": PANO_COURSE[pid],
                    "label": label,
                    "lat": float(lat),
                    "lon": float(lon),
                    "source": f"dataset/survey/2026-11-01-community/panos/{fname}",
                    "web_url": f"data/panos/{stem.removesuffix('.PANO')}.webp",
                }
            )
        else:
            assets.append(
                {
                    "asset_id": fname,
                    "kind": "photo",
                    "label": label,
                    "lat": float(lat),
                    "lon": float(lon),
                    "source": f"dataset/survey/2026-11-01-community/photos/{fname}",
                    "web_url": f"data/photos/{stem}.webp",
                }
            )
    for shot in sorted((SURVEY / "screenshots").glob("*.png")):
        rec = {
            "asset_id": shot.name,
            "kind": "screenshot",
            "label": flow_label(shot.name),
            "lat": None,
            "lon": None,
            "source": f"dataset/survey/2026-11-01-community/screenshots/{shot.name}",
            "web_url": f"data/screenshots/{shot.stem}.webp",
        }
        if shot.name in TRANSCRIBED:
            rec.update(TRANSCRIBED[shot.name])
        assets.append(rec)
    kinds = {
        k: sum(1 for a in assets if a["kind"] == k)
        for k in ("photo", "pano", "screenshot")
    }
    OUT.write_text(
        json.dumps(
            {
                "generated_from": "dataset/survey/2026-11-01-community/MANIFEST.md + screenshots/",
                "counts": kinds,
                "assets": assets,
            },
            indent=1,
        )
        + "\n"
    )
    print(f"survey-assets.json: {len(assets)} assets {kinds}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
