// qa-surfaces-play.mjs — headless play-through of all three intertwined
// surfaces: story (/cloudcroft-disc-golf/), map app (/disc-golf/), walk
// (/disc-golf/walk.html). Drives public controls, asserts the survey
// wiring counts (27 points, 15 photos, 5 panos, 20 screenshots), the
// shared radio tuner, and deep links. Run from web/:
//   node scripts/qa-surfaces-play.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://bryanchasko.com";
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

// hold-to-charge throw: ~820ms ≈ 75% power, near hole-2 band
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

// hole pick changes the band
const sweet1 = await page.$eval("#sweet", (el) => el.style.left);
await page.click('[data-throw-hole="1"]');
const sweet2 = await page.$eval("#sweet", (el) => el.style.left);
check(
  "throw: hole pick moves basket band",
  sweet1 !== sweet2,
  `${sweet1} -> ${sweet2}`,
);
await page.click('[data-throw-hole="2"]');

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
  firstCoord:
    document.querySelector("#pts-table tbody td.coords")?.textContent ?? "",
}));
check("gallery: 15 photos", counts.photos === 15, String(counts.photos));
check("gallery: 5 panos", counts.panos === 5, String(counts.panos));
check("gallery: 20 screenshots", counts.shots === 20, String(counts.shots));
check("points table: 27 rows", counts.rows === 27, String(counts.rows));
check(
  "points table: 21 photo links",
  counts.photoLinks === 21,
  String(counts.photoLinks),
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
await page.goto(`${ORIGIN}/disc-golf/?course=community&hole=2`, {
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
  "app: deep link set hole 2 + community tab",
  app.scoreHole === "2" && /Community/.test(app.activeTab),
  `hole=${app.scoreHole} tab=${app.activeTab} status=${app.status}`,
);
await shot("app-gallery-tuner.png");

// ---------- walk ----------
await page.goto(`${ORIGIN}/disc-golf/walk.html`, {
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
  pinCard: !!document.getElementById("pin-card"),
  tuner: !!document.querySelector("[data-radio-tuner] .rt-play"),
}));
check(
  "walk: 27 survey pins status",
  /27 survey pins/.test(walk.status),
  walk.status.slice(0, 90),
);
check("walk: pin card + tuner present", walk.pinCard && walk.tuner);
await page.waitForTimeout(2500);
await shot("walk-pins.png");

// pano deep link lands on the right pano with per-pano text
await page.goto(`${ORIGIN}/disc-golf/walk.html?pano=tiki-aspen`, {
  waitUntil: "load",
  timeout: 60000,
});
await page
  .waitForFunction(() => !document.getElementById("pano-card")?.hidden, null, {
    timeout: 60000,
  })
  .catch(() => {});
const pano = await page.evaluate(() => ({
  title: document.getElementById("pano-title")?.textContent ?? "",
  text: document.getElementById("pano-text")?.textContent ?? "",
  caption: document.getElementById("pano-caption")?.textContent ?? "",
}));
check(
  "walk: ?pano=tiki-aspen deep link",
  /aspen/i.test(pano.title) && /32\.956922/.test(pano.text),
  `${pano.title} · ${pano.caption}`,
);
await shot("walk-pano-tiki.png");

await browser.close();
console.log(
  fails.length
    ? `RESULT FAIL (${fails.length}): ${fails.join("; ")}`
    : "RESULT PASS",
);
process.exit(fails.length ? 1 : 0);
