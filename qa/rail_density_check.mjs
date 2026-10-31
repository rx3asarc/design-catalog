/**
 * The rail's density: a phone menu that opens on seven names, and a desktop rail that is an index of types.
 *
 * `23d8b824` (r7) closed the phone menu's sections by default below 861 px. Measured before that fix: 103 rows, a
 * 779 px panel, 4,894 px of scroll — every group already expanded, which is what a *sidebar* wants and what a
 * thumb does not.
 *
 * ROUND 8 CHANGED WHAT A ROW *IS*, so this gate changed with it. The rail lists the taxonomy's **types**, not the
 * catalogue's items: seven sections, 89 type rows, and no item row anywhere. The old thresholds were "≤ 6 rows at
 * 390" (four sections) and "> 40 rows at 1440" (a tree of every item). Both are re-derived here from the new
 * shape, and each assertion below is one the review asked for:
 *
 *   1. **at 390, with the menu open, the rows are the seven section names** — `≤ 8` rows, so a sheet that opens on
 *      more than the sections fails. Exactly seven sections, no type row pre-expanded (a type list in a drawer is
 *      the wall this unit removed, one level down).
 *   2. **no row's count hides under an icon**: the 39 grid doors are gone, and every section row prints its
 *      member count as visible text. A count is the thing the reader compares, so it is asserted as text.
 *   3. **opening one section on the phone unwraps that section and nothing else**: rows go *up* from the closed
 *      baseline, the menu stays open, and the address does not change — the row is a disclosure, not a link.
 *   4. **at 1440 the rail shows sections + types**: more than 40 rows (the types are there) and at most 100 (they
 *      are 89 types, not 769 items — the number that was 990 rows when everything was expanded).
 *   5. **only the current section is open.** On `#/` that is `Components`; on `#/t/foundations/fonts` it is
 *      `Foundations`, and the `Fonts` row is `aria-current="page"` — the rail knows which type's collection is
 *      on screen, in the fixed `#/t/<section>/<type>` spelling both round-8 briefs agree on.
 *   6. **every type row links to a collection**, `#/t/…`, and none links to an item (`#/i/…`).
 *   7. **the filter still filters types**, and a section with no surviving type disappears.
 *
 * A row is an element with a box: `.rail-sec` (a section) or `.rail-item` (a type). `display: none` rows have no
 * box, so a closed section's types are not counted — which is the whole point of the disclosure.
 *
 * Usage: node qa/rail_density_check.mjs [base]      (default http://localhost:8830/design-catalog/)
 */
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";

const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";
const ROW = ".rail-sec, .rail-item";
const SECTIONS = ["Components", "Blocks", "Charts", "Agent UI", "Effects", "Foundations", "Docs"];
const PHONE_MAX = 8;
const DESKTOP_MIN = 40;
const DESKTOP_MAX = 100;

let fails = 0;
const bad = (name, detail) => { fails++; console.log(`FAIL ${name} — ${detail}`); };
const ok = (name, detail) => console.log(`ok   ${name} — ${detail}`);

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/** How many rail rows have a box right now, inside the given root, and everything this file asserts about them. */
const measure = (page, root, rowSel) =>
  page.evaluate(([rootSel, rowSel]) => {
    const el = document.querySelector(rootSel);
    if (!el) return { found: false, rows: 0, labels: [], panel: null, hash: location.hash };
    const boxed = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const rows = [...el.querySelectorAll(rowSel)].filter(boxed);
    const secs = rows.filter((e) => e.classList.contains("rail-sec"));
    const r = el.getBoundingClientRect();
    return {
      found: true,
      rows: rows.length,
      typeRows: rows.filter((e) => e.classList.contains("rail-item")).length,
      labels: secs.map((e) => (e.querySelector(".sec-n")?.textContent ?? "").trim()),
      // the count is a row's own text, not an icon's tooltip: a number inside the section trigger
      counts: secs.map((e) => (e.querySelector(".rail-count")?.textContent ?? "").trim()),
      doors: el.querySelectorAll('[data-sidebar="menu-action"]').length,
      openSections: el.querySelectorAll(".rail-sec.is-open").length,
      openLabels: [...el.querySelectorAll(".rail-sec.is-open .sec-n")].map((e) => e.textContent.trim()),
      current: [...el.querySelectorAll(".rail-item[aria-current='page']")].map((e) => e.getAttribute("href")),
      hrefs: [...el.querySelectorAll(".rail-item")].map((e) => e.getAttribute("href") ?? ""),
      shortRows: secs.concat(rows.filter((e) => e.classList.contains("rail-item")))
        .filter((e) => e.getBoundingClientRect().height < 43.5)
        .map((e) => `${Math.round(e.getBoundingClientRect().height)}px ${e.textContent.trim().slice(0, 18)}`),
      panel: { top: Math.round(r.top), height: Math.round(r.height), scroll: Math.round(el.scrollHeight) },
      hash: location.hash,
    };
  }, [root, rowSel]);

