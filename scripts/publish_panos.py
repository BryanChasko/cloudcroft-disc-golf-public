#!/usr/bin/env python3
"""Publish ground-survey panos to S3 with a viewer manifest.

Input: local dir of pano-{tiki,community}-{tee-N,vista}.jpg (2:1
equirectangular, per docs/ground-survey-guide.md handoff).
Output: objects under s3://bryanchasko.com/disc-golf/survey/panos/
plus panos.json manifest {course, hole, view, key, url} the walkthrough
fetches relative to /disc-golf/walk.html.

Verifies locally (2:1 aspect via PIL) and remotely (object count +
CloudFront 200 per URL). Panos bypass git by design, so every check
must pass or nothing is trusted.

usage:
  publish_panos.py ./panos [--dry-run]
"""

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

BUCKET = "bryanchasko.com"
PREFIX = "disc-golf/survey/panos"
REGION = "us-west-2"
PROFILE = "aerospaceug-admin"
CDN = "https://bryanchasko.com/disc-golf/survey/panos"

NAME_RE = re.compile(r"^pano-(tiki|community)-(tee-(\d+)|vista)\.jpg$")
HOLES = {"tiki": 9, "community": 18}


def scan(indir):
    """Collect + validate local panos. Returns (entries, errors)."""
    entries, errors = [], []
    try:
        from PIL import Image
    except ImportError:
        return [], ["PIL missing: pip install pillow"]
    seen = set()
    for path in sorted(indir.glob("pano-*.jpg")):
        m = NAME_RE.match(path.name)
        if not m:
            errors.append(f"{path.name}: bad name, want pano-{{course}}-{{tee-N,vista}}.jpg")
            continue
        course, view = m.group(1), m.group(2)
        hole = int(m.group(3)) if m.group(3) else None
        if hole is not None and not (1 <= hole <= HOLES[course]):
            errors.append(f"{path.name}: hole out of range")
            continue
        if path.name in seen:
            errors.append(f"{path.name}: duplicate")
            continue
        seen.add(path.name)
        try:
            with Image.open(path) as img:
                w, h = img.size
        except Exception as e:
            errors.append(f"{path.name}: unreadable: {e}")
            continue
        if w != 2 * h:
            errors.append(f"{path.name}: {w}x{h}, must be 2:1 equirectangular")
            continue
        entries.append(
            {
                "course": course,
                "hole": hole,
                "view": view,
                "key": f"{PREFIX}/{path.name}",
                "url": f"{CDN}/{path.name}",
                "path": str(path),
            }
        )
    # Completeness is a warning, not an error: partial drops still ship.
    for course, holes in HOLES.items():
        for n in range(1, holes + 1):
            if f"pano-{course}-tee-{n}.jpg" not in seen:
                print(f"warning: missing pano-{course}-tee-{n}.jpg")
        if f"pano-{course}-vista.jpg" not in seen:
            print(f"warning: missing pano-{course}-vista.jpg")
    return entries, errors


def publish(entries, dry_run=False):
    """Upload panos + manifest. Returns manifest dict."""
    manifest = {
        e["key"]: {k: e[k] for k in ("course", "hole", "view", "url")}
        for e in entries
    }
    body = json.dumps(manifest, indent=1)
    if dry_run:
        print(f"dry-run: {len(entries)} panos + manifest")
        return manifest
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError

    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    s3 = session.client(
        "s3",
        config=Config(retries={"mode": "adaptive", "total_max_attempts": 5}),
    )
    try:
        for e in entries:
            s3.upload_file(
                e["path"],
                BUCKET,
                e["key"],
                ExtraArgs={
                    "ContentType": "image/jpeg",
                    "CacheControl": "public, max-age=86400",
                },
            )
        s3.put_object(
            Bucket=BUCKET,
            Key=f"{PREFIX}/panos.json",
            Body=body.encode(),
            ContentType="application/json",
            CacheControl="no-cache, must-revalidate",
        )
    except ClientError as e:
        print(f"error: s3 failed: {e}")
        sys.exit(1)
    # Remote verify: count + per-URL 200 through CloudFront.
    try:
        listed = s3.list_objects_v2(Bucket=BUCKET, Prefix=PREFIX + "/")
        got = {o["Key"] for o in listed.get("Contents", [])}
    except ClientError as e:
        print(f"error: s3 list failed: {e}")
        sys.exit(1)
    missing = {e["key"] for e in entries} | {f"{PREFIX}/panos.json"} - got
    if missing:
        print(f"error: {len(missing)} objects missing after sync")
        sys.exit(1)
    bad = 0
    for e in entries:
        try:
            with urllib.request.urlopen(e["url"], timeout=20) as r:
                if r.status != 200:
                    bad += 1
        except Exception:
            print(f"error: no 200 for {e['url']}")
            bad += 1
    if bad:
        sys.exit(1)
    print(f"published {len(entries)} panos + manifest, all 200")
    return manifest


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("indir", help="local dir of pano-*.jpg")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    indir = Path(args.indir)
    if not indir.is_dir():
        print(f"error: {indir} is not a directory")
        return 1
    entries, errors = scan(indir)
    for e in errors:
        print(f"error: {e}")
    if errors or not entries:
        print("pano drop invalid" if errors else "no panos found")
        return 1
    publish(entries, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
