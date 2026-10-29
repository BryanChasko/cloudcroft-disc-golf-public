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

- USGS 3DEP elevation (DEM): plays-like distance, slope gradients, hole profiles
- Daylight / OpenStreetMap: park boundaries, trails, roads, parking near courses
- USGS NAIP aerial imagery: fairway/tree-line reference under the vector map

## geocoding anchors (coarse, replaced by ground GPS)

- Byron Ligon: Zenith Park, Cloudcroft NM 88317, west end
- Community: 230 Mescalero Ave, Cloudcroft NM

geocoded through Amazon Location Service place index; kept only as map
fallback until ground pins land.
