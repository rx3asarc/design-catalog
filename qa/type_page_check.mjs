/* type-page-check — the gate on `#/t/<section-slug>/<type-slug>`, one collection per level-2 type.
 *
 * The brief for this surface is the review's sentences, and each one is a check:
 *
 *   1. one collection per level-2 type, same membership as the sidebar → every entry in the taxonomy resolves to a
 *      page, and each page's title is that entry's own type;
 *   2. a live demo next to each row → every row that has a demo gets a frame, every card in the grid gets a window,
 *      at least one of those windows is actually **live** (round 9: the grid's windows never mounted, which is
 *      what made the thumbnails grey "DEMO" boxes), and the pool never holds more than two frames at either
 *      viewport;
 *   3. a sortable table where the type earns one, "Also in this set" as a grid instead of rows of "not measured" →
 *      no row answers nothing, the header's counts are the row and card counts, and clicking a column header sorts
 *      by it in both directions, with `aria-sort` and a real re-order;
 *   4. the measurement date once, in the header → exactly one date in the page's text, however many rows there are;
 *   5. the paragraphs explaining what isn't there are gone → a ban list of the sentences the review quoted.
 *
 * Round 9 added the three that the review's §2, §3 and §8 asked for, and they are the reason this file changed:
 *
 *   6. **columns are the type's, not the sidebar's** — the page declares `data-type-columns` and every printed cell
 *      is one of them; Button declares `sizes`/`loading`/`icons` and declares neither `collapses` nor `sheet`
 *      (nor `keyboard`), and Calendar declares no behaviour column at all;
 *   7. **counts admit the folded variants** — the header, every rail row and every browse card prints
 *      `N items · M variants`, and the numbers are the taxonomy's own;
 *   8. **the table is earned, not assumed** — a type with fewer than two measured members prints no table at all
 *      (`site/columns.ts`: `TABLE_FLOOR`), which is what the review asked for in "66 of 67 tables hold a single
 *      row … lead with the visual grid".
 *
 * Two more, because this page is the backbone of the site and a backbone has to hold on a phone: nothing under
 * 12 px, nothing tappable under 44 px, and no horizontal overflow at 390.
 *
 *   node qa/type_page_check.mjs [base]        base defaults to http://localhost:8830/design-catalog/
 */
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] ?? "http://localhost:8830/design-catalog/").replace(/\/?$/, "/");
/**
 * The taxonomy and the manifest come from **this gate's own repo**, not from a hardcoded worktree path. It used to
 * be `/mnt/HC_Volume_105573741/design-catalog-site-r8-collections`, which meant a gate served one build and read
 * another worktree's manifest: that worktree's `behaviour` records would decide which type was sampled, no matter
 * which build was under test. `python3 app/gen.py` writes this file in the same tree the server serves.
 */
const REPO = fileURLToPath(new URL("..", import.meta.url));
const taxonomy = JSON.parse(readFileSync(`${REPO}/app/src/site/taxonomy.json`, "utf8"));
const manifest = JSON.parse(readFileSync(`${REPO}/app/manifest.json`, "utf8"));
/** a concept's members, read from the item's own `concepts` — the field `#/c/<key>` and the strip both read */
const membersOf = (key) => manifest.filter((i) => (i.concepts ?? []).includes(key)).map((i) => `${i.source}/${i.slug}`);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const pairs = Object.entries(taxonomy.sections).flatMap(([section, types]) =>
  Object.keys(types).map((type) => ({ section, type })));

/**
 * Which type is *a set nobody measured*, read from the build's own manifest instead of being hardcoded.
 *
 * It was `components/button` until r8-probe measured Button's first demoed member (`beui/action-swap`); Button is
 * now a one-row table, which is the new normal and not a regression. After that run every type whose members ship
 * a demo has a measured member, so the only unmeasured sets left are the ones with nothing to measure: the members
 * are all reference-only, which is why this block can no longer assert that the list has demo windows (a type with
 * no demo has no demo to show). That half of the property moved to Button, below, where a list of unmeasured
 * members *with* demos exists. The sample is named in the output, always.
 */
const FACTS = ["collapses", "sheet", "nests", "animates", "keyboard", "shape"];
const answered = (i) => !!i.behaviour && FACTS.some((k) => typeof i.behaviour[k] === "boolean");
const byId = new Map(manifest.map((i) => [`${i.source}/${i.slug}`, i]));
const measuredTypeCount = (p) =>
  (taxonomy.sections[p.section]?.[p.type] ?? []).filter((id) => answered(byId.get(id) ?? {})).length;
/**
 * THE TABLE FLOOR, mirrored from `app/src/site/columns.ts` (`TABLE_FLOOR`). Two members that answered the same
 * measured question is the smallest thing that can be compared; a type with fewer prints no table and leads with
 * the grid. The gate hardcodes the number on purpose — it is asserting the site against a rule, and a rule the
 * gate read out of the code could not fail.
 */
