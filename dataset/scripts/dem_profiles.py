#!/usr/bin/env python3
"""Sample 3DEP 1m DEM elevations for named lon/lat points.

Reads the DEM straight from S3 (/vsis3/) — no local copy needed.
Auth: standard AWS env creds (use `aws configure export-credentials`).

usage:
  dem_profiles.py --dem s3://bucket/key.tif --points points.json --out elevations.json

points.json: [{"name": "tiki-anchor", "lon": -105.74, "lat": 32.96}, ...]
out: [{"name": ..., "lon": ..., "lat": ..., "ele_m": ..., "ele_ft": ...}, ...]
"""

import argparse
import json
import sys

import rasterio
from rasterio.warp import transform

M_TO_FT = 3.28084


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dem", required=True, help="s3:// or local path to DEM GeoTIFF")
    ap.add_argument("--points", required=True, help="json list of {name, lon, lat}")
    ap.add_argument("--out", required=True, help="output json path")
    args = ap.parse_args()

    points = json.load(open(args.points))
    dem_path = args.dem
    if dem_path.startswith("s3://"):
        dem_path = "/vsis3/" + dem_path[len("s3://") :]

    with rasterio.open(dem_path) as dem:
        lons = [p["lon"] for p in points]
        lats = [p["lat"] for p in points]
        xs, ys = transform("EPSG:4326", dem.crs, lons, lats)
        samples = list(dem.sample(zip(xs, ys)))

    out = []
    for p, s in zip(points, samples):
        ele_m = float(s[0])
        out.append(
            {
                "name": p["name"],
                "lon": p["lon"],
                "lat": p["lat"],
                "ele_m": round(ele_m, 2),
                "ele_ft": round(ele_m * M_TO_FT, 1),
            }
        )
    json.dump(out, open(args.out, "w"), indent=2)
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
