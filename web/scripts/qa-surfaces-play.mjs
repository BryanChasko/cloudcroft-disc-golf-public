// qa-surfaces-play.mjs — headless play-through of all three intertwined
// surfaces: story (/cloudcroft-disc-golf/), map app (/disc-golf/), walk
// (/disc-golf/walk.html). Drives public controls, asserts the survey
// wiring counts (27 points, 15 photos, 6 panos, 20 screenshots), the
// shared radio tuner, and deep links. Run from web/:
//   node scripts/qa-surfaces-play.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://bryanchasko.com";
const APP = `${ORIGIN}/cloudcroft-disc-golf/app`;
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "docs/qa/evidence/public-pass",
);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/snap/bin/chromium",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const fails = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) fails.push(name);
};
const shot = (name) => page.screenshot({ path: join(OUT, name) });

// ---------- story ----------
await page.goto(`${ORIGIN}/cloudcroft-disc-golf/`, {
  waitUntil: "load",
  timeout: 60000,
});
await page.waitForTimeout(1500);

// hold-to-charge throw: ~820ms ≈ 75% power, below the hole-1 band
const noteBefore = await page.textContent("#throw-note");
const box = await page.locator("#throw-btn").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(400);
const midPower = await page.$eval(
  "#power-fill",
  (el) => parseFloat(el.style.width) || 0,
);
await page.waitForTimeout(420);
await page.mouse.up();
await page.waitForTimeout(900);
const noteAfter = await page.textContent("#throw-note");
const score = await page.textContent("#throw-score");
check(
  "throw: power charges while held",
  midPower > 15 && midPower < 100,
  `${midPower.toFixed(0)}%`,
);
check(
  "throw: release throws + note/score update",
  noteBefore !== noteAfter && /\/ 1/.test(score),
  `${score} · ${noteAfter.trim()}`,
);
await shot("story-throw-v2.png");

// hole pick changes the band and the real pano backdrop
const sweet1 = await page.$eval("#sweet", (el) => el.style.left);
const pano1 = await page.$eval("#stage-pano", (el) => el.getAttribute("src"));
await page.click('[data-throw-hole="tiki3"]');
const sweet2 = await page.$eval("#sweet", (el) => el.style.left);
const pano2 = await page.$eval("#stage-pano", (el) => el.getAttribute("src"));
check(
  "throw: hole pick moves basket band",
  sweet1 !== sweet2,
  `${sweet1} -> ${sweet2}`,
);
check(
  "throw: hole pick swaps the real pano backdrop",
  /170324214/.test(pano1) && /175756282/.test(pano2),
  `${pano1} -> ${pano2}`,
);
await page.click('[data-throw-hole="1"]');
const comm3 = await page.evaluate(() => {
  const btn = document.querySelector('[data-throw-hole="comm3"]');
  return {
    disabled: btn.disabled,
    label: btn.textContent.trim(),
    title: btn.getAttribute("title") ?? "",
  };
});
check(
  "throw: community 3 stays locked without invented metrics",
  comm3.disabled && /awaiting survey/i.test(comm3.label) && comm3.title.length > 0,
  comm3.label,
);

// course tabs
await page.click('[data-course-tab="community"]');
const commVisible = await page.$eval(
  '[data-course-pane="community"]',
  (el) => !el.hidden,
);
const tikiHidden = await page.$eval(
  '[data-course-pane="tiki"]',
  (el) => el.hidden,
);
check("tabs: course switch", commVisible && tikiHidden);

// pipeline stepper
await page.click('[data-pipe-step="2"]');
const step2 = await page.$eval('[data-pipe-pane="2"]', (el) => !el.hidden);
check("pipeline: step 2 pane shows", step2);
await page.click('[data-pipe-step="1"]');

// live data: galleries + points table + dots
await page
  .waitForFunction(
    () => document.querySelectorAll("#pts-table tbody tr").length >= 27,
    null,
    { timeout: 20000 },
  )
  .catch(() => {});
