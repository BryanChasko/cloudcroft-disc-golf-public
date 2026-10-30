#!/usr/bin/env python3
"""Smoke the walkthrough: console issues, status, walk-mode keys, VR/pano
messages, screenshots. Usage: walk-smoke.py URL OUTDIR"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

url, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
console, failed = [], []

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--enable-unsafe-swiftshader"])
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.on("console", lambda m: console.append({"type": m.type, "text": m.text[:250]}))
    page.on("pageerror", lambda e: console.append({"type": "pageerror", "text": str(e)[:250]}))
    page.on(
        "requestfailed",
        lambda r: failed.append({"url": r.url[:150], "failure": str(r.failure)[:100]}),
    )
    page.goto(url, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(5000)
    status = page.text_content("#walk-status")
    page.screenshot(path=f"{outdir}/orbit.png")
    # walk mode + forward keys
    page.click("#mode-walk")
    page.wait_for_timeout(500)
    page.keyboard.down("w")
    page.wait_for_timeout(2000)
    page.keyboard.up("w")
    page.screenshot(path=f"{outdir}/walk.png")
    walk_status = page.text_content("#walk-status")
    # VR button (headless: expect the no-XR message)
    page.click("#vr-enter")
    page.wait_for_timeout(500)
    vr_status = page.text_content("#walk-status")
    # pano placeholder
    page.click("#pano-tiki")
    page.wait_for_timeout(300)
    pano_status = page.text_content("#walk-status")
    # back to orbit + fly to community
    page.click("#mode-orbit")
    page.click("#fly-community")
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{outdir}/community.png")
    browser.close()

issues = [c for c in console if c["type"] in ("error", "pageerror")]
report = {
    "status": status,
    "walk_status": walk_status,
    "vr_status": vr_status,
    "pano_status": pano_status,
    "console_errors": issues,
    "failed": failed,
}
json.dump(report, open(f"{outdir}/report.json", "w"), indent=1)
print("status:", status)
print("walk:", walk_status)
print("vr:", vr_status)
print("pano:", pano_status)
print("console errors:", len(issues))
for c in issues[:8]:
    print(" -", c["type"], c["text"][:180])
print("failed requests:", len(failed))
for f in failed[:8]:
    print(" -", f["url"], "|", f["failure"])