const TABLE_FLOOR = 2;
const PREFERRED_NO_TABLE = { section: "Components", type: "Button" };
const noTableType = [PREFERRED_NO_TABLE, ...pairs].find((p) =>
  measuredTypeCount(p) < TABLE_FLOOR && (taxonomy.sections[p.section]?.[p.type] ?? []).length > 1) ?? null;
/** a set that EARNS its table *and* has unmeasured members with demos: the grid below the table, with windows in it */
const alsoWithDemos = pairs
  .map((p) => ({ ...p, ids: taxonomy.sections[p.section]?.[p.type] ?? [] }))
  .find((p) => measuredTypeCount(p) >= TABLE_FLOOR
    && p.ids.some((id) => !answered(byId.get(id) ?? {}) && ((byId.get(id)?.variants ?? []).length > 0))) ?? null;
console.log(`sample no-table type  ${noTableType ? `${noTableType.section}/${noTableType.type} (${measuredTypeCount(noTableType)} measured)` : "(none — every type earns a table)"}`);
console.log(`sample table+grid     ${alsoWithDemos ? `${alsoWithDemos.section}/${alsoWithDemos.type} (${measuredTypeCount(alsoWithDemos)} measured)` : "(none)"}`);
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
  const cards = await page.evaluate(() => [...document.querySelectorAll("[data-member-card]")].map((r) => r.dataset.memberCard));
  const rowSet = new Set(rows);
  ok("the grid holds exactly the members the table did not take", cards.length === Number(f.d.typeMembers) - rows.length && cards.every((id) => !rowSet.has(id)),
    `${cards.length} cards for ${f.d.typeMembers} members, ${rows.length} in the table, 0 overlap`);

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
  // the table prints the type's MEASURED columns only: `data-type-columns` is everything the type declares
  const measuredCols = f.d.typeMeasuredColumns.split(",").filter(Boolean);
  ok("every measured column has a sort header", headers.length === measuredCols.length + 1, `${headers.join(" · ")} (measured: ${measuredCols.join(",")})`);
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

/* ── the type that earns no table: the grid, no explanation, every member still listed ───────────────────── */
if (noTableType) {
  const route = `#/t/${slug(noTableType.section)}/${slug(noTableType.type)}`;
  await page.evaluate((h) => { location.hash = h; }, route);
  await settle();
  // the pool mounts a frame after the grid is laid out: wait for one to be live rather than assume it
  await page.waitForFunction(() => document.querySelectorAll('[data-demo-mode="live"]').length > 0, null, { timeout: 8000 }).catch(() => {});
  {
    const f = await facts();
    const t = await page.evaluate(() => ({
      table: document.querySelectorAll("[data-type-table]").length,
      cards: document.querySelectorAll("[data-member-card]").length,
      windows: document.querySelectorAll("[data-member-card] [data-row-demo]").length,
      live: document.querySelectorAll('[data-demo-mode="live"]').length,
      heading: [...document.querySelectorAll(".section-h")].map((h) => h.textContent),
      text: document.body.innerText.replace(/\s+/g, " ").toLowerCase(),
    }));
    ok("a set below the table floor has no table", t.table === 0 && f.d.typeHasTable === "no",
      `${f.d.typeMembers} members, ${f.d.typeMeasured} measured (floor ${TABLE_FLOOR})`);
    ok("it leads with the grid, and every member is in it", t.cards === Number(f.d.typeMembers) && t.heading.includes("In this set"),
      `${t.cards} cards, heading "${t.heading[0] ?? "none"}"`);
    ok("its cards get demo windows, and at least one is live", t.windows > 0 && t.live > 0,
      `${t.windows} windows, ${t.live} live — the grey-DEMO bug was 0 here`);
    const banned = BAN.filter((b) => t.text.includes(b));
    ok("and it does not explain the absence", banned.length === 0, banned.join(" | ") || "nothing said about it");
    ok("no date is printed for a set with no measurement", !/\b\d{1,2} [A-Z][a-z]+ 20\d{2}\b/.test(t.text), "no date");
  }
}

/* ── a set that earns its table: the table exists, and the members below it keep their demos ─────────────── */
if (alsoWithDemos) {
  const route = `#/t/${slug(alsoWithDemos.section)}/${slug(alsoWithDemos.type)}`;
  await page.evaluate((h) => { location.hash = h; }, route);
  await settle();
  // the pool mounts a frame after the grid is laid out: wait for one to be live rather than assume it
  await page.waitForFunction(() => document.querySelectorAll('[data-demo-mode="live"]').length > 0, null, { timeout: 8000 }).catch(() => {});
  {
    const f = await facts();
    const t = await page.evaluate(() => ({
      table: document.querySelectorAll("[data-type-table]").length,
      rows: document.querySelectorAll("[data-type-row]").length,
      cards: document.querySelectorAll("[data-member-card]").length,
      windows: document.querySelectorAll("[data-member-card] [data-row-demo]").length,
      heading: [...document.querySelectorAll(".section-h")].map((h) => h.textContent),
    }));
    ok("a set at or above the table floor prints a table", t.table === 1 && t.rows === Number(f.d.typeMeasured),
      `${t.rows} rows for ${f.d.typeMeasured} measured of ${f.d.typeMembers}`);
    ok("the members below it are a grid that keeps its demos",
      t.cards === Number(f.d.typeMembers) - t.rows && t.windows > 0 && t.heading.includes("Also in this set"),
      `${t.windows} demo windows in ${t.cards} cards`);
  }
}

