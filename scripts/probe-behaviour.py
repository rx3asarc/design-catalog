#!/usr/bin/env python3
"""
scripts/probe-behaviour.py — run the one measurement instrument over a bounded, honest set, resumably.

`app/probe_behaviour.mjs` is the instrument: it loads a demo in the site's own frame protocol and reads six
facts off it (collapses, sheet, nests, animates, keyboard, shape). It knows how to measure an item; it does not
know which items *should* be measured, and it writes its output in one shot — which is the wrong shape for a
catalogue of 769 items on a 4-core box whose load average wanders between 3 and 19, because one demo that never
settles would end the run and lose everything measured before it.

This script is the selection and the bookkeeping, not a second instrument:

  * **the set is a rule, not a convenience.** By default it is one item per type: the first member of each of
    the 89 types that actually ships a demo (`entry.members.find(hasDemo)`). That is a table on almost every
    collection page, and it is defensible in one sentence. A type whose every member is reference-only has no
    demo to load, and its first member is recorded as **unmeasured with the reason** — never as `false`.
  * **bounded cost.** One item per `node` process, so a demo that hangs costs that item and nothing else; each
    item has a wall-clock cap (`--cap`), and an item that misses it is recorded as unmeasured with the reason.
    `--batch` stops after N items this run, so a later session can add the next batch.
  * **resumable.** Records already in `app/behaviour.json` are kept. A re-run picks up only what is missing,
    and the file is rewritten after every item, so an interrupted run is still a committed thing.
  * **it never invents a fact.** A record this script writes from a failure carries six `null`s and a `reason`;
    `null` is not `false` (`site/behaviour.ts` prints "not measured" for it). The date on each record is the
    moment that item was measured, not the moment the file was written.

The facts go where the site already reads them: `app/behaviour.json`, which `app/gen.py` attaches to each item
as `behaviour` (see the block at the foot of `gen.py`) and `site/behaviour.ts` reads. Nothing here interprets a
measurement: the file carries the probe's own facts, its details and its own version string.

Usage — the first batch (this is what the r8-probe run did):

    (cd app && npx vite build)                       # measure what ships
    python3 app/gen.py                               # a manifest for the probe to select from
    python3 scripts/probe-behaviour.py --base http://127.0.0.1:8896/design-catalog/
    python3 app/gen.py                               # the manifest now carries the facts
    (cd app && npx vite build)

  --set type-first     (default) one item per type: its first member that ships a demo — 68 of 89 types
  --set more-members   the *next* member of each type that has a demo, round-robin, for a later batch
  --set all-members    every member of every type that ships a demo (the whole measurable catalogue)
  --set none           only what --item / --concept name
  --concept KEY        add every item in a concept set (the page's own definition of a set; repeatable)
  --item ID            add one item by id (repeatable)
  --batch N            stop after N newly measured items this run (default: everything pending)
  --cap SECONDS        wall clock per item, probe included (default 75)
  --base URL           a served build (…/design-catalog/). Without it, the probe serves app/dist itself.
  --out PATH           default app/behaviour.json
  --refresh            re-measure ids that already have a record, instead of resuming past them
  --retry-unknown      re-attempt ids whose record answered nothing (a demo that threw may have been fixed)
  --timings PATH       write {id: seconds} for the run, for a report's p50/p95
  --dry-run            print the plan and write nothing

Exit codes: 0 measured or nothing to do, 2 the plan is empty / the build is missing, 3 the build served does not
match app/dist (the served page names another asset — you would be measuring something else).
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
MANIFEST = APP / "manifest.json"
TAXONOMY = APP / "src" / "site" / "taxonomy.json"
DIST = APP / "dist"
PROBE = APP / "probe_behaviour.mjs"
DEFAULT_OUT = APP / "behaviour.json"

SECTIONS = ["Components", "Blocks", "Charts", "Agent UI", "Effects", "Foundations", "Docs"]
FACTS = ("collapses", "sheet", "nests", "animates", "keyboard", "shape")

NO_DEMO_REASON = "no demo in this build: every member of this type is reference-only, so nothing in the set can be measured"
CAP_REASON = "the probe did not finish inside the {cap} s cap for this item: the frame did not settle, so nothing was observed"
CRASH_REASON = "the probe exited {rc} without a record for this item: {tail}"


def now() -> str:
    """Second precision, UTC, the same shape the probe writes (`2026-10-28T22:55:08Z`)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load(path: Path):
    return json.loads(path.read_text())


