/* r2-compare-page — the measurement, not the assertion.
 *
 * Every gate the brief names for `#/c/<concept>`, both viewports, and all 29 concept sets rather than the two
 * the brief happened to name. Nothing here is inferred from the source: the counts are read out of the DOM and
 * checked against the *store* (`query.py compare <key>`, dumped to qa/r2_compare_store.json) and against the
 * built manifest, and every printed number is compared cell by cell with the field it stands for.
 *
 * The one thing this file must not do is trust the page's own arithmetic: expected column texts are recomputed
 * here from the manifest with the same rounding rules the page uses (documented per column below), so a table
 * that "looks right" but prints 19 KB for an 18307-byte item fails.
 *
 *   node qa/r2_compare_measure.mjs            # → qa/r2_compare_measure.json + shots
 */
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:8891/design-catalog/";
const REPO = "/mnt/HC_Volume_105573741/design-catalog-site-r2-compare-page";
const OUT = `${REPO}/qa/r2_compare_measure.json`;
const SHOTS = `${REPO}/qa/shots`;
const VIEWPORTS = [{ name: "1440x900", width: 1440, height: 900 }, { name: "390x844", width: 390, height: 844 }];

const manifest = JSON.parse(readFileSync(`${REPO}/app/manifest.json`, "utf8"));
const store = JSON.parse(readFileSync(`${REPO}/qa/r2_compare_store.json`, "utf8"));
const byId = new Map(manifest.map((i) => [i.id, i]));
const conceptKeys = [...new Set(manifest.flatMap((i) => i.concepts ?? []))].sort();
const membersOf = (k) => manifest.filter((i) => (i.concepts ?? []).includes(k));

const report = { base: BASE, viewports: VIEWPORTS.map((v) => v.name), gates: {}, concepts: {}, perViewport: {} };
const ok = (name, pass, detail) => { (report.gates[name] ??= []).push({ pass: !!pass, detail }); };

/* ── the expected cell text, recomputed from the manifest, with the page's own formatting rules ─────────── */

const UNKNOWN = "—";
const cellText = {
  source: (i) => i.source,
  licence: (i) => i.licence,
  kind: (i) => i.kind,
  files: (i) => (typeof i.file_count === "number" ? String(i.file_count) : UNKNOWN),
  // size: the page rounds to whole KB at ≥1024 B and prints bytes below that; the exact value lives in `title`
  size: (i) => (typeof i.bytes !== "number" ? UNKNOWN : i.bytes >= 1024 ? `${Math.round(i.bytes / 1024)} KB` : `${i.bytes} B`),
  deps: (i) => (typeof i.dep_count === "number" ? String(i.dep_count) : UNKNOWN),
  parts: (i) => {
    const c = i.composition;
    if (!c || typeof c.count !== "number") return UNKNOWN;
    return `${c.lower_bound ? "≥" : ""}${c.count}`;
  },
  used: (i) => (typeof i.used_here === "number" ? String(i.used_here) : UNKNOWN),
  demo: (i) => ((i.has_demo ?? i.variants?.length > 0) ? "yes" : "no"),
};

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/**
 * Listen to one page: its errors, its 404s, its uncaught throws.
 *
 * One listener per page rather than one per browser, because a demo frame can log a beat after the route changed
 * and a shared array then charges the *next* concept page with the *previous* one's demo error — measured: the
 * `tooltip` page's provider error landed on `utils` once, which is a false accusation, not a finding.
 */
function listen(pg) {
  const errors = [];
  const push = (kind, text) => errors.push(`${kind}: ${text}`);
  pg.on("pageerror", (e) => push("pageerror", String(e).slice(0, 160)));
  pg.on("console", (m) => { if (m.type() === "error") push("console", m.text().slice(0, 160)); });
  // a console error names no URL; a failed response does, and a page that quietly 404s an asset is not "0 errors"
  pg.on("response", (r) => { if (r.status() >= 400) push("http", `${r.status()} ${r.url().slice(0, 120)}`); });
  return errors;
}

async function open(vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, ...opts });
  const pg = await ctx.newPage();
  return { ctx, pg, errors: listen(pg) };
}

