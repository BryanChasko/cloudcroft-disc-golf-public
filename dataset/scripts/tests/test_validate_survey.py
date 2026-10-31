"""Tests for validate_survey.py using guide-conformant fixtures."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import validate_survey


def make_points(course, holes, note_fn=None):
    feats = []
    for n in range(1, holes + 1):
        for kind in ("tee", "basket"):
            note = ""
            if kind == "tee" and note_fn:
                note = note_fn(n)
            feats.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [-105.74, 32.96],
                    },
                    "properties": {
                        "name": f"{course}-{kind}-{n}",
                        "note": note,
                    },
                }
            )
    return {"type": "FeatureCollection", "features": feats}


def write(path, obj):
    path.write_text(json.dumps(obj))


def test_valid_tiki(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_survey, "SURVEY", tmp_path)
    write(
        tmp_path / "tiki.geojson",
        make_points("tiki", 9, lambda n: f"par 3, {100 + n} ft, brg {200 + n}"),
    )
    write(tmp_path / "community.geojson", make_points("community", 18))
    # community tee notes missing -> blocking errors; fix one course at a time
    errors, warnings = [], []
    pts = validate_survey.validate_course(
        "tiki", validate_survey.EXPECTED["tiki"], errors, warnings
    )
    assert not errors
    assert len(pts) == 18


def test_community_missing_note_blocks(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_survey, "SURVEY", tmp_path)
    write(tmp_path / "community.geojson", make_points("community", 18))
    errors, warnings = [], []
    validate_survey.validate_course(
        "community", validate_survey.EXPECTED["community"], errors, warnings
    )
    assert any("BLOCKING" in e for e in errors)


def test_missing_point_and_bad_name(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_survey, "SURVEY", tmp_path)
    fc = make_points("tiki", 9, lambda n: "par 3, 100 ft, brg 200")
    fc["features"].pop()  # drop tiki-basket-9
    fc["features"][0]["properties"]["name"] = "nope"
    write(tmp_path / "tiki.geojson", fc)
    errors, warnings = [], []
    validate_survey.validate_course(
        "tiki", validate_survey.EXPECTED["tiki"], errors, warnings
    )
    assert any("need exactly 18" in e for e in errors)
    assert any("missing tiki-basket-9" in e for e in errors)
    assert any("must look like" in e for e in errors)


def test_out_of_bbox(tmp_path, monkeypatch):
    monkeypatch.setattr(validate_survey, "SURVEY", tmp_path)
    fc = make_points("tiki", 9, lambda n: "par 3, 100 ft, brg 200")
    fc["features"][0]["geometry"]["coordinates"] = [-106.0, 33.0]
    write(tmp_path / "tiki.geojson", fc)
    errors, warnings = [], []
    validate_survey.validate_course(
        "tiki", validate_survey.EXPECTED["tiki"], errors, warnings
    )
    assert any("outside course bbox" in e for e in errors)


def test_parse_note_variants():
    assert validate_survey.parse_note("par 3, 134 ft, brg 215") == {
        "par": 3,
        "distance_ft": 134.0,
        "bearing_deg": 215,
    }
    assert validate_survey.parse_note("Par4 320ft brg7") == {
        "par": 4,
        "distance_ft": 320.0,
        "bearing_deg": 7,
    }
    assert validate_survey.parse_note("muddy, fence left") == {}
