#!/usr/bin/env node
/**
 * THE TAXONOMY'S INVARIANTS. `app/src/site/taxonomy.json` is a written list, and a written list rots: an ingest
 * adds 40 items, nobody re-runs the review, and 40 components vanish from the rail while the count on the front
 * page still says 769. This gate is what makes that impossible to ship.
 *
 * It reads the manifest and the taxonomy off disk — not the built site — so it runs in a second and cannot be
 * fooled by a stale build. It asserts:
 *
 *   1. every item in the manifest is either a member of exactly one type, or a variant of exactly one parent
 *   2. every member and every variant id in the file is a real item (a typo is not a shipped row)
 *   3. no item is both a member and a variant, and no item is in two types
 *   4. every type has at least one member, and every section has at least two types
 *   5. two levels only: no type name repeats inside a section, and no section name is used as a type name
 *   6. a variant's parent is a member of a type (otherwise the demo has nowhere to be shown)
 *   7. no type is named after the review's list of invented plurals: Natives Hovers Sonners Empties Otps Kbds
 *      Aspects Loadings Streamings Codes — these were the generator's output, and the generator is gone
 *   8. no type name is a bare number ("01" … "16" was the sidebar's sixteen groups)
 *   9. no type name is made of one or two letters ("As", "Lg", "Sm", "Dm", "Eb", "Ibm")
 *
 * Run: node qa/taxonomy_check.mjs
 */
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const manifest = JSON.parse(readFileSync(`${root}/app/manifest.json`, "utf8"));
const tax = JSON.parse(readFileSync(`${root}/app/src/site/taxonomy.json`, "utf8"));

let fail = 0;
const ok = (m) => console.log(`ok   ${m}`);
const bad = (m) => { console.log(`FAIL ${m}`); fail++; };

const ids = new Set(manifest.map((i) => `${i.source}/${i.slug}`));
const members = new Map();   // id -> [typeKey]
const types = [];            // {section, type, members[]}
for (const [section, ts] of Object.entries(tax.sections)) {
  for (const [type, list] of Object.entries(ts)) {
    types.push({ section, type, list });
    for (const id of list) members.set(id, [...(members.get(id) ?? []), `${section}/${type}`]);
  }
}
const variantOf = new Map();
for (const [parent, list] of Object.entries(tax.variants)) for (const v of list) variantOf.set(v, parent);

// 1 & 3
const unknown = [...ids].filter((id) => !members.has(id) && !variantOf.has(id));
unknown.length ? bad(`1/3 every item is a member or a variant — ${unknown.length} unfiled: ${unknown.slice(0, 6).join(", ")}`)
                : ok(`1/3 every item is a member or a variant — ${ids.size} items: ${members.size} members, ${variantOf.size} variants`);
const twice = [...members].filter(([, at]) => at.length > 1);
twice.length ? bad(`3 no item is in two types — ${twice.length}: ${twice.slice(0, 4).map(([i, a]) => `${i} in ${a.join(" + ")}`).join("; ")}`)
              : ok(`3 no item is in two types — 0`);
const both = [...variantOf.keys()].filter((id) => members.has(id));
both.length ? bad(`3 no item is both — ${both.length}: ${both.slice(0, 4).join(", ")}`) : ok(`3 no item is both a member and a variant — 0`);

// 2
const phantom = [...members.keys(), ...variantOf.keys()].filter((id) => !ids.has(id));
phantom.length ? bad(`2 every id in the file is a real item — ${phantom.length} phantom: ${phantom.slice(0, 6).join(", ")}`)
                : ok(`2 every id in the file is a real item — 0 phantom`);

// 4
const empty = types.filter((t) => t.list.length === 0);
empty.length ? bad(`4 every type has a member — ${empty.length} empty: ${empty.map((t) => t.type).join(", ")}`)
              : ok(`4 every type has a member — ${types.length} types, smallest ${Math.min(...types.map((t) => t.list.length))}`);
const thin = Object.entries(tax.sections).filter(([, ts]) => Object.keys(ts).length < 2);
thin.length ? bad(`4 every section has ≥2 types — ${thin.map(([s]) => s).join(", ")}`) : ok(`4 every section has ≥2 types — ${Object.keys(tax.sections).length} sections`);

// 5
const dupes = [];
for (const [section, ts] of Object.entries(tax.sections)) {
  const seen = new Set();
  for (const t of Object.keys(ts)) { if (seen.has(t.toLowerCase())) dupes.push(`${section}/${t}`); seen.add(t.toLowerCase()); }
  for (const t of Object.keys(ts)) if (Object.keys(tax.sections).some((s) => s.toLowerCase() === t.toLowerCase())) dupes.push(`${section}/${t} is a section name`);
}
dupes.length ? bad(`5 two levels only — ${dupes.join(", ")}`) : ok(`5 two levels only — no repeated or section-named type`);

// 6
const orphanParents = [...variantOf].filter(([, parent]) => !members.has(parent));
orphanParents.length ? bad(`6 every variant's parent is a type member — ${orphanParents.length}: ${orphanParents.slice(0, 4).map(([v, p]) => `${v}→${p}`).join(", ")}`)
                      : ok(`6 every variant's parent is a type member — ${variantOf.size} variants`);

// 7 & 8 & 9
const BANNED = ["natives", "hovers", "sonners", "empties", "otps", "kbds", "aspects", "loadings", "streamings", "codes"];
const names = types.map((t) => t.type);
const banned = names.filter((n) => BANNED.includes(n.toLowerCase()));
banned.length ? bad(`7 no invented plural — ${banned.join(", ")}`) : ok(`7 no invented plural — 0 of ${BANNED.length} on the list`);
const numeric = names.filter((n) => /^\d+$/.test(n));
numeric.length ? bad(`8 no bare-number type — ${numeric.join(", ")}`) : ok(`8 no bare-number type — 0`);
const stubby = names.filter((n) => n.replace(/[^A-Za-z]/g, "").length <= 2);
stubby.length ? bad(`9 no 1–2 letter type — ${stubby.join(", ")}`) : ok(`9 no 1–2 letter type — 0`);

const perSection = Object.entries(tax.sections).map(([s, ts]) => `${s} ${Object.keys(ts).length}`).join(" · ");
console.log(`\nTAXONOMY: ${fail ? fail + " FAIL" : "ok"} — ${types.length} types across ${Object.keys(tax.sections).length} sections (${perSection}); ${members.size} members + ${variantOf.size} variants = ${members.size + variantOf.size}`);
process.exit(fail ? 1 : 0);