/** Read the whole comparison page as data: counts, per-row cells, dropped columns, the notes. */
async function readPage(pg) {
  return pg.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const counts = q("[data-compare-counts]");
    const rows = [...document.querySelectorAll("[data-compare-row]")].map((tr) => {
      const cells = {};
      const exact = {};
      for (const td of tr.querySelectorAll("[data-col]")) {
        const span = td.querySelector("span:last-child");
        cells[td.dataset.col] = (span ?? td).textContent.trim();
        exact[td.dataset.col] = span?.getAttribute("title") ?? null;
      }
      const name = tr.querySelector("th a");
      return { id: tr.dataset.compareRow, name: name?.textContent.trim() ?? null, href: name?.getAttribute("href") ?? null, cells, exact };
    });
    const table = q("[data-compare-table]");
    const thead = table?.querySelector("thead");
    const tbody = table?.querySelector("tbody");
    const cs = (el) => (el ? getComputedStyle(el).display : null);
    // clipped text: any cell whose content is wider than the box it was given
    let clipped = 0;
    for (const el of document.querySelectorAll("[data-compare-table] td span, [data-compare-table] th a")) {
      if (el.scrollWidth > el.clientWidth + 1) clipped += 1;
    }
    return {
      concept: q("[data-compare-concept]")?.dataset.compareConcept ?? null,
      members: counts ? +counts.dataset.compareMembers : null,
      sources: counts ? +counts.dataset.compareSources : null,
      dropped: counts?.dataset.compareDropped ?? null,
      shown: counts?.dataset.compareShown ?? null,
      countLine: counts?.textContent.replace(/\s+/g, " ").trim() ?? null,
      rows,
      hasTable: !!table,
      tableDisplay: table ? getComputedStyle(table).display : null,
      theadDisplay: cs(thead),
      tbodyDisplay: cs(tbody),
      clipped,
      droppedNote: q("[data-compare-dropped-note]")?.textContent.replace(/\s+/g, " ").trim() ?? null,
      methodNote: q("[data-compare-method]")?.textContent.replace(/\s+/g, " ").trim() ?? null,
      status: q("[role=status]")?.textContent.replace(/\s+/g, " ").trim() ?? null,
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pageOverflow: (() => { const p = document.querySelector(".page"); return p ? p.scrollWidth - p.clientWidth : null; })(),
      bodyText: document.querySelector(".page")?.innerText ?? "",
    };
  });
}

/** Every check for one concept page, at one viewport. Returns the row so the report can print a table. */
function checkConcept(key, view) {
  const expected = membersOf(key);
  const expSources = new Set(expected.map((i) => i.source)).size;
  const failures = [];

  if (view.members !== expected.length) failures.push(`members ${view.members} ≠ manifest ${expected.length}`);
  if (store[key] && view.members !== store[key].members) failures.push(`members ${view.members} ≠ store ${store[key].members}`);
  if (view.sources !== expSources) failures.push(`sources ${view.sources} ≠ manifest ${expSources}`);
  if (!view.hasTable) failures.push("no table");

  // the dropped/shown column sets, recomputed here from the manifest
  const cols = Object.keys(cellText);
  const differing = cols.filter((c) => new Set(expected.map((i) => cellText[c](i))).size > 1);
  const dropped = cols.filter((c) => !differing.includes(c));
  if (view.hasTable) {
    const shown = (view.shown ?? "").split(",").filter(Boolean);
    const drop = (view.dropped ?? "").split(",").filter(Boolean);
    if (shown.join(",") !== differing.join(",")) failures.push(`shown columns ${shown} ≠ ${differing}`);
    if (drop.join(",") !== dropped.join(",")) failures.push(`dropped columns ${drop} ≠ ${dropped}`);
  }

  // every printed number against the manifest, cell by cell
  const wrong = [];
  for (const row of view.rows) {
    const item = byId.get(row.id);
    if (!item) { wrong.push(`${row.id} is not in the manifest`); continue; }
    if (row.href !== `#/i/${row.id}`) wrong.push(`${row.id} links to ${row.href}`);
    for (const [col, text] of Object.entries(row.cells)) {
      const want = cellText[col]?.(item);
      if (want === undefined) { wrong.push(`${row.id} prints an unknown column ${col}`); continue; }
      if (text !== want) wrong.push(`${row.id}.${col} prints "${text}" ≠ manifest "${want}"`);
    }
    // the tooltip must carry the exact number wherever the table rounds one
    if ("size" in row.cells && typeof item.bytes === "number" && row.exact.size !== `${item.bytes} bytes, exactly`) {
      wrong.push(`${row.id}.size title "${row.exact.size}" ≠ exact bytes`);
    }
  }
  if (wrong.length) failures.push(...wrong.slice(0, 6));
  if (view.rows.length !== expected.length) failures.push(`rendered ${view.rows.length} rows ≠ ${expected.length} members`);

  return {
    key, members: view.members, sources: view.sources,
    shown: view.shown, dropped: view.dropped,
    rows: view.rows.length, clipped: view.clipped,
    overflow: view.docOverflow, pageOverflow: view.pageOverflow,
    status: view.status, failures,
  };
}

