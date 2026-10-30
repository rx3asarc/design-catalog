/* type-page-check — the gate on `#/t/<section-slug>/<type-slug>`, one collection per level-2 type.
 *
 * The brief for this surface is five sentences from a review of the collections, and each one is a check:
 *
 *   1. one collection per level-2 type, same membership as the sidebar → every entry in the taxonomy resolves to a
 *      page, and each page's title is that entry's own type;
 *   2. a live demo next to each row → every row and every "also" entry that has a demo gets a frame, and the pool
 *      never holds more than two at once at either viewport;
 *   3. a sortable table, unmeasured members in "Also in this set" instead of rows of "not measured" → no row
 *      answers nothing, no table row is a string of "not measured", the count in the header is the row count, and
 *      clicking a column header sorts by it in both directions, with `aria-sort` and a real re-order;
 *   4. the measurement date once, in the header → exactly one date in the page's text, however many rows there are;
 *   5. the paragraphs explaining what isn't there are gone → a ban list of the sentences the review quoted.
 *
 * Two more, because this page is the backbone of the site and a backbone has to hold on a phone: nothing under
 * 12 px, nothing tappable under 44 px, and no horizontal overflow at 390.
 *
 *   node qa/type_page_check.mjs [base]        base defaults to http://localhost:8830/design-catalog/
 */
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:8830/design-catalog/").replace(/\/?$/, "/");
const REPO = "/mnt/HC_Volume_105573741/design-catalog-site-r8-collections";
const taxonomy = JSON.parse(readFileSync(`${REPO}/app/src/site/taxonomy.json`, "utf8"));
const manifest = JSON.parse(readFileSync(`${REPO}/app/manifest.json`, "utf8"));
/** a concept's members, read from the item's own `concepts` — the field `#/c/<key>` and the strip both read */
const membersOf = (key) => manifest.filter((i) => (i.concepts ?? []).includes(key)).map((i) => `${i.source}/${i.slug}`);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const pairs = Object.entries(taxonomy.sections).flatMap(([section, types]) =>
  Object.keys(types).map((type) => ({ section, type })));
const route = (p) => `#/t/${slug(p.section)}/${slug(p.type)}`;

