#!/usr/bin/env python3
"""Load per-hole geofences from the built course GeoJSON.

Reads tee/basket points from dataset/byron-ligon-tiki.json +
dataset/cloudcroft-community.json (features[] written by build_holes.py)
and upserts one circle geofence per pin into the
cloudcroft-disc-golf-holes collection.

Auth: aerospaceug-admin profile. Geofence writes are NOT in the Cognito
guest policy — this runs with admin creds, never from web/android.

usage:
  load-geofences.py [--radius-m 10] [--dry-run]

Acceptance: ListGeofences returns 54; BatchEvaluateGeofences at each
pin coordinate returns its own geofence id.
"""

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DATASET = REPO / "dataset"

COLLECTION = "cloudcroft-disc-golf-holes"
REGION = "us-east-1"
PROFILE = "aerospaceug-admin"

COURSE_FILES = ["byron-ligon-tiki.json", "cloudcroft-community.json"]


def collect_pins():
    """Gather (geofence_id, lon, lat) for every tee/basket feature."""
    pins = []
    for fname in COURSE_FILES:
        data = json.loads((DATASET / fname).read_text())
        for f in data.get("features", []):
            props = f.get("properties", {})
            if props.get("kind") not in ("tee", "basket"):
                continue
            if props.get("fix") != "ground-gps":
                continue
            lon, lat = f["geometry"]["coordinates"][:2]
            course = "tiki" if "tiki" in fname else "community"
            pins.append((f"{course}-{props['kind']}-{props['hole']}", lon, lat))
    return pins


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--radius-m", type=float, default=10.0)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    pins = collect_pins()
    if len(pins) != 54:
        print(
            f"error: found {len(pins)} ground-gps pins, need 54 — "
            "run build_holes.py on the full survey first"
        )
        return 1

    payload = [
        {
            "GeofenceId": gid,
            "Geometry": {"Circle": {"Center": [lon, lat], "Radius": args.radius_m}},
        }
        for gid, lon, lat in pins
    ]
    if args.dry_run:
        print(json.dumps(payload[:2], indent=1))
        print(f"dry-run: {len(payload)} geofences, radius {args.radius_m} m")
        return 0

    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError

    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    client = session.client(
        "location",
        config=Config(retries={"mode": "adaptive", "total_max_attempts": 5}),
    )
    try:
        put_geofences(client, payload)
        ids = list_geofence_ids(client)
    except ClientError as e:
        print(f"error: location api failed: {e}")
        return 1
    missing = {gid for gid, _, _ in pins} - ids
    if missing:
        print(f"error: {len(missing)} geofences missing after load")
        return 1
    print(f"collection holds {len(ids)} geofences")

    try:
        bad = verify_pins(client, pins)
    except ClientError as e:
        print(f"error: location api failed: {e}")
        return 1
    if bad:
        return 1
    print(f"all {len(pins)} pins evaluate to their own geofence")
    return 0


def put_geofences(client, payload) -> None:
    """BatchPutGeofence takes max 10 per call; per-item errors raise."""
    for i in range(0, len(payload), 10):
        chunk = payload[i : i + 10]
        resp = client.batch_put_geofence(
            CollectionName=COLLECTION, Geofences=chunk
        )
        errs = resp.get("Errors", [])
        if errs:
            raise RuntimeError(f"batch {i // 10}: {errs}")
        print(f"put {i + len(chunk)}/{len(payload)}")


def list_geofence_ids(client) -> set:
    paginator = client.get_paginator("list_geofences")
    return {
        entry["GeofenceId"]
        for page in paginator.paginate(CollectionName=COLLECTION)
        for entry in page.get("Entries", [])
    }


def verify_pins(client, pins) -> int:
    bad = 0
    for gid, lon, lat in pins:
        resp = client.batch_evaluate_geofences(
            CollectionName=COLLECTION,
            DevicePositionUpdates=[
                {"DeviceId": "loader-verify", "Position": [lon, lat]}
            ],
        )
        got = {d["GeofenceId"] for d in resp.get("DeviceGeofences", [])}
        if gid not in got:
            print(f"error: {gid} not returned at its own pin")
            bad += 1
    return bad


if __name__ == "__main__":
    sys.exit(main())
