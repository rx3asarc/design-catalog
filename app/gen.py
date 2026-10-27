#!/usr/bin/env python3
"""Generate the React app's source tree from the catalogue.

Nothing is rewritten except what has to be: files land at their original paths, `@` points at src/, and
`cn` points at shadcn's utils, which is exactly how shadcn's own site resolves them. Demo modules are the
only generated files, and each one imports the real component so the demo and the code pane cannot disagree.
"""
from __future__ import annotations

import json
import re
import shutil
import sqlite3
from pathlib import Path

DB = Path("/root/design-catalog/design-catalog.db")
APP = Path(__file__).resolve().parent
SRC = APP / "src"
DENY_DIRS = ["registry", "components", "lib", "hooks", "blocks", "examples", "demos", "app"]

conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row


def rows(sql, args=()):
    return conn.execute(sql, args).fetchall()


def latest(where: str, args) -> list[sqlite3.Row]:
    return rows(f"""
        SELECT a.path, a.content, a.kind FROM artifact a JOIN snapshot s ON s.id = a.snapshot_id
        WHERE s.item_id = ? AND s.id = (SELECT max(id) FROM snapshot WHERE item_id = ?)
          AND {where} ORDER BY a.path""", args)


def ensure_react(code: str) -> str:
    """Files copied from a Next app may use the React namespace without importing it (their
    bundler supplied it). Under Vite that is a ReferenceError, so make the import explicit."""
    if not re.search(r"\bReact\.", code):
        return code
    if re.search(r"^\s*import\s+(React|\*\s+as\s+React)\b", code, re.M):
        return code
    if re.search(r"import\s*\{[^}]*\bReact\b[^}]*\}\s*from\s*[\"']react[\"']", code):
        return code
    # insert after the "use client" directive if there is one, otherwise at the top: guessing at
    # "the last import line" lands inside a multi-line import and produces a syntax error
    lines = code.splitlines()
    at = 1 if lines and lines[0].lstrip().startswith(("'use client'", '"use client"')) else 0
    lines.insert(at, 'import * as React from "react";')
    return "\n".join(lines)


def write(rel: str, text: str) -> None:
    p = SRC / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(ensure_react(text) if rel.endswith((".tsx", ".ts")) else text)


CATEGORIES = [
    ("Blocks and pages", ("block",)),
]

def category_for(slug: str, kind: str, source: str) -> str:
    """Group by what a thing is, not by whose site it came from."""
    s = slug.lower()
    # what it IS beats how it was filed: a chart that ships as a "block" is still a chart
    if kind == "text":
        return "Docs and guides"
    if kind == "effect" or source == "transitions":
        return "Motion and effects"
    if any(w in s for w in ("dashboard", "login", "signup", "mail", "music", "tasks", "authentication",
                            "playground", "landing", "pricing", "checkout", "onboarding", "app-shell", "chat-app")):
        return "Pages and blocks"
    def has(*words):
        return any(w in s for w in words)
    if has("button", "toggle", "action", "control", "swap"):
        return "Actions and controls"
    if has("chat", "message", "bubble", "prompt", "streaming", "tool-", "thinking", "agent", "citation", "voice", "reaction",
           "attachment", "timeline", "step-player", "activity"):
        return "Conversation and agent UI"
    if has("heatmap", "order-book", "price", "liquidity", "faq", "folder", "preview", "number", "marker", "direction", "utils"):
        return "Charts and data"
    if has("chart", "table", "data", "sparkline", "gauge", "sankey", "graph", "meter", "stats"):
        return "Charts and data"
    if has("shader", "background", "image", "viewer", "emoji", "pull-to-refresh"):
        return "Motion and effects"
    if has("sidebar", "nav", "menu", "breadcrumb", "pagination", "tab", "command", "dock", "stepper", "tree", "toc", "link"):
        return "Navigation"
    if has("dialog", "sheet", "drawer", "popover", "tooltip", "hovers", "hover-card", "alert-dialog", "context", "dropdown",
           "toast", "sonner", "notification", "sheet", "modal", "bottom-sheet", "lightbox", "spotlight"):
        return "Overlays and dialogs"
    if has("input", "textarea", "select", "checkbox", "radio", "switch", "slider", "form", "combobox", "calendar", "date",
           "field", "otp", "file", "upload", "label", "toggle", "picker", "search", "rating", "password", "phone", "signup", "login"):
        return "Forms and input"
    if has("alert", "badge", "progress", "skeleton", "spinner", "empty", "status", "loader", "error", "banner", "callout"):
        return "Feedback and status"
    if has("motion", "animate", "transition", "hover", "glow", "gradient", "orb", "gravity", "shimmer", "marquee", "reveal", "parallax", "text-anim"):
        return "Motion and effects"
    if has("card", "separator", "accordion", "collapsible", "scroll", "resizable", "aspect", "carousel", "avatar", "item",
           "kbd", "sheet", "panel", "grid", "layout", "hero", "footer", "header", "section"):
        return "Layout and structure"
    if has("typograph", "text", "heading", "prose", "quote", "markdown", "code", "article", "list", "copy", "word"):
        return "Content and text"
    if kind == "block":
        return "Pages and blocks"
    return "Actions and controls"