def blank_record(reason: str, at: str | None = None) -> dict:
    """Six nulls and a reason. The one honest shape for a measurement that did not happen."""
    record = {k: None for k in FACTS}
    record.update({"variant": 0, "reason": reason, "at": at or now()})
    return record


def answered(record: dict) -> bool:
    """Does this record answer anything? The same test `site/behaviour.ts` calls `hasFacts`."""
    return any(isinstance(record.get(k), bool) for k in FACTS)


# ── the set ────────────────────────────────────────────────────────────────────────────────────────────────────

def type_members(taxonomy: dict, manifest: dict) -> list[tuple[str, str, list[dict]]]:
    """Every type, section by section in the rail's order, A–Z inside each — `site/taxonomy.ts`'s own reading."""
    out = []
    for section in SECTIONS:
        for typ in sorted(taxonomy["sections"].get(section, {})):
            ids = taxonomy["sections"][section][typ]
            members = [manifest[i] for i in ids if i in manifest]
            out.append((section, typ, members))
    return out


def has_demo(item: dict) -> bool:
    return bool(item.get("variants"))


def plan(args, types, manifest: dict, store: dict) -> tuple[list[str], list[tuple[str, str]]]:
    """What to measure this run, and what cannot be measured — as ids and (id, reason) pairs."""
    want: list[str] = []
    unmeasurable: list[tuple[str, str]] = []

    def add(i: str) -> None:
        if i not in want:
            want.append(i)

    if args.set == "type-first":
        for _section, _typ, members in types:
            first = next((m for m in members if has_demo(m)), None)
            if first:
                add(first["id"])
            elif members:
                unmeasurable.append((members[0]["id"], NO_DEMO_REASON))
    elif args.set == "more-members":
        # round-robin, so a batch of 40 spreads over 40 types instead of emptying one
        queues = [[m["id"] for m in members if has_demo(m)] for _s, _t, members in types]
        depth = 0
        while any(len(q) > depth for q in queues):
            for q in queues:
                if len(q) > depth:
                    add(q[depth])
            depth += 1
    elif args.set == "all-members":
        for _section, _typ, members in types:
            for m in members:
                if has_demo(m):
                    add(m["id"])
    elif args.set != "none":
        raise SystemExit(f"unknown --set {args.set!r}")

    for key in args.concept:
        for item in manifest.values():
            if key in (item.get("concepts") or []):
                add(item["id"])
    for i in args.item:
        if i not in manifest:
            raise SystemExit(f"--item {i}: not in the manifest")
        add(i)

    pending = [i for i in want if _wanted(i, store, args)]
    unmeasurable = [(i, r) for i, r in unmeasurable if _wanted(i, store, args)]
    return pending, unmeasurable


def _wanted(item_id: str, store: dict, args) -> bool:
    """
    Does this id still need a run?

    A record already in the file is the file's answer, and a record that answered nothing carries its own reason —
    "no demo", "the demo does not run here". Re-running those on every resume would make a batch never finish and
    would quietly overwrite a reason with a fresh attempt at the same wall. `--retry-unknown` is how a later session
    asks for those to be tried again (a demo that threw may have been fixed); `--refresh` re-measures everything.
    """
    record = store.get(item_id)
    if record is None or args.refresh:
        return True
    return bool(args.retry_unknown) and not answered(record)


# ── one item, one process, one cap ─────────────────────────────────────────────────────────────────────────────

def measure(item_id: str, args) -> tuple[dict, float, str]:
    """Run the probe for one item. Returns (record, seconds, note). Never raises: a failure is a record."""
    out = Path(tempfile.mkstemp(prefix="probe-", suffix=".json")[1])
    cmd = [args.node, str(PROBE), "--item", item_id, "--out", str(out)]
    if args.base:
        cmd += ["--base", args.base]
    t0 = time.time()
    try:
        proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=args.cap)
    except subprocess.TimeoutExpired:
        out.unlink(missing_ok=True)
        return blank_record(CAP_REASON.format(cap=args.cap)), time.time() - t0, f"capped at {args.cap}s"
    secs = time.time() - t0
    if proc.returncode != 0 or not out.exists():
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-1:] or ["no output"]
        out.unlink(missing_ok=True)
        return (blank_record(CRASH_REASON.format(rc=proc.returncode, tail=tail[0][:120])),
                secs, f"exit {proc.returncode}")
    record = (load(out).get("items") or {}).get(item_id)
    out.unlink(missing_ok=True)
    if not record:
        return blank_record(CRASH_REASON.format(rc=0, tail="the probe wrote no record for it")), secs, "no record"
    record["at"] = now()
    return record, secs, "measured"


