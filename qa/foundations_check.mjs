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
import { settle } from "./settle.mjs";

const BASE = (process.argv[2] || "http://localhost:8830/design-catalog/").replace(/\/?$/, "/");
const REPO = "/mnt/HC_Volume_105573741/design-catalog-site-r8-cards";
const items = JSON.parse(readFileSync(`${REPO}/app/manifest.json`, "utf8"));
const byId = new Map(items.map((i) => [i.id, i]));
const fontIds = items.filter((i) => /^shadcn\/font-/.test(i.id)).map((i) => i.id);

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
  const r = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-specimen]")];
    const out = { n: rows.length, rows: [], nodes: document.querySelectorAll("*").length, facts: "", lede: "" };
    for (const li of rows) {
      const name = li.querySelector(".spec-name");
      const cs = name ? getComputedStyle(name) : null;
      const note = li.querySelector(".spec-note");
      out.rows.push({
        id: li.getAttribute("data-specimen"),
        face: li.getAttribute("data-specimen-face"),
        text: (name?.textContent ?? "").trim(),
        size: cs ? parseFloat(cs.fontSize) : 0,
        family: cs ? cs.fontFamily : "",
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

  ok(r.n === fontIds.length, `fonts: one row per member of the type — ${r.n} rows for ${fontIds.length} items`);
  ok(r.rows.every((x) => x.id && byId.has(x.id)), "fonts: every row is a real item id from the manifest");
  const hosted = r.rows.filter((x) => x.face === "hosted");
  const absent = r.rows.filter((x) => x.face === "absent");
  // two families, each with a `heading` cut: four rows, and they must be the two families the build actually has
  const hostedFamilies = new Set(hosted.map((h) => (/JetBrains/.test(h.family) ? "jetbrains-mono" : /Instrument/.test(h.family) ? "instrument-sans" : h.family)));
  ok(
    hosted.length === 4 && hostedFamilies.size === 2,
    `fonts: the self-hosted families and their heading cuts are drawn in their own face — ${hosted.length} rows, ${hostedFamilies.size} families: ${hosted.map((h) => `${h.text} (${h.size}px)`).join(", ")}`,
  );
  ok(
    hosted.every((h) => /Instrument Sans|JetBrains Mono/.test(h.family) && h.size >= 36),
    `fonts: those two rows ARE the face — family ${JSON.stringify(hosted.map((h) => h.family.split(",")[0]))}, size ${JSON.stringify(hosted.map((h) => h.size))}`,
  );
  ok(
    absent.every((a) => /not self-hosted/.test(a.meta)),
    `fonts: the other ${absent.length} rows say on themselves that the face is not here — ${absent.filter((a) => /not self-hosted/.test(a.meta)).length} of ${absent.length}`,
  );
  ok(
    hosted.every((h) => /self-hosted/.test(h.meta)),
    `fonts: and the two hosted families say why they are different — "${hosted[0]?.meta}"`,
  );
  ok(
    absent.every((a) => a.row.length <= 90),
    `fonts: a row is a specimen and one mono line, not a paragraph — longest row ${Math.max(...absent.map((a) => a.row.length))} chars`,
  );
  ok(
    absent.every((a) => /Instrument Sans/.test(a.family) && !/Instrument Sans|JetBrains Mono/.test(a.text.replace(/^(Heading )/, "")) === false ? true : true) &&
      absent.every((a) => /Instrument Sans/.test(a.family)),
    `fonts: no absent row is drawn in a face it does not have — all ${absent.length} are set in the interface face`,
  );
  ok(r.table === 0, `fonts: the collection does not fall back to a demo table — ${r.table} rows in the table`);
  ok(/52 members|52 item/.test(r.facts), `fonts: the page still states its own count — "${r.facts.slice(0, 70)}"`);
  ok(r.lede.length > 60, `fonts: the surface says once what it is showing and what it cannot — "${r.lede.slice(0, 96)}…"`);
  const names = r.rows.map((x) => x.text);
  ok(new Set(names).size === names.length, `fonts: every specimen is a different name — ${new Set(names).size} distinct of ${names.length}`);
  console.log(`     fonts: ${r.nodes} DOM nodes for 52 specimens`);
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
    out.facts = (document.querySelector("[data-type-facts]")?.textContent ?? "").replace(/\s+/g, " ").trim();
    out.demos = document.querySelectorAll("[data-also-row] iframe, [data-also-row] .type-demo-window").length;
    return out;
  });

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
  const leftovers = r.alsoRows.filter((id) => !r.themes.some((t) => t.id === id));
  ok(leftovers.length === 2, `themes: the two members that are components, not palettes, are still on the page — ${JSON.stringify(leftovers)}`);
  ok(r.demos >= 1, `themes: their demos still run — ${r.demos} demo window(s) under the palettes`);
  ok(/7 members|7 item/.test(r.facts), `themes: the page still states its own count — "${r.facts.slice(0, 70)}"`);
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
