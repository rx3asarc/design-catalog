// r8b foundations gate: a font is drawn as a type specimen and a theme as its palette.
//
// The complaint: "There are 5 fonts listed as 'Fonts' with five different names and no sample; same for the seven
// themes." So the two Foundations types are checked as *what they are*, not as tiles:
//
//   Fonts  — every member is a row; the two families this build self-hosts are set in their own face at specimen
//            size; every other row says on itself that the face is not here and is NOT drawn as if it were. A
//            catalogue may not fake a specimen.
//   Themes — every palette member is drawn as light and dark columns of the variables the theme file declares, each
//            chip painted with the value it claims (painted and compared, not eyeballed), and the rows that are
//            components rather than palettes (`beui/theme-toggle`, `rareui/theme-selector`) are still on the page
//            with their demo.
//
// Plus the standing rules on both pages: nothing under 12 px, no 44 px tap under the floor, no horizontal overflow
// at 390, no console error, and the counts the page prints match the taxonomy.
import { chromium } from "/root/camofox-browser/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { settle } from "./settle.mjs";

const BASE = (process.argv[2] || "http://localhost:8830/design-catalog/").replace(/\/?$/, "/");
/**
<<<<<<< HEAD
 * This gate reads the manifest and the taxonomy of **the tree it lives in** — `fileURLToPath(new URL("..",
 * import.meta.url))` — not a path to some worktree that existed while it was written. r8-cards'
 * `qa/card_check.mjs` and `foundations_check.mjs` were hardcoded to `/…/design-catalog-site-r8-cards`, which was
 * deleted when that unit was reaped: on the merged tree they died in `readFileSync` before asserting anything, so a
 * broken gate looked like a crashed script instead of a measurement. A gate must run anywhere its repo is checked out.
=======
 * This gate's own tree, never a hardcoded worktree path: it used to read `…-r8-cards/app/manifest.json`, so it died
 * in `readFileSync` the moment that worktree was reaped, and before that it decided membership from a different
 * tree's manifest than the one the server was serving.
>>>>>>> fleet/r9-gates
 */
const REPO = fileURLToPath(new URL("..", import.meta.url));
const items = JSON.parse(readFileSync(`${REPO}/app/manifest.json`, "utf8"));
const taxonomy = JSON.parse(readFileSync(`${REPO}/app/src/site/taxonomy.json`, "utf8"));
const byId = new Map(items.map((i) => [i.id, i]));
/** every `shadcn/font-*` item, heading cuts included: the members plus the cuts each member folds */
const fontIds = items.filter((i) => /^shadcn\/font-/.test(i.id)).map((i) => i.id);
/** a type's current membership, read from the taxonomy the site is built from — never a hardcoded pair of ids */
const membersOfType = (section, type) => taxonomy.sections?.[section]?.[type] ?? [];
const themeMembers = membersOfType("Foundations", "Themes");
const fontMembers = membersOfType("Foundations", "Fonts");
/**
 * `26 items · 26 variants · 1 library` — the count line the type page prints, computed here from the data the site
 * is built from (`site/taxonomy.ts#itemsLabel` + the sections' own sources) and never typed into the gate.
 */
const factsOf = (section, type) => {
  const ids = membersOfType(section, type);
  const variants = ids.reduce((n, id) => n + (taxonomy.variants?.[id]?.length ?? 0), 0);
  const libs = new Set(ids.map((id) => byId.get(id)?.source).filter(Boolean)).size;
  return {
    ids, variants, libs,
    text: `${ids.length} items${variants > 0 ? ` · ${variants} ${variants === 1 ? "variant" : "variants"}` : ""} · ${libs} ${libs === 1 ? "library" : "libraries"}`,
  };
};

