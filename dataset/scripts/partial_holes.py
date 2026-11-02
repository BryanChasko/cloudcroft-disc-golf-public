#!/usr/bin/env python3
"""partial_holes.py — fill course holes[]/features[] from a partial survey.

The full builder (build_holes.py) requires a complete validated survey.
This adapter implements the demo contract: real data where the survey
reached, explicit scaffold rows everywhere else, nothing invented.

Reads dataset/survey/*/points.geojson (from swm2_to_geojson.py) and
writes into dataset/{cloudcroft-community,byron-ligon-tiki}.json:
  - holes[]: one row per nominal hole. status: surveyed (named point),
    remote (par/distance known without ground GPS), scaffold (awaiting
    survey). par_source says where par came from (tee remark, sign photo,
    remote listing).
  - features[]: surveyed tee/basket points, fairway lines where both
    ends exist, located-unidentified points (photos, no hole name yet).

Deterministic: pure function of the points.geojson inputs.
"""

import json
import math
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SURVEY = REPO / "dataset" / "survey"

HOLE_RE = re.compile(r"(tiki|community)-(tee|basket)-(\d+)")
PAR_RE = re.compile(r"par\s*(\d+)", re.IGNORECASE)
DIST_RE = re.compile(r"(\d+(?:\.\d+)?)\s*ft", re.IGNORECASE)

# Pixel field photos join points by GPS proximity, not by filename.
# 50 m keeps every genuine pad-side match (max observed 43 m) while the
# north and south clusters sit ~600 m apart, so nothing crosses over.
FIELD_PHOTO_M = 50.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def load_field_photos() -> list:
    """Pixel field photos with EXIF GPS, from survey-assets.json."""
    data = json.loads((REPO / "dataset" / "survey-assets.json").read_text())
    return [
        a
        for a in data["assets"]
        if a["kind"] == "photo"
        and a.get("lat") is not None
        and a.get("lon") is not None
    ]


def field_matches(lat: float, lon: float, photos: list) -> list:
    """Nearest-first Pixel photos within FIELD_PHOTO_M. Deterministic."""
    out = []
    for a in photos:
        d = haversine_m(lat, lon, a["lat"], a["lon"])
        if d <= FIELD_PHOTO_M:
            out.append(
                {
                    "web_url": a["web_url"],
                    "label": a["label"],
                    "dist_m": round(d, 1),
                    "asset_id": a["asset_id"],
                }
            )
    out.sort(key=lambda r: (r["dist_m"], r["asset_id"]))
    return [{k: r[k] for k in ("web_url", "label", "dist_m")} for r in out]


COURSES = {
    "community": {
        "file": "cloudcroft-community.json",
        "survey": SURVEY / "2026-11-01-community" / "points.geojson",
        "holes": 18,
    },
    "tiki": {
        "file": "byron-ligon-tiki.json",
        "survey": SURVEY / "2026-11-01-tiki" / "points.geojson",
        "holes": 9,
    },
}


def load_survey(path: Path) -> list:
    return json.loads(path.read_text())["features"]


def webp_path(basename: str) -> str:
    return f"data/photos/{Path(basename).stem}.webp"


def point_meta(course_id: str, points: list) -> dict:
    """Stable per-point display metadata, keyed by id(feature).

    name: remark head (before " | "), else first photo remark, else a
    generated survey name in file order. note: remark tail, else photo
    remarks. photo/photos_web: served webp paths (web_assets.py emits
    the files; copy-data.mjs publishes them). field_photos: nearest
    Pixel field photos by GPS (survey-assets.json EXIF), nearest first."""
    field_photos_src = load_field_photos()
    meta = {}
    for idx, f in enumerate(points, start=1):
        p = f["properties"]
        remark = (p.get("remark") or "").strip()
        remarks = [r.strip() for r in p.get("photo_remarks", []) if r and r.strip()]
        head, _, tail = remark.partition("|")
        name = (
            head.strip()
            or (remarks[0] if remarks else "")
            or f"{course_id}-survey-{idx:02d}"
        )
        note = tail.strip() or "; ".join(remarks)
        photos = p.get("photos") or []
        lon, lat = f["geometry"]["coordinates"][:2]
        meta[id(f)] = {
            "survey_id": f"{course_id}-{idx:02d}",
            "name": name,
            "note": note,
            "lat": lat,
            "lon": lon,
            "course": course_id,
            "photo": webp_path(photos[0]) if photos else None,
            "photos_web": [webp_path(b) for b in photos],
            "field_photos": field_matches(lat, lon, field_photos_src),
        }
    return meta


