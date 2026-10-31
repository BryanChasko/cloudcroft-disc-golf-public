#!/usr/bin/env python3
"""Validate the ground-survey drop before ingest.

Reads dataset/survey/tiki.geojson + community.geojson (SW Maps point
exports per docs/ground-survey-guide.md) and fails loud on anything the
hole builder cannot use. Exit 0 = safe to ingest, nonzero = fix first.

Checks per course file:
  - valid FeatureCollection of Points (lon, lat order)
  - exact point count (tiki 18, community 36)
  - names match {course}-(tee|basket)-N, unique, complete 1..holes
  - every point inside the course bbox
  - note field carries par + distance + bearing (community: blocking;
    tiki: warning, pars are known remotely)

GPX walking tracks (*-track.gpx) are bonus material: warned when absent,
never blocking.
"""

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SURVEY = REPO / "dataset" / "survey"

# Course bbox (lon/lat): matches course-area-grid coverage.
BBOX = (-105.748, 32.953, -105.731, 32.968)

EXPECTED = {
    "tiki": {"file": "tiki.geojson", "holes": 9},
    "community": {"file": "community.geojson", "holes": 18},
}

NAME_RE = re.compile(r"^(tiki|community)-(tee|basket)-(\d+)$")
PAR_RE = re.compile(r"par\s*(\d+)", re.IGNORECASE)
DIST_RE = re.compile(r"(\d+(?:\.\d+)?)\s*ft", re.IGNORECASE)
BRG_RE = re.compile(r"brg\s*(\d+)", re.IGNORECASE)


def parse_note(note: str) -> dict:
    """Pull par / distance_ft / bearing_deg out of a survey note string."""
    out: dict = {}
    m = PAR_RE.search(note or "")
    if m:
        out["par"] = int(m.group(1))
    m = DIST_RE.search(note or "")
    if m:
        out["distance_ft"] = float(m.group(1))
    m = BRG_RE.search(note or "")
    if m:
        out["bearing_deg"] = int(m.group(1))
    return out


def validate_course(course: str, spec: dict, errors: list, warnings: list) -> list:
    path = SURVEY / spec["file"]
    if not path.exists():
        errors.append(f"{spec['file']}: file missing (expected {path})")
        return []
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        errors.append(f"{spec['file']}: invalid JSON: {e}")
        return []
    if data.get("type") != "FeatureCollection" or not isinstance(
        data.get("features"), list
    ):
        errors.append(f"{spec['file']}: not a GeoJSON FeatureCollection")
        return []
    feats = data["features"]
    want = spec["holes"] * 2
    if len(feats) != want:
        errors.append(
            f"{spec['file']}: has {len(feats)} points, need exactly {want} "
            f"({spec['holes']} tees + {spec['holes']} baskets)"
        )
    seen: dict = {}
    points = []
    for i, f in enumerate(feats):
        where = f"{spec['file']} feature[{i}]"
        geom = (f or {}).get("geometry") or {}
        props = (f or {}).get("properties") or {}
        if geom.get("type") != "Point":
            errors.append(f"{where}: geometry must be Point")
            continue
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            errors.append(f"{where}: missing coordinates")
            continue
        lon, lat = float(coords[0]), float(coords[1])
        if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
            errors.append(f"{where}: ({lon},{lat}) outside course bbox")
        name = str(props.get("name") or "")
        m = NAME_RE.match(name)
        if not m or m.group(1) != course:
            errors.append(
                f"{where}: name {name!r} must look like "
                f"{course}-(tee|basket)-N"
            )
            continue
        if name in seen:
            errors.append(f"{where}: duplicate name {name!r}")
            continue
        seen[name] = True
        n = int(m.group(3))
        if not (1 <= n <= spec["holes"]):
            errors.append(f"{where}: hole {n} out of 1..{spec['holes']}")
        note = str(props.get("note") or "")
        parsed = parse_note(note)
        # Tee notes should carry the full trio; basket notes carry walking
        # observations (free text, no format enforced).
        if m.group(2) == "tee":
            missing = {"par", "distance_ft", "bearing_deg"} - set(parsed)
            if missing:
                msg = f"{where} ({name}): tee note missing {sorted(missing)}"
                if course == "community":
                    errors.append(msg + " — BLOCKING, no remote par source")
                else:
                    warnings.append(msg + " (tiki pars known remotely)")
        points.append(
            {
                "name": name,
                "kind": m.group(2),
                "hole": n,
                "lon": lon,
                "lat": lat,
                "note": note,
                **parsed,
            }
        )
    # Completeness: every tee-N + basket-N present.
    for n in range(1, spec["holes"] + 1):
        for kind in ("tee", "basket"):
            if f"{course}-{kind}-{n}" not in seen:
                errors.append(f"{spec['file']}: missing {course}-{kind}-{n}")
    return points


def main() -> int:
    errors: list = []
    warnings: list = []
    if not SURVEY.is_dir():
        print(f"error: {SURVEY} does not exist — no survey drop yet")
        return 1
    total = 0
    for course, spec in EXPECTED.items():
        total += len(validate_course(course, spec, errors, warnings))
    for track in ("tiki-track.gpx", "community-track.gpx"):
        if not (SURVEY / track).exists():
            warnings.append(f"{track}: walking track absent (bonus only)")
    for w in warnings:
        print(f"warning: {w}")
    for e in errors:
        print(f"error: {e}")
    if errors:
        print(f"survey INVALID: {len(errors)} error(s), {total} points read")
        return 1
    print(f"survey valid: {total} points, {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
