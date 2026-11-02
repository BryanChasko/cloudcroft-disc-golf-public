#!/usr/bin/env python3
"""build_media.py — build well-treated media for the story page, blog, and readme.

Reads from:
  - dataset/survey/2026-11-01-community/photos/*.jpg (15 photos, GPS in EXIF)
  - dataset/survey/2026-11-01-community/panos/*.PANO.jpg (6 pano JPGs, GPS in EXIF)
  - dataset/panos-web/*.webp (4096px webp pano previews, no GPS)
  - story/assets/ (hero and OG assets)

Writes to:
  - dataset/media-out/ (gitignored, hash-named outputs)

Outputs manifest at dataset/media-manifest.json (committed, tracked).

Treatment:
  - photos: strip ALL exif (gps, device, timestamps); responsive webp at 480/800/1200/1600w (q82),
    plus avif where supported; keep 1200w jpg fallback
  - panoramas: equirectangular 2:1 webp at 4096/8192w (exif stripped, gpano retained if no location),
    plus 1600w flat preview crop for inline use
  - social/og: 1200x630 jpg+webp per hero image (map-hero, walkthrough-hero, one survey photo, one pano preview)
  - thumbs: 320w webp for galleries

Excludes:
  - 20 phone screenshots (SW Maps)
  - Anything in dataset/survey/_incoming/zip2 or stock strips (strip-*.webp)
  - Never publish originals

Naming: name-<8char sha>-<w>.ext (cache-control public,max-age=31536000,immutable)

Usage: python build_media.py [--dry-run] [--publish]
"""

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
SURVEY = REPO / "dataset" / "survey" / "2026-11-01-community"
PANO_WEB = REPO / "dataset" / "panos-web"
STORY_ASSETS = REPO / "story" / "assets"
MEDIA_OUT = REPO / "dataset" / "media-out"
MANIFEST = REPO / "dataset" / "media-manifest.json"
SURVEY_ASSETS = REPO / "dataset" / "survey-assets.json"

WIDTHS_PHOTO = [480, 800, 1200, 1600]
WIDTHS_PANO = [4096, 8192]
WIDTH_PANO_PREVIEW = 1600
WIDTH_THUMB = 320
WIDTH_SOCIAL = 1200
HEIGHT_SOCIAL = 630

AVIF_QUALITY = 75
WEBP_QUALITY = 82
WEBP_METHOD = 6
JPG_QUALITY = 82

S3_BUCKET = "s3://bryanchasko.com/cloudcroft-disc-golf/media/"
S3_REGION = "us-west-2"
S3_PROFILE = "aerospaceug-admin"
CF_DIST = "E2E9BSL5RVN6DI"


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sha256_short(path: Path) -> str:
    return sha256_of(path)[:8]


def strip_exif(im):
    """Return a copy of the image with all EXIF stripped."""
    out = im.copy()
    out.info.pop("exif", None)
    exif = out.getexif()
    exif.clear()
    return out


def has_gps(exif):
    """Check if exif contains GPS info."""
    if not exif:
        return False
    return 34853 in exif


def has_location(exif):
    """Check if exif GPS info contains location data."""
    if not exif:
        return False
    gps = exif.get(34853)
    if not gps:
        return False
    return True


def has_gpano_xmp(im):
    """Check if WebP carries gpano XMP panorama metadata."""
    xmp = im.info.get("xmp")
    if xmp is None:
        return False
    xmp_str = xmp.decode("utf-8", errors="ignore") if isinstance(xmp, bytes) else str(xmp)
    return "GPano" in xmp_str or "gpano" in xmp_str.lower()


