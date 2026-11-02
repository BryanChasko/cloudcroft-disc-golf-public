# story / game / media plan — audit pass (2026-11-02, uncommitted)

Scope: story page (`story/index.html`), the 2D hold-to-charge throw game in
it, the shared mountain-radio tuner, and media planning. Walk UI and
datasets were inspected read-only and not changed.

## what was changed (this pass, needs parent review + deploy)

1. `story/index.html`
   - Removed the three stock-nature strip figures (see relocation below).
   - Removed the public "SW Maps screenshots" gallery (20 phone screens)
     and its loader script; replaced with an archive pointer sentence.
     One curated framed figure (community tee 2) stays.
   - Dark-mode / readability fixes, all measured (WCAG ratio, table below):
     page links previously had no color rule (browser blue 2.98:1 and
     visited purple 1.51:1 on the dark card); skip-link was white on the
     dark theme's light-mint pine (1.50:1); basket pole was hard-coded
     `#143d2a` on the dark card (1.37:1, effectively invisible); the
     light-mode "over par" chip text was 3.34:1. All now use theme tokens
     that pass AA in both themes.
   - Responsive: judges deck gets more height under 640px (absolutely
     positioned cards could overlap the next section); throw-game flight
     path and basket position shrink under 640px (fixed 660px path
     overflowed phones); scorecard rows and the power bar reflow under
     480px. Verified `overflowX: 0` at 1280px and 390px.
   - Throw game: the playable set is now exactly Community 1 and Byron
     Ligon Tiki 3, with Community 3 disabled as "awaiting survey"; every
     playable hole prints a one-line provenance with map-data source,
     minimap, and panorama links, and swaps a translucent real-pano
     backdrop.
2. `web/public/shared/radio-tuner.js` (source only — needs a web build to
   reach `web/dist/shared/` and live)
   - Play button and pressed station chip were white on the dark theme's
     light-mint pine (1.50:1). They now flip to dark ink under
     `html[data-theme="dark"]` and `data-theme="auto"` + OS dark.
   - Station description no longer truncates with an ellipsis on narrow
     screens (`white-space: nowrap` removed, slightly larger text).

### measured contrast (computed, AA = 4.5:1 for text)

| pair                                        | before                   | after                                                      |
| ------------------------------------------- | ------------------------ | ---------------------------------------------------------- |
| muted text on paper/card, both themes       | 5.49–8.34 pass           | unchanged                                                  |
| link on dark card                           | 2.98 fail (visited 1.51) | 11.04 (mint) / visited lavender, pass                      |
| link on light card                          | 5.57 pass                | pine + underline offset, pass                              |
| white on dark-theme pine (radio, skip-link) | 1.50 fail                | 12.38 (dark ink on mint)                                   |
| basket pole on dark card                    | 1.37 fail                | theme token, 11.04 dark / pine light                       |
| over-par chip, light                        | 3.34 fail                | darkened amber text, dark theme keeps bright accent (8.85) |

## strip images removed — relocation inventory for the private blog

Provenance problem, not a taste problem: `dataset/survey/2026-11-01-community/MANIFEST.md`
states zip2 is "older stock nature photos (birds, wildflowers, cows,
2021–2022) — NOT survey, excluded from the scorecard pipeline; extracted
set lives in `_incoming/zip2/` for blog/BRAND art." The story page
captioned them as the course setting ("Small things along the fairways",
"The neighbors — open range shares the rough"), implying course
photography. They are not November 1 survey photos and two panels are
not verifiably on either course.

Removed from `story/index.html` (files left in `story/assets/` untouched
for the parent to move; `scripts/deploy-story.sh` syncs without
`--delete`, so the live copies stay reachable by direct URL until the
parent deletes them from the prefix):

| file                                                 | panels (viewed)                                                                         | suggested private-blog home                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `story/assets/strip-setting-1584x340.webp` (108K)    | pine trail + red sign; treetops/sky; pole-teepee frame in aspen                         | a Sacramento Mountains / Cloudcroft town post — the teepee-frame panel reads as a village/park scene, not a fairway |
| `story/assets/strip-wildflowers-1584x340.webp` (93K) | meadow with spruce and yellow blooms; pink phlox-type blooms; purple penstemon close-up | a wildflower/naturalist post; needs species IDs before any public caption                                           |
| `story/assets/strip-neighbors-1584x340.webp` (86K)   | cow + calf on dry range; red cow portrait; small flycatcher-type bird                   | an open-range/valley-floor post; the range panels are not the wooded course rough                                   |