def sluggy(s: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", s.lower()).strip("-")


IMPORT = re.compile(r'''(?:from|import)\s+["']([^"']+)["']''')
INSTALLED = {p.name for p in (APP / "node_modules").iterdir() if not p.name.startswith(".")}


def installed(pkg: str) -> bool:
    """Scoped packages live one directory deeper, and `cn` is an alias we provide ourselves."""
    if pkg == "cn":
        return True
    return (APP / "node_modules" / pkg).exists()


def package_of(spec: str) -> str:
    parts = spec.split("/")
    return "/".join(parts[:2]) if spec.startswith("@") else parts[0]


def resolves_from(path: Path, spec: str) -> bool:
    if spec.startswith("@/"):
        base = SRC / spec[2:]
    elif spec.startswith("."):
        base = (path.parent / spec).resolve()
    else:
        pkg = package_of(spec)
        return installed(pkg) or spec.startswith("node:") or pkg == "next"
    return any(c.is_file() for c in (base, base.with_suffix(".tsx"), base.with_suffix(".ts"),
                                     base / "index.tsx", base / "index.ts",
                                     Path(str(base) + ".tsx"), Path(str(base) + ".ts"),
                                     Path(str(base) + ".json")))


def target_of(path: Path, spec: str) -> Path | None:
    base = SRC / spec[2:] if spec.startswith("@/") else (path.parent / spec).resolve()
    for c in (base, base.with_suffix(".tsx"), base.with_suffix(".ts"), base / "index.tsx", base / "index.ts",
              Path(str(base) + ".tsx"), Path(str(base) + ".ts"), Path(str(base) + ".json"),
              base / "index.jsx"):
        if c.is_file():
            return c
    return None


def resolve_and_prune(manifest: list) -> int:
    """A demo that cannot compile is not hidden, it is declared: the page says why instead of showing a blank box."""
    files = [p for p in SRC.rglob("*") if p.suffix in (".tsx", ".ts", ".jsx", ".js")]
    bad: dict[Path, str] = {}
    for f in files:
        for spec in IMPORT.findall(f.read_text(errors="ignore")):
            if not resolves_from(f, spec):
                bad[f] = spec
                break
    if bad:
        print(f"unresolved imports in {len(bad)} file(s)")

    dropped = 0
    for entry in manifest:
        keep = []
        for v in entry["variants"]:
            demo = SRC / v["module"]
            seen, stack, broken = set(), [demo], None
            while stack and not broken:
                cur = stack.pop()
                if cur in seen or not cur.is_file():
                    continue
                seen.add(cur)
                if cur in bad:
                    broken = f"{cur.relative_to(SRC)} imports {bad[cur]}, which is not in the catalogue"
                    break
                for spec in IMPORT.findall(cur.read_text(errors="ignore")):
                    if spec.startswith(".") or spec.startswith("@/"):
                        nxt = target_of(cur, spec)
                        if nxt is None:
                            broken = f"{cur.relative_to(SRC)} imports {spec}, which is not in the catalogue"
                            break
                        stack.append(nxt)
            if broken:
                demo.unlink(missing_ok=True)
                entry.setdefault("renderNote", broken)
                dropped += 1
            else:
                keep.append(v)
        entry["variants"] = keep
        if entry["variants"]:
            entry.pop("renderNote", None)
    return dropped


def exports_of(path: Path) -> set[str] | None:
    """None means "cannot tell" (a barrel, an `export *`), which is treated as fine."""
    text = path.read_text(errors="ignore")
    if "export *" in text or re.search(r"export\s*\{[^}]*\}\s*from", text):
        return None
    names = set(re.findall(r"export\s+(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+(\w+)", text))
    m = re.search(r"export\s*\{([^}]*)\}", text)
    if m:
        names |= {n.strip().split(" as ")[-1].strip() for n in m.group(1).split(",") if n.strip()}
    if re.search(r"export\s+default", text):
        names.add("default")
    return names


def prune_missing_exports(manifest: list) -> int:
    """A docs snippet can be newer than the component it imports. Drop that demo and say which symbol is missing."""
    dropped = 0
    for entry in manifest:
        keep = []
        for v in entry["variants"]:
            demo = SRC / v["module"]
            problem = None
            if demo.is_file():
                for names, spec in re.findall(r'import\s*\{([^}]*)\}\s*from\s*["\']([^"\']+)["\']', demo.read_text(errors="ignore")):
                    target = target_of(demo, spec) if (spec.startswith("@/") or spec.startswith(".")) else None
                    if not target:
                        continue
                    have = exports_of(target)
                    if have is None:
                        continue
                    wanted = {n.strip().split(" as ")[0].strip() for n in names.split(",") if n.strip()}
                    gone = wanted - have
                    if gone:
                        problem = f"{target.relative_to(SRC)} does not export {', '.join(sorted(gone))}"
                        break
            if problem:
                demo.unlink(missing_ok=True)
                entry.setdefault("renderNote", problem)
                dropped += 1
            else:
                keep.append(v)
        entry["variants"] = keep
        if entry["variants"]:
            entry.pop("renderNote", None)
    return dropped


ATTR = re.compile(r'data-catalog-item="([^"]+)"')
SHELL_SUFFIXES = (".tsx", ".ts", ".jsx", ".js", ".html")
# Everything under these directories is copied from the libraries; the shell is what is left.
COPIED = {"demos", "registry", "components", "lib", "hooks", "blocks", "examples", "app", "shims"}


def used_here() -> dict[str, int]:
    """Which catalogue items the shell actually renders, counted from the attribute that names them.

    `App.tsx`'s CHROME array is nine ids maintained by hand, so the site's claim to be built out of the
    catalogue depends on somebody remembering to edit an array. This is a grep instead: it cannot drift,
    and it grows by itself as new surfaces tag what they use.
    """
    hits: dict[str, int] = {}
    files = [p for p in (APP / "index.html",) if p.is_file()]
    for p in SRC.rglob("*"):
        if p.is_file() and p.suffix in SHELL_SUFFIXES and (p.relative_to(SRC).parts[0] not in COPIED):
            files.append(p)
    for p in files:
        for m in ATTR.findall(p.read_text(errors="ignore")):
            hits[m] = hits.get(m, 0) + 1
    return hits


def curation(items: list) -> tuple[dict[int, dict], dict[str, int]]:
    """The public-curation fields, in bulk: six SELECTs over the whole store, not 769 round trips.

    Every field here is either a query or absent. Absence is `null`, never `0` — `publish_export.py:121`
    summed an empty file list and shipped a real-looking `0` bytes for 178 items, which reads as "this
    item's source weighs nothing" instead of "there is no source".
    """
    out: dict[str, dict] = {}
    code = {r["item_id"]: (r["n"], r["bytes"]) for r in rows("""
        SELECT sn.item_id, count(*) n, sum(coalesce(a.bytes,0)) bytes
        FROM artifact a JOIN snapshot sn ON sn.id = a.snapshot_id
        WHERE a.kind='code' AND sn.id = (SELECT max(id) FROM snapshot s2 WHERE s2.item_id = sn.item_id)
        GROUP BY sn.item_id""")}
    deps = {r["from_item_id"]: r["n"] for r in rows(
        "SELECT from_item_id, count(*) n FROM edge WHERE external=1 GROUP BY 1")}
    comp: dict[int, set[str]] = {}
    for r in rows("""SELECT e.from_item_id, t.slug FROM edge e JOIN item t ON t.id = e.to_item_id
                     WHERE e.external=0 AND e.to_item_id IS NOT NULL"""):
        comp.setdefault(r["from_item_id"], set()).add(r["slug"])
    cons: dict[int, list[str]] = {}
    for r in rows("""SELECT ci.item_id, c.key FROM concept_item ci JOIN concept c ON c.id = ci.concept_id
                     ORDER BY c.key"""):
        cons.setdefault(r["item_id"], []).append(r["key"])
    picks: dict[int, dict] = {}
    for r in rows("SELECT * FROM pick ORDER BY item_id, at, id"):  # newest wins: last write is the pick
        picks[r["item_id"]] = {k: r[k] for k in ("text", "author", "at", "good_for") if r[k] is not None}
    notes = {r["item_id"]: r for r in rows("SELECT * FROM port_note WHERE public=1")}
    used = used_here()
    # every item carries the three numeric fields, so a UI toggle never has to know which rows the
    # aggregate queries happened to return; the value is what says whether there is anything there
    for it in items:
        n, b = code.get(it["id"], (0, 0))
        d: dict = {"file_count": n or None, "bytes": b or None, "dep_count": deps.get(it["id"]) or None}
        if comp.get(it["id"]):
            prim = sorted(comp[it["id"]])
            # a lower bound, and the manifest has to say so: 820 of the store's 1,762 internal edges name
            # a target that is not a catalogue row, so the graph under-reports by construction
            d["composition"] = {"count": len(prim), "primitives": prim, "lower_bound": True}
        if cons.get(it["id"]):
            d["concepts"] = cons[it["id"]]
        if it["id"] in picks:
            d["pick"] = picks[it["id"]]
        if it["id"] in notes:
            d["verdict"] = {k: notes[it["id"]][k] for k in ("verdict", "reason", "ours_path")}
        out[it["id"]] = d
    return out, used


def assert_manifest_honest(manifest: list, items: list, withheld: int) -> None:
    """I5/I6 as a build gate: the manifest cannot disagree with itself or with the store.

    `verify.py` runs the same two checks when it is handed a manifest, but only here can the demo split be
    checked, because only here is a demo known to have resolved. Exit 1 on any mismatch — a number the page
    prints and the store does not support is worse than a failing build.
    """
    bad = [e["id"] for e in manifest
           if e["has_demo"] != bool(e["variants"]) or e["reference_only"] != (not e["has_demo"])]
    bad += [e["id"] for e in manifest if e["bytes"] is None and e["file_count"] is not None]
    bad += [e["id"] for e in manifest if e["bytes"] == 0 or e["file_count"] == 0]
    bad += [e["id"] for e in manifest if e["file_count"] is None and e["files"]]
    bad += [e["id"] for e in manifest if e["file_count"] is not None and e["file_count"] != len(e["files"])]
    demo = sum(1 for e in manifest if e["has_demo"])
    ref = sum(1 for e in manifest if e["reference_only"])
    if demo + ref != len(manifest):
        bad.append(f"demo {demo} + reference_only {ref} != {len(manifest)}")
    if len(manifest) != len(items):
        bad.append(f"manifest has {len(manifest)} items, the store has {len(items)}")
    if sum(1 for e in manifest if e.get("withheld")) != withheld:
        bad.append("withheld count disagrees with the licence policy")
    if bad:
        print("MANIFEST DISAGREES WITH THE STORE:")
        for b in bad[:10]:
            print("  -", b)
        raise SystemExit(1)


def main() -> int:
    ver = json.loads((APP.parent / "package.json").read_text())["version"]
    (SRC / "version.ts").write_text(f'export const VERSION = "{ver}";\n')
    for d in DENY_DIRS:
        shutil.rmtree(SRC / d, ignore_errors=True)
    (SRC / "demos").mkdir(parents=True, exist_ok=True)

    items = rows("""SELECT i.id, i.slug, i.kind, i.name, i.one_line, i.url, s.slug AS source
                    FROM item i JOIN source s ON s.id = i.source_id
                    ORDER BY s.slug, i.kind, i.slug""")
    licence = {r["slug"]: (r["licence"], r["code_policy"], r["url"]) for r in rows("SELECT * FROM source")}

    # 1. copy every source file to its original path under src/
    copied = 0
    for it in items:
        if it["source"] not in ("shadcn", "beui"):
            continue
        for f in latest("a.kind='code'", (it["id"], it["id"])):
            path = f["path"].lstrip("./")
            if path.endswith((".tsx", ".ts", ".jsx", ".js", ".json", ".css")):
                write(path, f["content"])
                copied += 1
    print(f"copied {copied} source files")

    # 2. shadcn docs markdown, per component
    docs = {}
    for r in rows("""SELECT i.slug, a.content FROM item i
                     JOIN snapshot s ON s.item_id = i.id
                     JOIN artifact a ON a.snapshot_id = s.id AND a.kind='copy'
                     WHERE i.slug LIKE 'docs-components-%' AND s.id = (SELECT max(id) FROM snapshot WHERE item_id=i.id)"""):
        docs[r["slug"][len("docs-components-"):]] = r["content"]

    FENCE = re.compile(r"```tsx[^\n]*\n(.*?)```", re.S)
    HEAD = re.compile(r"^##\s+(.+)$", re.M)
    SKIP_SECTIONS = {"installation", "usage", "composition", "api reference", "theming"}

    def fences_by_section(md: str) -> list[tuple[str, str]]:
        out: list[tuple[str, str]] = []
        first = FENCE.search(md)
        if first and (not HEAD.search(md) or first.start() < HEAD.search(md).start()):
            out.append(("Default", first.group(1)))
        for m in HEAD.finditer(md):
            title = m.group(1).strip()
            if title.lower() in SKIP_SECTIONS:
                continue
            nxt = HEAD.search(md, m.end())
            chunk = md[m.end(): nxt.start() if nxt else len(md)]
            f = FENCE.search(chunk)
            if f:
                out.append((title, f.group(1)))
        return out

    REWRITE = [
        (r'from "@\/components\/ui\/', 'from "@/registry/new-york-v4/ui/'),
        (r'from "@\/components\/', 'from "@/registry/new-york-v4/components/'),
        (r'from "@\/lib\/', 'from "@/registry/new-york-v4/lib/'),
        (r'from "@\/hooks\/', 'from "@/registry/new-york-v4/hooks/'),
        (r'from "cn"', 'from "@/registry/new-york-v4/lib/utils"'),
    ]

    def rewrite(code: str) -> str:
        for pat, rep in REWRITE:
            code = re.sub(pat, rep, code)
        # a doc fence that omits a required prop is a broken demo, not a broken component:
        # shadcn's own site passes type="single" here
        code = re.sub(r"<ToggleGroup(?![\w-])(?![^>]*\btype=)([^>]*)>", r'<ToggleGroup type="single"\1>', code)
        return code

    def ensure_react(code: str) -> str:
        """Files copied from a Next app may lean on the React namespace without importing it
        (their bundler supplied it). Under Vite that is a ReferenceError, so make it explicit."""
        if not re.search(r"\bReact\.", code):
            return code
        if re.search(r"^\s*import\s+(React|\*\s+as\s+React)\b", code, re.M):
            return code
        if re.search(r"import\s*\{[^}]*\bReact\b[^}]*\}\s*from\s*\"react\"", code):
            return code
        lines = code.splitlines()
        last = -1
        for i, ln in enumerate(lines[:40]):
            if ln.lstrip().startswith("import ") or ln.lstrip().startswith('"use client"'):
                last = i
        lines.insert(last + 1, 'import * as React from "react";')
        return "\n".join(lines)

    def export_name(code: str) -> str | None:
        m = re.search(r"export\s+(?:default\s+)?function\s+([A-Z]\w+)", code)
        if m:
            return m.group(1)
        m = re.search(r"export\s+function\s+(\w+)", code)
        return m.group(1) if m else None

    manifest = []
    demos = 0
    cur, usage = curation(items)
    withheld = sum(1 for it in items if it["source"] in ("rareui", "beautifului", "transitions"))

    for it in items:
        src, slug, kind = it["source"], it["slug"], it["kind"]
        entry = {
            "id": f"{src}/{slug}", "source": src, "slug": slug, "kind": kind,
            "name": it["name"], "one_line": it["one_line"], "url": it["url"],
            "licence": licence[src][0], "variants": [],
        }
        files = [f["path"] for f in latest("a.kind='code'", (it["id"], it["id"]))]
        entry["files"] = files
        entry.update(cur[it["id"]])

        # rebuild the page url the way each site spells it
        if src == "rareui":
            entry["page"] = f"https://www.rareui.com/components/{slug.replace('-', '')}"
        elif src == "shadcn":
            entry["page"] = None if slug.startswith("docs-") else f"https://ui.shadcn.com/docs/components/{slug}"
        else:
            entry["page"] = it["url"]
        entry["category"] = category_for(slug, kind, src)
        entry["install"] = {
            "shadcn": f"npx shadcn@latest add {slug}",
            "beui": f"npx shadcn@latest add https://beui.dev/r/{slug}",
            "rareui": f"npx shadcn@latest add https://www.rareui.com/r/{slug}.json",
        }.get(src)

        if src in ("rareui", "beautifului", "transitions"):
            entry["withheld"] = True
            manifest.append(entry)
            continue

        # ---- shadcn component pages: every variant from the docs markdown -------------
        if src == "shadcn" and kind == "component" and slug in docs:
            for i, (label, code) in enumerate(fences_by_section(docs[slug])):
                name = export_name(code)
                if not name:
                    continue
                rel = f"demos/shadcn/{slug}/v{i}.tsx"
                write(rel, rewrite(code) + f"\nexport default function Demo() {{\n  return <{name} />\n}}\n")
                entry["variants"].append({"label": label, "module": rel, "name": name})

        # ---- shadcn example / block / beui: the file itself is the demo ---------------
        elif src == "shadcn" and kind in ("pattern", "block"):
            candidates = [p for p in files if p.endswith(".tsx") and (
                p.endswith("page.tsx") or "/examples/" in p or p.endswith(f"/{slug}.tsx"))]
            for p in candidates[:1]:
                code = (SRC / p).read_text()
                name = export_name(code) or "Demo"
                rel = f"demos/shadcn/{slug}/main.tsx"
                write(rel, f'import Component from "@/{p[:-4]}"\nexport default function Demo() {{\n'
                           f'  return <Component />\n}}\n' if "export default" in code else
                           f'import {{ {name} }} from "@/{p[:-4]}"\nexport default function Demo() {{\n'
                           f'  return <{name} />\n}}\n')
                entry["variants"].append({"label": "Example", "module": rel, "name": "Demo"})

        elif src == "beui":
            meta = conn.execute("""SELECT a.content FROM artifact a JOIN snapshot s ON s.id=a.snapshot_id
                                   WHERE s.item_id=? AND a.kind='json'
                                     AND s.id=(SELECT max(id) FROM snapshot WHERE item_id=?)
                                   LIMIT 1""", (it["id"], it["id"])).fetchone()
            preview = None
            if meta:
                try:
                    preview = next((f["path"] for f in json.loads(meta["content"])["files"]
                                    if f.get("type") == "preview"), None)
                except Exception:
                    preview = None
            if preview and (SRC / preview).exists():
                code = (SRC / preview).read_text()
                name = export_name(code) or "Demo"
                rel = f"demos/beui/{slug}/main.tsx"
                has_default = "export default" in code
                write(rel, f'import Component from "@/{preview[:-4]}"\nexport default function Demo() {{\n'
                           f'  return <Component />\n}}\n' if has_default else
                           f'import {{ {name} }} from "@/{preview[:-4]}"\nexport default function Demo() {{\n'
                           f'  return <{name} />\n}}\n')
                entry["variants"].append({"label": "Preview", "module": rel, "name": "Demo"})

        demos += len(entry["variants"])
        manifest.append(entry)

    dropped = resolve_and_prune(manifest) + prune_missing_exports(manifest)

    # has_demo is a build fact, not a store fact: a demo exists only if its module resolved above, so it
    # is decided here, after pruning, and published explicitly so the UI filters on a field instead of
    # inferring it from variants.length. reference_only is the same fact named for the gallery toggle.
    for e in manifest:
        e["has_demo"] = bool(e["variants"])
        e["reference_only"] = not e["has_demo"]
        e["used_here"] = usage.get(e["id"], 0)

    assert_manifest_honest(manifest, items, withheld)
    (APP / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")))
    print(f"dropped {dropped} demo(s) whose imports do not resolve")
    withdrawn = sum(1 for m in manifest if m.get("withheld"))
    with_demo = sum(1 for m in manifest if m["variants"])
    print(f"items {len(manifest)} | with a demo {with_demo} | demo modules {demos} | withheld {withdrawn}")
    print(f"reference-only {len(manifest) - with_demo} | bytes null {sum(1 for m in manifest if m['bytes'] is None)} | "
          f"with concepts {sum(1 for m in manifest if 'concepts' in m)} | "
          f"with composition {sum(1 for m in manifest if 'composition' in m)} | "
          f"with a pick {sum(1 for m in manifest if 'pick' in m)} | "
          f"with a public verdict {sum(1 for m in manifest if 'verdict' in m)} | "
          f"used_here>0 {sum(1 for m in manifest if m['used_here'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())