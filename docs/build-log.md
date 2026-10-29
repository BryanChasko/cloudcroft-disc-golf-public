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
