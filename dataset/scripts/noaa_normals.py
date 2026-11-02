#!/usr/bin/env python3
"""Fetch NOAA 1991-2020 monthly climate normals for one station.

Reads the per-station CSV straight from the Registry of Open Data on AWS
bucket (noaa-normals-pds, us-east-1, public) and writes a small JSON with
the twelve monthly normals a player-facing page needs: average / max / min
temperature (deg F), precipitation (in), snowfall (in).

usage:
  noaa_normals.py --station USC00291931 --out ../climate-normals-cloudcroft.json

Source: NOAA U.S. Climate Normals (1991-2020), National Centers for
Environmental Information, via NOAA Open Data Dissemination (NODD).
Registry entry: https://registry.opendata.aws/noaa-climate-normals/
NOAA requests attribution; do not state or imply NOAA endorsement.
"""

import argparse
import csv
import io
import json
import sys
import urllib.request

BUCKET_URL = "https://noaa-normals-pds.s3.amazonaws.com/normals-monthly/1991-2020/access"
KEEP = {
    "MLY-TAVG-NORMAL": "tavg_f",
    "MLY-TMAX-NORMAL": "tmax_f",
    "MLY-TMIN-NORMAL": "tmin_f",
    "MLY-PRCP-NORMAL": "prcp_in",
    "MLY-SNOW-NORMAL": "snow_in",
}
MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]


def _num(raw: str):
    raw = (raw or "").strip()
    return float(raw) if raw not in ("", "-9999") else None


def parse_monthly(csv_text: str) -> dict:
    rows = list(csv.DictReader(io.StringIO(csv_text)))
    if len(rows) != 12:
        raise ValueError(f"expected 12 monthly rows, got {len(rows)}")
    first = rows[0]
    months = []
    for row in sorted(rows, key=lambda r: r["month"]):
        m = {"month": MONTHS[int(row["month"]) - 1]}
        for src, dst in KEEP.items():
            if src not in row:
                raise ValueError(f"station CSV missing {src}")
            m[dst] = _num(row[src])
        months.append(m)
    return {
        "station": {
            "id": first["STATION"].strip(),
            "name": first["NAME"].strip(),
            "lat": float(first["LATITUDE"]),
            "lon": float(first["LONGITUDE"]),
            "elevation_m": float(first["ELEVATION"]),
        },
        "months": months,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--station", default="USC00291931", help="GHCN station id")
    ap.add_argument("--out", required=True, help="output json path")
    args = ap.parse_args()

    url = f"{BUCKET_URL}/{args.station}.csv"
    with urllib.request.urlopen(url, timeout=60) as r:
        parsed = parse_monthly(r.read().decode())
    parsed["source"] = {
        "dataset": "NOAA U.S. Climate Normals, 1991-2020 (monthly)",
        "registry": "https://registry.opendata.aws/noaa-climate-normals/",
        "bucket": "arn:aws:s3:::noaa-normals-pds (us-east-1)",
        "url": url,
        "units": "temperatures deg F; precipitation and snowfall inches",
        "license": "NOAA NODD open data; attribution requested, no endorsement implied",
        "attribution": "NOAA National Centers for Environmental Information, U.S. Climate Normals 1991-2020",
    }
    json.dump(parsed, open(args.out, "w"), indent=2)
    print(f"{parsed['station']['id']} {parsed['station']['name']}: 12 months -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
