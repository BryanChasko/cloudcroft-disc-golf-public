#!/usr/bin/env python3
"""Build per-hole GeoJSON from the validated ground survey.

Pipeline (runs after dataset/scripts/validate_survey.py passes):
  1. sample pin elevations from the 1m 3DEP crop via dem_profiles.py
  2. sanity-check the sampler against dataset/anchor-elevations.json
  3. cross-check haversine length vs sign distance (10%) and computed
     azimuth vs note bearing (15 deg)
  4. write features[] (tee/basket points + fairway lines) into both
     course files, fill community holes[], precompute plays_like_ft
     with the v0 model (must match backend/plays-like exactly)

usage:
  build_holes.py [--dem s3://...] [--no-write]
  --no-write runs every check without touching the course files.
"""

import json
import math
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_survey

REPO = Path(__file__).resolve().parents[2]
DATASET = REPO / "dataset"
SURVEY = DATASET / "survey"
DEM_DEFAULT = "s3://bryanchasko.com/disc-golf/data/dem/course-area-1m.tif"

EARTH_RADIUS_FT = 20902231.0  # must match backend/plays-like/src/main.rs
MODEL = "v0-uphill-full-downhill-half"

COURSES = {
    "tiki": {"file": "byron-ligon-tiki.json", "holes": 9},
    "community": {"file": "cloudcroft-community.json", "holes": 18},
}


def haversine_ft(lat1, lon1, lat2, lon2):
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_FT * math.asin(math.sqrt(a))


def azimuth_deg(lat1, lon1, lat2, lon2):
    d_lon = math.radians(lon2 - lon1)
    y = math.sin(d_lon) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(
        math.radians(lat2)
    ) - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(
        d_lon
    )
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def plays_like_ft(horizontal_ft, elev_change_ft):
    if elev_change_ft >= 0:
        return horizontal_ft + elev_change_ft
    return horizontal_ft + elev_change_ft * 0.5