/* ── 6. THE COLUMNS ARE THE TYPE'S — the review's own example, checked against the declaration ─────────────── */
{
  const declared = (p) => {
    const ids = taxonomy.sections[p.section]?.[p.type] ?? [];
    return ids;
  };
  const BEHAVIOUR = ["collapses", "nests", "sheet", "keyboard", "shape", "animates"];
  /* the review: "Every type reuses the sidebar's columns. Button and Calendar get COLLAPSES and AT 390 PX … Each
     type needs its own columns; for buttons: variants, sizes, loading state, icon support." */
  const samples = [
    { section: "Components", type: "Button", wants: ["demos", "sizes", "loading", "icons"], bans: BEHAVIOUR },
    { section: "Components", type: "Calendar", wants: ["demos"], bans: BEHAVIOUR },
    { section: "Foundations", type: "Fonts", wants: [], bans: BEHAVIOUR },
    // the transitions are reference-only: the probe reached them and answered null, so the type declares no
    // measured column at all — which is the same rule stated the other way round
    { section: "Effects", type: "Text transitions", wants: ["demos"], bans: ["collapses", "nests", "sheet", "keyboard", "shape", "animates"] },
  ];
  for (const p of samples) {
    if (!declared(p).length) { ok(`${p.type}: the sample type exists`, false, "not in the taxonomy"); continue; }
    await page.evaluate((h) => { location.hash = h; }, `#/t/${slug(p.section)}/${slug(p.type)}`);
    await settle();
    const f = await facts();
    const cols = (f?.d.typeColumns ?? "").split(",").filter(Boolean);
    const missing = p.wants.filter((c) => !cols.includes(c));
    const banned = p.bans.filter((c) => cols.includes(c));
    ok(`${p.type} declares the columns the review named, and no behaviour column it cannot answer`,
      missing.length === 0 && banned.length === 0,
      `[${cols.join(", ")}]${missing.length ? ` missing ${missing.join(",")}` : ""}${banned.length ? ` BANNED ${banned.join(",")}` : ""}`);
    // and no cell on the page prints a column the type did not declare
    const stray = await page.evaluate((ok) => [...document.querySelectorAll("[data-col]")]
      .map((c) => c.dataset.col).filter((c) => !ok.includes(c)), cols);
    ok(`${p.type} prints no column it did not declare`, stray.length === 0, stray.join(" ") || "0 stray cells");
  }
}

/* ── 7. COUNTS ADMIT THE FOLDED VARIANTS, in all three places a count is printed ──────────────────────────── */
{
  const label = (members, variants) => `${members} ${members === 1 ? "item" : "items"}${variants ? ` · ${variants} ${variants === 1 ? "variant" : "variants"}` : ""}`;
  const expect = (section, type) => {
    const ids = taxonomy.sections[section]?.[type] ?? [];
    const variants = ids.reduce((n, id) => n + (taxonomy.variants[id]?.length ?? 0), 0);
    return label(ids.length, variants);
  };
  // the type page's header
  await page.evaluate(() => { location.hash = "#/t/components/sidebar"; });
  await settle();
  const header = (await facts()).text;
  const want = expect("Components", "Sidebar");
  ok("the type page header prints `N items · M variants`", header.startsWith(want), `"${header.split(" · ").slice(0, 2).join(" · ")}" — want "${want}"`);

  // the rail row for that type, and the browse card for it
  const rail = await page.evaluate(() => {
    const el = document.querySelector('[data-rail-count="Components/Sidebar"]');
    return el ? el.textContent.trim() : null;
  });
  ok("the rail row prints the same phrase", rail === want, `${rail ?? "(no rail row)"} — want "${want}"`);

  await page.evaluate(() => { location.hash = "#/"; });      // Browse by type is a section of the front page
  await settle();
  const card = await page.evaluate(() => {
    const el = document.querySelector('[data-type-card-count="Components/Sidebar"]');
    return el ? el.textContent.trim() : null;
  });
  ok("the browse card prints the same phrase", card === want, `${card ?? "(no card)"} — want "${want}"`);

  // the type whose count the review called out: one member, eleven variants
  const factLines = await page.evaluate(() => {
    const el = document.querySelector('[data-type-card-count="Charts/Chart demonstrations"]');
    return el ? el.textContent.trim() : null;
  });
  const chart = expect("Charts", "Chart demonstrations");
  ok("a type that is mostly variants says so", factLines === chart, `${factLines ?? "(no card)"} — want "${chart}"`);
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
