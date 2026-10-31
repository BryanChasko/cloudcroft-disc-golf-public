"""Tests for load_geofences.py (payload shape via dry-run, no AWS)."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import load_geofences


def _stub_course(path, course, holes):
    feats = []
    for n in range(1, holes + 1):
        for kind in ("tee", "basket"):
            feats.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [-105.74, 32.96],
                    },
                    "properties": {
                        "hole": n,
                        "kind": kind,
                        "fix": "ground-gps",
                    },
                }
            )
    path.write_text(json.dumps({"features": feats}))


def test_dry_run_54(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(load_geofences, "DATASET", tmp_path)
    _stub_course(tmp_path / "byron-ligon-tiki.json", "tiki", 9)
    _stub_course(tmp_path / "cloudcroft-community.json", "community", 18)
    monkeypatch.setattr(sys, "argv", ["load_geofences.py", "--dry-run"])
    assert load_geofences.main() == 0
    out = capsys.readouterr().out
    assert "54 geofences" in out
    assert '"Radius": 10.0' in out


def test_blocks_without_pins(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(load_geofences, "DATASET", tmp_path)
    (tmp_path / "byron-ligon-tiki.json").write_text('{"features": []}')
    (tmp_path / "cloudcroft-community.json").write_text('{"features": []}')
    monkeypatch.setattr(sys, "argv", ["load_geofences.py", "--dry-run"])
    assert load_geofences.main() == 1
    assert "need 54" in capsys.readouterr().out
