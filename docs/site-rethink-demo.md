# site rethink — demo of building an AR disk golf scorecard (2026-11-01)

## what we actually have (ground truth)

- community (18 holes nominal): 21 averaged points. named: tee-1 (pro-par 4,
  am-par 5, 411 ft), basket-1 (trail notes), tee-2 (par 3, 245 ft, mando
  right, fence-line OB right). 18 attached SW Maps photos (kiosk, tee signs,
  hole signs). 15 Pixel photos with GPS, 5 panos. hole-2 sign photo gives
  par/distance/mando/OB visually. holes 3-18: nothing. hole-2 basket: photo
  yes, named point no.
- byron ligon tiki (9 holes nominal): 6 points, 3 photos, all unnamed
  (unknown-teebox x2, pano fairway). pars known remotely (validator note).
- pipeline: validate_survey.py + build_holes.py + tests, DEM/NAIP/OSM
  dataset, Amazon Location map, Rust lambdas, scorecard backend.
- current site: MapLibre map + course tabs + walkthrough page. it hard-
  assumes complete courses (holes files drive the scorecard table).

## the rethink

old premise: complete map of two courses. new premise: a public demo of
how an AR disk golf scorecard gets built, hole by hole, with real survey
data where it exists and honest scaffolding where it does not. the gap
between surveyed and not-yet is a featured state, not an embarrassment.

### structure (hybrid, recommended)

1. hero: live map centered on community holes 1-2 with surveyed pins lit;
   remaining holes drawn as faint "survey pending" ghosts. one-line
   status: "2 holes surveyed, 16 to go — watch a scorecard get built."
2. playable card: holes that have data are fully playable (score entry,
   plays-like distance). holes without data render as scaffold rows:
   hole number, par if known (sign photos / remote), otherwise "awaiting
   survey". scoring works today for a 2-hole round; it grows as surveys land.
3. how-built strip: the reproducible procedure as a visual story —
   SW Maps field capture (framed screenshots) -> .swmz archive ->
   swm2_to_geojson.py -> validate_survey.py -> build_holes.py -> this map.
   each step shows the real artifact (real remark text, real GeoJSON).
4. field evidence: photo strip per surveyed hole (tee sign, basket,
   fairway) using the labeled survey photos; tiki shows its 6 unnamed
   points as "located, not yet identified" with photos — an invitation.
5. scaffolding made explicit: every data-driven component reads from
   points.geojson, so the next survey drop fills holes without code
   changes. validator output (counts, gaps) rendered on a status panel.

### alternatives

- story-first: lead with the blog narrative, scorecard as appendix.
  safer for readers, weaker as a demo of the product.
- map-first: keep current hero map, add survey-status overlay + scaffold
  cards. least change, least story.

## build order (hybrid)

1. data adapter: map partial points.geojson into the holes-file schema
   (holes 1-2 community real, rest scaffold rows with par source tagged:
   sign-photo / remote / unknown). validator gains a --partial mode that
   reports coverage instead of failing on counts.
2. web: scorecard renders scaffold rows distinctly; map draws ghost pins;
   how-built section from real artifacts; evidence photos wired per hole.
3. art: 3 BRAND strips (nature set) + framed SW Maps figures
   (blog/assets/cloudcroft-disc-golf/, per BRAND.md + lay-strip-3panel.py).
4. deploy web bundle; site stays honest at every size of survey.

## non-goals for v1

tiki hole identification (needs bryan's memory of the teebox), panic
about tracks (none recorded), website-side pages in bryan-chasko-com
(separate onboarding per s3-prefix-registry).
