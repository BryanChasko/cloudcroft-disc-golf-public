# submission draft — Weekend Challenge: Map it

## title

Cloudcroft Disc Golf: AR map + scorecard at 8,676 ft

## dataset

Four open sources fused around two real courses (Byron Ligon Memorial Tiki
DGC, 9 holes par 27; Cloudcroft Community DGC, 18 holes par 63):

- USGS 3DEP 1m DEM (NM_SouthEast_2018_D19): one tile covers both courses;
  anchor elevations match the National Map to 0.1 ft
- USGS NAIP 2022 60cm imagery: one tile covers both courses, cropped to a
  course-window overlay
- OpenStreetMap: 46 paths + 26 footways with real trail names (Daylight
  parquet attempted, rejected on measurement: 25+ min planet scan)
- Ground GPS pins for every tee + basket (collected on foot during the
  challenge window) + 360 panos for the walkthrough

## how it got on the map

Amazon Location Service carries the whole spatial layer: Esri topo +
imagery maps, a place index (both course anchors geocoded through it), a
per-hole geofence collection, a player tracker, and a route calculator
(1.21 km walk between the courses). A Cognito guest pool gives the web map
and the Android app the same scoped role. Rust ARM lambdas behind an HTTP
API serve plays-like distances (haversine + elevation model over the 1m
DEM) and a DynamoDB-backed scorecard. The dataset and web bundle live in
S3; one CDK stack owns every resource (TypeScript, stable L1s — the
Location L2s are still alpha).

## AWS services used

Amazon Location Service, Amazon Cognito, AWS Lambda, Amazon API Gateway,
Amazon DynamoDB, Amazon S3, Amazon CloudFront, AWS CloudFormation (via CDK).

## live map

https://bryanchasko.com/cloudcroft-disc-golf/app/

Story + reusable pattern: https://bryanchasko.com/cloudcroft-disc-golf/
and /cloudcroft-disc-golf/how-this-works/.

## demo video

TODO: record under-3-minute walkthrough (live map tour + on-site AR if the
ground visit allows). Script: 1) the town + Ray Haller story (20s), 2) map
tour — bases, trails, NAIP, holes (60s), 3) scorecard round live (30s), 4) AR overlay on the tee pad (40s), 5) the pattern for your course (20s).

## code

Private by choice (IP). The how-it-works page documents the full reusable
pattern: dataset queries, pipeline scripts, CDK shape, and frontend auth.
