#!/usr/bin/env python3
"""Export the catalogue into the public repo: one static page, one data tree, one installable package.

Rules this enforces rather than documents:

  * MIT sources (`code_policy='full'`) ship their code. The other three ship an entry with
    `withheld: true` and the reason, never the source: beautifului's terms are unclear, rareui's repo
    reports NOASSERTION, and transitions.dev forbids republishing the collection.
  * The page and the CLI read the same bytes: everything is written once, then listed in CHECKSUMS.txt.
  * Nothing is renamed or reflowed. File paths and comments stay as the authors wrote them.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

DB = Path("/root/design-catalog/design-catalog.db")
OUT = Path("/root/design-catalog-site/docs")
PACK_ROOT = Path("/root/design-catalog-site")
LICENCE_TEXT = {
    "shadcn": ("MIT", True, "https://github.com/shadcn-ui/ui/blob/main/LICENSE.md"),
    "beui": ("MIT", True, "https://beui.dev/llms.txt"),
    "beautifului": ("unclear", False, "https://beautifului.dev/"),
    "rareui": ("free to use, repo reports NOASSERTION", False, "https://www.rareui.com/llms.txt"),
    "transitions": ("MIT, collection may not be republished", False, "https://transitions.dev/terms.html"),
}
KIND_ORDER = ["component", "block", "pattern", "effect", "text"]


def page_url(source: str, slug: str, url: str | None) -> str | None:
    if source == "rareui":                      # their docs use no hyphens: /components/fluidorb
        return f"https://www.rareui.com/components/{slug.replace('-', '')}"
    if source == "shadcn":
        return f"https://ui.shadcn.com/docs/components/{slug}" if not slug.startswith("docs-") else None
    if source in ("beui", "transitions", "beautifului"):
        return url
    return url


def install_cmd(source: str, slug: str, url: str | None) -> str | None:
    if source == "shadcn":
        return f"npx shadcn@latest add {slug}"
    if source == "beui":
        return f"npx shadcn@latest add https://beui.dev/r/{slug}"
    if source == "rareui":
        return f"npx shadcn@latest add https://www.rareui.com/r/{slug}.json"
    return None


def main() -> int:
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row

    (OUT / "data" / "items").mkdir(parents=True, exist_ok=True)
    for d in (OUT / "data" / "items").glob("*.json"):
        d.unlink()

    index, sources = [], {}
    for s in conn.execute("SELECT * FROM source ORDER BY slug"):
        licence, publishable, licence_url = LICENCE_TEXT.get(
            s["slug"], (s["licence"], s["code_policy"] == "full", None))
        sources[s["slug"]] = {
            "name": s["name"], "url": s["url"], "licence": licence,
            "licence_url": licence_url, "publishable": publishable,
            "code_policy": s["code_policy"], "notes": s["notes"],
        }

    rows = conn.execute("""
        SELECT i.id, i.slug, i.kind, i.name, i.one_line, i.url, i.tags, s.slug AS source
        FROM item i JOIN source s ON s.id = i.source_id""").fetchall()

    for r in rows:
        src = sources[r["source"]]
        files = [dict(path=a["path"], content=a["content"], sha256=a["sha256"], bytes=a["bytes"])
                 for a in conn.execute("""
                     SELECT a.path, a.content, a.sha256, a.bytes FROM artifact a
                     JOIN snapshot sn ON sn.id = a.snapshot_id
                     WHERE sn.item_id=? AND a.kind='code'
                       AND sn.id = (SELECT max(id) FROM snapshot WHERE item_id=?)
                     ORDER BY a.path""", (r["id"], r["id"]))]
        facts = [dict(key=f["key"], value=f["value"], unit=f["unit"], selector=f["selector"])
                 for f in conn.execute("""
                     SELECT f.key, f.value, f.unit, f.selector FROM fact f
                     JOIN snapshot sn ON sn.id = f.snapshot_id
                     WHERE sn.item_id=? AND sn.id=(SELECT max(id) FROM snapshot WHERE item_id=?)
                     ORDER BY f.key LIMIT 24""", (r["id"], r["id"]))]
        # A verdict is written against a different product, in one sitting, bound to no commit: it is
        # evidence about *our* triage, not about the item. It is published only when a human has flipped
        # port_note.public for that row (0 of 159 today), so the export stops carrying private context.
        note = conn.execute("SELECT verdict, reason, ours_path FROM port_note WHERE item_id=? AND public=1",
                            (r["id"],)).fetchone()

        publishable = src["publishable"] and not (r["source"] == "transitions")
        entry = {
            "source": r["source"], "slug": r["slug"], "kind": r["kind"], "name": r["name"],
            "one_line": r["one_line"], "page": page_url(r["source"], r["slug"], r["url"]),
            "install": install_cmd(r["source"], r["slug"], r["url"]),
            "licence": src["licence"], "licence_url": src["licence_url"],
            "withheld": not publishable,
        }
        if not publishable:
            entry["withheld_reason"] = {
                "beautifului": "their terms are unclear, so we do not republish it",
                "rareui": "their repo reports NOASSERTION rather than a named licence",
                "transitions": "their terms allow use but forbid republishing the collection",
            }.get(r["source"], "the licence does not allow republication")
        if note:
            entry["verdict"] = {"verdict": note["verdict"], "reason": note["reason"],
                                "ours_path": note["ours_path"]}

        full = dict(entry)
        if publishable:
            full["files"] = files
        full["facts"] = facts
        rel = f"data/items/{r['source']}-{r['slug']}.json"
        (OUT / rel).write_text(json.dumps(full, separators=(',', ':')))
        entry["path"] = rel
        entry["files"] = len(files)
        # 178 items have no captured code. `sum([])` is 0, and a published `0` bytes reads as a measured
        # weight rather than an absence, so the honest value here is null.
        entry["bytes"] = sum(f["bytes"] or 0 for f in files) if files else None
        index.append(entry)

    index.sort(key=lambda e: (KIND_ORDER.index(e["kind"]) if e["kind"] in KIND_ORDER else 9,
                              e["source"], e["slug"]))
    (OUT / "data" / "index.json").write_text(json.dumps({
        "generated": subprocess.check_output(["date", "-u", "+%Y-%m-%dT%H:%M:%SZ"]).decode().strip(),
        "sources": sources, "items": index}, indent=1))

    # The package other machines install: the CLI/MCP plus the whole publishable catalogue in one file.
    # The package carries every entry, so an agent asking "what did we reject and why" gets an answer even
    # when the source is withheld. Files are present only where the licence allows them.
    bundle = [json.loads((OUT / e["path"]).read_text()) for e in index]
    (OUT / "data" / "catalog.json").write_text(json.dumps(bundle, separators=(",", ":")))

    state_file = PACK_ROOT / ".export-state.json"
    bundle_hash = hashlib.sha256((OUT / "data" / "catalog.json").read_bytes()).hexdigest()
    state = json.loads(state_file.read_text()) if state_file.exists() else {}
    pkgj = json.loads((PACK_ROOT / "package.json").read_text())
    if state.get("bundle") and state["bundle"] != bundle_hash:
        major, minor, patch = (int(x) for x in pkgj["version"].split("."))
        pkgj["version"] = f"{major}.{minor}.{patch + 1}"
        (PACK_ROOT / "package.json").write_text(json.dumps(pkgj, indent=2) + "\n")
    state_file.write_text(json.dumps({"bundle": bundle_hash, "version": pkgj["version"]}, indent=1))
    version = pkgj["version"]
    # WHY cwd=PACK_ROOT (fixed 2026-10-28): this packed from OUT (= site/docs) which has no package.json,
    # so `npm pack` exited 254 with an ENOENT that `--silent` then swallowed — the step returned 1 and
    # publish.sh stopped AFTER copying dist and BEFORE writing the package or CHECKSUMS.txt. A silent
    # failure is the whole defect: the site went live, the artefact did not, and nothing said so.
    # package.json lives at the repo root and its `files` list points at docs/data/catalog.json, so the
    # pack must run from there with the destination given as an absolute path.
    tgz = subprocess.run(["npm", "pack", "--pack-destination", str(OUT / "data")],
                        cwd=PACK_ROOT, capture_output=True, text=True)
    if tgz.returncode:
        print(f"npm pack failed rc={tgz.returncode} in {PACK_ROOT}", file=sys.stderr)
        print(tgz.stderr, file=sys.stderr)
        return 1
    packed = (OUT / "data" / tgz.stdout.strip().splitlines()[-1])
    target = OUT / "data" / f"design-catalog-{version}.tgz"
    if packed != target:
        shutil.move(packed, target)
    shutil.copy(target, OUT / "data" / "design-catalog-latest.tgz")

    sums = []
    for p in sorted(OUT.rglob("*")):
        if p.is_file() and ".git" not in p.parts and p.name != "CHECKSUMS.txt":
            sums.append(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(OUT)}")
    (OUT / "CHECKSUMS.txt").write_text("\n".join(sums) + "\n")

    pub = sum(1 for e in index if not e["withheld"])
    print(f"items {len(index)} ({pub} with source, {len(index) - pub} withheld) | "
          f"index {len((OUT / 'data' / 'index.json').read_bytes()) / 1e6:.2f}MB | "
          f"bundle {len((OUT / 'data' / 'catalog.json').read_bytes()) / 1e6:.2f}MB | "
          f"pkg {target.stat().st_size / 1e6:.2f}MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