# ── the file ──────────────────────────────────────────────────────────────────────────────────────────────────

def write_store(path: Path, store: dict, meta: dict, runs: list[dict]) -> None:
    """Write the merged record. Counts and dates are recomputed from the records, never carried over stale."""
    counts = {"true": 0, "false": 0, "null": 0}
    per_fact = {k: {"true": 0, "false": 0, "null": 0} for k in FACTS}
    for record in store.values():
        for k in FACTS:
            key = "true" if record.get(k) is True else "false" if record.get(k) is False else "null"
            counts[key] += 1
            per_fact[k][key] += 1
    dates = sorted(r["at"] for r in store.values() if r.get("at"))
    doc = {
        "probe": "app/probe_behaviour.mjs",
        "version": meta.get("version", "behaviour/1"),
        # the run date the site prints. It is the newest measurement in the file: `gen.py` stamps every item with
        # this one value, so a file that spans several days is only exactly right for the newest one — each record
        # keeps its own `at` beside it, and `runs` below says which batch each came from.
        "probed_at": dates[-1] if dates else meta.get("probed_at"),
        "frames": meta.get("frames", {"wide": {"width": 1440, "height": 900}, "narrow": {"width": 390, "height": 844},
                                      "staticFlagOnStructurePass": True}),
        "selection": meta.get("selection", {}),
        "manifestSha256": meta.get("manifestSha256"),
        "build": meta.get("build"),
        "facts": list(FACTS),
        "counts": {"items": len(store), "values": counts, "perFact": per_fact},
        "limits": meta.get("limits", []),
        "runs": runs,
        "items": {k: store[k] for k in sorted(store)},
    }
    path.write_text(json.dumps(doc, indent=1) + "\n")


def served_asset(base: str) -> str | None:
    try:
        with urllib.request.urlopen(base.rstrip("/") + "/index.html", timeout=20) as r:
            html = r.read().decode("utf-8", "replace")
    except Exception:
        return None
    import re
    m = re.search(r"assets/(main-[\w-]+\.js)", html)
    return m.group(1) if m else None


def local_asset() -> str | None:
    index = DIST / "index.html"
    if not index.exists():
        return None
    import re
    m = re.search(r"assets/(main-[\w-]+\.js)", index.read_text())
    return m.group(1) if m else None