def adapt(course_id: str, spec: dict) -> dict:
    path = REPO / "dataset" / spec["file"]
    data = json.loads(path.read_text())
    points = load_survey(spec["survey"])

    meta = point_meta(course_id, points)
    named = {}  # (kind, hole) -> feature
    unidentified = []
    for f in points:
        remark = f["properties"].get("remark", "")
        m = HOLE_RE.search(remark)
        if m:
            named[(m.group(2), int(m.group(3)))] = f
        else:
            unidentified.append(f)

    old_rows = {r["hole"]: r for r in data.get("holes", [])}
    rows = []
    features = []
    for hole in range(1, spec["holes"] + 1):
        tee = named.get(("tee", hole))
        basket = named.get(("basket", hole))
        old = old_rows.get(hole)
        if tee or basket:
            remark = (tee or basket)["properties"]["remark"]
            pars = [int(x) for x in PAR_RE.findall(remark)]
            dist = DIST_RE.search(remark)
            row: dict = {
                "hole": hole,
                "note": remark.split("|", 1)[-1].strip() if "|" in remark else remark,
                "status": "surveyed",
                "par_source": "tee remark" if tee else "basket remark",
            }
            if pars:
                row["par"] = pars[0]
            if dist:
                row["distance_ft"] = float(dist.group(1))
            rows.append(row)
        elif old and old.get("par") is not None:
            row = dict(old)
            row.setdefault("status", "remote")
            row.setdefault("par_source", "remote listing")
            rows.append(row)
        else:
            # omit par/distance keys entirely: build_holes treats a present
            # key as a real number, and the web renders absence as "—".
            rows.append(
                {
                    "hole": hole,
                    "status": "scaffold",
                    "par_source": "awaiting survey",
                }
            )
        for kind, feat in (("tee", tee), ("basket", basket)):
            if feat:
                features.append(
                    {
                        "type": "Feature",
                        "geometry": feat["geometry"],
                        "properties": {
                            "kind": kind,
                            "hole": hole,
                            **feat["properties"],
                            **meta[id(feat)],
                        },
                    }
                )
        if tee and basket:
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            tee["geometry"]["coordinates"],
                            basket["geometry"]["coordinates"],
                        ],
                    },
                    "properties": {"kind": "fairway", "hole": hole},
                }
            )
    for f in unidentified:
        features.append(
            {
                "type": "Feature",
                "geometry": f["geometry"],
                "properties": {
                    "kind": "unidentified",
                    **f["properties"],
                    **meta[id(f)],
                },
            }
        )

    data["holes"] = rows
    data["features"] = features
    if isinstance(data.get("course"), dict):
        named_n = len(named)
        data["course"]["coordinates_status"] = (
            f"ground GPS 2026-11-01: {len(points)} points located, "
            f"{named_n} named to holes, rest awaiting labels"
        )
    surveyed = sum(1 for r in rows if r["status"] == "surveyed")
    return {"path": path, "data": data, "surveyed": surveyed, "points": len(points)}


def main():
    for course_id, spec in COURSES.items():
        out = adapt(course_id, spec)
        out["path"].write_text(json.dumps(out["data"], indent=1) + "\n")
        print(
            f"{course_id}: {out['path'].name} "
            f"({out['surveyed']} surveyed rows, {out['points']} survey points)"
        )


if __name__ == "__main__":
    sys.exit(main() or 0)
