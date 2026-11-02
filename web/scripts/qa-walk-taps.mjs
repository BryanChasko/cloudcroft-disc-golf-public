// qa-walk-taps.mjs — reusable tap/click coverage probe for the 3D walk.
// Grid-clicks the walk canvas in First Person mode and asserts at least one
// click opens a pin card (photo pins) or a pano (pano pins). Run from web/:
//   node scripts/qa-walk-taps.mjs [base-walk-url]
// Example: node scripts/qa-walk-taps.mjs https://bryanchasko.com/cloudcroft-disc-golf/app/walk.html
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP =
  process.argv[2] ?? "https://bryanchasko.com/cloudcroft-disc-golf/app/walk.html";
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const fails = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  if (!ok) fails.push(name);
};

const errors = [];
page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
await page.goto(APP, { waitUntil: "load", timeout: 60000 });
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
check(
  "walk: pins indexed",
  /survey pins/.test((await page.textContent("#walk-status")) ?? ""),
  (await page.textContent("#walk-status"))?.slice(0, 80),
);

await page.click("#mode-walk");
await page.waitForTimeout(2000);
await page.screenshot({ path: join(OUT, "walk-first-person-start.png") });
let opened = null;
let taps = 0;
outer: for (let py = 200; py <= 640; py += 60) {
  for (let px = 200; px <= 1080; px += 60) {
    await page.mouse.click(px, py);
    taps++;
    await page.waitForTimeout(280);
    const state = await page.evaluate(() => ({
      card: !document.getElementById("pin-card")?.hidden,
      title: document.getElementById("pin-title")?.textContent ?? "",
      pano: !document.querySelector(".pano-viewer")?.hidden,
      panoTitle:
        document.querySelector(".pano-viewer-title")?.textContent ?? "",
    }));
    if (state.card || state.pano) {
      opened = { px, py, taps, ...state };
      break outer;
    }
  }
}
await page.screenshot({ path: join(OUT, "walk-after-taps.png") });
check(
  "walk: tapping a geopoint loads its asset",
  !!opened,
  opened ? JSON.stringify(opened) : `no pin card or pano opened on ${taps} taps`,
);
if (opened) {
  await page.screenshot({ path: join(OUT, "walk-tap-opens-asset.png") });
}
check(
  "walk: no page errors",
  errors.length === 0,
  errors.slice(0, 3).join(" | "),
);

await browser.close();
console.log(fails.length ? `RESULT FAIL (${fails.length})` : "RESULT PASS");
process.exit(fails.length ? 1 : 0);
