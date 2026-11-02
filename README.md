# cloudcroft disc golf — AR map + scorecard

Weekend Challenge: Map it entry (Oct 30 – Nov 2, 2026).

An explorable map + on-site AR scorecard for the two public disc golf courses in
Cloudcroft, New Mexico, plus a virtual walkthrough for everyone who cannot visit.

## courses

| course                        | holes | par | length | site                                                       |
| ----------------------------- | ----- | --- | ------ | ---------------------------------------------------------- |
| Byron Ligon Memorial Tiki DGC | 9     | 27  | 901 ft | west end of Zenith Park (all putters, redesigned May 2025) |
| Cloudcroft Community DGC      | 18    | 63  | tbd    | 230 Mescalero Ave, near the old baseball field             |

## dataset

`dataset/` holds GeoJSON: tee pads, baskets, fairway lines, hazard boundaries,
plays-like distances. provenance in `dataset/sources.md`.

provisional until ground-truth GPS is collected on site. coarse anchors:

- Byron Ligon: Zenith Park, Cloudcroft NM 88317 (west end)
- Community: 230 Mescalero Ave, Cloudcroft NM

## architecture

- Amazon Location Service: base map, geocoding, per-hole geofences, routing
- Amazon S3: dataset + tile hosting, static web hosting
- AWS Lambda (Rust, ARM): plays-like distance, scorecard API
- Amazon API Gateway + Amazon DynamoDB: scorecard reads/writes
- web: MapLibre GL 2D map + Babylon.js virtual walkthrough (VR toggle)
- android: ARCore companion for on-site AR overlays (stretch goal, not yet scaffolded)

## layout

- `dataset/` — GeoJSON + provenance
- `backend/` — Rust lambda crates
- `web/` — live map + walkthrough
- `android/` — AR companion app (stretch goal; directory lands with the scaffold)
- `docs/` — hackathon alignment checklist, build log, submission draft

## status

live map: https://bryanchasko.com/cloudcroft-disc-golf/app/ — topo/satellite bases, trails,
NAIP overlay, hole table, working scorecard. per-hole pins unlock with
ground GPS.
