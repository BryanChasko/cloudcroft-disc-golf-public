#!/usr/bin/env python3
"""Crop a DEM window for the course area + a downsampled mesh grid.

Reads the source DEM from S3 (/vsis3/), writes:
  1. a full-res crop GeoTIFF (upload to S3 as the archive crop)
  2. a downsampled grid JSON (meters, row-major) for the three.js terrain mesh

usage:
  dem_crop.py --dem s3://bucket/key.tif --bbox minlon,minlat,maxlon,maxlat \\
      --crop crop.tif --grid grid.json --grid-size 200
"""

import argparse
import json
import sys

import numpy as np
import rasterio
from rasterio import windows
from rasterio.warp import transform_bounds


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dem", required=True)
    ap.add_argument("--bbox", required=True, help="minlon,minlat,maxlon,maxlat")
    ap.add_argument("--crop", required=True, help="output crop GeoTIFF path")
    ap.add_argument("--grid", required=True, help="output mesh grid JSON path")
    ap.add_argument("--grid-size", type=int, default=200)
    args = ap.parse_args()

    minlon, minlat, maxlon, maxlat = (float(v) for v in args.bbox.split(","))
    dem_path = args.dem
    if dem_path.startswith("s3://"):
        dem_path = "/vsis3/" + dem_path[len("s3://") :]

    with rasterio.open(dem_path) as dem:
        left, bottom, right, top = transform_bounds(
            "EPSG:4326", dem.crs, minlon, minlat, maxlon, maxlat
        )
        win = windows.from_bounds(left, bottom, right, top, dem.transform).round_offsets()
        win = win.round_lengths()
        data = dem.read(1, window=win)
        profile = dem.profile.copy()
        profile.update(
            width=win.width, height=win.height, transform=windows.transform(win, dem.transform)
        )
        with rasterio.open(args.crop, "w", **profile) as dst:
            dst.write(data, 1)

        # downsample to grid_size x grid_size by area averaging
        h, w = data.shape
        n = args.grid_size
        ys = (np.arange(n) * h / n).astype(int)
        xs = (np.arange(n) * w / n).astype(int)
        grid = data[ys[:, None], xs[None, :]].astype(float).round(2).tolist()

    json.dump(
        {
            "bbox": [minlon, minlat, maxlon, maxlat],
            "size": n,
            "units": "meters",
            "crs_note": "grid row 0 = north edge; sample with bilinear interp",
            "elev": grid,
        },
        open(args.grid, "w"),
    )
    print(f"crop {win.width}x{win.height} -> {args.crop}; grid {n}x{n} -> {args.grid}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