Replacement if a setting visual is wanted back: build a new strip only
from the 15 GPS-tagged November 1 survey photos (already captioned in
the photo gallery above the section), so every panel carries a real
coordinate.

## SW Maps screenshot leakage

What leaked and where:

- The story page rendered all 20 phone screenshots from
  `data/survey-assets.json`, each linking to the full-size image.
  Recording screens carry precise fix readouts (8-decimal lat/lon,
  accuracy, averaging count) plus the device status line (time, signal,
  battery). Course coordinates themselves are intentionally public (the
  points table prints them), so the leak is the raw phone UI and the
  full capture run, not a secret location.
- The screenshot thumbnails were `object-fit: cover` crops — unreadable
  as evidence, only useful as a link farm to the raw screens. Nothing
  of evidentiary value was lost by removing the gallery; the framed
  tee-2 figure and the points table already carry the proof.

Still public, outside this pass's scope (dataset/web owners):

- `web/dist/data/screenshots/` (20 `.webp`) remains served from the app
  prefix, and `survey-assets.json` still lists them (`counts.screenshot: 20`).
  Deciding whether they stay in the dataset export is a dataset-owner
  call; the story page no longer surfaces them.

## throw game — hole-by-hole verified metrics

Formula check on Community 1 from the served holes file: tee
`community-tee-1` 32.962394, -105.742411 (elevation 2638.3m, horizontal
accuracy 7.7m) to basket `community-basket-1` 32.961246, -105.742036
(2666.0m, accuracy 13.8m) = 434 ft straight-line, +91 ft up. The sign
distance is 411 ft; the 23 ft delta sits inside the combined GPS
accuracy, and straight-line is not the played fairway line. Game keeps
411 ft and says so.

| game hole                                | distance / par           | source of record                                                                                                                      | ground geometry                                                                                                                                                                                                                                                     | pano / minimap wired                                                                                                                   |
| ---------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Community 1 (playable, provenance added) | 411 ft, par 4 pro / 5 am | SW Maps tee remark (`cloudcroft-community.json` holes[0], status `surveyed`)                                                          | tee + basket averaged GPS points; +91 ft elevation                                                                                                                                                                                                                  | `?course=community&hole=1`; pano `tee1-area` as throw-stage backdrop                                                                   |
| Byron Ligon Tiki 3 (playable)            | 133 ft, par 3            | Radius Disc Golf remote listing (`byron-ligon-tiki.json` holes[2], status `remote`, `distances_source: Radius Disc Golf course page`) | none — 6 Tiki GPS points are all `unidentified`; listing self-checks: 39+118+133+134+66+67+89+128+127 = 901 ft = course `length_ft`                                                                                                                                 | `?course=tiki` (no per-hole fly-to until pins land); panos `tiki-vista` (tee box 3, throw-stage backdrop) and `tiki-aspen` (fairway 3) |
| **Community 3 (new, locked/disabled)**   | **none — do not invent** | holes[2] is `scaffold` / `awaiting survey`, no par or distance anywhere in repo                                                       | **basket 3 photographed only: `PXL_20261101_164414699.jpg` at camera GPS 32.962911, -105.741900. Its sign reads "TEE #4 · 80 FT" with an arrow — the walk to tee 4, explicitly not hole 3's length. Hole-2 sign photo also confirms only a tee-3 direction arrow.** | none until surveyed; button disabled with the reason printed on the page                                                               |

Unlock condition for Community 3: one field visit capturing (a) tee-3
averaged point, (b) tee-sign photo with par/distance, (c) basket-3
averaged point. Then it enters the holes file through the existing
pipeline and the game with one `HOLES` entry — no other code change.
Same for Tiki 3 ground truth: identify which of the 6 unlabelled Tiki
points (or new points) are tee/basket 3 before calling it surveyed.

Game-feel note: sweet bands (Tiki 3: 48–58%) are game scaling chosen so
the putter hole plays easier than the 411 ft uphill (86–96%); the code
now labels them "game scaling, not physics". Plays-like adjustment from
the real +91 ft on Community 1 is a documented next step, not faked here.

## grids (story page, inspected)

- Photo/panorama galleries: `repeat(auto-fill, minmax(180px, 1fr))`,
  fixed-height cover crops. Works; caption text bumped 0.76rem → 0.82rem.
  Panorama thumbs remain wide crops, acceptable as "tap to stand there".
- Points table: white-space nowrap inside an `overflow-x: auto` wrapper
  — correct on phones (scrolls, no page overflow; verified).
- Survey dots: 27 buttons at 1.05rem — below comfortable touch size;
  flagged, not changed (walk/map owners may prefer a shared pattern).
