"""Tests for noaa_normals.py (parser only; network fetch is exercised live)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import noaa_normals

HEADER = (
    '"STATION","LATITUDE","LONGITUDE","ELEVATION","NAME","month",'
    '"MLY-TAVG-NORMAL","MLY-TMAX-NORMAL","MLY-TMIN-NORMAL",'
    '"MLY-PRCP-NORMAL","MLY-SNOW-NORMAL"\n'
)


def _csv(months=12):
    lines = [HEADER]
    for m in range(1, months + 1):
        lines.append(
            f'"USC00000000"," 32.9544","-105.7353","2645.4","FIXTURE, NM US",'
            f'"{m:02d}","  30.7","42.4","19.0","1.59","13.1"\n'
        )
    return "".join(lines)


def test_parse_monthly():
    out = noaa_normals.parse_monthly(_csv())
    assert out["station"] == {
        "id": "USC00000000",
        "name": "FIXTURE, NM US",
        "lat": 32.9544,
        "lon": -105.7353,
        "elevation_m": 2645.4,
    }
    assert [m["month"] for m in out["months"]] == noaa_normals.MONTHS
    assert out["months"][0]["tavg_f"] == 30.7
    assert out["months"][0]["snow_in"] == 13.1


def test_parse_rejects_short_csv():
    with pytest.raises(ValueError, match="12 monthly rows"):
        noaa_normals.parse_monthly(_csv(months=3))


def test_num_handles_missing():
    assert noaa_normals._num("-9999") is None
    assert noaa_normals._num("") is None
    assert noaa_normals._num(" 1.5 ") == 1.5
