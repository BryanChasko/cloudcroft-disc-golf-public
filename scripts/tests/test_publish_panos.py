"""Tests for publish_panos.py (scan + manifest, no AWS)."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import publish_panos

PIL = pytest.importorskip("PIL.Image", reason="pillow required")


def _jpg(path, w, h):
    PIL.new("RGB", (w, h)).save(path, "JPEG")


def test_scan_valid_and_manifest(tmp_path):
    _jpg(tmp_path / "pano-tiki-tee-1.jpg", 2048, 1024)
    _jpg(tmp_path / "pano-tiki-vista.jpg", 2000, 1000)
    entries, errors = publish_panos.scan(tmp_path)
    assert not errors
    assert len(entries) == 2
    assert entries[0]["hole"] == 1
    assert entries[0]["url"].endswith("pano-tiki-tee-1.jpg")
    manifest = publish_panos.publish(entries, dry_run=True)
    assert len(manifest) == 2


def test_scan_rejects(tmp_path):
    _jpg(tmp_path / "pano-tiki-tee-1.jpg", 2048, 1024)
    _jpg(tmp_path / "pano-tiki-tee-99.jpg", 2048, 1024)  # out of range
    _jpg(tmp_path / "pano-community-tee-1.jpg", 1000, 1000)  # not 2:1
    (tmp_path / "pano-nope.jpg").write_bytes(b"junk")  # bad name
    entries, errors = publish_panos.scan(tmp_path)
    assert len(entries) == 1
    assert len(errors) == 3


def test_main_no_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "argv", ["publish_panos.py", str(tmp_path / "x")])
    assert publish_panos.main() == 1