- Course stat grids and `grid-2` figures collapse cleanly at 640px.

## costed media queue — $7.50 soft budget, $0 spent, approval required

Nothing below was called or purchased. Prices marked "estimate" must be
re-checked on the provider pricing page at approval time; local items
are free except machine time on this host (RX 6700 XT). Priority order
is free-first; the paid rows fit the cap only if the parent approves
them line by line.

| #   | item                                                                                                | why                                                                         | route                                                                                                         | est. cost                         |
| --- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | Replacement 3-panel setting strip built from real Nov 1 survey photos                               | fills the gap the stock strips left, honest provenance                      | local crop/composite (ImageMagick or Python Pillow), same 1584x340 canvas                                     | $0.00                             |
| 2   | Basket/disc cutouts (segment basket 3 and basket 1 photos for game/minimap sprites)                 | game currently uses an inline SVG basket; real cutouts tie it to the course | local Segment Anything (SAM) on the RX 6700 XT, or local `rembg` fallback                                     | $0.00                             |
| 3   | Real-pano throw-stage backdrop (translucent, decorative)                                            | visual tie to each hole without new art                                     | implemented with existing panos: `tee1-area` for Community 1 and `tiki-vista` for Byron Ligon 3               | $0.00                             |
| 4   | Ambient background audio loop (wind/pines/birds bed, ~60s, for optional game toggle)                | requested media class; must be opt-in, never autoplay                       | local generation (MusicGen/Stable Audio class model on local GPU) or a field recording on the next survey day | $0.00                             |
| 5   | One generated hero texture (topo-line / pine duotone background art) if a designed header is wanted | only if real-photo art (item 1) is judged insufficient                      | local ComfyUI SDXL presets already wired on this host (`sdxl-txt2img`, `sdxl-hero-blog`, `sdxl-diagram`)      | $0.00                             |
| 6   | Hosted image generation, 10-image batch (only if local SDXL quality fails review)                   | faster art direction for a blog hero                                        | Amazon Bedrock image model (Nova Canvas class), estimate ~$0.04–0.08/image — verify before approval           | est. $0.40–0.80                   |
| 7   | Short narration for a demo clip (~600 characters) if a voiceover is approved                        | demo video is already listed as "still to come" on the page                 | Amazon Polly standard voice, estimate ~$4 per 1M characters — verify before approval                          | est. < $0.01                      |
| 8   | Hosted audio generation, 2 short ambient takes (only if local audio fails review)                   | alternative to item 4                                                       | provider + per-second pricing to be quoted at approval; hard cap this row                                     | est. ≤ $2.00 (cap)                |
|     | **total if every paid row is approved**                                                             |                                                                             |                                                                                                               | **est. ≤ $2.81 of the $7.50 cap** |

Recommendation: approve items 1–4 only ($0.00) for the next pass. Hold
items 6–8 until a human reviews local output; there is no schedule
reason to spend.

## blockers and handoffs

- Community 3 playability is blocked on field data (above). No software
  blocker.
- Radio tuner fix is source-only until the parent runs the web build
  (`cd web && npm run build`, then the normal deploy). The live story
  loads the tuner from `/cloudcroft-disc-golf/app/shared/radio-tuner.js`,
  i.e. the last built copy — verified in a local render that the built
  copy still shows white-on-mint in dark while the patched source does
  not apply yet.
- Removed strip images remain in `story/assets/` and (sync without
  `--delete`) at their live URLs until the parent moves them to the
  private blog and deletes the prefix copies.
- `web/dist/data/screenshots/` publication decision belongs to the
  dataset owner.
- This checkout also carries unrelated uncommitted walk changes
  (`web/src/walk.ts`, `web/src/walk.css`, `web/walk.html`) from other
  work — untouched by this pass; the parent should not attribute or
  commit them with these changes.

## verification evidence (this pass)

- Contrast and hole math computed by script (table above; straight-line
  haversine over the served holes JSON).
- Local render of the real page (headless Chromium, story + built app
  served under the production prefixes): zero console/page errors;
  strips 0, screenshot gallery absent, four hole buttons with Community
  3 disabled; dark link color renders `rgb(168,223,192)`, basket stroke
  follows the theme token; no horizontal overflow at 1280px or 390px;
  hold-to-charge exercised with real pointer input on Tiki 3 in both
  themes ("Cage low" and "Chains!" outcomes, provenance line swaps).
- `node --check` passes on the extracted story scripts and on the
  patched radio tuner. No deploy was run and nothing was committed.
