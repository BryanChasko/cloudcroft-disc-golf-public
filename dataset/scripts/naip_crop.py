#!/usr/bin/env python3
"""Crop a course window out of NAIP RGB imagery into a web-ready JPEG.

Reads the source tile from S3 (/vsis3/), writes a JPEG crop + sidecar JSON
with the bbox. Output is sized for map overlay use, not archival.

usage:
  naip_crop.py --src s3://bucket/tile.tif --bbox minlon,minlat,maxlon,maxlat \\
      --out crop.jpg --max-pixels 2400
"""

import argparse
import json
import sys

import rasterio
from rasterio import windows
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--bbox", required=True, help="minlon,minlat,maxlon,maxlat")
    ap.add_argument("--out", required=True, help="output JPEG path")
    ap.add_argument("--max-pixels", type=int, default=2400)
    args = ap.parse_args()

    minlon, minlat, maxlon, maxlat = (float(v) for v in args.bbox.split(","))
    src = args.src
    if src.startswith("s3://"):
        src = "/vsis3/" + src[len("s3://") :]

    with rasterio.open(src) as tif:
        left, bottom, right, top = transform_bounds(
            "EPSG:4326", tif.crs, minlon, minlat, maxlon, maxlat
        )
        win = windows.from_bounds(left, bottom, right, top, tif.transform)
        scale = max(win.width, win.height) / args.max_pixels
        out_w, out_h = int(win.width / max(scale, 1)), int(win.height / max(scale, 1))
        data = tif.read(
            [1, 2, 3],
            window=win,
            out_shape=(3, out_h, out_w),
            resampling=Resampling.bilinear,
        )
        profile = {
            "driver": "JPEG",
            "width": out_w,
            "height": out_h,
            "count": 3,
            "dtype": data.dtype,
        }
        with rasterio.open(args.out, "w", **profile) as dst:
            dst.write(data)

    json.dump(
        {"bbox": [minlon, minlat, maxlon, maxlat], "width": out_w, "height": out_h},
        open(args.out + ".json", "w"),
        indent=2,
    )
    print(f"{out_w}x{out_h} -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