const counts = await page.evaluate(() => ({
  photos: document.querySelectorAll("#gal-photos figure").length,
  panos: document.querySelectorAll("#gal-panos figure").length,
  shots: document.querySelectorAll("#gal-shots figure").length,
  rows: document.querySelectorAll("#pts-table tbody tr").length,
  photoLinks: document.querySelectorAll(
    '#pts-table tbody a[href*="data/photos/"]',
  ).length,
  dots: document.querySelectorAll("#survey-dots .dot").length,
  rowsWithLinks: [...document.querySelectorAll("#pts-table tbody tr")].filter(
    (tr) => tr.querySelector('a[href*="data/photos/"]'),
  ).length,
  firstCoord:
    document.querySelector("#pts-table tbody td.coords")?.textContent ?? "",
}));
check("gallery: 15 photos", counts.photos === 15, String(counts.photos));
check("gallery: 6 panos", counts.panos === 6, String(counts.panos));
check("gallery: 20 screenshots", counts.shots === 20, String(counts.shots));
check("points table: 27 rows", counts.rows === 27, String(counts.rows));
check(
  // 21 attached shots + nearest Pixel field shots (up to 3 per row);
  // every one of the 27 rows links at least one photo
  "points table: photo + field links on every row",
  counts.photoLinks >= 21 + 15 && counts.rowsWithLinks === 27,
  `${counts.photoLinks} links, ${counts.rowsWithLinks}/27 rows`,
);
check(
  "points table: coordinates as text",
  /32\.\d+,\s*-105\.\d+/.test(counts.firstCoord),
  counts.firstCoord,
);
check("dots: 27 survey dots", counts.dots === 27, String(counts.dots));
await page.locator("#survey-dots .dot").first().click();
const dotInfo = await page.textContent("#dot-info");
check(
  "dots: click shows point + coords",
  /32\.\d+/.test(dotInfo),
  dotInfo.trim().slice(0, 80),
);
await page.locator("#h-pipe").scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
await shot("story-points-table.png");

// radio tuner on story
const tuner = await page.evaluate(() => ({
  mounts: document.querySelectorAll("[data-radio-tuner] .rt-play").length,
  stations: document.querySelectorAll("[data-radio-tuner] .rt-st").length,
  name:
    document.querySelector("[data-radio-tuner] .rt-name")?.textContent ?? "",
}));
check(
  "radio: tuner mounted, 3 stations",
  tuner.mounts >= 1 && tuner.stations === 3,
  tuner.name,
);
await page.locator('[data-radio-tuner] .rt-st[data-id="ktmn"]').click();
const tuned = await page.evaluate(() => ({
  name:
    document.querySelector("[data-radio-tuner] .rt-name")?.textContent ?? "",
  src:
    document.querySelector("[data-radio-tuner] audio")?.getAttribute("src") ??
    "",
  saved: localStorage.getItem("dg-radio-station"),
}));
check(
  "radio: tune KTMN + persist",
  /KTMN/.test(tuned.name) &&
    /teg6piefk9qvv/.test(tuned.src) &&
    tuned.saved === "ktmn",
  tuned.name,
);

// shared nav on the story page
const nav = await page.evaluate(() => ({
  links: [...document.querySelectorAll("[data-site-nav] a")].map(
    (a) => a.textContent,
  ),
  current:
    document.querySelector('[data-site-nav] a[aria-current="page"]')
      ?.textContent ?? "",
}));
check(
  "nav: story shows 3 links, Story current",
  nav.links.join(",") === "Story,Map,Walk" && nav.current === "Story",
  nav.links.join(","),
);

// scorecard steppers still work + reset
const row = (n) => `.play-row[data-hole="${n}"]`;
await page.click(`${row(1)} .dec`);
const vsBirdie = await page.textContent(`${row(1)} .vs`);
await page.click("#play-reset");
const vsReset = await page.textContent(`${row(1)} .vs`);
check(
  "card: stepper + reset",
  vsBirdie === "-1" && vsReset === "E",
  `${vsBirdie} -> ${vsReset}`,
);

// ---------- map app ----------
await page.goto(`${APP}/?course=community&hole=2`, {
  waitUntil: "load",
  timeout: 60000,
});
await page
  .waitForFunction(
    () =>
      document.querySelectorAll("#field-gallery .gallery-grid figure").length >=
      15,
    null,
    { timeout: 30000 },
  )
  .catch(() => {});
