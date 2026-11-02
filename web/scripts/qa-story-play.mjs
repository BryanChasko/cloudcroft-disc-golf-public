// qa-story-play.mjs — headless play-through of the gamified story page.
// Drives public controls (throw, steppers, scroll) and asserts outcomes.
// Run from web/: node scripts/qa-story-play.mjs [base-url]
// Default base: https://bryanchasko.com/cloudcroft-disc-golf/
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "https://bryanchasko.com/cloudcroft-disc-golf/";
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

await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(1200);

// 1. Throw a disc: mid-flight capture + note change + basket rattle class.
const before = await page.textContent("#throw-note");
// Hold-to-charge like a player: ~300ms hold ≈ 27% power throw.
const btn = await page.$("#throw-btn");
const bb = await btn.boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.mouse.down();
await page.waitForTimeout(300);
await page.mouse.up();
await page.waitForTimeout(650);
const midFlight = join(OUT, "story-disc-midflight.png");
await page.screenshot({ path: midFlight });
const flying = await page.$eval("#disc", (el) => {
  const cs = getComputedStyle(el);
  return { distance: cs.offsetDistance, transform: cs.transform };
});
await page.waitForTimeout(900);
const after = await page.textContent("#throw-note");
check("throw: note changes", before !== after, JSON.stringify(after));
check("throw: disc mid-flight (offset 0-100%)",
  /%$/.test(flying.distance) && parseFloat(flying.distance) > 5 &&
    parseFloat(flying.distance) < 100,
  flying.distance);

// 2. Steppers + vs-par total.
const row = (n) => `.play-row[data-hole="${n}"]`;
const out = (n) => page.textContent(`${row(n)} output`);
const vs = (n) => page.textContent(`${row(n)} .vs`);
await page.click(`${row(1)} .dec`); // 4 -> 3 (birdie)
check("hole1 dec: 4->3", (await out(1)) === "3");
check("hole1 vs birdie: -1", (await vs(1)) === "-1");
await page.click(`${row(1)} .inc`); // back to 4
await page.click(`${row(1)} .inc`); // 5 (bogey)
check("hole1 inc x2: 3->5, +1", (await out(1)) === "5" && (await vs(1)) === "+1");
await page.click(`${row(2)} .inc`); // 3->4 (+1)
check("hole2 inc: 3->4, +1", (await out(2)) === "4" && (await vs(2)) === "+1");
await page.click(`${row(2)} .dec`); // back to 3
const total = await page.textContent("#play-total");
check("total: +1 through 2", total.trim().startsWith("+1 through 2"), total.trim());

// 3. Scroll: progress ribbon fills + cards reveal + FPS while scrolling.
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const t0 = performance.now();
      const step = () => {
        frames++;
        window.scrollBy(0, 40);
        if (performance.now() - t0 < 2000) requestAnimationFrame(step);
        else resolve(Math.round((frames / (performance.now() - t0)) * 1000));
      };
      requestAnimationFrame(step);
    }),
);
const ribbon = await page.$eval("#progress-bar", (el) => el.getBoundingClientRect().width);
check("scroll: ribbon filled", ribbon > 100, `${Math.round(ribbon)}px`);
check("scroll: rAF responsive", fps >= 20, `${fps} fps (swiftshader)`);
await page.waitForTimeout(800);
const revealed = await page.$$eval("section.card.reveal", (els) => ({
  total: els.length,
  shown: els.filter((el) => el.classList.contains("in")).length,
}));
check("scroll: cards revealed", revealed.shown >= 3, `${revealed.shown}/${revealed.total}`);

// 4. Frame strip: 3 rapid captures during a second throw (motion proof).
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await page.click("#throw-btn");
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(380);
  await page.screenshot({ path: join(OUT, `story-flight-f${i}.png`) });
}
await browser.close();
console.log(fails.length ? `RESULT FAIL (${fails.length})` : "RESULT PASS");
process.exit(fails.length ? 1 : 0);
