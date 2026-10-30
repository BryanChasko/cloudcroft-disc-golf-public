#!/usr/bin/env python3
"""Public delivery verification pass for the Cloudcroft walkthrough (read-only).

Covers: every public URL variant (status + redirect), every control exercised
with arrival timing, multi-frame walk responsiveness (pixel-diff series while a
key is held), frame-time observation, console/failed-request logs, and
desktop + phone screenshots for zoomed inspection.
"""
import os, subprocess, time, sys
from playwright.sync_api import sync_playwright

DESKTOP = {"width": 1440, "height": 900}
PHONE = {"width": 390, "height": 844}
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOT = os.path.join(REPO, "docs", "qa", "evidence", "public-pass")
LIVE = "https://bryanchasko.com/disc-golf/walk.html"

def say(part, msg):
    print(f"[{part}] {msg}", flush=True)

def curl_head(url):
    try:
        out = subprocess.run(["curl", "-sI", "-m", "15", "-o", "/dev/null",
                              "-w", "%{http_code} %{redirect_url} %{time_total}s",
                              url], capture_output=True, text=True).stdout.strip()
    except Exception as e:
        return f"ERR {e}"
    return out

def png_diff(a: bytes, b: bytes) -> float:
    # mean abs byte difference over raw PNG bytes is meaningless; decode via PIL
    from PIL import Image, ImageChops
    import io
    ia = Image.open(io.BytesIO(a)).convert("L")
    ib = Image.open(io.BytesIO(b)).convert("L")
    h = ImageChops.difference(ia, ib).histogram()
    total = sum(i * c for i, c in enumerate(h))
    return total / (ia.size[0] * ia.size[1]) / 255.0

def status(page):
    return page.evaluate("document.getElementById('walk-status').textContent")

def click_timed(page, name, part):
    t0 = time.time()
    before = status(page)
    page.get_by_role("button", name=name).click()
    # poll for arrival: status text changes (or 3s timeout for no-op check)
    arrived = None
    for _ in range(60):
        s = status(page)
        if s != before:
            arrived = time.time() - t0
            break
        time.sleep(0.05)
    say(part, f"button {name!r}: arrival={arrived if arrived else 'NO-CHANGE'}s status={status(page)!r}")

def hold_key_series(page, key, part, hold_ms=900, samples=6):
    """Hold key, screenshot at intervals, report frame-to-frame motion."""
    page.keyboard.down(key)
    shots = []
    for i in range(samples):
        time.sleep(hold_ms / 1000 / samples)
        shots.append(page.screenshot())
    page.keyboard.up(key)
    diffs = [png_diff(shots[i], shots[i + 1]) for i in range(samples - 1)]
    moving = sum(1 for d in diffs if d > 0.0005)
    say(part, f"key {key!r} held {hold_ms}ms: seg-diffs={[round(d,4) for d in diffs]} moving={moving}/{samples-1}")
    return shots[-1]