const app = await page.evaluate(() => ({
  galleryFigs: document.querySelectorAll("#field-gallery .gallery-grid figure")
    .length,
  tuner: !!document.querySelector("[data-radio-tuner] .rt-play"),
  tunerName:
    document.querySelector("[data-radio-tuner] .rt-name")?.textContent ?? "",
  readout: !!document.getElementById("coord-readout"),
  navLinks: document.querySelectorAll("[data-site-nav] a").length,
  navCurrent:
    document.querySelector('[data-site-nav] a[aria-current="page"]')
      ?.textContent ?? "",
  scoreHole: document.getElementById("score-hole")?.value ?? "",
  status: document.getElementById("status")?.textContent ?? "",
  activeTab:
    document.querySelector("#course-tabs button.active")?.textContent ?? "",
}));
check(
  "app: field gallery >=15 photos",
  app.galleryFigs >= 15,
  String(app.galleryFigs),
);
check(
  "app: tuner present + station followed (KTMN)",
  app.tuner && /KTMN/.test(app.tunerName),
  app.tunerName,
);
check("app: coord readout present", app.readout);
check(
  "nav: app shows 3 links, Map current",
  app.navLinks === 3 && app.navCurrent === "Map",
  `${app.navLinks} ${app.navCurrent}`,
);
check(
  "app: deep link set hole 2 + community tab",
  app.scoreHole === "2" && /Community/.test(app.activeTab),
  `hole=${app.scoreHole} tab=${app.activeTab} status=${app.status}`,
);
await shot("app-gallery-tuner.png");

// ---------- walk ----------
await page.goto(`${APP}/walk.html`, {
  waitUntil: "load",
  timeout: 60000,
});
await page
  .waitForFunction(
    () =>
      /survey pins/.test(
        document.getElementById("walk-status")?.textContent ?? "",
      ),
    null,
    { timeout: 60000 },
  )
  .catch(() => {});
const walk = await page.evaluate(() => ({
  status: document.getElementById("walk-status")?.textContent ?? "",
  navLinks: document.querySelectorAll("[data-site-nav] a").length,
  navCurrent:
    document.querySelector('[data-site-nav] a[aria-current="page"]')
      ?.textContent ?? "",
  pinCard: !!document.getElementById("pin-card"),
  tuner: !!document.querySelector("[data-radio-tuner] .rt-play"),
  panoBtn: !!document.getElementById("pano-tiki"),
}));
check(
  "walk: 27 survey pins status",
  /27 survey pins/.test(walk.status),
  walk.status.slice(0, 90),
);
check("walk: pin card + tuner present", walk.pinCard && walk.tuner);
check(
  "nav: walk shows 3 links, Walk current",
  walk.navLinks === 3 && walk.navCurrent === "Walk",
  `${walk.navLinks} ${walk.navCurrent}`,
);
await page.waitForTimeout(2500);
await shot("walk-pins.png");

// pano deep link lands on the right flat pano with per-pano text
await page.goto(`${APP}/walk.html?pano=tiki-aspen`, {
  waitUntil: "load",
  timeout: 60000,
});
await page
  .waitForFunction(
    () => !document.querySelector(".pano-viewer")?.hidden,
    null,
    { timeout: 60000 },
  )
  .catch(() => {});