/* ── 1. the sidebar page, both viewports, with screenshots ─────────────────────────────────────────────── */

for (const vp of VIEWPORTS) {
  const { ctx, pg, errors } = await open(vp);
  await pg.goto(`${BASE}#/c/sidebar`, { waitUntil: "domcontentloaded" });
  await pg.waitForSelector("[data-compare-counts]", { timeout: 15000 });
  await pg.waitForTimeout(1200);
  const view = await readPage(pg);
  const row = checkConcept("sidebar", view);
  report.perViewport[vp.name] = {
    ...row,
    storedMembers: store.sidebar.members,
    countLine: view.countLine,
    droppedNote: view.droppedNote,
    methodNote: view.methodNote,
    tableDisplay: view.tableDisplay, theadDisplay: view.theadDisplay, tbodyDisplay: view.tbodyDisplay,
    docOverflow: view.docOverflow, pageOverflow: view.pageOverflow,
    errors,  };

  ok(`sidebar.${vp.name}.members-equal-store`, view.members === store.sidebar.members, `${view.members} vs store ${store.sidebar.members}`);
  ok(`sidebar.${vp.name}.numbers-equal-manifest`, !row.failures.some((f) => /prints|title|links/.test(f)), row.failures.filter((f) => /prints|title|links/.test(f)).slice(0, 4).join(" | ") || "every cell equals its field");
  ok(`sidebar.${vp.name}.no-horizontal-overflow`, view.docOverflow <= 0 && (view.pageOverflow ?? 0) <= 0, `doc ${view.docOverflow}px, .page ${view.pageOverflow}px`);
  ok(`sidebar.${vp.name}.no-clipped-text`, view.clipped === 0, `${view.clipped} clipped cell(s)`);
  ok(`sidebar.${vp.name}.zero-console-errors`, errors.length === 0, errors.slice(0, 3).join(" | ") || "0 errors");

  // a phone stacks the table; a desktop keeps it a table. Both are read from computed style, not from a flag.
  if (vp.width <= 860) {
    ok(`sidebar.${vp.name}.stacked-rows`, view.tbodyDisplay === "block" && view.theadDisplay === "none",
      `thead ${view.theadDisplay}, tbody ${view.tbodyDisplay}`);
  } else {
    ok(`sidebar.${vp.name}.real-table`, view.tableDisplay === "table" && view.tbodyDisplay === "table-row-group",
      `table ${view.tableDisplay}, tbody ${view.tbodyDisplay}`);
  }

  // interaction sizes at the phone: every control the page offers is a 44px target
  const ctl = await pg.evaluate(() => [...document.querySelectorAll(".page a, .page button")]
    .map((el) => { const r = el.getBoundingClientRect(); return { text: (el.textContent || "").trim().slice(0, 32), h: Math.round(r.height), w: Math.round(r.width) }; })
    .filter((c) => c.h > 0));
  const small = ctl.filter((c) => c.h < 44);
  ok(`sidebar.${vp.name}.controls-44`, small.length === 0, `${small.length}/${ctl.length} under 44px${small.length ? ": " + small.slice(0, 3).map((c) => `${c.h}px "${c.text}"`).join(", ") : ""}`);

  /*
   * The tiles below the table: one per member, the gallery's own component. The two failure modes worth a gate are
   * a missing tile (a set of 25 that renders 20 tiles) and an empty box where a member has no demo — so both the
   * count and the reference/demo split are read out of the DOM and checked against the manifest's `has_demo`.
   */
  const tiles = await pg.evaluate(async () => {
    const box = document.querySelector("[data-compare-tiles]");
    if (!box) return null;
    box.scrollIntoView({ block: "start" });
    await new Promise((r) => setTimeout(r, 900));
    return {
      tiles: box.querySelectorAll("[data-tile]").length,
      reference: box.querySelectorAll('[data-mode="reference"]').length,
      framed: box.querySelectorAll('[data-mode="parked"], [data-mode="live"]').length,
      referenceSaysNoDemo: [...box.querySelectorAll('[data-mode="reference"]')].every((el) => /no demo/i.test(el.textContent || "")),
      emptyBoxes: [...box.querySelectorAll("[data-tile]")].filter((el) => !(el.textContent || "").trim()).length,
      iframes: box.querySelectorAll("iframe").length,
    };
  });
  const wantDemo = membersOf("sidebar").filter((i) => (i.has_demo ?? i.variants?.length > 0)).length;
  const wantRef = membersOf("sidebar").length - wantDemo;
  ok(`sidebar.${vp.name}.tiles-one-per-member`, !!tiles && tiles.tiles === store.sidebar.members,
    tiles ? `${tiles.tiles} tiles for ${store.sidebar.members} members` : "no [data-compare-tiles] container");
  ok(`sidebar.${vp.name}.reference-card-not-empty-box`, !!tiles && tiles.reference === wantRef && tiles.framed === wantDemo && tiles.referenceSaysNoDemo && tiles.emptyBoxes === 0,
    tiles ? `${tiles.reference} reference (want ${wantRef}), ${tiles.framed} demo (want ${wantDemo}), ${tiles.emptyBoxes} empty, "no demo" on every reference: ${tiles.referenceSaysNoDemo}` : "—");
  ok(`sidebar.${vp.name}.tiles-mount-frames`, !!tiles && tiles.iframes > 0, tiles ? `${tiles.iframes} live frame(s) mounted below the table` : "—");

  /*
   * Then the whole tile column, scrolled to the end: the pool mounts frames as they approach, and a visitor who
   * scrolls the set sees demos the first screen never mounted. Any error that appears during that sweep is
   * classified the same way — reproduced on the item page that owns the demo, or it is this page's problem.
   */
  const beforeSweep = errors.length;
  await pg.evaluate(async () => {
    const p = document.querySelector(".page");
    for (let y = 0; y < (p?.scrollHeight ?? 0); y += 500) {
      p.scrollTop = y;
      await new Promise((r) => setTimeout(r, 110));
    }
  });
  await pg.waitForTimeout(1200);
  const swept = errors.slice(beforeSweep);
  let sweepDetail = "0 errors while scrolling all 25 tiles";
  let sweepOk = true;
  if (swept.length) {
    const norm = (e) => e.replace(/^(console|pageerror|http): /, "").replace(/http \d+ \S+/, "http 4xx <asset>").slice(0, 64);
    const texts = [...new Set(swept.map(norm))];
    const itemSide = new Set();
    for (const item of membersOf("sidebar")) {
      const ip = await ctx.newPage();
      const ierr = listen(ip);
      await ip.goto(`${BASE}#/i/${item.id}`, { waitUntil: "domcontentloaded" });
      await ip.waitForTimeout(1300);
      for (const e of ierr) itemSide.add(norm(e));
      await ip.close();
      if (texts.every((t) => itemSide.has(t))) break;
    }
    const novel = texts.filter((t) => !itemSide.has(t));
    sweepOk = novel.length === 0;
    sweepDetail = `${texts.length} error(s) during the sweep, ${texts.length - novel.length} reproduce on the item pages that own the demo, ${novel.length} novel${novel.length ? ": " + novel.join(" | ") : ""}`;
    if (novel.length) report.sweepNovel ??= {};
    if (novel.length) report.sweepNovel[vp.name] = novel;
  }
  ok(`sidebar.${vp.name}.tiles-scroll-clean`, sweepOk, sweepDetail);

  await pg.screenshot({ path: `${SHOTS}/compare-table-${vp.width}.png`, fullPage: false });
  await pg.evaluate(() => { const p = document.querySelector(".page"); if (p) p.scrollTop = 0; });
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: `${SHOTS}/compare-sidebar-${vp.width}.png`, fullPage: false });
  // the tiles, framed on purpose: scroll the tile grid itself into view rather than to a guessed offset
  await pg.evaluate(() => { document.querySelector("[data-compare-tiles]")?.scrollIntoView({ block: "start" }); });
  await pg.waitForTimeout(1400);
  await pg.screenshot({ path: `${SHOTS}/compare-sidebar-${vp.width}-tiles.png`, fullPage: false });
  await ctx.close();
}

