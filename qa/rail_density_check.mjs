/**
 * The rail's density: a phone menu that opens on the catalogue, and a desktop rail that is the catalogue.
 *
 * `23d8b824` (r7) closed the phone menu's sections by default below 861 px. Measured before the fix: 103 rows,
 * a 779 px panel, 4,894 px of scroll — every group already expanded, which is what a *sidebar* wants and what a
 * thumb does not. After it: 4 rows (the four section names and their counts), panel 539, scroll 538.
 *
 * The rule has two halves, and they pull in opposite directions on purpose, so both are asserted:
 *
 *   1. **at 390, with the menu open, `≤ 6` visible rows.** The panel is a sheet over a phone, not an index. Six
 *      leaves room for the theme strip and the head row above the four section names and still fails on the day
 *      something pre-expands a tree again (it was 103).
 *   2. **at 1440 the rail shows the full tree: `> 40` rows.** The desktop rail is not a drawer — the tree *is*
 *      the page's index there, and the same closing that fixes the phone must not fold it up on a desktop.
 *   3. **opening one section on the phone unwraps that section and nothing else.** Rows must go *up* from the
 *      closed baseline, the menu must stay open, and the address must not change: the row's trigger is a
 *      disclosure, while the count badge beside it is the door to the grid (`Open the grid for …`). A gate that
 *      only counted rows would pass a trigger that navigated.
 *
 * A row is an element with a box: `.rail-sec`, `.rail-cat`, `.rail-sub`, `.rail-sub2` (the four levels of
 * `Level` in `site/Rail.tsx`) or `.rail-item` (a leaf `Row`). `display:none` rows have no box, so a closed
 * section's children are not counted — which is exactly the difference the fix made.
 *
 * Usage: node qa/rail_density_check.mjs [base]      (default http://localhost:8830/design-catalog/)
 */
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { settle } from "./settle.mjs";

const BASE = process.argv[2] || "http://localhost:8830/design-catalog/";
const ROW = ".rail-sec, .rail-cat, .rail-sub, .rail-sub2, .rail-item";
const SECTIONS = ["Blocks and pages", "Components", "Motion and effects", "Docs"];
const PHONE_MAX = 6;
const DESKTOP_MIN = 40;

let fails = 0;
const bad = (name, detail) => { fails++; console.log(`FAIL ${name} — ${detail}`); };
const ok = (name, detail) => console.log(`ok   ${name} — ${detail}`);

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/** How many rail rows have a box right now, inside the given root, and which names the top level prints. */
const measure = (page, root, rowSel) =>
  page.evaluate(([rootSel, rowSel]) => {
    const el = document.querySelector(rootSel);
    if (!el) return { found: false, rows: 0, labels: [], panel: null, hash: location.hash };
    const boxed = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const rows = [...el.querySelectorAll(rowSel)].filter(boxed);
    const r = el.getBoundingClientRect();
    return {
      found: true,
      rows: rows.length,
      leafRows: rows.filter((e) => e.classList.contains("rail-item")).length,
      labels: rows.filter((e) => e.classList.contains("rail-sec")).map((e) => e.textContent.replace(/\d+$/, "").trim().slice(0, 48)),
      openSections: el.querySelectorAll(".rail-sec.is-open").length,
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
  await page.waitForFunction(() => document.querySelector(".rail-phone.is-open"), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);

  const closed = await measure(page, ".rail-phone", ROW);

  if (!closed.found) bad("390 menu open: the panel rendered", ".rail-phone is not in the document");
  if (closed.rows > 0 && closed.rows <= PHONE_MAX) {
    ok("390 menu open: rows ≤ 6", `${closed.rows} rows, panel ${closed.panel.height} px, scroll ${closed.panel.scroll} (was 103 / 779 / 4894)`);
  } else {
    bad("390 menu open: rows ≤ 6", `${closed.rows} rows, panel ${closed.panel && closed.panel.height} px, scroll ${closed.panel && closed.panel.scroll}`);
  }

  const missing = SECTIONS.filter((s) => !closed.labels.includes(s));
  if (closed.labels.length === SECTIONS.length && !missing.length) {
    ok("390 menu open: the rows are the four section names", `${closed.labels.length}/4 — ${closed.labels.join(" · ")}`);
  } else {
    bad("390 menu open: the rows are the four section names", `${closed.labels.length} section rows, missing ${JSON.stringify(missing)}, labels ${JSON.stringify(closed.labels)}`);
  }

  if (closed.leafRows === 0) ok("390 menu open: no leaf pre-expanded", `0 of ${closed.rows} rows are leaves`);
  else bad("390 menu open: no leaf pre-expanded", `${closed.leafRows} leaf rows of ${closed.rows}`);

  /* ── opening one section: rows up, menu still open, address unchanged ──────────────────────────────────── */
  const beforeHash = closed.hash;
  const opened = await page.evaluate(() => !!document.querySelector('.rail-phone .rail-sec > [data-slot="collapsible-trigger"]'));
  if (!opened) {
    bad("390 open one section: the section trigger exists", "no [data-slot=collapsible-trigger] inside a .rail-sec row");
  } else {
    await page.locator('.rail-phone .rail-sec > [data-slot="collapsible-trigger"]').first().click();
    await page.waitForTimeout(500);
    const after = await measure(page, ".rail-phone", ROW);
    if (after.rows > closed.rows) ok("390 open one section: it reveals its rows", `${closed.rows} → ${after.rows} rows, scroll ${closed.panel.scroll} → ${after.panel.scroll}`);
    else bad("390 open one section: it reveals its rows", `${closed.rows} → ${after.rows} rows (no increase)`);

    if (after.hash === beforeHash) ok("390 open one section: it does not navigate away", `address ${beforeHash} → ${after.hash}`);
    else bad("390 open one section: it does not navigate away", `address ${beforeHash} → ${after.hash}`);

    const stillOpen = await page.evaluate(() => !!document.querySelector(".rail-phone.is-open"));
    if (stillOpen) ok("390 open one section: the menu stays open", "panel still .is-open");
    else bad("390 open one section: the menu stays open", "panel closed itself on the disclosure click");
  }

  await ctx.close();
}

/* ── 1440: the full tree, because there the rail is the index ───────────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = settle(await ctx.newPage());
  await page.goto(`${BASE}#/`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const desk = await measure(page, '[data-slot="sidebar"]', ROW);

  if (!desk.found) bad("1440: the rail rendered", '[data-slot="sidebar"] is not in the document');
  if (desk.rows > DESKTOP_MIN) ok("1440: the rail shows the full tree", `${desk.rows} rows > ${DESKTOP_MIN}`);
  else bad("1440: the rail shows the full tree", `${desk.rows} rows, wanted > ${DESKTOP_MIN}`);

  if (desk.openSections === SECTIONS.length) ok("1440: every section is open", `${desk.openSections}/4 sections open`);
  else bad("1440: every section is open", `${desk.openSections}/4 sections open — the phone's default closed reached the desktop`);

  await ctx.close();
}

await browser.close();
console.log(fails ? `RAIL: ${fails} FAIL` : "RAIL: ok");
process.exit(fails ? 1 : 0);