const pano = await page.evaluate(() => ({
  title:
    document.querySelector(".pano-viewer-title")?.textContent ?? "",
  meta: document.querySelector(".pano-viewer-meta")?.textContent ?? "",
  src:
    document.querySelector(".pano-viewer-img")?.getAttribute("src") ?? "",
}));
check(
  "walk: ?pano=tiki-aspen deep link",
  /fairway 3/i.test(pano.title) &&
    /32\.956922/.test(pano.meta) &&
    /180216070/.test(pano.src),
  `${pano.title} · ${pano.meta}`,
);
// the mountaintop button must land directly on the tee-box-2 pano
await page.goto(`${APP}/walk.html`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(1500);
await page.click("#pano-tiki");
await page
  .waitForFunction(
    () => !document.querySelector(".pano-viewer")?.hidden,
    null,
    { timeout: 60000 },
  )
  .catch(() => {});
const top = await page.evaluate(() => ({
  title:
    document.querySelector(".pano-viewer-title")?.textContent ?? "",
  meta: document.querySelector(".pano-viewer-meta")?.textContent ?? "",
  src:
    document.querySelector(".pano-viewer-img")?.getAttribute("src") ?? "",
}));
check(
  "walk: mountaintop button -> tee box 2 pano",
  /tee box 2/i.test(top.title) &&
    /32\.961722/.test(top.meta) &&
    /173005849/.test(top.src),
  `${top.title} · ${top.meta}`,
);
await shot("walk-pano-tiki.png");

// ?pano=tee2 preserves the old tee-box-2 address after the pano rename
await page.goto(`${APP}/walk.html?pano=tee2`, {
  waitUntil: "load",
  timeout: 60000,
});
await page
  .waitForFunction(
    () => !document.querySelector(".pano-viewer")?.hidden,
    null,
    { timeout: 60000 },
  )
  .catch(() => {});
const alias = await page.evaluate(() => ({
  title:
    document.querySelector(".pano-viewer-title")?.textContent ?? "",
  meta: document.querySelector(".pano-viewer-meta")?.textContent ?? "",
}));
check(
  "walk: ?pano=tee2 alias -> tee box 2 pano",
  /tee box 2/i.test(alias.title) && /32\.961722/.test(alias.meta),
  `${alias.title} · ${alias.meta}`,
);

// every swmz point carries its photos: tee 2 links the pad-side shots
const holes = await page.evaluate(async () => {
  const base = location.href.split("/walk.html")[0];
  const res = await fetch(`${base}/data/holes/cloudcroft-community.json`);
  const data = await res.json();
  const pts = (data.features || []).filter(
    (f) => f.geometry && f.geometry.type === "Point",
  );
  const byName = {};
  for (const f of pts) byName[f.properties.name] = f.properties;
  return {
    points: pts.length,
    tee2field: (byName["community-tee-2"]?.field_photos || []).map(
      (p) => p.web_url,
    ),
    withField: pts.filter((f) =>
      (f.properties.field_photos || []).length > 0,
    ).length,
  };
});
check(
  "data: 21 community points, tee 2 links hole-2 sign",
  holes.points === 21 &&
    holes.tee2field.some((u) => /172609455/.test(u)) &&
    holes.withField === 21,
  `${holes.points} pts, ${holes.withField} with field photos`,
);

// old slug redirects (query preserved)
await page.goto(`${ORIGIN}/disc-golf/?course=community&hole=2`, {
  waitUntil: "load",
  timeout: 60000,
});
await page
  .waitForFunction(
    () => location.pathname.startsWith("/cloudcroft-disc-golf/app"),
    null,
    { timeout: 20000 },
  )
  .catch(() => {});
const here = () => page.evaluate(() => location.href);
await page
  .waitForFunction(
    () => location.pathname.startsWith("/cloudcroft-disc-golf/app"),
    null,
    { timeout: 20000 },
  )
  .catch(() => {});
const r1 = await here();
check(
  "redirect: /disc-golf/ -> /app/ with query",
  /\/cloudcroft-disc-golf\/app\/.*course=community/.test(r1),
  r1,
);
await page.goto(`${ORIGIN}/disc-golf/walk.html?pano=tee2`, {
  waitUntil: "load",
  timeout: 60000,
});
await page
  .waitForFunction(() => location.pathname.endsWith("/app/walk.html"), null, {
    timeout: 20000,
  })
  .catch(() => {});
const r2 = await here();
check(
  "redirect: old walk -> new walk with query",
  /\/cloudcroft-disc-golf\/app\/walk\.html.*pano=tee2/.test(r2),
  r2,
);

await browser.close();
console.log(
  fails.length
    ? `RESULT FAIL (${fails.length}): ${fails.join("; ")}`
    : "RESULT PASS",
);
process.exit(fails.length ? 1 : 0);