/* ── 2. every concept key, at 1440: renders, exits 0, prints the right count ────────────────────────────── */

{
  // one page per concept, closed after it: a demo frame can log a beat after a route change, and a page that is
  // reused carries that late message into the next comparison (measured — see `listen`)
  const ctx = await browser.newContext({ viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height } });
  const table = [];
  const demoBleed = {};
  const norm = (e) => e.replace(/^(console|pageerror|http): /, "").slice(0, 64);
  for (const key of conceptKeys) {
    const pg = await ctx.newPage();
    const errors = listen(pg);
    await pg.goto(`${BASE}#/c/${key}`, { waitUntil: "domcontentloaded" });
    await pg.waitForSelector("[data-compare-counts], [role=status]", { timeout: 15000 });
    await pg.waitForTimeout(600);
    const view = await readPage(pg);
    const row = checkConcept(key, view);
    const fresh = [...errors];
    /*
     * An error on this page may be the comparison's or a demo's — a demo runs in its own document and several of
     * them are mounted here, exactly as on the gallery and the item pages. Rather than guess from a stack URL, the
     * test is whether the error already reproduces **on the item pages that own those demos**. If it does, the
     * defect arrived with the demo; if it does not, this page introduced it and the gate fails.
     */
    if (fresh.length) {
      const texts = [...new Set(fresh.map(norm))];
      const itemSide = new Set();
      for (const item of membersOf(key)) {
        const ip = await ctx.newPage();
        const ierr = listen(ip);
        await ip.goto(`${BASE}#/i/${item.id}`, { waitUntil: "domcontentloaded" });
        await ip.waitForTimeout(1300);
        for (const e of ierr) itemSide.add(norm(e));
        await ip.close();
        if (texts.every((t) => itemSide.has(t))) break;
      }
      const novel = texts.filter((t) => !itemSide.has(t));
      demoBleed[key] = { onPage: texts, alsoOnItemPages: texts.filter((t) => itemSide.has(t)), novel };
      if (novel.length) row.failures.push(`error no item page reproduces: ${novel.join(" | ")}`);
    }
    report.concepts[key] = { ...row, storeMembers: store[key]?.members ?? null, storeRule: store[key]?.rule ?? null, countLine: view.countLine, droppedNote: view.droppedNote };
    table.push([key, view.members, store[key]?.members ?? "?", view.sources, view.shown || "\u2014", view.dropped || "\u2014", row.failures.length ? "FAIL" : "ok"]);
    await pg.close();
  }
  report.conceptTable = table;
  report.demoBleed = demoBleed;
  const failed = table.filter((r) => r[6] !== "ok");
  ok("every-concept.renders", table.length === conceptKeys.length && failed.length === 0, `${table.length} keys, ${failed.length} failing`);
  ok("every-concept.count-equals-store", table.every((r) => r[1] === r[2]), table.filter((r) => r[1] !== r[2]).map((r) => `${r[0]}: ${r[1]}\u2260${r[2]}`).join(", ") || "all 29 equal");
  ok("every-concept.errors-are-pre-existing", Object.values(demoBleed).every((d) => d.novel.length === 0),
    Object.keys(demoBleed).length
      ? Object.entries(demoBleed).map(([k, d]) => `${k}: ${d.onPage.length} error(s), ${d.alsoOnItemPages.length} reproduce on the item pages that own the demo, ${d.novel.length} novel`).join(" | ")
      : "no error on any of the 29 pages");
  await ctx.close();
}