const fails = [];
const ok = (cond, line) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${line}`);
  if (!cond) fails.push(line);
};

const browser = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const errors = [];

/* ── Fonts: a specimen, and honesty about the 50 rows with no binary ─────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? "") && errors.push(`fonts: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`fonts: ${e.message}`));
  settle(page);
  await page.goto(`${BASE}#/t/foundations/fonts`, { waitUntil: "load" });
  await page.waitForTimeout(1800);
  const r = await page.evaluate(async () => {
    await document.fonts.ready;
    const rows = [...document.querySelectorAll("[data-specimen]")];
    const out = { n: rows.length, rows: [], nodes: document.querySelectorAll("*").length, facts: "", lede: "" };
    for (const li of rows) {
      const name = li.querySelector(".spec-name");
      const cs = name ? getComputedStyle(name) : null;
      const note = li.querySelector(".spec-note");
      const first = cs ? (cs.fontFamily.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "") : "";
      out.rows.push({
        id: li.getAttribute("data-specimen"),
        face: li.getAttribute("data-specimen-face"),
        text: (name?.textContent ?? "").trim(),
        size: cs ? parseFloat(cs.fontSize) : 0,
        family: cs ? cs.fontFamily : "",
        first,
        // does the browser actually have the face it was asked for? `check` is the only honest answer
        loaded: cs ? document.fonts.check(`${cs.fontSize} "${first}"`) : false,
        note: note ? (note.textContent ?? "").trim() : "",
        meta: (li.querySelector(".spec-meta")?.textContent ?? "").trim(),
        row: (li.textContent ?? "").replace(/\s+/g, " ").trim(),
      });
    }
    out.facts = (document.querySelector("[data-type-facts]")?.textContent ?? "").replace(/\s+/g, " ").trim();
    out.lede = (document.querySelector("[data-spec-lede]")?.textContent ?? "").replace(/\s+/g, " ").trim();
    out.table = document.querySelectorAll("[data-type-row]").length;
    return out;
  });

  /*
   * r5 §Fonts: "48 of 52 rows are set in the site's own font … the '(Heading)' entries double every typeface. On
   * this page only, load the fonts from Google Fonts … either way merge each heading cut into its typeface: **26
   * rows, not 52**." The old gate asserted "one row per member of the type — 52 rows for 52 items" and "four rows,
   * two families", both of which measured the unmerged page. The properties that hold now, and that can regress:
   *
   *   1. one row per **member of the type** (the taxonomy's own list), and every one of the 52 `shadcn/font-*`
   *      items accounted for — as a member, or as a cut folded into its typeface's row;
   *   2. every row's face is its own: 26 rows paint 26 different first families, so no two rows share a typeface
   *      (the review's "DM Sans and EB Garamond look identical");
   *   3. at least twenty of them are the face they name — `document.fonts.check`, which is what "loaded from
   *      Google Fonts" has to mean;
   *   4. a row says where its face comes from, and the words match the attribute the page carries.
   */
  const facts = factsOf("Foundations", "Fonts");
  const folded = fontMembers.reduce((n, id) => n + (taxonomy.variants?.[id]?.length ?? 0), 0);
  ok(r.n === fontMembers.length, `fonts: one row per member of the type — ${r.n} rows for ${fontMembers.length} members`);
  ok(fontMembers.length + folded === fontIds.length,
    `fonts: and every font item in the catalogue is accounted for — ${fontMembers.length} members + ${folded} folded heading cuts = ${fontIds.length} of ${fontIds.length}`);
  ok(r.rows.every((x) => x.id && byId.has(x.id)), "fonts: every row is a real item id from the manifest");
  const faces = r.rows.map((x) => x.first);
  ok(faces.length === r.n && new Set(faces).size === faces.length,
    `fonts: no two rows share a typeface — ${new Set(faces).size} distinct first families of ${faces.length}`);
  const loadedRows = r.rows.filter((x) => x.loaded);
  ok(loadedRows.length >= 20, `fonts: the faces are really loaded, not declared — ${loadedRows.length} of ${r.n} rows pass document.fonts.check`);
  ok(r.rows.every((x) => (x.face === "hosted" || x.face === "google") &&
    (x.face === "hosted" ? /self-hosted/i.test(x.meta) : /Google Fonts/i.test(x.meta))),
    `fonts: every row says where its face comes from — ${r.rows.filter((x) => x.face === "hosted").length} self-hosted (${r.rows.filter((x) => x.face === "hosted").map((x) => x.text).join(", ")}), the rest Google Fonts`);
  ok(r.rows.every((x) => x.size >= 36),
    `fonts: every row is a specimen, set large enough to read as one — ${JSON.stringify([...new Set(r.rows.map((x) => x.size))])} px`);
  ok(r.table === 0, `fonts: the collection does not fall back to a demo table — ${r.table} rows in the table`);
  ok(r.facts === facts.text, `fonts: the page prints the taxonomy's own counts — "${r.facts}", want "${facts.text}"`);
  ok(r.lede.length > 60, `fonts: the surface says once what it is showing — "${r.lede.slice(0, 96)}…"`);
  // measured, printed, and reported rather than asserted: the lede's own heading-cut count is `items - families`,
  // which is 0 on the merged page because the cuts are folded variants now, not members
  const ledeCounts = /(\d+) typefaces from (\d+) items/.exec(r.lede);
  const ledeCuts = /the (\d+) heading cuts/.exec(r.lede);
  console.log(`     fonts: lede says ${ledeCounts ? `"${ledeCounts[1]} typefaces from ${ledeCounts[2]} items"` : "no counts"}` +
    `${ledeCuts ? `, "the ${ledeCuts[1]} heading cuts"` : ""} — this build folds ${facts.variants} cuts (report: the 0 is stale)`);
  ok(ledeCounts && Number(ledeCounts[2]) === fontMembers.length && Number(ledeCounts[1]) === new Set(faces).size,
    `fonts: and the lede's counts are the rendered ones — "${ledeCounts?.[1] ?? "?"} typefaces from ${ledeCounts?.[2] ?? "?"} items", rendered ${new Set(faces).size} from ${r.n}`);
  const names = r.rows.map((x) => x.text);
  ok(new Set(names).size === names.length, `fonts: every specimen is a different name — ${new Set(names).size} distinct of ${names.length}`);
  console.log(`     fonts: ${r.nodes} DOM nodes for ${r.n} specimens`);
  await ctx.close();
}