let fails = 0;
const ok = (name, pass, detail) => {
  if (!pass) fails++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

const settle = async () => {
  await page.waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(120);
};
const facts = () => page.evaluate(() => {
  const el = document.querySelector("[data-type-facts]");
  return el ? { d: { ...el.dataset }, text: el.textContent.replace(/\s+/g, " ").trim() } : null;
});
const rowIds = () => page.evaluate(() => [...document.querySelectorAll("[data-type-row]")].map((r) => r.dataset.typeRow));

const BAN = [
  "would be a list with lines drawn on it",
  "carry no measured behaviour",
  "nothing to compare here",
  "in this build",
  "not exported",
  "shelf order",
];

await page.goto(BASE, { waitUntil: "load" });
await settle();

/* ── 1. every type in the taxonomy is a page, and the page is that type ──────────────────────────────────── */
{
  const missing = [];
  const wrong = [];
  for (const p of pairs) {
    await page.evaluate((h) => { location.hash = h; }, route(p));
    const got = await page
      .waitForFunction((want) => document.querySelector("[data-type-title]")?.textContent === want, p.type, { timeout: 5000 })
      .catch(() => null);
    if (!got) { missing.push(route(p)); continue; }
    const f = await facts();
    if (!f || f.d.typeSection !== p.section) wrong.push(`${route(p)} → ${f?.d.typeSection}`);
  }
  ok(`every type in the taxonomy has a page (${pairs.length})`, missing.length === 0, missing.slice(0, 4).join(" ") || "all resolve");
  ok("each page names its own section", wrong.length === 0, wrong.slice(0, 3).join(" ") || "section matches the taxonomy");

  // a pair the taxonomy does not have is a miss, not a nearest neighbour
  await page.evaluate(() => { location.hash = "#/t/components/not-a-type"; });
  await page.waitForTimeout(300);
  const miss = await page.evaluate(() => ({
    title: document.querySelector("[data-type-title]")?.textContent ?? null,
    text: document.body.innerText.replace(/\s+/g, " "),
  }));
  ok("an unknown pair is a miss, not a guess", miss.title === null && /no page in this catalogue/i.test(miss.text), miss.title ?? "no title");
}

/* ── 3 + 4. the sidebar page: measured rows in a sorted table, unmeasured below it, one date in the header ─ */
await page.evaluate(() => { location.hash = "#/t/components/sidebar"; });
await settle();
await page.waitForSelector("[data-type-table]", { timeout: 10000 });
{
  const f = await facts();
  const rows = await rowIds();
  ok("the header counts members and measured rows", Number(f.d.typeMembers) > rows.length && Number(f.d.typeMeasured) === rows.length,
    `${f.d.typeMembers} members, ${f.d.typeMeasured} measured, ${rows.length} rows`);
  ok("the unmeasured members are counted, and not rows", Number(f.d.typeUnmeasured) === Number(f.d.typeMembers) - rows.length,
    `${f.d.typeUnmeasured} also in this set`);
  const also = await page.evaluate(() => [...document.querySelectorAll("[data-type-also] [data-also-row]")].map((r) => r.dataset.alsoRow));
  const rowSet = new Set(rows);
  ok("the also list holds exactly the members that are not rows", also.length === Number(f.d.typeUnmeasured) && also.every((id) => !rowSet.has(id)),
    `${also.length} listed, 0 overlap`);

  // no row may be a string of "not measured": every row answers at least one column
  const hollow = await page.evaluate(() => [...document.querySelectorAll("[data-type-row]")].filter((r) => {
    const cells = [...r.querySelectorAll("[data-col]")];
    return cells.length === 0 || cells.every((c) => c.dataset.colMeasured === "false");
  }).map((r) => r.dataset.typeRow));
  ok("no row answers nothing", hollow.length === 0, hollow.join(" ") || `${rows.length} rows, each answers a column`);

  // the date is in the header, exactly once, whatever the row count
  const dates = await page.evaluate(() => (document.body.innerText.match(/\b\d{1,2} [A-Z][a-z]+ 20\d{2}\b/g) ?? []));
  ok("the measurement date is printed once, in the header", dates.length === 1 && /on \d{1,2} [A-Z][a-z]+ 20\d{2}/.test(f.text),
    `${dates.length} date(s): ${dates.join(" | ")}`);
  const picks = await page.evaluate(() => [...document.querySelectorAll("[data-type-pick]")].map((p) => p.textContent));
  ok("no pick line repeats the date", picks.length > 0 && picks.every((t) => !/20\d{2}/.test(t)), `${picks.length} pick lines`);

  // 5. the quoting paragraphs are gone
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").toLowerCase());
  const banned = BAN.filter((b) => text.includes(b));
  ok("no paragraph explaining what is not there", banned.length === 0, banned.join(" | ") || "none of the quoted sentences");
  ok("no withheld block on a collection page", (await page.locator(".withheld").count()) === 0, "0 .withheld");

  /* ── 3. sorting: every header, both directions, a real re-order, aria-sort following it ──────────────── */
  const headers = await page.evaluate(() => [...document.querySelectorAll(".type-table thead th .type-sort")].map((b) => b.textContent.trim()));
  ok("every header is a sort control", headers.length === Number(f.d.typeColumns.split(",").filter(Boolean).length) + 1, headers.join(" · "));
  const base = await rowIds();
  const sortState = async () => {
    const raw = await page.evaluate(() => document.querySelector("[data-type-facts]").dataset.typeSort);
    const [key, dir] = raw.split(":");
    return { key, dir, raw };
  };
  let reordered = 0;
  let prev = await sortState();          // the page opens sorted by name, ascending
  for (let i = 0; i < headers.length; i++) {
    for (let pass = 0; pass < 2; pass++) {
      await page.locator(".type-table thead th .type-sort").nth(i).click();
      await page.waitForTimeout(80);
      const now = await sortState();
      const key = await page.evaluate((n) => {
        const btn = document.querySelectorAll(".type-table thead th .type-sort")[n];
        return btn?.closest("th")?.dataset.col ?? "item";
      }, i);
      // the contract: a new column starts ascending, the column already sorted flips direction
      const want = prev.key === key ? (prev.dir === "asc" ? "desc" : "asc") : "asc";
      const aria = await page.evaluate((n) => {
        const btn = document.querySelectorAll(".type-table thead th .type-sort")[n];
        return btn?.closest("th")?.getAttribute("aria-sort") ?? null;
      }, i);
      const wantAria = want === "asc" ? "ascending" : "descending";
      const now2 = await rowIds();
      const same = now2.length === base.length && [...now2].sort().join() === [...base].sort().join();
      if (now.key !== key || now.dir !== want || aria !== wantAria || !same) {
        fails++;
        console.log(`FAIL sort ${headers[i]} pass ${pass} — state ${now.raw} (want ${key}:${want}), aria ${aria} (want ${wantAria}), rows intact ${same}`);
      }
      if (now2.join() !== base.join()) reordered++;
      prev = now;
    }
  }
  ok("every column sorts, both directions, and only re-orders the same rows", reordered > 0, `${headers.length} columns, ${reordered} orders differed from the name order`);

  // 2. a demo beside each row that has one, and never more than two live frames
  const demos = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-type-row]")];
    return {
      rows: rows.length,
      windows: rows.filter((r) => r.querySelector("[data-row-demo]")).length,
      live: document.querySelectorAll('[data-demo-mode="live"]').length,
      frames: document.querySelectorAll("iframe").length,
    };
  });
  ok("every row's demo window exists", demos.windows === demos.rows, `${demos.windows} windows for ${demos.rows} rows`);
  ok("the pool caps live frames at two", demos.live <= 2 && demos.frames <= 2, `${demos.live} live, ${demos.frames} iframes`);

  // 7. the strip is this section's types and never another section's
  const strip = await page.evaluate(() => [...document.querySelectorAll("[data-type-strip] a")].map((a) => a.getAttribute("href")));
  ok("the strip offers this section's other types only", strip.length > 0 && strip.every((h) => h.startsWith("#/t/components/")),
    `${strip.length} links, all #/t/components/…`);
  ok("the strip does not include the page it is on", !strip.includes("#/t/components/sidebar"), "0 self-links");
}

