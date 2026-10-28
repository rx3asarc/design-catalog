#!/usr/bin/env python3
"""Delete every file in docs/ that no page can reach.

`publish.sh` copies `app/dist/*` over `docs/` and never wipes it, so each publish leaves the previous
bundle's chunks behind. Age-based pruning (`-mtime +7`) has let 86 MB accumulate once and 4 MB twice.

Reachability instead: start from the documents a visitor or a crawler opens (`index.html`, `demo.html`),
take every asset name they mention, then follow the same names inside the JS and CSS that came back
(static imports and dynamic import() both appear as string literals). Fonts are taken as a set from
`docs/fonts/`, because they are referenced from CSS by url() and by name.

Usage: prune_reachability.py [--apply]   (default is a dry run that only reports)
Exit 2 if the two entry documents would leave fewer than 5 assets, which means the crawl itself broke.
"""
import os
import re
import sys
import collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = "/root/design-catalog-site/docs"
ENTRY = ["index.html", "demo.html"]
DATA_DIRS = ["data"]
# always keep: the packaged downloads and the checksums live under data/ and are linked from the bundle,
# and CHECKSUMS.txt is a published artifact in its own right (the About page points at the repo copy,
# but the file is part of what publish_export writes and must survive a prune)
ALWAYS = {"CHECKSUMS.txt"}
# anything that looks like an asset filename we could have emitted
NAME = re.compile(r"[A-Za-z0-9_][A-Za-z0-9._-]{2,80}\.(?:js|css|woff2?|svg|png|jpg|webp|json)")


def read(p):
    try:
        with open(p, "rb") as fh:
            return fh.read().decode("utf-8", "replace")
    except OSError:
        return ""


def main():
    apply = "--apply" in sys.argv
    have = set()
    for base, _dirs, files in os.walk(DOCS):
        for f in files:
            have.add(os.path.relpath(os.path.join(base, f), DOCS))

    keep = set()
    queue = collections.deque()

    def take(name, src):
        """A mention is a basename in a bundle and a path in HTML: try both, plus the referring file's folder."""
        name = name.lstrip("./")
        base = os.path.basename(name)
        cands = [name, f"assets/{base}"]
        if src and "/" in src:
            cands.append(os.path.normpath(os.path.join(os.path.dirname(src), name)))
        hit = next((c for c in cands if c in have), None)
        if hit and hit not in keep:
            keep.add(hit)
            if hit.endswith((".js", ".css")):
                queue.append(hit)
        return hit is not None

    for e in ENTRY:
        take(e, "entry")
    # the demo registry lives in the data files: a demo module is reachable because a JSON index names it,
    # and the helpers that module imports are only reachable once that module has been crawled
    for d in DATA_DIRS:
        for base, _dirs, files in os.walk(os.path.join(DOCS, d)):
            for f in files:
                rel = os.path.relpath(os.path.join(base, f), DOCS)
                keep.add(rel)  # every file under data/ is a download or an index: reachable by design
                if f.endswith((".json", ".js")):
                    for m in NAME.finditer(read(os.path.join(base, f))):
                        take(m.group(0), rel)
    for f in have:
        if f.startswith("fonts/") or f.endswith((".woff2", ".woff")):
            keep.add(f)

    # every relative link an HTML document makes is a file a visitor can click; those stay regardless of kind
    # (CHECKSUMS.txt and the packaged .tgz are real downloads on #/about, and an asset-name regex misses them)
    HREF = re.compile(r'(?:href|src)="([^"#?]+)"')
    html = [f for f in have if f.endswith(".html")]
    for h in html:
        for m in HREF.finditer(read(os.path.join(DOCS, h))):
            rel = m.group(1).lstrip("./").split("?")[0]
            if rel.startswith(("http:", "https:", "//", "mailto:", "data:")):
                continue
            if rel in have:
                keep.add(rel)
    # every asset name mentioned by an entry document, then inside every reachable script or stylesheet
    for e in ENTRY:
        for m in NAME.finditer(read(os.path.join(DOCS, e))):
            take(m.group(0), e)
    while queue:
        rel = queue.popleft()
        for m in NAME.finditer(read(os.path.join(DOCS, rel))):
            take(m.group(0), rel)

    keep |= {e for e in ENTRY} | {a for a in ALWAYS if a in have}
    dead = sorted(have - keep)
    if len(keep) < 5:
        print(f"refusing: the crawl reached only {len(keep)} files — the entry documents did not parse")
        return 2

    bytes_dead = sum(os.path.getsize(os.path.join(DOCS, d)) for d in dead if os.path.isfile(os.path.join(DOCS, d)))
    print(f"reachable {len(keep)} | dead {len(dead)} | reclaimable {bytes_dead / 1e6:.1f} MB")
    by_kind = collections.Counter(os.path.splitext(d)[1] or "(none)" for d in dead)
    print("  dead by kind: " + ", ".join(f"{k} {v}" for k, v in by_kind.most_common(6)))
    if dead:
        print("  first 5: " + ", ".join(dead[:5]))
    if not apply:
        print("dry run — nothing deleted (pass --apply)")
        return 0
    for d in dead:
        try:
            os.unlink(os.path.join(DOCS, d))
        except FileNotFoundError:
            pass  # a name listed twice by two walking passes: already gone, and that is the goal
    left = sum(os.path.getsize(os.path.join(b, f)) for b, _d, fs in os.walk(DOCS) for f in fs)
    print(f"deleted {len(dead)} | docs now {left / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
