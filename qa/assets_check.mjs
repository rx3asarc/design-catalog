/**
 * Every asset a published file names must exist in the published tree.
 *
 * The prune (`scripts/prune_docs.py`) deletes what nothing reaches, and the whole danger of a pruner is the one
 * reference it could not see: it deleted `avatars/shadcn.jpg` once (a path named by a data string inside a demo
 * module) and left a demo frame logging a 404. That fix taught the pruner about avatars; this check does not trust
 * the pruner's opinion at all. It walks the *published* tree, collects every `assets/NAME.js|css` mentioned by any
 * html/js/css there, and asserts each one exists.
 *
 *   node assets_check.mjs [docs-dir]        defaults to /root/design-catalog-site/docs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS = process.argv[2] ?? "/root/design-catalog-site/docs";
const NAME = /assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g;

const have = new Set();
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full);
    else have.add(relative(DOCS, full));
  }
};
walk(DOCS);

const missing = [];
let checked = 0;
for (const rel of have) {
  if (!/\.(html|js|css)$/.test(rel)) continue;
  const text = readFileSync(join(DOCS, rel), "utf8");
  for (const m of text.match(NAME) ?? []) {
    checked += 1;
    if (!have.has(m) && !missing.some((x) => x.from === rel && x.what === m)) missing.push({ what: m, from: rel });
  }
}

for (const m of missing.slice(0, 10)) console.log(`FAIL ${m.what} named by ${m.from} is not in the tree`);
console.log(`ASSETS: ${missing.length ? `${missing.length} FAIL` : "ok"} — ${checked} references, ${have.size} files`);
process.exit(missing.length ? 1 : 0);
