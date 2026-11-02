# Media pipeline

Builds well-treated media for the story page, blog, and readme.

## Usage

```bash
# Run locally (no publish)
python dataset/scripts/build_media.py --dry-run

# Build and publish to S3
python dataset/scripts/build_media.py --publish
```

## Output

- `dataset/media-out/` — hash-named outputs (gitignored)
- `dataset/media-manifest.json` — manifest with asset details (committed)

## Excludes

- 20 phone screenshots (SW Maps)
- Anything in `dataset/survey/_incoming/zip2` or stock strips (`strip-*.webp`)
- Never publishes originals

## Treatment

- **photos**: strip ALL exif (gps, device, timestamps); responsive webp at 480/800/1200/1600w (q82), plus avif; 1200w jpg fallback; 320w thumb
- **panoramas**: equirectangular 2:1 webp at 4096/8192w; 1600w preview crop; gpano XMP retained if no location
- **social/og**: 1200x630 jpg+webp per hero image

## URLs

All outputs published to: `https://bryanchasko.com/cloudcroft-disc-golf/media/<file>`

Cache-Control: `public, max-age=31536000, immutable`
