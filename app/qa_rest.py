import json, signal, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
shard, total = int(sys.argv[1]), int(sys.argv[2])
ids = json.load(open("qa_rest.json"))[shard::total]
BASE = "http://localhost:8801/design-catalog/"
out = []
class Boom(Exception): pass
signal.signal(signal.SIGALRM, lambda s, f: (_ for _ in ()).throw(Boom("item exceeded 25s")))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page(); pg.set_default_timeout(15000)
    for n, iid in enumerate(ids):
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        rec = {"id": iid}
        signal.alarm(25)
        try:
            pg.goto(f"{BASE}#/i/{iid}", wait_until="domcontentloaded", timeout=20000)
            pg.wait_for_selector(".page-in", timeout=15000)
            pg.wait_for_timeout(500)
            demos = pg.locator(".demo-head").count(); nodes = pg.locator(".demo-body *").count()
            withheld = pg.locator(".withheld").count()
            rec.update({"status": "withheld" if withheld else ("rendered" if demos and nodes else ("blank" if demos else "no demo")),
                        "demos": demos, "nodes": nodes})
        except Boom:
            rec.update({"status": "hung"})
            try: b.close()
            except Exception: pass
            b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1440, "height": 900})
            pg = ctx.new_page(); pg.set_default_timeout(15000)
        except Exception as e:
            rec.update({"status": "slow", "why": str(e)[:90]})
        finally:
            signal.alarm(0)
        rec["errors"] = errs[:2]
        out.append(rec)

    b.close()
Path(f"qar-{shard}.json").write_text(json.dumps(out)); print("shard", shard, "done", len(out))
