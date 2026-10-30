# critique-2 — Cloudcroft disc golf walkthrough, round-2 verification

- build: /home/bryanchasko/code/chasko-labs/cloudcroft-disc-golf/web/dist/walk.html, served locally at /disc-golf/ prefix on http://127.0.0.1:8901
- played fresh headless Chromium (SwiftShader), desktop 1280x800 and phone 390x844: full orbit extremes, scroll zoom, both fly-tos, Trails/Forest toggle pairs with restore, walk mode with W/A/S/D + arrows + shift + drag-look + long W hold, Stand at Tiki incl. dismiss, VR button, phone tap/orbit/stand
- screenshots: /tmp/w3d/crit2/_.png (36 scenes, every one opened and zoom-checked) + /tmp/w3d/crops/zoom-_.png crops; zero console errors and zero page errors on desktop and phone runs
- pixel-diff cross-checks (scene region only): trails on/off 0.72% changed, forest on/off 4.72%, stand-at-tiki 83.59% — all confirmed by eye in the zoom crops, not trusted on numbers alone
- round-1 fix scorecard: 7 of 9 fixed, 1 partial, 1 still open (see shortfalls)

## 1. running 3D world at once or after one obvious click — yes

- full village rendering 1.5 s after cold load with status already "walkthrough ready": 01-cold-1.5s.png, identical at 02-cold-settled.png and 03-open.png. no click, loader, error box, or blank patch.

## 2. keeps running through all play — yes

- every drag, zoom, fly-to, toggle, walk hold, shift run, drag-look, pano open/dismiss, VR fallback, and phone gesture completes with no error, freeze, or stuck state; every mode exits via its button: full set 01 through 54.

## 3. parallax and solid subject from side, behind, above — yes

- near cones slide against far terrain on all drags; village, labels, baskets, windsocks hold together from opening oblique (03-open.png), both orbit directions (04/05), top-down (06/08), low tilt (09), fly-to sides (10/11/46), and ground level (30–38): no hollow backs, holes, or cut-outs. trees now have trunks and read solid from all sides.

## 4. every control does what is expected, at once, easy to work out — yes

- all round-1 control failures are fixed. Trails removes every orange ribbon in-scene (20 vs 21, zoom-trails-on vs zoom-trails-off crops) and restores on re-press (22). Forest removes every cone (23 vs 24) and restores (25). Stand at Tiki (360) flies the camera from Community orbit to the Tiki tee at ground level, flips mode to Walk, and opens the pano card with a working Keep walking dismiss (40 vs 41 vs 42). drag/scroll/fly-to/WASD/arrows/shift/drag-look/tap/VR all behave as in round 1.

## 5. what should move moves, smoothly and believably — yes

- walking advances, fly-to glides, drag-look pans, and the Tiki windsock points a different direction across 30/33/34, so it animates; nothing stutters, jumps, or flies off. no object penetration seen in any shot (zoom-basket-close.png: pole face and pad surface render correctly from outside at touching distance).

## 6. stranger names the subject at a glance; brief fully shown — yes

- title bar says Cloudcroft disc golf; both course pins carry legible white-on-dark labels (Byron Ligon Tiki 9 holes par 27; Community 18 holes par 63); orange trail ribbons now read across the terrain from orbit (03/04/05/08); baskets AND windsocks stand at both courses (41/42 Tiki, 12/13 Community).

## 7. brief line by line, there and working — yes

- DEM terrain draped with aerial imagery: yes, relief + town imagery in every orbit shot, crisp in zoom-in (07-zoom-in.png)
- OSM trail ribbons: yes now, orange lines visible at all orbit distances and angles (03/06/08/10/11)
- two course pins with labels: yes, legible from orbit and drawn above the trees at low angles (11/45/46)
- illustrative instanced forest: yes, disclosed in the hint bar, now with trunks
- windsocks: yes now, Tiki (41) and Community (12/13)
- orbit: yes; WASD walk: yes; fly-to: yes (10/11)
- layer toggles: yes now, both visibly change the scene (20/21, 23/24)
- pano placeholder: yes now, camera flies to the tee and a readable card opens on desktop (41) and phone (54), dismiss works (42)
- VR toggle with honest no-headset fallback: yes, status reads "no immersive-vr headset found — orbit and walk modes work now" (43-vr.png)

## 8. more beyond the list worth a player's time — yes

- whole village to orbit and walk, two fly-tos, drag-look, shift hurry, long walk holds that travel (38), phone play that works: 04–09 orbit set, 30–38 walk set, 50–54 phone set.

## 9. light, shadow, material, colour, composition, close-up detail — not yet

- orbit reads well: shaded cone faces give a light direction, town/aerial colours sit together, labels lead the eye, zoom-in terrain is crisp (07)
- still fails on two counts: (a) the lower ~40% of EVERY walk-mode frame is smeared streaky ground with no detail (30/31/32/33/34/35/36/37/38, 41/42, phone 51/52/53) — unchanged from round 1; (b) no contact shadows ground the tree trunks where they meet the terrain (crops/zoom-treebases.png), though the new trunks ground them far better than the old floating cones. basket/pad close-ups are clean flat-shaded surfaces (zoom-basket-close.png).

## 10. show to a friend as-is, nothing half-done — not yet

- almost: no walk-through-basket (31/36/38 stay outside), every button visibly works, labels legible everywhere on desktop, no phone black bar (50–54)
- remaining rough edges: the smeared walk foreground fills half the screen in walk mode; at extreme tilt the slab edge still reads against a flat dark backdrop (09-topdown.png — much improved from round 1's pure black void, now a dark-green gradient with grey horizon haze, but the floating-slab lip is still visible); on phone the Community label is half-clipped at the left canvas edge in the opening frame (50-phone-open.png)

## verdict: not ready

## shortfalls, most-noticed-first

1. shots 30–38, 41, 51/52/53 — walk-mode foreground is still smeared streaks across the lower half of every ground-level frame; neither near-ground detail nor raised eye height appears to have changed since round 1. change: raise the walk eye height and/or pitch the default view up so the smear band leaves the frame, or add a near-ground detail texture. this is the single most visible flaw left and the only round-1 item still fully open.
2. shot 09-topdown.png vs crit1 50-topdown.png — extreme tilt improved from black void to dark-green gradient with horizon haze, but the terrain edge still reads as a floating slab lip. change: extend a ground skirt at terrain-edge height or deepen the distance fog so the lip never silhouettes. partial fix, minor.
3. crops/zoom-treebases.png — tree trunks still meet the terrain with no contact shadow. change: blob shadow or darkening disc under each trunk. minor; the new trunks already ground the trees much better.
4. shot 50-phone-open.png — Community label half-clipped at the left canvas edge on phone ("…munity" pill). change: clamp label pills fully inside the canvas horizontally. minor; the round-1 top black bar itself is gone.
5. shots 31/36 — no hard stop radius: shift-W can still park the camera within touching distance of the basket pole/pad. no penetration occurs anywhere (verified in zoom-basket-close.png), so this is polish, not a bug. change (optional): small collision radius around pins and poles.
