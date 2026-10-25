"""Render a slice of catalogue pages, one item at a time, with a hard per-item alarm so a locking demo
cannot stall the sweep. A hang is recorded as a hang, not silently retried."""
import json, signal, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

shard, total = int(sys.argv[1]), int(sys.argv[2])
items = json.load(open("manifest.json"))
mine = [it for n, it in enumerate(items) if n % total == shard]
BASE = "http://localhost:8801/design-catalog/"
out = []

class Boom(Exception): pass
def on_alarm(signum, frame): raise Boom("item exceeded 20s")

signal.signal(signal.SIGALRM, on_alarm)
with sync_playwright() as p:
    for n, it in enumerate(mine):
        if n % 30 == 0:
            b = p.chromium.launch()
            ctx = b.new_context(viewport={"width": 1440, "height": 900})
            pg = ctx.new_page(); pg.set_default_timeout(6000)
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        rec = {"id": it["id"]}
        signal.alarm(20)
        try:
            pg.goto(f"{BASE}#/i/{it['id']}", wait_until="domcontentloaded", timeout=12000)
            pg.wait_for_selector(".page-in", timeout=6000)
            pg.wait_for_timeout(350)
            demos = pg.locator(".demo-head").count()
            nodes = pg.locator(".demo-body *").count()
            withheld = pg.locator(".withheld").count()
            rec.update({"status": "withheld" if withheld else ("rendered" if demos and nodes else ("blank" if demos else "no demo")),
                        "demos": demos, "nodes": nodes, "note": it.get("renderNote")})
        except Boom:
            rec.update({"status": "hung", "note": it.get("renderNote")})
            try: b.close()
            except Exception: pass
            b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1440, "height": 900})
            pg = ctx.new_page(); pg.set_default_timeout(6000)
        except Exception as e:
            rec.update({"status": "error", "why": str(e)[:120], "note": it.get("renderNote")})
        finally:
            signal.alarm(0)
        rec["errors"] = errs[-2:]
        out.append(rec)
    try: b.close()
    except Exception: pass
Path(f"qa-{shard}.json").write_text(json.dumps(out))
print("shard", shard, "done", len(out))