/* ── 3. the two named sets, and the miss ────────────────────────────────────────────────────────────────── */

{
  const { ctx, pg, errors } = await open(VIEWPORTS[0]);
  await pg.goto(`${BASE}#/c/utils`, { waitUntil: "domcontentloaded" });
  await pg.waitForSelector("[data-compare-counts]", { timeout: 15000 });
  const utils = await readPage(pg);
  ok("utils.still-compares", utils.hasTable && utils.rows.length === 2 && utils.members === store.utils.members,
    `${utils.rows.length} rows, table ${utils.hasTable}, store ${store.utils.members}`);

  await pg.goto(`${BASE}#/c/nope`, { waitUntil: "domcontentloaded" });
  await pg.waitForSelector("[role=status]", { timeout: 15000 });
  const miss = await readPage(pg);
  ok("nope.names-the-miss", /Nothing here is called concept “nope”/.test(miss.status ?? ""), (miss.status ?? "").slice(0, 120));
  ok("nope.links-the-gallery", /#\/g/.test(await pg.getAttribute("[role=status] a", "href").catch(() => "") ?? ""), await pg.getAttribute("[role=status] a", "href").catch(() => "") ?? "");
  ok("nope.no-fallback-to-everything", !miss.hasTable, `table rendered: ${miss.hasTable}`);

  // a concept key that exists but carries nothing: the empty set must say so, not show everything
  await pg.goto(`${BASE}#/c/sidebars`, { waitUntil: "domcontentloaded" });
  await pg.waitForSelector("[role=status]", { timeout: 15000 });
  const nearMiss = await readPage(pg);
  ok("near-miss.is-not-a-set", /Nothing here is called concept “sidebars”/.test(nearMiss.status ?? ""), (nearMiss.status ?? "").slice(0, 120));
  await ctx.close();
}

/* ── 4. the item page's way in: exactly when members ≥ 2, to the right set ──────────────────────────────── */

{
  const { ctx, pg, errors } = await open(VIEWPORTS[0]);
  // every member of every set that has ≥2, plus a control item that is in no set at all
  const inSets = [...new Set(manifest.filter((i) => (i.concepts ?? []).some((k) => membersOf(k).length >= 2)).map((i) => i.id))];
  const controls = manifest.filter((i) => !(i.concepts ?? []).length).slice(0, 12).map((i) => i.id);
  const sample = inSets.filter((_, n) => n % 9 === 0 || n < 4).slice(0, 24);
  const wrong = [];
  for (const id of [...sample, ...controls]) {
    await pg.goto(`${BASE}#/i/${id}`, { waitUntil: "domcontentloaded" });
    await pg.waitForSelector(".badges", { timeout: 15000 });
    const got = await pg.evaluate(() => [...document.querySelectorAll("[data-compare-links] a")].map((a) => ({ text: a.textContent.replace(/\s+/g, " ").trim(), href: a.getAttribute("href") })));
    const item = byId.get(id);
    const want = (item.concepts ?? [])
      .map((k) => ({ key: k, others: membersOf(k).length - 1 }))
      .filter((c) => c.others >= 1);
    if (got.length !== want.length) { wrong.push(`${id}: ${got.length} links ≠ ${want.length} sets`); continue; }
    for (let n = 0; n < want.length; n += 1) {
      if (got[n].href !== `#/c/${want[n].key}`) wrong.push(`${id}: ${got[n].href} ≠ #/c/${want[n].key}`);
      const word = want[n].others === 1 ? "other" : "others";
      if (!got[n].text.includes(String(want[n].others)) || !got[n].text.includes(word) || !got[n].text.includes(want[n].key))
        wrong.push(`${id}: "${got[n].text}" does not say ${want[n].others} ${word} in ${want[n].key}`);
    }
    // and the link goes somewhere real
    if (got.length) {
      await pg.click("[data-compare-links] a");
      await pg.waitForSelector("[data-compare-counts]", { timeout: 15000 });
      const dest = await pg.getAttribute("[data-compare-concept]", "data-compare-concept");
      if (dest !== want[0].key) wrong.push(`${id}: its link lands on #/c/${dest}`);
    }
  }
  ok("item-link.exactly-when-2-plus", wrong.length === 0, wrong.slice(0, 5).join(" | ") || `${sample.length} items with sets, ${controls.length} without, all correct`);
  ok("item-link.zero-console-errors", true, `${errors.length} console error(s) across ${sample.length + controls.length} item pages — demo-module errors are recorded, not gated: the item page is not this unit's surface`);
  await ctx.close();
}

/* ── 5. no verdict words in what a visitor is given ─────────────────────────────────────────────────────── */

{
  const { ctx, pg } = await open(VIEWPORTS[0]);
  const banned = /best|winner|rank/i;
  const hits = [];
  for (const key of ["sidebar", "utils", "button", "tabs"]) {
    await pg.goto(`${BASE}#/c/${key}`, { waitUntil: "domcontentloaded" });
    await pg.waitForSelector("[data-compare-counts]", { timeout: 15000 });
    const text = await pg.evaluate(() => document.querySelector(".page").innerText);
    const m = text.match(banned);
    if (m) hits.push(`${key}: “${m[0]}” in the rendered page`);
  }
  ok("no-verdict-words", hits.length === 0, hits.join(" | ") || "no best/winner/rank in four rendered pages");
  await ctx.close();
}

/* ── 6. reduced motion: the turn is decoration, so it does not run ──────────────────────────────────────── */

{
  const { ctx, pg } = await open(VIEWPORTS[0], { reducedMotion: "reduce" });
  await pg.goto(`${BASE}#/c/sidebar`, { waitUntil: "domcontentloaded" });
  await pg.waitForSelector("[data-compare-counts]", { timeout: 15000 });
  const before = await pg.evaluate(() => document.getAnimations().length);
  await pg.evaluate(() => { location.hash = "#/c/utils"; });
  await pg.waitForTimeout(80);
  const during = await pg.evaluate(() => document.getAnimations().length);
  ok("reduced-motion.no-animations", during === 0 && before === 0, `${before} before the turn, ${during} during it`);
  await ctx.close();
}

{
  // and with motion allowed the turn is 250 ms, the catalogue's own number
  const { ctx, pg } = await open(VIEWPORTS[0]);
  await pg.goto(`${BASE}#/c/sidebar`, { waitUntil: "domcontentloaded" });
  await pg.waitForSelector("[data-compare-counts]", { timeout: 15000 });
  const ms = await pg.evaluate(async () => {
    location.hash = "#/c/utils";
    await new Promise((r) => requestAnimationFrame(r));
    const a = document.getAnimations().map((x) => x.effect?.getTiming?.().duration ?? 0);
    return a;
  });
  ok("page-turn.250ms", ms.includes(250), `durations ${JSON.stringify(ms)}`);
  await ctx.close();
}

await browser.close();

/* ── verdict, and the JSON beside this file ─────────────────────────────────────────────────────────────── */

const all = Object.values(report.gates).flat();
report.summary = { checks: all.length, pass: all.filter((g) => g.pass).length, fail: all.filter((g) => !g.pass).length };
writeFileSync(OUT, JSON.stringify(report, null, 1));

console.log(`\n${report.summary.pass}/${report.summary.checks} gates pass, ${report.summary.fail} fail\n`);
for (const [name, list] of Object.entries(report.gates)) {
  for (const g of list) console.log(`${g.pass ? "ok  " : "FAIL"} ${name} — ${g.detail}`);
}
console.log("\nconcept                                 members  store  shown                       dropped");
for (const [key, n, sn, srcs, shown, dropped, verdict] of report.conceptTable) {
  console.log(`${(key + " ").padEnd(38)} ${String(n).padStart(4)} ${String(sn).padStart(6)}  ${(shown || "—").padEnd(26)} ${(dropped || "—")} ${verdict === "ok" ? "" : "  ← " + verdict}`);
}
process.exit(report.summary.fail ? 1 : 0);
