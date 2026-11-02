"""Tests for build_media.py - media pipeline build and validation."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def test_has_gps_detection():
    """Verify GPS detection works with exif keys."""
    from build_media import has_gps
    assert has_gps({34853: 947}) is True
    assert has_gps({}) is False
    assert has_gps(None) is False


def test_has_location_detection():
    """Verify location detection."""
    from build_media import has_location
    assert has_location({34853: 947}) is True
    assert has_location({}) is False


def test_sha256_short():
    """Verify hash truncation."""
    import build_media
    test_file = Path("/tmp/test_hash.txt")
    test_file.write_text("test")
    h = build_media.sha256_short(test_file)
    assert len(h) == 8
    test_file.unlink()


def test_derive_alt_from_label():
    """Verify alt text derivation."""
    from build_media import derive_alt_from_label
    assert derive_alt_from_label("kiosk close-up, course map") == "Close-up photograph: kiosk close-up, course map"
    assert derive_alt_from_label("tee-1 sign on stump with arrow") == "Course signage: tee-1 sign on stump with arrow"
    assert derive_alt_from_label("Basket 1 close-up with flag") == "Close-up photograph: Basket 1 close-up with flag"