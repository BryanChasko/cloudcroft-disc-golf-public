#!/usr/bin/env python3
"""Verify fix round 2 (critique-2 shortfalls) on local dist."""
import shutil, subprocess, tempfile, time, os, sys
from playwright.sync_api import sync_playwright

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIST = os.path.join(REPO, "web", "dist")
OUT = os.path.join(REPO, "docs", "qa", "evidence", "final")
os.makedirs(OUT, exist_ok=True)
SERVE = tempfile.mkdtemp(prefix="walk-serve-")
link = os.path.join(SERVE, "disc-golf")
os.symlink(DIST, link)
srv = subprocess.Popen(["python3", "-m", "http.server", "8931"],
                       cwd=SERVE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
URL = "http://127.0.0.1:8931/disc-golf/walk.html"
ARGS = ["--use-gl=swiftshader", "--force-prefers-reduced-motion"]

def status(pg):
    return pg.evaluate("document.getElementById('walk-status').textContent")

try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        pg = b.new_page(viewport={"width": 1280, "height": 800})
        errs, failed = [], []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("requestfailed", lambda r: failed.append(r.url))
        pg.goto(URL, wait_until="networkidle")
        pg.wait_for_timeout(3000)
        print("ready:", status(pg), flush=True)
        # 1. walk foreground at spawn + after W hold
        pg.get_by_role("button", name="Walk (WASD)").click()
        pg.wait_for_timeout(1200)
        pg.screenshot(path=f"{OUT}/walk0.png")
        pg.keyboard.down("w"); pg.wait_for_timeout(1500); pg.keyboard.up("w")
        pg.wait_for_timeout(800)
        pg.screenshot(path=f"{OUT}/walk-w.png")
        # 2. look-down clamp: drag down hard, smear must not fill frame
        pg.mouse.move(640, 400); pg.mouse.down()
        for _ in range(10):
            pg.mouse.move(640, 700, steps=2); pg.wait_for_timeout(80)
        pg.mouse.up(); pg.wait_for_timeout(800)
        pg.screenshot(path=f"{OUT}/walk-lookdown.png")
        # 3. aimed walk at basket: strafe onto the pin axis, then shift-W
        # must park at the 3.0 stop radius, no penetration
        pg.get_by_role("button", name="Walk (WASD)").click()
        pg.wait_for_timeout(800)
        pg.keyboard.down("a"); pg.wait_for_timeout(700); pg.keyboard.up("a")
        pg.keyboard.down("Shift"); pg.keyboard.down("w")
        pg.wait_for_timeout(2500)
        pg.keyboard.up("w"); pg.keyboard.up("Shift")
        pg.wait_for_timeout(800)
        pg.screenshot(path=f"{OUT}/walk-shift-basket.png")
        # look back at the pin we just walked past: must be close, outside,
        # never penetrated (two 400px drags ~= 180 deg at 0.004 rad/px)
        for _ in range(2):
            pg.mouse.move(640, 400); pg.mouse.down()
            pg.mouse.move(240, 400, steps=4); pg.wait_for_timeout(200)
            pg.mouse.up(); pg.wait_for_timeout(300)
        pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/walk-shift-lookback.png")
        # 4. pano card auto-hide on mode change
        pg.get_by_role("button", name="Stand at Tiki (360)").click()
        pg.wait_for_timeout(1000)
        vis1 = pg.evaluate("!document.getElementById('pano-card').hidden")
        pg.get_by_role("button", name="Orbit").click()
        pg.wait_for_timeout(600)
        vis2 = pg.evaluate("!document.getElementById('pano-card').hidden")
        print("pano card visible after Stand:", vis1, "| after Orbit:", vis2, flush=True)
        # 5. grazing tilt: plinth curtain seals slab lip
        pg.mouse.move(640, 400); pg.mouse.down()
        for _ in range(12):
            pg.mouse.move(640, 150, steps=2); pg.wait_for_timeout(60)
        pg.mouse.up(); pg.wait_for_timeout(1000)
        pg.screenshot(path=f"{OUT}/graze.png")
        # 6. tree bases: walk from the spawn to the tree line just
        # outside the pin clearing; blob shadows ground the trunks
        pg.get_by_role("button", name="Walk (WASD)").click()
        pg.wait_for_timeout(800)
        pg.keyboard.down("w"); pg.wait_for_timeout(1200); pg.keyboard.up("w")
        pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/treebases.png")
        print("desktop errors:", len(errs), "failed:", len(failed), flush=True)
        for e in errs[:5]: print("  err:", e[:160], flush=True)
        pg.close()
        # 7. phone open: Community label must not half-clip
        mp = b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        merrs = []
        mp.on("pageerror", lambda e: merrs.append(str(e)))
        mp.goto(URL, wait_until="networkidle")
        mp.wait_for_timeout(3000)
        mp.screenshot(path=f"{OUT}/phone-open.png")
        print("phone errors:", len(merrs), flush=True)
        b.close()
finally:
    srv.terminate()
    shutil.rmtree(SERVE, ignore_errors=True)
print("shots in", OUT, flush=True)