def sha(path: Path) -> str | None:
    import hashlib
    if not path.exists():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def main() -> int:
    ap = argparse.ArgumentParser(add_help=True, description="measure a bounded set with app/probe_behaviour.mjs")
    ap.add_argument("--set", default="type-first", choices=["type-first", "more-members", "all-members", "none"])
    ap.add_argument("--concept", action="append", default=[])
    ap.add_argument("--item", action="append", default=[])
    ap.add_argument("--batch", type=int, default=0)
    ap.add_argument("--cap", type=float, default=75.0)
    ap.add_argument("--base", default="")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--retry-unknown", action="store_true")
    ap.add_argument("--timings", default="")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--node", default="node")
    args = ap.parse_args()

    if not MANIFEST.exists():
        raise SystemExit("probe-behaviour: app/manifest.json is missing — run `python3 app/gen.py` first")
    if not PROBE.exists():
        raise SystemExit("probe-behaviour: app/probe_behaviour.mjs is missing")

    manifest = {i["id"]: i for i in load(MANIFEST)}
    types = type_members(load(TAXONOMY), manifest)

    out_path = Path(args.out)
    previous = load(out_path) if out_path.exists() else {}
    store: dict = dict(previous.get("items") or {})
    runs: list[dict] = list(previous.get("runs") or [])
    meta = {k: previous.get(k) for k in ("version", "frames", "limits", "selection", "manifestSha256", "build")}
    # the probe's own limits are the instrument's, not this script's: keep the copy the last probe run published
    if not meta.get("limits"):
        meta["limits"] = []

    pending, unmeasurable = plan(args, types, manifest, store)
    if args.batch:
        pending = pending[: args.batch]

    if not pending and not unmeasurable:
        silent = sum(1 for r in store.values() if not answered(r))
        print(f"probe-behaviour: nothing to do — {len(store)} record(s) already in {out_path.name}"
              + (f", {silent} of them a recorded reason instead of a fact (--retry-unknown re-attempts those)" if silent else ""))
        return 0

    # ── preflight: is the thing being measured the build on disk? ──
    if args.base:
        served, local = served_asset(args.base), local_asset()
        print(f"probe-behaviour: base {args.base} serves {served or '(no asset hash found)'}"
              + (f", app/dist builds {local}" if local else ", app/dist is absent (nothing to compare)"))
        if local and served and served != local:
            print(f"probe-behaviour: STOP — the served page names {served} but app/dist builds {local}; "
                  "that is another build's measurement", file=sys.stderr)
            return 3
    elif not DIST.exists():
        raise SystemExit("probe-behaviour: app/dist is missing — `(cd app && npx vite build)` first, "
                         "or pass --base for a served build")

    print(f"probe-behaviour: {len(pending)} item(s) to measure, {len(unmeasurable)} type(s) with nothing to measure, "
          f"cap {args.cap:g}s/item, {len(store)} record(s) already in the file")
    for i, reason in unmeasurable[:3]:
        print(f"  unmeasurable  {i}  ({reason[:60]}…)")
    if len(unmeasurable) > 3:
        print(f"  … and {len(unmeasurable) - 3} more type(s) whose members are all reference-only")
    if args.dry_run:
        for i in pending[:20]:
            print(f"  would measure {i}")
        if len(pending) > 20:
            print(f"  … and {len(pending) - 20} more")
        return 0

    started = now()
    took: dict[str, float] = {}
    measured = skipped = 0

    def flush() -> None:
        meta["selection"] = {
            "sets": [args.set] + [f"concept:{c}" for c in args.concept] + [f"item:{i}" for i in args.item],
            "batch": args.batch or None,
            "refresh": bool(args.refresh),
            "cap_s": args.cap,
            "complete": not args.batch,
        }
        meta["manifestSha256"] = sha(MANIFEST)
        meta["build"] = sha(DIST / "demo.html")
        write_store(out_path, store, meta, runs)

    for i, (item_id, reason) in enumerate(unmeasurable, 1):
        store[item_id] = blank_record(reason)
        skipped += 1
        print(f"  {i:3}/{len(unmeasurable)} {item_id:<38} unmeasured — {reason[:64]}")
    if unmeasurable:
        flush()

    for n, item_id in enumerate(pending, 1):
        load_note = f"{n}/{len(pending)}"
        record, secs, note = measure(item_id, args)
        took[item_id] = round(secs, 2)
        store[item_id] = record
        if answered(record):
            measured += 1
        else:
            skipped += 1
        mark = (lambda v: "yes" if v is True else "no " if v is False else " ? ")
        if took:
            values = sorted(took.values())
            p50 = statistics.median(values)
            eta = p50 * (len(pending) - n) / 60 if len(pending) > n else 0.0
            tail = f" p50 {p50:4.1f}s eta {eta:4.1f}m"
        else:
            tail = ""
        print(f"  {load_note:>9} {item_id:<38} "
              f"collapse {mark(record.get('collapses'))} sheet {mark(record.get('sheet'))} "
              f"nest {mark(record.get('nests'))} anim {mark(record.get('animates'))} "
              f"keys {mark(record.get('keyboard'))} shape {mark(record.get('shape'))} "
              f"{secs:5.1f}s{tail}" + (f"  ({note})" if note != "measured" else ""), flush=True)
        flush()  # every item, not every run: an interrupted batch is still a committed batch

    values = sorted(took.values())
    stat = {
        "at": started,
        "set": args.set,
        "measured": measured,
        "unmeasured": skipped,
        "cap_s": args.cap,
        "secs": {
            "n": len(values),
            "p50": round(statistics.median(values), 2) if values else None,
            "p95": round(values[min(len(values) - 1, int(round(0.95 * (len(values) - 1))))], 2) if values else None,
            "max": round(values[-1], 2) if values else None,
            "total": round(sum(values), 1),
        },
    }
    runs.append(stat)
    flush()
    if args.timings:
        Path(args.timings).write_text(json.dumps(took, indent=1) + "\n")

    print(f"\nprobe-behaviour: measured {measured}, unmeasured {skipped}, "
          f"file now holds {len(store)} record(s); wrote {out_path}")
    if values:
        print(f"  per item: p50 {stat['secs']['p50']}s  p95 {stat['secs']['p95']}s  max {stat['secs']['max']}s  "
              f"total {stat['secs']['total']}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
