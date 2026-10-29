#!/usr/bin/env python3
"""Convert an Overpass API JSON extract to GeoJSON trail features.

Keeps ways tagged highway=path/footway/track/cycleway with their names,
plus leisure=park and amenity=parking nodes. Drops node soup.

usage: osm_to_geojson.py --in osm.json --out trails.geojson
"""

import argparse
import json
import sys

KEEP_HIGHWAY = {"path", "footway", "track", "cycleway", "bridleway", "steps"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    data = json.load(open(args.inp))
    nodes = {}
    for e in data.get("elements", []):
        if e["type"] == "node":
            nodes[e["id"]] = (e["lon"], e["lat"])

    features = []
    for e in data.get("elements", []):
        tags = e.get("tags", {})
        if e["type"] == "way" and tags.get("highway") in KEEP_HIGHWAY:
            coords = [nodes[n] for n in e.get("nodes", []) if n in nodes]
            if len(coords) < 2:
                continue
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {
                        "kind": "trail",
                        "name": tags.get("name", "unnamed trail"),
                        "highway": tags["highway"],
                        "surface": tags.get("surface", ""),
                    },
                }
            )
        elif e["type"] == "node" and (
            tags.get("leisure") == "park" or tags.get("amenity") == "parking"
        ):
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [e["lon"], e["lat"]]},
                    "properties": {
                        "kind": tags.get("leisure") == "park" and "park" or "parking",
                        "name": tags.get("name", ""),
                    },
                }
            )

    json.dump({"type": "FeatureCollection", "features": features}, open(args.out, "w"))
    kinds = {}
    for f in features:
        kinds[f["properties"]["kind"]] = kinds.get(f["properties"]["kind"], 0) + 1
    print(f"{len(features)} features -> {args.out} {kinds}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