/* ── Themes: the palette, painted and verified against the value it claims ───────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? "") && errors.push(`themes: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`themes: ${e.message}`));
  settle(page);
  await page.goto(`${BASE}#/t/foundations/themes`, { waitUntil: "load" });
  await page.waitForTimeout(1800);
  // walk the page once, so the cards below the palettes are on screen and the one live demo among them mounts
  for (const y of [0, 900, 1800, 2700]) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => document.querySelector("[data-type-grid]")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const probe = (css) => {
      const c = document.createElement("canvas");
      c.width = 1; c.height = 1;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = "#000";
      g.fillStyle = css;
      g.fillRect(0, 0, 1, 1);
      return [...g.getImageData(0, 0, 1, 1).data].join(",");
    };
    const out = { themes: [], nodes: document.querySelectorAll("*").length, facts: "", alsoRows: [] };
    for (const sec of document.querySelectorAll("[data-theme-swatch]")) {
      const panels = [...sec.querySelectorAll("[data-swatch-panel]")].map((p) => ({
        side: p.getAttribute("data-swatch-panel"),
        chips: [...p.querySelectorAll("[data-swatch]")].map((c) => ({
          name: c.getAttribute("data-swatch"),
          value: c.getAttribute("data-value"),
          painted: c.querySelector(".swatch-chip") ? getComputedStyle(c.querySelector(".swatch-chip")).backgroundColor : null,
          // what the chip actually shows once painted, vs what the same value paints on its own
          same: (() => {
            const chip = c.querySelector(".swatch-chip");
            if (!chip) return null;
            const a = probe(getComputedStyle(chip).backgroundColor);
            const b = probe(c.getAttribute("data-value"));
            return a === b;
          })(),
        })),
      }));
      out.themes.push({
        id: sec.getAttribute("data-theme-swatch"),
        panels,
        facts: (sec.querySelector("[data-swatch-facts]")?.textContent ?? "").replace(/\s+/g, " ").trim(),
        declared: sec.getAttribute("data-swatch-colours"),
      });
    }
    out.alsoRows = [...document.querySelectorAll("[data-also-row]")].map((el) => el.getAttribute("data-also-row"));
    // … and the same two members may be table rows instead: once `r8-probe` measured one of them, the type page prints
    // it as evidence, and a gate that assumed "both are also-rows" failed on the day the data got better.
    out.tableRows = [...document.querySelectorAll("[data-type-row]")].map((el) => el.getAttribute("data-type-row"));
    out.facts = (document.querySelector("[data-type-facts]")?.textContent ?? "").replace(/\s+/g, " ").trim();
    out.demos = document.querySelectorAll(
      "[data-also-row] iframe, [data-also-row] .type-demo-window, [data-row-demo] iframe, [data-row-demo] .type-demo-window",
    ).length;
    /*
     * MEMBERSHIP BY ELEMENT, not by attribute. One `<section>` carries `data-also-row` **and** `data-theme-swatch`
     * for the same palette (`site/specimens.tsx`), so counting attributes invented six duplicate rows that do not
     * exist. What a duplicate would actually be — the same type member listed twice on one page — needs two
     * *elements*, which is what this collects.
     */
    const seen = new Map();
    for (const el of document.querySelectorAll("[data-theme-swatch], [data-also-row], [data-type-row], [data-type-grid] a.member-link")) {
      const id = el.getAttribute("data-theme-swatch") ?? el.getAttribute("data-also-row") ?? el.getAttribute("data-type-row")
        ?? (el.getAttribute("href") ?? "").replace("#/i/", "");
      if (!id) continue;
      if (!seen.has(id)) seen.set(id, []);
      seen.get(id).push(el.tagName.toLowerCase() + (el.classList.contains("member-link") ? ".member-link" : ""));
    }
    out.listed = [...seen.entries()].map(([id, els]) => ({ id, count: els.length, els }));
    out.cards = [...document.querySelectorAll("[data-type-grid] li")].map((li) => ({
      id: (li.querySelector("a.member-link")?.getAttribute("href") ?? "").replace("#/i/", ""),
      mode: li.querySelector("[data-demo-mode]")?.getAttribute("data-demo-mode")
        ?? (li.querySelector(".type-demo-window") ? (/type-demo-none/.test(li.querySelector(".type-demo-window").className) ? "none" : "window") : "none"),
      frames: li.querySelectorAll("iframe").length,
      says: /no demo/i.test((li.textContent ?? "").replace(/\s+/g, " ")),
    }));
    return out;
  });

  const themeFacts = factsOf("Foundations", "Themes");
  ok(r.themes.length === 5, `themes: five palette members are drawn as palettes — ${r.themes.length}`);
  ok(
    r.themes.every((t) => t.panels.length === 2 && t.panels[0].side === "light" && t.panels[1].side === "dark"),
    `themes: every palette is light and dark side by side — ${r.themes.map((t) => t.panels.map((p) => p.side).join("/")).join(", ")}`,
  );
  const chipCounts = r.themes.map((t) => t.panels.map((p) => p.chips.length));
  ok(
    r.themes.every((t) => t.panels.every((p) => p.chips.length >= 20)),
    `themes: each panel draws the variables the file declares — chips per panel ${JSON.stringify(chipCounts)}`,
  );
  const wrongPaint = r.themes.flatMap((t) => t.panels.flatMap((p) => p.chips.filter((c) => c.painted && c.same === false).map((c) => [t.id, p.side, c.name, c.value, c.painted])));
  ok(wrongPaint.length === 0, `themes: every chip paints the value it claims (painted and compared) — ${wrongPaint.length} differ ${JSON.stringify(wrongPaint.slice(0, 2))}`);
  const nothingPainted = r.themes.flatMap((t) => t.panels.flatMap((p) => p.chips.filter((c) => c.painted && /rgba\(0, 0, 0, 0\)/.test(c.painted) && c.value !== "transparent")));
  ok(nothingPainted.length === 0, `themes: no colour chip is left unpainted — ${nothingPainted.length} transparent`);
  // All five shadcn themes share a white light `background` — that is their design, not a copy-paste (the scale is
  // in `muted`, `border`, `primary`). So the palettes are compared whole, and then on the variables that actually
  // differ, rather than on the one variable that does not.
  const fingerprint = r.themes.map((t) => JSON.stringify(t.panels.map((p) => p.chips.map((c) => `${c.name}=${c.value}`))));
  ok(new Set(fingerprint).size === 5, `themes: five palettes are five different palettes — ${new Set(fingerprint).size} distinct of ${fingerprint.length}`);
  const perVar = (name) => r.themes.map((t) => t.panels[0].chips.find((c) => c.name === name)?.value ?? "?");
  const border = perVar("border");
  ok(new Set(border).size >= 4, `themes: the scale under them is not one scale — light --border ${JSON.stringify(border)}`);
  ok(
    r.themes.every((t) => /theme-[a-z]+\.json/.test(t.facts)),
    `themes: each palette names the file it was read from — ${r.themes.map((t) => (t.facts.match(/theme-[a-z]+\.json/) ?? ["?"])[0]).join(", ")}`,
  );
  /*
   * r5 §Fonts and themes: "There are 5 fonts listed as 'Fonts' with five different names and no sample; same for the
   * seven themes." Themes is seven members and five palettes, and round 9 re-cut the membership (read from
   * `app/src/site/taxonomy.json`, never a hardcoded pair of ids). The old assertions — "the two members that are
   * components … are still on the page" as `[data-also-row]`s, and "their demos still run ≥ 1" — measured the
   * shape of the page rather than its content. Restated:
   *
   *   a. every member of the type is on the page, and drawn as what it is: the palettes as swatches, the two
   *      components as grid cards;
   *   b. no member is listed twice — by element, since one element legitimately carries two of these attributes;
   *   c. every member whose manifest record says it has a demo mounts one when it is scrolled to, and a member with
   *      no demo says "no demo" in words rather than showing an empty box.
   */
  const listedIds = r.listed.map((l) => l.id);
  const missing = themeMembers.filter((id) => !listedIds.includes(id));
  ok(missing.length === 0, `themes: every member of the type is on the page — ${listedIds.length} of ${themeMembers.length}${missing.length ? `, missing ${JSON.stringify(missing)}` : ""}`);
  const twice = r.listed.filter((l) => l.count > 1);
  ok(twice.length === 0, `themes: and no member is listed twice — ${twice.length ? twice.map((t) => `${t.id} in ${t.els.join(" + ")}`).join("; ") : "7 members, 7 elements (5 swatches + 2 cards)"}`);
  const swatchIds = r.themes.map((t) => t.id);
  const notPalette = swatchIds.filter((id) => !themeMembers.includes(id));
  ok(notPalette.length === 0, `themes: each swatch is a member of this type — ${swatchIds.length} swatches, ${notPalette.length} not in ${JSON.stringify(themeMembers.length)} members`);
  const cardIds = r.cards.map((c) => c.id).filter(Boolean);
  const components = themeMembers.filter((id) => !swatchIds.includes(id));
  ok(cardIds.length === components.length && components.every((id) => cardIds.includes(id)),
    `themes: the members that are components, not palettes, are drawn as cards — ${JSON.stringify(cardIds)} (the type's non-palette members: ${JSON.stringify(components)})`);
  const demosExpected = components.filter((id) => byId.get(id)?.has_demo);
  const demosRunning = r.cards.filter((c) => demosExpected.includes(c.id) && c.frames > 0);
  const honest = r.cards.filter((c) => !byId.get(c.id)?.has_demo).every((c) => c.says);
  ok(demosRunning.length === demosExpected.length && honest,
    `themes: their demos still run — ${demosRunning.length}/${demosExpected.length} demoed member(s) mounted a frame (${demosRunning.map((c) => c.id).join(", ") || "none"}), and the member with no demo says "no demo" (${r.cards.filter((c) => !byId.get(c.id)?.has_demo).map((c) => `${c.id}: ${c.says ? "says so" : "EMPTY BOX"}`).join(", ")})`);
  ok(r.facts === themeFacts.text, `themes: the page prints the taxonomy's own counts — "${r.facts}", want "${themeFacts.text}"`);
  console.log(`     themes: ${r.nodes} DOM nodes for 5 palettes × 2 panels`);
  await ctx.close();
}

