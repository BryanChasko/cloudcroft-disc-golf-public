# Pano index — Nov 1 ground-survey 360s

Shared vocabulary for the six ingested panoramas. Codes A–F are
shorthand for discussion; filenames + `pano_id` are canonical.
Positions are Pixel EXIF GPS; distances are haversine meters to the
named SW Maps averages (tee-1, basket-1, tee-2).

| code | file                            | taken (UTC) | EXIF lat, lon          | nearest pads                                    |
| ---- | ------------------------------- | ----------- | ---------------------- | ----------------------------------------------- |
| A    | PXL_20261101_170324214.PANO.jpg | 17:03:24    | 32.962347, -105.742392 | tee-1 5 m · tee-2 95 m                          |
| B    | PXL_20261101_171610748.PANO.jpg | 17:16:10    | 32.961281, -105.742064 | basket-1 5 m · tee-2 59 m                       |
| C    | PXL_20261101_173918101.PANO.jpg | 17:39:18    | 32.962383, -105.741786 | tee-1 58 m · tee-2 74 m                         |
| D    | PXL_20261101_175756282.PANO.jpg | 17:57:56    | 32.956939, -105.738344 | Byron Ligon teebox 3; unknown-teebox-front 4 m  |
| E    | PXL_20261101_180216070.PANO.jpg | 18:02:16    | 32.956922, -105.738531 | Byron Ligon fairway 3; pano-unknown-fairway 3 m |
| F    | PXL_20261101_173005849.PANO.jpg | 17:29:26    | 32.961722, -105.741683 | tee-2 pad 1 m · B 61 m · C 74 m                 |

## What each lens sees (verified on pixels, Nov 2026)

- **A** — Community teebox 1 / Hole 1 tee area. The tee sign in-frame reads
  `HOLE #1 411 ft PRO-PAR 4 - AM-PAR 5` (read at full 19k resolution);
  uphill fairway, north cluster. App `pano_id`: `tee1-area`.
- **B** — Community basket 1 (Hole 1). Basket fills the frame edge; pad GPS sits 5 m off
  the `community-basket-1` average. App `pano_id`: `basket1`.
- **C** — Community basket 2 area (Hole 2). Yellow band reads `2`; rocky slope, north side.
  App `pano_id`: `basket2`.
- **D** — Byron Ligon teebox 3 (bryan ground truth, nov 2026). EXIF GPS
  sits 3.5 m from the SW Maps `unknown-teebox-front` 55-fix average.
  App `pano_id`: `tiki-vista` (stable join key, pre-identification name).
- **E** — Byron Ligon fairway 3, aspen grove (bryan ground truth, nov
  2026). EXIF GPS sits 2.9 m from the SW Maps `pano-unknown-fairway`
  30-fix average. App `pano_id`: `tiki-aspen` (stable join key).
  teebox-3-front to this fairway point is 18 m / 60 ft, so E is a
  mid-fairway position on the 133 ft hole 3, not its basket.
- **F** — Community teebox 2 pad (mountaintop). EXIF GPS 32.961722, -105.741683,
  1.4 m from the `community-tee-2` average; GPS timestamp 17:29:26 UTC.
  App `pano_id`: `tee2-area`. Content read on pixels still pending.

## Open: a 360 shot at tee box 2 — resolved 2026-11-02

`community-tee-2` sits at 32.961718, -105.741698 (40-fix average,
elev 2675.3 m). F (PXL_20261101_173005849.PANO.jpg, ingested 2026-11-02
from the macmini ~/Downloads loose file) was taken there: 1.4 m off the
average, between the tee-2 sign photo (17:26) and the fairway photo
(17:35). A–E remain as before (B at 59 m and C at 74 m show baskets,
not the pad).

## Public links (verified 2026-11-02, HEAD requests)

Canonical public base is the deployed site, not GitHub and not a direct
survey S3 prefix:

- App: https://bryanchasko.com/cloudcroft-disc-golf/app/ (200, text/html)
- Walk: https://bryanchasko.com/cloudcroft-disc-golf/app/walk.html (200, text/html)
- Story: https://bryanchasko.com/cloudcroft-disc-golf/ (200, text/html)
- Machine index: https://bryanchasko.com/cloudcroft-disc-golf/app/data/survey-assets.json
  (200, application/json; live copy still counts 5 panos — see F below)

Deploy evidence: `scripts/deploy-web.sh` syncs `web/dist/` to
`s3://bryanchasko.com/cloudcroft-disc-golf/app/`; vite copies
`web/public/data/panos/*.webp` to `app/data/panos/`. `web/src/config.ts`
(`PANOS[].file`) and `dataset/survey-assets.json` (`web_url`) use the same
relative `data/panos/<file>.webp` shape. Local md5s of
`dataset/panos-web/*.webp` and `web/public/data/panos/*.webp` match per file.

