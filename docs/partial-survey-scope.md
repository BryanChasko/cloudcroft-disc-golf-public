# scope adjustment — scorecard process proof (2026-11-01)

supersedes the full-walkthrough premise. bryan brought back partial
readings from the community course only (holes 1-4 area), so the goal is
narrowed: prove the end-to-end process for building AR disk golf
scorecards on a small slice, then repeat per course.

## repos: two, not one

- `chasko-labs/cloudcroft-disc-golf` — the build. AR map + scorecard,
  dataset pipeline (`dataset/scripts/validate_survey.py`, `build_holes.py`
  with tests), backend, web, android. survey data lives in
  `dataset/survey/`. this is where all scorecard work happens.
- `chasko-labs/bryan-chasko-com` — the website host. no disc-golf content
  in it today. when scorecard pages are ready to publish they ship as a
  sibling prefix (e.g. `disc-golf/`) under bryanchasko.com, onboarded in
  `s3-prefix-registry.json` with deploy.sh excludes per the ops rule.
  website work stays out until the scorecard process is proven.

## proof scope (this slice)

input: `dataset/survey/2026-11-01-community/` — 15 photos, 5 panos,
20 screenshots, 2 transcribed SW Maps points. see MANIFEST.md.
step 1 (done): ingest + label + GPS verify.
step 2 (blocked on phone): SW Maps export — GeoJSON/GPX points + track.
step 3: run validator + hole builder on holes 1-4, confirm a scorecard
renders from partial data and gaps are reported, not silently filled.
step 4 (reviewed, deliberate): any QPU-style paid step equivalent here is
none — but pano S3 sync and any paid map tile usage get the same
deliberate treatment: bryan runs them.

## out of scope until proof passes

tiki course survey, remaining community holes, website pages, S3 pano
sync (bryan runs it), on-site QA numbers (loads/saves/glitches pending
from bryan).