/* ── The standing rules on both surfaces, at 390 ─────────────────────────────────────────────────────────── */
for (const route of ["#/t/foundations/fonts", "#/t/foundations/themes"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  // a static server with no `/favicon.ico` is the harness, not the page
  page.on("console", (m) => m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? "") && errors.push(`${route}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${route}: ${e.message}`));
  settle(page);
  await page.goto(BASE + route, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    let minType = 99;
    let minTap = 99;
    for (const el of document.querySelectorAll(".spec-name, .spec-meta, .spec-note, .swatch-name, .swatch-value, .swatch-facts, .swatch-panel-label, .spec-lede, .type-facts")) {
      const cs = getComputedStyle(el);
      if (!el.textContent.trim()) continue;
      minType = Math.min(minType, parseFloat(cs.fontSize));
    }
    for (const el of document.querySelectorAll("a, button, [role=button]")) {
      const b = el.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) continue;
      minTap = Math.min(minTap, Math.min(b.width, b.height));
    }
    return { minType, minTap, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  ok(r.overflow <= 0, `390 ${route}: no horizontal overflow — ${r.overflow} px`);
  ok(r.minType >= 12, `390 ${route}: nothing under 12 px — ${r.minType} px smallest`);
  ok(r.minTap >= 44, `390 ${route}: nothing tappable under 44 px — ${r.minTap} px smallest`);
  await ctx.close();
}

ok(errors.length === 0, `no console errors on either surface — ${errors.length} ${JSON.stringify(errors.slice(0, 3))}`);

await browser.close();
console.log(fails.length ? `\nFOUNDATIONS: FAIL — ${fails.length} check(s)` : "\nFOUNDATIONS: ok");
process.exit(fails.length ? 1 : 0);
