"""Render every catalogue page in a real browser and record what actually mounted."""
import json, time
from pathlib import Path
from playwright.sync_api import sync_playwright

items = json.load(open("manifest.json"))
BASE = "http://localhost:8801/design-catalog/"
out = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    for n, it in enumerate(items):
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:180]))
        pg.goto(f"{BASE}#/i/{it['id']}", wait_until="domcontentloaded")
        try:
            pg.wait_for_selector(".page-in", timeout=15000)
        except Exception:
            out.append({"id": it["id"], "status": "no page"}); continue
        pg.wait_for_timeout(450)
        demos = pg.locator(".demo-head").count()
        nodes = pg.locator(".demo-body *").count()
        withheld = pg.locator(".withheld").count()
        status = "withheld" if withheld else ("rendered" if demos and nodes else ("blank" if demos else "no demo"))
        out.append({"id": it["id"], "status": status, "demos": demos, "nodes": nodes,
                    "errors": errs[:2], "note": it.get("renderNote")})
        if n % 50 == 0:
            Path("qa.json").write_text(json.dumps(out))
            print(n, it["id"], status, flush=True)
    b.close()
Path("qa.json").write_text(json.dumps(out))
print("done", len(out))
