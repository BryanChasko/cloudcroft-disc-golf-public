"""Tests for build_holes.py (formula parity + pipeline on fixtures)."""

import json
import math
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_holes


def test_haversine_parity():
    # Course anchors: ~0.6 km apart straight-line (walking route is 1.21 km).
    h = build_holes.haversine_ft(32.95787, -105.73887, 32.9632, -105.73996)
    assert 1900 < h < 2100


def test_plays_like_branches():
    assert build_holes.plays_like_ft(100, 10) == 110
    assert build_holes.plays_like_ft(100, -10) == 95
    assert build_holes.plays_like_ft(100, 0) == 100


def test_azimuth_cardinals():
    assert build_holes.azimuth_deg(32.0, -105.0, 33.0, -105.0) == 0
    assert abs(build_holes.azimuth_deg(32.0, -105.0, 32.0, -104.0) - 90) < 0.5


def _survey_fixture(tmp_path, tiki_distances):
    """Write tiki+community survey files with self-consistent geometry."""
    survey = tmp_path / "survey"
    survey.mkdir()
    for course, holes in (("tiki", 9), ("community", 18)):
        feats = []
        for n in range(1, holes + 1):
            # Tee and basket spaced per the hole's published distance on a
            # due-east line; bearing 90.
            dist = tiki_distances[n - 1] if course == "tiki" else 100
            lon0 = -105.74
            lat0 = 32.955 + n * 0.0001
            dlon = dist / (math.cos(math.radians(lat0)) * 364567.0)
            for kind, lon in (("tee", lon0), ("basket", lon0 + dlon)):
                note = (
                    f"par 3, {dist} ft, brg 90" if kind == "tee" else "clear"
                )
                feats.append(
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [lon, lat0],
                        },
                        "properties": {
                            "name": f"{course}-{kind}-{n}",
                            "note": note,
                        },
                    }
                )
        (survey / f"{course}.geojson").write_text(
            json.dumps({"type": "FeatureCollection", "features": feats})
        )
    return survey


def test_full_pipeline_no_write(tmp_path, monkeypatch):
    import validate_survey

    repo = Path(build_holes.__file__).resolve().parents[2]
    tiki = json.loads((repo / "dataset" / "byron-ligon-tiki.json").read_text())
    survey = _survey_fixture(
        tmp_path, [h["distance_ft"] for h in tiki["holes"]]
    )
    monkeypatch.setattr(validate_survey, "SURVEY", survey)
    # Fake the DEM sampler: flat 8600 ft everywhere.
    monkeypatch.setattr(
        build_holes,
        "sample_dem",
        lambda points, dem: {p["name"]: (2621.3, 8600.0) for p in points},
    )
    # Fake anchors to match the flat DEM.
    monkeypatch.setattr(
        build_holes, "DATASET", tmp_path / "dataset-stub"
    )
    stub = tmp_path / "dataset-stub"
    stub.mkdir()
    shutil.copy(repo / "dataset" / "anchors.json", stub)
    shutil.copy(repo / "dataset" / "anchor-elevations.json", stub)
    shutil.copy(repo / "dataset" / "byron-ligon-tiki.json", stub)
    shutil.copy(repo / "dataset" / "cloudcroft-community.json", stub)
    anchor_ref = json.loads((stub / "anchor-elevations.json").read_text())
    for r in anchor_ref:
        r["ele_ft"] = 8600.0
    (stub / "anchor-elevations.json").write_text(json.dumps(anchor_ref))
    monkeypatch.setattr(sys, "argv", ["build_holes.py", "--no-write"])
    assert build_holes.main() == 0
    # --no-write must not touch the stub course files.
    tiki = json.loads((stub / "byron-ligon-tiki.json").read_text())
    assert tiki["features"] == []
