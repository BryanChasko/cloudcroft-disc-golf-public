#!/usr/bin/env python3
"""Build the 3-minute hackathon demo deck (v1, 2026-11-02).

Run: python3 docs/demo-deck-v1-build.py
Output: docs/cloudcroft-disc-golf-demo-deck-v1-2026-11-02.pptx
All imagery is read from this repo. Nothing is invented or downloaded.
"""
import io
from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "cloudcroft-disc-golf-demo-deck-v1-2026-11-02.pptx"

# palette drawn from the live site + field photos (deep green, cream, basket yellow)
GREEN = RGBColor(0x14, 0x3D, 0x2A)
DARK = RGBColor(0x0B, 0x24, 0x18)
CREAM = RGBColor(0xF7, 0xF3, 0xE8)
YELLOW = RGBColor(0xF2, 0xC2, 0x00)
SAGE = RGBColor(0xB9, 0xD3, 0xC0)
RED = RGBColor(0xC0, 0x39, 0x2B)
GREY = RGBColor(0x5A, 0x6B, 0x5E)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]
W, H = 13.333, 7.5


def bg(slide, color):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(W), Inches(H))
    sh.fill.solid(); sh.fill.fore_color.rgb = color; sh.line.fill.background()
    sh.shadow.inherit = False
    return sh


