# critique-1 — Cloudcroft disc golf walkthrough, played cold

- build: /home/bryanchasko/code/chasko-labs/cloudcroft-disc-golf/web/dist/walk.html, served locally at /disc-golf/ prefix
- played headless (chromium + software GL): desktop 1280x800 and phone 390x844, drag orbit, scroll zoom, all 8 toolbar buttons, WASD/arrows long holds, shift, drag-look, tap
- screenshots: /tmp/w3d/crit1/*.png (all opened and checked); zero console errors and zero page errors on desktop and phone runs
- software-renderer slowness is excluded throughout

## 1. running 3D world at once or after one obvious click — yes

- player opens the URL and a complete 3D village is already rendering with no click, no loader, no error box, no blank or black patch: 01-cold-1.5s.png (1.5 s after load), identical at 02-cold-6.5s.png and 03-open.png

## 2. keeps running through all play — yes

- orbit drags, zooms, both fly-tos, walk mode with long W/A/S/D and arrow holds, shift runs, all toggles, pano button, VR button, phone tap: no error, freeze, crash, explosion, or stuck state in any shot; every mode exits via the Orbit button: full set 01 through 52

## 3. parallax and solid subject from side, behind, above — yes

- near cones slide against far terrain on every drag; the village, labels, basket and windsock hold together from the opening high oblique (03-open.png), both horizontal orbit directions (04-orbit-drag0.png, 04-orbit-drag1.png), low grazing angle (04-orbit-drag2.png), zoom in/out (05-zoom-in.png, 06-zoom-out.png), community fly-to side view (46-community-side.png), and tilted slab view (50-topdown.png); trees are solid cones from all sides, no hollow backs, holes, or cut-outs seen

## 4. every control does what is expected, at once, easy to work out — not yet

- works: drag orbits, scroll zooms, Tiki course and Community course fly to the courses (07-community.png, 08-tiki.png), Orbit and Walk (WASD) switch modes with status-line guidance, WASD/arrows walk with long holds (11/12/13/14-walk-*.png, 48-walk-arrowup.png), shift hurries (49-walk-shift-w.png), drag looks around in walk mode (47-walk-lookleft.png), Enter VR gives an honest fallback line, phone tap does not break anything (32-phone-tap.png)
- fails: Trails and Forest buttons flip only their own highlight while the 3D scene stays pixel-identical (40-orbit-trails-on.png vs 41-orbit-trails-off.png; 40 vs 43-orbit-forest-off.png; 15/16 and 17/18 pairs), and Stand at Tiki (360) changes only the status line while the camera stays put (51-at-community.png vs 52-after-stand-tiki.png are the same frame; 19-stand-tiki.png matches 14-walk-d.png)

## 5. what should move moves, smoothly and believably — yes

- walking advances, fly-to glides between courses, drag-look pans, and the Tiki windsock points a different direction from shot to shot (14-walk-d.png, 15-trails-off.png, 16-trails-on.png, 18-forest-on.png, 19-stand-tiki.png), so it animates; nothing stutters, jumps, freezes mid-motion, or flies off; the walk-through-basket collision failure is scored under 10, not here

## 6. stranger names the subject at a glance; brief fully shown — not yet

- the subject reads: title bar says Cloudcroft disc golf, two labeled course pins sit on the terrain (Byron Ligon Tiki 9 holes par 27; Community 18 holes par 63), a basket and windsock stand at Tiki: 03-open.png, 10-walk-mode.png
- not everything the brief says is on screen: no trail ribbons appear in any of the 38 scene shots from any angle or distance, and only one windsock exists (Tiki) with none visible at Community (45-community-close.png, 46-community-side.png, 51-at-community.png)

## 7. brief line by line, there and working — not yet

- DEM terrain draped with aerial imagery: yes, relief + town imagery across every orbit shot
- OSM trail ribbons: not yet, none visible anywhere (03-open.png, 40-orbit-trails-on.png, 50-topdown.png)
- two course pins with labels: yes, both labels legible from orbit (03-open.png); basket pins seen at both courses (10-walk-mode.png, 45-community-close.png)
- illustrative instanced forest: yes, cone forest everywhere, disclosed as illustrative in the hint bar
- windsocks: partly, one animating windsock at Tiki only (10-walk-mode.png)
- orbit: yes; WASD walk: yes; fly-to: yes (07-community.png, 08-tiki.png)
- layer toggles: not yet, Trails/Forest change nothing in-scene (40 vs 41 vs 43)
- pano placeholder: not yet, the button moves nothing and opens nothing visible (51 vs 52)
- VR toggle with honest no-headset fallback: yes, status reads "no immersive-vr headset found — orbit and walk modes work now" (22-vr.png, 23-vr-dismiss.png)

## 8. more beyond the list worth a player's time — yes

- a whole village to orbit and walk, two fly-to courses, drag-look, arrows, shift hurry: 04/05/06 orbit set, 11–14 walk set, 47-walk-lookleft.png, 49-walk-shift-w.png; the basket-plus-windsock close-up gives a ground-level point of interest (10-walk-mode.png)

## 9. light, shadow, material, colour, composition, close-up detail — not yet

- from orbit the diorama reads: shaded cone faces give a light direction, aerial imagery reads as town and fields, greens/sky/town colours sit together, labels lead the eye to the two courses: 03-open.png, 04-orbit-drag1.png, 06-zoom-out.png
- fails two of the listed criteria: no contact shadows ground the trees where trunks meet terrain (visible in 05-zoom-in.png, 45-community-close.png), and close-up terrain dissolves into smeared streaks rather than holding detail (11-walk-w.png, 12-walk-a.png, 13-walk-s.png, 48-walk-arrowup.png, 49-walk-shift-w.png)

## 10. show to a friend as-is, nothing half-done — not yet

- no: the walk spawn faces the basket and a first W hold parks the camera inside it (11-walk-w.png); two toolbar buttons and the pano button visibly do nothing (40/41/43, 51/52); the Tiki label is half-swallowed by trees after fly-to (08-tiki.png, 09-orbit-btn.png); on phone a course label renders as a black bar clipped at the top of the canvas (31-phone-walk.png, 32-phone-tap.png)

## verdict: not ready

## shortfalls, most-noticed-first

1. shot 11-walk-w.png — player holds W from the walk spawn and the camera drives into/through the basket: the green pad fills the screen with the pole through the middle. change: spawn offset so forward motion clears the basket, plus a stop radius around pins and trees.
2. shots 40-orbit-trails-on.png vs 41-orbit-trails-off.png vs 43-orbit-forest-off.png — Trails and Forest buttons flip highlight only; the forest and (absent) trails never change. change: wire both buttons to their layers' visibility.
3. shots 51-at-community.png vs 52-after-stand-tiki.png (identical) and 19-stand-tiki.png — Stand at Tiki (360) never moves the camera and opens no pano; only status text changes. change: fly to the Tiki viewpoint and show a visible placeholder pano panel.
4. shots 03-open.png, 40-orbit-trails-on.png, 50-topdown.png — no OSM trail ribbons visible from any angle or height. change: draw the trail ribbons raised above the terrain so they read at orbit distance.
5. shots 08-tiki.png, 09-orbit-btn.png, 21-after-pano.png — the Tiki course label renders behind the cones at low angles ("By…igon Tiki"). change: draw labels on top of trees or anchor them above the canopy.
6. shots 45-community-close.png, 46-community-side.png, 51-at-community.png — Community course has a basket but no windsock; the brief says windsocks. change: add a windsock at Community.
7. shots 31-phone-walk.png, 32-phone-tap.png — on phone a half-visible course label sits as a black bar clipped at the top edge of the canvas. change: clamp or hide labels whose anchor is off-screen.
8. shots 11/12/13-walk-*.png, 48-walk-arrowup.png, 49-walk-shift-w.png — ground-level terrain is smeared streaks wherever the player walks. change: add near-ground detail or raise the walk eye height so the smear band stays out of view.
9. shot 50-topdown.png — at extreme tilt the world reads as a slab edge over a dark void. change: add a ground skirt or distance fog so the edge never shows void.