| code | pano_id      | photographer ground truth        | canonical public panorama                                                               | live check               |
| ---- | ------------ | -------------------------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| A    | `tee1-area`  | Community teebox 1               | https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_170324214.webp | 200 image/webp, 786224 B |
| B    | `basket1`    | Community hole 1, basket 1       | https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_171610748.webp | 200 image/webp, 543210 B |
| C    | `basket2`    | Community hole 2 (basket 2 area) | https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_173918101.webp | 200 image/webp, 573778 B |
| D    | `tiki-vista` | Byron Ligon teebox 3             | https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_175756282.webp | 200 image/webp, 900758 B |
| E    | `tiki-aspen` | Byron Ligon fairway 3            | https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_180216070.webp | 200 image/webp, 981838 B |
| F    | `tee2-area`  | Community teebox 2               | https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_173005849.webp | 200 image/webp, 950626 B |

F shipped 2026-11-02: committed (`dataset/panos-web/`, original under
`dataset/survey/2026-11-01-community/panos/`) plus a `deploy-web.sh` run —
live `survey-assets.json` counts 6 panos and the canonical F URL above
returns 200.

### Not public links — do not use as public embeds

- GitHub: `chasko-labs/cloudcroft-disc-golf` is **private** (verified via
  `gh repo view`). Unauthenticated `github.com/.../blob/main/dataset/PANO-INDEX.md`
  and `raw.githubusercontent.com/.../dataset/panos-web/*.webp` return 404.
  GitHub links are authenticated-team links only; never hotlink them in
  public pages.
- Legacy survey S3 / CDN path: `scripts/publish_panos.py` targets
  `https://bryanchasko.com/disc-golf/survey/panos/` with renamed
  `pano-{course}-{view}.jpg` files. On 2026-11-02 both a sample object and
  `panos.json` there returned 404, and the survey S3 prefix was probed
  empty. Do not claim any `s3://bryanchasko.com/disc-golf/survey/...` URL
  as a live public link until it is re-listed and returns 200. This
  contradicts the "synced" wording in `dataset/sources.md` and
  `dataset/survey/2026-11-01-community/MANIFEST.md`; those files are owned
  by the data workflow and are flagged here, not rewritten here.

## Embedded panoramas and paired field photos

Each panorama embed links to its full-size canonical file. Paired photos
are the geolocated field photos in `survey-assets.json`
(`data/photos/<file>.webp`), each HEAD-verified 200 image/webp on
2026-11-02.

### A — Community teebox 1 (`tee1-area`)

[![Community teebox 1 panorama](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_170324214.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_170324214.webp)

[![Hole 1 tee sign on stump](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_164814470.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_164814470.webp)

### B — Community hole 1, basket 1 (`basket1`)

[![Community basket 1 panorama](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_171610748.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_171610748.webp)

[![Basket 1 close-up with flag](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_171528886.MP.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_171528886.MP.webp)

### C — Community hole 2, basket 2 area (`basket2`)

[![Community basket 2 area panorama](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_173918101.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_173918101.webp)

[![Basket 2 wide, fairway behind](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_173801288.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_173801288.webp)

### D — Byron Ligon teebox 3 (`tiki-vista`)

[![Byron Ligon teebox 3 panorama](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_175756282.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_175756282.webp)

[![Byron Ligon teebox 3 rubber pad](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_175522409.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_175522409.webp)

### E — Byron Ligon fairway 3 (`tiki-aspen`)

[![Byron Ligon fairway 3 panorama, aspen grove](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_180216070.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_180216070.webp)

[![Byron Ligon fairway 3, aspen grove view](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_180320124.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_180320124.webp)

### F — Community teebox 2 (`tee2-area`) — live

[![Community teebox 2 panorama](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_173005849.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/panos/PXL_20261101_173005849.webp)

[![Hole 2 tee sign, 245 ft par 3](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_172609455.webp)](https://bryanchasko.com/cloudcroft-disc-golf/app/data/photos/PXL_20261101_172609455.webp)

## AWS Open Data provenance

The canonical Registry audit is [`docs/open-data-provenance.md`](../docs/open-data-provenance.md);
do not duplicate its dataset table here. This index retains image/link
evidence only. As of 2026-11-02, the only proven Registry-of-Open-Data-on-AWS
fetch in the shipped outputs is the NOAA Climate Normals station file behind
`dataset/climate-normals-cloudcroft.json`.

## Gaps for the owning workers (not fixed in this file)

- F (`173005849`) — resolved 2026-11-02: committed, deployed, canonical
  URL 200, live `survey-assets.json` counts 6 panos.
- D/E labels — resolved 2026-11-02: `web/src/config.ts` now labels D/E
  "Byron Ligon Hole 3 — tee box 3 / fairway 3, aspen grove", matching the
  photographer ground truth in this index. `pano_id`s `tiki-vista` /
  `tiki-aspen` stay as stable join keys.
- `dataset/sources.md` + survey `MANIFEST.md` S3 wording — corrected
  2026-11-02 to the probed state (prefix empty / 404 via the CDN path;
  re-list before claiming a sync).
- F pixel content read is still pending (position is proven; what the
  lens sees is not yet described).
