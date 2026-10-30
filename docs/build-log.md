# build log

day-by-day narrative. raw material for the submission writeup.

## day 0 — 2026-10-29 (prep day, before the window opens)

- repo created private: chasko-labs/cloudcroft-disc-golf. public repo is
  optional per the rules; the IP stays closed and a public how-it-works page
  will carry the reusable pattern instead.
- course facts seeded from the Radius Disc Golf page: Tiki layout is 9 holes,
  par 27, 901 ft (hole 4 longest at 134 ft, hole 1 shortest at 39 ft).
- Amazon Location Service stack created in the websites account (211125425201,
  us-east-1): Esri place index, topo + imagery maps, per-hole geofence
  collection, player tracker. zero to five resources in one evening.
- geocoded both anchors through our own place index: Zenith Park
  (-105.73887, 32.95787) and 230 Mescalero Ave (-105.73996, 32.96320).
- USGS EPQS (1 m 3DEP) puts the Tiki anchor at 8664.5 ft and the Community
  anchor at 8781.4 ft — 117 ft apart, matching the 8,676 ft town story.
- OSM pull: 2500 elements, 46 paths + 26 footways (Osha, Rim, Trestle trails).
  neither course is mapped in OSM — our dataset fills a real gap.
- rust ARM lambda plays-like is live and verified: horizontal 364.8 ft +
  40 ft climb = plays-like 404.8 ft on a synthetic hole. 5/5 unit tests.
- toolchain note: cargo-lambda 1.9.1's bundled zigbuild 0.20.1 chokes on
  rustc 1.99's --fix-cortex-a53-843419 linker flag. builds go through `cross`
  (containerized aarch64 gcc) until the toolchain catches up.

## day 0, evening — open-data ingest (all verified live)

- stack constraint set: open source + AWS native only. maplibre (BSD),
  three.js (MIT), rust, CDK, duckdb/rasterio (MIT). Esri data arrives only
  through the AWS-native Location Service. ARCore is the one exception, and
  only for on-device pose estimation — no data flows through it.
- site repo: disc-golf/ sibling prefix registered (#541, squash-merged).
  excludes on both destructive sync lines, gate passes.
- 3DEP 1m DEM: single tile covers both courses, now in our S3 prefix with a
  course crop + 200x200 mesh grid. sampled anchors match EPQS to 0.1 ft.
- NAIP 2022 60cm: single tile covers both courses (found via the state QQ
  index). course-window JPEG + sidecar in S3.
- Daylight OSM parquet: attempted, measured, rejected. query was
  SELECT id, tags, wkt FROM read_parquet(
  's3://daylight-openstreetmap/parquet/osm_features/release=v1.58/type=way/*')
  WHERE max_lon >= -105.77 AND min_lon <= -105.71
  AND max_lat >= 32.93 AND min_lat <= 32.98
  AND (tags['highway'] IS NOT NULL OR ...). no spatial partitioning:
  154 planet files, scan projected past 25 min for a 5 km box. the Overpass
  bbox extract (same OSM data, 20 s) stands as the working copy.
- Terrarium tiles: verified live, read at render time, no ingest needed.

## day 0, night — CDK stack live

- infra-cdk/ (TypeScript): L1 Location resources (2 maps, place index,
  geofence collection, tracker, route calculator), stable-L2 Cognito guest
  pool with scoped geo policies, 2 Rust ARM lambdas, DynamoDB scorecards
  (PK round_id + SK entry, PITR), HTTP API with site-locked CORS.
- CDK CLI ignores this box's SSO profiles; all cdk commands run with
  `aws configure export-credentials` env creds. documented in README.
- AWS::Location::APIKey fails CREATE (AccessDenied) and geo:CreateKey fails
  via CLI too, even as AdministratorAccess. key creation moved out of the
  stack (scripts/create-web-key.sh, kept for retry); web + android both use
  the Cognito guest pool until unblocked.
- scorecard died at init on glibc 2.38+ symbols from the cross gnu image
  (provided.al2023 ships 2.34). both lambdas rebuilt static musl; full
  round-trip verified: plays-like 404.8 ft, scorecard POST x2 + GET.
- stack outputs: api https://sfss0zmepi.execute-api.us-east-1.amazonaws.com,
  pool us-east-1:6f67bf3e-988c-491a-ab4c-b89211a7f82d. orphan clickops IAM
  role deleted; zero hand-made resources remain.

## day 0, late — web map live

- vite + maplibre 5 + location auth-helper, Cognito guest auth, bundled
  data copies (no extra fetches). topo/satellite toggle, trails, NAIP
  overlay, course pins, hole table, geolocate, working scorecard UI.
- bundler fix: the auth helper's credential-providers barrel drags Node-only
  login provider into the web build; aliased to a leaf re-export shim.
- CORS fix: HTTP API needed explicit allowHeaders for JSON posts.
- verified live in headless chromium: tiles render, 9 hole rows, zero failed
  requests, full scorecard click-path (start round, save hole 4, total).
  live: https://bryanchasko.com/disc-golf/

## day 0, later — site pages, android auth, submission draft

- site repo: landing page + how-it-works pattern doc + disk-golf alias
  (#542, squash-merged, site deployed from origin/main detached — local
  main has an unrelated stray compilers commit, left untouched).
  all three URLs 200.
- android auth path proven without the app: guest id -> temp creds ->
  tracker write + read-back, geofence list + evaluate, map tile fetch,
  place search, walking route (1.21 km between courses). test device
  history deleted after. the native app replays these exact calls.
- submission draft written (docs/submission-draft.md); video scripted,
  recording waits on the ground visit.

## day 1 — babylon walkthrough shipped, qa closed (gate d)

- ported the walkthrough from three.js to babylon.js 9.33.1 (house
  engine): 1m dem terrain + naip drape, osm trail ribbons, instanced
  forest with trunks, baskets + windsocks + labels at both pins, orbit
  - wasd walk + fly-to + toggles + pano placeholder + honest webxr
    fallback. live: https://bryanchasko.com/disc-golf/walk.html
- two blind critic rounds (docs/qa/critique-1.md, critique-2.md):
  round 2 passed 8/8 functional sections. fix round 2 closed the rest:
  walk pitch clamp + 4m eye, emissive diorama plinth (measured the
  unlit-emissive dark-crushing on this pipeline, specified
  display-direct values), instanced blob shadows (found + fixed rotated
  instancing-base scattering), billboard edge-clamp for labels, pin
  stop radius 3.0 + windsock colliders, pano card auto-hide.
- answered (not fixed): residual walk-foreground smear is grazing
  minification of 1m imagery amplified by swiftshader aniso=1; the app
  requests max anisotropy so real gpus do much better. headed-chromium
  still selected swiftshader under xvfb, so true-gpu pixels are
  unverified — pixel 10 on site can confirm.
- qa collateral lives in-repo, committed: web/scripts/verify-
  walkthrough.py + public-pass.py, docs/qa/evidence/{public-pass,
  final,live-smoke}. live smoke: 0 console errors, 0 failed requests.