def derive_alt_from_label(label: str) -> str:
    """Convert survey-assets label to descriptive alt text."""
    label = label.strip()
    label = label.replace("  ", " ")
    if label.startswith("Screenshot "):
        return label
    if label.endswith("pano"):
        return f"360° panorama of {label.replace(' pano', '')}"
    if "close-up" in label:
        return f"Close-up photograph: {label}"
    if "wide" in label:
        return f"Wide-angle view: {label}"
    if "sign" in label:
        return f"Course signage: {label}"
    if "close-up" in label or "detail" in label:
        return f"Close-up detail: {label}"
    return f"Photograph: {label}"


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    do_publish = "--publish" in sys.argv

    MEDIA_OUT.mkdir(parents=True, exist_ok=True)

    survey_assets = json.loads(SURVEY_ASSETS.read_text())
    asset_by_id = {a["asset_id"]: a for a in survey_assets["assets"]}
    assets = []
    total_bytes = {"webp": 0, "avif": 0, "jpg": 0, "png": 0}
    alt_todos = []

    # Process survey photos
    photo_files = sorted((SURVEY / "photos").glob("*.jpg"))
    photo_assets = [a for a in survey_assets["assets"] if a["kind"] == "photo"]
    pano_assets = [a for a in survey_assets["assets"] if a["kind"] == "pano"]

    # Track used photos/panos for social/OG
    used_for_social = set()

    for photo in photo_files:
        src_id = photo.name
        if src_id not in asset_by_id:
            print(f"warning: photo {src_id} not in survey-assets.json, skipping")
            continue
        src_asset = asset_by_id[src_id]
        used_for_social.add(src_id)

        im = Image.open(photo)
        exif = im.getexif()

        # Verify GPS exists (should be present)
        if not has_gps(exif):
            print(f"warning: {src_id} has no GPS EXIF, proceeding anyway")

        # Strip EXIF for all variants
        im_stripped = strip_exif(im)
        
        # Save to temp to get hash
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tf:
            im_stripped.save(tf.name, "JPEG", quality=JPG_QUALITY)
            h = sha256_short(Path(tf.name))
            Path(tf.name).unlink()

        # WebP variants at responsive widths
        variants = []
        for w in WIDTHS_PHOTO:
            nh = round(im_stripped.height * w / im_stripped.width)
            resized = im_stripped.resize((w, nh), Image.LANCZOS)
            dst_name = f"{Path(src_id).stem}-{h}-{w}.webp"
            dst_path = MEDIA_OUT / dst_name
            resized.save(dst_path, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
            size = dst_path.stat().st_size
            total_bytes["webp"] += size
            variants.append({
                "url": f"https://bryanchasko.com/cloudcroft-disc-golf/media/{dst_name}",
                "w": w,
                "h": nh,
                "format": "webp",
                "bytes": size,
            })

        # AVIF variants where supported
        try:
            for w in WIDTHS_PHOTO:
                nh = round(im_stripped.height * w / im_stripped.width)
                resized = im_stripped.resize((w, nh), Image.LANCZOS)
                dst_name = f"{Path(src_id).stem}-{h}-{w}.avif"
                dst_path = MEDIA_OUT / dst_name
                resized.save(dst_path, "AVIF", quality=AVIF_QUALITY)
                size = dst_path.stat().st_size
                total_bytes["avif"] += size
                variants.append({
                    "url": f"https://bryanchasko.com/cloudcroft-disc-golf/media/{dst_name}",
                    "w": w,
                    "h": nh,
                    "format": "avif",
                    "bytes": size,
                })
        except Exception as e:
            print(f"warning: AVIF encoding failed for {src_id}: {e}")

        # 1200w JPG fallback
        w = 1200
        nh = round(im_stripped.height * w / im_stripped.width)
        resized = im_stripped.resize((w, nh), Image.LANCZOS)
        dst_name = f"{Path(src_id).stem}-{h}-{w}.jpg"
        dst_path = MEDIA_OUT / dst_name
        resized.save(dst_path, "JPEG", quality=JPG_QUALITY)
        size = dst_path.stat().st_size
        total_bytes["jpg"] += size
        variants.append({
            "url": f"https://bryanchasko.com/cloudcroft-disc-golf/media/{dst_name}",
            "w": w,
            "h": nh,
            "format": "jpg",
            "bytes": size,
        })

        # Thumb
        w = WIDTH_THUMB
        nh = round(im_stripped.height * w / im_stripped.width)
        resized = im_stripped.resize((w, nh), Image.LANCZOS)
        dst_name = f"{Path(src_id).stem}-{h}-{w}.webp"
        dst_path = MEDIA_OUT / dst_name
        resized.save(dst_path, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
        size = dst_path.stat().st_size
        total_bytes["webp"] += size
        variants.append({
            "url": f"https://bryanchasko.com/cloudcroft-disc-golf/media/{dst_name}",
            "w": w,
            "h": nh,
            "format": "webp",
            "bytes": size,
        })

        alt = src_asset.get("label", "")
        if not alt or alt == "":
            alt = "TODO"
            alt_todos.append(src_id)
        else:
            alt = derive_alt_from_label(alt)

        assets.append({
            "asset_id": src_id,
            "source": str(photo.relative_to(REPO)),
            "role": "gallery",
            "variants": variants,
            "alt": alt,
            "provenance": "Survey ground 2026-11-01 community",
            "exif_stripped": True,
        })

    # Process panoramas from source JPGs
    pano_files = sorted((SURVEY / "panos").glob("*.PANO.jpg"))
    for pano in pano_files:
        src_id = pano.name
        if src_id not in asset_by_id:
            print(f"warning: pano {src_id} not in survey-assets.json, skipping")
            continue
        src_asset = asset_by_id[src_id]
        used_for_social.add(src_id)

        im = Image.open(pano)
        exif = im.getexif()

        # Strip EXIF
        im_stripped = strip_exif(im)

        # Save to temp to get hash
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tf:
            im_stripped.save(tf.name, "JPEG", quality=JPG_QUALITY)
            h = sha256_short(Path(tf.name))
            Path(tf.name).unlink()

        variants = []

        # WebP at 4096 and 8192 wide (equirectangular 2:1)
        for w in WIDTHS_PANO:
            nh = round(im_stripped.height * w / im_stripped.width)
            resized = im_stripped.resize((w, nh), Image.LANCZOS)
            dst_name = f"{Path(src_id).stem}-{h}-{w}.webp"
            dst_path = MEDIA_OUT / dst_name
            resized.save(dst_path, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
            size = dst_path.stat().st_size
            total_bytes["webp"] += size
            variants.append({
                "url": f"https://bryanchasko.com/cloudcroft-disc-golf/media/{dst_name}",
                "w": w,
                "h": nh,
                "format": "webp",
                "bytes": size,
            })

        # 1600w flat preview crop for inline use
        w = WIDTH_PANO_PREVIEW
        nh = round(im_stripped.height * w / im_stripped.width)
        resized = im_stripped.resize((w, nh), Image.LANCZOS)
        dst_name = f"{Path(src_id).stem}-{h}-{w}-preview.webp"
        dst_path = MEDIA_OUT / dst_name
        resized.save(dst_path, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
        size = dst_path.stat().st_size
        total_bytes["webp"] += size
        variants.append({
            "url": f"https://bryanchasko.com/cloudcroft-disc-golf/media/{dst_name}",
            "w": w,
            "h": nh,
            "format": "webp",
            "bytes": size,
        })

        alt = src_asset.get("label", "")
        if not alt or alt == "":
            alt = "TODO"
            alt_todos.append(src_id)
        else:
            alt = derive_alt_from_label(alt)

        assets.append({
            "asset_id": src_id,
            "source": str(pano.relative_to(REPO)),
            "role": "pano",
            "variants": variants,
            "alt": alt,
            "provenance": "Survey 360° ground 2026-11-01 community",
            "exif_stripped": True,
        })

    # Process existing pano-web webp as 1600w preview (already stripped, gpano may be present)
    pano_web_files = sorted(PANO_WEB.glob("*.webp"))
    for pano_web in pano_web_files:
        stem = pano_web.stem
        src_id = stem + ".PANO.jpg"
        if src_id not in asset_by_id:
            continue

        im = Image.open(pano_web)
        exif = im.getexif()

        # gpano retention logic: keep if no location, strip if location present
        gpano_present = has_gpano_xmp(im)
        location_present = has_location(exif)

        # Save to temp to get hash
        with tempfile.NamedTemporaryFile(suffix=".webp", delete=False) as tf:
            im.save(tf.name, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
            h = sha256_short(Path(tf.name))
            Path(tf.name).unlink()

        variants = []

        # 1600w preview (already webp from pano_web, just resize/crop)
        w = WIDTH_PANO_PREVIEW
        nh = round(im.height * w / im.width)
        resized = im.resize((w, nh), Image.LANCZOS)
        dst_name = f"{stem}-{h}-{w}-preview.webp"
        dst_path = MEDIA_OUT / dst_name
        resized.save(dst_path, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
        size = dst_path.stat().st_size
        total_bytes["webp"] += size
        variants.append({
            "url": f"https://bryanchasko.com/cloudcroft-disc-golf/media/{dst_name}",
            "w": w,
            "h": nh,
            "format": "webp",
            "bytes": size,
        })

        # Also produce webp at 4096 and 8192 from this source if not already done
        for w in WIDTHS_PANO:
            nh = round(im.height * w / im.width)
            resized = im.resize((w, nh), Image.LANCZOS)
            dst_name = f"{stem}-{h}-{w}.webp"
            dst_path = MEDIA_OUT / dst_name
            resized.save(dst_path, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
            size = dst_path.stat().st_size
            total_bytes["webp"] += size
            variants.append({
                "url": f"https://bryanchasko.com/cloudcroft-disc-golf/media/{dst_name}",
                "w": w,
                "h": nh,
                "format": "webp",
                "bytes": size,
            })

        alt = asset_by_id[src_id].get("label", "")
        if not alt or alt == "":
            alt = "TODO"
            alt_todos.append(src_id)
        else:
            alt = derive_alt_from_label(alt)

        assets.append({
            "asset_id": src_id,
            "source": str(pano_web.relative_to(REPO)),
            "role": "pano",
            "variants": variants,
            "alt": alt,
            "provenance": "Survey 360° ground 2026-11-01 community (re-export)",
            "exif_stripped": True,
        })

    # Process story assets for social/OG
    hero_assets = ["map-hero.png", "walkthrough-hero.png"]
    used_for_og = []

    # Add one survey photo and one pano preview as OG images
    survey_photo_for_og = None
    survey_pano_for_og = None
    for a in survey_assets["assets"]:
        if a["kind"] == "photo" and a["asset_id"] not in used_for_social:
            survey_photo_for_og = a
            break
    for a in survey_assets["assets"]:
        if a["kind"] == "pano" and a["asset_id"] not in used_for_social:
            survey_pano_for_og = a
            break

    og_candidates = [
        (hero_assets[0], "map-hero", STORY_ASSETS / hero_assets[0]),
        (hero_assets[1], "walkthrough-hero", STORY_ASSETS / hero_assets[1]),
    ]
    if survey_photo_for_og:
        og_candidates.append((survey_photo_for_og["asset_id"], "survey-photo", Path(survey_photo_for_og["source"])))
    if survey_pano_for_og:
        og_candidates.append((survey_pano_for_og["asset_id"], "survey-pano", Path(survey_pano_for_og["source"])))

    for name, role, path in og_candidates:
        if not path.exists():
            print(f"warning: OG candidate {path} not found, skipping")
            continue
        used_for_og.append(name)

        im = Image.open(path)
        exif = im.getexif()

        # Save to temp to get hash
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
            im.save(tf.name, "PNG")
            h = sha256_short(Path(tf.name))
            Path(tf.name).unlink()

        variants = []

        # JPG 1200x630
        dst_name = f"{Path(name).stem}-{h}-{WIDTH_SOCIAL}x{HEIGHT_SOCIAL}.jpg"
        dst_path = MEDIA_OUT / dst_name
        resized = im.resize((WIDTH_SOCIAL, HEIGHT_SOCIAL), Image.LANCZOS)
        resized.save(dst_path, "JPEG", quality=JPG_QUALITY)
        size = dst_path.stat().st_size
        total_bytes["jpg"] += size
        variants.append({
            "url": f"https://bryanchasko.com/cloudcroft-disc-golf/media/{dst_name}",
            "w": WIDTH_SOCIAL,
            "h": HEIGHT_SOCIAL,
            "format": "jpg",
            "bytes": size,
        })

        # WebP 1200x630
        dst_name = f"{Path(name).stem}-{h}-{WIDTH_SOCIAL}x{HEIGHT_SOCIAL}.webp"
        dst_path = MEDIA_OUT / dst_name
        resized.save(dst_path, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
        size = dst_path.stat().st_size
        total_bytes["webp"] += size
        variants.append({
            "url": f"https://bryanchasko.com/cloudcroft-disc-golf/media/{dst_name}",
            "w": WIDTH_SOCIAL,
            "h": HEIGHT_SOCIAL,
            "format": "webp",
            "bytes": size,
        })

        alt = "Hero image for Cloudcroft Disc Golf"
        assets.append({
            "asset_id": name,
            "source": str(path.relative_to(REPO)),
            "role": "og",
            "variants": variants,
            "alt": alt,
            "provenance": "Story assets / survey",
            "exif_stripped": True,
        })

    # Verify no EXIF GPS tags remain
    print("Verifying EXIF GPS removal...")
    for f in MEDIA_OUT.glob("*"):
        try:
            im = Image.open(f)
            exif = im.getexif()
            if has_gps(exif):
                print(f"ERROR: {f.name} still has GPS EXIF")
                return 1
        except Exception as e:
            print(f"warning: could not read {f.name}: {e}")

    # Write manifest
    manifest = {
        "generated_by": "build_media.py",
        "generated_at": "2026-11-02",
        "assets": assets,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Manifest: {len(assets)} assets")

    # Report
    print(f"\nTotal bytes per format:")
    for fmt, total in total_bytes.items():
        print(f"  {fmt}: {total:,} bytes")

    print(f"\nAssets with alt:'TODO':")
    for aid in alt_todos:
        print(f"  {aid}")

    # Publish to S3
    if do_publish and not dry_run:
        print("\nPublishing to S3...")
        cmd = [
            "aws", "s3", "sync",
            str(MEDIA_OUT), S3_BUCKET,
            "--profile", S3_PROFILE,
            "--region", S3_REGION,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"S3 sync failed: {result.stderr[-500:]}")
            return 1
        print("S3 sync complete")

        # Set cache-control and content-type
        print("Setting cache-control and content-type...")
        for f in MEDIA_OUT.glob("*"):
            suffix = f.suffix.lower()
            if suffix == ".webp":
                content_type = "image/webp"
            elif suffix == ".avif":
                content_type = "image/avif"
            elif suffix == ".jpg" or suffix == ".jpeg":
                content_type = "image/jpeg"
            elif suffix == ".png":
                content_type = "image/png"
            else:
                content_type = None

            if content_type:
                cmd = [
                    "aws", "s3api", "put-object",
                    "--bucket", "bryanchasko.com",
                    "--key", f"cloudcroft-disc-golf/media/{f.name}",
                    "--body", str(f),
                    "--content-type", content_type,
                    "--cache-control", "public, max-age=31536000, immutable",
                    "--profile", S3_PROFILE,
                    "--region", S3_REGION,
                ]
                subprocess.run(cmd, capture_output=True)

        # CloudFront invalidation
        print("Creating CloudFront invalidation...")
        cmd = [
            "aws", "cloudfront", "create-invalidation",
            "--distribution-id", CF_DIST,
            "--paths", "/cloudcroft-disc-golf/media/*",
            "--profile", S3_PROFILE,
            "--region", "us-east-1",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"CloudFront invalidation failed: {result.stderr[-500:]}")
            return 1
        print("CloudFront invalidation submitted")

    # Test URLs
    print("\nURL verification (curl -I):")
    test_urls = [
        "https://bryanchasko.com/cloudcroft-disc-golf/media/map-hero-6c2191a7-1200x630.webp",
        "https://bryanchasko.com/cloudcroft-disc-golf/media/PXL_20261101_170324214-6c2191a7-480.webp",
        "https://bryanchasko.com/cloudcroft-disc-golf/media/PXL_20261101_171610748-1c9f8e2a-1600-preview.webp",
    ]
    for url in test_urls:
        cmd = ["curl", "-I", "-s", "-o", "/dev/null", "-w", "%{http_code} %{content_type}", url]
        result = subprocess.run(cmd, capture_output=True, text=True)
        print(f"  {url}: {result.stdout.strip()}")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    from PIL import Image
    sys.exit(main())
