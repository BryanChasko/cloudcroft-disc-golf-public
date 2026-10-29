# dataset sources + provenance

every coordinate in this dataset traces to one of these. provisional values are
marked `"fix": "provisional"` in the GeoJSON and get replaced by ground GPS.

## ground truth (highest trust, boots on the ground)

- Pixel GPS pins at every tee pad + basket, both courses
- 360 panos at each tiki tee + basket look-back (also feeds VR walkthrough)
- compass bearing tee to basket per hole
- photos of tee signs, hazards, hike/bike trail crossings, parking

status: to collect. see docs/ground-crew-checklist.md (to write).

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
- Terrain Tiles (Terrarium): read directly from the public bucket at render
  time, no ingest step. pattern:
  s3://elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
  (Cloudcroft z14 tile verified). elevation = R*256 + G + B/256 - 32768.
- Copernicus DEM 30m (s3://copernicus-dem-30m, N32W106 COG verified):
  coarse fallback only. 30m sources give ~1 pixel per 100 ft hole, useless
  for per-hole profiles — the 1m DEM is the elevation source of record.

## geocoding anchors (coarse, replaced by ground GPS)

- Byron Ligon: Zenith Park, Cloudcroft NM 88317, west end
- Community: 230 Mescalero Ave, Cloudcroft NM

geocoded through Amazon Location Service place index; kept only as map
fallback until ground pins land.
