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
rm -rf docs/assets docs/index.html
cp -r app/dist/* docs/
echo "== exporting data, package and checksums"
python3 /root/design-catalog/publish_export.py
echo "== done"