def main():
    import os
    os.makedirs(SHOT, exist_ok=True)
    # ---- 1. URL variants ----
    for u in [LIVE,
              "http://bryanchasko.com/disc-golf/walk.html",
              "https://www.bryanchasko.com/disc-golf/walk.html",
              "https://bryanchasko.com/disc-golf/",
              "https://bryanchasko.com/cloudcroft-disk-golf/",
              "https://bryanchasko.com/cloudcroft-disc-golf/",
              "https://bryanchasko.com/cloudcroft-disc-golf/how-this-works/"]:
        say("urls", f"{curl_head(u)}  {u}")

    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader"])
        # ---- 2. desktop pass ----
        pg = b.new_page(viewport=DESKTOP)
        errs, failed = [], []
        pg.on("console", lambda m: errs.append(m.text) if m.type in ("error",) else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("requestfailed", lambda r: failed.append(r.url))
        t0 = time.time()
        pg.goto(LIVE, wait_until="networkidle")
        pg.wait_for_timeout(2500)
        say("load", f"desktop first render {time.time()-t0:.1f}s status={status(pg)!r}")
        pg.screenshot(path=f"{SHOT}/d-hero.png")
        click_timed(pg, "Community course", "controls")
        pg.wait_for_timeout(600); pg.screenshot(path=f"{SHOT}/d-community.png")
        click_timed(pg, "Tiki course", "controls")
        click_timed(pg, "Trails", "controls"); pg.wait_for_timeout(400)
        pg.screenshot(path=f"{SHOT}/d-trails-off.png")
        click_timed(pg, "Trails", "controls")
        click_timed(pg, "Forest", "controls"); pg.wait_for_timeout(400)
        pg.screenshot(path=f"{SHOT}/d-forest-off.png")
        click_timed(pg, "Forest", "controls")
        click_timed(pg, "Stand at Tiki (360)", "controls")
        pg.wait_for_timeout(600); pg.screenshot(path=f"{SHOT}/d-pano.png")
        click_timed(pg, "Orbit", "controls")
        click_timed(pg, "Enter VR", "controls")
        click_timed(pg, "Walk (WASD)", "controls")
        pg.wait_for_timeout(500); pg.screenshot(path=f"{SHOT}/d-walk0.png")
        # frame-time observation (headless software GL; relative only)
        ft = pg.evaluate("""() => new Promise(res => {
          const ts=[]; let last=performance.now(); let n=0;
          function f(t){ ts.push(t-last); last=t; if(++n<120) requestAnimationFrame(f); else res(ts); }
          requestAnimationFrame(f); })""")
        ft_sorted = sorted(ft)
        say("perf", f"120 frames headless-sw: median={ft_sorted[60]:.1f}ms p90={ft_sorted[108]:.1f}ms (software renderer, relative only)")
        # walk responsiveness: forward, strafe, diagonal+shift
        hold_key_series(pg, "w", "walk")
        pg.screenshot(path=f"{SHOT}/d-walk-fwd.png")
        hold_key_series(pg, "a", "walk")
        pg.keyboard.down("Shift"); hold_key_series(pg, "w", "walk-shift"); pg.keyboard.up("Shift")
        pg.keyboard.down("d"); hold_key_series(pg, "w", "walk-diag"); pg.keyboard.up("d")
        pg.screenshot(path=f"{SHOT}/d-walk-end.png")
        say("errors", f"console errors={len(errs)} failed requests={len(failed)}")
        for e in errs[:10]: say("errors", f"  console: {e[:200]}")
        for f in failed[:10]: say("errors", f"  failed: {f[:200]}")
        pg.close()
        # ---- 3. phone pass ----
        mp = b.new_page(viewport=PHONE, is_mobile=True, has_touch=True)
        merrs, mfailed = [], []
        mp.on("console", lambda m: merrs.append(m.text) if m.type in ("error",) else None)
        mp.on("pageerror", lambda e: merrs.append(str(e)))
        mp.on("requestfailed", lambda r: mfailed.append(r.url))
        mp.goto(LIVE, wait_until="networkidle")
        mp.wait_for_timeout(2500)
        say("phone", f"load status={status(mp)!r}")
        mp.screenshot(path=f"{SHOT}/m-hero.png")
        mp.get_by_role("button", name="Community course").tap()
        mp.wait_for_timeout(600); mp.screenshot(path=f"{SHOT}/m-community.png")
        mp.get_by_role("button", name="Walk (WASD)").tap()
        mp.wait_for_timeout(500); mp.screenshot(path=f"{SHOT}/m-walk.png")
        mp.get_by_role("button", name="Stand at Tiki (360)").tap()
        mp.wait_for_timeout(500); mp.screenshot(path=f"{SHOT}/m-pano.png")
        say("phone", f"console errors={len(merrs)} failed={len(mfailed)}")
        b.close()
    say("done", f"screenshots in {SHOT}/")

if __name__ == "__main__":
    sys.exit(main())