/* ── a type nobody measured: no table, no explanation, and every member still has its demo ──────────────── */
await page.evaluate(() => { location.hash = "#/t/components/button"; });
await settle();
{
  const f = await facts();
  const t = await page.evaluate(() => ({
    table: document.querySelectorAll("[data-type-table]").length,
    also: document.querySelectorAll("[data-also-row]").length,
    windows: document.querySelectorAll("[data-also-row] [data-row-demo]").length,
    heading: [...document.querySelectorAll(".section-h")].map((h) => h.textContent),
    text: document.body.innerText.replace(/\s+/g, " ").toLowerCase(),
  }));
  ok("a set nobody measured has no table", t.table === 0 && f.d.typeMeasured === "0", `${f.d.typeMembers} members, 0 measured`);
  ok("its members are listed, not hidden", t.also === Number(f.d.typeMembers) && t.heading.includes("In this set"), `${t.also} entries`);
  ok("and their demos are there", t.windows > 0, `${t.windows} demo windows in the list`);
  const banned = BAN.filter((b) => t.text.includes(b));
  ok("and it does not explain the absence", banned.length === 0, banned.join(" | ") || "nothing said about it");
  ok("no date is printed for a set with no measurement", !/\b\d{1,2} [A-Z][a-z]+ 20\d{2}\b/.test(t.text), "no date");
}

