# Pano index — Nov 1 ground-survey 360s

Shared vocabulary for the five ingested panoramas. Codes A–E are
shorthand for discussion; filenames + `pano_id` are canonical.
Positions are Pixel EXIF GPS; distances are haversine meters to the
named SW Maps averages (tee-1, basket-1, tee-2).

| code | file                            | taken (UTC) | EXIF lat, lon          | nearest pads                   |
| ---- | ------------------------------- | ----------- | ---------------------- | ------------------------------ |
| A    | PXL_20261101_170324214.PANO.jpg | 17:03:24    | 32.962347, -105.742392 | tee-1 5 m · tee-2 95 m         |
| B    | PXL_20261101_171610748.PANO.jpg | 17:16:10    | 32.961281, -105.742064 | basket-1 5 m · tee-2 59 m      |
| C    | PXL_20261101_173918101.PANO.jpg | 17:39:18    | 32.962383, -105.741786 | tee-1 58 m · tee-2 74 m        |
| D    | PXL_20261101_175756282.PANO.jpg | 17:57:56    | 32.956939, -105.738344 | south (Tiki) area              |
| E    | PXL_20261101_180216070.PANO.jpg | 18:02:16    | 32.956922, -105.738531 | south (Tiki) area, aspen grove |

## What each lens sees (verified on pixels, Nov 2026)

- **A** — Hole 1 tee area. The tee sign in-frame reads
  `HOLE #1 411 ft PRO-PAR 4 - AM-PAR 5` (read at full 19k resolution);
  uphill fairway, north cluster. App `pano_id`: `tee1-area`.
- **B** — Basket 1. Basket fills the frame edge; pad GPS sits 5 m off
  the `community-basket-1` average. App `pano_id`: `basket1`.
- **C** — Basket 2. Yellow band reads `2`; rocky slope, north side.
  App `pano_id`: `basket2`.
- **D** — South-area vista (Tiki). App `pano_id`: `tiki-vista`.
- **E** — Aspen grove, south area. App `pano_id`: `tiki-aspen`.

## Open: a 360 shot at tee box 2

`community-tee-2` sits at 32.961718, -105.741698 (40-fix average,
elev 2675.3 m). None of A–E was taken there: the closest pad-side
exposures are B at 59 m and C at 74 m, and both frames show baskets,
not the tee-2 pad. If a tee-2 360 exists, it is not among the five
ingested panos — check the phone / macmini zips (it is not in
`Photos-1-001 (2).zip` nature set either) and drop it into
`dataset/survey/2026-11-01-community/panos/` to light up the
mountaintop. Until then the walk shows tee-2's real field photos.