/* ── 390 × 844, the phone menu open ─────────────────────────────────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = settle(await ctx.newPage());
  await page.goto(`${BASE}#/`, { waitUntil: "load" });
  await page.click('[aria-controls="rail"]');
  await page.waitForFunction(() => document.querySelector(".rail-phone.is-open"), null, { timeout: 30000 }).catch(() => {});
  // the tree itself, not a stopwatch: an empty panel measures 0 rows and would pass "≤ 8" for the wrong reason
  await page.waitForSelector(".rail-phone .rail-menu .rail-sec", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);

  const closed = await measure(page, ".rail-phone", ROW);

  if (!closed.found) bad("390 menu open: the panel rendered", ".rail-phone is not in the document");
  if (closed.rows > 0 && closed.rows <= PHONE_MAX) {
    ok("390 menu open: rows ≤ 8", `${closed.rows} rows, panel ${closed.panel.height} px, scroll ${closed.panel.scroll} (was 103 / 779 / 4894 before r7)`);
  } else {
    bad("390 menu open: rows ≤ 8", `${closed.rows} rows, panel ${closed.panel && closed.panel.height} px, scroll ${closed.panel && closed.panel.scroll}`);
  }

  const missing = SECTIONS.filter((s) => !closed.labels.includes(s));
  if (closed.labels.length === SECTIONS.length && !missing.length) {
    ok("390 menu open: the rows are the seven section names", `${closed.labels.length}/7 — ${closed.labels.join(" · ")}`);
  } else {
    bad("390 menu open: the rows are the seven section names", `${closed.labels.length} section rows, missing ${JSON.stringify(missing)}, labels ${JSON.stringify(closed.labels)}`);
  }

  if (closed.typeRows === 0) ok("390 menu open: no type pre-expanded", `0 of ${closed.rows} rows are types`);
  else bad("390 menu open: no type pre-expanded", `${closed.typeRows} type rows of ${closed.rows}`);

  if (closed.doors === 0) ok("390 menu open: no grid doors in the rail", "0 [data-sidebar=menu-action]");
  else bad("390 menu open: no grid doors in the rail", `${closed.doors} grid doors — the review asked for them gone`);

  const counted = closed.counts.filter((c) => /^\d+$/.test(c));
  if (counted.length === closed.labels.length) ok("390 menu open: every section row prints its count as text", counted.join(" · "));
  else bad("390 menu open: every section row prints its count as text", `${counted.length}/${closed.labels.length} — ${JSON.stringify(closed.counts)}`);

  if (closed.shortRows.length === 0) ok("390 menu open: every rail row clears 44 px", `0 rows under 44, ${closed.rows} measured`);
  else bad("390 menu open: every rail row clears 44 px", closed.shortRows.slice(0, 4).join(" · "));

  /* ── opening one section: rows up, menu still open, address unchanged ──────────────────────────────────── */
  const beforeHash = closed.hash;
  const opened = await page.evaluate(() => !!document.querySelector('.rail-phone .rail-sec > [data-slot="collapsible-trigger"]'));
  if (!opened) {
    bad("390 open one section: the section trigger exists", "no [data-slot=collapsible-trigger] inside a .rail-sec row");
  } else {
    await page.locator('.rail-phone .rail-sec > [data-slot="collapsible-trigger"]').first().click();
    await page.waitForTimeout(500);
    const after = await measure(page, ".rail-phone", ROW);
    if (after.rows > closed.rows) ok("390 open one section: it reveals its rows", `${closed.rows} → ${after.rows} rows (${after.typeRows} types), scroll ${closed.panel.scroll} → ${after.panel.scroll}`);
    else bad("390 open one section: it reveals its rows", `${closed.rows} → ${after.rows} rows (no increase)`);

    if (after.hash === beforeHash) ok("390 open one section: it does not navigate away", `address ${beforeHash} → ${after.hash}`);
    else bad("390 open one section: it does not navigate away", `address ${beforeHash} → ${after.hash}`);

    const stillOpen = await page.evaluate(() => !!document.querySelector(".rail-phone.is-open"));
    if (stillOpen) ok("390 open one section: the menu stays open", "panel still .is-open");
    else bad("390 open one section: the menu stays open", "panel closed itself on the disclosure click");
  }

  await ctx.close();
}

