# dataset sources + provenance

every coordinate in this dataset traces to one of these. provisional values are
marked `"fix": "provisional"` in the GeoJSON and get replaced by ground GPS.

## ground truth (highest trust, boots on the ground)

- Pixel GPS pins at every tee pad + basket, both courses
- 360 panos at each tiki tee + basket look-back (also feeds VR walkthrough)
- compass bearing tee to basket per hole
- photos of tee signs, hazards, hike/bike trail crossings, parking

status: partial collection landed 2026-11-01 (community holes 1-2 named,
21 points; tiki 6 unnamed points). see docs/ground-survey-guide.md
(field procedure) and dataset/survey/2026-11-01-*/MANIFEST.md.

## field survey raw archive (S3, canonical)

raw phone/Camera handoff for the 2026-11-01 drop, too large for git
(GitHub 100 MB/file push limit). originals remain on macmini Downloads.

- s3://bryanchasko.com/disc-golf/survey/raw/zip1-course.zip
  (182,442,376 bytes, etag 0c9da48f276922f9ead040b9b3b85e3e-22):
  39 files from the community course — 15 Pixel photos with camera GPS,
  5 panos, 20 SW Maps screenshots. extracted + labeled in
  dataset/survey/2026-11-01-community/.
- s3://bryanchasko.com/disc-golf/survey/raw/zip2-nature.zip
  (72,249,457 bytes, etag 767dc5c3dbc127b4622033e4c0f742f9-9):
  48 older stock nature photos (2021-2022, birds/wildflowers/cattle) —
  not survey, used for hackathon blog art (BRAND strips in the writing
  repo, blog/assets/cloudcroft-disc-golf/). extracted set in
  dataset/survey/_incoming/zip2/.
- SW Maps project backups (.swmz incl. SQLite point db + in-app photos)
  pulled separately from macmini Downloads into
  dataset/survey/_incoming/swmz-{community,village}/; extracted GeoJSON
  at dataset/survey/2026-11-01-*/points.geojson via
  dataset/scripts/swm2_to_geojson.py.
- Survey panos (walkthrough texture source): 6 PANO files committed under
  dataset/survey/2026-11-01-community/panos/. The
  s3://bryanchasko.com/disc-golf/survey/panos/2026-11-01-community/
  prefix probed empty / 404 via the CDN path on 2026-11-02 — re-list
  before claiming a survey-pano sync there.

## course layout facts (public, attributed)

- Byron Ligon Memorial Tiki DGC hole pars + distances: Radius Disc Golf course
  page (9 holes, par 27, 901 ft total). all par 3.
- Cloudcroft Community DGC: 18 holes, par 63, 230 Mescalero Ave (Cloudcroft
  Reader reporting). per-hole detail to collect on site / UDisc.
- course history: "Cloudcroft's Top-Ranked Disc Golf Course: Ray Haller Built
  it", Cloudcroft Reader, May 27 2026.

## public geo data (Registry of Open Data on AWS + portals)

all pulls below are open data (public domain or ODbL) read with open-source
tooling (rasterio, duckdb, pyshp). scripts live in dataset/scripts/.

- USGS 3DEP 1m DEM, project NM_SouthEast_2018_D19: one 248MB tile
  (USGS_1M_13_x43y365) covers both courses. full tile + course crop + 200x200
  mesh grid in s3://bryanchasko.com/disc-golf/data/dem/. anchor elevations
  sampled from the tile match EPQS to 0.1 ft (8664.5 / 8781.3).
- USGS NAIP 2022 60cm RGB: one tile (m_3210503_nw) covers both courses,
  located via the state's QQ shapefile index. course-window JPEG +
  bbox sidecar in s3://bryanchasko.com/disc-golf/data/naip/.
- OpenStreetMap: live Overpass API bbox extract (osm-cloudcroft.json, 2500
  elements, 46 paths + 26 footways). the S3-native Daylight parquet path
  (s3://daylight-openstreetmap/parquet/osm_features/release=v1.58) was
  attempted with duckdb and abandoned on measurement: no spatial
  partitioning, planet-wide scan projected past 25 minutes for a 5 km box.
  same underlying data, bbox-native API, 20 seconds. query recorded in
  docs/build-log.md.
- Terrain Tiles (Terrarium): evaluated, not used. the Cloudcroft z14 tile
  verified live (s3://elevation-tiles-prod/terrarium/{z}/{x}/{y}.png,
  elevation = R*256 + G + B/256 - 32768), but both frontends render
  elevation from the local 1m 3DEP DEM grid instead — nothing reads
  Terrarium at render time.
- Copernicus DEM 30m (s3://copernicus-dem-30m, N32W106 COG verified):
  coarse fallback only. 30m sources give ~1 pixel per 100 ft hole, useless
  for per-hole profiles — the 1m DEM is the elevation source of record.
- NOAA U.S. Climate Normals 1991-2020 (Registry of Open Data on AWS,
  s3://noaa-normals-pds): monthly normals for station USC00291931
  (CLOUDCROFT, NM, 32.9544/-105.7353, 2645.4 m) in
  dataset/climate-normals-cloudcroft.json via
  dataset/scripts/noaa_normals.py. NOAA NCEI attribution; no endorsement
  implied. full audit of which of the above are genuinely Registry
  fetches: docs/open-data-provenance.md — the heading above groups
  Registry + portals, and only this entry is a proven Registry fetch.

## geocoding anchors (coarse, replaced by ground GPS)

- Byron Ligon: Zenith Park, Cloudcroft NM 88317, west end
- Community: 230 Mescalero Ave, Cloudcroft NM

geocoded through Amazon Location Service place index; kept only as map
fallback until ground pins land.
