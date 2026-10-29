#!/usr/bin/env python3
"""Smoke a URL in headless Chromium: console errors/warnings, failed requests,
status text, screenshot. Usage: smoke.py URL OUTDIR"""
import json
import sys
from playwright.sync_api import sync_playwright

url, outdir = sys.argv[1], sys.argv[2]
import os

os.makedirs(outdir, exist_ok=True)
console, failed = [], []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.on("console", lambda m: console.append({"type": m.type, "text": m.text[:300]}))
    page.on("pageerror", lambda e: console.append({"type": "pageerror", "text": str(e)[:300]}))
    page.on(
        "requestfailed",
        lambda r: failed.append({"url": r.url[:160], "failure": str(r.failure)[:120]}),
    )
    page.goto(url, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(4000)
    status = page.evaluate("document.getElementById('status')?.textContent ?? 'NO-STATUS'")
    holes = page.evaluate("document.querySelectorAll('#holes tbody tr').length")
    try:
        page.screenshot(path=f"{outdir}/shot.png")
    except Exception as e:  # noqa: BLE001
        print("screenshot failed:", e)
    browser.close()

report = {"status": status, "hole_rows": holes, "console": console, "failed": failed}
json.dump(report, open(f"{outdir}/report.json", "w"), indent=1)
print("status:", status)
print("hole_rows:", holes)
print("console issues:", len([c for c in console if c["type"] in ("error", "warning", "pageerror")]))
for c in console:
    if c["type"] in ("error", "warning", "pageerror"):
        print(" -", c["type"], c["text"][:200])
print("failed requests:", len(failed))
for f in failed[:10]:
    print(" -", f["url"], "|", f["failure"])
