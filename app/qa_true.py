"""Measure every page that has demos: with the boundary in place a throwing demo no longer blanks the page,
so 'rendered' vs 'throws' is now a per-demo fact we can publish."""
import json, signal, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

items = [i for i in json.load(open("manifest.json")) if i["variants"]]
shard, total = int(sys.argv[1]), int(sys.argv[2])
mine = items[shard::total]
BASE = "http://localhost:8801/design-catalog/"
out = []
class Boom(Exception): pass
signal.signal(signal.SIGALRM, lambda s, f: (_ for _ in ()).throw(Boom()))
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page(); pg.set_default_timeout(12000)
    for iid in mine:
        rec = {"id": iid}
        signal.alarm(30)
        try:
            pg.goto(f"{BASE}#/i/{iid}", wait_until="domcontentloaded", timeout=20000)
            pg.wait_for_selector(".demo-head", timeout=12000)
            pg.wait_for_timeout(600)
            cards = pg.locator(".demo").count()
            thrown = pg.locator(".demo-body code").count()
            blank = pg.evaluate("""() => [...document.querySelectorAll('.demo-body')]
                .filter(d => d.children.length === 0).length""")
            rec.update({"status": "rendered" if cards and not thrown and not blank else
                        ("throws" if thrown else ("blank" if blank else "rendered")),
                        "cards": cards, "thrown": thrown, "blank": blank,
                        "msg": (pg.locator(".demo-body code").first.inner_text()[:140] if thrown else None)})
        except Boom:
            rec.update({"status": "hung"})
            try: b.close()
            except Exception: pass
            b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1440, "height": 900})
            pg = ctx.new_page(); pg.set_default_timeout(12000)
        except Exception as e:
            rec.update({"status": "unmeasured", "why": str(e)[:80]})
        finally:
            signal.alarm(0)
        out.append(rec)
    b.close()
Path(f"qt-{shard}.json").write_text(json.dumps(out)); print("shard", shard, "done", len(out), flush=True)
