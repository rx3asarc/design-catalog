#!/usr/bin/env bash
# One command from catalogue DB to the published site. Run from the repo root.
set -euo pipefail
cd "$(dirname "$0")"
echo "== generating app source from the catalogue"
python3 app/gen.py
python3 app/check_chrome.py || exit 1   # the shop must be furnished with its own goods
echo "== building"
(cd app && npx vite build >/dev/null && echo "   built")
echo "== copying the build into docs/"
mkdir -p docs
# Do NOT wipe the old assets: GitHub Pages caches html for ten minutes, so somebody mid-visit after a deploy is
# still asking for the previous build's chunks. Keeping them makes that harmless; the prune at the end of this
# script is what keeps the repo bounded, and it prunes by *reachability* rather than by age.
mkdir -p docs/assets
cp -r app/dist/* docs/
echo "== exporting data, package and checksums"
python3 "$(dirname "$0")/scripts/publish_export.py"
# …and only now, when the export exists, delete what nothing reaches. (Before the export, `data/` and CHECKSUMS.txt
# are last publish's files; after it they are this one's, and the crawl sees the real references.)
# `scripts/prune_docs.py` crawls from the entry documents through every asset name a reachable script or stylesheet
# mentions, and deletes only what that crawl never reaches. Fonts and `avatars/` are kept unconditionally: a font is
# named by `url()` in CSS and an avatar by a data string inside a demo module, and a pruner that cannot see a
# reference must not call it dead (it deleted `avatars/shadcn.jpg` once and left a demo frame logging a 404).
python3 scripts/prune_docs.py --apply
echo "== done"
