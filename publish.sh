#!/usr/bin/env bash
# One command from catalogue DB to the published site. Run from the repo root.
set -euo pipefail
cd "$(dirname "$0")"
echo "== generating app source from the catalogue"
python3 app/gen.py
echo "== building"
(cd app && npx vite build >/dev/null && echo "   built")
echo "== copying the build into docs/"
mkdir -p docs
# do NOT wipe the old assets: GitHub Pages caches html for ten minutes, so somebody mid-visit
# after a deploy will still be asking for the previous build's chunks. Keeping them makes that
# harmless; pruning by age keeps the repo bounded.
mkdir -p docs/assets
cp -r app/dist/* docs/
find docs/assets -type f -mtime +7 -delete 2>/dev/null || true
echo "== exporting data, package and checksums"
python3 /root/design-catalog/publish_export.py
echo "== done"
