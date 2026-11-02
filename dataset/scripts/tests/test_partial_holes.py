"""partial_holes enrichment + survey-assets contract (real inputs, read-only)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import partial_holes  # noqa: E402

REPO = Path(__file__).resolve().parents[3]


def test_every_point_enriched():
    total_points = total_photo = 0
    for course_id, spec in partial_holes.COURSES.items():
        out = partial_holes.adapt(course_id, spec)
        pts = [f for f in out["data"]["features"] if f["geometry"]["type"] == "Point"]
        assert pts, course_id
        for f in pts:
            p = f["properties"]
            assert p["survey_id"].startswith(f"{course_id}-")
            assert p["name"]
            assert p["course"] == course_id
            lon, lat = f["geometry"]["coordinates"][:2]
            assert p["lon"] == lon and p["lat"] == lat
            assert "photo" in p and isinstance(p["photos_web"], list)
            if p["photo"]:
                assert p["photo"].endswith(".webp")
                total_photo += 1
        total_points += len(pts)
    assert total_points == 27
    assert total_photo == 21


def test_survey_assets_index():
    data = json.loads((REPO / "dataset" / "survey-assets.json").read_text())
    assert data["counts"] == {"photo": 15, "pano": 5, "screenshot": 20}
    for a in data["assets"]:
        assert a["web_url"].endswith(".webp")
        assert a["label"]
        if a["kind"] in ("photo", "pano"):
            assert a["lat"] is not None and a["lon"] is not None
        if a["kind"] == "pano":
            assert a["pano_id"] and a["course"] in ("community", "tiki")


def test_webp_derivatives_exist():
    photos = list((REPO / "dataset" / "web-assets" / "photos").glob("*.webp"))
    shots = list((REPO / "dataset" / "web-assets" / "screenshots").glob("*.webp"))
    assert len(photos) == 36  # 21 attached + 15 Pixel
    assert len(shots) == 20
