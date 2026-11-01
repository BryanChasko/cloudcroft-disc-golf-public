# Ground survey field guide — Cloudcroft disc golf

Opinionated, step-by-step. Do Tiki first (short, flat, practice), then
Community. Budget a half day: ~1 hr Tiki, ~2.5–3 hr Community, plus buffer.

## Night before (30 min)

1. Charge the Pixel 10 and the 360 camera fully. Clear phone storage
   (photos + panos + GPS will use several GB).
2. Install **SW Maps** (Play Store, free) on the Pixel. It is the only
   GPS app for this trip: it averages fixes per point and exports
   GeoJSON directly.
3. In SW Maps: set location mode to high accuracy, GPS averaging to
   **30 fixes**, coordinates to decimal degrees (WGS84).
4. Create two projects: `tiki` and `community`. In each, create a
   point layer with two text fields: `name` and `note`.
5. Download offline maps for Cloudcroft in SW Maps (or OSMAnd as
   backup) in case LTE drops on the course.
6. Turn on Pixel camera location tags (Camera > Settings > Save
   location). Every photo becomes a backup GPS point via EXIF.

## What to carry

Pixel 10, 360 camera (charged + empty card), water, sun protection.
That is the whole kit.

## Per-hole checklist (every hole, same order, no skipping)

Do holes in strict numeric order — the Pixel camera-roll sequence is
your backup index for everything.

At the tee:

1. **GPS point.** SW Maps > record point. Hold the phone upright,
   steady, away from your body. Let it average all 30 fixes (~30–60s).
   Name: `tiki-tee-4` / `community-tee-12`. Save.
2. **360 pano.** 360 camera at chest height (~1.5 m), on a stick if
   you have one, timer or phone trigger. Step 2 m to the side if you
   can; if you are in the nadir, fine, keep walking order anyway.
   File must be 2:1 equirectangular JPG. Rename later to
   `pano-tiki-tee-4.jpg` / `pano-community-tee-12.jpg`.
3. **Tee sign photo.** Pixel, straight-on, fill the frame. If there is
   no sign, photograph the tee pad itself.
4. **Par + distance backup.** Read the sign and type it into the tee
   point's `note` field, e.g. `par 3, 134 ft`. This protects against
   one blurry photo. For Community this is the ONLY par source —
   do not skip it.
5. **Bearing.** Compass bearing from tee to basket, degrees, into the
   same note field, e.g. `par 3, 134 ft, brg 215`. Use the Pixel
   compass; sight along your arm at the basket.

Walking to the basket:

6. Note anything the aerial cannot see, into the basket point's note
   later: trail crossings, mando signs, OB lines, fences, big new
   deadfall, tee areas that are dirt vs pad.

At the basket:

7. **GPS point.** Same averaging ritual. Name: `tiki-basket-4` /
   `community-basket-12`. Note holds the walking observations.
8. **Basket photo.** Pixel, basket centered with the fairway behind
   it (stand past the basket looking back at the tee).

## Whole-course extras (once per course)

- Kiosk/rules board photo, parking area photo.
- One 360 pano from the most scenic elevated spot (name it
  `pano-tiki-vista.jpg` / `pano-community-vista.jpg`).
- Keep the SW Maps track recording all day — the walking track is a
  free trail-alignment bonus. Export it as GPX too.

## B-roll (demo video, 10 min total)

1. Slow 180° pan from the highest Community tee.
2. Basket close-up, disc dropping in if anyone is playing.
3. Phone in hand with the live map open, basket visible behind it.
4. Tee sign racking focus or a slow push-in.
5. One throw from behind the thrower (you or a stranger who agrees).

## On-site phone check (5 min, counts as QA)

On LTE (not wifi): open `https://bryanchasko.com/disc-golf/` and
`https://bryanchasko.com/disc-golf/walk.html`. Confirm the map loads,
a hole saves to the scorecard, and walk mode looks clean. Report back:
loads y/n, scorecard saves y/n, any visible glitches, and roughly how
strong the signal is at each course (matters for the AR app).

## Handoff (same evening, from your Mac)

Copy everything off the phone via USB first, then:

```bash
cd ~/code/chasko-labs/cloudcroft-disc-golf  # or your checkout path
mkdir -p dataset/survey
# sw maps exports + gpx tracks + sign/basket photos + notes:
cp <from-phone>/tiki.geojson <from-phone>/community.geojson dataset/survey/
cp <from-phone>/tiki-track.gpx <from-phone>/community-track.gpx dataset/survey/
cp <from-phone>/signs/*.jpg dataset/survey/
git add dataset/survey && git commit -m "ground survey: tiki + community gps, signs" && git push origin main
# panos are too big for git — s3 instead:
aws s3 sync ./panos s3://bryanchasko.com/disc-golf/survey/panos/ \
  --profile aerospaceug-admin --region us-west-2
```

Then tell me it is up. Ingest (per-hole lines, geofences,
plays-like, pano viewer) happens the same day.

## Handoff v2 — direct FTP from the Pixel (no mac in the middle)

Receiver: `scripts/swmaps_ftpd.py` (pyftpdlib, in `dataset/.venv`).
LAN-only, one throwaway account jailed to
`dataset/survey/_incoming/ftp/`. Start on rocm-aibox:

```bash
source dataset/.venv/bin/activate
python scripts/swmaps_ftpd.py <throwaway-password>
```

On the Pixel (home wifi): SW Maps export each item, share/upload to FTP
with host `192.168.4.53`, port `2121`, user `swmaps`, the throwaway
password. Upload per project: GeoJSON points, GPX track, full project
backup. Stop the server after ingest lands.