/* ── 1440: sections + types, and only the current section open ──────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = settle(await ctx.newPage());
  await page.goto(`${BASE}#/`, { waitUntil: "load" });
  await page.waitForSelector('[data-slot="sidebar"] .rail-menu .rail-sec', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
  const desk = await measure(page, '[data-slot="sidebar"]', ROW);

  if (!desk.found) bad("1440: the rail rendered", '[data-slot="sidebar"] is not in the document');
  if (desk.rows > DESKTOP_MIN && desk.rows <= DESKTOP_MAX) {
    ok("1440: the rail shows sections + types", `${desk.rows} rows = ${desk.labels.length} sections + ${desk.typeRows} types (wanted > ${DESKTOP_MIN} and ≤ ${DESKTOP_MAX}; the item tree was 990)`);
  } else {
    bad("1440: the rail shows sections + types", `${desk.rows} rows = ${desk.labels.length} sections + ${desk.typeRows} types`);
  }

  if (desk.openSections === 1 && desk.openLabels[0] === "Components") {
    ok("1440: only the current section is open", `1/7 open — ${desk.openLabels.join(" · ")} on #/`);
  } else {
    bad("1440: only the current section is open", `${desk.openSections}/7 open — ${JSON.stringify(desk.openLabels)}; #/ should open Components and nothing else`);
  }

  const wrong = desk.hrefs.filter((h) => !h.startsWith("#/t/"));
  if (!wrong.length && desk.hrefs.length) ok("1440: every type row links to its collection", `${desk.hrefs.length} rows, all #/t/<section>/<type>, e.g. ${desk.hrefs[0]}`);
  else bad("1440: every type row links to its collection", `${wrong.length} rows are not #/t/…: ${JSON.stringify(wrong.slice(0, 3))}`);

  const items = desk.hrefs.filter((h) => h.startsWith("#/i/"));
  if (!items.length) ok("1440: no row is an individual item", `0 of ${desk.hrefs.length} rows point at #/i/`);
  else bad("1440: no row is an individual item", `${items.length} item rows: ${JSON.stringify(items.slice(0, 3))}`);

  await ctx.close();
}

/* ── the collection route: the section it is in is the one open, and its own row is current ─────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = settle(await ctx.newPage());
  await page.goto(`${BASE}#/t/foundations/fonts`, { waitUntil: "load" });
  await page.waitForSelector('[data-slot="sidebar"] .rail-menu .rail-sec', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
  const at = await measure(page, '[data-slot="sidebar"]', ROW);
  if (at.openSections === 1 && at.openLabels[0] === "Foundations" && at.current.includes("#/t/foundations/fonts")) {
    ok("a collection route opens its own section and marks its own row", `open ${at.openLabels.join(" · ")}, aria-current ${at.current.join(" ")}`);
  } else {
    bad("a collection route opens its own section and marks its own row",
      `open ${JSON.stringify(at.openLabels)}, current ${JSON.stringify(at.current)}`);
  }
  await ctx.close();
}

/* ── the filter: it filters types, and a section with no surviving type is not rendered ─────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = settle(await ctx.newPage());
  await page.goto(`${BASE}#/`, { waitUntil: "load" });
  const box = page.locator('input[placeholder^="Filter"]').first();
  await box.waitFor({ timeout: 20000 });
  await box.fill("side");
  await page.waitForTimeout(700);
  const f = await measure(page, '[data-slot="sidebar"]', ROW);
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('[data-slot="sidebar"] .rail-item .t')].map((e) => e.textContent.trim()));
  const foreign = names.filter((n) => !/side/i.test(n));
  if (names.length > 0 && !foreign.length && f.labels.length === 1) {
    ok("the filter narrows the rail to matching types", `"side" → ${names.length} type(s) ${JSON.stringify(names)} in 1 section (${f.labels.join(" ")})`);
  } else {
    bad("the filter narrows the rail to matching types", `"side" → ${names.length} type(s) ${JSON.stringify(names)} in ${f.labels.length} sections ${JSON.stringify(f.labels)}, ${foreign.length} did not match`);
  }
  await ctx.close();
}

await browser.close();
console.log(fails ? `RAIL: ${fails} FAIL` : "RAIL: ok");
process.exit(fails ? 1 : 0);