/* ── 7b. the gallery's compare strip is scoped to the grid it sits in ────────────────────────────────────── */
{
  const gridIds = () => page.evaluate(() => [...document.querySelectorAll("[data-catalog-item]")].map((e) => e.dataset.catalogItem));
  const strip = () => page.evaluate(() => [...document.querySelectorAll("[data-compare-links] a")].map((a) => a.getAttribute("href")));

  await page.evaluate(() => { location.hash = "#/g"; });
  await settle();
  await page.waitForTimeout(600);
  const everySet = await strip();
  ok("the unfiltered gallery still offers every comparable set", everySet.length >= 20, `${everySet.length} links`);

  // a section filter, taken from the rail so the label is the rail's own; the first with a non-empty grid wins
  // the rail's four sections, in the rail's order (`SECTIONS` in site/route.ts); a label that resolves to no rows
  // is skipped rather than failed, because the point is the strip, not the filter
  const labels = ["Components", "Blocks and pages", "Motion and effects", "Docs"];
  let used = null, filteredIds = [], filtered = [];
  for (const label of labels.slice(0, 6)) {
    await page.evaluate((l) => { location.hash = `#/g?sec=${encodeURIComponent(l)}`; }, label);
    await settle();
    await page.waitForTimeout(500);
    const ids = await gridIds();
    if (ids.length) { used = label; filteredIds = ids; filtered = await strip(); break; }
  }
  ok("a section filter still mounts a grid to check against", !!used, used ? `sec=${used}, ${filteredIds.length} items` : "no rail section produced a grid");
  if (used) {
    const inGrid = new Set(filteredIds);
    const wrong = filtered
      .map((h) => h.replace("#/c/", ""))
      .filter((key) => !membersOf(key).some((id) => inGrid.has(id)));
    ok("the strip offers no set that has nothing in this grid",
      wrong.length === 0, wrong.length ? wrong.join(" ") : `${filtered.length} set(s), every one has a member here`);
  }

  // the review's own complaint: the strip listed all twenty sets "in every section". A text filter is the narrowest
  // grid this page can be put in, and a set with nothing in that grid is the failure being checked.
  await page.evaluate(() => { location.hash = "#/g?q=sidebar"; });
  await settle();
  await page.waitForTimeout(600);
  const narrowIds = new Set(await gridIds());
  const narrow = await strip();
  const narrowWrong = narrow.map((h) => h.replace("#/c/", "")).filter((k) => !membersOf(k).some((id) => narrowIds.has(id)));
  ok("a narrow filter offers only sets that are in it",
    narrowWrong.length === 0 && narrow.length < everySet.length && !narrow.includes("#/c/checkbox"),
    `${narrow.length} of ${everySet.length} sets, ${narrowIds.size} items in the grid${narrowWrong.length ? `, wrong: ${narrowWrong.join(" ")}` : ""}`);
}

/* ── 390: the same page, re-flowed — no overflow, no fact column lost, nothing small, nothing untappable ── */
{
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await phone.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`${BASE}#/t/components/sidebar`, { waitUntil: "load" });
  await p.waitForFunction(() => !document.querySelector("[data-surface-wait]"), null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(600);
  // walk the page so the lazy pool mounts and detaches what it should
  let worst = 0;
  for (let y = 0; y < 4000; y += 400) {
    await p.evaluate((yy) => { (document.querySelector(".page") ?? document.documentElement).scrollTo(0, yy); }, y);
    await p.waitForTimeout(90);
    worst = Math.max(worst, await p.evaluate(() => document.querySelectorAll('[data-demo-mode="live"]').length));
  }
  const m = await p.evaluate(() => {
    const cells = [...document.querySelectorAll("[data-type-row] [data-col]")];
    return {
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      cols: cells.length,
      colsVisible: cells.filter((c) => c.getBoundingClientRect().height > 0 && getComputedStyle(c).display !== "none").length,
      labelled: cells.every((c) => getComputedStyle(c, "::before").content.includes(c.dataset.head)),
      smallest: Math.min(...[...document.querySelectorAll(".type-page *")].map((e) => parseFloat(getComputedStyle(e).fontSize) || 99)),
      small: [...document.querySelectorAll(".type-page a, .type-page button, .type-page select")]
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.height > 0 && r.height < 43.5)
        .map(({ e }) => `${e.tagName}.${e.className}`),
      rows: document.querySelectorAll("[data-type-row]").length,
    };
  });
  ok("390: no horizontal overflow", m.scrollW <= m.clientW, `${m.scrollW} of ${m.clientW} px`);
  ok("390: every behaviour column is still on the page", m.cols > 0 && m.colsVisible === m.cols, `${m.colsVisible}/${m.cols} cells visible`);
  ok("390: each cell still names its column", m.labelled, "label printed from data-head");
  ok("390: nothing under 12 px", m.smallest >= 12, `${m.smallest} px smallest`);
  ok("390: nothing tappable under 44 px", m.small.length === 0, m.small.slice(0, 4).join(" ") || "all ≥ 44 px");
  ok("390: the pool caps live frames at two", worst <= 2, `${worst} live at the busiest scroll position`);
  await phone.close();
}

ok("no console errors (screenshots may 404 a font on a local base)", errors.length === 0, errors.slice(0, 3).join(" | ") || "clean");

await browser.close();
console.log(`\nTYPE PAGE: ${fails === 0 ? "ok" : `${fails} FAILED check(s)`}`);
process.exit(fails === 0 ? 0 : 1);
