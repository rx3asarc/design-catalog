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
 * Round 9 added the four invariants that make its rule enforceable rather than merely written down:
 *
 *  10. no type holds a single member — the review found fifteen ("Merge the singles into neighbours"), and a
 *      one-member type is a collection page with nothing to collect
 *  11. one axis — every Effects type is named `<something> transitions`, no other section names a transition, and
 *      no type name is used in two different sections (that double use IS the overlap the review complained about:
 *      Effects had Cards and Text while Components had Card and Text animation)
 *  12. every type declares its own columns, every declared key is a column the site knows how to print, and no
 *      type declares a column its members never answered — the mechanical half of "Button should not print
 *      COLLAPSES", and the reason no page can print a row of "not measured" for a question nobody could ask
 *  13. the file carries its own docblock (`doc`) with the rule, the axis, the columns, the table threshold and the
 *      counts — the argument a reader is owed, in the file the argument is about (JSON has no comments)
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

// 10
const singles = types.filter((t) => t.list.length < 2);
singles.length ? bad(`10 no single-member type — ${singles.length}: ${singles.map((t) => `${t.section}/${t.type}`).join(", ")}`)
                : ok(`10 no single-member type — smallest type holds ${Math.min(...types.map((t) => t.list.length))}`);

// 11 — one axis: things in the things' sections, motions in Effects, and no name on both axes
const byIdItem = new Map(manifest.map((i) => [`${i.source}/${i.slug}`, i]));
const effects = types.filter((t) => t.section === "Effects");
const notNamedTransition = effects.filter((t) => !/ transitions$/.test(t.type));
notNamedTransition.length ? bad(`11 every Effects type is <something> transitions — ${notNamedTransition.map((t) => t.type).join(", ")}`)
                          : ok(`11 every Effects type is <something> transitions — ${effects.length}/${effects.length}`);
const motionOutside = types.filter((t) => t.section !== "Effects"
  && (/ transitions$/.test(t.type) || / (animation|motion)\b/.test(t.type)));
motionOutside.length ? bad(`11 no motion named outside Effects — ${motionOutside.map((t) => `${t.section}/${t.type}`).join(", ")}`)
                     : ok(`11 no motion named outside Effects — 0`);
const seenName = new Map();
const crossed = [];
for (const t of types) {
  const k = t.type.toLowerCase();
  if (seenName.has(k) && seenName.get(k) !== t.section) crossed.push(`${t.type} in ${seenName.get(k)} + ${t.section}`);
  seenName.set(k, t.section);
}
crossed.length ? bad(`11 no type name on two axes — ${crossed.join(", ")}`) : ok(`11 no type name on two axes — 0`);

// 12 — columns: declared per type, known to the site, and answered by at least one member
const KNOWN_COLS = new Set(["demos", "sizes", "loading", "icons", "states", "files",
  "collapses", "nests", "sheet", "keyboard", "shape", "animates"]);
const MEASURED_COLS = new Set(["collapses", "nests", "sheet", "keyboard", "shape", "animates"]);
const columns = tax.columns ?? {};
const undeclared = types.filter((t) => !Array.isArray(columns[`${t.section}/${t.type}`]));
undeclared.length ? bad(`12 every type declares its columns — ${undeclared.length} missing: ${undeclared.slice(0, 5).map((t) => `${t.section}/${t.type}`).join(", ")}`)
                  : ok(`12 every type declares its columns — ${types.length}/${types.length}`);
const phantomCols = Object.entries(columns).flatMap(([k, cs]) => cs.filter((c) => !KNOWN_COLS.has(c)).map((c) => `${k}:${c}`));
phantomCols.length ? bad(`12 every declared column is one the site prints — ${phantomCols.slice(0, 5).join(", ")}`)
                   : ok(`12 every declared column is one the site prints — 0 phantom`);
/** did this member's behaviour record answer `col`? (the sub-facts `collapseKind`/`nestDepth` answer for their key) */
const answers = (id, col) => {
  const b = byIdItem.get(id)?.behaviour;
  if (!b) return false;
  return Object.keys(b).some((k) => k === col || k.toLowerCase().startsWith(col.replace(/s$/, "")));
};
const unanswerable = [];
for (const [k, cs] of Object.entries(columns)) {
  const ids = k.split("/").reduce((o, seg) => o?.[seg], tax.sections);
  if (!Array.isArray(ids)) continue;
  for (const c of cs) {
    if (!MEASURED_COLS.has(c)) continue;            // field columns are answered by the manifest's own fields
    if (!ids.some((id) => answers(id, c))) unanswerable.push(`${k}:${c}`);
  }
}
unanswerable.length ? bad(`12 no declared measured column is unanswered — ${unanswerable.slice(0, 5).join(", ")}`)
                    : ok(`12 no declared measured column is unanswered by every member — 0`);

// 13
const NEEDED = ["rule", "axis", "columns", "table", "counts", "singles"];
const missing = NEEDED.filter((k) => !tax.doc?.[k]);
missing.length ? bad(`13 the file states its own rule — missing ${missing.join(", ")}`)
               : ok(`13 the file states its own rule — ${Object.keys(tax.doc).length} keys: ${Object.keys(tax.doc).join(", ")}`);

const perSection = Object.entries(tax.sections).map(([s, ts]) => `${s} ${Object.keys(ts).length}`).join(" · ");
console.log(`\nTAXONOMY: ${fail ? fail + " FAIL" : "ok"} — ${types.length} types across ${Object.keys(tax.sections).length} sections (${perSection}); ${members.size} members + ${variantOf.size} variants = ${members.size + variantOf.size}`);
process.exit(fail ? 1 : 0);
