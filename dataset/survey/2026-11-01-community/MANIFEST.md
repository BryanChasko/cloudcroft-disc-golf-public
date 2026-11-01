# survey ingest manifest — 2026-11-01 community course (partial)

source: macmini ~/Downloads, pulled 2026-11-01: `Photos-1-001 (1).zip`
(182 MB, 39 files) + `PXL_20261101_180555239.jpg` (2.5 MB).
raw zips archived at s3://bryanchasko.com/disc-golf/survey/raw/
(zip1-course.zip, zip2-nature.zip) — committed tree excludes them
(GitHub 100 MB/file push limit); originals remain on macmini.
zip2 (`Photos-1-001 (2).zip`, 48 files) is older stock nature photos
(birds, wildflowers, cows, 2021-2022) — NOT survey, excluded from the
scorecard pipeline; extracted set lives in `_incoming/zip2/` for
blog/BRAND art.

coverage: holes 1-4 area only, community course. two GPS clusters:
north ~32.9623-32.9629, -105.7424-105.7417 (holes 1-4) and
south ~32.9569-32.9570, -105.7383-105.7386 (second area).
every pixel photo carries camera location tags (backup GPS: yes).

## photos (15) — `photos/`

| file                          | lat       | lon         | label                                                             |
| ----------------------------- | --------- | ----------- | ----------------------------------------------------------------- |
| PXL_20261101_164259154.jpg    | 32.962761 | -105.742167 | kiosk close-up, course map posted                                 |
| PXL_20261101_164414699.jpg    | 32.962911 | -105.741900 | basket 3 + tee-4 marker (80 ft)                                   |
| PXL_20261101_164448812.jpg    | 32.962911 | -105.741900 | covered tee pad, fairway view                                     |
| PXL_20261101_164454363.jpg    | 32.962911 | -105.741900 | covered tee pad, second angle                                     |
| PXL_20261101_164814470.jpg    | 32.962533 | -105.742331 | tee-1 sign on stump with arrow                                    |
| PXL_20261101_170619902.jpg    | 32.962319 | -105.742417 | tee area, signage + rubber pad, uphill fairway                    |
| PXL_20261101_170626805.jpg    | 32.962319 | -105.742417 | same tee, second angle                                            |
| PXL_20261101_171528886.MP.jpg | 32.961281 | -105.742064 | basket 1 close-up with flag                                       |
| PXL_20261101_172609455.jpg    | 32.961539 | -105.741769 | hole-2 tee sign: 245 ft PAR 3, mando + fence-line OB, tee-3 arrow |
| PXL_20261101_173546702.jpg    | 32.961703 | -105.741678 | wooded fairway with orange marker                                 |
| PXL_20261101_173801288.jpg    | 32.962328 | -105.741778 | basket 2 wide, fairway behind                                     |
| PXL_20261101_173824802.jpg    | 32.962328 | -105.741778 | basket close-up, yellow band                                      |
| PXL_20261101_175522409.jpg    | 32.956964 | -105.738342 | rubber tee pad in woods                                           |
| PXL_20261101_180320124.jpg    | 32.956922 | -105.738531 | aspen grove fairway view                                          |
| PXL_20261101_180555239.jpg    | 32.956975 | -105.738617 | basket in trees, fairway behind                                   |

key par source: hole-2 sign photo gives par 3, 245 ft, mando right,
fence-line OB right — matches SW Maps remark below.

## panos (5) — `panos/`

| file                            | lat       | lon         | label                         |
| ------------------------------- | --------- | ----------- | ----------------------------- |
| PXL_20261101_170324214.PANO.jpg | 32.962347 | -105.742392 | hole area pano, north cluster |
| PXL_20261101_171610748.PANO.jpg | 32.961281 | -105.742064 | basket-1 area pano            |
| PXL_20261101_173918101.PANO.jpg | 32.962383 | -105.741778 | basket-2 area pano            |
| PXL_20261101_175756282.PANO.jpg | 32.956939 | -105.738344 | south area vista pano         |
| PXL_20261101_180216070.PANO.jpg | 32.956922 | -105.738531 | aspen grove pano              |

per field guide panos ship to s3, not git. local copies remain AND the
set is synced at s3://bryanchasko.com/disc-golf/survey/panos/2026-11-01-community/
(5 files, uploaded 2026-11-01).

## screenshots (20) — `screenshots/`

SW Maps setup + point recording, 09:29-11:00. project
`cloudcroft-community-disk-...`, point layer `community-course-points`.
flow: layer creation screenshots (093039-093523) → map views (095348-095543)
→ point recording with averaging (100113-103445) → second project
`cloudcroft-village-course`, layer `unknown-teebox` (110003, 110039).

two transcribed remarks (verbatim from screenshots):

- 103445 (10:34, point ID 3): `community-tee-2 | par 3, 245 ft,
mando right, fence line OB right` — 32.961717387N 105.741697207W,
  elev 2675.405m, averaging 37.
- 110039 (11:00, point ID 2): `unknown-teebox-front` —
  32.956911667N 105.738341667W, elev 2617.300m, averaging 2.

## gaps vs the 8-step field guide

- no 360-at-every-hole: 5 panos across 2 clusters, not per-hole.
- tee-step coverage partial: hole 2 is complete (tee point + sign photo
  with par + mando/OB note); holes 1/3/4 have photos but no confirmed
  SW Maps points yet — phone export still pending.
- tiki course: nothing. community only, as bryan said.
- track recording export: pending phone export.
- on-site QA (loads/saves/glitches): not reported yet.

next: SW Maps export (GeoJSON/GPX + track) from the phone, then run
`dataset/scripts/validate_survey.py` + `build_holes.py` against holes 1-4
as the process proof.