def sample_dem(points, dem):
    """Sample elevations via dem_profiles.py; returns {name: (ele_m, ele_ft)}."""
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        pts = Path(td) / "points.json"
        out = Path(td) / "elev.json"
        pts.write_text(json.dumps(points))
        r = subprocess.run(
            [
                sys.executable,
                str(Path(__file__).parent / "dem_profiles.py"),
                "--dem",
                dem,
                "--points",
                str(pts),
                "--out",
                str(out),
            ],
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            raise RuntimeError(f"dem_profiles failed: {r.stderr[-500:]}")
        rows = json.loads(out.read_text())
    eles = {}
    for row in rows:
        if row["ele_m"] <= -1000 or math.isnan(row["ele_m"]):
            raise ValueError(f"nodata elevation for {row['name']}")
        eles[row["name"]] = (row["ele_m"], row["ele_ft"])
    return eles


def main() -> int:
    dem = DEM_DEFAULT
    write = True
    args = sys.argv[1:]
    if "--dem" in args:
        dem = args[args.index("--dem") + 1]
    if "--no-write" in args:
        write = False

    # 1. validate first; abort on any error.
    errors, warnings = [], []
    pins = {}
    for course, spec in validate_survey.EXPECTED.items():
        for p in validate_survey.validate_course(course, spec, errors, warnings):
            pins[p["name"]] = p
    for w in warnings:
        print(f"warning: {w}")
    if errors:
        for e in errors[:20]:
            print(f"error: {e}")
        print("survey invalid — fix and rerun")
        return 1

    # 2. anchor check: sampler must reproduce anchor-elevations.json.
    anchors = json.loads((DATASET / "anchors.json").read_text())
    anchor_ref = {
        r["name"]: r["ele_ft"]
        for r in json.loads((DATASET / "anchor-elevations.json").read_text())
    }
    try:
        anchor_eles = sample_dem(anchors, dem)
    except Exception as e:
        print(f"error: dem sampling failed: {e}")
        return 1
    for a in anchors:
        got = anchor_eles[a["name"]][1]
        want = anchor_ref[a["name"]]
        if abs(got - want) > 0.5:
            print(
                f"error: anchor {a['name']} sampled {got} ft, "
                f"reference {want} ft — dem suspect"
            )
            return 1
    print("anchors reproduce within 0.5 ft")

    # 3. sample all pins.
    try:
        eles = sample_dem(
            [
                {"name": n, "lon": p["lon"], "lat": p["lat"]}
                for n, p in pins.items()
            ],
            dem,
        )
    except Exception as e:
        print(f"error: pin sampling failed: {e}")
        return 1

    # 4. build + cross-check + write per course.
    for course, spec in COURSES.items():
        path = DATASET / spec["file"]
        data = json.loads(path.read_text())
        features = []
        hole_rows = {h["hole"]: h for h in data.get("holes", [])}
        bad = 0
        for n in range(1, spec["holes"] + 1):
            tee = pins[f"{course}-tee-{n}"]
            basket = pins[f"{course}-basket-{n}"]
            ele_tee = eles[tee["name"]][1]
            ele_basket = eles[basket["name"]][1]
            horiz = haversine_ft(tee["lat"], tee["lon"], basket["lat"], basket["lon"])
            az = azimuth_deg(tee["lat"], tee["lon"], basket["lat"], basket["lon"])
            elev_change = ele_basket - ele_tee
            plays = plays_like_ft(horiz, elev_change)
            row = hole_rows.get(n, {"hole": n})
            # Fill community rows from tee-note transcription.
            if "par" not in row and "par" in tee:
                row["par"] = tee["par"]
            if "distance_ft" not in row and "distance_ft" in tee:
                row["distance_ft"] = tee["distance_ft"]
            row["ele_tee_ft"] = round(ele_tee, 1)
            row["ele_basket_ft"] = round(ele_basket, 1)
            row["plays_like_ft"] = round(plays, 1)
            row["plays_like_model"] = MODEL
            hole_rows[n] = row
            # Cross-checks against the sign transcription.
            sign_dist = row.get("distance_ft")
            if sign_dist and abs(horiz - sign_dist) / sign_dist > 0.10:
                print(
                    f"error: {course} hole {n}: gps length {horiz:.0f} ft "
                    f"vs sign {sign_dist} ft (>10%)"
                )
                bad += 1
            brg = tee.get("bearing_deg")
            if brg is not None:
                delta = abs((az - brg + 180) % 360 - 180)
                if delta > 15:
                    print(
                        f"error: {course} hole {n}: computed azimuth "
                        f"{az:.0f} vs note brg {brg} (>15 deg)"
                    )
                    bad += 1
            base = {"hole": n, "fix": "ground-gps"}
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [tee["lon"], tee["lat"]],
                    },
                    "properties": {
                        **base,
                        "kind": "tee",
                        "ele_ft": round(ele_tee, 1),
                    },
                }
            )
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [basket["lon"], basket["lat"]],
                    },
                    "properties": {
                        **base,
                        "kind": "basket",
                        "ele_ft": round(ele_basket, 1),
                    },
                }
            )
            features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [tee["lon"], tee["lat"]],
                            [basket["lon"], basket["lat"]],
                        ],
                    },
                    "properties": {
                        **base,
                        "kind": "fairway",
                        "length_ft": round(horiz, 1),
                        "plays_like_ft": round(plays, 1),
                    },
                }
            )
        if bad:
            print(f"{course}: {bad} cross-check failure(s) — aborting")
            return 1
        data["holes"] = [hole_rows[n] for n in range(1, spec["holes"] + 1)]
        if course == "community":
            data["course"]["par"] = sum(h["par"] for h in data["holes"])
            data["course"]["length_ft"] = round(
                sum(h["distance_ft"] for h in data["holes"]), 0
            )
        data["features"] = features
        if write:
            path.write_text(json.dumps(data, indent=2) + "\n")
        print(
            f"{course}: {len(features)} features, "
            f"{len(data['holes'])} holes {'written' if write else 'checked'}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