def box(slide, x, y, w, h, fill=None, line=None, round_=False):
    shp = MSO_SHAPE.ROUNDED_RECTANGLE if round_ else MSO_SHAPE.RECTANGLE
    sh = slide.shapes.add_shape(shp, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line; sh.line.width = Pt(1)
    sh.shadow.inherit = False
    return sh


def text(slide, x, y, w, h, runs, size=20, bold=False, color=CREAM,
         align=PP_ALIGN.LEFT, font="Calibri", leading=1.05, anchor=MSO_ANCHOR.TOP):
    """runs: str, or list of paragraphs; each paragraph is str or list of (txt, dict)."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = anchor
    if isinstance(runs, str):
        runs = [runs]
    for i, para in enumerate(runs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align; p.line_spacing = leading
        p.space_after = Pt(6)
        items = [(para, {})] if isinstance(para, str) else para
        for txt, st in items:
            r = p.add_run(); r.text = txt
            r.font.size = Pt(st.get("size", size)); r.font.bold = st.get("bold", bold)
            r.font.color.rgb = st.get("color", color); r.font.name = st.get("font", font)
            r.font.italic = st.get("italic", False)
    return tb


def pic(slide, path, x, y, w=None, h=None, alt="", crop=None):
    """Add a picture from the repo with PowerPoint alt text (descr)."""
    p = ROOT / path
    assert p.exists(), f"missing asset: {p}"
    im = Image.open(p)
    if crop:  # crop = (left, upper, right, lower) fractions
        iw, ih = im.size
        im = im.crop((int(crop[0]*iw), int(crop[1]*ih), int(crop[2]*iw), int(crop[3]*ih)))
    if im.mode != "RGB":
        im = im.convert("RGB")
    if max(im.size) > 1920:  # deck-resolution cap; originals stay in the repo
        im.thumbnail((1920, 1920), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=84, optimize=True); buf.seek(0)
    kw = {}
    if w: kw["width"] = Inches(w)
    if h: kw["height"] = Inches(h)
    shape = slide.shapes.add_picture(buf, Inches(x), Inches(y), **kw)
    shape._element.nvPicPr.cNvPr.set("descr", alt)
    shape.name = Path(path).name
    return shape


def notes(slide, body):
    slide.notes_slide.notes_text_frame.text = body


def header(slide, kicker, title, timing):
    box(slide, 0, 0, W, 1.28, fill=GREEN)
    box(slide, 0, 1.28, W, 0.07, fill=YELLOW)
    text(slide, 0.55, 0.16, 9.5, 0.35, kicker.upper(), size=13, bold=True, color=YELLOW)
    text(slide, 0.55, 0.48, 9.5, 0.7, title, size=31, bold=True, color=CREAM)
    box(slide, 11.05, 0.32, 1.75, 0.62, fill=DARK, round_=True)
    text(slide, 11.05, 0.42, 1.75, 0.45, timing, size=15, bold=True,
         color=YELLOW, align=PP_ALIGN.CENTER)


def footer(slide, n, label="cloudcroft disc golf - live demo - bryanchasko.com/cloudcroft-disc-golf/"):
    text(slide, 0.55, 7.08, 10.5, 0.3, label, size=11, color=GREY)
    text(slide, 12.4, 7.08, 0.4, 0.3, str(n), size=11, color=GREY, align=PP_ALIGN.RIGHT)


def bullets(slide, x, y, w, items, size=19, color=RGBColor(0x1D, 0x2B, 0x20), gap=10):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(max(0.5, 7.0 - y)))
    tf = tb.text_frame; tf.word_wrap = True
    for i, it in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(gap); p.line_spacing = 1.08
        parts = [(it, {})] if isinstance(it, str) else it
        r = p.add_run(); r.text = "▸  "; r.font.size = Pt(size); r.font.bold = True
        r.font.color.rgb = GREEN; r.font.name = "Calibri"
        for txt, st in parts:
            r = p.add_run(); r.text = txt
            r.font.size = Pt(st.get("size", size)); r.font.bold = st.get("bold", False)
            r.font.color.rgb = st.get("color", color); r.font.name = "Calibri"
            r.font.italic = st.get("italic", False)
    return tb


def chip(slide, x, y, w, txt, fill, color=CREAM, size=13):
    box(slide, x, y, w, 0.42, fill=fill, round_=True)
    text(slide, x+0.1, y+0.07, w-0.2, 0.3, txt, size=size, bold=True,
         color=color, align=PP_ALIGN.CENTER)


# ---------------------------------------------------------------- slide 1
s = prs.slides.add_slide(BLANK); bg(s, DARK)
pic(s, "web/public/evidence/hole1-basket.jpg", 8.05, 0, w=5.283, h=H, crop=(0.04, 0, 0.96, 1),
    alt="Field photo: yellow basket 1 with flag among tall pines at Cloudcroft Community disc golf course, November 1 2026 ground survey. Source: web/public/evidence/hole1-basket.jpg")
box(s, 0, 0, 8.35, H, fill=DARK)
text(s, 0.6, 0.7, 7.3, 0.4, "WEEKEND CHALLENGE: MAP IT  ·  LIVE DEMO", size=14, bold=True, color=YELLOW)
text(s, 0.6, 1.25, 7.4, 2.2, ["Cloudcroft", "Disc Golf"], size=54, bold=True, color=CREAM, leading=1.0)
text(s, 0.6, 3.35, 7.2, 0.6, "An AR map + scorecard at 8,676 ft - surveyed on foot, mapped in your browser.",
     size=21, color=SAGE)
box(s, 0.6, 4.35, 7.0, 0.07, fill=YELLOW)
text(s, 0.6, 4.7, 7.3, 1.3, [
    [("Open it live:  ", {"bold": True, "color": CREAM}),
     ("bryanchasko.com/cloudcroft-disc-golf/", {"color": YELLOW, "bold": True})],
    "Two real courses. One November field survey. Zero invented pins.",
], size=17, color=CREAM)
text(s, 0.6, 6.6, 7.3, 0.4, "Bryan Chasko  ·  3-minute live demo  ·  every claim in this deck traces to the repo",
     size=12, color=SAGE)
notes(s, """SLIDE 1 - TITLE | 0:00-0:10 (10 seconds)
SAY (about 25 words): "This is Cloudcroft Disc Golf - a live map and scorecard for two mountain courses in New Mexico, built from a survey I walked myself. Watch it run."
ON SCREEN: stay on this slide. Do not click yet.
ALT TEXT (image): Field photo of yellow basket 1 among tall pines, Cloudcroft Community course, November 1 2026 ground survey (web/public/evidence/hole1-basket.jpg).
HONEST SCOPE: 8,676 ft is the town elevation story in the repo docs; surveyed pads sit higher (tee box 2 average: 2,675.3 m / about 8,777 ft).""")

# ---------------------------------------------------------------- slide 2
s = prs.slides.add_slide(BLANK); bg(s, CREAM); header(s, "Before you click", "The exact words you will see on screen", "0:10-0:25")
chip(s, 0.55, 1.6, 3.4, "PENDING REFRESH - being smoke-tested", RED, size=12)
text(s, 0.55, 2.15, 7.6, 0.5, "These labels are in the refresh Bryan is smoke-testing now. They are not on the live site yet (verified 2026-11-02). If the refresh has not shipped when you record, use the live words in Appendix A - never narrate a button that is not on screen.",
     size=15, color=RGBColor(0x1D, 0x2B, 0x20))
box(s, 0.55, 3.05, 7.6, 2.55, fill=RGBColor(0xFF, 0xFF, 0xFF), line=SAGE)
text(s, 0.8, 3.2, 7.1, 2.3, [
    [("Buttons:  ", {"bold": True}), ("Byron Ligon  ·  Cloudcroft Community  ·  Mountaintop  ·  Sky-Cam  ·  First Person  ·  VR  ·  ? (Help)", {})],
    [("Help text, verbatim:  ", {"bold": True}),
     ("“Drag to look around · scroll to zoom in Sky-Cam · in First Person, WASD or arrow keys move, Shift hurries · Mountaintop goes to Community tee box 2 · in a pano, drag left–right.”", {"italic": True})],
    [("In a pano:  ", {"bold": True}), ("“drag left–right to look around”  ·  ‹  ›  ·  Back", {"italic": True})],
    [("Try-it path, verbatim:  ", {"bold": True}),
     ("“Mountaintop → tee box 2 card → next/prev through the panos → First Person → walk the fairway.”", {"italic": True})],
], size=15, color=RGBColor(0x1D, 0x2B, 0x20))
box(s, 8.45, 1.6, 4.35, 4.0, fill=GREEN)
text(s, 8.75, 1.8, 3.8, 3.6, [
    [("ALREADY LIVE - safe to promise", {"bold": True, "color": YELLOW, "size": 15})],
    "bryanchasko.com/cloudcroft-disc-golf/  (HTTP 200)",
    "“Open the live map” → /app/  (HTTP 200)",
    "Walk page buttons today: Orbit · Walk (WASD) · “Stand on the mountaintop — tee box 2”",
    [("Rule for recording: read the screen, not this deck.", {"bold": True, "color": YELLOW})],
], size=15, color=CREAM)
text(s, 0.55, 5.85, 12.2, 0.9, "Demo flow for the next 2½ minutes:  open the landing page → enter the map → Mountaintop at Community tee box 2 → move around and open field photos + 360° panos → how the survey became the map → the AWS pattern you can reuse.",
     size=17, bold=True, color=GREEN)
footer(s, 2)
notes(s, """SLIDE 2 - READ THE SCREEN | 0:10-0:25 (15 seconds)
SAY (about 37 words): "One honesty note before I click: a refreshed walkthrough is being smoke-tested right now, so I will narrate exactly the labels on screen. Everything you are about to see is the live product, not a mock-up."
ON SCREEN: point at the PENDING vs LIVE split. Do not promise "Mountaintop / Sky-Cam / First Person" unless the refresh has shipped and you can see those words.
SOURCE: pending wording quoted verbatim from the uncommitted web/walk.html refresh; live wording verified by fetching https://bryanchasko.com/cloudcroft-disc-golf/app/walk.html on 2026-11-02 (Orbit / Walk (WASD) / Stand on the mountaintop - tee box 2). Full label map: Appendix A.""")

# ---------------------------------------------------------------- slide 3
s = prs.slides.add_slide(BLANK); bg(s, CREAM); header(s, "Live flow - step 1", "Open the site. Enter the map.", "0:25-0:47")
pic(s, "story/assets/map-hero.png", 0.55, 1.65, w=7.6,
    alt="Screenshot of the live 2D course map (repo QA capture, October 31 2026): topo base, trails, hole table and scorecard panel for Byron Ligon Tiki course. Source: story/assets/map-hero.png")
text(s, 0.55, 6.35, 7.6, 0.55, "Repo QA capture of the live 2D map (Oct 31) - on camera, show the real browser, not this still.",
     size=12, color=GREY)
bullets(s, 8.5, 1.75, 4.3, [
    [("1. Open ", {}), ("bryanchasko.com/cloudcroft-disc-golf/", {"bold": True})],
    [("2. Click ", {}), ("“Open the live map”", {"bold": True}), (" - you land in /app/", {})],
    "Two courses, one toggle: Byron Ligon Tiki · 9 and Community · 18",
    "Topo / Satellite, Trails, and the NAIP 2022 overlay are layers on the same map",
    "The hole table and scorecard sit beside the map - no app install, no account",
], size=17)
chip(s, 8.5, 6.15, 4.3, "LIVE NOW - verified HTTP 200", GREEN)
footer(s, 3)
notes(s, """SLIDE 3 - ENTER THE MAP | 0:25-0:47 (22 seconds)
DO ON CAMERA: open https://bryanchasko.com/cloudcroft-disc-golf/ , then click "Open the live map".
SAY (about 55 words): "We start where any visitor starts. One click takes us from the story page into the live map. Both Cloudcroft courses are here - the nine-hole Tiki putting course and the eighteen-hole Community course - with topo, satellite, trails and aerial imagery as layers, and the scorecard right beside the map."
ALT TEXT (image): Screenshot of the live 2D course map from repo QA (story/assets/map-hero.png, October 31 2026): topo base with trails, hole table, Start round scorecard control.
IF IT STALLS: keep talking over the still on this slide; it is a real capture, labelled with its date.""")

# ---------------------------------------------------------------- slide 4
s = prs.slides.add_slide(BLANK); bg(s, CREAM); header(s, "Live flow - step 2 · the money shot", "Mountaintop: Community tee box 2", "0:47-1:15")
pic(s, "dataset/panos-web/PXL_20261101_173005849.webp", 0.55, 1.6, w=7.7,
    alt="Flattened strip of the real 360-degree panorama shot on the Community tee box 2 pad on November 1 2026 (Pano F, PXL_20261101_173005849). In the live walk you drag inside this image. Source: dataset/panos-web/PXL_20261101_173005849.webp")
text(s, 0.55, 5.15, 7.7, 0.6, "Above: the actual tee-box-2 360°, flattened. On camera you stand inside it and drag. Below: the sign Bryan photographed at that pad.",
     size=12, color=GREY)
pic(s, "story/assets/hole2-tee-sign.jpg", 0.55, 5.75, h=1.15,
    alt="Field photo of the Hole 2 tee sign: HOLE #2, 245 ft, PAR 3, MANDO, FENCE LINE O.B. Source: story/assets/hole2-tee-sign.jpg")
text(s, 1.55, 5.85, 6.6, 1.0, [
    [("Hole 2 sign, read on site:  ", {"bold": True}), ("245 ft · par 3 · mando right · fence-line O.B. right", {})],
    "The app card says the same words - sign, survey remark, and map agree.",
], size=14, color=RGBColor(0x1D, 0x2B, 0x20))
bullets(s, 8.6, 1.7, 4.2, [
    [("Click ", {}), ("Mountaintop", {"bold": True}), (" (live today: “Stand on the mountaintop — tee box 2”)", {})],
    "You land on the highest surveyed pad: 40-fix GPS average, elevation 2,675.3 m",
    "This 360° was shot 1.4 m from that average - the view and the coordinate are the same field moment",
    [("Drag left–right to look around. ", {"bold": True}), ("That instruction is printed in the pano itself.", {})],
], size=16)
chip(s, 8.6, 5.9, 4.2, "TEE-2 360°: PENDING REFRESH", RED, size=12)
text(s, 8.6, 6.4, 4.2, 0.7, "Until the refresh ships, the live walk shows this pad's real field photos at tee box 2. Say whichever is on screen.",
     size=12, color=RED)
footer(s, 4)
notes(s, """SLIDE 4 - MOUNTAINTOP, TEE BOX 2 | 0:47-1:15 (28 seconds)
DO ON CAMERA: in the walkthrough, press Mountaintop (pending refresh) or "Stand on the mountaintop - tee box 2" (live today). Drag inside the pano / look at the pad card.
SAY (about 70 words): "This is the mountaintop moment. Tee box two is the highest pad we surveyed. The sign at my feet reads par three, two hundred forty-five feet, mandatory right, fence line out of bounds. The panorama you are looking around was shot about a metre from the averaged GPS point for this pad - so the view, the sign, and the map pin are all the same field evidence."
ALT TEXT: (1) Flattened strip of Pano F, the real November 1 2026 360-degree shot at the tee box 2 pad (dataset/panos-web/PXL_20261101_173005849.webp; EXIF 32.961722, -105.741683; 1.4 m from the community-tee-2 40-fix average, per dataset/PANO-INDEX.md). (2) Hole 2 tee sign field photo (story/assets/hole2-tee-sign.jpg).
DO NOT SAY: "360 at tee box 2 is live" until the refresh is deployed. In the pending code the config jumps straight to this pano; the static card text still contains a stale "No 360 exists at this pad yet" sentence - confirm on the smoke test which text renders before recording.""")

# ---------------------------------------------------------------- slide 5
s = prs.slides.add_slide(BLANK); bg(s, CREAM); header(s, "Live flow - step 3", "Move around. Open what the field day actually captured.", "1:15-1:48")
pic(s, "web/public/evidence/hole1-basket.jpg", 0.55, 1.6, w=3.0,
    alt="Geolocated field photo: basket 1 with yellow flag among pines, Community course. Source: web/public/evidence/hole1-basket.jpg")
pic(s, "web/public/evidence/kiosk.jpg", 3.75, 1.6, w=3.0,
    alt="Geolocated field photo: the course kiosk noticeboard at Cloudcroft Community disc golf course. Source: web/public/evidence/kiosk.jpg")
pic(s, "dataset/panos-web/PXL_20261101_170324214.webp", 6.95, 1.6, w=5.85,
    alt="Flattened strip of Pano A: the real 360-degree shot at the Hole 1 tee area, November 1 2026 (PXL_20261101_170324214). Source: dataset/panos-web/PXL_20261101_170324214.webp")
text(s, 0.55, 4.35, 12.2, 0.4, "Basket 1 field photo  ·  course kiosk field photo  ·  Pano A (Hole 1 tee area), flattened - in the walk you drag inside it",
     size=12, color=GREY)
bullets(s, 0.55, 4.85, 12.2, [
    [("On the 2D map: ", {"bold": True}), ("choose a point, photo, or panorama - every survey point opens its photos, and panos link onward with “stand here in the 3D walk”.", {})],
    [("In the 3D walk: ", {"bold": True}), ("Sky-Cam to orbit, First Person + WASD to walk the fairway, ‹ › to step through the six panos (A–F in the pano index).", {})],
    [("The mapped field record: ", {"bold": True}), ("15 Pixel photos · 6 panoramas · 20 SW Maps screenshots · 21 Community points · 6 Tiki points (survey-assets.json counts).", {})],
], size=16, gap=7)
footer(s, 5)
notes(s, """SLIDE 5 - EXPLORE PHOTOS AND PANOS | 1:15-1:48 (33 seconds)
DO ON CAMERA: (a) on the map, open two or three survey points so their field photos appear; use a pano link ("stand here in the 3D walk") if it is on screen. (b) In the walk, step to the next pano and drag. Keep it brisk - breadth over depth.
SAY (about 80 words): "Now I am just exploring - and everything I open was captured on one field day. This basket photo, the kiosk, the tee signs - each one carries the GPS position where it was taken, so it opens on the map where it belongs. The panoramas go further: I can stand at the Hole 1 tee, at both baskets, and on the Tiki fairway, and look around as if I were back on the mountain."
ALT TEXT: basket 1 field photo (web/public/evidence/hole1-basket.jpg); kiosk field photo (web/public/evidence/kiosk.jpg); flattened Pano A strip, Hole 1 tee area (dataset/panos-web/PXL_20261101_170324214.webp; 5 m from the tee-1 average per dataset/PANO-INDEX.md).
COUNTS: dataset/survey-assets.json (photo 15, pano 6, screenshot 20). Holes 3-18 are NOT surveyed yet - if a pin looks like scaffolding, say so; honest gaps are part of the product story (docs/site-rethink-demo.md).""")

# ---------------------------------------------------------------- slide 6
s = prs.slides.add_slide(BLANK); bg(s, CREAM); header(s, "Under the hood - 20 seconds", "Survey to map: no hand-placed pins", "1:48-2:10")
steps = [
    ("1 · WALK", "SW Maps on a phone: averaged GPS points + a written remark at every pad and basket"),
    ("2 · CONVERT", "swm2_to_geojson.py turns the .swmz field backup into points.geojson"),
    ("3 · VALIDATE", "validate_survey.py checks counts, names, bounds, notes - gaps are reported, never silently filled"),
    ("4 · BUILD", "build_holes.py samples the 1 m DEM, cross-checks the tee signs, precomputes plays-like distance"),
    ("5 · PUBLISH", "GeoJSON + web panos + photos ship to the same map you just used - next survey drop needs no code change"),
]
x = 0.55
for title_, body in steps:
    box(s, x, 1.7, 2.38, 3.1, fill=RGBColor(0xFF, 0xFF, 0xFF), line=SAGE)
    text(s, x+0.15, 1.85, 2.08, 0.4, title_, size=15, bold=True, color=GREEN)
    text(s, x+0.15, 2.3, 2.08, 2.3, body, size=13.5, color=RGBColor(0x1D, 0x2B, 0x20))
    x += 2.52
pic(s, "web/public/figures/fig-swmaps-community-tee2.jpg", 0.55, 5.0, h=1.85,
    alt="SW Maps field-capture screenshot for community-tee-2: remark reads 'par 3, 245 ft, mando right, fence line OB right', averaging 37 fixes, elevation 2675.405 m. Source: web/public/figures/fig-swmaps-community-tee2.jpg")
text(s, 1.55, 5.1, 11.2, 1.7, [
    [("The real capture screen for the pad you just stood on:  ", {"bold": True}),
     ("“community-tee-2 | par 3, 245 ft, mando right, fence line OB right” - averaging 37 fixes at that moment, elevation 2,675.405 m.", {})],
    "That remark is now map data. The pipeline is scripts + tests in the repo (dataset/scripts/), so anyone can re-run it on their own course survey.",
], size=16, color=RGBColor(0x1D, 0x2B, 0x20))
footer(s, 6)
notes(s, """SLIDE 6 - SURVEY-TO-MAP PIPELINE | 1:48-2:10 (22 seconds)
SAY (about 55 words): "How did a walk become this map? I recorded averaged GPS points in SW Maps, with a plain-English remark at each one. Small open scripts convert that backup to GeoJSON, validate it - reporting gaps instead of inventing data - sample elevation for plays-like distance, and publish. The next field day drops in without touching code."
ALT TEXT (image): SW Maps Record Feature screenshot for community-tee-2 (web/public/figures/fig-swmaps-community-tee2.jpg).
EVIDENCE: dataset/scripts/{swm2_to_geojson,validate_survey,build_holes,build_survey_assets}.py; build log records the ingest test suite passing. Do not quote a test count on camera unless you re-run it.""")

# ---------------------------------------------------------------- slide 7
s = prs.slides.add_slide(BLANK); bg(s, CREAM); header(s, "Under the hood - 15 seconds", "The AWS shape (one CDK stack)", "2:10-2:28")
cols = [
    ("VISITOR", GREEN, ["Browser - no install", "MapLibre 2D map", "Babylon.js 3D walk"]),
    ("AMAZON LOCATION SERVICE", GREEN, ["Topo + imagery maps", "Place index (geocoded anchors)", "Per-hole geofences · tracker · routes"]),
    ("API + DATA", GREEN, ["API Gateway (HTTP API)", "Rust ARM Lambdas: plays-like + scorecard", "DynamoDB scorecards"]),
    ("HOSTING + ACCESS", GREEN, ["S3 dataset + web bundle", "CloudFront (site distribution)", "Cognito guest pool - one scoped role"]),
]
x = 0.55
for title_, col, items in cols:
    box(s, x, 1.75, 2.95, 0.55, fill=col)
    text(s, x+0.15, 1.87, 2.65, 0.35, title_, size=13, bold=True, color=CREAM, align=PP_ALIGN.CENTER)
    box(s, x, 2.3, 2.95, 2.2, fill=RGBColor(0xFF, 0xFF, 0xFF), line=SAGE)
    text(s, x+0.2, 2.5, 2.55, 1.9, [[("•  " + i, {})] for i in items], size=14,
         color=RGBColor(0x1D, 0x2B, 0x20))
    if x < 9:
        text(s, x+2.92, 2.95, 0.35, 0.4, "›", size=28, bold=True, color=GREEN, align=PP_ALIGN.CENTER)
    x += 3.12
text(s, 0.55, 4.85, 12.2, 1.6, [
    [("Plays-like, in one line:  ", {"bold": True, "color": GREEN}),
     ("horizontal distance plus elevation change over the 1 m DEM - verified live at 364.8 ft + 40 ft climb = 404.8 ft on a synthetic hole (build log, day 0).", {})],
    [("One stack owns it all:  ", {"bold": True, "color": GREEN}),
     ("TypeScript CDK in us-east-1 (infra-cdk/) - Location resources, guest identity pool, both Lambdas, the table, and the API. Zero hand-made resources remain.", {})],
    [("Not in this demo: ", {"bold": True, "color": RED}),
     ("the Android AR companion is a stretch goal and is not scaffolded. Do not promise on-tee AR on camera.", {"color": RED})],
], size=16, color=RGBColor(0x1D, 0x2B, 0x20))
footer(s, 7)
notes(s, """SLIDE 7 - AWS ARCHITECTURE | 2:10-2:28 (18 seconds)
SAY (about 45 words): "Underneath, this is one CDK stack: Amazon Location Service for maps, geocoding, geofences and routes; two small Rust Lambdas for plays-like distance and the scorecard; DynamoDB, S3 and CloudFront to serve it; and a Cognito guest pool so the browser gets one tightly scoped role."
EVIDENCE: docs/infra.md + infra-cdk/lib/cloudcroft-disc-golf-stack.ts (CfnMap x2, CfnPlaceIndex, CfnGeofenceCollection, CfnTracker, CfnRouteCalculator); API https://sfss0zmepi.execute-api.us-east-1.amazonaws.com per docs/infra.md.
DO NOT PROMISE: Android / ARCore on-site AR (README: stretch goal, not yet scaffolded); Location API keys (creation was blocked; Cognito is the live path).""")

# ---------------------------------------------------------------- slide 8
s = prs.slides.add_slide(BLANK); bg(s, CREAM); header(s, "Provenance", "Open data actually used - and what we rejected", "2:28-2:40")
bullets(s, 0.55, 1.7, 7.5, [
    [("USGS 3DEP 1 m DEM ", {"bold": True}), ("(NM_SouthEast_2018_D19) - one tile covers both courses; anchor samples match the national elevation service to 0.1 ft. This is the elevation source of record.", {})],
    [("USGS NAIP 2022, 60 cm ", {"bold": True}), ("- one tile covers both courses; you saw it as the map overlay and the 3D terrain drape.", {})],
    [("OpenStreetMap ", {"bold": True}), ("- live Overpass extract: 2,500 elements, 46 paths + 26 footways with real trail names. Neither course was in OSM - this dataset fills that gap.", {})],
    [("Ground truth (ours) ", {"bold": True}), ("- averaged phone GPS, EXIF-geolocated photos, six 360° panos, tee-sign cross-checks.", {})],
], size=16, gap=9)
box(s, 8.35, 1.7, 4.45, 4.6, fill=RGBColor(0xFF, 0xFF, 0xFF), line=SAGE)
text(s, 8.6, 1.9, 4.0, 4.2, [
    [("MEASURED, THEN REJECTED", {"bold": True, "color": RED, "size": 15})],
    [("Daylight OSM parquet on S3: ", {"bold": True}), ("planet scan projected past 25 minutes for a 5 km box; the same OSM data via Overpass took 20 seconds. Query kept in the build log.", {})],
    [("Terrain Tiles (Terrarium): ", {"bold": True}), ("verified live, not used - the local 1 m DEM renders elevation instead.", {})],
    [("Copernicus DEM 30 m: ", {"bold": True}), ("fallback only - about one pixel per 100 ft hole is useless per-hole.", {})],
], size=14.5, color=RGBColor(0x1D, 0x2B, 0x20))
text(s, 0.55, 6.45, 12.2, 0.5, "Full provenance, tile IDs, and S3 locations: dataset/sources.md in the repo.",
     size=14, bold=True, color=GREEN)
footer(s, 8)
notes(s, """SLIDE 8 - OPEN DATA, VERIFIED | 2:28-2:40 (12 seconds)
SAY (about 30 words): "The open data under this is one-metre USGS elevation, 2022 aerial imagery, and OpenStreetMap trails - and we kept the receipts for what we measured and rejected, too."
EVIDENCE: every line above is from dataset/sources.md (Registry of Open Data on AWS + portals section) and docs/build-log.md day-0 ingest notes. Do NOT claim Terrarium, Copernicus DEM, Sentinel, or the Daylight S3 parquet as "used" - sources.md explicitly marks them evaluated / fallback / abandoned.
COURSE FACTS: Tiki pars/distances attributed to the Radius Disc Golf page; Community par 63 to Cloudcroft Reader reporting (dataset/sources.md).""")

# ---------------------------------------------------------------- slide 9
s = prs.slides.add_slide(BLANK); bg(s, DARK)
pic(s, "dataset/panos-web/PXL_20261101_180216070.webp", 0, 4.55, w=W,
    alt="Flattened strip of Pano E: the Byron Ligon Tiki fairway 3 aspen grove, a real November 1 2026 360-degree shot (PXL_20261101_180216070). Source: dataset/panos-web/PXL_20261101_180216070.webp")
text(s, 0.6, 0.6, 12.1, 0.4, "CLOSE  ·  2:40-2:55", size=14, bold=True, color=YELLOW)
text(s, 0.6, 1.15, 12.1, 1.0, "Your course could be next weekend's walk.", size=40, bold=True, color=CREAM)
text(s, 0.6, 2.25, 12.1, 1.9, [
    "Walk it with a phone. Average a point at every tee and basket. Photograph the signs. Shoot the panos.",
    "Run the pipeline. Publish to the same AWS pattern. The map grows hole by hole - honestly, scaffolding and all.",
], size=20, color=SAGE)
box(s, 0.6, 3.85, 12.1, 0.07, fill=YELLOW)
text(s, 0.6, 6.95, 12.1, 0.4, [
    [("Try it now:  ", {"bold": True, "color": DARK}),
     ("bryanchasko.com/cloudcroft-disc-golf/", {"bold": True, "color": DARK}),
     ("   ·   the pattern, step by step: /cloudcroft-disc-golf/how-this-works/", {"color": DARK})],
], size=16)
box(s, 0.45, 6.85, 12.45, 0.55, fill=YELLOW)
# re-draw text above the yellow bar
text(s, 0.6, 6.95, 12.1, 0.4, [
    [("Try it now:  ", {"bold": True, "color": DARK}),
     ("bryanchasko.com/cloudcroft-disc-golf/", {"bold": True, "color": DARK}),
     ("   ·   the pattern, step by step: /cloudcroft-disc-golf/how-this-works/", {"color": DARK})],
], size=16)
notes(s, """SLIDE 9 - CLOSE: REPRODUCIBILITY | 2:40-2:55 (15 seconds) - hard stop before 3:00
SAY (about 37 words): "Nothing here needs a survey crew. A phone, a free field app, open elevation and imagery, and one small AWS stack turned a weekend walk into a map anyone can stand inside. Your course could be next."
ON SCREEN: end on the URL. Leave 5 seconds of silence/buffer - total planned narration ends at 2:55.
ALT TEXT (image): flattened Pano E strip, Byron Ligon fairway 3 aspen grove (dataset/panos-web/PXL_20261101_180216070.webp; 2.9 m from its SW Maps average per dataset/PANO-INDEX.md).
TOTAL TIMING: 10+15+22+28+33+22+18+12+15 = 175 seconds (2:55), inside the 3:00 limit with a 5-second buffer.""")

# ---------------------------------------------------------------- appendix A
s = prs.slides.add_slide(BLANK); bg(s, CREAM); header(s, "Appendix A - do not narrate unless the refresh ships", "Live today vs pending refresh: the label map", "backup")
rows = [
    ("Go to tee box 2", "“Stand on the mountaintop — tee box 2”", "Mountaintop"),
    ("Orbit mode", "Orbit", "Sky-Cam"),
    ("Walk mode", "Walk (WASD)", "First Person"),
    ("Course fly-to", "Tiki course · Community course", "Byron Ligon · Cloudcroft Community"),
    ("Immersive entry", "Enter first person / VR", "VR"),
    ("Help / judges card", "For the judges", "?  (Help and information)"),
    ("Pano stepping", "← Prev pano · Next pano →", "‹  ›"),
    ("Leave a pano", "Back to the walkthrough", "Back"),
    ("Tee box 2 view", "Real pad-side field photos (card says no 360° yet)", "Jumps straight into the tee-2 360° (config: tee2-area)"),
    ("Pano hint", "(none in the card)", "“drag left–right to look around”"),
]
y = 1.65
box(s, 0.55, y, 12.25, 0.45, fill=GREEN)
for cx, cw, t in [(0.7, 3.0, "ACTION"), (3.9, 4.2, "LIVE TODAY - verified 2026-11-02"), (8.4, 4.2, "PENDING REFRESH - in smoke test")]:
    text(s, cx, y+0.1, cw, 0.3, t, size=13, bold=True, color=CREAM)
y += 0.5
for i, (a, b, c) in enumerate(rows):
    if i % 2 == 0:
        box(s, 0.55, y, 12.25, 0.42, fill=RGBColor(0xFF, 0xFF, 0xFF))
    text(s, 0.7, y+0.07, 3.0, 0.3, a, size=13, bold=True, color=RGBColor(0x1D, 0x2B, 0x20))
    text(s, 3.9, y+0.07, 4.2, 0.3, b, size=13, color=RGBColor(0x1D, 0x2B, 0x20))
    text(s, 8.4, y+0.07, 4.2, 0.3, c, size=13, color=RED)
    y += 0.44
text(s, 0.55, y+0.12, 12.25, 0.75, [
    [("Known stale text to confirm in the smoke test: ", {"bold": True, "color": RED}),
     ("the refresh's static pano-card paragraph still says “No 360° exists at this pad yet…” while its config note jumps straight to the tee-2 pano. Confirm which text actually renders, and narrate only what renders.", {})],
], size=14, color=RGBColor(0x1D, 0x2B, 0x20))
footer(s, 10)
notes(s, """APPENDIX A - NOT NARRATED (recording-day reference)
Live column: verified by fetching the live walk page on 2026-11-02 and cross-checked against git HEAD web/walk.html.
Pending column: read from the uncommitted working-tree refresh of web/walk.html + web/src/config.ts (15 files modified at build time; nothing in this deck edits or ships that code).
If the refresh ships before recording: re-fetch the live page, confirm every pending label renders, then narrate the pending words used in Slides 2/4/5. If it has not shipped: narrate the LIVE column everywhere - in particular "Stand on the mountaintop - tee box 2", "Orbit", and "Walk (WASD)".""")

# ---------------------------------------------------------------- appendix B
s = prs.slides.add_slide(BLANK); bg(s, CREAM); header(s, "Appendix B - provenance", "Every image and number in this deck", "backup")
bullets(s, 0.55, 1.65, 12.25, [
    [("Slide 1 / 5 - basket 1 photo: ", {"bold": True}), ("web/public/evidence/hole1-basket.jpg (Nov 1 field photo, sidecar JSON alongside). Viewed and verified for this deck.", {})],
    [("Slide 3 - 2D map still: ", {"bold": True}), ("story/assets/map-hero.png (repo capture, Oct 31). Viewed and verified; labelled with its date on-slide.", {})],
    [("Slide 4 - tee-2 pano strip + sign: ", {"bold": True}), ("dataset/panos-web/PXL_20261101_173005849.webp (Pano F; EXIF + distances in dataset/PANO-INDEX.md) and story/assets/hole2-tee-sign.jpg. Sign viewed and read for this deck.", {})],
    [("Slide 5 - kiosk + Pano A: ", {"bold": True}), ("web/public/evidence/kiosk.jpg (viewed) and dataset/panos-web/PXL_20261101_170324214.webp.", {})],
    [("Slide 6 - SW Maps screen: ", {"bold": True}), ("web/public/figures/fig-swmaps-community-tee2.jpg. Viewed; remark/averaging/elevation read directly from the image.", {})],
    [("Slide 9 - Tiki aspen pano: ", {"bold": True}), ("dataset/panos-web/PXL_20261101_180216070.webp (Pano E).", {})],
    [("Numbers: ", {"bold": True}), ("15 photos / 6 panos / 20 screenshots (dataset/survey-assets.json); 21 + 6 survey points and hole facts (README, docs/site-rethink-demo.md, dataset/PANO-INDEX.md); 404.8 ft plays-like check and OSM counts (docs/build-log.md); AWS resources (docs/infra.md, infra-cdk/). No metrics were invented; nothing was downloaded.", {})],
    [("Honest gaps: ", {"bold": True}), ("Community holes 3–18 unsurveyed; Tiki points partially identified; Android AR not scaffolded; Location API-key path blocked (Cognito is live). The deck says so wherever it matters.", {})],
], size=14.5, gap=8)
footer(s, 11)
notes(s, """APPENDIX B - NOT NARRATED (judges / recording-day reference)
All imagery is embedded from this repository at deck-build time by docs/demo-deck-v1-build.py; re-running that script reproduces this deck. Each embedded picture carries PowerPoint alt text (descr) naming its repo source path, mirrored in the speaker notes of its slide.
Pano strips are the real equirectangular survey images shown flattened - the deck labels them as such; only the live walk renders them immersively.
Deck built 2026-11-02 against git HEAD 0ae6bc8 plus the uncommitted pending-refresh working tree (read-only). No app code was edited and nothing was committed.""")

cp = prs.core_properties
cp.title = "Cloudcroft Disc Golf - 3-minute live hackathon demo (v1, 2026-11-02)"
cp.author = "Bryan Chasko (deck built by Muse Spark worker)"
cp.subject = "Weekend Challenge: Map it - live demo script, pending vs live UI labels, survey-to-map + AWS pattern"
cp.comments = "Speaker notes total 2:55. Pending-refresh labels are flagged on Slides 2/4 and Appendix A; narrate only labels visible on screen at recording time."

prs.save(OUT)
print(f"wrote {OUT} ({OUT.stat().st_size/1e6:.2f} MB, {len(prs.slides.__iter__.__self__._sldIdLst)} slides)")
